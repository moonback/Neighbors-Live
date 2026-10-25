-- Neighbors Live — core schema.
-- Exact positions live in videos.location and are only read by SECURITY DEFINER functions.
-- Everything public uses videos.public_location (snapped ~50 m grid + per-video offset).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.video_category as enum ('alert', 'deal', 'event', 'help', 'shop', 'lost');
create type public.video_status as enum ('processing', 'active', 'hidden', 'removed', 'expired', 'rejected');
create type public.user_role as enum ('user', 'merchant', 'admin');
create type public.report_reason as enum (
  'recognizable_person', 'address_or_plate', 'dangerous', 'harassment', 'spam', 'false_info', 'other'
);
create type public.moderation_kind as enum (
  'validate', 'hide', 'remove', 'warn',       -- moderator decisions
  'auto_hide',                                -- report threshold reached
  'revert', 'ban', 'unban',                   -- admin
  'appeal_upheld', 'appeal_rejected'          -- appeal outcomes
);
create type public.appeal_status as enum ('pending', 'upheld', 'rejected');
create type public.job_kind as enum ('process', 'purge');
create type public.job_status as enum ('queued', 'running', 'done', 'failed');
create type public.merchant_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Configuration (thresholds are data, not code)
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text not null default ''
);

insert into public.app_config (key, value, description) values
  ('report_hide_threshold', '3', 'Distinct reporters before a video is auto-hidden'),
  ('moderator_min_account_days', '14', 'Minimum account age to become a zone moderator'),
  ('moderator_min_clean_videos', '5', 'Minimum published videos never reported'),
  ('moderator_min_reputation', '10', 'Minimum reputation to become a zone moderator'),
  ('merchant_daily_quota', '3', 'Merchant offers per rolling 24 h'),
  ('push_min_interval_minutes', '30', 'Minimum delay between two push notifications per user'),
  ('rate_publish', '{"limit": 5, "window_seconds": 3600}', 'Video publications per user'),
  ('rate_comment', '{"limit": 10, "window_seconds": 300}', 'Comments per user'),
  ('rate_report', '{"limit": 10, "window_seconds": 3600}', 'Reports per user'),
  ('rate_login', '{"limit": 5, "window_seconds": 900}', 'Magic link requests per IP hash / email');

-- ---------------------------------------------------------------------------
-- Profiles and settings
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_color text not null default '#64748b' check (avatar_color ~ '^#[0-9a-f]{6}$'),
  role public.user_role not null default 'user',
  reputation integer not null default 0,
  banned_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  default_radius integer not null default 1000 check (default_radius in (300, 1000, 3000)),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  notify_alerts boolean not null default true,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.merchant_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 280),
  status public.merchant_status not null default 'pending',
  daily_quota integer,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category public.video_category not null,
  caption text not null default '' check (char_length(caption) <= 140),
  location extensions.geography (point, 4326) not null,
  public_location extensions.geography (point, 4326) not null,
  accuracy_m real not null check (accuracy_m > 0 and accuracy_m <= 100),
  h3_cell text not null check (h3_cell ~ '^[0-9a-f]{15}$'),
  realtime_cell text not null check (realtime_cell ~ '^[0-9a-f]{15}$'),
  status public.video_status not null default 'processing',
  hidden_reason text,
  is_merchant boolean not null default false,
  mime_type text not null check (mime_type in ('video/mp4', 'video/webm')),
  duration_ms integer not null check (duration_ms > 0 and duration_ms <= 31000),
  raw_path text,
  video_path text,
  poster_path text,
  useful_count integer not null default 0,
  comment_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  expires_at timestamptz not null,
  check (expires_at > created_at and expires_at <= created_at + interval '7 days 1 minute')
);

create index videos_public_location_gix on public.videos using gist (public_location);
create index videos_location_gix on public.videos using gist (location);
create index videos_status_expires_idx on public.videos (status, expires_at);
create index videos_cell_status_idx on public.videos (h3_cell, status);
create index videos_author_idx on public.videos (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Media pipeline (consumed by apps/worker with FOR UPDATE SKIP LOCKED)
-- ---------------------------------------------------------------------------
create table public.media_jobs (
  id bigint generated always as identity primary key,
  -- No FK: purge jobs must outlive the deleted video row.
  video_id uuid,
  kind public.job_kind not null,
  status public.job_status not null default 'queued',
  payload jsonb not null default '{}',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_jobs_ready_idx on public.media_jobs (run_after) where status = 'queued';

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('alert_nearby', 'video_rejected', 'video_removed', 'moderation_warning')),
  user_id uuid references public.profiles (id) on delete cascade,
  video_id uuid,
  payload jsonb not null default '{}',
  attempts integer not null default 0,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Interactions
-- ---------------------------------------------------------------------------
create table public.reactions (
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index reactions_user_idx on public.reactions (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index comments_video_idx on public.comments (video_id, created_at desc, id desc);
create index comments_author_idx on public.comments (author_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text not null default '' check (char_length(details) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (video_id, reporter_id)
);
create index reports_reporter_idx on public.reports (reporter_id);

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create table public.zone_moderators (
  user_id uuid not null references public.profiles (id) on delete cascade,
  h3_cell text not null check (h3_cell ~ '^[0-9a-f]{15}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, h3_cell)
);
create index zone_moderators_cell_idx on public.zone_moderators (h3_cell);

-- Append-only journal. Ids are kept as plain uuids (no FK) so that the journal survives the
-- deletion of a video or an account, and so that no cascade ever rewrites history.
create table public.moderation_actions (
  id bigint generated always as identity primary key,
  video_id uuid,
  target_user_id uuid,
  h3_cell text,
  actor_id uuid,                 -- null = system (report threshold)
  kind public.moderation_kind not null,
  note text not null default '' check (char_length(note) <= 1000),
  reverts_action_id bigint references public.moderation_actions (id),
  created_at timestamptz not null default now()
);
create index moderation_actions_video_idx on public.moderation_actions (video_id);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  action_id bigint not null unique references public.moderation_actions (id),
  author_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 1000),
  status public.appeal_status not null default 'pending',
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision_note text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Push and rate limiting
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  -- Centre of the H3 cell chosen by the user: never the raw device position.
  zone_cell text not null check (zone_cell ~ '^[0-9a-f]{15}$'),
  zone_center extensions.geography (point, 4326) not null,
  radius_m integer not null check (radius_m in (300, 1000, 3000)),
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_subscriptions_zone_gix on public.push_subscriptions using gist (zone_center);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

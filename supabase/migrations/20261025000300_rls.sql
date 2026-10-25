-- Neighbors Live — privileges and Row Level Security.
-- Principle: deny by default. Table privileges are revoked from anon/authenticated and granted
-- back column by column; RLS policies then restrict rows. Sensitive mutations go through
-- SECURITY DEFINER functions executable by service_role only.

-- ---------------------------------------------------------------------------
-- Reset privileges
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Helpers used inside policies run with the caller's privileges.
grant execute on function public.is_admin(uuid), public.is_banned(uuid),
  public.is_zone_moderator(uuid, text), public.can_upload_raw(text) to anon, authenticated;
-- Position-safe public reads.
grant execute on function
  public.nearby_videos(double precision, double precision, integer, public.video_category, double precision, uuid, timestamptz, integer),
  public.map_videos(double precision, double precision, integer, public.video_category),
  public.get_public_video(uuid),
  public.moderator_eligible(uuid)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.merchant_profiles enable row level security;
alter table public.videos enable row level security;
alter table public.media_jobs enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.zone_moderators enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_limits enable row level security;

-- media_jobs, notification_outbox, rate_limits: no grant, no policy (service_role only).

-- ---------------------------------------------------------------------------
-- app_config: public read
-- ---------------------------------------------------------------------------
grant select on public.app_config to anon, authenticated;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- profiles: public card, owner edits username/bio
-- ---------------------------------------------------------------------------
grant select (id, username, bio, avatar_color, role, reputation, created_at) on public.profiles to anon, authenticated;
grant update (username, bio) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and not public.is_banned());

-- ---------------------------------------------------------------------------
-- user_settings: owner only
-- ---------------------------------------------------------------------------
grant select on public.user_settings to authenticated;
grant update (default_radius, locale, notify_alerts, onboarded_at, updated_at) on public.user_settings to authenticated;
create policy user_settings_read_own on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- merchant_profiles: approved ones are public; owner applies and edits texts
-- ---------------------------------------------------------------------------
grant select (user_id, business_name, description, status, created_at) on public.merchant_profiles to anon, authenticated;
grant insert (user_id, business_name, description) on public.merchant_profiles to authenticated;
grant update (business_name, description) on public.merchant_profiles to authenticated;

create policy merchant_read on public.merchant_profiles for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()));
create policy merchant_apply_own on public.merchant_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and not public.is_banned());
create policy merchant_update_own on public.merchant_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and not public.is_banned());

-- ---------------------------------------------------------------------------
-- videos: no location columns, no storage paths; active ones public, owner sees all of theirs
-- ---------------------------------------------------------------------------
grant select (id, author_id, category, caption, h3_cell, status, hidden_reason, is_merchant, duration_ms,
              useful_count, comment_count, report_count, created_at, published_at, expires_at)
  on public.videos to anon, authenticated;

create policy videos_read_active on public.videos for select to anon, authenticated
  using ((status = 'active' and expires_at > now()) or author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reactions: owner only
-- ---------------------------------------------------------------------------
grant select, delete on public.reactions to authenticated;
grant insert (video_id, user_id) on public.reactions to authenticated;

create policy reactions_read_own on public.reactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy reactions_insert_own on public.reactions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not public.is_banned()
    and exists (select 1 from public.videos v where v.id = video_id and v.status = 'active' and v.expires_at > now())
  );
create policy reactions_delete_own on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- comments: readable on visible videos; author writes and deletes their own
-- ---------------------------------------------------------------------------
grant select (id, video_id, author_id, body, created_at) on public.comments to anon, authenticated;
grant insert (video_id, author_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy comments_read on public.comments for select to anon, authenticated
  using (exists (select 1 from public.videos v where v.id = video_id));
create policy comments_insert_own on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and not public.is_banned());
create policy comments_delete_own on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reports: reporter creates and sees their own; cannot report own or invisible videos
-- ---------------------------------------------------------------------------
grant select (id, video_id, reason, created_at) on public.reports to authenticated;
grant insert (video_id, reporter_id, reason, details) on public.reports to authenticated;

create policy reports_read_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid()) and not public.is_banned()
    and exists (
      select 1 from public.videos v
      where v.id = video_id and v.status = 'active' and v.author_id <> (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- zone_moderators: public (moderator badge); writes through become_zone_moderator()
-- ---------------------------------------------------------------------------
grant select on public.zone_moderators to anon, authenticated;
create policy zone_moderators_read on public.zone_moderators for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- moderation_actions: a user sees the decisions about them; writes via functions only
-- ---------------------------------------------------------------------------
grant select (id, video_id, target_user_id, kind, note, created_at) on public.moderation_actions to authenticated;
create policy moderation_actions_read_target on public.moderation_actions for select to authenticated
  using (target_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- appeals: author contests a recent decision about them, once
-- ---------------------------------------------------------------------------
grant select on public.appeals to authenticated;
grant insert (action_id, author_id, reason) on public.appeals to authenticated;

create policy appeals_read_own on public.appeals for select to authenticated
  using (author_id = (select auth.uid()));
create policy appeals_insert_own on public.appeals for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.moderation_actions a
      where a.id = action_id
        and a.target_user_id = (select auth.uid())
        and a.kind in ('hide', 'remove', 'warn', 'auto_hide')
        and a.created_at > now() - interval '30 days'
    )
  );

-- ---------------------------------------------------------------------------
-- push_subscriptions: owner only
-- ---------------------------------------------------------------------------
grant select (id, user_id, endpoint, zone_cell, radius_m, created_at) on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, zone_cell, zone_center, radius_m) on public.push_subscriptions to authenticated;
grant update (zone_cell, zone_center, radius_m) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;

create policy push_read_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and not public.is_banned());
create policy push_update_own on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Neighbors Live — functions and triggers.
-- Conventions:
--  * SECURITY DEFINER functions always `set search_path = ''` and fully qualify names.
--  * Functions taking an explicit actor (p_actor / p_user) are callable by service_role only:
--    the Next.js route handler resolves the actor from the verified session.
--  * Errors are raised with a stable machine-readable message (e.g. 'rate_limited').

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.config_int(p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select (value #>> '{}')::integer from public.app_config where key = p_key
$$;

create function public.is_admin(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_uid and role = 'admin' and banned_at is null)
$$;

create function public.is_banned(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select banned_at is not null from public.profiles where id = p_uid), false)
$$;

create function public.is_zone_moderator(p_uid uuid, p_cell text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.zone_moderators zm
    join public.profiles p on p.id = zm.user_id
    where zm.user_id = p_uid and zm.h3_cell = p_cell and p.banned_at is null
  )
$$;

-- Snap to a ~50 m grid, then add a deterministic per-video offset inside the cell.
-- The result never reveals more than "somewhere in this 50 m square".
create function public.public_point(p_id uuid, p_loc extensions.geography) returns extensions.geography
language plpgsql immutable set search_path = '' as $$
declare
  v_lat double precision := extensions.st_y(p_loc::extensions.geometry);
  v_lng double precision := extensions.st_x(p_loc::extensions.geometry);
  v_step_lat constant double precision := 0.00045;
  v_step_lng double precision := 0.00045 / greatest(cos(radians(v_lat)), 0.01);
  v_off_lat double precision := ((hashtext(p_id::text) & 1023)::double precision / 1024 - 0.5) * v_step_lat;
  v_off_lng double precision := ((hashtext(reverse(p_id::text)) & 1023)::double precision / 1024 - 0.5) * v_step_lng;
begin
  return extensions.st_setsrid(
    extensions.st_makepoint(
      round(v_lng / v_step_lng) * v_step_lng + v_off_lng,
      round(v_lat / v_step_lat) * v_step_lat + v_off_lat
    ),
    4326
  )::extensions.geography;
end
$$;

create function public.bucket_distance(p_meters double precision) returns integer
language sql immutable set search_path = '' as $$
  select greatest(100, (round(p_meters / 100) * 100))::integer
$$;

-- Fixed-window counter. Raises 'rate_limited' when the configured limit is exceeded.
-- The increment is rolled back with the failing statement, so a blocked key stays at its limit.
create function public.check_rate_limit(p_key text, p_rule text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rule jsonb := (select value from public.app_config where key = 'rate_' || p_rule);
  v_window integer := coalesce((v_rule ->> 'window_seconds')::integer, 3600);
  v_limit integer := coalesce((v_rule ->> 'limit')::integer, 10);
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_rule || ':' || p_key, v_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_count;
  if v_count > v_limit then
    raise exception 'rate_limited' using hint = p_rule;
  end if;
end
$$;

create function public.moderation_penalty(p_kind public.moderation_kind) returns integer
language sql immutable set search_path = '' as $$
  select case p_kind when 'hide' then 3 when 'remove' then 10 when 'warn' then 2 else 0 end
$$;

-- ---------------------------------------------------------------------------
-- Account lifecycle
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_palette text[] := array['#ef4444', '#f97316', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777'];
begin
  insert into public.profiles (id, avatar_color)
  values (new.id, v_palette[1 + abs(hashtext(new.id::text)) % array_length(v_palette, 1)]);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Collects every storage path owned by the user and queues a purge job as a safety net.
-- The route handler deletes the files immediately, then deletes the auth user (cascade).
create function public.prepare_account_deletion(p_user uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
begin
  select coalesce(array_agg(p) filter (where p is not null), '{}') into v_paths
  from public.videos v, unnest(array[v.raw_path, v.video_path, v.poster_path]) as p
  where v.author_id = p_user;
  if cardinality(v_paths) > 0 then
    insert into public.media_jobs (kind, payload) values ('purge', jsonb_build_object('paths', v_paths));
  end if;
  return v_paths;
end
$$;

create function public.export_my_data(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user),
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = p_user),
    'merchant', (select to_jsonb(m) from public.merchant_profiles m where m.user_id = p_user),
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'category', v.category, 'caption', v.caption, 'status', v.status,
        'created_at', v.created_at, 'expires_at', v.expires_at, 'accuracy_m', v.accuracy_m,
        'lat', extensions.st_y(v.location::extensions.geometry),
        'lng', extensions.st_x(v.location::extensions.geometry)
      ) order by v.created_at) from public.videos v where v.author_id = p_user), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c where c.author_id = p_user), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r)) from public.reactions r where r.user_id = p_user), '[]'),
    'reports', coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r where r.reporter_id = p_user), '[]'),
    'appeals', coalesce((select jsonb_agg(to_jsonb(a)) from public.appeals a where a.author_id = p_user), '[]'),
    'moderation_actions_about_me', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'note', m.note, 'created_at', m.created_at, 'video_id', m.video_id)) from public.moderation_actions m where m.target_user_id = p_user), '[]'),
    'push_subscriptions', coalesce((select jsonb_agg(jsonb_build_object('zone_cell', s.zone_cell, 'radius_m', s.radius_m, 'created_at', s.created_at)) from public.push_subscriptions s where s.user_id = p_user), '[]')
  )
$$;

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------
create function public.videos_set_public_location() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.public_location := public.public_point(new.id, new.location);
  return new;
end
$$;

create trigger videos_public_location
  before insert or update of location on public.videos
  for each row execute function public.videos_set_public_location();

create function public.create_video(
  p_author uuid,
  p_category public.video_category,
  p_caption text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy real,
  p_h3_cell text,
  p_realtime_cell text,
  p_mime text,
  p_duration_ms integer,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_point extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_last record;
  v_quota integer;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = p_author;
  if not found or v_profile.username is null then raise exception 'profile_incomplete'; end if;
  if v_profile.banned_at is not null then raise exception 'banned'; end if;
  if p_accuracy is null or p_accuracy > 100 or p_accuracy <= 0 then raise exception 'accuracy_too_low'; end if;

  -- Position coherence: no physically impossible jump since the author's previous publication.
  select v.created_at, v.location into v_last
  from public.videos v where v.author_id = p_author order by v.created_at desc limit 1;
  if found and v_last.created_at > now() - interval '6 hours'
     and extensions.st_distance(v_last.location, v_point)
         / greatest(extract(epoch from now() - v_last.created_at), 1) > 70 then
    raise exception 'position_incoherent';
  end if;

  if p_category = 'shop' then
    select coalesce(m.daily_quota, public.config_int('merchant_daily_quota')) into v_quota
    from public.merchant_profiles m where m.user_id = p_author and m.status = 'approved';
    if v_quota is null then raise exception 'not_merchant'; end if;
    if (select count(*) from public.videos v
        where v.author_id = p_author and v.is_merchant and v.created_at > now() - interval '24 hours') >= v_quota then
      raise exception 'merchant_quota_exceeded';
    end if;
  end if;

  perform public.check_rate_limit(p_author::text, 'publish');

  insert into public.videos (
    author_id, category, caption, location, public_location, accuracy_m, h3_cell, realtime_cell,
    is_merchant, mime_type, duration_ms, expires_at
  ) values (
    p_author, p_category, p_caption, v_point, v_point, p_accuracy, p_h3_cell, p_realtime_cell,
    p_category = 'shop', p_mime, p_duration_ms, p_expires_at
  ) returning id into v_id;
  return v_id;
end
$$;

-- Storage RLS helper: a user may upload exactly one raw file, `<uid>/<video_id>.<ext>`,
-- for one of their own videos still waiting for its upload.
create function public.can_upload_raw(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.videos v
    where v.author_id = auth.uid()
      and split_part(p_name, '/', 1) = auth.uid()::text
      and split_part(split_part(p_name, '/', 2), '.', 1) = v.id::text
      and v.status = 'processing'
      and v.raw_path is null
  )
$$;

-- Called by the route handler once the upload is verified in storage.
create function public.enqueue_processing(p_author uuid, p_video uuid, p_raw_path text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_job bigint;
begin
  update public.videos set raw_path = p_raw_path
  where id = p_video and author_id = p_author and status = 'processing' and raw_path is null;
  if not found then raise exception 'video_not_awaiting_upload'; end if;
  insert into public.media_jobs (video_id, kind, payload)
  values (p_video, 'process', jsonb_build_object('raw_path', p_raw_path))
  returning id into v_job;
  perform pg_notify('media_jobs', v_job::text);
  return v_job;
end
$$;

-- Author withdraws their own video: row deleted (cascade), files purged.
create function public.withdraw_video(p_user uuid, p_video uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
begin
  select array_remove(array[raw_path, video_path, poster_path], null) into v_paths
  from public.videos where id = p_video and author_id = p_user;
  if not found then raise exception 'not_found'; end if;
  delete from public.videos where id = p_video;
  if cardinality(v_paths) > 0 then
    insert into public.media_jobs (video_id, kind, payload) values (p_video, 'purge', jsonb_build_object('paths', v_paths));
  end if;
  return v_paths;
end
$$;

-- Realtime broadcast + push outbox when an alert becomes visible.
create function public.on_video_activated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and old.status = 'processing' and new.category = 'alert' then
    begin
      perform realtime.send(
        jsonb_build_object(
          'id', new.id, 'category', new.category, 'caption', new.caption,
          'lat', extensions.st_y(new.public_location::extensions.geometry),
          'lng', extensions.st_x(new.public_location::extensions.geometry)
        ),
        'alert', 'alerts:' || new.realtime_cell, false
      );
    exception when others then
      -- Realtime is best effort: never block a publication because broadcasting failed.
      raise warning 'realtime.send failed: %', sqlerrm;
    end;
    insert into public.notification_outbox (kind, video_id) values ('alert_nearby', new.id);
  end if;
  return new;
end
$$;

create trigger videos_activated
  after update of status on public.videos
  for each row execute function public.on_video_activated();

-- ---------------------------------------------------------------------------
-- Worker job protocol
-- ---------------------------------------------------------------------------
create function public.claim_media_job(p_worker text) returns setof public.media_jobs
language sql security definer set search_path = '' as $$
  update public.media_jobs j
  set status = 'running', locked_at = now(), locked_by = p_worker, attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select id from public.media_jobs
    where (status = 'queued' and run_after <= now())
       or (status = 'running' and locked_at < now() - interval '15 minutes')
    order by run_after, id
    for update skip locked
    limit 1
  )
  returning j.*
$$;

create function public.complete_process_job(p_job bigint, p_video_path text, p_poster_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_video uuid;
begin
  update public.media_jobs set status = 'done', updated_at = now(), last_error = null
  where id = p_job and kind = 'process' returning video_id into v_video;
  if not found then raise exception 'job_not_found'; end if;
  update public.videos
  set video_path = p_video_path, poster_path = p_poster_path, raw_path = null,
      status = 'active', published_at = now()
  where id = v_video and status = 'processing';
end
$$;

create function public.complete_job(p_job bigint) returns void
language sql security definer set search_path = '' as $$
  update public.media_jobs set status = 'done', updated_at = now(), last_error = null where id = p_job
$$;

-- Exponential backoff (30 s, 60 s, 120 s…); after max_attempts the video is rejected.
create function public.fail_media_job(p_job bigint, p_error text) returns public.job_status
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.media_jobs;
  v_raw text;
begin
  select * into v_job from public.media_jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if v_job.attempts < v_job.max_attempts then
    update public.media_jobs
    set status = 'queued', last_error = left(p_error, 2000), locked_at = null, locked_by = null,
        run_after = now() + make_interval(secs => 30 * power(2, v_job.attempts - 1)), updated_at = now()
    where id = p_job;
    return 'queued';
  end if;

  update public.media_jobs set status = 'failed', last_error = left(p_error, 2000), updated_at = now() where id = p_job;
  if v_job.kind = 'process' then
    update public.videos set status = 'rejected', hidden_reason = 'processing_failed'
    where id = v_job.video_id and status = 'processing'
    returning raw_path into v_raw;
    if found then
      insert into public.notification_outbox (kind, user_id, video_id)
      select 'video_rejected', v.author_id, v.id from public.videos v where v.id = v_job.video_id;
    end if;
    if v_raw is not null then
      insert into public.media_jobs (video_id, kind, payload) values (v_job.video_id, 'purge', jsonb_build_object('paths', array[v_raw]));
    end if;
  end if;
  return 'failed';
end
$$;

-- ---------------------------------------------------------------------------
-- Expiry (scheduled with pg_cron)
-- ---------------------------------------------------------------------------
create function public.expire_videos() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  -- Clean publications earn reputation once they expire.
  update public.profiles p set reputation = p.reputation + sub.n
  from (
    select author_id, count(*)::integer as n from public.videos
    where status = 'active' and expires_at <= now() and report_count = 0
    group by author_id
  ) sub
  where p.id = sub.author_id;

  with targets as (
    select id, array_remove(array[video_path, poster_path, raw_path], null) as paths
    from public.videos
    where status in ('active', 'hidden') and expires_at <= now()
    for update
  ), expired as (
    update public.videos v
    set status = 'expired', video_path = null, poster_path = null, raw_path = null
    from targets t where v.id = t.id
    returning t.id, t.paths
  ), jobs as (
    insert into public.media_jobs (video_id, kind, payload)
    select id, 'purge', jsonb_build_object('paths', paths) from expired where cardinality(paths) > 0
  )
  select count(*) into v_count from expired;

  -- Uploads that never completed or got stuck.
  update public.videos set status = 'rejected', hidden_reason = 'upload_timeout'
  where status = 'processing' and created_at < now() - interval '2 hours';

  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Feed and map (public, position-safe: everything uses public_location)
-- ---------------------------------------------------------------------------
create function public.nearby_videos(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_category public.video_category default null,
  p_cursor_score double precision default null,
  p_cursor_id uuid default null,
  p_ref_time timestamptz default now(),
  p_limit integer default 10
) returns table (
  id uuid,
  author_id uuid,
  author_username text,
  author_color text,
  author_is_merchant boolean,
  author_website text,
  author_phone text,
  author_address text,
  category public.video_category,
  caption text,
  published_at timestamptz,
  expires_at timestamptz,
  useful_count integer,
  comment_count integer,
  is_merchant boolean,
  public_lat double precision,
  public_lng double precision,
  distance_m integer,
  score double precision
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_origin extensions.geography;
begin
  if p_radius_m not in (300, 1000, 3000) then raise exception 'radius_invalid'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'position_invalid'; end if;
  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
  with base as (
    select v.*, extensions.st_distance(v.public_location, v_origin) as d
    from public.videos v
    where v.status = 'active'
      and v.expires_at > now()
      and extensions.st_dwithin(v.public_location, v_origin, p_radius_m)
      and (p_category is null or v.category = p_category)
  ), scored as (
    -- Scores are computed against a fixed reference time carried by the cursor, so pages stay
    -- consistent while time passes (freshness half-life ~8 h).
    select b.*,
      (exp(-greatest(extract(epoch from (p_ref_time - coalesce(b.published_at, b.created_at))), 0) / 43200.0)
        * (1 + 0.3 * ln(1 + b.useful_count))
        * (1 - 0.5 * least(b.d / p_radius_m, 1)))::double precision as s
    from base b
  )
  select sc.id, sc.author_id, p.username, p.avatar_color, p.role = 'merchant',
         coalesce(mp.website, ''), coalesce(mp.phone, ''), coalesce(mp.address, ''),
         sc.category, sc.caption, sc.published_at, sc.expires_at, sc.useful_count, sc.comment_count,
         sc.is_merchant,
         extensions.st_y(sc.public_location::extensions.geometry),
         extensions.st_x(sc.public_location::extensions.geometry),
         public.bucket_distance(sc.d), sc.s
  from scored sc
  join public.profiles p on p.id = sc.author_id
  left join public.merchant_profiles mp on mp.user_id = sc.author_id and mp.status = 'approved'
  where p_cursor_score is null or (sc.s, sc.id) < (p_cursor_score, p_cursor_id)
  order by sc.s desc, sc.id desc
  limit least(greatest(p_limit, 1), 20);
end
$$;

create function public.map_videos(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_category public.video_category default null
) returns table (id uuid, category public.video_category, caption text, public_lat double precision, public_lng double precision)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_origin extensions.geography;
begin
  if p_radius_m not in (300, 1000, 3000) then raise exception 'radius_invalid'; end if;
  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  return query
  select v.id, v.category, v.caption,
         extensions.st_y(v.public_location::extensions.geometry),
         extensions.st_x(v.public_location::extensions.geometry)
  from public.videos v
  where v.status = 'active' and v.expires_at > now()
    and extensions.st_dwithin(v.public_location, v_origin, p_radius_m)
    and (p_category is null or v.category = p_category)
  order by v.published_at desc nulls last
  limit 500;
end
$$;

create function public.get_public_video(p_id uuid) returns table (
  id uuid, author_id uuid, author_username text, author_color text, category public.video_category,
  caption text, published_at timestamptz, expires_at timestamptz, useful_count integer,
  comment_count integer, is_merchant boolean, public_lat double precision, public_lng double precision
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.author_id, p.username, p.avatar_color, v.category, v.caption, v.published_at,
         v.expires_at, v.useful_count, v.comment_count, v.is_merchant,
         extensions.st_y(v.public_location::extensions.geometry),
         extensions.st_x(v.public_location::extensions.geometry)
  from public.videos v join public.profiles p on p.id = v.author_id
  where v.id = p_id and v.status = 'active' and v.expires_at > now()
$$;

-- ---------------------------------------------------------------------------
-- Interactions
-- ---------------------------------------------------------------------------
create function public.reactions_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set useful_count = useful_count + 1 where id = new.video_id;
  else
    update public.videos set useful_count = greatest(useful_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end
$$;
create trigger reactions_count after insert or delete on public.reactions
  for each row execute function public.reactions_count();

create function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.videos where id = new.video_id and status = 'active' and expires_at > now()) then
    raise exception 'video_not_active';
  end if;
  perform public.check_rate_limit(new.author_id::text, 'comment');
  return new;
end
$$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function public.comments_before_insert();

create function public.comments_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set comment_count = comment_count + 1 where id = new.video_id;
  else
    update public.videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end
$$;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.comments_count();

-- ---------------------------------------------------------------------------
-- Reports and auto-hide
-- ---------------------------------------------------------------------------
create function public.apply_report_threshold(p_video uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_reporters integer;
  v_video public.videos;
begin
  select count(distinct reporter_id) into v_reporters
  from public.reports where video_id = p_video and resolved_at is null;
  update public.videos set report_count = v_reporters where id = p_video returning * into v_video;
  if v_video.status = 'active' and v_reporters >= public.config_int('report_hide_threshold') then
    update public.videos set status = 'hidden', hidden_reason = 'reports' where id = p_video;
    insert into public.moderation_actions (video_id, target_user_id, h3_cell, actor_id, kind, note)
    values (p_video, v_video.author_id, v_video.h3_cell, null, 'auto_hide',
            v_reporters || ' signalements de comptes distincts');
    return true;
  end if;
  return false;
end
$$;

create function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate_limit(new.reporter_id::text, 'report');
  return new;
end
$$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

create function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.apply_report_threshold(new.video_id);
  return null;
end
$$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create function public.moderation_actions_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'moderation_actions is append-only';
end
$$;
create trigger moderation_actions_no_update before update or delete on public.moderation_actions
  for each row execute function public.moderation_actions_immutable();
create trigger moderation_actions_no_truncate before truncate on public.moderation_actions
  for each statement execute function public.moderation_actions_immutable();

create function public.moderator_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.banned_at is null
      and p.created_at <= now() - make_interval(days => public.config_int('moderator_min_account_days'))
      and p.reputation >= public.config_int('moderator_min_reputation')
      and (select count(*) from public.videos v
           where v.author_id = p.id and v.status in ('active', 'expired')
             and not exists (select 1 from public.reports r where r.video_id = v.id))
          >= public.config_int('moderator_min_clean_videos')
  )
$$;

-- A user becomes moderator of a zone where they have already published.
create function public.become_zone_moderator(p_user uuid, p_cell text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.moderator_eligible(p_user) then raise exception 'not_eligible'; end if;
  if not exists (select 1 from public.videos where author_id = p_user and h3_cell = p_cell and status in ('active', 'expired')) then
    raise exception 'not_local';
  end if;
  insert into public.zone_moderators (user_id, h3_cell) values (p_user, p_cell) on conflict do nothing;
end
$$;

create function public.moderate_video(
  p_actor uuid, p_video uuid, p_kind public.moderation_kind, p_note text default ''
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_video public.videos;
  v_action bigint;
  v_note text := coalesce(trim(p_note), '');
begin
  if p_kind not in ('validate', 'hide', 'remove', 'warn') then raise exception 'invalid_action'; end if;
  select * into v_video from public.videos where id = p_video for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.is_admin(p_actor) or public.is_zone_moderator(p_actor, v_video.h3_cell)) then
    raise exception 'forbidden';
  end if;
  if v_video.author_id = p_actor then raise exception 'conflict_of_interest'; end if;
  if p_kind = 'remove' and char_length(v_note) < 3 then raise exception 'note_required'; end if;

  if p_kind = 'validate' then
    update public.videos set status = 'active', hidden_reason = null, report_count = 0
    where id = p_video and status = 'hidden' and expires_at > now();
    -- Unfounded reports cost their authors.
    update public.profiles set reputation = reputation - 1
    where id in (select reporter_id from public.reports where video_id = p_video and resolved_at is null);
  elsif p_kind in ('hide', 'remove') then
    update public.videos
    set status = case when p_kind = 'hide' then 'hidden'::public.video_status else 'removed'::public.video_status end,
        hidden_reason = 'moderator'
    where id = p_video;
    update public.profiles set reputation = reputation + 1
    where id in (select reporter_id from public.reports where video_id = p_video and resolved_at is null);
  end if;

  update public.profiles
  set reputation = reputation - public.moderation_penalty(p_kind) + (case when p_kind = 'validate' then 1 else 0 end)
  where id = v_video.author_id;
  update public.reports set resolved_at = now() where video_id = p_video and resolved_at is null;

  insert into public.moderation_actions (video_id, target_user_id, h3_cell, actor_id, kind, note)
  values (p_video, v_video.author_id, v_video.h3_cell, p_actor, p_kind, v_note)
  returning id into v_action;

  if p_kind = 'remove' then
    -- Files are kept (private) during the 7-day appeal window, then purged.
    insert into public.media_jobs (video_id, kind, payload, run_after)
    values (p_video, 'purge',
            jsonb_build_object('paths', array_remove(array[v_video.video_path, v_video.poster_path, v_video.raw_path], null), 'action_id', v_action),
            now() + interval '7 days');
    insert into public.notification_outbox (kind, user_id, video_id) values ('video_removed', v_video.author_id, p_video);
  elsif p_kind = 'warn' then
    insert into public.notification_outbox (kind, user_id, video_id, payload)
    values ('moderation_warning', v_video.author_id, p_video, jsonb_build_object('note', v_note));
  end if;
  return v_action;
end
$$;

create function public.moderation_queue(p_actor uuid, p_cell text) returns table (
  video_id uuid, category public.video_category, caption text, status public.video_status,
  hidden_reason text, report_count integer, reasons public.report_reason[], created_at timestamptz,
  author_username text, video_path text, poster_path text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin(p_actor) or public.is_zone_moderator(p_actor, p_cell)) then raise exception 'forbidden'; end if;
  return query
  select v.id, v.category, v.caption, v.status, v.hidden_reason, v.report_count,
         array(select distinct r.reason from public.reports r where r.video_id = v.id and r.resolved_at is null),
         v.created_at, p.username, v.video_path, v.poster_path
  from public.videos v join public.profiles p on p.id = v.author_id
  where v.h3_cell = p_cell
    and v.author_id <> p_actor
    and (v.status = 'hidden' or (v.status = 'active' and exists (
      select 1 from public.reports r where r.video_id = v.id and r.resolved_at is null)))
  order by v.status = 'hidden' desc, v.report_count desc, v.created_at;
end
$$;

-- Appeals are reviewed by an admin or a moderator of the zone who did not take the decision.
create function public.resolve_appeal(p_reviewer uuid, p_appeal uuid, p_uphold boolean, p_note text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_appeal public.appeals;
  v_action public.moderation_actions;
begin
  select * into v_appeal from public.appeals where id = p_appeal for update;
  if not found or v_appeal.status <> 'pending' then raise exception 'not_found'; end if;
  select * into v_action from public.moderation_actions where id = v_appeal.action_id;
  if v_action.actor_id is not distinct from p_reviewer or v_action.target_user_id = p_reviewer then
    raise exception 'conflict_of_interest';
  end if;
  if not (public.is_admin(p_reviewer) or public.is_zone_moderator(p_reviewer, v_action.h3_cell)) then
    raise exception 'forbidden';
  end if;

  update public.appeals
  set status = case when p_uphold then 'upheld'::public.appeal_status else 'rejected'::public.appeal_status end,
      reviewer_id = p_reviewer, decision_note = coalesce(p_note, ''), decided_at = now()
  where id = p_appeal;

  if p_uphold then
    update public.videos set status = 'active', hidden_reason = null, report_count = 0
    where id = v_action.video_id and status in ('hidden', 'removed') and expires_at > now();
    delete from public.media_jobs
    where kind = 'purge' and status = 'queued' and (payload ->> 'action_id')::bigint = v_action.id;
    update public.profiles set reputation = reputation + public.moderation_penalty(v_action.kind)
    where id = v_action.target_user_id;
  end if;

  insert into public.moderation_actions (video_id, target_user_id, h3_cell, actor_id, kind, note, reverts_action_id)
  values (v_action.video_id, v_action.target_user_id, v_action.h3_cell, p_reviewer,
          case when p_uphold then 'appeal_upheld'::public.moderation_kind else 'appeal_rejected'::public.moderation_kind end,
          coalesce(p_note, ''), case when p_uphold then v_action.id end);
end
$$;

create function public.appeals_queue(p_reviewer uuid) returns table (
  appeal_id uuid, reason text, created_at timestamptz, action_kind public.moderation_kind,
  action_note text, video_id uuid, h3_cell text, caption text, video_path text, poster_path text
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.reason, a.created_at, m.kind, m.note, m.video_id, m.h3_cell, v.caption, v.video_path, v.poster_path
  from public.appeals a
  join public.moderation_actions m on m.id = a.action_id
  left join public.videos v on v.id = m.video_id
  where a.status = 'pending'
    and m.actor_id is distinct from p_reviewer
    and m.target_user_id <> p_reviewer
    and (public.is_admin(p_reviewer) or public.is_zone_moderator(p_reviewer, m.h3_cell))
  order by a.created_at
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create function public.admin_revert_action(p_admin uuid, p_action bigint, p_note text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_action public.moderation_actions;
  v_new bigint;
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'note_required'; end if;
  select * into v_action from public.moderation_actions where id = p_action;
  if not found then raise exception 'not_found'; end if;

  if v_action.kind in ('hide', 'remove', 'auto_hide') then
    update public.videos set status = 'active', hidden_reason = null, report_count = 0
    where id = v_action.video_id and status in ('hidden', 'removed') and expires_at > now();
    delete from public.media_jobs
    where kind = 'purge' and status = 'queued' and (payload ->> 'action_id')::bigint = v_action.id;
    update public.profiles set reputation = reputation + public.moderation_penalty(v_action.kind)
    where id = v_action.target_user_id;
  elsif v_action.kind = 'validate' then
    update public.videos set status = 'hidden', hidden_reason = 'admin' where id = v_action.video_id and status = 'active';
  elsif v_action.kind = 'warn' then
    update public.profiles set reputation = reputation + public.moderation_penalty('warn') where id = v_action.target_user_id;
  elsif v_action.kind = 'ban' then
    update public.profiles set banned_at = null where id = v_action.target_user_id;
  else
    raise exception 'not_revertible';
  end if;

  insert into public.moderation_actions (video_id, target_user_id, h3_cell, actor_id, kind, note, reverts_action_id)
  values (v_action.video_id, v_action.target_user_id, v_action.h3_cell, p_admin, 'revert', trim(p_note), v_action.id)
  returning id into v_new;
  return v_new;
end
$$;

create function public.admin_set_ban(p_admin uuid, p_user uuid, p_banned boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  if p_admin = p_user then raise exception 'conflict_of_interest'; end if;
  if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'note_required'; end if;
  update public.profiles set banned_at = case when p_banned then now() end where id = p_user;
  if not found then raise exception 'not_found'; end if;
  if p_banned then
    update public.videos set status = 'hidden', hidden_reason = 'banned' where author_id = p_user and status = 'active';
    delete from public.push_subscriptions where user_id = p_user;
  end if;
  insert into public.moderation_actions (target_user_id, actor_id, kind, note)
  values (p_user, p_admin, case when p_banned then 'ban'::public.moderation_kind else 'unban'::public.moderation_kind end, trim(p_note));
end
$$;

create function public.admin_review_merchant(p_admin uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  update public.merchant_profiles
  set status = case when p_approve then 'approved'::public.merchant_status else 'rejected'::public.merchant_status end,
      reviewed_by = p_admin
  where user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  update public.profiles set role = case when p_approve then 'merchant'::public.user_role else 'user'::public.user_role end
  where id = p_user and role <> 'admin';
end
$$;

create function public.admin_stats(p_admin uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'banned', (select count(*) from public.profiles where banned_at is not null),
    'active_videos', (select count(*) from public.videos where status = 'active' and expires_at > now()),
    'hidden_videos', (select count(*) from public.videos where status = 'hidden'),
    'open_reports', (select count(*) from public.reports where resolved_at is null),
    'pending_appeals', (select count(*) from public.appeals where status = 'pending'),
    'pending_merchants', (select count(*) from public.merchant_profiles where status = 'pending'),
    'zones', coalesce((
      select jsonb_agg(z order by z.open_reports desc) from (
        select v.h3_cell,
               count(*) filter (where v.status = 'active') as active,
               count(*) filter (where v.status = 'hidden') as hidden,
               (select count(*) from public.reports r join public.videos v2 on v2.id = r.video_id
                where v2.h3_cell = v.h3_cell and r.resolved_at is null) as open_reports,
               (select count(*) from public.zone_moderators zm where zm.h3_cell = v.h3_cell) as moderators
        from public.videos v group by v.h3_cell
      ) z), '[]')
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Notifications (worker)
-- ---------------------------------------------------------------------------
-- Takes a batch of pending outbox rows; SKIP LOCKED lets several workers share the outbox.
create function public.claim_outbox(p_limit integer default 100) returns setof public.notification_outbox
language sql security definer set search_path = '' as $$
  update public.notification_outbox o
  set processed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select id from public.notification_outbox
    where processed_at is null
    order by created_at
    for update skip locked
    limit p_limit
  )
  returning o.*
$$;

-- Groups a batch of alerts per user: one notification per user (on each of their devices)
-- listing every alert of the batch inside one of their zones. Users notified less than
-- `push_min_interval_minutes` ago are skipped (they still see the alerts in the feed banner);
-- the chosen users are stamped atomically so concurrent workers cannot double-send.
create function public.claim_alert_recipients(p_videos uuid[]) returns table (
  subscription_id uuid, user_id uuid, endpoint text, p256dh text, auth text,
  video_ids uuid[], captions text[]
)
language plpgsql security definer set search_path = '' as $$
declare
  v_interval interval := make_interval(mins => public.config_int('push_min_interval_minutes'));
begin
  return query
  with alerts as (
    select v.id, v.author_id, v.caption, v.public_location from public.videos v
    where v.id = any (p_videos) and v.status = 'active' and v.expires_at > now()
  ), matches as (
    select distinct s.user_id, a.id as video_id, a.caption
    from public.push_subscriptions s
    join public.user_settings us on us.user_id = s.user_id and us.notify_alerts
    join public.profiles p on p.id = s.user_id and p.banned_at is null
    join alerts a on a.author_id <> s.user_id
      and extensions.st_dwithin(s.zone_center, a.public_location, s.radius_m)
  ), per_user as (
    select m.user_id, array_agg(m.video_id order by m.video_id) as video_ids, array_agg(m.caption order by m.video_id) as captions
    from matches m
    where not exists (
      select 1 from public.push_subscriptions s2
      where s2.user_id = m.user_id and s2.last_notified_at > now() - v_interval)
    group by m.user_id
  ), stamped as (
    update public.push_subscriptions s set last_notified_at = now()
    from per_user u where s.user_id = u.user_id
    returning s.id, s.user_id, s.endpoint, s.p256dh, s.auth
  )
  select st.id, st.user_id, st.endpoint, st.p256dh, st.auth, u.video_ids, u.captions
  from stamped st join per_user u on u.user_id = st.user_id;
end
$$;

-- Subscriptions of one user (rejection / moderation notices are not rate limited).
create function public.user_push_targets(p_user uuid) returns table (subscription_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = p_user
$$;

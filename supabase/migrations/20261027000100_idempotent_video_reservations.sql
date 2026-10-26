-- Make reservation retries idempotent, including a lost response after the transaction commits.
alter table public.videos add column if not exists client_request_id uuid;
create unique index if not exists videos_author_request_uidx
  on public.videos (author_id, client_request_id)
  where client_request_id is not null;

create or replace function public.create_video(
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
  p_expires_at timestamptz,
  p_request_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_point extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_last record;
  v_quota integer;
  v_id uuid;
begin
  if p_request_id is null then raise exception 'invalid_input'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_author::text || ':' || p_request_id::text, 0)
  );

  select * into v_profile from public.profiles where id = p_author;
  if not found or v_profile.username is null then raise exception 'profile_incomplete'; end if;
  if v_profile.banned_at is not null then raise exception 'banned'; end if;

  select id into v_id from public.videos
  where author_id = p_author and client_request_id = p_request_id;
  if found then return v_id; end if;

  if p_accuracy is null or p_accuracy > 100 or p_accuracy <= 0 then raise exception 'accuracy_too_low'; end if;

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
    is_merchant, mime_type, duration_ms, expires_at, client_request_id
  ) values (
    p_author, p_category, p_caption, v_point, v_point, p_accuracy, p_h3_cell, p_realtime_cell,
    p_category = 'shop', p_mime, p_duration_ms, p_expires_at, p_request_id
  ) returning id into v_id;
  return v_id;
end
$$;

-- Keep the prior service-only signature working for existing internal callers and SQL fixtures.
create or replace function public.create_video(
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
language sql security definer set search_path = '' as $$
  select public.create_video(
    p_author, p_category, p_caption, p_lat, p_lng, p_accuracy, p_h3_cell,
    p_realtime_cell, p_mime, p_duration_ms, p_expires_at, gen_random_uuid()
  )
$$;

revoke all on function public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz, uuid) to service_role;
revoke all on function public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz) to service_role;

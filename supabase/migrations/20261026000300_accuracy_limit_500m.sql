alter table public.videos
  drop constraint if exists videos_accuracy_m_check,
  add constraint videos_accuracy_m_check check (accuracy_m > 0 and accuracy_m <= 500);

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
  if p_accuracy is null or p_accuracy > 500 or p_accuracy <= 0 then raise exception 'accuracy_too_low'; end if;

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

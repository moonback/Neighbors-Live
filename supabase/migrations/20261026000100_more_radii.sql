-- Voisino — 5 km and 10 km radii (feed, map, default setting, alert subscriptions).

alter table public.user_settings
  drop constraint user_settings_default_radius_check,
  add constraint user_settings_default_radius_check
    check (default_radius in (300, 1000, 3000, 5000, 10000));

alter table public.push_subscriptions
  drop constraint push_subscriptions_radius_m_check,
  add constraint push_subscriptions_radius_m_check
    check (radius_m in (300, 1000, 3000, 5000, 10000));

create or replace function public.nearby_videos(
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
  if p_radius_m not in (300, 1000, 3000, 5000, 10000) then raise exception 'radius_invalid'; end if;
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
         sc.category, sc.caption, sc.published_at, sc.expires_at, sc.useful_count, sc.comment_count,
         sc.is_merchant,
         extensions.st_y(sc.public_location::extensions.geometry),
         extensions.st_x(sc.public_location::extensions.geometry),
         public.bucket_distance(sc.d), sc.s
  from scored sc
  join public.profiles p on p.id = sc.author_id
  where p_cursor_score is null or (sc.s, sc.id) < (p_cursor_score, p_cursor_id)
  order by sc.s desc, sc.id desc
  limit least(greatest(p_limit, 1), 20);
end
$$;

create or replace function public.map_videos(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_category public.video_category default null
) returns table (id uuid, category public.video_category, caption text, public_lat double precision, public_lng double precision)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_origin extensions.geography;
begin
  if p_radius_m not in (300, 1000, 3000, 5000, 10000) then raise exception 'radius_invalid'; end if;
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

drop function if exists public.get_public_video(uuid);

create function public.get_public_video(p_id uuid) returns table (
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
  public_lng double precision
)
language sql stable security definer set search_path = '' as $$
  select
    v.id,
    v.author_id,
    p.username,
    p.avatar_color,
    p.role = 'merchant',
    coalesce(mp.website, ''),
    coalesce(mp.phone, ''),
    coalesce(mp.address, ''),
    v.category,
    v.caption,
    v.published_at,
    v.expires_at,
    v.useful_count,
    v.comment_count,
    v.is_merchant,
    extensions.st_y(v.public_location::extensions.geometry),
    extensions.st_x(v.public_location::extensions.geometry)
  from public.videos v
  join public.profiles p on p.id = v.author_id
  left join public.merchant_profiles mp on mp.user_id = v.author_id and mp.status = 'approved'
  where v.id = p_id and v.status = 'active' and v.expires_at > now();
$$;

grant execute on function public.get_public_video(uuid) to anon, authenticated;

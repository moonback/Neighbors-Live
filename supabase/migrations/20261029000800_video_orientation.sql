alter table public.videos
  add column orientation text not null default 'portrait'
    check (orientation in ('portrait', 'landscape'));

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
  p_expires_at timestamptz,
  p_request_id uuid,
  p_offer_terms text,
  p_orientation text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_orientation is null or p_orientation not in ('portrait', 'landscape') then
    raise exception 'invalid_video_orientation';
  end if;

  v_id := public.create_video(
    p_author, p_category, p_caption, p_lat, p_lng, p_accuracy, p_h3_cell,
    p_realtime_cell, p_mime, p_duration_ms, p_expires_at, p_request_id, p_offer_terms
  );

  update public.videos
  set orientation = p_orientation
  where id = v_id and author_id = p_author;
  if not found then raise exception 'not_found'; end if;

  return v_id;
end
$$;

revoke all on function public.create_video(
  uuid, public.video_category, text, double precision, double precision, real,
  text, text, text, integer, timestamptz, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_video(
  uuid, public.video_category, text, double precision, double precision, real,
  text, text, text, integer, timestamptz, uuid, text, text
) to service_role;

create or replace function public.export_my_data(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user),
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = p_user),
    'merchant', (select to_jsonb(m) from public.merchant_profiles m where m.user_id = p_user),
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'category', v.category, 'caption', v.caption, 'offer_terms', v.offer_terms,
        'orientation', v.orientation, 'status', v.status, 'created_at', v.created_at,
        'expires_at', v.expires_at, 'accuracy_m', v.accuracy_m,
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

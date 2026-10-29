-- record_video_event hardening (20261029000900 is already pushed, so changes land here):
-- * p_actor becomes optional and last, so anonymous calls need no actor;
-- * only active offers of approved merchants are counted (data minimisation);
-- * anonymous events are also capped per video, because the IP hash key relies on a forwarded
--   header that a script can rotate.

drop function public.record_video_event(uuid, public.video_event_kind, uuid, text);

insert into public.app_config (key, value, description) values
  ('rate_video_event_anon', '{"limit": 300, "window_seconds": 3600}', 'Anonymous statistics events per video')
on conflict (key) do nothing;

create function public.record_video_event(
  p_video uuid,
  p_kind public.video_event_kind,
  p_rate_key text,
  p_actor uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.videos v
    join public.merchant_profiles mp on mp.user_id = v.author_id and mp.status = 'approved'
    where v.id = p_video and v.category = 'shop' and v.status = 'active' and v.expires_at > now()
      and v.author_id is distinct from p_actor
  ) then
    return;
  end if;
  perform public.check_rate_limit(p_rate_key, 'video_event');
  if p_actor is null then
    perform public.check_rate_limit(p_video::text, 'video_event_anon');
  end if;
  insert into public.video_daily_stats as s (video_id, day, kind, count)
  values (p_video, current_date, p_kind, 1)
  on conflict (video_id, day, kind) do update set count = s.count + 1;
end
$$;

revoke execute on function public.record_video_event(uuid, public.video_event_kind, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_video_event(uuid, public.video_event_kind, text, uuid)
  to service_role;

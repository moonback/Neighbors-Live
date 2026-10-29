-- Merchant statistics: daily aggregated counters per video. No viewer id, no position, no IP:
-- only (video, day, kind) -> count. Rows follow the video (cascade on video/account deletion).

create type public.video_event_kind as enum ('view', 'offer_click', 'call_click', 'directions_click');

create table public.video_daily_stats (
  video_id uuid not null references public.videos (id) on delete cascade,
  day date not null,
  kind public.video_event_kind not null,
  count integer not null default 0 check (count >= 0),
  primary key (video_id, day, kind)
);

alter table public.video_daily_stats enable row level security;
grant select on public.video_daily_stats to authenticated;

create policy video_daily_stats_read_author on public.video_daily_stats for select to authenticated
  using (
    exists (
      select 1 from public.videos v
      where v.id = video_id and v.author_id = (select auth.uid())
    )
    or public.is_admin()
  );

insert into public.app_config (key, value, description) values
  ('rate_video_event', '{"limit": 120, "window_seconds": 3600}', 'Video statistics events per user / IP hash'),
  ('merchant_stats_since', to_jsonb(now()), 'Start of view and offer click measurement')
on conflict (key) do nothing;

-- Called by the server only (service role) with the actor resolved from the session, or null for
-- anonymous visitors; p_rate_key is a salted hash, never a raw IP.
create function public.record_video_event(
  p_video uuid,
  p_kind public.video_event_kind,
  p_actor uuid,
  p_rate_key text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.videos
    where id = p_video and status = 'active' and expires_at > now()
      and author_id is distinct from p_actor
  ) then
    return;
  end if;
  perform public.check_rate_limit(p_rate_key, 'video_event');
  insert into public.video_daily_stats as s (video_id, day, kind, count)
  values (p_video, current_date, p_kind, 1)
  on conflict (video_id, day, kind) do update set count = s.count + 1;
end
$$;

revoke execute on function public.record_video_event(uuid, public.video_event_kind, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_video_event(uuid, public.video_event_kind, uuid, text)
  to service_role;

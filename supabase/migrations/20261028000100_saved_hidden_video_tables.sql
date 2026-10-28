-- Saved and hidden video preferences persisted on the server for authenticated users.

create table if not exists public.saved_videos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.hidden_videos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists saved_videos_user_created_idx on public.saved_videos (user_id, created_at desc);
create index if not exists hidden_videos_user_created_idx on public.hidden_videos (user_id, created_at desc);

alter table public.saved_videos enable row level security;
alter table public.hidden_videos enable row level security;

grant select, insert, delete on public.saved_videos to authenticated;
grant select, insert, delete on public.hidden_videos to authenticated;
revoke update on public.saved_videos from authenticated;

drop policy if exists saved_videos_read_own on public.saved_videos;
create policy saved_videos_read_own on public.saved_videos for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists saved_videos_write_own on public.saved_videos;
create policy saved_videos_write_own on public.saved_videos for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not public.is_banned()
    and exists (
      select 1 from public.videos v
      where v.id = video_id and v.status = 'active' and v.expires_at > now()
    )
  );

drop policy if exists saved_videos_update_own on public.saved_videos;
drop policy if exists saved_videos_delete_own on public.saved_videos;
create policy saved_videos_delete_own on public.saved_videos for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists hidden_videos_read_own on public.hidden_videos;
create policy hidden_videos_read_own on public.hidden_videos for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists hidden_videos_write_own on public.hidden_videos;
create policy hidden_videos_write_own on public.hidden_videos for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not public.is_banned()
    and exists (
      select 1 from public.videos v
      where v.id = video_id and v.status = 'active' and v.expires_at > now()
    )
  );

drop policy if exists hidden_videos_delete_own on public.hidden_videos;
create policy hidden_videos_delete_own on public.hidden_videos for delete to authenticated
  using (user_id = (select auth.uid()));

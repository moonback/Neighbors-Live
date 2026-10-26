alter table public.media_jobs
  add column settings_snapshot jsonb,
  add constraint media_jobs_settings_snapshot_object
    check (settings_snapshot is null or jsonb_typeof(settings_snapshot) = 'object');

-- Freeze the effective controls when a processing job is created. Retries keep the same snapshot.
create function public.snapshot_media_settings_on_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'process' and new.settings_snapshot is null then
    select jsonb_build_object(
      'face_blur_enabled', (select value from public.app_config where key = 'media_face_blur_enabled'),
      'plate_blur_enabled', (select value from public.app_config where key = 'media_plate_blur_enabled'),
      'detect_every', (select value from public.app_config where key = 'media_detect_every'),
      'face_min_score', (select value from public.app_config where key = 'media_face_min_score'),
      'plate_min_score', (select value from public.app_config where key = 'media_plate_min_score')
    ) into new.settings_snapshot;
  end if;
  return new;
end
$$;

create trigger media_jobs_snapshot_settings
before insert on public.media_jobs
for each row execute function public.snapshot_media_settings_on_enqueue();

create table public.media_settings_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  previous_settings jsonb not null,
  new_settings jsonb not null,
  created_at timestamptz not null default now()
);
create index media_settings_audit_created_idx on public.media_settings_audit (created_at desc);
alter table public.media_settings_audit enable row level security;

create table public.media_worker_status (
  worker_id text primary key,
  detectors jsonb not null check (jsonb_typeof(detectors) = 'object'),
  last_seen timestamptz not null default now()
);
alter table public.media_worker_status enable row level security;

create or replace function public.admin_set_media_settings(p_admin uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_previous jsonb;
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  if p_settings is null or jsonb_typeof(p_settings) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_settings)) <> 5
    or not (p_settings ?& array[
      'face_blur_enabled', 'plate_blur_enabled', 'detect_every',
      'face_min_score', 'plate_min_score'
    ])
    or jsonb_typeof(p_settings->'face_blur_enabled') <> 'boolean'
    or jsonb_typeof(p_settings->'plate_blur_enabled') <> 'boolean'
    or jsonb_typeof(p_settings->'detect_every') <> 'number'
    or jsonb_typeof(p_settings->'face_min_score') <> 'number'
    or jsonb_typeof(p_settings->'plate_min_score') <> 'number'
    or (p_settings->>'detect_every')::numeric <> trunc((p_settings->>'detect_every')::numeric)
    or (p_settings->>'detect_every')::integer not between 1 and 10
    or (p_settings->>'face_min_score')::numeric not between 0.05 and 0.95
    or (p_settings->>'plate_min_score')::numeric not between 0.05 and 0.95 then
    raise exception 'invalid_media_settings';
  end if;

  select jsonb_object_agg(
    case key
      when 'media_face_blur_enabled' then 'face_blur_enabled'
      when 'media_plate_blur_enabled' then 'plate_blur_enabled'
      when 'media_detect_every' then 'detect_every'
      when 'media_face_min_score' then 'face_min_score'
      else 'plate_min_score'
    end, value
  ) into v_previous
  from public.app_config
  where key = any(array[
    'media_face_blur_enabled', 'media_plate_blur_enabled', 'media_detect_every',
    'media_face_min_score', 'media_plate_min_score'
  ]);

  update public.app_config set value = p_settings->'face_blur_enabled' where key = 'media_face_blur_enabled';
  update public.app_config set value = p_settings->'plate_blur_enabled' where key = 'media_plate_blur_enabled';
  update public.app_config set value = p_settings->'detect_every' where key = 'media_detect_every';
  update public.app_config set value = p_settings->'face_min_score' where key = 'media_face_min_score';
  update public.app_config set value = p_settings->'plate_min_score' where key = 'media_plate_min_score';

  insert into public.media_settings_audit (actor_id, previous_settings, new_settings)
  values (p_admin, v_previous, p_settings);
end
$$;

grant execute on function public.admin_set_media_settings(uuid, jsonb) to service_role;

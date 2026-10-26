-- Runtime media-processing controls. Model paths stay in the worker environment;
-- these settings only control use of installed models and their processing thresholds.
insert into public.app_config (key, value, description) values
  ('media_face_blur_enabled', 'true', 'Enable face blurring for new media jobs'),
  ('media_plate_blur_enabled', 'false', 'Enable license plate blurring for new media jobs'),
  ('media_detect_every', '2', 'Run detection every N frames (1-10)'),
  ('media_face_min_score', '0.5', 'Minimum face detection confidence (0.05-0.95)'),
  ('media_plate_min_score', '0.35', 'Minimum plate detection confidence (0.05-0.95)')
on conflict (key) do nothing;

create function public.admin_set_media_settings(p_admin uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;
  if p_settings is null or jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'invalid_media_settings';
  end if;
  if (select count(*) from jsonb_object_keys(p_settings)) <> 5
    or not (p_settings ?& array[
      'face_blur_enabled', 'plate_blur_enabled', 'detect_every',
      'face_min_score', 'plate_min_score'
    ]) then
    raise exception 'invalid_media_settings';
  end if;
  if jsonb_typeof(p_settings->'face_blur_enabled') <> 'boolean'
    or jsonb_typeof(p_settings->'plate_blur_enabled') <> 'boolean'
    or jsonb_typeof(p_settings->'detect_every') <> 'number'
    or jsonb_typeof(p_settings->'face_min_score') <> 'number'
    or jsonb_typeof(p_settings->'plate_min_score') <> 'number' then
    raise exception 'invalid_media_settings';
  end if;
  if (p_settings->>'detect_every')::numeric <> trunc((p_settings->>'detect_every')::numeric)
    or (p_settings->>'detect_every')::integer not between 1 and 10
    or (p_settings->>'face_min_score')::numeric not between 0.05 and 0.95
    or (p_settings->>'plate_min_score')::numeric not between 0.05 and 0.95 then
    raise exception 'invalid_media_settings';
  end if;

  update public.app_config set value = p_settings->'face_blur_enabled'
    where key = 'media_face_blur_enabled';
  update public.app_config set value = p_settings->'plate_blur_enabled'
    where key = 'media_plate_blur_enabled';
  update public.app_config set value = p_settings->'detect_every'
    where key = 'media_detect_every';
  update public.app_config set value = p_settings->'face_min_score'
    where key = 'media_face_min_score';
  update public.app_config set value = p_settings->'plate_min_score'
    where key = 'media_plate_min_score';
end
$$;

grant execute on function public.admin_set_media_settings(uuid, jsonb) to service_role;

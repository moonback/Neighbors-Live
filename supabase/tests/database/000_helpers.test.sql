-- Test helpers, created once per test run (local / CI databases only, never in production).
-- This file commits on purpose so that the following test files can use the helpers.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Creates an auth user (the profile and settings rows come from the signup trigger).
create or replace function tests.create_user(p_username text, p_days_old integer default 30, p_reputation integer default 0)
returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_username || '@test.local', now(), now());
  update public.profiles
  set username = p_username, created_at = now() - make_interval(days => p_days_old), reputation = p_reputation
  where id = v_id;
  return v_id;
end
$$;

create or replace function tests.authenticate_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end
$$;

create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end
$$;

-- Inserts a video directly (bypassing create_video), active by default.
create or replace function tests.make_video(
  p_author uuid,
  p_lat double precision default 48.8722,
  p_lng double precision default 2.3767,
  p_category public.video_category default 'deal',
  p_status public.video_status default 'active',
  p_cell text default '881fb46625fffff'
) returns uuid language plpgsql as $$
declare
  v_id uuid;
  v_point extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
begin
  insert into public.videos (author_id, category, caption, location, public_location, accuracy_m, h3_cell,
    realtime_cell, status, mime_type, duration_ms, video_path, poster_path, published_at, expires_at)
  values (p_author, p_category, 'test', v_point, v_point, 10, p_cell, '871fb4662ffffff', p_status,
    'video/mp4', 10000, 'demo/' || gen_random_uuid() || '.mp4', 'demo/poster.jpg',
    case when p_status = 'active' then now() end, now() + interval '1 day')
  returning id into v_id;
  return v_id;
end
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select has_function('tests', 'create_user', array['text', 'integer', 'integer'], 'test helpers are installed');
select * from finish();

begin;
select no_plan();

-- Every table of the public schema has RLS enabled.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'RLS is enabled on every public table'
);

select tables_are('public', array[
  'app_config', 'profiles', 'user_settings', 'merchant_profiles', 'videos', 'media_jobs',
  'notification_outbox', 'reactions', 'saved_videos', 'hidden_videos', 'comments', 'reports', 'zone_moderators',
  'moderation_actions', 'appeals', 'push_subscriptions', 'rate_limits'
]);

select col_type_is('public', 'videos', 'location', 'extensions', 'geography(Point,4326)', 'location is geography(Point,4326)');
select col_type_is('public', 'videos', 'offer_terms', 'pg_catalog', 'text', 'offer terms are stored as text');
select has_index('public', 'videos', 'videos_location_gix', 'GIST index on location');
select has_index('public', 'videos', 'videos_public_location_gix', 'GIST index on public_location');

-- Exact position and storage paths are never readable by API roles.
select ok(not has_column_privilege('anon', 'public.videos', 'location', 'select'), 'anon cannot read videos.location');
select ok(not has_column_privilege('authenticated', 'public.videos', 'location', 'select'), 'authenticated cannot read videos.location');
select ok(not has_column_privilege('authenticated', 'public.videos', 'public_location', 'select'), 'public_location only through functions');
select ok(not has_column_privilege('authenticated', 'public.videos', 'video_path', 'select'), 'authenticated cannot read storage paths');
select ok(not has_column_privilege('authenticated', 'public.videos', 'accuracy_m', 'select'), 'authenticated cannot read accuracy');
select ok(not has_column_privilege('authenticated', 'public.push_subscriptions', 'zone_center', 'select'), 'push zone centre is write-only');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'banned_at', 'select'), 'ban status is not exposed');

-- Service-only tables.
select ok(not has_table_privilege('authenticated', 'public.media_jobs', 'select'), 'media_jobs hidden from users');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'select'), 'outbox hidden from users');
select ok(not has_table_privilege('authenticated', 'public.rate_limits', 'select'), 'rate_limits hidden from users');

-- Sensitive functions are not callable from the API.
select ok(not has_function_privilege('authenticated', 'public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz)', 'execute'), 'create_video is service-only');
select ok(not has_function_privilege('authenticated', 'public.create_video(uuid, public.video_category, text, double precision, double precision, real, text, text, text, integer, timestamptz, uuid, text)', 'execute'), 'offer-terms create_video overload is service-only');
select ok(not has_function_privilege('authenticated', 'public.moderate_video(uuid, uuid, public.moderation_kind, text)', 'execute'), 'moderate_video is service-only');
select ok(not has_function_privilege('anon', 'public.expire_videos()', 'execute'), 'expire_videos is service-only');
select ok(not has_function_privilege('authenticated', 'public.export_my_data(uuid)', 'execute'), 'export_my_data is service-only');
select ok(has_function_privilege('anon', 'public.nearby_videos(double precision, double precision, integer, public.video_category, double precision, uuid, timestamptz, integer)', 'execute'), 'nearby_videos is public');

-- Private buckets and scheduled expiry.
select is((select count(*)::integer from storage.buckets where id in ('raw-videos', 'videos') and not public), 2, 'video buckets are private');
select is((select count(*)::integer from cron.job where jobname = 'expire-videos'), 1, 'expire_videos is scheduled with pg_cron');

-- Signup trigger creates profile + settings.
select tests.create_user('schema_user');
select is((select count(*)::integer from public.user_settings s join public.profiles p on p.id = s.user_id where p.username = 'schema_user'), 1, 'signup creates profile and settings');
select matches((select avatar_color from public.profiles where username = 'schema_user'), '^#[0-9a-f]{6}$', 'avatar colour generated');

select * from finish();
rollback;

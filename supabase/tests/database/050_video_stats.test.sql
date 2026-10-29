-- Merchant statistics: aggregated daily counters without any viewer identifier.
begin;
select no_plan();

create temp table s as
select tests.create_user('stats_shop') as shop, tests.create_user('stats_viewer') as viewer,
       tests.create_user('stats_other') as other;
create temp table sv as
select tests.make_video((select shop from s), p_category => 'shop') as live_v,
       tests.make_video((select shop from s), p_category => 'shop', p_status => 'expired') as expired_v;
grant select on s, sv to anon, authenticated;

-- ---------------------------------------------------------------- schema
select has_table('public', 'video_daily_stats', 'video_daily_stats exists');
select ok((select relrowsecurity from pg_class where oid = 'public.video_daily_stats'::regclass),
  'video_daily_stats has RLS enabled');
select col_is_pk('public', 'video_daily_stats', array['video_id', 'day', 'kind'], 'one row per video, day and kind');
select hasnt_column('public', 'video_daily_stats', 'user_id', 'no viewer identifier is stored');
select ok(not has_table_privilege('authenticated', 'public.video_daily_stats', 'insert'), 'users cannot insert stats');
select ok(not has_table_privilege('authenticated', 'public.video_daily_stats', 'update'), 'users cannot update stats');
select ok(not has_table_privilege('anon', 'public.video_daily_stats', 'select'), 'anon cannot read stats');
select ok(not has_function_privilege('authenticated',
  'public.record_video_event(uuid, public.video_event_kind, uuid, text)', 'execute'),
  'record_video_event is server-only');
select ok(exists (select 1 from public.app_config where key = 'merchant_stats_since'), 'measurement start is recorded');

-- ---------------------------------------------------------------- record_video_event
select public.record_video_event((select live_v from sv), 'view', (select viewer from s), 'k1');
select is((select count from public.video_daily_stats where video_id = (select live_v from sv) and kind = 'view'),
  1, 'first view counts 1');
select public.record_video_event((select live_v from sv), 'view', null, 'k2');
select is((select count from public.video_daily_stats where video_id = (select live_v from sv) and kind = 'view'),
  2, 'anonymous view on the same day increments');
select public.record_video_event((select live_v from sv), 'offer_click', (select viewer from s), 'k1');
select is((select count from public.video_daily_stats where video_id = (select live_v from sv) and kind = 'offer_click'),
  1, 'kinds are counted separately');
select public.record_video_event((select live_v from sv), 'view', (select shop from s), 'k3');
select is((select count from public.video_daily_stats where video_id = (select live_v from sv) and kind = 'view'),
  2, 'author views are ignored');
select public.record_video_event((select expired_v from sv), 'view', (select viewer from s), 'k1');
select is((select count(*)::integer from public.video_daily_stats where video_id = (select expired_v from sv)),
  0, 'inactive videos are ignored');

update public.app_config set value = '{"limit": 2, "window_seconds": 3600}' where key = 'rate_video_event';
select public.record_video_event((select live_v from sv), 'view', null, 'spam');
select public.record_video_event((select live_v from sv), 'view', null, 'spam');
select throws_ok($$select public.record_video_event((select live_v from sv), 'view', null, 'spam')$$,
  'rate_limited', 'record_video_event: rate limited per key');

-- ---------------------------------------------------------------- RLS
select tests.authenticate_as((select shop from s));
select is((select count(*)::integer from public.video_daily_stats), 2, 'author reads own video stats');
select tests.clear_authentication();
select tests.authenticate_as((select other from s));
select is((select count(*)::integer from public.video_daily_stats), 0, 'other users read nothing');
select tests.clear_authentication();

select * from finish();
rollback;

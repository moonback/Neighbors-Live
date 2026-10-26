-- SQL functions: privacy of positions, feed, publication checks, rate limits, media jobs,
-- expiry, account export/deletion, notifications.
begin;
select no_plan();

-- Isolate from demo data and from jobs left by e2e runs (rolled back at the end of the file).
delete from public.videos;
delete from public.media_jobs;
delete from public.notification_outbox;

create temp table u as
select tests.create_user('carla') as carla, tests.create_user('dan') as dan,
       tests.create_user('shop_owner') as shop, tests.create_user('nouveau') as fresh, tests.create_user('eve') as eve;
update public.profiles set username = null where id = (select fresh from u);

-- ---------------------------------------------------------------- public_point / bucket_distance
select ok(
  public.public_point('7b0f8f9e-6c2d-4c1a-9a51-3b6c1c3e2f10', 'SRID=4326;POINT(2.3767 48.8722)')
  = public.public_point('7b0f8f9e-6c2d-4c1a-9a51-3b6c1c3e2f10', 'SRID=4326;POINT(2.3767 48.8722)'),
  'public_point is deterministic');
select cmp_ok(
  extensions.st_distance(public.public_point(gen_random_uuid(), 'SRID=4326;POINT(2.3767 48.8722)'), 'SRID=4326;POINT(2.3767 48.8722)'::extensions.geography),
  '<', 60::double precision, 'public_point stays within ~50 m');
select ok(
  (select count(distinct extensions.st_astext(public.public_point(gen_random_uuid(), 'SRID=4326;POINT(2.3767 48.8722)')::extensions.geometry))
   from generate_series(1, 20)) > 10,
  'public_point offsets differ per video');
select is(public.bucket_distance(12), 100, 'bucket_distance floors at 100 m');
select is(public.bucket_distance(1049), 1000, 'bucket_distance rounds to 100 m');

-- ---------------------------------------------------------------- nearby_videos
-- Belleville origin; videos at ~200 m, ~2 km, one hidden, one expired, one alert.
create temp table nv as
select tests.make_video((select carla from u), 48.8740, 2.3767) as near_v,
       tests.make_video((select carla from u), 48.8902, 2.3767) as far_v,
       tests.make_video((select carla from u), 48.8725, 2.3770, p_status => 'hidden') as hidden_v,
       tests.make_video((select carla from u), 48.8725, 2.3770, p_category => 'alert') as alert_v,
       tests.make_video((select carla from u), 48.8725, 2.3771) as expired_v;
update public.videos set expires_at = created_at + interval '1 second', status = 'active' where id = (select expired_v from nv);
update public.videos set created_at = now() - interval '1 hour', expires_at = now() - interval '1 minute' where id = (select expired_v from nv);
grant select on u, nv to anon, authenticated;

select tests.authenticate_anon();
select set_eq(
  $$select id from public.nearby_videos(48.8722, 2.3767, 300)$$,
  $$select unnest(array[(select near_v from nv), (select alert_v from nv)])$$,
  'nearby_videos: 300 m radius, active and unexpired only');
select ok(
  (select bool_or(id = (select far_v from nv)) from public.nearby_videos(48.8722, 2.3767, 3000)),
  'nearby_videos: far video inside 3 km');
select ok(
  not exists (select 1 from public.nearby_videos(48.8722, 2.3767, 1000) where id = (select far_v from nv)),
  'nearby_videos: far video outside 1 km');
select set_eq(
  $$select id from public.nearby_videos(48.8722, 2.3767, 3000, 'alert')$$,
  $$select (select alert_v from nv)$$,
  'nearby_videos: category filter');
select ok(
  (select bool_and(distance_m % 100 = 0) from public.nearby_videos(48.8722, 2.3767, 3000)),
  'nearby_videos: distances bucketed to 100 m');
select throws_ok($$select * from public.nearby_videos(48.8722, 2.3767, 2000)$$, 'radius_invalid');
select tests.clear_authentication();

select cmp_ok(
  (select extensions.st_distance(
     extensions.st_setsrid(extensions.st_makepoint(n.public_lng, n.public_lat), 4326)::extensions.geography, v.location)
   from public.nearby_videos(48.8722, 2.3767, 300) n join public.videos v on v.id = n.id
   where n.id = (select near_v from nv)),
  '>', 0::double precision, 'nearby_videos: returned point is not the exact position');

-- Cursor pagination over 25 videos: no duplicate, no gap.
create temp table extra as select tests.make_video((select dan from u), 48.8722 + i * 0.00005, 2.3767) as v from generate_series(1, 25) i;
create temp table pages (page integer, id uuid, score double precision);
insert into pages select 1, id, score from public.nearby_videos(48.8722, 2.3767, 1000, null, null, null, now(), 10);
insert into pages select 2, n.id, n.score from public.nearby_videos(48.8722, 2.3767, 1000, null,
  (select score from pages where page = 1 order by score, id limit 1),
  (select id from pages where page = 1 order by score, id limit 1), now(), 10) n;
insert into pages select 3, n.id, n.score from public.nearby_videos(48.8722, 2.3767, 1000, null,
  (select score from pages where page = 2 order by score, id limit 1),
  (select id from pages where page = 2 order by score, id limit 1), now(), 10) n;
select is((select count(*)::integer from pages), (select count(*)::integer from public.nearby_videos(48.8722, 2.3767, 1000, null, null, null, now(), 20)) + 7, 'cursor pages cover all 27 results');
select is((select count(distinct id)::integer from pages), (select count(*)::integer from pages), 'cursor pagination has no duplicates');

-- ---------------------------------------------------------------- map_videos / get_public_video
select tests.authenticate_anon();
select ok((select count(*) from public.map_videos(48.8722, 2.3767, 3000)) >= 28, 'map_videos returns active videos in radius');
select is((select count(*)::integer from public.get_public_video((select near_v from nv))), 1, 'get_public_video: active video');
select is((select count(*)::integer from public.get_public_video((select hidden_v from nv))), 0, 'get_public_video: hidden video is not public');
select tests.clear_authentication();

-- ---------------------------------------------------------------- create_video
create function pg_temp.publish(p_user uuid, p_lat double precision, p_lng double precision, p_cat public.video_category default 'help')
returns uuid language sql as $$
  select public.create_video(p_user, p_cat, 'Coucou', p_lat, p_lng, 12, '881fb46625fffff', '871fb4662ffffff',
    'video/webm', 9000, now() + interval '1 day')
$$;

select isnt(pg_temp.publish((select eve from u), 48.8722, 2.3767), null, 'create_video: valid publication');
select ok(
  (select status = 'processing' and location <> public_location from public.videos
   where author_id = (select eve from u) order by created_at desc limit 1),
  'create_video: starts processing with a fuzzed public location');
select throws_ok($$select pg_temp.publish((select eve from u), 45.7640, 4.8357)$$, 'position_incoherent', 'create_video: rejects impossible jump');
select throws_ok($$select pg_temp.publish((select fresh from u), 48.8722, 2.3767)$$, 'profile_incomplete', 'create_video: username required');
select throws_ok(
  $$select public.create_video((select dan from u), 'help', 'x', 48.8722, 2.3767, 150, '881fb46625fffff', '871fb4662ffffff', 'video/webm', 9000, now() + interval '1 day')$$,
  'accuracy_too_low', 'create_video: accuracy > 100 m rejected');
select throws_ok($$select pg_temp.publish((select shop from u), 48.8722, 2.3767, 'shop')$$, 'not_merchant', 'create_video: shop category requires approved merchant');

insert into public.merchant_profiles (user_id, business_name, status, daily_quota) values ((select shop from u), 'Épicerie', 'approved', 2);
select lives_ok($$select pg_temp.publish((select shop from u), 48.8722, 2.3767, 'shop')$$, 'merchant offer 1');
select lives_ok($$select pg_temp.publish((select shop from u), 48.8722, 2.3767, 'shop')$$, 'merchant offer 2');
select throws_ok($$select pg_temp.publish((select shop from u), 48.8722, 2.3767, 'shop')$$, 'merchant_quota_exceeded', 'create_video: merchant daily quota');
select ok((select bool_and(is_merchant) from public.videos where author_id = (select shop from u)), 'merchant offers are flagged');

-- Publication rate limit: 5 per hour (carla already published once).
select lives_ok($$select pg_temp.publish((select eve from u), 48.8722, 2.3767) from generate_series(1, 4)$$, 'publications 2..5 allowed');
select throws_ok($$select pg_temp.publish((select eve from u), 48.8722, 2.3767)$$, 'rate_limited', 'create_video: 6th publication in the hour is rate limited');

update public.profiles set banned_at = now() where id = (select dan from u);
select throws_ok($$select pg_temp.publish((select dan from u), 48.8722, 2.3767)$$, 'banned', 'create_video: banned users cannot publish');
update public.profiles set banned_at = null where id = (select dan from u);

-- ---------------------------------------------------------------- media job protocol
create temp table j as select (select id from public.videos where author_id = (select eve from u) and status = 'processing' order by created_at limit 1) as v;
select throws_ok($$select public.enqueue_processing((select dan from u), (select v from j), 'x/y.webm')$$, 'video_not_awaiting_upload', 'enqueue_processing: only the author');
select isnt(public.enqueue_processing((select eve from u), (select v from j), (select eve from u) || '/' || (select v from j) || '.webm'), null, 'enqueue_processing: queues a job');
select throws_ok($$select public.enqueue_processing((select eve from u), (select v from j), 'again.webm')$$, 'video_not_awaiting_upload', 'enqueue_processing: only once');

update public.media_jobs set run_after = now() - interval '1 second';
create temp table claimed as select * from public.claim_media_job('test-worker');
select is((select count(*)::integer from claimed), 1, 'claim_media_job: claims one job');
select is((select status::text from public.media_jobs where id = (select id from claimed)), 'running', 'claim_media_job: job is running');
select is((select count(*)::integer from public.claim_media_job('other-worker')), 0, 'claim_media_job: a running job is not claimed twice');

select is(public.fail_media_job((select id from claimed), 'ffmpeg exploded')::text, 'queued', 'fail_media_job: retried with backoff');
select ok((select run_after > now() from public.media_jobs where id = (select id from claimed)), 'fail_media_job: run_after in the future');
update public.media_jobs set attempts = 3 where id = (select id from claimed);
select is(public.fail_media_job((select id from claimed), 'still broken')::text, 'failed', 'fail_media_job: gives up after max attempts');
select is((select status::text from public.videos where id = (select v from j)), 'rejected', 'fail_media_job: video rejected');
select is((select count(*)::integer from public.notification_outbox where kind = 'video_rejected' and video_id = (select v from j)), 1, 'fail_media_job: author notified');
select is((select count(*)::integer from public.media_jobs where kind = 'purge' and video_id = (select v from j)), 1, 'fail_media_job: raw file purge queued');

-- Successful processing.
create temp table j2 as select (select id from public.videos where author_id = (select eve from u) and status = 'processing' order by created_at limit 1) as v;
select public.enqueue_processing((select eve from u), (select v from j2), 'raw.webm');
update public.media_jobs set run_after = now() - interval '1 second' where video_id = (select v from j2);
create temp table claimed2 as select * from public.claim_media_job('test-worker');
select public.complete_process_job((select id from claimed2), 'v.mp4', 'v.jpg');
select is(
  (select status::text || '|' || coalesce(raw_path, 'null') || '|' || video_path from public.videos where id = (select v from j2)),
  'active|null|v.mp4', 'complete_process_job: video active, raw path cleared');

-- Alert activation feeds the push outbox.
create temp table j3 as select tests.make_video((select eve from u), p_category => 'alert', p_status => 'processing') as v;
update public.videos set status = 'active' where id = (select v from j3);
select is((select count(*)::integer from public.notification_outbox where kind = 'alert_nearby' and video_id = (select v from j3)), 1, 'on_video_activated: alert queued for push');

-- ---------------------------------------------------------------- expire_videos
create temp table e as select tests.make_video((select dan from u)) as v;
update public.videos set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = (select v from e);
create temp table rep_before as select reputation from public.profiles where id = (select dan from u);
select ok(public.expire_videos() >= 1, 'expire_videos: returns expired count');
select is((select status::text from public.videos where id = (select v from e)), 'expired', 'expire_videos: status expired');
select is((select video_path from public.videos where id = (select v from e)), null, 'expire_videos: paths cleared');
select is((select count(*)::integer from public.media_jobs where kind = 'purge' and video_id = (select v from e)), 1, 'expire_videos: purge job queued');
select is((select reputation from public.profiles where id = (select dan from u)), (select reputation + 1 from rep_before), 'expire_videos: clean video earns reputation');

-- ---------------------------------------------------------------- withdraw / export / delete
create temp table w as select tests.make_video((select dan from u)) as v;
select throws_ok($$select public.withdraw_video((select eve from u), (select v from w))$$, 'not_found', 'withdraw_video: only the author');
select is(cardinality(public.withdraw_video((select dan from u), (select v from w))), 2, 'withdraw_video: returns the files to delete');
select is((select count(*)::integer from public.videos where id = (select v from w)), 0, 'withdraw_video: row deleted');

select ok(jsonb_array_length(public.export_my_data((select eve from u)) -> 'videos') >= 5, 'export_my_data: includes own videos');
select ok((public.export_my_data((select eve from u)) -> 'videos' -> 0) ? 'lat', 'export_my_data: includes own exact positions');
select ok(cardinality(public.prepare_account_deletion((select eve from u))) > 0, 'prepare_account_deletion: lists files');
delete from auth.users where id = (select eve from u);
select is((select count(*)::integer from public.videos where author_id = (select eve from u)), 0, 'account deletion cascades to videos');

-- ---------------------------------------------------------------- notifications
create temp table pu as select tests.create_user('voisin1') as a, tests.create_user('voisin2') as b, tests.create_user('loin') as c;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, zone_cell, zone_center, radius_m) values
  ((select a from pu), 'https://push.example/a1', 'k', 'x', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 1000),
  ((select a from pu), 'https://push.example/a2', 'k', 'x', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 300),
  ((select b from pu), 'https://push.example/b', 'k', 'x', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 1000),
  ((select c from pu), 'https://push.example/c', 'k', 'x', '881fb46625fffff', 'SRID=4326;POINT(2.2000 48.8000)', 300);
update public.push_subscriptions set last_notified_at = now() - interval '5 minutes' where user_id = (select b from pu);
create temp table al as select tests.make_video((select dan from u), p_category => 'alert') as v1, tests.make_video((select dan from u), p_category => 'alert') as v2;

create temp table rcpt as select * from public.claim_alert_recipients(array[(select v1 from al), (select v2 from al)]);
select is((select count(*)::integer from rcpt where user_id = (select a from pu)), 2, 'claim_alert_recipients: one notification per device');
select is((select max(cardinality(video_ids)) from rcpt), 2, 'claim_alert_recipients: alerts grouped in one notification');
select is((select count(*)::integer from rcpt where user_id = (select b from pu)), 0, 'claim_alert_recipients: per-user frequency limit');
select is((select count(*)::integer from rcpt where user_id = (select c from pu)), 0, 'claim_alert_recipients: out of zone');
select is((select count(*)::integer from public.claim_alert_recipients(array[(select v1 from al)])), 0, 'claim_alert_recipients: stamped users are not notified again');
select is((select count(*)::integer from public.user_push_targets((select a from pu))), 2, 'user_push_targets lists devices');

select ok((select count(*) from public.claim_outbox(1000)) >= 1, 'claim_outbox: returns pending rows');
select is((select count(*)::integer from public.claim_outbox(1000)), 0, 'claim_outbox: rows are claimed once');

select * from finish();
rollback;

-- Row Level Security, policy by policy, with anon / user / other user / banned user.
begin;
select no_plan();

-- Isolate from demo data (rolled back at the end of the file).
delete from public.videos;
delete from public.merchant_profiles;
delete from public.zone_moderators;

create temp table ids as
select tests.create_user('alice') as alice, tests.create_user('bob') as bob, tests.create_user('mallory') as mallory;
grant select on ids to anon, authenticated;
update public.profiles set banned_at = now() where id = (select mallory from ids);

create temp table vids as
select tests.make_video((select alice from ids)) as active_v,
       tests.make_video((select alice from ids), p_status => 'processing') as processing_v,
       tests.make_video((select alice from ids), p_status => 'hidden') as hidden_v,
       tests.make_video((select bob from ids)) as bob_v;
grant select on vids to anon, authenticated;

-- ---------------------------------------------------------------- app_config
select tests.authenticate_anon();
select ok((select count(*) from public.app_config) > 0, 'app_config_read: anon reads config');
select throws_ok($$update public.app_config set value = '1'$$, '42501', null, 'app_config: no write for anon');
select tests.clear_authentication();

-- ---------------------------------------------------------------- profiles
select tests.authenticate_anon();
select is((select username from public.profiles where id = (select alice from ids)), 'alice', 'profiles_read: anon reads public profile');
select throws_ok($$select banned_at from public.profiles$$, '42501', null, 'profiles: banned_at not readable');
select tests.authenticate_as((select alice from ids));
update public.profiles set bio = 'Voisine du 20e' where id = (select alice from ids);
update public.profiles set bio = 'hacked' where id = (select bob from ids);
select throws_ok($$update public.profiles set reputation = 9999 where id = auth.uid()$$, '42501', null, 'profiles: reputation not writable by owner');
select throws_ok($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', null, 'profiles: role not writable by owner');
select tests.clear_authentication();
select is((select bio from public.profiles where id = (select alice from ids)), 'Voisine du 20e', 'profiles_update_own: owner edits bio');
select is((select bio from public.profiles where id = (select bob from ids)), '', 'profiles_update_own: cannot edit someone else');
select tests.authenticate_as((select mallory from ids));
select throws_ok($$update public.profiles set bio = 'x' where id = auth.uid()$$, '42501', null, 'profiles_update_own: banned user cannot edit');
select tests.clear_authentication();

-- ---------------------------------------------------------------- user_settings
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.user_settings), 1, 'user_settings_read_own: only own row visible');
update public.user_settings set default_radius = 3000;
select is((select default_radius from public.user_settings), 3000, 'user_settings_update_own: owner updates radius');
select throws_ok($$update public.user_settings set default_radius = 42$$, '23514', null, 'user_settings: radius constrained');
select tests.authenticate_anon();
select throws_ok($$select * from public.user_settings$$, '42501', null, 'user_settings: anon has no access');
select tests.clear_authentication();

-- ---------------------------------------------------------------- merchant_profiles
select tests.authenticate_as((select bob from ids));
insert into public.merchant_profiles (user_id, business_name) values ((select bob from ids), 'Boulangerie Bob');
select throws_ok($$insert into public.merchant_profiles (user_id, business_name) values ((select alice from ids), 'Fake')$$, '42501', null, 'merchant_apply_own: cannot apply for someone else');
select throws_ok($$update public.merchant_profiles set status = 'approved'$$, '42501', null, 'merchant: status not self-approvable');
update public.merchant_profiles set description = 'Pain bio' where user_id = (select bob from ids);
select is((select description from public.merchant_profiles), 'Pain bio', 'merchant_update_own: owner edits description');
select tests.authenticate_anon();
select is((select count(*)::integer from public.merchant_profiles), 0, 'merchant_read: pending merchants are not public');
select tests.clear_authentication();
update public.merchant_profiles set status = 'approved';
select tests.authenticate_anon();
select is((select count(*)::integer from public.merchant_profiles), 1, 'merchant_read: approved merchants are public');
select tests.clear_authentication();

-- ---------------------------------------------------------------- videos
select tests.authenticate_anon();
select is((select count(*)::integer from public.videos where author_id = (select alice from ids)), 1, 'videos_read_active: anon only sees active videos');
select throws_ok($$select location from public.videos$$, '42501', null, 'videos: anon cannot select location');
select throws_ok($$insert into public.videos (author_id) values (gen_random_uuid())$$, '42501', null, 'videos: anon cannot insert');
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.videos where author_id = auth.uid()), 3, 'videos_read_active: owner sees own processing/hidden videos');
select is((select count(*)::integer from public.videos where id = (select hidden_v from vids)), 1, 'videos: owner sees own hidden video');
select throws_ok($$update public.videos set status = 'active'$$, '42501', null, 'videos: owner cannot change status');
select throws_ok($$delete from public.videos$$, '42501', null, 'videos: no direct delete');
select tests.authenticate_as((select bob from ids));
select is((select count(*)::integer from public.videos where id = (select hidden_v from vids)), 0, 'videos: others do not see hidden videos');
select tests.clear_authentication();

-- ---------------------------------------------------------------- reactions
select tests.authenticate_as((select bob from ids));
insert into public.reactions (video_id, user_id) values ((select active_v from vids), (select bob from ids));
select throws_ok($$insert into public.reactions (video_id, user_id) values ((select active_v from vids), (select alice from ids))$$, '42501', null, 'reactions_insert_own: cannot react as someone else');
select throws_ok($$insert into public.reactions (video_id, user_id) values ((select hidden_v from vids), auth.uid())$$, '42501', null, 'reactions_insert_own: not on hidden videos');
select is((select count(*)::integer from public.reactions), 1, 'reactions_read_own: sees own reaction');
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.reactions), 0, 'reactions_read_own: others reactions invisible');
delete from public.reactions;
select tests.clear_authentication();
select is((select count(*)::integer from public.reactions), 1, 'reactions_delete_own: cannot delete others reaction');
select is((select useful_count from public.videos where id = (select active_v from vids)), 1, 'reactions trigger counts useful');
select tests.authenticate_as((select bob from ids));
delete from public.reactions;
select tests.clear_authentication();
select is((select useful_count from public.videos where id = (select active_v from vids)), 0, 'reactions_delete_own + trigger decrement');
select tests.authenticate_as((select mallory from ids));
select throws_ok($$insert into public.reactions (video_id, user_id) values ((select active_v from vids), auth.uid())$$, '42501', null, 'reactions: banned user cannot react');
select tests.clear_authentication();

-- ---------------------------------------------------------------- comments
select tests.authenticate_as((select bob from ids));
insert into public.comments (video_id, author_id, body) values ((select active_v from vids), (select bob from ids), 'Merci !');
select throws_ok($$insert into public.comments (video_id, author_id, body) values ((select active_v from vids), (select alice from ids), 'usurpation')$$, '42501', null, 'comments_insert_own: cannot comment as someone else');
select throws_ok($$insert into public.comments (video_id, author_id, body) values ((select bob_v from vids), auth.uid(), '')$$, '23514', null, 'comments: empty body rejected');
select tests.authenticate_anon();
select is((select count(*)::integer from public.comments), 1, 'comments_read: anon reads comments of active videos');
select tests.authenticate_as((select alice from ids));
delete from public.comments;
select tests.clear_authentication();
select is((select count(*)::integer from public.comments), 1, 'comments_delete_own: author of the video cannot delete others comments');
select tests.authenticate_as((select bob from ids));
delete from public.comments;
select tests.clear_authentication();
select is((select count(*)::integer from public.comments), 0, 'comments_delete_own: author deletes own comment');
select is((select comment_count from public.videos where id = (select active_v from vids)), 0, 'comments trigger keeps count');
select tests.authenticate_as((select bob from ids));
select throws_ok($$insert into public.comments (video_id, author_id, body) values ((select hidden_v from vids), auth.uid(), 'x')$$, null, null, 'comments: not on hidden videos');
select tests.clear_authentication();

-- ---------------------------------------------------------------- reports
select tests.authenticate_as((select bob from ids));
insert into public.reports (video_id, reporter_id, reason) values ((select active_v from vids), (select bob from ids), 'spam');
select throws_ok($$insert into public.reports (video_id, reporter_id, reason) values ((select active_v from vids), auth.uid(), 'spam')$$, '23505', null, 'reports: one report per user and video');
select throws_ok($$insert into public.reports (video_id, reporter_id, reason) values ((select bob_v from vids), auth.uid(), 'spam')$$, '42501', null, 'reports_insert_own: cannot report own video');
select throws_ok($$insert into public.reports (video_id, reporter_id, reason) values ((select active_v from vids), (select alice from ids), 'spam')$$, '42501', null, 'reports_insert_own: cannot report as someone else');
select is((select count(*)::integer from public.reports), 1, 'reports_read_own: reporter sees own report');
select throws_ok($$select details from public.reports$$, '42501', null, 'reports: details not readable back');
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.reports), 0, 'reports_read_own: author does not see who reported');
select tests.clear_authentication();

-- ---------------------------------------------------------------- zone_moderators
insert into public.zone_moderators (user_id, h3_cell) values ((select alice from ids), '881fb46625fffff');
select tests.authenticate_anon();
select is((select count(*)::integer from public.zone_moderators), 1, 'zone_moderators_read: public badge');
select tests.authenticate_as((select bob from ids));
select throws_ok($$insert into public.zone_moderators (user_id, h3_cell) values (auth.uid(), '881fb46625fffff')$$, '42501', null, 'zone_moderators: no self-promotion');
select tests.clear_authentication();

-- ---------------------------------------------------------------- moderation_actions + appeals
insert into public.moderation_actions (video_id, target_user_id, h3_cell, actor_id, kind, note)
values ((select hidden_v from vids), (select alice from ids), '881fb46625fffff', (select bob from ids), 'hide', 'test');
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.moderation_actions), 1, 'moderation_actions_read_target: target sees decision');
insert into public.appeals (action_id, author_id, reason)
values ((select max(id) from public.moderation_actions), auth.uid(), 'Aucun visage n''est reconnaissable.');
select is((select count(*)::integer from public.appeals), 1, 'appeals_insert_own + appeals_read_own');
select tests.authenticate_as((select bob from ids));
select is((select count(*)::integer from public.moderation_actions), 0, 'moderation_actions: others do not see the decision');
select is((select count(*)::integer from public.appeals), 0, 'appeals_read_own: others do not see the appeal');
select throws_ok($$insert into public.appeals (action_id, author_id, reason) values ((select max(id) from public.moderation_actions), auth.uid(), 'Je conteste pour elle')$$, '42501', null, 'appeals_insert_own: only the target can appeal');
select throws_ok($$insert into public.moderation_actions (kind) values ('hide')$$, '42501', null, 'moderation_actions: no direct insert');
select tests.clear_authentication();

-- ---------------------------------------------------------------- push_subscriptions
select tests.authenticate_as((select alice from ids));
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, zone_cell, zone_center, radius_m)
values (auth.uid(), 'https://push.example/alice', 'k', 'a', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 1000);
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, zone_cell, zone_center, radius_m) values ((select bob from ids), 'https://push.example/bob', 'k', 'a', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 1000)$$, '42501', null, 'push_insert_own: cannot subscribe someone else');
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, zone_cell, zone_center, radius_m) values (auth.uid(), 'http://insecure', 'k', 'a', '881fb46625fffff', 'SRID=4326;POINT(2.3767 48.8722)', 1000)$$, '23514', null, 'push: https endpoint required');
update public.push_subscriptions set radius_m = 3000;
select is((select radius_m from public.push_subscriptions), 3000, 'push_update_own: owner changes radius');
select tests.authenticate_as((select bob from ids));
select is((select count(*)::integer from public.push_subscriptions), 0, 'push_read_own: others subscriptions invisible');
delete from public.push_subscriptions;
select tests.authenticate_as((select alice from ids));
select is((select count(*)::integer from public.push_subscriptions), 1, 'push_delete_own: others cannot delete');
delete from public.push_subscriptions;
select is((select count(*)::integer from public.push_subscriptions), 0, 'push_delete_own: owner unsubscribes');
select tests.clear_authentication();

-- ---------------------------------------------------------------- service-only tables
select tests.authenticate_as((select alice from ids));
select throws_ok($$select * from public.media_jobs$$, '42501', null, 'media_jobs: no access');
select throws_ok($$select * from public.notification_outbox$$, '42501', null, 'notification_outbox: no access');
select throws_ok($$select * from public.rate_limits$$, '42501', null, 'rate_limits: no access');
select tests.clear_authentication();

-- ---------------------------------------------------------------- storage (raw uploads)
select tests.authenticate_as((select alice from ids));
select ok(public.can_upload_raw((select alice from ids) || '/' || (select processing_v from vids) || '.webm'), 'raw_videos_upload_own: own processing video accepted');
select ok(not public.can_upload_raw((select alice from ids) || '/' || (select active_v from vids) || '.webm'), 'raw_videos_upload_own: not for an already processed video');
select ok(not public.can_upload_raw((select bob from ids) || '/' || (select processing_v from vids) || '.webm'), 'raw_videos_upload_own: not into another folder');
select tests.authenticate_as((select bob from ids));
select ok(not public.can_upload_raw((select alice from ids) || '/' || (select processing_v from vids) || '.webm'), 'raw_videos_upload_own: not for someone else video');
select tests.clear_authentication();

select * from finish();
rollback;

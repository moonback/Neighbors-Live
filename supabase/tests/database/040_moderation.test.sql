-- Moderation: report threshold, zone moderators, decisions, journal, appeals, admin, eligibility.
begin;
select no_plan();

create temp table m as
select tests.create_user('author') as author,
       tests.create_user('rep1') as r1, tests.create_user('rep2') as r2, tests.create_user('rep3') as r3,
       tests.create_user('mod_a', 60, 50) as mod_a, tests.create_user('mod_b', 60, 50) as mod_b,
       tests.create_user('outsider') as outsider, tests.create_user('boss') as boss;
grant select on m to anon, authenticated;
update public.profiles set role = 'admin' where id = (select boss from m);
insert into public.zone_moderators (user_id, h3_cell) values
  ((select mod_a from m), '881fb46625fffff'), ((select mod_b from m), '881fb46625fffff');

create temp table v as select tests.make_video((select author from m)) as target, tests.make_video((select author from m)) as other;
grant select on v to anon, authenticated;

-- ---------------------------------------------------------------- 3 distinct reports => auto-hide
create function pg_temp.report_as(p_user uuid, p_video uuid) returns void language plpgsql as $$
begin
  perform tests.authenticate_as(p_user);
  insert into public.reports (video_id, reporter_id, reason) values (p_video, p_user, 'recognizable_person');
  perform tests.clear_authentication();
end
$$;
grant execute on function pg_temp.report_as(uuid, uuid) to authenticated;

select pg_temp.report_as((select r1 from m), (select target from v));
select pg_temp.report_as((select r2 from m), (select target from v));
select is((select status::text from public.videos where id = (select target from v)), 'active', 'apply_report_threshold: 2 reports keep the video visible');
select pg_temp.report_as((select r3 from m), (select target from v));
select is((select status::text from public.videos where id = (select target from v)), 'hidden', 'apply_report_threshold: 3rd distinct report hides the video');
select is((select report_count from public.videos where id = (select target from v)), 3, 'report_count maintained');
select is((select kind::text from public.moderation_actions where video_id = (select target from v)), 'auto_hide', 'auto-hide is journaled (system actor)');
select ok(not public.apply_report_threshold((select other from v)), 'apply_report_threshold: no reports, no hide');

-- ---------------------------------------------------------------- queue
select is((select count(*)::integer from public.moderation_queue((select mod_a from m), '881fb46625fffff')), 1, 'moderation_queue: hidden video in the zone queue');
select is((select reasons from public.moderation_queue((select mod_a from m), '881fb46625fffff')), array['recognizable_person']::public.report_reason[], 'moderation_queue: report reasons');
select throws_ok($$select * from public.moderation_queue((select outsider from m), '881fb46625fffff')$$, 'forbidden', 'moderation_queue: outsiders refused');
select throws_ok($$select * from public.moderation_queue((select mod_a from m), '881fb4662dfffff')$$, 'forbidden', 'moderation_queue: other zones refused');

-- ---------------------------------------------------------------- decisions
select throws_ok($$select public.moderate_video((select outsider from m), (select target from v), 'validate')$$, 'forbidden', 'moderate_video: non-moderator refused');
select throws_ok($$select public.moderate_video((select mod_a from m), (select target from v), 'remove', '')$$, 'note_required', 'moderate_video: removal requires a note');
select throws_ok($$select public.moderate_video((select mod_a from m), (select target from v), 'auto_hide')$$, 'invalid_action', 'moderate_video: system actions not allowed');

create temp table rep as select id, reputation from public.profiles where id in ((select author from m), (select r1 from m));
select isnt(public.moderate_video((select mod_a from m), (select target from v), 'remove', 'Visage reconnaissable'), null, 'moderate_video: zone moderator removes');
select is((select status::text from public.videos where id = (select target from v)), 'removed', 'remove: video removed');
select is((select reputation from public.profiles where id = (select author from m)), (select reputation - 10 from rep where id = (select author from m)), 'remove: author loses reputation');
select is((select reputation from public.profiles where id = (select r1 from m)), (select reputation + 1 from rep where id = (select r1 from m)), 'remove: reporters gain reputation');
select is((select count(*)::integer from public.reports where video_id = (select target from v) and resolved_at is null), 0, 'remove: reports resolved');
select ok((select run_after > now() + interval '6 days' from public.media_jobs where kind = 'purge' and video_id = (select target from v)), 'remove: files purged after the appeal window');
select is((select count(*)::integer from public.notification_outbox where kind = 'video_removed' and video_id = (select target from v)), 1, 'remove: author notified');

select isnt(public.moderate_video((select mod_a from m), (select other from v), 'warn', 'Merci de flouter'), null, 'moderate_video: warn');
select is((select count(*)::integer from public.notification_outbox where kind = 'moderation_warning'), 1, 'warn: author notified');

create temp table v2 as select tests.make_video((select author from m), p_status => 'hidden') as hid;
select public.moderate_video((select mod_b from m), (select hid from v2), 'validate');
select is((select status::text from public.videos where id = (select hid from v2)), 'active', 'validate: hidden video restored');

create temp table v3 as select tests.make_video((select mod_a from m)) as own;
select throws_ok($$select public.moderate_video((select mod_a from m), (select own from v3), 'validate')$$, 'conflict_of_interest', 'moderate_video: cannot moderate own video');

-- ---------------------------------------------------------------- journal is immutable
select throws_ok($$update public.moderation_actions set note = 'rewritten'$$, 'moderation_actions is append-only', 'journal: no update');
select throws_ok($$delete from public.moderation_actions$$, 'moderation_actions is append-only', 'journal: no delete');
select throws_ok($$truncate public.moderation_actions cascade$$, 'moderation_actions is append-only', 'journal: no truncate');

-- ---------------------------------------------------------------- appeals
create temp table rm as select id from public.moderation_actions where kind = 'remove' and video_id = (select target from v);
grant select on rm to authenticated;
select tests.authenticate_as((select author from m));
insert into public.appeals (action_id, author_id, reason) values ((select id from rm), auth.uid(), 'La personne a donné son accord.');
select tests.clear_authentication();
create temp table ap as select id from public.appeals;

select is((select count(*)::integer from public.appeals_queue((select mod_a from m))), 0, 'appeals_queue: the deciding moderator does not see the appeal');
select is((select count(*)::integer from public.appeals_queue((select mod_b from m))), 1, 'appeals_queue: another zone moderator sees it');
select throws_ok($$select public.resolve_appeal((select mod_a from m), (select id from ap), true)$$, 'conflict_of_interest', 'resolve_appeal: not by the original moderator');
select throws_ok($$select public.resolve_appeal((select outsider from m), (select id from ap), true)$$, 'forbidden', 'resolve_appeal: not by outsiders');

create temp table rep2 as select reputation from public.profiles where id = (select author from m);
select lives_ok($$select public.resolve_appeal((select mod_b from m), (select id from ap), true, 'Accord vérifié')$$, 'resolve_appeal: other moderator upholds');
select is((select status::text from public.videos where id = (select target from v)), 'active', 'appeal upheld: video restored');
select is((select reputation from public.profiles where id = (select author from m)), (select reputation + 10 from rep2), 'appeal upheld: reputation restored');
select is((select count(*)::integer from public.media_jobs where kind = 'purge' and status = 'queued' and video_id = (select target from v)), 0, 'appeal upheld: delayed purge cancelled');
select is((select kind::text from public.moderation_actions order by id desc limit 1), 'appeal_upheld', 'appeal outcome journaled');
select throws_ok($$select public.resolve_appeal((select mod_b from m), (select id from ap), false)$$, 'not_found', 'resolve_appeal: decided once');

-- ---------------------------------------------------------------- admin
select throws_ok($$select public.admin_set_ban((select mod_a from m), (select author from m), true, 'spam')$$, 'forbidden', 'admin_set_ban: admins only');
select throws_ok($$select public.admin_set_ban((select boss from m), (select author from m), true, '')$$, 'note_required', 'admin_set_ban: note required');
select lives_ok($$select public.admin_set_ban((select boss from m), (select author from m), true, 'Récidive')$$, 'admin bans a user');
select ok(public.is_banned((select author from m)), 'ban recorded');
select is((select count(*)::integer from public.videos where author_id = (select author from m) and status = 'active'), 0, 'ban hides the user videos');

create temp table ban as select id from public.moderation_actions where kind = 'ban';
select lives_ok($$select public.admin_revert_action((select boss from m), (select id from ban), 'Erreur de compte')$$, 'admin reverts the ban');
select ok(not public.is_banned((select author from m)), 'revert lifts the ban');
select throws_ok($$select public.admin_revert_action((select mod_a from m), (select id from ban), 'nope')$$, 'forbidden', 'admin_revert_action: admins only');

select ok((public.admin_stats((select boss from m)) ->> 'users')::integer >= 8, 'admin_stats: global dashboard');
select throws_ok($$select public.admin_stats((select mod_a from m))$$, 'forbidden', 'admin_stats: admins only');

insert into public.merchant_profiles (user_id, business_name) values ((select outsider from m), 'Café du coin');
select public.admin_review_merchant((select boss from m), (select outsider from m), true);
select is((select role::text from public.profiles where id = (select outsider from m)), 'merchant', 'admin_review_merchant: approval grants the merchant badge');

-- ---------------------------------------------------------------- moderator eligibility
create temp table cand as select tests.create_user('candidate', 20, 15) as c, tests.create_user('newbie', 3, 50) as n;
select ok(not public.moderator_eligible((select c from cand)), 'eligibility: needs 5 clean publications');
insert into cand select tests.make_video((select c from cand)), null from generate_series(1, 5);
select ok(public.moderator_eligible((select c from cand limit 1)), 'eligibility: 14+ days, 5 clean videos, reputation >= threshold');
select ok(not public.moderator_eligible((select n from cand limit 1)), 'eligibility: account too young');
update public.app_config set value = '100' where key = 'moderator_min_reputation';
select ok(not public.moderator_eligible((select c from cand limit 1)), 'eligibility: reputation threshold is configurable');
update public.app_config set value = '10' where key = 'moderator_min_reputation';
select throws_ok($$select public.become_zone_moderator((select c from cand limit 1), '881fb4662dfffff')$$, 'not_local', 'become_zone_moderator: only where the user published');
select lives_ok($$select public.become_zone_moderator((select c from cand limit 1), '881fb46625fffff')$$, 'become_zone_moderator: eligible local user');
select ok(public.is_zone_moderator((select c from cand limit 1), '881fb46625fffff'), 'is_zone_moderator after promotion');
select throws_ok($$select public.become_zone_moderator((select n from cand limit 1), '881fb46625fffff')$$, 'not_eligible', 'become_zone_moderator: ineligible user refused');

select * from finish();
rollback;

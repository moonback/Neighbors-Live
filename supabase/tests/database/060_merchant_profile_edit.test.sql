-- Approved merchants edit their public contact details; name, status and quota stay admin-only.
begin;
select no_plan();

create temp table m as
select tests.create_user('edit_shop') as shop, tests.create_user('edit_other') as other;
grant select on m to authenticated;
insert into public.merchant_profiles (user_id, business_name, status)
values ((select shop from m), 'Épicerie Lune', 'approved');

select tests.authenticate_as((select shop from m));
update public.merchant_profiles
set phone = '01 23 45 67 89', website = 'https://lune.example', address = '1 rue de la Lune',
    opening_hours = '8 h – 20 h', description = 'Fruits et légumes'
where user_id = (select shop from m);
select tests.clear_authentication();
select is((select phone from public.merchant_profiles where user_id = (select shop from m)),
  '01 23 45 67 89', 'owner edits contact details');

select tests.authenticate_as((select shop from m));
select throws_ok($$update public.merchant_profiles set business_name = 'Autre nom'$$, '42501', null,
  'owner cannot rename an approved business without review');
select throws_ok($$update public.merchant_profiles set daily_quota = 99$$, '42501', null,
  'owner cannot raise the quota');
select throws_ok($$update public.merchant_profiles set status = 'pending'$$, '42501', null,
  'owner cannot change the status');
select tests.clear_authentication();

select tests.authenticate_as((select other from m));
update public.merchant_profiles set phone = '00' where user_id = (select shop from m);
select tests.clear_authentication();
select is((select phone from public.merchant_profiles where user_id = (select shop from m)),
  '01 23 45 67 89', 'other users cannot edit');

select * from finish();
rollback;

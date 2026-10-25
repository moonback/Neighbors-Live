-- Prevent two administrators from deciding the same merchant application twice.
-- The row lock makes the pending-state check and transition atomic under concurrent requests.
create index if not exists moderation_actions_actor_created_idx
  on public.moderation_actions (actor_id, created_at desc);
create index if not exists moderation_actions_kind_created_idx
  on public.moderation_actions (kind, created_at desc);

create or replace function public.admin_review_merchant(p_admin uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.merchant_status;
begin
  if not public.is_admin(p_admin) then raise exception 'forbidden'; end if;

  select status into v_status
  from public.merchant_profiles
  where user_id = p_user
  for update;

  if not found then raise exception 'not_found'; end if;
  if v_status <> 'pending' then raise exception 'review_conflict'; end if;

  update public.merchant_profiles
  set status = case when p_approve then 'approved'::public.merchant_status else 'rejected'::public.merchant_status end,
      reviewed_by = p_admin
  where user_id = p_user;

  update public.profiles
  set role = case when p_approve then 'merchant'::public.user_role else 'user'::public.user_role end
  where id = p_user and role <> 'admin';
end
$$;

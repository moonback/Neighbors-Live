alter table public.merchant_profiles
  add column if not exists website text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists address text not null default '';

-- allow merchants to expose their verified public contact details when approved
grant select (user_id, business_name, description, website, phone, address, status, created_at)
  on public.merchant_profiles to anon, authenticated;
grant insert (user_id, business_name, description, website, phone, address)
  on public.merchant_profiles to authenticated;
grant update (business_name, description, website, phone, address)
  on public.merchant_profiles to authenticated;

create or replace function public.merchant_public_contact(p_user_id uuid)
returns table (business_name text, description text, website text, phone text, address text)
language sql stable security definer set search_path = '' as $$
  select business_name, description, website, phone, address
  from public.merchant_profiles
  where user_id = p_user_id and status = 'approved';
$$;

grant execute on function public.merchant_public_contact(uuid) to anon, authenticated;

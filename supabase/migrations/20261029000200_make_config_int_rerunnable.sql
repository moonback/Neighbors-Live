create or replace function public.config_int(p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select (value #>> '{}')::integer from public.app_config where key = p_key
$$;

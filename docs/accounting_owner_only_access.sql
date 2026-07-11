-- ============================================================
-- Accounting Owner-Only Operations Access
-- ============================================================
-- Intent:
-- - Tattoo Manager Owner can access/manage Accounting.
-- - Tattoo Manager Admin cannot access Accounting by default.
-- - Dedicated accounting users can access/manage Accounting only when
--   their profile role is 'accounting' (or a legacy profile row is absent)
--   and accounting_users.active = true.
--
-- Run in Supabase SQL Editor after deploying the matching app code.

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
    or exists (
      select 1
      from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and coalesce(p.role, 'accounting') = 'accounting'
    ),
    false
  )
$$;

create or replace function public.is_accounting_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
    or exists (
      select 1
      from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('owner', 'admin')
        and coalesce(p.role, 'accounting') = 'accounting'
    ),
    false
  )
$$;

grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;
grant execute on function public.is_accounting_admin() to authenticated;
grant execute on function public.is_accounting_admin() to service_role;

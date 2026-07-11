-- ============================================================
-- Accounting Access Hardening
-- Run once in Supabase SQL Editor after the accounting_users
-- migration if the database was created before viewer was removed.
-- ============================================================

-- Remove the deprecated viewer access level from existing data and schema.
update public.accounting_users
set access_level = 'admin'
where access_level = 'viewer';

alter table public.accounting_users
  alter column access_level set default 'admin';

alter table public.accounting_users
  drop constraint if exists accounting_users_access_level_check;

alter table public.accounting_users
  add constraint accounting_users_access_level_check
  check (access_level in ('owner', 'admin'));

-- Keep the RLS helper aligned with the app:
-- - Operations owner can access and manage Accounting.
-- - Operations admin does not get Accounting automatically.
-- - Dedicated accounting users must have profiles.role = 'accounting'
--   (or no legacy profile row) plus an active accounting_users row.
create or replace function public.is_accounting_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
    or exists (
      select 1 from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('admin', 'owner')
        and coalesce(p.role, 'accounting') = 'accounting'
    ),
    false
  )
$$;

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1 from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and coalesce(p.role, 'accounting') = 'accounting'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    ),
    false
  );
$$;

grant execute on function public.is_accounting_admin() to authenticated;
grant execute on function public.is_accounting_admin() to service_role;
grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;

-- Accounting users RLS recursion repair
-- Fixes:
--   infinite recursion detected in policy for relation "accounting_users"

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
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('owner', 'admin')
    ),
    false
  )
$$;

grant execute on function public.is_accounting_admin() to authenticated;
grant execute on function public.is_accounting_admin() to service_role;

drop policy if exists "acct_users_select_admin" on public.accounting_users;
create policy "acct_users_select_admin"
  on public.accounting_users for select
  using (public.is_accounting_admin());

-- Accounting users permission repair
-- Run this if /accounting/users shows:
--   permission denied for table accounting_users

alter table public.accounting_users enable row level security;

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select on public.accounting_users to authenticated;
grant select, insert, update, delete on public.accounting_users to service_role;
grant select, insert, update, delete on public.profiles to service_role;

grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;

drop policy if exists "acct_users_select_own" on public.accounting_users;
create policy "acct_users_select_own"
  on public.accounting_users for select
  using (profile_id = auth.uid());

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
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('admin', 'owner')
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

drop policy if exists "acct_users_no_insert" on public.accounting_users;
create policy "acct_users_no_insert"
  on public.accounting_users for insert
  with check (false);

drop policy if exists "acct_users_no_update" on public.accounting_users;
create policy "acct_users_no_update"
  on public.accounting_users for update
  using (false);

drop policy if exists "acct_users_no_delete" on public.accounting_users;
create policy "acct_users_no_delete"
  on public.accounting_users for delete
  using (false);

-- Accounting users permission repair
-- Run this if /accounting/users shows:
--   permission denied for table accounting_users

alter table public.accounting_users enable row level security;

grant usage on schema public to authenticated;
grant select on public.accounting_users to authenticated;
grant execute on function public.can_access_accounting() to authenticated;

drop policy if exists "acct_users_select_own" on public.accounting_users;
create policy "acct_users_select_own"
  on public.accounting_users for select
  using (profile_id = auth.uid());

drop policy if exists "acct_users_select_admin" on public.accounting_users;
create policy "acct_users_select_admin"
  on public.accounting_users for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
    or exists (
      select 1 from public.accounting_users au
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('admin', 'owner')
    )
  );

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

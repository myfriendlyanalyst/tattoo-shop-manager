-- Align access rules with the operational role model:
-- Owner: full operations + artist view, request assignment by default.
-- Admin: system management, including Accounting.
-- Artist: own requests/projects/calendar/session/deposit.
-- Front Desk: all operational requests/projects/calendar input.

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.accounting_users au
      where au.profile_id = auth.uid()
        and au.active = true
    )
$$;

grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;

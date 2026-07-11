-- Align access rules with the operational role model:
-- Owner: full operations + artist view, request assignment, Accounting.
-- Admin: system management, but no Accounting access unless temporarily
-- promoted to Owner.
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
        and p.role = 'owner'
    )
    or exists (
      select 1
      from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and coalesce(p.role, 'accounting') = 'accounting'
    )
$$;

grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;

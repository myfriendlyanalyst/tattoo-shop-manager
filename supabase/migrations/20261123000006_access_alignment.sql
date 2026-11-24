-- FND-01: repository reconstruction candidate, NOT a deployed-schema dump.
-- Fresh disposable Supabase only until live comparison and replay are verified.
-- Historical SQL Editor instructions below are provenance, not deployment instructions.

-- BEGIN legacy source: docs/accounting_users_migration.sql
-- ============================================================
-- Accounting Users Migration
-- Run this in the Supabase SQL editor (service role / postgres).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. accounting_users table
-- ────────────────────────────────────────────────────────────

alter type public.app_role add value if not exists 'accounting';

create table if not exists public.accounting_users (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid unique references auth.users(id) on delete cascade,
  display_name         text not null,
  email                text not null unique,
  access_level         text not null default 'admin'
                         check (access_level in ('owner', 'admin')),
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists accounting_users_updated_at on public.accounting_users;
create trigger accounting_users_updated_at
  before update on public.accounting_users
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. RLS
-- ────────────────────────────────────────────────────────────

alter table public.accounting_users enable row level security;

-- Normalize older installs that may still have the removed viewer role.
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

grant usage on schema public to service_role;
grant select on public.accounting_users to authenticated;
grant select, insert, update, delete on public.accounting_users to service_role;
grant select, insert, update, delete on public.profiles to service_role;

-- Users can always read their own record (needed for proxy must_change_password check)
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

-- Accounting admins/owners can read all records.
-- Use a security definer function to avoid recursive accounting_users RLS.
drop policy if exists "acct_users_select_admin" on public.accounting_users;
create policy "acct_users_select_admin"
  on public.accounting_users for select
  using (public.is_accounting_admin());

-- No client-side writes — all mutations go through service role API routes
drop policy if exists "acct_users_no_insert" on public.accounting_users;
create policy "acct_users_no_insert" on public.accounting_users
  for insert with check (false);
drop policy if exists "acct_users_no_update" on public.accounting_users;
create policy "acct_users_no_update" on public.accounting_users
  for update using (false);
drop policy if exists "acct_users_no_delete" on public.accounting_users;
create policy "acct_users_no_delete" on public.accounting_users
  for delete using (false);

-- ────────────────────────────────────────────────────────────
-- 3. Update can_access_accounting()
--    Primary: accounting_users.active = true
--    Legacy fallback: profiles.role = 'owner'
--    staff_permissions.accountingAccess dependency removed.
-- ────────────────────────────────────────────────────────────

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
stable
as $$
  select (
    -- Primary path: active entry in accounting_users
    exists (
      select 1 from public.accounting_users au
      where au.profile_id = auth.uid()
        and au.active = true
    )
    or
    -- Legacy bypass for Tattoo Manager owners
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'owner'
    )
  );
$$;

grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;

-- ────────────────────────────────────────────────────────────
-- 4. Grant table access to authenticated role
--    (service_role already bypasses RLS)
-- ────────────────────────────────────────────────────────────

-- INSERT/UPDATE/DELETE intentionally withheld from authenticated;
-- all mutations use service_role via API routes.
-- END legacy source: docs/accounting_users_migration.sql

-- BEGIN legacy source: docs/accounting_users_permission_fix.sql
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
-- END legacy source: docs/accounting_users_permission_fix.sql

-- BEGIN legacy source: docs/accounting_access_hardening.sql
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
-- END legacy source: docs/accounting_access_hardening.sql

-- BEGIN legacy source: docs/artist_scope_hardening.sql
-- ============================================================
-- Artist Scope Hardening
-- Run in Supabase SQL Editor to make artist accounts see only
-- assigned operational records at the database layer.
-- ============================================================

create or replace function public.current_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.staff where profile_id = auth.uid()
$$;

grant execute on function public.current_staff_id() to authenticated;

drop policy if exists "requests_authenticated_all" on public.requests;
drop policy if exists "requests_operations_all_artist_assigned_select" on public.requests;
create policy "requests_operations_all_artist_assigned_select"
on public.requests for select
using (
  public.is_operations_user()
  or artist_id = public.current_staff_id()
  or exists (
    select 1
    from public.request_artist_candidates rac
    where rac.request_id = requests.id
      and rac.artist_id = public.current_staff_id()
  )
);

drop policy if exists "requests_insert_operations" on public.requests;
create policy "requests_insert_operations"
on public.requests for insert
with check (public.is_operations_user());

drop policy if exists "requests_update_operations_or_assigned_artist" on public.requests;
create policy "requests_update_operations_or_assigned_artist"
on public.requests for update
using (public.is_operations_user() or artist_id = public.current_staff_id())
with check (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "requests_delete_operations" on public.requests;
create policy "requests_delete_operations"
on public.requests for delete
using (public.is_operations_user());

drop policy if exists "request_artist_candidates_authenticated_all" on public.request_artist_candidates;
drop policy if exists "request_artist_candidates_operations_all_artist_own_select" on public.request_artist_candidates;
create policy "request_artist_candidates_operations_all_artist_own_select"
on public.request_artist_candidates for select
using (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "request_artist_candidates_write_operations" on public.request_artist_candidates;
create policy "request_artist_candidates_write_operations"
on public.request_artist_candidates for all
using (public.is_operations_user())
with check (public.is_operations_user());

drop policy if exists "files_authenticated_all" on public.files;
drop policy if exists "files_operations_all_artist_assigned_select" on public.files;
create policy "files_operations_all_artist_assigned_select"
on public.files for select
using (
  public.is_operations_user()
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.requests r
    where r.id = files.request_id
      and r.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = files.project_id
      and p.artist_id = public.current_staff_id()
  )
);

drop policy if exists "files_insert_authenticated" on public.files;
create policy "files_insert_authenticated"
on public.files for insert
with check (auth.uid() is not null);

drop policy if exists "files_update_operations_or_uploader" on public.files;
create policy "files_update_operations_or_uploader"
on public.files for update
using (public.is_operations_user() or uploaded_by = auth.uid())
with check (public.is_operations_user() or uploaded_by = auth.uid());

drop policy if exists "files_delete_operations" on public.files;
create policy "files_delete_operations"
on public.files for delete
using (public.is_operations_user());
-- END legacy source: docs/artist_scope_hardening.sql

-- BEGIN legacy source: docs/artist_calendar_booking_policy.sql
-- Allow artists to schedule appointments for their own projects.
-- Run in Supabase SQL Editor after artist_scope_hardening.sql if artists see
-- row-level security errors when saving an appointment from Calendar.

drop policy if exists "appointments_insert_operations" on public.appointments;
drop policy if exists "appointments_insert_operations_or_assigned_artist" on public.appointments;

create policy "appointments_insert_operations_or_assigned_artist"
on public.appointments for insert
with check (
  public.is_operations_user()
  or (
    artist_id = public.current_staff_id()
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.artist_id = public.current_staff_id()
    )
  )
);
-- END legacy source: docs/artist_calendar_booking_policy.sql

-- BEGIN legacy source: docs/deposit_artist_update_policy.sql
-- ============================================================
-- Deposit Artist Update Policy
-- Run in Supabase SQL Editor if artist session entry with deposit
-- application fails with:
--   Cannot coerce the result to a single JSON object
-- ============================================================

drop policy if exists "deposits_update_operations_or_creator" on public.deposits;
create policy "deposits_update_operations_or_creator"
on public.deposits for update
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
)
with check (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);
-- END legacy source: docs/deposit_artist_update_policy.sql

-- BEGIN legacy source: docs/supabase_apply_grants.sql
-- Run this in Supabase SQL Editor if tables exist but the app shows:
-- "permission denied for table ..."

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.staff_permissions to authenticated;
grant select, insert, update, delete on public.staff_schedules to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.session_entries to authenticated;
grant select, insert, update, delete on public.deposits to authenticated;
grant select, insert, update, delete on public.payouts to authenticated;
grant select, insert, update, delete on public.payout_items to authenticated;
grant select, insert, update, delete on public.requests to authenticated;
grant select, insert, update, delete on public.files to authenticated;

grant select on public.accounting_entries to authenticated;

grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_owner_or_admin() to authenticated;
grant execute on function public.is_operations_user() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
-- END legacy source: docs/supabase_apply_grants.sql

-- BEGIN legacy source: docs/staff_user_service_role_grants.sql
-- ============================================================
-- Staff User Service Role Grants
-- Run in Supabase SQL Editor if /api/staff-user returns:
--   permission denied for table staff
-- ============================================================

grant usage on schema public to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.staff to service_role;
grant select, insert, update, delete on public.staff_permissions to service_role;
grant select, insert, update, delete on public.staff_schedules to service_role;
-- END legacy source: docs/staff_user_service_role_grants.sql

-- BEGIN legacy source: docs/supabase_service_role_operational_grants.sql
-- Required for server-side operations APIs that use SUPABASE_SERVICE_ROLE_KEY.
-- Run in Supabase SQL Editor if request booking or appointment email APIs show:
-- "permission denied for table customers/projects/appointments/deposits/requests".

grant usage on schema public to service_role;

grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.projects to service_role;
grant select, insert, update, delete on public.appointments to service_role;
grant select, insert, update, delete on public.deposits to service_role;
grant select, insert, update, delete on public.requests to service_role;

grant select on public.staff to service_role;
grant select on public.profiles to service_role;
grant select on public.staff_permissions to service_role;

grant insert, select, update on public.email_logs to service_role;
-- END legacy source: docs/supabase_service_role_operational_grants.sql


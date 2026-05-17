-- ============================================================
-- Accounting Users Migration
-- Run this in the Supabase SQL editor (service role / postgres).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. accounting_users table
-- ────────────────────────────────────────────────────────────

create table if not exists public.accounting_users (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid unique references auth.users(id) on delete cascade,
  display_name         text not null,
  email                text not null unique,
  access_level         text not null default 'viewer'
                         check (access_level in ('owner', 'admin', 'viewer')),
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

create trigger accounting_users_updated_at
  before update on public.accounting_users
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. RLS
-- ────────────────────────────────────────────────────────────

alter table public.accounting_users enable row level security;

-- Users can always read their own record (needed for proxy must_change_password check)
create policy "acct_users_select_own"
  on public.accounting_users for select
  using (profile_id = auth.uid());

-- Accounting admins/owners can read all records
create policy "acct_users_select_admin"
  on public.accounting_users for select
  using (
    -- Owner by Tattoo Manager role (legacy bypass)
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
    or
    -- Accounting admin/owner
    exists (
      select 1 from public.accounting_users au
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('admin', 'owner')
    )
  );

-- No client-side writes — all mutations go through service role API routes
create policy "acct_users_no_insert" on public.accounting_users
  for insert with check (false);
create policy "acct_users_no_update" on public.accounting_users
  for update using (false);
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

-- ────────────────────────────────────────────────────────────
-- 4. Grant table access to authenticated role
--    (service_role already bypasses RLS)
-- ────────────────────────────────────────────────────────────

grant select on public.accounting_users to authenticated;
-- INSERT/UPDATE/DELETE intentionally withheld from authenticated;
-- all mutations use service_role via API routes.

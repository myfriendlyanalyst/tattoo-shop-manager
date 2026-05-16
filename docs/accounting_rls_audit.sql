-- ============================================================
-- Accounting App ??RLS Policy Audit
-- Status: READ-ONLY reference. Run these queries in Supabase
-- SQL Editor to verify the current policy state.
-- None of these statements modify the database.
-- ============================================================


-- ============================================================
-- 1. VERIFY: Tables protected by is_owner_or_admin()
-- Expected result: payouts and payout_items have
-- owner/admin-only SELECT and ALL policies.
-- ============================================================

select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('payouts', 'payout_items')
order by tablename, cmd;

-- Expected rows:
--   payouts | payouts_admin_select   | SELECT | (is_owner_or_admin())
--   payouts | payouts_write_admin    | ALL    | (is_owner_or_admin())
--   payout_items | payout_items_admin_select | SELECT | (is_owner_or_admin())
--   payout_items | payout_items_write_admin  | ALL    | (is_owner_or_admin())


-- ============================================================
-- 2. VERIFY: accounting_entries view has security_invoker = true
-- This means the view runs with the calling user's RLS context,
-- not the view definer's. An artist can only see their own rows.
-- ============================================================

select
  schemaname,
  viewname,
  definition
from pg_views
where schemaname = 'public'
  and viewname = 'accounting_entries';

-- Also check via information_schema for security_invoker:
select
  table_schema,
  table_name,
  view_definition
from information_schema.views
where table_schema = 'public'
  and table_name = 'accounting_entries';

-- Confirm 'security_invoker = true' appears in the view definition.


-- ============================================================
-- 3. VERIFY: session_entries RLS allows only owner/admin/operations
-- to see all rows; artists see only their own.
-- ============================================================

select
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'session_entries'
order by cmd;

-- Expected SELECT policy qual:
--   (is_operations_user() OR artist_id = current_staff_id() OR created_by = auth.uid())
-- This means a non-operations artist sees only rows where
--   artist_id matches their staff record OR they created the entry.
-- Owner/admin always sees all rows (is_operations_user() = true).


-- ============================================================
-- 4. VERIFY: deposits RLS ??same pattern as session_entries
-- ============================================================

select
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'deposits'
order by cmd;


-- ============================================================
-- 5. VERIFY: is_owner_or_admin() function definition
-- Confirms the function reads from profiles table using auth.uid().
-- ============================================================

select
  routine_name,
  routine_definition
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'is_owner_or_admin';

-- Expected body:
--   select coalesce(current_user_role() in ('owner', 'admin'), false)
-- Where current_user_role() does:
--   select role from profiles where id = auth.uid()


-- ============================================================
-- 6. VERIFY: No public (anon) access to accounting tables
-- No rows should be returned ??anon role should have no policies.
-- ============================================================

select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('payouts', 'payout_items', 'session_entries', 'deposits')
  and (roles @> ARRAY['anon']::name[] or roles = ARRAY[]::name[])
order by tablename;

-- If any rows are returned with cmd='SELECT' and roles='{}' (empty = applies to all),
-- that policy is accessible to anon. Verify that the USING clause
-- calls is_owner_or_admin() which returns false for anon (auth.uid() = null).


-- ============================================================
-- 7. SPOT CHECK: Attempt to simulate a non-owner user
-- Replace '<artist-user-id>' with an actual artist profile id.
-- Run as the service role (Supabase SQL editor uses service role,
-- so SET LOCAL is needed to simulate RLS for a specific user).
-- ============================================================

-- set local role authenticated;
-- set local request.jwt.claims = '{"sub": "<artist-user-id>", "role": "authenticated"}';
-- select count(*) from public.payouts;          -- expect 0 rows
-- select count(*) from public.payout_items;     -- expect 0 rows
-- select count(*) from public.accounting_entries; -- expect only their own entries
-- reset role;


-- ============================================================
-- 8. VERIFY: accountingAccess permission state for staff members
-- Lists all staff with their accountingAccess permission value.
-- Expected: only explicitly granted staff show enabled = true.
-- ============================================================

select
  s.id            as staff_id,
  s.display_name,
  p.role          as profile_role,
  sp.enabled      as accounting_access
from staff s
join profiles p on p.id = s.profile_id
left join staff_permissions sp
  on sp.staff_id = s.id
  and sp.permission_key = 'accountingAccess'
where s.active = true
order by p.role, s.display_name;

-- Expected:
--   owner role    → accounting_access may be null (owner bypasses permission check)
--   admin role    → accounting_access must be true to access /accounting/*
--   artist / front_desk → same; no special default


-- ============================================================
-- 9. ARCHITECTURE SUMMARY
-- Access control layers for /accounting/* routes:
--
-- Layer 1 — Next.js Proxy (src/proxy.ts)
--   - Runs at the Edge before any page renders
--   - Checks Supabase session via cookie (requires @supabase/ssr)
--   - Redirects unauthenticated users to /?next=/accounting/...
--   - Access rule:
--       profiles.role = 'owner'                    → always allowed
--       staff_permissions.accountingAccess = true  → allowed (any role)
--       all others                                 → redirect to /requests
--   - Covers: all /accounting/:path* routes
--
-- Layer 2 — Client-side page guard (each accounting page)
--   - getSafeUser() + hasAccountingAccess(user.id) in useEffect
--   - Renders "Access denied" if proxy somehow passed a user
--     whose permission was revoked after the proxy ran
--   - Uses src/lib/accounting-access.ts (same logic as proxy)
--   - Defense-in-depth against proxy bypass
--
-- Layer 3 — Supabase RLS
--   - payouts / payout_items: is_owner_or_admin() required
--   - session_entries / deposits: artist sees own rows only;
--     owner/admin sees all via is_operations_user()
--   - accounting_entries view: security_invoker = true applies
--     the calling user's session_entries RLS automatically
--   - This is the authoritative security layer — even if layers
--     1 and 2 are bypassed, the DB returns no accounting data
--     to a non-owner/admin user.
--
-- What is NOT protected at the DB level:
--   - The accounting_entries view select grant is given to
--     all 'authenticated' roles. Access is filtered by the
--     underlying session_entries RLS, not a view-level policy.
--     An artist CAN query accounting_entries but only sees
--     their own session_entries rows.
-- ============================================================

-- ============================================================
-- Accounting App RLS Policy Audit
-- Status: READ-ONLY reference. Run these queries in Supabase
-- SQL Editor to verify the current policy state.
-- None of these statements modify the database.
-- ============================================================


-- ============================================================
-- 1. VERIFY: Accounting access helper functions
-- Expected:
--   can_access_accounting() allows Tattoo Manager owner OR
--   accounting_users.active=true.
--   is_accounting_admin() allows Tattoo Manager owner OR active
--   accounting_users with access_level owner/admin.
-- ============================================================

select
  routine_name,
  routine_definition
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('can_access_accounting', 'is_accounting_admin')
order by routine_name;


-- ============================================================
-- 2. VERIFY: Payout tables use can_access_accounting()
-- Expected result: payouts and payout_items SELECT/ALL policies
-- call public.can_access_accounting().
-- ============================================================

select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('payouts', 'payout_items')
order by tablename, cmd;


-- ============================================================
-- 3. VERIFY: accounting_entries view has security_invoker = true
-- This means the view runs with the calling user's RLS context,
-- not the view definer's.
-- ============================================================

select
  schemaname,
  viewname,
  definition
from pg_views
where schemaname = 'public'
  and viewname = 'accounting_entries';

select
  table_schema,
  table_name,
  view_definition
from information_schema.views
where table_schema = 'public'
  and table_name = 'accounting_entries';


-- ============================================================
-- 4. VERIFY: session_entries / deposits RLS
-- Accounting managers need shop-wide rows. Expected SELECT
-- policies include public.can_access_accounting().
-- ============================================================

select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('session_entries', 'deposits')
order by tablename, cmd;


-- ============================================================
-- 5. VERIFY: accounting user records
-- Expected:
--   - access_level is only owner/admin.
--   - active=true users can access /accounting.
--   - must_change_password=true users are forced to /force-password-change.
-- ============================================================

select
  au.id,
  au.profile_id,
  au.display_name,
  au.email,
  au.access_level,
  au.active,
  au.must_change_password,
  p.role as profile_role
from public.accounting_users au
left join public.profiles p on p.id = au.profile_id
order by au.active desc, au.access_level, au.display_name;


-- ============================================================
-- 6. VERIFY: No public (anon) access to accounting tables
-- No rows should be returned for anon-specific policies.
-- If roles is empty, confirm the USING clause returns false
-- for auth.uid() = null.
-- ============================================================

select
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('payouts', 'payout_items', 'session_entries', 'deposits')
  and (roles @> ARRAY['anon']::name[] or roles = ARRAY[]::name[])
order by tablename;


-- ============================================================
-- 7. SPOT CHECK: Simulate users
-- Replace IDs before running. Supabase SQL Editor uses service
-- role, so SET LOCAL is needed to simulate RLS.
-- ============================================================

-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub": "<accounting-access-user-id>", "role": "authenticated"}';
-- select public.can_access_accounting(); -- expect true
-- select count(*) from public.payouts; -- expect permitted rows
-- rollback;

-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub": "<no-accounting-access-user-id>", "role": "authenticated"}';
-- select public.can_access_accounting(); -- expect false
-- select count(*) from public.payouts; -- expect 0 rows
-- rollback;


-- ============================================================
-- 8. ARCHITECTURE SUMMARY
-- Access control layers for /accounting/* routes:
--
-- Layer 1 - Next.js Proxy (src/proxy.ts)
--   - Redirects unauthenticated accounting routes to /login?next=/accounting/...
--   - Access rule:
--       profiles.role = 'owner' -> always allowed
--       accounting_users.active=true -> allowed
--       all others -> redirect to /requests
--   - Accounting-only profiles.role='accounting' users are redirected away
--     from operations pages back to /accounting/dashboard.
--
-- Layer 2 - Client-side page guard
--   - getSafeUser() + hasAccountingAccess(user.id)
--   - Uses src/lib/accounting-access.ts
--
-- Layer 3 - Supabase RLS
--   - payouts / payout_items use public.can_access_accounting()
--   - session_entries/deposits SELECT policies include
--     public.can_access_accounting() for full dashboard totals
--   - accounting_entries uses security_invoker and session_entries RLS
-- ============================================================

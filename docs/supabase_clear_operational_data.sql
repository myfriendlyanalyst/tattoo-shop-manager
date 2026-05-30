-- Clear test/sample operational data while keeping user and staff setup.
--
-- Preserved:
-- - auth.users
-- - public.profiles
-- - public.staff
-- - public.staff_permissions
-- - public.staff_schedules
-- - public.accounting_users
--
-- This removes customer/request/project/calendar/session/deposit/accounting
-- records, request email logs, artist response tokens, and request numbers.
-- Review the table list before running in Supabase SQL Editor.

begin;

do $$
declare
  existing_tables text;
begin
  select string_agg(format('public.%I', tablename), ', ')
  into existing_tables
  from pg_tables
  where schemaname = 'public'
    and tablename = any(array[
      'request_artist_action_tokens',
      'request_messages',
      'files',
      'request_artist_candidates',
      'requests',
      'session_payments',
      'deposit_applications',
      'payout_items',
      'payouts',
      'deposits',
      'session_entries',
      'appointments',
      'projects',
      'customers'
    ]);

  if existing_tables is not null then
    execute 'truncate table ' || existing_tables || ' restart identity cascade';
  end if;
end $$;

alter sequence if exists public.request_number_seq restart with 1;

commit;

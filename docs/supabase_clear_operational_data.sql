-- Clear test/sample operational data while keeping user and staff setup.
--
-- Preserved:
-- - auth.users
-- - public.profiles
-- - public.staff
-- - public.staff_permissions
-- - public.staff_schedules
--
-- This removes customer/request/project/calendar/session/deposit/accounting records.
-- Review the table list before running in Supabase SQL Editor.

truncate table
  public.files,
  public.request_artist_candidates,
  public.requests,
  public.session_payments,
  public.deposit_applications,
  public.payout_items,
  public.payouts,
  public.deposits,
  public.session_entries,
  public.appointments,
  public.projects,
  public.customers
restart identity cascade;

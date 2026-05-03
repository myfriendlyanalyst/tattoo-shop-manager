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

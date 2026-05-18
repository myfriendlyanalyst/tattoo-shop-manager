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

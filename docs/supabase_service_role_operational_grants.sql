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

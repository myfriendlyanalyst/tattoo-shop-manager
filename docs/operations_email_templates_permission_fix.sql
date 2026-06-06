-- Fix grants for operations_email_templates if the table was created before grants were added.
-- Run in Supabase SQL Editor if Settings > Email templates shows:
-- "permission denied for table operations_email_templates"

grant usage on schema public to authenticated, service_role;
grant select on public.operations_email_templates to authenticated;
grant select, insert, update, delete on public.operations_email_templates to service_role;


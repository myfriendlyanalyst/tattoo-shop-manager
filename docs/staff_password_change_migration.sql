-- ============================================================
-- Staff Password Change Migration
-- Run in Supabase SQL Editor to support first-login password
-- changes for Tattoo Manager staff accounts.
-- ============================================================

alter table public.staff
  add column if not exists must_change_password boolean not null default false;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.staff to service_role;

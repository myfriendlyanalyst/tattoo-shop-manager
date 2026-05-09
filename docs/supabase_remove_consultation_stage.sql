-- Remove consultation as an app workflow stage.
-- PostgreSQL enum values are left in place for compatibility, but existing rows
-- and defaults are moved to booked.

alter table public.projects
alter column status set default 'booked';

update public.projects
set status = 'booked'
where status::text = 'consultation';

update public.requests
set
  status = 'booked',
  booked_at = coalesce(booked_at, consultation_at, now())
where status::text = 'consultation';

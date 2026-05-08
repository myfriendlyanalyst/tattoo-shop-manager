-- Project statuses now start after a request has been converted.
-- Request is the lead stage; Project starts at consultation.

alter type public.project_status add value if not exists 'on_hold';

alter table public.projects
alter column status set default 'consultation';

update public.projects
set status = 'consultation'
where status::text = 'lead';

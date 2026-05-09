-- Project statuses now start after a request has been booked.
-- Request is the lead stage; Project starts at booked.

alter type public.project_status add value if not exists 'on_hold';

alter table public.projects
alter column status set default 'booked';

update public.projects
set status = 'booked'
where status::text = 'lead';

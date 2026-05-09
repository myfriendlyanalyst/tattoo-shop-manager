-- Step 3: create sample appointments, deposits, and one session.
-- Run after seed_step_2_projects.sql. Run without RLS.

insert into public.appointments (
  project_id, customer_id, artist_id, starts_at, ends_at, appointment_type, status, notes
)
select
  p.id,
  p.customer_id,
  p.artist_id,
  date_trunc('day', now()) + interval '14 hours',
  date_trunc('day', now()) + interval '17 hours',
  'On-Going',
  'completed',
  'First sample session completed.'
from public.projects p
where p.subject = 'Mia Park - floral forearm tattoo';

insert into public.appointments (
  project_id, customer_id, artist_id, starts_at, ends_at, appointment_type, status, notes
)
select
  p.id,
  p.customer_id,
  p.artist_id,
  date_trunc('day', now()) + interval '1 day 15 hours',
  date_trunc('day', now()) + interval '1 day 18 hours',
  'On-Going',
  'scheduled',
  'Stencil and first pass.'
from public.projects p
where p.subject = 'Jordan Lee - dragon shoulder tattoo';

insert into public.appointments (
  project_id, customer_id, artist_id, starts_at, ends_at, appointment_type, status, notes
)
select
  p.id,
  p.customer_id,
  p.artist_id,
  date_trunc('day', now()) + interval '2 days 13 hours',
  date_trunc('day', now()) + interval '2 days 13 hours 30 minutes',
  'Walk-in',
  'scheduled',
  'Booking placeholder.'
from public.projects p
where p.subject = 'Chris Nguyen - script rib tattoo';

insert into public.deposits (
  project_id, customer_id, artist_id, amount, payment_method, received_at, available, memo
)
select p.id, p.customer_id, p.artist_id, 200.00, 'cash', now() - interval '6 days', true, 'Sample booking deposit.'
from public.projects p
where p.subject = 'Mia Park - floral forearm tattoo';

insert into public.deposits (
  project_id, customer_id, artist_id, amount, payment_method, received_at, available, memo
)
select p.id, p.customer_id, p.artist_id, 300.00, 'credit_card', now() - interval '2 days', true, 'Sample deposit.'
from public.projects p
where p.subject = 'Jordan Lee - dragon shoulder tattoo';

insert into public.session_entries (
  appointment_id, project_id, customer_id, artist_id, entry_type,
  tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo, entered_at
)
select
  a.id, a.project_id, a.customer_id, a.artist_id, 'session',
  750.00, 'cash', 80.00, 'cash', 'Sample first session.', a.starts_at + interval '3 hours'
from public.appointments a
join public.projects p on p.id = a.project_id
where p.subject = 'Mia Park - floral forearm tattoo'
limit 1;

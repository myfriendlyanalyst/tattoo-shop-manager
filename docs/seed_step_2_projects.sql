-- Step 2: create sample projects.
-- Run after seed_step_1_customers.sql. Run without RLS.

insert into public.projects (
  customer_id,
  artist_id,
  subject,
  size,
  session_type,
  waiver_signed,
  waiver_status,
  waiver_signed_at,
  status,
  memo
)
values
  (
    (select id from public.customers where email = 'mia.sample@example.com'),
    (select id from public.staff where active = true and lower(role) = 'artist' order by sort_order, display_name limit 1),
    'Mia Park - floral forearm tattoo',
    '6 inch',
    'Multiple Session',
    true,
    'signed',
    now() - interval '5 days',
    'in_progress',
    'Soft black and grey floral piece.'
  ),
  (
    (select id from public.customers where email = 'jordan.sample@example.com'),
    coalesce(
      (select id from public.staff where active = true and lower(role) = 'artist' order by sort_order, display_name offset 1 limit 1),
      (select id from public.staff where active = true and lower(role) = 'artist' order by sort_order, display_name limit 1)
    ),
    'Jordan Lee - dragon shoulder tattoo',
    '9 inch',
    'Multiple Session',
    false,
    'missing',
    null,
    'booked',
    'Large dragon concept.'
  ),
  (
    (select id from public.customers where email = 'chris.sample@example.com'),
    (select id from public.staff where active = true and lower(role) = 'artist' order by sort_order, display_name limit 1),
    'Chris Nguyen - script rib tattoo',
    '4 inch',
    'One Done',
    false,
    'sent',
    null,
    'booked',
    'Fine line script. Needs placement confirmation.'
  );

select subject, status, artist_id
from public.projects
where subject like 'Mia Park%' or subject like 'Jordan Lee%' or subject like 'Chris Nguyen%'
order by subject;

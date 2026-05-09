-- Step 4: create sample requests.
-- Run after seed_step_2_projects.sql. Run without RLS.

insert into public.requests (
  customer_id, project_id, client_name, email, phone, subject,
  tattoo_description, approximate_size, placement, requested_artist_label,
    artist_id, status, received_at, forwarded_at, artist_reply_at, booked_at, notes
)
values
  (
    (select id from public.customers where email = 'sofia.sample@example.com'),
    null,
    'Sofia Ramirez',
    'sofia.sample@example.com',
    '(323) 555-0199',
    'Sofia Ramirez - ankle butterfly tattoo',
    'Small butterfly with light shading.',
    '3',
    'Ankle',
    'Any available',
    null,
    'new',
    now() - interval '3 hours',
    null,
    null,
    null,
    'Sample new request from website form.'
  ),
  (
    (select id from public.customers where email = 'chris.sample@example.com'),
    (select id from public.projects where subject = 'Chris Nguyen - script rib tattoo'),
    'Chris Nguyen',
    'chris.sample@example.com',
    '(424) 555-0147',
    'Chris Nguyen - script rib tattoo',
    'Fine line script quote.',
    '4',
    'Rib',
    'Selected artist',
    (select artist_id from public.projects where subject = 'Chris Nguyen - script rib tattoo'),
    'booked',
    now() - interval '2 days',
    now() - interval '2 days',
    now() - interval '1 day 20 hours',
    now() + interval '2 days 13 hours',
    'Sample converted request linked to project.'
  ),
  (
    (select id from public.customers where email = 'jordan.sample@example.com'),
    (select id from public.projects where subject = 'Jordan Lee - dragon shoulder tattoo'),
    'Jordan Lee',
    'jordan.sample@example.com',
    '(310) 555-0128',
    'Jordan Lee - dragon shoulder tattoo',
    'Dragon wrapping shoulder and upper arm.',
    '9',
    'Shoulder',
    'Selected artist',
    (select artist_id from public.projects where subject = 'Jordan Lee - dragon shoulder tattoo'),
    'booked',
    now() - interval '5 days',
    now() - interval '5 days',
    now() - interval '4 days',
    null,
    'Sample booked request linked to project.'
  );

-- Step 1: reset and create sample customers.
-- Run without RLS.

delete from public.customers
where email in (
  'mia.sample@example.com',
  'jordan.sample@example.com',
  'sofia.sample@example.com',
  'chris.sample@example.com'
);

insert into public.customers (name, email, phone, notes)
values
  ('Mia Park', 'mia.sample@example.com', '(213) 555-0184', 'Sample customer.'),
  ('Jordan Lee', 'jordan.sample@example.com', '(310) 555-0128', 'Sample customer.'),
  ('Sofia Ramirez', 'sofia.sample@example.com', '(323) 555-0199', 'Sample request only.'),
  ('Chris Nguyen', 'chris.sample@example.com', '(424) 555-0147', 'Sample customer.');

select id, name, email
from public.customers
where email like '%.sample@example.com'
order by name;

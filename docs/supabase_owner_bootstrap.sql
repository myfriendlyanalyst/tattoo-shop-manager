-- Run this once in Supabase SQL Editor after creating the first login user.
-- It links the authenticated user to an owner profile and staff record so RLS
-- allows owner/admin actions such as editing staff schedules and permissions.

insert into public.profiles (id, email, display_name, role, active)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', 'Taylee'),
  'owner'::public.app_role,
  true
from auth.users u
where u.email = 'taylee98@gmail.com'
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = 'owner'::public.app_role,
  active = true,
  updated_at = now();

insert into public.staff (
  profile_id,
  display_name,
  legal_name,
  role,
  email,
  start_date,
  active,
  sort_order
)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', 'Taylee'),
  coalesce(u.raw_user_meta_data->>'full_name', 'Taylee'),
  'Owner',
  u.email,
  current_date,
  true,
  1
from auth.users u
where u.email = 'taylee98@gmail.com'
on conflict (profile_id) do update
set
  display_name = excluded.display_name,
  legal_name = excluded.legal_name,
  role = 'Owner',
  email = excluded.email,
  active = true,
  sort_order = 1,
  updated_at = now();

insert into public.staff_permissions (staff_id, permission_key, enabled)
select s.id, p.permission_key, true
from public.staff s
cross join (
  values
    ('artistSchedule'),
    ('session'),
    ('deposit'),
    ('merch'),
    ('staffAdmin')
) as p(permission_key)
where s.email = 'taylee98@gmail.com'
on conflict (staff_id, permission_key) do update
set
  enabled = true,
  updated_at = now();

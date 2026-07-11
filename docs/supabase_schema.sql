-- Tattoo Shop Management App
-- Supabase/Postgres initial schema
-- Created: 2026-05-03

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'artist', 'front_desk', 'accounting');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('booked', 'in_progress', 'completed', 'cancelled', 'on_hold');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.entry_type as enum ('session', 'deposit', 'merch');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'credit_card', 'app', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payout_status as enum ('draft', 'ready', 'paid', 'void');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum (
    'new',
    'forwarded',
    'artist_replied',
    'client_replied',
    'booked',
    'client_waiting_for_reply',
    'no_answer',
    'denied',
    'spam'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_priority as enum ('low', 'normal', 'high');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.file_type as enum ('reference', 'waiver', 'before_photo', 'after_photo', 'document', 'other');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Shared timestamp helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles and staff
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.app_role not null default 'artist',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  legal_name text,
  role text not null default 'Artist',
  phone text,
  email text,
  address text,
  start_date date,
  active boolean not null default true,
  must_change_password boolean not null default false,
  default_session_duration_minutes integer not null default 120 check (default_session_duration_minutes between 30 and 720),
  calendar_feed_token text not null default encode(gen_random_bytes(24), 'hex') unique,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  permission_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, permission_key)
);

create table if not exists public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  available boolean not null default true,
  starts_at time,
  ends_at time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, day_of_week),
  check (
    available = false
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table if not exists public.accounting_users (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  access_level text not null default 'admin' check (access_level in ('owner', 'admin')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers, projects, appointments
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  phone_normalized text,
  email text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  artist_id uuid references public.staff(id) on delete set null,
  subject text not null,
  size text,
  session_type text,
  waiver_signed boolean not null default false,
  waiver_status text not null default 'missing' check (
    waiver_status in ('missing', 'sent', 'signed')
  ),
  waiver_sent_at timestamptz,
  waiver_signed_at timestamptz,
  status public.project_status not null default 'booked',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  artist_id uuid references public.staff(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  appointment_type text not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money records
-- ---------------------------------------------------------------------------

create table if not exists public.session_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  artist_id uuid references public.staff(id) on delete set null,
  entry_type public.entry_type not null default 'session',
  tattoo_amount numeric(10, 2) not null default 0 check (tattoo_amount >= 0),
  tattoo_payment_method public.payment_method,
  tip_amount numeric(10, 2) not null default 0 check (tip_amount >= 0),
  tip_payment_method public.payment_method,
  merch_amount numeric(10, 2) not null default 0 check (merch_amount >= 0),
  merch_payment_method public.payment_method,
  memo text,
  entered_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  artist_id uuid references public.staff(id) on delete set null,
  amount numeric(10, 2) not null check (amount >= 0),
  payment_method public.payment_method not null,
  received_at timestamptz not null default now(),
  available boolean not null default true,
  disposition text not null default 'available' check (disposition in ('available', 'applied', 'forfeited', 'refunded')),
  used_at timestamptz,
  used_session_entry_id uuid references public.session_entries(id) on delete set null,
  memo text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.staff(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.payout_status not null default 'draft',
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  session_entry_id uuid references public.session_entries(id) on delete set null,
  deposit_id uuid references public.deposits(id) on delete set null,
  amount numeric(10, 2) not null check (amount >= 0),
  payment_method public.payment_method,
  item_type text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Request tracker
-- ---------------------------------------------------------------------------

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  client_name text not null,
  email text,
  phone text,
  subject text not null,
  tattoo_description text,
  approximate_size text,
  placement text,
  reference_image_url text,
  requested_artist_label text,
  tattoo_timing_preference text check (
    tattoo_timing_preference is null
    or tattoo_timing_preference in ('asap', 'within_1_2_weeks', 'flexible', 'preferred_date')
  ),
  preferred_appointment_date date,
  age_confirmed boolean not null default false,
  artist_id uuid references public.staff(id) on delete set null,
  status public.request_status not null default 'new',
  priority public.request_priority not null default 'normal',
  received_at timestamptz not null default now(),
  forwarded_at timestamptz,
  artist_reply_at timestamptz,
  client_reply_at timestamptz,
  consultation_at timestamptz,
  booked_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_artist_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  artist_id uuid not null references public.staff(id) on delete cascade,
  status text not null default 'sent' check (
    status in ('sent', 'interested', 'passed', 'selected', 'declined')
  ),
  responded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, artist_id)
);

-- ---------------------------------------------------------------------------
-- Files
-- ---------------------------------------------------------------------------

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_type public.file_type not null default 'other',
  storage_path text not null,
  original_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpful views
-- ---------------------------------------------------------------------------

create or replace view public.accounting_entries
with (security_invoker = true)
as
select
  se.id,
  se.entered_at,
  se.entry_type,
  se.artist_id,
  st.display_name as artist_name,
  se.customer_id,
  c.name as customer_name,
  se.project_id,
  p.subject as project_subject,
  se.tattoo_amount,
  se.tattoo_payment_method,
  se.tip_amount,
  se.tip_payment_method,
  se.merch_amount,
  se.merch_payment_method,
  (se.tattoo_amount + se.tip_amount + se.merch_amount) as total_amount,
  se.memo,
  0::numeric(10, 2) as deposit_amount,
  null::public.payment_method as deposit_payment_method
from public.session_entries se
left join public.staff st on st.id = se.artist_id
left join public.customers c on c.id = se.customer_id
left join public.projects p on p.id = se.project_id
union all
select
  d.id,
  coalesce(d.used_at, d.received_at) as entered_at,
  'deposit'::public.entry_type as entry_type,
  null::uuid as artist_id,
  null::text as artist_name,
  d.customer_id,
  c.name as customer_name,
  d.project_id,
  p.subject as project_subject,
  0::numeric(10, 2) as tattoo_amount,
  null::public.payment_method as tattoo_payment_method,
  0::numeric(10, 2) as tip_amount,
  null::public.payment_method as tip_payment_method,
  0::numeric(10, 2) as merch_amount,
  null::public.payment_method as merch_payment_method,
  d.amount as total_amount,
  coalesce(d.memo, 'Forfeited deposit') as memo,
  d.amount as deposit_amount,
  d.payment_method as deposit_payment_method
from public.deposits d
left join public.customers c on c.id = d.customer_id
left join public.projects p on p.id = d.project_id
where d.disposition = 'forfeited';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_profiles_role on public.profiles(role);
create unique index if not exists idx_profiles_email_unique on public.profiles(lower(email));
create index if not exists idx_staff_active on public.staff(active);
create index if not exists idx_staff_profile_id on public.staff(profile_id);
create unique index if not exists idx_staff_display_name_unique on public.staff(lower(display_name));
create index if not exists idx_staff_schedules_staff_day on public.staff_schedules(staff_id, day_of_week);
create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_projects_customer_id on public.projects(customer_id);
create index if not exists idx_projects_artist_id on public.projects(artist_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_waiver_status on public.projects(waiver_status);
create index if not exists idx_appointments_artist_starts on public.appointments(artist_id, starts_at);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);
create index if not exists idx_session_entries_artist_entered on public.session_entries(artist_id, entered_at);
create index if not exists idx_session_entries_customer_id on public.session_entries(customer_id);
create index if not exists idx_deposits_project_id on public.deposits(project_id);
create index if not exists idx_deposits_available on public.deposits(available);
create index if not exists idx_deposits_disposition on public.deposits(disposition);
create index if not exists idx_payouts_artist_period on public.payouts(artist_id, period_start, period_end);
create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_artist_id on public.requests(artist_id);
create index if not exists idx_requests_received_at on public.requests(received_at);
create index if not exists idx_requests_requested_artist_label on public.requests(requested_artist_label);
create index if not exists idx_requests_preferred_appointment_date on public.requests(preferred_appointment_date);
create unique index if not exists idx_requests_project_id_unique on public.requests(project_id) where project_id is not null;
create index if not exists idx_request_artist_candidates_request_id on public.request_artist_candidates(request_id);
create index if not exists idx_request_artist_candidates_artist_id on public.request_artist_candidates(artist_id);
create index if not exists idx_files_customer_id on public.files(customer_id);
create index if not exists idx_files_project_id on public.files(project_id);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_staff_updated_at on public.staff;
create trigger set_staff_updated_at
before update on public.staff
for each row execute function public.set_updated_at();

drop trigger if exists set_staff_permissions_updated_at on public.staff_permissions;
create trigger set_staff_permissions_updated_at
before update on public.staff_permissions
for each row execute function public.set_updated_at();

drop trigger if exists set_staff_schedules_updated_at on public.staff_schedules;
create trigger set_staff_schedules_updated_at
before update on public.staff_schedules
for each row execute function public.set_updated_at();

drop trigger if exists set_accounting_users_updated_at on public.accounting_users;
create trigger set_accounting_users_updated_at
before update on public.accounting_users
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_session_entries_updated_at on public.session_entries;
create trigger set_session_entries_updated_at
before update on public.session_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_deposits_updated_at on public.deposits;
create trigger set_deposits_updated_at
before update on public.deposits
for each row execute function public.set_updated_at();

drop trigger if exists set_payouts_updated_at on public.payouts;
create trigger set_payouts_updated_at
before update on public.payouts
for each row execute function public.set_updated_at();

drop trigger if exists set_requests_updated_at on public.requests;
create trigger set_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

drop trigger if exists set_request_artist_candidates_updated_at on public.request_artist_candidates;
create trigger set_request_artist_candidates_updated_at
before update on public.request_artist_candidates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers for RLS
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false)
$$;

create or replace function public.is_operations_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin', 'front_desk'), false)
$$;

create or replace function public.has_staff_permission(required_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.staff s
      join public.staff_permissions sp on sp.staff_id = s.id
      where s.profile_id = auth.uid()
        and s.active = true
        and sp.permission_key = required_key
        and sp.enabled = true
    ),
    false
  )
$$;

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and coalesce(p.role, 'accounting') = 'accounting'
    )
    or public.current_user_role() = 'owner',
    false
  )
$$;

create or replace function public.is_accounting_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
    or exists (
      select 1 from public.accounting_users au
      left join public.profiles p on p.id = au.profile_id
      where au.profile_id = auth.uid()
        and au.active = true
        and au.access_level in ('owner', 'admin')
        and coalesce(p.role, 'accounting') = 'accounting'
    ),
    false
  )
$$;

create or replace function public.current_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.staff where profile_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.accounting_users enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.appointments enable row level security;
alter table public.session_entries enable row level security;
alter table public.deposits enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;
alter table public.requests enable row level security;
alter table public.request_artist_candidates enable row level security;
alter table public.files enable row level security;

-- ---------------------------------------------------------------------------
-- API grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.staff to service_role;
grant select, insert, update, delete on public.staff_permissions to authenticated;
grant select, insert, update, delete on public.staff_permissions to service_role;
grant select, insert, update, delete on public.staff_schedules to authenticated;
grant select, insert, update, delete on public.staff_schedules to service_role;
grant select on public.accounting_users to authenticated;
grant select, insert, update, delete on public.accounting_users to service_role;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.session_entries to authenticated;
grant select, insert, update, delete on public.deposits to authenticated;
grant select, insert, update, delete on public.payouts to authenticated;
grant select, insert, update, delete on public.payout_items to authenticated;
grant select, insert, update, delete on public.requests to authenticated;
grant select, insert, update, delete on public.request_artist_candidates to authenticated;
grant select, insert, update, delete on public.files to authenticated;

grant select on public.accounting_entries to authenticated;

grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_owner_or_admin() to authenticated;
grant execute on function public.is_operations_user() to authenticated;
grant execute on function public.has_staff_permission(text) to authenticated;
grant execute on function public.can_access_accounting() to authenticated;
grant execute on function public.can_access_accounting() to service_role;
grant execute on function public.is_accounting_admin() to authenticated;
grant execute on function public.is_accounting_admin() to service_role;
grant execute on function public.current_staff_id() to authenticated;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_owner_or_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
with check (public.is_owner_or_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

-- Staff and permissions
drop policy if exists "staff_select_authenticated" on public.staff;
create policy "staff_select_authenticated"
on public.staff for select
using (auth.uid() is not null);

drop policy if exists "staff_write_admin" on public.staff;
create policy "staff_write_admin"
on public.staff for all
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "staff_permissions_select_authenticated" on public.staff_permissions;
create policy "staff_permissions_select_authenticated"
on public.staff_permissions for select
using (auth.uid() is not null);

drop policy if exists "staff_permissions_write_admin" on public.staff_permissions;
create policy "staff_permissions_write_admin"
on public.staff_permissions for all
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "staff_schedules_select_authenticated" on public.staff_schedules;
create policy "staff_schedules_select_authenticated"
on public.staff_schedules for select
using (auth.uid() is not null);

drop policy if exists "staff_schedules_write_admin_or_self" on public.staff_schedules;
create policy "staff_schedules_write_admin_or_self"
on public.staff_schedules for all
using (
  public.is_owner_or_admin()
  or staff_id = public.current_staff_id()
)
with check (
  public.is_owner_or_admin()
  or staff_id = public.current_staff_id()
);

drop policy if exists "acct_users_select_own" on public.accounting_users;
create policy "acct_users_select_own"
on public.accounting_users for select
using (profile_id = auth.uid());

drop policy if exists "acct_users_select_admin" on public.accounting_users;
create policy "acct_users_select_admin"
on public.accounting_users for select
using (public.is_accounting_admin());

drop policy if exists "acct_users_no_insert" on public.accounting_users;
create policy "acct_users_no_insert"
on public.accounting_users for insert
with check (false);

drop policy if exists "acct_users_no_update" on public.accounting_users;
create policy "acct_users_no_update"
on public.accounting_users for update
using (false);

drop policy if exists "acct_users_no_delete" on public.accounting_users;
create policy "acct_users_no_delete"
on public.accounting_users for delete
using (false);

-- Operations tables:
-- owner/admin/front_desk can manage shop-wide operational records.
-- artists can only work with assigned records or records they create.
drop policy if exists "customers_authenticated_all" on public.customers;
drop policy if exists "customers_operations_all_artist_assigned_select" on public.customers;
create policy "customers_operations_all_artist_assigned_select"
on public.customers for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or exists (
    select 1
    from public.projects p
    where p.customer_id = customers.id
      and p.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.session_entries se
    where se.customer_id = customers.id
      and se.created_by = auth.uid()
  )
);

drop policy if exists "customers_insert_authenticated" on public.customers;
create policy "customers_insert_authenticated"
on public.customers for insert
with check (auth.uid() is not null);

drop policy if exists "customers_update_operations_or_creator" on public.customers;
create policy "customers_update_operations_or_creator"
on public.customers for update
using (public.is_operations_user() or created_by = auth.uid())
with check (public.is_operations_user() or created_by = auth.uid());

drop policy if exists "customers_delete_operations" on public.customers;
create policy "customers_delete_operations"
on public.customers for delete
using (public.is_operations_user());

drop policy if exists "projects_authenticated_all" on public.projects;
drop policy if exists "projects_operations_all_artist_assigned_select" on public.projects;
create policy "projects_operations_all_artist_assigned_select"
on public.projects for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
);

drop policy if exists "projects_insert_authenticated" on public.projects;
create policy "projects_insert_authenticated"
on public.projects for insert
with check (auth.uid() is not null);

drop policy if exists "projects_update_operations_or_assigned_artist" on public.projects;
create policy "projects_update_operations_or_assigned_artist"
on public.projects for update
using (public.is_operations_user() or artist_id = public.current_staff_id())
with check (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "projects_delete_operations" on public.projects;
create policy "projects_delete_operations"
on public.projects for delete
using (public.is_operations_user());

drop policy if exists "appointments_authenticated_all" on public.appointments;
drop policy if exists "appointments_operations_all_artist_assigned_select" on public.appointments;
create policy "appointments_operations_all_artist_assigned_select"
on public.appointments for select
using (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "appointments_insert_operations" on public.appointments;
create policy "appointments_insert_operations"
on public.appointments for insert
with check (public.is_operations_user());

drop policy if exists "appointments_update_operations_or_assigned_artist" on public.appointments;
create policy "appointments_update_operations_or_assigned_artist"
on public.appointments for update
using (public.is_operations_user() or artist_id = public.current_staff_id())
with check (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "appointments_delete_operations" on public.appointments;
create policy "appointments_delete_operations"
on public.appointments for delete
using (public.is_operations_user());

drop policy if exists "session_entries_authenticated_all" on public.session_entries;
drop policy if exists "session_entries_operations_all_artist_own_select" on public.session_entries;
create policy "session_entries_operations_all_artist_own_select"
on public.session_entries for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

drop policy if exists "session_entries_insert_authenticated_own" on public.session_entries;
create policy "session_entries_insert_authenticated_own"
on public.session_entries for insert
with check (
  auth.uid() is not null
  and (
    public.is_operations_user()
    or artist_id = public.current_staff_id()
    or created_by = auth.uid()
  )
);

drop policy if exists "session_entries_update_operations_or_creator" on public.session_entries;
create policy "session_entries_update_operations_or_creator"
on public.session_entries for update
using (public.is_operations_user() or created_by = auth.uid())
with check (public.is_operations_user() or created_by = auth.uid());

drop policy if exists "session_entries_delete_operations" on public.session_entries;
create policy "session_entries_delete_operations"
on public.session_entries for delete
using (public.is_operations_user());

drop policy if exists "deposits_authenticated_all" on public.deposits;
drop policy if exists "deposits_operations_all_artist_own_select" on public.deposits;
create policy "deposits_operations_all_artist_own_select"
on public.deposits for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

drop policy if exists "deposits_insert_authenticated_own" on public.deposits;
create policy "deposits_insert_authenticated_own"
on public.deposits for insert
with check (
  auth.uid() is not null
  and (
    public.is_operations_user()
    or artist_id = public.current_staff_id()
    or created_by = auth.uid()
  )
);

drop policy if exists "deposits_update_operations_or_creator" on public.deposits;
create policy "deposits_update_operations_or_creator"
on public.deposits for update
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
)
with check (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

create table if not exists public.calendar_feed_tokens (
  scope text primary key,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop policy if exists "deposits_delete_operations" on public.deposits;
create policy "deposits_delete_operations"
on public.deposits for delete
using (public.is_operations_user());

drop policy if exists "requests_authenticated_all" on public.requests;
drop policy if exists "requests_operations_all_artist_assigned_select" on public.requests;
create policy "requests_operations_all_artist_assigned_select"
on public.requests for select
using (
  public.is_operations_user()
  or artist_id = public.current_staff_id()
  or exists (
    select 1
    from public.request_artist_candidates rac
    where rac.request_id = requests.id
      and rac.artist_id = public.current_staff_id()
  )
);

drop policy if exists "requests_insert_operations" on public.requests;
create policy "requests_insert_operations"
on public.requests for insert
with check (public.is_operations_user());

drop policy if exists "requests_update_operations_or_assigned_artist" on public.requests;
create policy "requests_update_operations_or_assigned_artist"
on public.requests for update
using (public.is_operations_user() or artist_id = public.current_staff_id())
with check (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "requests_delete_operations" on public.requests;
create policy "requests_delete_operations"
on public.requests for delete
using (public.is_operations_user());

drop policy if exists "request_artist_candidates_authenticated_all" on public.request_artist_candidates;
drop policy if exists "request_artist_candidates_operations_all_artist_own_select" on public.request_artist_candidates;
create policy "request_artist_candidates_operations_all_artist_own_select"
on public.request_artist_candidates for select
using (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "request_artist_candidates_write_operations" on public.request_artist_candidates;
create policy "request_artist_candidates_write_operations"
on public.request_artist_candidates for all
using (public.is_operations_user())
with check (public.is_operations_user());

drop policy if exists "files_authenticated_all" on public.files;
drop policy if exists "files_operations_all_artist_assigned_select" on public.files;
create policy "files_operations_all_artist_assigned_select"
on public.files for select
using (
  public.is_operations_user()
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.requests r
    where r.id = files.request_id
      and r.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = files.project_id
      and p.artist_id = public.current_staff_id()
  )
);

drop policy if exists "files_insert_authenticated" on public.files;
create policy "files_insert_authenticated"
on public.files for insert
with check (auth.uid() is not null);

drop policy if exists "files_update_operations_or_uploader" on public.files;
create policy "files_update_operations_or_uploader"
on public.files for update
using (public.is_operations_user() or uploaded_by = auth.uid())
with check (public.is_operations_user() or uploaded_by = auth.uid());

drop policy if exists "files_delete_operations" on public.files;
create policy "files_delete_operations"
on public.files for delete
using (public.is_operations_user());

-- Accounting and payout data is restricted to Tattoo Manager owners and
-- active accounting users.
drop policy if exists "payouts_admin_all_artist_select_own" on public.payouts;
drop policy if exists "payouts_admin_select" on public.payouts;
create policy "payouts_admin_select"
on public.payouts for select
using (public.can_access_accounting());

drop policy if exists "payouts_write_admin" on public.payouts;
create policy "payouts_write_admin"
on public.payouts for all
using (public.can_access_accounting())
with check (public.can_access_accounting());

drop policy if exists "payout_items_admin_all_artist_select_own" on public.payout_items;
drop policy if exists "payout_items_admin_select" on public.payout_items;
create policy "payout_items_admin_select"
on public.payout_items for select
using (public.can_access_accounting());

drop policy if exists "payout_items_write_admin" on public.payout_items;
create policy "payout_items_write_admin"
on public.payout_items for all
using (public.can_access_accounting())
with check (public.can_access_accounting());

-- ---------------------------------------------------------------------------
-- Seed reference staff
-- ---------------------------------------------------------------------------

insert into public.staff (display_name, legal_name, role, start_date, active, sort_order)
values
  ('YUSHI', 'Yushi', 'Artist', '2026-01-01', true, 10),
  ('BAKI', 'Baki', 'Artist', '2026-01-01', true, 20),
  ('QSUN', 'Qsun', 'Artist', '2026-01-01', true, 30),
  ('JC', 'JC', 'Artist', '2026-01-01', true, 40),
  ('AIMEE', 'Aimee', 'Artist', '2026-01-01', true, 50),
  ('PHANGS', 'Phangs', 'Artist', '2026-01-01', true, 60),
  ('LESLIE', 'Leslie', 'Artist', '2026-01-01', true, 70)
on conflict do nothing;

insert into public.staff_permissions (staff_id, permission_key, enabled)
select s.id, p.permission_key, true
from public.staff s
cross join (
  values
    ('artistSchedule'),
    ('session'),
    ('deposit')
) as p(permission_key)
where s.role = 'Artist'
on conflict (staff_id, permission_key) do nothing;

insert into public.staff_schedules (staff_id, day_of_week, available, starts_at, ends_at)
select s.id, d.day_of_week, d.available, d.starts_at::time, d.ends_at::time
from public.staff s
cross join (
  values
    (0, false, null, null),
    (1, true, '11:00', '18:00'),
    (2, true, '11:00', '18:00'),
    (3, true, '11:00', '18:00'),
    (4, true, '12:00', '19:00'),
    (5, true, '10:00', '17:00'),
    (6, false, null, null)
) as d(day_of_week, available, starts_at, ends_at)
where s.role = 'Artist'
on conflict (staff_id, day_of_week) do nothing;

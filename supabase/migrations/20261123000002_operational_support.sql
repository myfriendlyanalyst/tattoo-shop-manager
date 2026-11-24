-- FND-01: repository reconstruction candidate, NOT a deployed-schema dump.
-- Fresh disposable Supabase only until live comparison and replay are verified.
-- Historical SQL Editor instructions below are provenance, not deployment instructions.

-- BEGIN legacy source: docs/customer_address_migration.sql
-- Add customer address support for manual project intake.
-- Run in Supabase SQL Editor.

alter table public.customers
  add column if not exists address text;
-- END legacy source: docs/customer_address_migration.sql

-- BEGIN legacy source: docs/customer_phone_normalization.sql
-- Customer phone normalization for safer customer matching.
--
-- Run in Supabase SQL Editor before relying on phone-based customer matching.
-- The original phone value stays in public.customers.phone for display.
-- public.customers.phone_normalized is used only for matching/search.

alter table public.customers
add column if not exists phone_normalized text;

create or replace function public.normalize_customer_phone(phone_value text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  if length(digits) = 10 then
    return '1' || digits;
  end if;

  if length(digits) = 11 and left(digits, 1) = '1' then
    return digits;
  end if;

  return digits;
end;
$$;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_customer_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists set_customer_phone_normalized on public.customers;
create trigger set_customer_phone_normalized
before insert or update of phone on public.customers
for each row
execute function public.set_customer_phone_normalized();

update public.customers
set phone_normalized = public.normalize_customer_phone(phone)
where phone is not null;

create index if not exists idx_customers_phone_normalized
on public.customers(phone_normalized)
where phone_normalized is not null;
-- END legacy source: docs/customer_phone_normalization.sql

-- BEGIN legacy source: docs/staff_password_change_migration.sql
-- ============================================================
-- Staff Password Change Migration
-- Run in Supabase SQL Editor to support first-login password
-- changes for Tattoo Manager staff accounts.
-- ============================================================

alter table public.staff
  add column if not exists must_change_password boolean not null default false;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.staff to service_role;
-- END legacy source: docs/staff_password_change_migration.sql

-- BEGIN legacy source: docs/supabase_staff_invites.sql
-- Staff invite support
-- Run this once in Supabase SQL Editor.

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
with check (public.is_owner_or_admin());
-- END legacy source: docs/supabase_staff_invites.sql

-- BEGIN legacy source: docs/artist_calendar_feed_migration.sql
-- Artist Google Calendar/iCal subscription feed
-- Run this in Supabase SQL Editor before using Artist Settings -> Calendar subscription.

alter table public.staff
  add column if not exists calendar_feed_token text;

update public.staff
set calendar_feed_token = encode(gen_random_bytes(24), 'hex')
where calendar_feed_token is null;

alter table public.staff
  alter column calendar_feed_token set default encode(gen_random_bytes(24), 'hex'),
  alter column calendar_feed_token set not null;

create unique index if not exists staff_calendar_feed_token_key
  on public.staff(calendar_feed_token);

comment on column public.staff.calendar_feed_token is
  'Long random token used by the public iCal feed URL for this staff member.';

create table if not exists public.calendar_feed_tokens (
  scope text primary key,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.calendar_feed_tokens (scope)
values ('shop')
on conflict (scope) do nothing;

comment on table public.calendar_feed_tokens is
  'Read-only public iCal feed tokens. The shop scope exposes all non-cancelled appointments.';
-- END legacy source: docs/artist_calendar_feed_migration.sql

-- BEGIN legacy source: docs/google_calendar_oauth_mvp_migration.sql
-- Google Calendar OAuth MVP
-- Run this in Supabase SQL Editor before enabling direct Google Calendar sync.
-- If artists see appointment insert RLS errors in Calendar, also run
-- docs/artist_calendar_booking_policy.sql.

create table if not exists public.staff_google_calendar_connections (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  google_email text,
  calendar_id text not null default 'primary',
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);

create table if not exists public.appointment_google_calendar_events (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  google_event_id text not null,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);

create index if not exists appointment_google_calendar_events_staff_id_idx
  on public.appointment_google_calendar_events(staff_id);

alter table public.staff_google_calendar_connections enable row level security;
alter table public.appointment_google_calendar_events enable row level security;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.staff_google_calendar_connections
  to service_role;

grant select, insert, update, delete
  on table public.appointment_google_calendar_events
  to service_role;

drop trigger if exists set_staff_google_calendar_connections_updated_at
  on public.staff_google_calendar_connections;
create trigger set_staff_google_calendar_connections_updated_at
before update on public.staff_google_calendar_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_appointment_google_calendar_events_updated_at
  on public.appointment_google_calendar_events;
create trigger set_appointment_google_calendar_events_updated_at
before update on public.appointment_google_calendar_events
for each row execute function public.set_updated_at();

comment on table public.staff_google_calendar_connections is
  'Per-artist Google Calendar OAuth connection. Tokens are read and written only by service-role API routes.';

comment on table public.appointment_google_calendar_events is
  'Maps Oyabun appointments to Google Calendar event ids for direct sync.';
-- END legacy source: docs/google_calendar_oauth_mvp_migration.sql

-- BEGIN legacy source: docs/supabase_appointment_emails.sql
alter table public.appointments
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists cancellation_email_sent_at timestamptz,
  add column if not exists reminder_email_sent_at timestamptz,
  add column if not exists reminder_email_scheduled_at timestamptz,
  add column if not exists reminder_email_provider_id text,
  add column if not exists reminder_email_schedule_status text;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  email_type text not null check (email_type in ('appointment_confirmation', 'appointment_cancellation', 'appointment_reschedule', 'appointment_reminder')),
  to_email text,
  reply_to_email text,
  cc_emails text[],
  subject text,
  status text not null check (status in ('sent', 'scheduled', 'skipped', 'failed', 'cancelled')),
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_logs
  add column if not exists reply_to_email text,
  add column if not exists cc_emails text[];

alter table public.email_logs
  drop constraint if exists email_logs_status_check;

alter table public.email_logs
  add constraint email_logs_status_check
  check (status in ('sent', 'scheduled', 'skipped', 'failed', 'cancelled'));

alter table public.email_logs
  drop constraint if exists email_logs_email_type_check;

alter table public.email_logs
  add constraint email_logs_email_type_check
  check (email_type in ('appointment_confirmation', 'appointment_cancellation', 'appointment_reschedule', 'appointment_reminder'));

alter table public.email_logs enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, update on public.appointments to service_role;
grant select on public.customers to service_role;
grant select on public.projects to service_role;
grant select on public.staff to service_role;
grant insert, select on public.email_logs to authenticated, service_role;

drop policy if exists "Authenticated users can view email logs" on public.email_logs;
create policy "Authenticated users can view email logs"
  on public.email_logs
  for select
  to authenticated
  using (true);
-- END legacy source: docs/supabase_appointment_emails.sql


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

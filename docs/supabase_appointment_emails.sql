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

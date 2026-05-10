alter table public.appointments
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists reminder_email_sent_at timestamptz;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  email_type text not null check (email_type in ('appointment_confirmation', 'appointment_reminder')),
  to_email text,
  subject text,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_logs enable row level security;

drop policy if exists "Authenticated users can view email logs" on public.email_logs;
create policy "Authenticated users can view email logs"
  on public.email_logs
  for select
  to authenticated
  using (true);

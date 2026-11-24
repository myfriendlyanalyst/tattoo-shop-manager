-- SES-01: separate the fact that tattoo work ended from Session Record completion.

alter table public.appointments
  add column session_completed_at timestamptz;

alter table public.session_entries
  add column record_status text not null default 'complete'
  check (record_status in ('draft', 'complete'));

comment on column public.appointments.session_completed_at is
  'Artist-confirmed time when tattoo work ended. Independent of Session Record completion.';
comment on column public.session_entries.record_status is
  'Whether the Session Record is complete. Draft behavior is implemented by SES-02.';

-- Existing Session Records were created only by the old Complete session flow, so they
-- are complete records and prove that their linked tattoo session was also completed.
update public.appointments appointment
set
  session_completed_at = coalesce(
    appointment.session_completed_at,
    linked_session.completed_at,
    appointment.ends_at,
    appointment.updated_at
  ),
  status = 'completed'
from (
  select
    appointment_id,
    max(coalesce(updated_at, created_at, entered_at)) as completed_at
  from public.session_entries
  where appointment_id is not null
  group by appointment_id
) linked_session
where appointment.id = linked_session.appointment_id;

-- Preserve completed Appointments that do not have a linked financial record.
update public.appointments
set session_completed_at = coalesce(ends_at, updated_at, created_at)
where status = 'completed' and session_completed_at is null;

create or replace function public.enforce_session_completion_state()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.session_completed_at is not null then
    if new.status in ('cancelled', 'no_show') then
      raise exception 'A cancelled or no-show Appointment cannot be marked Session complete.'
        using errcode = '23514';
    end if;
    new.status := 'completed';
  elsif new.status = 'completed' then
    raise exception 'Session Completion requires session_completed_at.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.session_completed_at is not null
    and new.session_completed_at is null
    and exists (
      select 1
      from public.session_entries entry
      where entry.appointment_id = old.id and entry.record_status = 'complete'
    ) then
    raise exception 'Session Completion cannot be cleared while a complete Session Record exists.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger appointments_enforce_session_completion
before insert or update of status, session_completed_at on public.appointments
for each row execute function public.enforce_session_completion_state();

create or replace function public.enforce_session_record_completion()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.record_status = 'complete' then
    if new.appointment_id is null or not exists (
      select 1
      from public.appointments appointment
      where appointment.id = new.appointment_id
        and appointment.session_completed_at is not null
    ) then
      raise exception 'A Session Record cannot be completed before Session Completion.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger session_entries_enforce_record_completion
before insert or update of appointment_id, record_status on public.session_entries
for each row execute function public.enforce_session_record_completion();

create index appointments_session_completion_idx
on public.appointments (artist_id, session_completed_at)
where session_completed_at is not null;

create index session_entries_record_status_idx
on public.session_entries (record_status, artist_id, entered_at);

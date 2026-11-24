-- SES-02: allow incomplete Session Records without treating them as financial facts.

alter table public.session_entries
  add column record_completed_at timestamptz,
  add column draft_deposit_applied_amount numeric(10, 2) not null default 0
    check (draft_deposit_applied_amount >= 0);

update public.session_entries
set record_completed_at = coalesce(updated_at, created_at, entered_at)
where record_status = 'complete' and record_completed_at is null;

comment on column public.session_entries.record_completed_at is
  'Time the Draft Session Record passed completion validation. Null while record_status is draft.';
comment on column public.session_entries.draft_deposit_applied_amount is
  'Proposed Deposit application preserved on a draft; it is not a financial application until Record Completion.';

create or replace function public.enforce_session_record_completion()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.record_status = 'draft' then
    new.record_completed_at := null;
    return new;
  end if;

  if new.entry_type <> 'session' then
    raise exception 'Only Session entries use Session Record completion.'
      using errcode = '23514';
  end if;

  if new.appointment_id is null or not exists (
    select 1
    from public.appointments appointment
    where appointment.id = new.appointment_id
      and appointment.session_completed_at is not null
  ) then
    raise exception 'A Session Record cannot be completed before Session Completion.'
      using errcode = '23514';
  end if;

  if coalesce(new.tattoo_amount, 0) <= 0 and coalesce(new.tip_amount, 0) <= 0 then
    raise exception 'A complete Session Record requires a tattoo or tip amount.'
      using errcode = '23514';
  end if;

  if coalesce(new.tattoo_amount, 0) > 0 and new.tattoo_payment_method is null then
    raise exception 'A complete Session Record requires a tattoo Payment Method.'
      using errcode = '23514';
  end if;

  if coalesce(new.tip_amount, 0) > 0 and new.tip_payment_method is null then
    raise exception 'A complete Session Record requires a tip Payment Method.'
      using errcode = '23514';
  end if;

  new.record_completed_at := coalesce(new.record_completed_at, now());
  return new;
end;
$$;

drop trigger if exists session_entries_enforce_record_completion on public.session_entries;
create trigger session_entries_enforce_record_completion
before insert or update of appointment_id, entry_type, record_status, tattoo_amount,
  tattoo_payment_method, tip_amount, tip_payment_method
on public.session_entries
for each row execute function public.enforce_session_record_completion();

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
where se.record_status = 'complete'
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

grant select on public.accounting_entries to authenticated;

create index session_entries_open_drafts_idx
on public.session_entries (artist_id, entered_at, updated_at)
where record_status = 'draft';

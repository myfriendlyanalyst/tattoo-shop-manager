-- SES-03: make each Session Payment an independently dated, classifiable fact.

alter table public.session_payments
  add column app_provider text,
  add column processed_at timestamptz,
  add column card_fee_rate_override numeric(7, 6),
  add column card_fee_override_reason text,
  add column square_transaction_id text;

alter table public.session_payments
  add constraint session_payments_type_check
    check (payment_type in ('tattoo', 'tip', 'merchandise')),
  add constraint session_payments_app_provider_check
    check (app_provider is null or app_provider in ('venmo', 'zelle', 'legacy_unknown')),
  add constraint session_payments_provider_method_check
    check (
      (payment_method = 'app' and app_provider is not null)
      or (payment_method <> 'app' and app_provider is null)
    ) not valid,
  add constraint session_payments_card_fee_override_check
    check (
      (card_fee_rate_override is null and card_fee_override_reason is null and square_transaction_id is null)
      or (
        payment_method = 'credit_card'
        and card_fee_rate_override between 0 and 1
        and nullif(btrim(card_fee_override_reason), '') is not null
        and nullif(btrim(square_transaction_id), '') is not null
      )
    );

alter table public.session_payments
  drop constraint session_payments_payment_type_check;

update public.session_payments payment
set
  app_provider = case when payment.payment_method = 'app' then 'legacy_unknown' else null end,
  processed_at = coalesce(appointment.session_completed_at, entry.updated_at, entry.created_at, entry.entered_at)
from public.session_entries entry
left join public.appointments appointment on appointment.id = entry.appointment_id
where entry.id = payment.session_entry_id;

alter table public.session_payments
  alter column processed_at set not null,
  validate constraint session_payments_provider_method_check;

comment on column public.session_payments.app_provider is
  'Required Venmo or Zelle provider for App Payments. legacy_unknown preserves pre-SES-03 facts until corrected.';
comment on column public.session_payments.processed_at is
  'Actual processing time used for Payment Reconciliation; defaults in the write trigger to Session Completion.';

create index session_payments_processed_at_idx
on public.session_payments (processed_at);

create or replace function public.default_session_payment_facts()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.processed_at is null then
    select coalesce(appointment.session_completed_at, entry.updated_at, entry.created_at, entry.entered_at)
    into new.processed_at
    from public.session_entries entry
    left join public.appointments appointment on appointment.id = entry.appointment_id
    where entry.id = new.session_entry_id;
  end if;

  if new.payment_method = 'app' and new.app_provider not in ('venmo', 'zelle') then
    raise exception 'New App Payments require Venmo or Zelle.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger session_payments_default_facts
before insert or update of session_entry_id, payment_method, app_provider, processed_at
on public.session_payments
for each row execute function public.default_session_payment_facts();

create or replace function public.validate_session_payment_totals(target_session_id uuid)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  entry public.session_entries%rowtype;
  tattoo_paid numeric(10, 2);
  tip_paid numeric(10, 2);
  merchandise_paid numeric(10, 2);
  deposit_applied numeric(10, 2);
begin
  select * into entry from public.session_entries where id = target_session_id;

  select
    coalesce(sum(amount) filter (where payment_type = 'tattoo'), 0),
    coalesce(sum(amount) filter (where payment_type = 'tip'), 0),
    coalesce(sum(amount) filter (where payment_type = 'merchandise'), 0)
  into tattoo_paid, tip_paid, merchandise_paid
  from public.session_payments
  where session_entry_id = target_session_id;

  select coalesce(sum(amount), 0) into deposit_applied
  from public.deposit_applications
  where session_entry_id = target_session_id;

  if tattoo_paid + deposit_applied <> coalesce(entry.tattoo_amount, 0)
    or tip_paid <> coalesce(entry.tip_amount, 0)
    or merchandise_paid <> coalesce(entry.merch_amount, 0) then
    raise exception 'Payment rows and Deposit applications must equal the Session amounts.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.enforce_session_payment_totals_on_completion()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.record_status = 'complete' then
    perform public.validate_session_payment_totals(new.id);
  end if;
  return new;
end;
$$;

create trigger session_entries_validate_payment_totals
after insert or update of record_status, tattoo_amount, tip_amount, merch_amount
on public.session_entries
for each row execute function public.enforce_session_payment_totals_on_completion();

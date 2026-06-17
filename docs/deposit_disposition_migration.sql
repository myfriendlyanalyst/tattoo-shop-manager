-- Deposit disposition migration
-- Run in Supabase SQL Editor before using cancelled-project deposit handling.

alter table public.deposits
  add column if not exists disposition text not null default 'available';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deposits_disposition_check'
      and conrelid = 'public.deposits'::regclass
  ) then
    alter table public.deposits
      add constraint deposits_disposition_check
      check (disposition in ('available', 'applied', 'forfeited', 'refunded'));
  end if;
end $$;

update public.deposits
set disposition = case
  when memo ilike '%[Forfeited]%' then 'forfeited'
  when memo ilike '%[Refunded]%' then 'refunded'
  when available = false then 'applied'
  else 'available'
end
where disposition = 'available';

create index if not exists idx_deposits_disposition on public.deposits(disposition);

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

grant select on public.accounting_entries to authenticated;

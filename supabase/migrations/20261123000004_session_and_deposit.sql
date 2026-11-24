-- FND-01: repository reconstruction candidate, NOT a deployed-schema dump.
-- Fresh disposable Supabase only until live comparison and replay are verified.
-- Historical SQL Editor instructions below are provenance, not deployment instructions.

-- BEGIN legacy source: docs/supabase_session_payments.sql
-- Run this once in Supabase SQL Editor before using split session payments.

create table if not exists public.session_payments (
  id uuid primary key default gen_random_uuid(),
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  payment_type text not null default 'tattoo' check (payment_type in ('tattoo', 'tip')),
  payment_method public.payment_method not null,
  amount numeric(10, 2) not null check (amount > 0),
  memo text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_payments_session_entry_id
on public.session_payments(session_entry_id);

create index if not exists idx_session_payments_type
on public.session_payments(payment_type);

alter table public.session_payments enable row level security;

grant select, insert, update, delete on public.session_payments to authenticated;

drop policy if exists "session_payments_select_related" on public.session_payments;
create policy "session_payments_select_related"
on public.session_payments for select
using (
  public.is_operations_user()
  or exists (
    select 1
    from public.session_entries se
    where se.id = session_payments.session_entry_id
      and (se.artist_id = public.current_staff_id() or se.created_by = auth.uid())
  )
);

drop policy if exists "session_payments_insert_authenticated" on public.session_payments;
create policy "session_payments_insert_authenticated"
on public.session_payments for insert
with check (
  auth.uid() is not null
  and (
    public.is_operations_user()
    or exists (
      select 1
      from public.session_entries se
      where se.id = session_payments.session_entry_id
        and (se.artist_id = public.current_staff_id() or se.created_by = auth.uid())
    )
  )
);

drop policy if exists "session_payments_update_operations_or_creator" on public.session_payments;
create policy "session_payments_update_operations_or_creator"
on public.session_payments for update
using (public.is_operations_user() or created_by = auth.uid())
with check (public.is_operations_user() or created_by = auth.uid());

drop policy if exists "session_payments_delete_operations_or_creator" on public.session_payments;
create policy "session_payments_delete_operations_or_creator"
on public.session_payments for delete
using (public.is_operations_user() or created_by = auth.uid());
-- END legacy source: docs/supabase_session_payments.sql

-- BEGIN legacy source: docs/session_entry_payment_grid_migration.sql
-- Session entry payment grid migration
-- Run in Supabase SQL Editor before using tattoo/tip payment grid and per-artist default duration.

alter table public.session_payments
  add column if not exists payment_type text not null default 'tattoo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'session_payments_payment_type_check'
      and conrelid = 'public.session_payments'::regclass
  ) then
    alter table public.session_payments
      add constraint session_payments_payment_type_check
      check (payment_type in ('tattoo', 'tip'));
  end if;
end $$;

create index if not exists idx_session_payments_type
on public.session_payments(payment_type);

alter table public.staff
  add column if not exists default_session_duration_minutes integer not null default 120;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_default_session_duration_check'
      and conrelid = 'public.staff'::regclass
  ) then
    alter table public.staff
      add constraint staff_default_session_duration_check
      check (default_session_duration_minutes between 30 and 720);
  end if;
end $$;
-- END legacy source: docs/session_entry_payment_grid_migration.sql

-- BEGIN legacy source: docs/supabase_deposit_applications.sql
-- Run this once in Supabase SQL Editor before using partial deposit applications.

create table if not exists public.deposit_applications (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  applied_at timestamptz not null default now(),
  memo text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_deposit_applications_deposit_id
on public.deposit_applications(deposit_id);

create index if not exists idx_deposit_applications_session_entry_id
on public.deposit_applications(session_entry_id);

alter table public.deposit_applications enable row level security;

grant select, insert, update, delete on public.deposit_applications to authenticated;

drop policy if exists "deposit_applications_select_related" on public.deposit_applications;
create policy "deposit_applications_select_related"
on public.deposit_applications for select
using (
  public.is_operations_user()
  or exists (
    select 1
    from public.deposits d
    where d.id = deposit_applications.deposit_id
      and (d.artist_id = public.current_staff_id() or d.created_by = auth.uid())
  )
);

drop policy if exists "deposit_applications_insert_authenticated" on public.deposit_applications;
create policy "deposit_applications_insert_authenticated"
on public.deposit_applications for insert
with check (
  auth.uid() is not null
  and (
    public.is_operations_user()
    or exists (
      select 1
      from public.deposits d
      where d.id = deposit_applications.deposit_id
        and (d.artist_id = public.current_staff_id() or d.created_by = auth.uid())
    )
  )
);

drop policy if exists "deposit_applications_update_operations_or_creator" on public.deposit_applications;
create policy "deposit_applications_update_operations_or_creator"
on public.deposit_applications for update
using (public.is_operations_user() or created_by = auth.uid())
with check (public.is_operations_user() or created_by = auth.uid());

drop policy if exists "deposit_applications_delete_operations_or_creator" on public.deposit_applications;
create policy "deposit_applications_delete_operations_or_creator"
on public.deposit_applications for delete
using (public.is_operations_user() or created_by = auth.uid());
-- END legacy source: docs/supabase_deposit_applications.sql

-- BEGIN legacy source: docs/deposit_disposition_migration.sql
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
-- END legacy source: docs/deposit_disposition_migration.sql


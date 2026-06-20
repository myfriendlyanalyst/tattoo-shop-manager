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

-- FND-01: repository reconstruction candidate, NOT a deployed-schema dump.
-- Fresh disposable Supabase only until live comparison and replay are verified.
-- Historical SQL Editor instructions below are provenance, not deployment instructions.

-- BEGIN legacy source: docs/payout_rate_migration.sql
-- ============================================================
-- Payout Rate Migration
-- Adds per-artist payout_rate (%) to the staff table.
-- Run in the Supabase SQL editor (service role / postgres).
-- ============================================================

-- payout_rate: the percentage of gross the artist keeps.
--   NULL  = no auto-calculation; admin sets adjustment manually.
--   0–100 = e.g. 70 means artist keeps 70%, shop keeps 30%.
--           Adjustment auto-fill = gross * (rate/100 - 1)  [negative = deduction].

alter table public.staff
  add column if not exists payout_rate numeric(5, 2)
    check (payout_rate is null or (payout_rate >= 0 and payout_rate <= 100));

comment on column public.staff.payout_rate is
  'Artist''s share of gross revenue as a percentage (0-100). NULL means no auto-calculation.';
-- END legacy source: docs/payout_rate_migration.sql

-- BEGIN legacy source: docs/supabase_accounting_migration.sql
alter table public.payouts
  add column if not exists adjustment_amount numeric(10, 2) not null default 0,
  add column if not exists adjustment_note   text;

comment on column public.payouts.adjustment_amount is
  'Manual adjustment applied to the gross period total. Negative = deduction (shop cut, fees). Positive = bonus.';
comment on column public.payouts.adjustment_note is
  'Human-readable explanation for the adjustment, shown in the payout detail panel.';
-- END legacy source: docs/supabase_accounting_migration.sql

-- BEGIN legacy source: docs/payout_settlement_migration.sql
-- Payout settlement snapshot fields and duplicate-session protection.
-- Run this file in Supabase SQL Editor before marking a payout Ready.

alter table public.payouts
  add column if not exists calculation_snapshot jsonb,
  add column if not exists snapshot_at timestamptz,
  add column if not exists artist_rate_snapshot numeric(5, 2),
  add column if not exists card_tip_fee_rate_snapshot numeric(5, 2),
  add column if not exists artist_earnings numeric(12, 2),
  add column if not exists settlement_amount numeric(12, 2);

comment on column public.payouts.calculation_snapshot is
  'Immutable source totals and settlement calculation captured when a draft is marked ready.';
comment on column public.payouts.settlement_amount is
  'Positive means the shop pays the artist; negative means the artist pays the shop.';

alter table public.payout_items
  drop constraint if exists payout_items_amount_check;

alter table public.payout_items
  add constraint payout_items_amount_check check (amount <> 0);

create unique index if not exists idx_payout_items_unique_session
on public.payout_items(session_entry_id)
where session_entry_id is not null;

grant select, insert, update on public.payouts to authenticated;
grant select, insert, update, delete on public.payout_items to authenticated;
-- END legacy source: docs/payout_settlement_migration.sql

-- BEGIN legacy source: docs/payout_overlap_guard.sql
-- ============================================================
-- Payout Overlap Guard
-- Prevents overlapping non-void payout periods for the same artist.
-- Run in the Supabase SQL editor.
-- ============================================================

create or replace function public.prevent_overlapping_active_payouts()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'void' and exists (
    select 1
    from public.payouts existing
    where existing.artist_id = new.artist_id
      and existing.id <> new.id
      and existing.status <> 'void'
      and existing.period_start <= new.period_end
      and existing.period_end >= new.period_start
  ) then
    raise exception 'Overlapping payout period exists for this artist.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists payouts_prevent_overlap on public.payouts;

create trigger payouts_prevent_overlap
before insert or update of artist_id, period_start, period_end, status
on public.payouts
for each row
execute function public.prevent_overlapping_active_payouts();
-- END legacy source: docs/payout_overlap_guard.sql


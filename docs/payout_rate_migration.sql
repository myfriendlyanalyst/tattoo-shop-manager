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

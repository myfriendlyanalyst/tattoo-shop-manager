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

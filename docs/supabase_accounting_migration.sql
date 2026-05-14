-- ============================================================
-- Accounting module - migration proposals
-- Status: PROPOSED (not yet applied to production)
--
-- Section 5 is REQUIRED for the Payouts page adjustment feature.
-- All other sections are optional future enhancements.
-- Apply each section independently after review.
-- ============================================================

-- ============================================================
-- SECTION 5 (REQUIRED): Payout adjustment columns
-- Enables the adjustment_amount / adjustment_note fields used
-- by the Payouts detail panel in the accounting app.
-- ============================================================

-- Add adjustment fields to payouts.
-- adjustment_amount: signed numeric - positive = bonus, negative = deduction (shop cut, fees, etc.)
-- adjustment_note: human-readable reason displayed in the UI

alter table public.payouts
  add column if not exists adjustment_amount numeric(10, 2) not null default 0,
  add column if not exists adjustment_note   text;

comment on column public.payouts.adjustment_amount is
  'Manual adjustment applied to the gross period total. Negative = deduction (shop cut, fees). Positive = bonus.';
comment on column public.payouts.adjustment_note is
  'Human-readable explanation for the adjustment, shown in the payout detail panel.';


-- ============================================================
-- SECTION 6 (OPTIONAL): payout_items note column
-- Allows a note per line item when payout_items are used for
-- per-entry snapshots rather than just adjustments.
-- ============================================================

-- alter table public.payout_items
--   add column if not exists note text;


-- ============================================================
-- SECTION 1 (FUTURE): accounting_categories table
-- Allows configurable revenue categories per shop
-- (e.g. "flash", "custom", "coverup", "touch-up").
-- accounting_entries would gain an optional category_id FK.
-- ============================================================

-- create table if not exists public.accounting_categories (
--   id uuid primary key default gen_random_uuid(),
--   name text not null,
--   description text,
--   active boolean not null default true,
--   sort_order integer not null default 0,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   constraint accounting_categories_name_unique unique (name)
-- );
--
-- alter table public.accounting_categories enable row level security;
--
-- -- owner/admin can manage categories
-- create policy "accounting_categories_admin_all"
--   on public.accounting_categories for all
--   using (public.is_owner_or_admin())
--   with check (public.is_owner_or_admin());
--
-- -- all authenticated users can read (for artist entry form dropdown)
-- create policy "accounting_categories_artist_select"
--   on public.accounting_categories for select
--   using (auth.role() = 'authenticated');
--
-- grant select, insert, update, delete on public.accounting_categories to authenticated;
--
-- create trigger set_accounting_categories_updated_at
--   before update on public.accounting_categories
--   for each row execute function public.set_updated_at();
--
-- -- Optional seed:
-- -- insert into public.accounting_categories (name, sort_order) values
-- --   ('Custom', 1), ('Flash', 2), ('Cover-up', 3), ('Touch-up', 4), ('Piercing', 5);


-- ============================================================
-- SECTION 2 (FUTURE): category_id on session_entries
-- Requires SECTION 1 to be applied first.
-- ============================================================

-- alter table public.session_entries
--   add column if not exists category_id uuid
--     references public.accounting_categories(id) on delete set null;
--
-- create index if not exists idx_session_entries_category_id
--   on public.session_entries(category_id);


-- ============================================================
-- SECTION 3 (FUTURE): accounting_entries view with category
-- Extend the view to surface category_name.
-- Apply after SECTION 2 is in place.
-- ============================================================

-- create or replace view public.accounting_entries
-- with (security_invoker = true)
-- as
-- select
--   se.id,
--   se.entered_at,
--   se.entry_type,
--   se.artist_id,
--   st.display_name   as artist_name,
--   se.customer_id,
--   c.name            as customer_name,
--   se.project_id,
--   p.subject         as project_subject,
--   se.tattoo_amount,
--   se.tattoo_payment_method,
--   se.tip_amount,
--   se.tip_payment_method,
--   se.merch_amount,
--   se.merch_payment_method,
--   (se.tattoo_amount + se.tip_amount + se.merch_amount) as total_amount,
--   se.memo,
--   ac.name           as category_name
-- from public.session_entries se
-- left join public.staff       st on st.id = se.artist_id
-- left join public.customers   c  on c.id  = se.customer_id
-- left join public.projects    p  on p.id  = se.project_id
-- left join public.accounting_categories ac on ac.id = se.category_id;


-- ============================================================
-- SECTION 4 (FUTURE): payout_items_detail convenience view
-- Joins payout_items to accounting_entries for easy reporting
-- without N+1 queries.
-- ============================================================

-- create or replace view public.payout_items_detail as
-- select
--   pi.id,
--   pi.payout_id,
--   pi.amount,
--   pi.item_type,
--   pi.note,
--   pi.session_entry_id,
--   pi.deposit_id,
--   ae.entered_at,
--   ae.customer_name,
--   ae.project_subject,
--   ae.entry_type,
--   ae.tattoo_amount,
--   ae.tip_amount,
--   ae.total_amount,
--   ae.artist_name
-- from public.payout_items pi
-- left join public.accounting_entries ae on ae.id = pi.session_entry_id;


-- ============================================================
-- ARTIST READ-ONLY ACCESS (discussion, not yet decided)
-- Currently payouts are owner/admin only. If artists should be
-- able to view their own payout history (read-only), replace
-- the payouts_admin_select policy with:
--
-- drop policy if exists "payouts_admin_select" on public.payouts;
-- create policy "payouts_select_admin_or_own"
--   on public.payouts for select
--   using (
--     public.is_owner_or_admin()
--     or artist_id = public.current_staff_id()
--   );
--
-- Write (insert/update/delete) remains owner/admin only via
-- the existing "payouts_write_admin" policy.
-- ============================================================

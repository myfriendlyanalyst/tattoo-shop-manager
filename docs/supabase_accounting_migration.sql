-- ============================================================
-- Accounting module — future migration proposals
-- Status: PROPOSED (not yet applied)
-- Apply only after review; each block is independent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. accounting_categories
--    Allows configurable revenue categories per shop
--    (e.g. "flash", "custom", "coverup", "touch-up").
--    accounting_entries would gain an optional category_id FK.
-- ------------------------------------------------------------

create table if not exists public.accounting_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_categories_name_unique unique (name)
);

alter table public.accounting_categories enable row level security;

create policy "accounting_categories_admin_all"
  on public.accounting_categories for all
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

-- Artists (non-admin) can read categories when filling entries
create policy "accounting_categories_artist_select"
  on public.accounting_categories for select
  using (auth.role() = 'authenticated');

grant select, insert, update, delete on public.accounting_categories to authenticated;

create trigger set_accounting_categories_updated_at
  before update on public.accounting_categories
  for each row execute function public.set_updated_at();

-- Optional: seed some default categories
-- insert into public.accounting_categories (name, sort_order) values
--   ('Custom', 1),
--   ('Flash', 2),
--   ('Cover-up', 3),
--   ('Touch-up', 4),
--   ('Piercing', 5);


-- ------------------------------------------------------------
-- 2. category_id column on session_entries
--    Adds optional category reference to individual entries.
-- ------------------------------------------------------------

-- alter table public.session_entries
--   add column if not exists category_id uuid references public.accounting_categories(id) on delete set null;

-- create index if not exists idx_session_entries_category_id
--   on public.session_entries(category_id);


-- ------------------------------------------------------------
-- 3. accounting_entries view — add category_name
--    Extend the existing view to surface category name.
--    Run this after adding category_id to session_entries.
-- ------------------------------------------------------------

-- create or replace view public.accounting_entries as
-- select
--   se.id,
--   se.entered_at,
--   se.entry_type,
--   se.artist_id,
--   st.display_name   as artist_name,
--   c.name            as customer_name,
--   p.subject         as project_subject,
--   se.tattoo_amount,
--   se.tip_amount,
--   se.merch_amount,
--   (se.tattoo_amount + se.tip_amount + se.merch_amount) as total_amount,
--   se.tattoo_payment_method,
--   se.tip_payment_method,
--   se.merch_payment_method,
--   se.memo,
--   ac.name           as category_name
-- from public.session_entries se
-- left join public.staff       st on st.id = se.artist_id
-- left join public.customers   c  on c.id  = se.customer_id
-- left join public.projects    p  on p.id  = se.project_id
-- left join public.accounting_categories ac on ac.id = se.category_id;


-- ------------------------------------------------------------
-- 4. payout_items — computed amount helper view
--    Convenience view joining payout_items back to entries
--    so payouts page can show itemised totals without N+1 queries.
-- ------------------------------------------------------------

-- create or replace view public.payout_items_detail as
-- select
--   pi.id,
--   pi.payout_id,
--   pi.amount,
--   pi.session_entry_id,
--   pi.deposit_id,
--   ae.entered_at,
--   ae.customer_name,
--   ae.project_subject,
--   ae.entry_type,
--   ae.tattoo_amount,
--   ae.tip_amount,
--   ae.total_amount
-- from public.payout_items pi
-- left join public.accounting_entries ae on ae.id = pi.session_entry_id;

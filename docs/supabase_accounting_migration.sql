-- ============================================================
-- Accounting module - migration proposals
-- Status: PROPOSED (not yet applied to production)
--
-- Section 5 is REQUIRED for the Payouts page adjustment feature.
-- Section 6 is REQUIRED for permission-based accounting access.
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
-- SECTION 6 (REQUIRED): Permission-based accounting access
-- Aligns Supabase RLS with the app rule:
--   owner role -> always allowed
--   every other role -> active staff + accountingAccess=true
-- ============================================================

create or replace function public.has_staff_permission(required_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.staff s
      join public.staff_permissions sp on sp.staff_id = s.id
      where s.profile_id = auth.uid()
        and s.active = true
        and sp.permission_key = required_key
        and sp.enabled = true
    ),
    false
  )
$$;

create or replace function public.can_access_accounting()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.current_user_role() = 'owner'
    or public.has_staff_permission('accountingAccess'),
    false
  )
$$;

grant execute on function public.has_staff_permission(text) to authenticated;
grant execute on function public.can_access_accounting() to authenticated;

drop policy if exists "customers_operations_all_artist_assigned_select" on public.customers;
create policy "customers_operations_all_artist_assigned_select"
on public.customers for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or exists (
    select 1
    from public.projects p
    where p.customer_id = customers.id
      and p.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.session_entries se
    where se.customer_id = customers.id
      and se.created_by = auth.uid()
  )
);

drop policy if exists "projects_operations_all_artist_assigned_select" on public.projects;
create policy "projects_operations_all_artist_assigned_select"
on public.projects for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
);

drop policy if exists "session_entries_operations_all_artist_own_select" on public.session_entries;
create policy "session_entries_operations_all_artist_own_select"
on public.session_entries for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

drop policy if exists "deposits_operations_all_artist_own_select" on public.deposits;
create policy "deposits_operations_all_artist_own_select"
on public.deposits for select
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

drop policy if exists "deposits_update_operations_or_creator" on public.deposits;
create policy "deposits_update_operations_or_creator"
on public.deposits for update
using (public.is_operations_user() or public.can_access_accounting() or created_by = auth.uid())
with check (public.is_operations_user() or public.can_access_accounting() or created_by = auth.uid());

drop policy if exists "payouts_admin_select" on public.payouts;
create policy "payouts_admin_select"
on public.payouts for select
using (public.can_access_accounting());

drop policy if exists "payouts_write_admin" on public.payouts;
create policy "payouts_write_admin"
on public.payouts for all
using (public.can_access_accounting())
with check (public.can_access_accounting());

drop policy if exists "payout_items_admin_select" on public.payout_items;
create policy "payout_items_admin_select"
on public.payout_items for select
using (public.can_access_accounting());

drop policy if exists "payout_items_write_admin" on public.payout_items;
create policy "payout_items_write_admin"
on public.payout_items for all
using (public.can_access_accounting())
with check (public.can_access_accounting());


-- ============================================================
-- SECTION 7 (OPTIONAL): payout_items note column
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
-- Currently payouts are owner/accountingAccess only. If artists without
-- accountingAccess should be able to view their own payout history
-- (read-only), replace the payouts_admin_select policy with:
--
-- drop policy if exists "payouts_admin_select" on public.payouts;
-- create policy "payouts_select_admin_or_own"
--   on public.payouts for select
--   using (
--     public.can_access_accounting()
--     or artist_id = public.current_staff_id()
--   );
--
-- Write (insert/update/delete) remains owner/accountingAccess only via
-- the existing "payouts_write_admin" policy.
-- ============================================================

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

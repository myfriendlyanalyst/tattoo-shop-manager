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

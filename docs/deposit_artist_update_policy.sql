-- ============================================================
-- Deposit Artist Update Policy
-- Run in Supabase SQL Editor if artist session entry with deposit
-- application fails with:
--   Cannot coerce the result to a single JSON object
-- ============================================================

drop policy if exists "deposits_update_operations_or_creator" on public.deposits;
create policy "deposits_update_operations_or_creator"
on public.deposits for update
using (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
)
with check (
  public.is_operations_user()
  or public.can_access_accounting()
  or artist_id = public.current_staff_id()
  or created_by = auth.uid()
);

-- Staff invite support
-- Run this once in Supabase SQL Editor.

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
with check (public.is_owner_or_admin());

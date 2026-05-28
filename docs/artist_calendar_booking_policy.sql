-- Allow artists to schedule appointments for their own projects.
-- Run in Supabase SQL Editor after artist_scope_hardening.sql if artists see
-- row-level security errors when saving an appointment from Calendar.

drop policy if exists "appointments_insert_operations" on public.appointments;
drop policy if exists "appointments_insert_operations_or_assigned_artist" on public.appointments;

create policy "appointments_insert_operations_or_assigned_artist"
on public.appointments for insert
with check (
  public.is_operations_user()
  or (
    artist_id = public.current_staff_id()
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.artist_id = public.current_staff_id()
    )
  )
);

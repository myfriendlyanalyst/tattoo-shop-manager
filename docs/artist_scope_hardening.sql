-- ============================================================
-- Artist Scope Hardening
-- Run in Supabase SQL Editor to make artist accounts see only
-- assigned operational records at the database layer.
-- ============================================================

create or replace function public.current_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.staff where profile_id = auth.uid()
$$;

grant execute on function public.current_staff_id() to authenticated;

drop policy if exists "requests_authenticated_all" on public.requests;
drop policy if exists "requests_operations_all_artist_assigned_select" on public.requests;
create policy "requests_operations_all_artist_assigned_select"
on public.requests for select
using (
  public.is_operations_user()
  or artist_id = public.current_staff_id()
  or exists (
    select 1
    from public.request_artist_candidates rac
    where rac.request_id = requests.id
      and rac.artist_id = public.current_staff_id()
  )
);

drop policy if exists "requests_insert_operations" on public.requests;
create policy "requests_insert_operations"
on public.requests for insert
with check (public.is_operations_user());

drop policy if exists "requests_update_operations_or_assigned_artist" on public.requests;
create policy "requests_update_operations_or_assigned_artist"
on public.requests for update
using (public.is_operations_user() or artist_id = public.current_staff_id())
with check (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "requests_delete_operations" on public.requests;
create policy "requests_delete_operations"
on public.requests for delete
using (public.is_operations_user());

drop policy if exists "request_artist_candidates_authenticated_all" on public.request_artist_candidates;
drop policy if exists "request_artist_candidates_operations_all_artist_own_select" on public.request_artist_candidates;
create policy "request_artist_candidates_operations_all_artist_own_select"
on public.request_artist_candidates for select
using (public.is_operations_user() or artist_id = public.current_staff_id());

drop policy if exists "request_artist_candidates_write_operations" on public.request_artist_candidates;
create policy "request_artist_candidates_write_operations"
on public.request_artist_candidates for all
using (public.is_operations_user())
with check (public.is_operations_user());

drop policy if exists "files_authenticated_all" on public.files;
drop policy if exists "files_operations_all_artist_assigned_select" on public.files;
create policy "files_operations_all_artist_assigned_select"
on public.files for select
using (
  public.is_operations_user()
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.requests r
    where r.id = files.request_id
      and r.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = files.project_id
      and p.artist_id = public.current_staff_id()
  )
);

drop policy if exists "files_insert_authenticated" on public.files;
create policy "files_insert_authenticated"
on public.files for insert
with check (auth.uid() is not null);

drop policy if exists "files_update_operations_or_uploader" on public.files;
create policy "files_update_operations_or_uploader"
on public.files for update
using (public.is_operations_user() or uploaded_by = auth.uid())
with check (public.is_operations_user() or uploaded_by = auth.uid());

drop policy if exists "files_delete_operations" on public.files;
create policy "files_delete_operations"
on public.files for delete
using (public.is_operations_user());

-- Run this once in Supabase SQL Editor to store request reference images
-- in Supabase Storage. The app uploads files to this bucket, then records
-- metadata in public.files with file_type = 'reference'.

insert into storage.buckets (id, name, public)
values ('request-references', 'request-references', false)
on conflict (id) do update
set public = false;

drop policy if exists "request_references_select_authenticated"
on storage.objects;

create policy "request_references_select_authenticated"
on storage.objects for select
using (
  bucket_id = 'request-references'
  and auth.role() = 'authenticated'
);

drop policy if exists "request_references_insert_authenticated"
on storage.objects;

create policy "request_references_insert_authenticated"
on storage.objects for insert
with check (
  bucket_id = 'request-references'
  and auth.role() = 'authenticated'
);

drop policy if exists "request_references_update_authenticated"
on storage.objects;

create policy "request_references_update_authenticated"
on storage.objects for update
using (
  bucket_id = 'request-references'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'request-references'
  and auth.role() = 'authenticated'
);

drop policy if exists "request_references_delete_authenticated"
on storage.objects;

create policy "request_references_delete_authenticated"
on storage.objects for delete
using (
  bucket_id = 'request-references'
  and auth.role() = 'authenticated'
);

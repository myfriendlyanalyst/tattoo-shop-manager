-- FND-01: repository reconstruction candidate, NOT a deployed-schema dump.
-- Fresh disposable Supabase only until live comparison and replay are verified.
-- Historical SQL Editor instructions below are provenance, not deployment instructions.

-- BEGIN legacy source: docs/supabase_request_form_columns.sql
-- Run this in Supabase SQL Editor before Make.com starts inserting Webflow
-- request form data. It separates Webflow form fields into structured columns.

alter table public.requests
add column if not exists tattoo_description text,
add column if not exists approximate_size text,
add column if not exists placement text,
add column if not exists reference_image_url text,
add column if not exists requested_artist_label text,
add column if not exists how_did_you_hear_about_us text,
add column if not exists tattoo_timing_preference text,
add column if not exists preferred_appointment_date date,
add column if not exists age_confirmed boolean not null default false;

create index if not exists idx_requests_requested_artist_label
on public.requests(requested_artist_label);

create index if not exists idx_requests_preferred_appointment_date
on public.requests(preferred_appointment_date);

alter table public.requests
drop constraint if exists requests_tattoo_timing_preference_check;

alter table public.requests
add constraint requests_tattoo_timing_preference_check
check (
  tattoo_timing_preference is null
  or tattoo_timing_preference in ('asap', 'within_1_2_weeks', 'flexible', 'preferred_date')
);

comment on column public.requests.tattoo_description is
'Original tattoo description submitted through the Webflow request form.';

comment on column public.requests.approximate_size is
'Approximate tattoo size submitted through the Webflow request form.';

comment on column public.requests.placement is
'Body placement submitted through the Webflow request form.';

comment on column public.requests.reference_image_url is
'Reference image URL captured from Webflow/Make.com. Supabase Storage can be added later.';

comment on column public.requests.requested_artist_label is
'Raw artist dropdown label submitted from Webflow, such as Any available artist, YUSHI, BAKI, JC, or Phangs.';

comment on column public.requests.how_did_you_hear_about_us is
'How the client heard about Oyabun Tattoo, captured from the Webflow request form.';

comment on column public.requests.tattoo_timing_preference is
'When the client says they would like to get tattooed: asap, within_1_2_weeks, flexible, or preferred_date.';

comment on column public.requests.preferred_appointment_date is
'Optional exact date requested by the client. This is not a confirmed booking.';

comment on column public.requests.age_confirmed is
'Whether the client confirmed they are 18 years or older.';
-- END legacy source: docs/supabase_request_form_columns.sql

-- BEGIN legacy source: docs/supabase_request_conversion_and_waiver.sql
-- Run this once in Supabase SQL Editor.
-- It makes Request -> Project conversion idempotent and adds a small in-app
-- waiver workflow foundation to projects.

alter table public.requests
add column if not exists project_id uuid references public.projects(id) on delete set null;

create unique index if not exists idx_requests_project_id_unique
on public.requests(project_id)
where project_id is not null;

alter table public.projects
add column if not exists waiver_status text not null default 'missing' check (
  waiver_status in ('missing', 'sent', 'signed')
),
add column if not exists waiver_sent_at timestamptz,
add column if not exists waiver_signed_at timestamptz;

update public.projects
set
  waiver_status = case when waiver_signed then 'signed' else waiver_status end,
  waiver_signed_at = case
    when waiver_signed and waiver_signed_at is null then updated_at
    else waiver_signed_at
  end;

create index if not exists idx_projects_waiver_status
on public.projects(waiver_status);
-- END legacy source: docs/supabase_request_conversion_and_waiver.sql

-- BEGIN legacy source: docs/request_email_tracking_migration.sql
-- ============================================================
-- Request Email Tracking
-- Run this in Supabase SQL Editor before enabling the Make.com
-- Gmail watcher webhook.
-- ============================================================

alter table public.requests
add column if not exists external_source text,
add column if not exists external_id text,
add column if not exists gmail_thread_id text,
add column if not exists gmail_message_id text,
add column if not exists source_email_subject text,
add column if not exists source_email_from text,
add column if not exists source_email_to text;

create unique index if not exists idx_requests_external_source_id
on public.requests(external_source, external_id)
where external_source is not null and external_id is not null;

create index if not exists idx_requests_gmail_thread_id
on public.requests(gmail_thread_id)
where gmail_thread_id is not null;

create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  provider text not null default 'gmail',
  provider_thread_id text,
  provider_message_id text,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  snippet text,
  sent_at timestamptz,
  received_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_request_messages_provider_message
on public.request_messages(provider, provider_message_id)
where provider_message_id is not null;

create index if not exists idx_request_messages_request_id_received_at
on public.request_messages(request_id, received_at desc);

drop trigger if exists set_request_messages_updated_at on public.request_messages;
create trigger set_request_messages_updated_at
before update on public.request_messages
for each row execute function public.set_updated_at();

alter table public.request_messages enable row level security;

grant select, insert, update, delete on public.request_messages to authenticated;

drop policy if exists "request_messages_operations_all_artist_assigned_select"
on public.request_messages;
create policy "request_messages_operations_all_artist_assigned_select"
on public.request_messages for select
using (
  public.is_operations_user()
  or exists (
    select 1
    from public.requests r
    where r.id = request_messages.request_id
      and r.artist_id = public.current_staff_id()
  )
  or exists (
    select 1
    from public.request_artist_candidates rac
    where rac.request_id = request_messages.request_id
      and rac.artist_id = public.current_staff_id()
  )
);

drop policy if exists "request_messages_write_operations"
on public.request_messages;
create policy "request_messages_write_operations"
on public.request_messages for all
using (public.is_operations_user())
with check (public.is_operations_user());

comment on table public.request_messages is
'Read-only email timeline records captured from Gmail/Make.com for request tracking.';

comment on column public.requests.gmail_thread_id is
'Gmail thread id used to keep future replies attached to the same request.';

comment on column public.request_messages.provider_message_id is
'Provider message id for idempotent webhook inserts.';
-- END legacy source: docs/request_email_tracking_migration.sql

-- BEGIN legacy source: docs/request_number_and_artist_forwarding.sql
-- ============================================================
-- Request Number + Artist Forwarding Support
-- Run this in Supabase SQL Editor before testing artist-forward
-- email automation.
-- ============================================================

create sequence if not exists public.request_number_seq start with 1;

alter table public.requests
add column if not exists request_number bigint;

with numbered as (
  select
    id,
    row_number() over (order by received_at, created_at, id) as row_number
  from public.requests
  where request_number is null
)
update public.requests r
set request_number = numbered.row_number
from numbered
where r.id = numbered.id;

select setval(
  'public.request_number_seq',
  greatest(
    coalesce((select max(request_number) from public.requests), 0),
    1
  ),
  true
);

alter table public.requests
alter column request_number set default nextval('public.request_number_seq');

create unique index if not exists idx_requests_request_number
on public.requests(request_number);

grant usage, select on sequence public.request_number_seq to authenticated, service_role;
grant select, update on public.requests to service_role;
grant select on public.staff to service_role;
grant insert, select on public.request_messages to service_role;

comment on column public.requests.request_number is
'Short sequential request number displayed as REQ-00001 in emails and UI.';
-- END legacy source: docs/request_number_and_artist_forwarding.sql

-- BEGIN legacy source: docs/artist_accept_draft_flow.sql
-- ============================================================
-- Artist Accept Draft Flow
-- Run this in Supabase SQL Editor before testing artist Accept
-- buttons and client draft sending.
-- ============================================================

alter table public.staff
add column if not exists artist_accept_template text;

create table if not exists public.request_artist_action_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  artist_id uuid not null references public.staff(id) on delete cascade,
  token text not null unique,
  purpose text not null default 'artist_response'
    check (purpose in ('artist_response')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_artist_action_tokens_request_id
on public.request_artist_action_tokens(request_id);

create index if not exists idx_request_artist_action_tokens_token
on public.request_artist_action_tokens(token);

alter table public.request_artist_action_tokens enable row level security;

grant select, insert, update on public.request_artist_action_tokens to service_role;
grant select, update on public.requests to service_role;
grant select, update on public.staff to service_role;
grant insert, select on public.request_messages to service_role;

comment on table public.request_artist_action_tokens is
'One-time secure links for artists to accept/pass requests and draft client replies.';

comment on column public.staff.artist_accept_template is
'Default artist-specific client reply text inserted into Accept draft emails.';
-- END legacy source: docs/artist_accept_draft_flow.sql

-- BEGIN legacy source: docs/request_client_actions.sql
-- ============================================================
-- Client Request Action Links
-- Run this in Supabase SQL Editor before testing client email
-- buttons for "Request another artist" and "Close this request".
-- ============================================================

alter type public.request_status
add value if not exists 'client_declined';

create table if not exists public.request_client_action_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  artist_id uuid references public.staff(id) on delete set null,
  token text not null unique,
  purpose text not null default 'client_action'
    check (purpose in ('client_action')),
  expires_at timestamptz not null default (now() + interval '90 days'),
  used_at timestamptz,
  used_action text check (used_action in ('request_reassignment', 'close_request')),
  created_at timestamptz not null default now()
);

create index if not exists idx_request_client_action_tokens_request_id
on public.request_client_action_tokens(request_id);

create index if not exists idx_request_client_action_tokens_token
on public.request_client_action_tokens(token);

alter table public.request_client_action_tokens enable row level security;

grant select, insert, update on public.request_client_action_tokens to service_role;
grant select, update on public.requests to service_role;
grant select on public.staff to service_role;
grant insert, select on public.request_messages to service_role;

comment on table public.request_client_action_tokens is
'One-time secure links for clients to request reassignment or close a tattoo request.';
-- END legacy source: docs/request_client_actions.sql

-- BEGIN legacy source: docs/supabase_request_reference_storage.sql
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
-- END legacy source: docs/supabase_request_reference_storage.sql


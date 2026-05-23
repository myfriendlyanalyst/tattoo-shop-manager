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

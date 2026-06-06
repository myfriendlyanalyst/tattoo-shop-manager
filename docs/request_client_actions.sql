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

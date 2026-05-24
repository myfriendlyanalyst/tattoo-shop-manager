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

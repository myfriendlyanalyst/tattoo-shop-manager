-- Run this in Supabase SQL Editor to support artist candidate assignment
-- for website/email requests.

create table if not exists public.request_artist_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  artist_id uuid not null references public.staff(id) on delete cascade,
  status text not null default 'sent' check (
    status in ('sent', 'interested', 'passed', 'selected', 'declined')
  ),
  responded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, artist_id)
);

create index if not exists idx_request_artist_candidates_request_id
on public.request_artist_candidates(request_id);

create index if not exists idx_request_artist_candidates_artist_id
on public.request_artist_candidates(artist_id);

drop trigger if exists set_request_artist_candidates_updated_at
on public.request_artist_candidates;

create trigger set_request_artist_candidates_updated_at
before update on public.request_artist_candidates
for each row execute function public.set_updated_at();

alter table public.request_artist_candidates enable row level security;

grant select, insert, update, delete on public.request_artist_candidates to authenticated;

drop policy if exists "request_artist_candidates_authenticated_all"
on public.request_artist_candidates;

create policy "request_artist_candidates_authenticated_all"
on public.request_artist_candidates for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

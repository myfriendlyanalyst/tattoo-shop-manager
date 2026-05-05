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

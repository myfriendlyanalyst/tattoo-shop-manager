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

-- Artist Google Calendar/iCal subscription feed
-- Run this in Supabase SQL Editor before using Artist Settings -> Calendar subscription.

alter table public.staff
  add column if not exists calendar_feed_token text;

update public.staff
set calendar_feed_token = encode(gen_random_bytes(24), 'hex')
where calendar_feed_token is null;

alter table public.staff
  alter column calendar_feed_token set default encode(gen_random_bytes(24), 'hex'),
  alter column calendar_feed_token set not null;

create unique index if not exists staff_calendar_feed_token_key
  on public.staff(calendar_feed_token);

comment on column public.staff.calendar_feed_token is
  'Long random token used by the public iCal feed URL for this staff member.';

create table if not exists public.calendar_feed_tokens (
  scope text primary key,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.calendar_feed_tokens (scope)
values ('shop')
on conflict (scope) do nothing;

comment on table public.calendar_feed_tokens is
  'Read-only public iCal feed tokens. The shop scope exposes all non-cancelled appointments.';

-- Add customer address support for manual project intake.
-- Run in Supabase SQL Editor.

alter table public.customers
  add column if not exists address text;


-- Run this in Supabase SQL Editor after adding the Webflow form field:
-- "How did you hear about us?"

alter table public.requests
add column if not exists how_did_you_hear_about_us text;

comment on column public.requests.how_did_you_hear_about_us is
'How the client heard about Oyabun Tattoo, captured from the Webflow request form.';

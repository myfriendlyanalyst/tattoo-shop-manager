-- Run this in Supabase SQL Editor before Make.com starts inserting Webflow
-- request form data. It separates Webflow form fields into structured columns.

alter table public.requests
add column if not exists tattoo_description text,
add column if not exists approximate_size text,
add column if not exists placement text,
add column if not exists reference_image_url text,
add column if not exists requested_artist_label text,
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

comment on column public.requests.tattoo_timing_preference is
'When the client says they would like to get tattooed: asap, within_1_2_weeks, flexible, or preferred_date.';

comment on column public.requests.preferred_appointment_date is
'Optional exact date requested by the client. This is not a confirmed booking.';

comment on column public.requests.age_confirmed is
'Whether the client confirmed they are 18 years or older.';

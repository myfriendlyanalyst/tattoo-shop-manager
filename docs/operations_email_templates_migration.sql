-- Operations email templates
-- Run in Supabase SQL Editor before using Settings > Email templates.

create table if not exists public.operations_email_templates (
  template_key text primary key,
  subject text not null,
  body_html text not null,
  enabled boolean not null default true,
  test_mode boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.operations_email_templates enable row level security;

grant usage on schema public to authenticated, service_role;
grant select on public.operations_email_templates to authenticated;
grant select, insert, update, delete on public.operations_email_templates to service_role;

drop policy if exists "Operations email templates are read by operations admins" on public.operations_email_templates;
create policy "Operations email templates are read by operations admins"
  on public.operations_email_templates
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'admin')
    )
  );

drop policy if exists "Operations email templates are managed by operations admins" on public.operations_email_templates;
create policy "Operations email templates are managed by operations admins"
  on public.operations_email_templates
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'admin')
    )
  );

insert into public.operations_email_templates
  (template_key, subject, body_html, enabled, test_mode)
values
  (
    'request_auto_reply',
    'We received your tattoo request',
    '<p>Hi {{customerName}},</p><p>Thanks for reaching out to Oyabun Tattoo. We received your tattoo request and our team will review it shortly.</p><p>{{artistPreferenceMessage}}</p>{{requestSummaryHtml}}<p><strong>We usually reply within 1-2 business days.</strong></p><p>No artist, price, or appointment time has been confirmed yet. We will review your idea first and contact you with the next step.</p><p>If we need more details before assigning an artist or sending next steps, we will contact you by email.</p><p>Thank you,<br>Oyabun Tattoo</p>',
    false,
    true
  ),
  (
    'appointment_confirmation_1',
    'Appointment confirmed: {{projectName}}',
    '<p>Hi {{customerName}},</p><p>Your appointment has been confirmed. Please review your appointment details, deposit policy, and preparation notes before your visit.</p><p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p><p>Before your appointment, please eat, hydrate, and avoid alcohol. Wear comfortable clothing that gives access to the tattoo placement.</p><p>If you need to make changes, please reply to this email.</p>',
    true,
    false
  ),
  (
    'appointment_confirmation_2',
    'Next appointment confirmed: {{projectName}}',
    '<p>Hi {{customerName}},</p><p>Your next appointment has been confirmed.</p><p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p><p>Please continue following your artist''s preparation and aftercare guidance between sessions.</p><p>If you need to make changes, please reply to this email.</p>',
    true,
    false
  ),
  (
    'appointment_reschedule',
    'Appointment rescheduled: {{projectName}}',
    '<p>Hi {{customerName}},</p><p>Your tattoo appointment has been rescheduled.</p><p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Previous appointment:</strong> {{oldAppointmentTime}}<br><strong>New appointment:</strong> {{newAppointmentTime}}</p><p>If you have questions or need another change, please reply to this email.</p>',
    true,
    false
  ),
  (
    'appointment_cancellation',
    'Appointment cancelled: {{projectName}}',
    '<p>Hi {{customerName}},</p><p>Your tattoo appointment has been cancelled.</p><p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Original appointment:</strong> {{appointmentTime}}</p><p>If you have questions or need to reschedule, please reply to this email.</p>',
    true,
    false
  ),
  (
    'appointment_reminder',
    'Appointment reminder: {{projectName}}',
    '<p>Hi {{customerName}},</p><p>This is a reminder for your tattoo appointment tomorrow.</p><p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p><p>Please eat beforehand, hydrate, and arrive prepared for your session.</p><p>If you need to make changes, please reply to this email as soon as possible.</p>',
    true,
    false
  )
on conflict (template_key) do nothing;

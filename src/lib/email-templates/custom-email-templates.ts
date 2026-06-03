export type OperationsEmailTemplateKey =
  | "request_auto_reply"
  | "appointment_confirmation_1"
  | "appointment_confirmation_2"
  | "appointment_reschedule"
  | "appointment_cancellation"
  | "appointment_reminder";

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export type OperationsEmailTemplate = {
  key: OperationsEmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  html: string;
  enabled: boolean;
  testMode: boolean;
};

export const templateVariables = [
  "customerName",
  "projectName",
  "artistName",
  "appointmentTime",
  "oldAppointmentTime",
  "newAppointmentTime",
  "artistPreference",
] as const;

export const defaultOperationsEmailTemplates: OperationsEmailTemplate[] = [
  {
    key: "request_auto_reply",
    name: "Request auto reply",
    description: "Sent after a new Webflow request is received. Kept in test mode until approved.",
    subject: "We received your tattoo request",
    enabled: false,
    testMode: true,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Thanks for reaching out to Oyabun Tattoo. We received your tattoo request and our team will review it shortly.</p>
      <p><strong>We usually reply within 2 business days.</strong> If we need more details, we will contact you by email.</p>
      <p><strong>Artist preference:</strong> {{artistPreference}}</p>
      <p>Thank you,<br>Oyabun Tattoo</p>
    `.trim(),
  },
  {
    key: "appointment_confirmation_1",
    name: "First appointment confirmation",
    description: "Sent when the first appointment for a project is booked.",
    subject: "Appointment confirmed: {{projectName}}",
    enabled: true,
    testMode: false,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your appointment has been confirmed. Please review your appointment details, deposit policy, and preparation notes before your visit.</p>
      <p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
      <p>Before your appointment, please eat, hydrate, and avoid alcohol. Wear comfortable clothing that gives access to the tattoo placement.</p>
      <p>If you need to make changes, please reply to this email.</p>
    `.trim(),
  },
  {
    key: "appointment_confirmation_2",
    name: "Next appointment confirmation",
    description: "Sent when another appointment is booked for an existing project.",
    subject: "Next appointment confirmed: {{projectName}}",
    enabled: true,
    testMode: false,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your next appointment has been confirmed.</p>
      <p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
      <p>Please continue following your artist's preparation and aftercare guidance between sessions.</p>
      <p>If you need to make changes, please reply to this email.</p>
    `.trim(),
  },
  {
    key: "appointment_reschedule",
    name: "Appointment reschedule",
    description: "Sent after an appointment time is changed.",
    subject: "Appointment rescheduled: {{projectName}}",
    enabled: true,
    testMode: false,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your tattoo appointment has been rescheduled.</p>
      <p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Previous appointment:</strong> {{oldAppointmentTime}}<br><strong>New appointment:</strong> {{newAppointmentTime}}</p>
      <p>If you have questions or need another change, please reply to this email.</p>
    `.trim(),
  },
  {
    key: "appointment_cancellation",
    name: "Appointment cancellation",
    description: "Sent after an appointment is cancelled.",
    subject: "Appointment cancelled: {{projectName}}",
    enabled: true,
    testMode: false,
    html: `
      <p>Hi {{customerName}},</p>
      <p>Your tattoo appointment has been cancelled.</p>
      <p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Original appointment:</strong> {{appointmentTime}}</p>
      <p>If you have questions or need to reschedule, please reply to this email.</p>
    `.trim(),
  },
  {
    key: "appointment_reminder",
    name: "Appointment reminder",
    description: "Scheduled for 24 hours before an appointment.",
    subject: "Appointment reminder: {{projectName}}",
    enabled: true,
    testMode: false,
    html: `
      <p>Hi {{customerName}},</p>
      <p>This is a reminder for your tattoo appointment tomorrow.</p>
      <p><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
      <p>Please eat beforehand, hydrate, and arrive prepared for your session.</p>
      <p>If you need to make changes, please reply to this email as soon as possible.</p>
    `.trim(),
  },
];

export function displayDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function timeRange(startsAt: string | null, endsAt: string | null) {
  const start = displayDateTime(startsAt);
  const end = endsAt ? displayDateTime(endsAt) : "";
  return end ? `${start} - ${end}` : start;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapEmailHtml(bodyHtml: string) {
  return `
    <div style="margin:0;padding:0;background:#f6f4ef;font-family:Arial,sans-serif;color:#1f2428">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px">
        <div style="background:#ffffff;border:1px solid #ded7ca;border-radius:8px;overflow:hidden">
          <div style="padding:24px 26px;border-bottom:1px solid #e8e1d7">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8a6f4d;font-weight:700">Oyabun Tattoo</div>
          </div>
          <div style="padding:24px 26px;font-size:15px;line-height:1.55">
            ${bodyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderTemplateContent(
  template: Pick<OperationsEmailTemplate, "html" | "subject">,
  variables: Record<string, string | null | undefined>,
) {
  let subject = template.subject;
  let html = template.html;

  for (const [key, rawValue] of Object.entries(variables)) {
    const value = rawValue ?? "";
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g");
    subject = subject.replace(pattern, value);
    html = html.replace(pattern, value);
  }

  return {
    html: wrapEmailHtml(html),
    subject,
    text: stripHtml(html),
  };
}

export function defaultTemplateForKey(key: OperationsEmailTemplateKey) {
  return defaultOperationsEmailTemplates.find((template) => template.key === key);
}


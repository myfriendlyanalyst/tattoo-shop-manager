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

const logoUrl =
  "https://jviaxe.stripocdn.email/content/guids/CABINET_6a3bfa96617ed85bcc5a755c7e8d8864/images/logo_trans.png";
const accentImageUrl =
  "https://jviaxe.stripocdn.email/content/guids/CABINET_66983eac26b82e721bce4b896cd4d2e9/images/appointmentmid_29.png";
const instagramIconUrl =
  "https://jviaxe.stripocdn.email/content/assets/img/social-icons/circle-black/instagram-circle-black.png";

function brandedEmailTemplate({
  body,
  headline,
  subhead,
}: {
  body: string;
  headline: string;
  subhead: string;
}) {
  return `
<table style="border-collapse:collapse;border-spacing:0;margin:0;padding:0;width:100%;background:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#333333;" cellpadding="0" cellspacing="0" width="100%">
  <tbody>
    <tr>
      <td style="padding:0;margin:0;" align="center">
        <table style="border-collapse:collapse;border-spacing:0;background:#ffffff;width:600px;max-width:100%;" cellpadding="0" cellspacing="0" width="600">
          <tbody>
            <tr>
              <td style="padding:20px 20px 0;margin:0;" align="center">
                <img width="220" style="display:block;border:0;text-decoration:none;max-width:220px;width:100%;height:auto;" alt="Oyabun Tattoo" src="${logoUrl}">
              </td>
            </tr>
            <tr>
              <td style="padding:20px 20px 25px;margin:0;" align="center">
                <table style="border-collapse:separate;border-spacing:0;border:3px solid #ffc600;border-radius:20px;width:100%;" cellpadding="0" cellspacing="0" width="100%">
                  <tbody>
                    <tr><td style="height:26px;line-height:26px;font-size:0;">&nbsp;</td></tr>
                    <tr>
                      <td style="padding:0 38px;margin:0;" align="center">
                        <h1 style="margin:0;font-size:28px;line-height:1.25;color:#333333;font-weight:700;">${headline}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 38px 0;margin:0;" align="center">
                        <p style="margin:0;font-size:18px;line-height:1.45;color:#333333;"><em>${subhead}</em></p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 38px 0;margin:0;text-align:left;font-size:16px;line-height:1.55;color:#333333;">
                        ${body}
                      </td>
                    </tr>
                    <tr><td style="height:30px;line-height:30px;font-size:0;">&nbsp;</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 20px 20px;margin:0;" align="center">
                <img width="180" style="display:block;border:0;text-decoration:none;max-width:180px;width:100%;height:auto;" alt="" src="${accentImageUrl}">
                <h2 style="margin:12px 0 6px;font-size:24px;line-height:1.2;text-align:center;color:#111111;">Need anything changed?</h2>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.4;text-align:center;color:#333333;"><em>Reply to this email and our team will help you.</em></p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px 18px;margin:0;background:#ffc600;" align="center">
                <img width="170" style="display:block;border:0;text-decoration:none;max-width:170px;width:100%;height:auto;" alt="Oyabun Tattoo" src="${logoUrl}">
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#111111;">8199 Clairemont Mesa Blvd., Suite L<br>San Diego, CA 92111<br>(858) 384-6099<br>contact@oyabuntattoo.com</p>
                <p style="margin:12px 0 0;">
                  <a href="https://www.instagram.com/yushitattoo/" style="text-decoration:none;">
                    <img height="32" style="display:inline-block;border:0;" alt="Instagram" src="${instagramIconUrl}">
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 20px 18px;margin:0;" align="center">
                <p style="margin:0;font-size:10px;line-height:1.4;color:#333333;"><a style="color:#333333;" href="https://www.oyabuntattoo.com">WWW.OYABUNTATTOO.COM</a> @ OYABUN TATTOO</p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
  `.trim();
}

export const defaultOperationsEmailTemplates: OperationsEmailTemplate[] = [
  {
    key: "request_auto_reply",
    name: "Request auto reply",
    description: "Sent after a new Webflow request is received. Kept in test mode until approved.",
    subject: "We received your tattoo request",
    enabled: false,
    testMode: true,
    html: brandedEmailTemplate({
      headline: "We received your tattoo request",
      subhead: "Thank you for trusting Oyabun Tattoo with your idea.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">Thanks for reaching out. We received your tattoo request and our team will review it shortly.</p>
        <p style="margin:0 0 14px;"><strong>We usually reply within 2 business days.</strong> If we need more details, we will contact you by email.</p>
        <p style="margin:0;"><strong>Artist preference:</strong> {{artistPreference}}</p>
      `.trim(),
    }),
  },
  {
    key: "appointment_confirmation_1",
    name: "First appointment confirmation",
    description: "Sent when the first appointment for a project is booked.",
    subject: "Appointment confirmed: {{projectName}}",
    enabled: true,
    testMode: false,
    html: brandedEmailTemplate({
      headline: "Your appointment is confirmed",
      subhead: "We are excited to welcome you to Oyabun Tattoo.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">Your appointment has been confirmed. Please review the details below before your visit.</p>
        <p style="margin:0 0 14px;"><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
        <p style="margin:0;">Please eat beforehand, hydrate, avoid alcohol, and wear comfortable clothing that gives access to the tattoo placement.</p>
      `.trim(),
    }),
  },
  {
    key: "appointment_confirmation_2",
    name: "Next appointment confirmation",
    description: "Sent when another appointment is booked for an existing project.",
    subject: "Next appointment confirmed: {{projectName}}",
    enabled: true,
    testMode: false,
    html: brandedEmailTemplate({
      headline: "Your next appointment is confirmed",
      subhead: "Your project is moving forward.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">Your next appointment has been confirmed.</p>
        <p style="margin:0 0 14px;"><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
        <p style="margin:0;">Please continue following your artist's preparation and aftercare guidance between sessions.</p>
      `.trim(),
    }),
  },
  {
    key: "appointment_reschedule",
    name: "Appointment reschedule",
    description: "Sent after an appointment time is changed.",
    subject: "Appointment rescheduled: {{projectName}}",
    enabled: true,
    testMode: false,
    html: brandedEmailTemplate({
      headline: "Your appointment has been rescheduled",
      subhead: "Please review the updated appointment time.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">Your tattoo appointment has been rescheduled.</p>
        <p style="margin:0;"><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Previous appointment:</strong> {{oldAppointmentTime}}<br><strong>New appointment:</strong> {{newAppointmentTime}}</p>
      `.trim(),
    }),
  },
  {
    key: "appointment_cancellation",
    name: "Appointment cancellation",
    description: "Sent after an appointment is cancelled.",
    subject: "Appointment cancelled: {{projectName}}",
    enabled: true,
    testMode: false,
    html: brandedEmailTemplate({
      headline: "Your appointment has been cancelled",
      subhead: "Reply to this email if you have questions or need to reschedule.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">Your tattoo appointment has been cancelled.</p>
        <p style="margin:0;"><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Original appointment:</strong> {{appointmentTime}}</p>
      `.trim(),
    }),
  },
  {
    key: "appointment_reminder",
    name: "Appointment reminder",
    description: "Scheduled for 24 hours before an appointment.",
    subject: "Appointment reminder: {{projectName}}",
    enabled: true,
    testMode: false,
    html: brandedEmailTemplate({
      headline: "Appointment reminder",
      subhead: "Your tattoo appointment is coming up.",
      body: `
        <p style="margin:0 0 14px;">Hi {{customerName}},</p>
        <p style="margin:0 0 14px;">This is a reminder for your tattoo appointment tomorrow.</p>
        <p style="margin:0 0 14px;"><strong>Project:</strong> {{projectName}}<br><strong>Artist:</strong> {{artistName}}<br><strong>Appointment:</strong> {{appointmentTime}}</p>
        <p style="margin:0;">Please eat beforehand, hydrate, and arrive prepared for your session.</p>
      `.trim(),
    }),
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
  if (/<(?:table|html|body)\b/i.test(bodyHtml)) {
    return bodyHtml;
  }

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

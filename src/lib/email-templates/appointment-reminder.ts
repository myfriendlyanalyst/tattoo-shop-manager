type AppointmentReminderInput = {
  customerName: string;
  projectName: string;
  artistName: string;
  startsAt: string;
  endsAt: string | null;
};

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeRange(startsAt: string, endsAt: string | null) {
  const start = displayDateTime(startsAt);
  const end = endsAt ? displayDateTime(endsAt) : "";
  return end ? `${start} - ${end}` : start;
}

export function renderAppointmentReminderEmail(input: AppointmentReminderInput) {
  const appointmentTime = timeRange(input.startsAt, input.endsAt);
  const subject = `Appointment reminder: ${input.projectName}`;
  const text = [
    `Hi ${input.customerName},`,
    "",
    "This is a reminder for your tattoo appointment tomorrow.",
    "",
    `Project: ${input.projectName}`,
    `Artist: ${input.artistName}`,
    `Appointment: ${appointmentTime}`,
    "",
    "Please eat beforehand, hydrate, and arrive prepared for your session.",
    "If you need to make changes, please reply to this email as soon as possible.",
    "",
    "Oyabun Tattoo",
  ].join("\n");

  const html = `
    <div style="margin:0; padding:0; background:#f6f4ef; font-family: Arial, sans-serif; color:#1f2428;">
      <div style="max-width:640px; margin:0 auto; padding:32px 18px;">
        <div style="background:#ffffff; border:1px solid #ded7ca; border-radius:8px; overflow:hidden;">
          <div style="padding:24px 26px; border-bottom:1px solid #e8e1d7;">
            <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a6f4d; font-weight:700;">Oyabun Tattoo</div>
            <h1 style="margin:10px 0 0 0; font-size:24px; line-height:1.25; color:#1f2428;">Appointment reminder</h1>
            <p style="margin:10px 0 0 0; font-size:15px; line-height:1.55; color:#697178;">This is a reminder for your tattoo appointment tomorrow.</p>
          </div>
          <div style="padding:24px 26px;">
            <p style="margin:0 0 18px 0; font-size:15px; line-height:1.5;">Hi ${escapeHtml(
              input.customerName,
            )},</p>
            <table style="width:100%; border-collapse:collapse; margin:0 0 22px 0;">
              <tr><td style="padding:7px 16px 7px 0; color:#697178; font-size:14px;">Project</td><td style="padding:7px 0; color:#1f2428; font-size:14px;"><strong>${escapeHtml(
                input.projectName,
              )}</strong></td></tr>
              <tr><td style="padding:7px 16px 7px 0; color:#697178; font-size:14px;">Artist</td><td style="padding:7px 0; color:#1f2428; font-size:14px;"><strong>${escapeHtml(
                input.artistName,
              )}</strong></td></tr>
              <tr><td style="padding:7px 16px 7px 0; color:#697178; font-size:14px;">Appointment</td><td style="padding:7px 0; color:#1f2428; font-size:14px;"><strong>${escapeHtml(
                appointmentTime,
              )}</strong></td></tr>
            </table>
            <div style="background:#f8f4ed; border:1px solid #e8dccb; border-radius:6px; padding:16px 18px; margin:0 0 20px 0;">
              <div style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#8a6f4d; font-weight:700; margin-bottom:10px;">Before your visit</div>
              <p style="margin:0; color:#4d555c; font-size:14px; line-height:1.5;">Please eat beforehand, hydrate, and arrive prepared for your session.</p>
            </div>
            <p style="margin:0; font-size:14px; line-height:1.5; color:#4d555c;">If you need to make changes, please reply to this email as soon as possible.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { html, subject, text };
}

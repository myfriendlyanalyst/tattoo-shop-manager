type AppointmentRescheduleInput = {
  customerName: string;
  projectName: string;
  artistName: string;
  oldStartsAt: string;
  oldEndsAt: string | null;
  newStartsAt: string;
  newEndsAt: string | null;
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

export function renderAppointmentRescheduleEmail(input: AppointmentRescheduleInput) {
  const oldTime = timeRange(input.oldStartsAt, input.oldEndsAt);
  const newTime = timeRange(input.newStartsAt, input.newEndsAt);
  const subject = `Appointment rescheduled: ${input.projectName}`;
  const text = [
    `Hi ${input.customerName},`,
    "",
    "Your tattoo appointment has been rescheduled.",
    "",
    `Project: ${input.projectName}`,
    `Artist: ${input.artistName}`,
    `Previous appointment: ${oldTime}`,
    `New appointment: ${newTime}`,
    "",
    "If you have questions or need another change, please reply to this email.",
    "",
    "Oyabun Tattoo",
  ].join("\n");

  const html = `
    <div style="margin:0; padding:0; background:#f6f4ef; font-family: Arial, sans-serif; color:#1f2428;">
      <div style="max-width:640px; margin:0 auto; padding:32px 18px;">
        <div style="background:#ffffff; border:1px solid #ded7ca; border-radius:8px; overflow:hidden;">
          <div style="padding:24px 26px; border-bottom:1px solid #e8e1d7;">
            <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a6f4d; font-weight:700;">Oyabun Tattoo</div>
            <h1 style="margin:10px 0 0 0; font-size:24px; line-height:1.25; color:#1f2428;">Your appointment has been rescheduled.</h1>
            <p style="margin:10px 0 0 0; font-size:15px; line-height:1.55; color:#697178;">Please review the updated appointment time below.</p>
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
              <tr><td style="padding:7px 16px 7px 0; color:#697178; font-size:14px;">Previous appointment</td><td style="padding:7px 0; color:#697178; font-size:14px;"><strong>${escapeHtml(
                oldTime,
              )}</strong></td></tr>
              <tr><td style="padding:7px 16px 7px 0; color:#697178; font-size:14px;">New appointment</td><td style="padding:7px 0; color:#1f2428; font-size:14px;"><strong>${escapeHtml(
                newTime,
              )}</strong></td></tr>
            </table>
            <p style="margin:0; font-size:14px; line-height:1.5; color:#4d555c;">If you have questions or need another change, please reply to this email.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { html, subject, text };
}

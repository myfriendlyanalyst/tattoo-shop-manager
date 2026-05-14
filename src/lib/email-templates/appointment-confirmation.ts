type AppointmentConfirmationVariant = "booking_confirmation_1" | "booking_confirmation_2";

type AppointmentConfirmationInput = {
  variant: AppointmentConfirmationVariant;
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

function appointmentRows(input: AppointmentConfirmationInput) {
  const start = displayDateTime(input.startsAt);
  const end = input.endsAt ? displayDateTime(input.endsAt) : "";

  return [
    ["Project", input.projectName],
    ["Artist", input.artistName],
    ["Start", start],
    ...(end ? [["End", end]] : []),
  ];
}

export function renderAppointmentConfirmationEmail(input: AppointmentConfirmationInput) {
  const isFirstBooking = input.variant === "booking_confirmation_1";
  const subject = isFirstBooking
    ? `Appointment confirmed: ${input.projectName}`
    : `Next appointment confirmed: ${input.projectName}`;
  const headline = isFirstBooking
    ? "Your appointment has been confirmed."
    : "Your next appointment has been confirmed.";
  const intro = isFirstBooking
    ? "Please review your appointment details, deposit policy, and preparation notes before your visit."
    : "Please review your next appointment details and let us know as soon as possible if anything needs to change.";
  const policyNotes = isFirstBooking
    ? [
        "Deposits are applied to your tattoo project and may be affected by late changes or missed appointments.",
        "Before your appointment, please eat, hydrate, and avoid alcohol. Wear comfortable clothing that gives access to the tattoo placement.",
      ]
    : [
        "Your existing project deposit policy still applies to this next appointment.",
        "Please continue following your artist's preparation and aftercare guidance between sessions.",
      ];
  const rows = appointmentRows(input);

  const text = [
    `Hi ${input.customerName},`,
    "",
    headline,
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...policyNotes,
    "",
    "If you need to make changes, please reply to this email.",
    "",
    "Oyabun Tattoo",
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 7px 16px 7px 0; color: #697178; font-size: 14px;">${escapeHtml(
          label,
        )}</td><td style="padding: 7px 0; color: #1f2428; font-size: 14px;"><strong>${escapeHtml(
          value,
        )}</strong></td></tr>`,
    )
    .join("");

  const htmlNotes = policyNotes
    .map(
      (note) =>
        `<li style="margin: 0 0 8px 0; color: #4d555c; font-size: 14px; line-height: 1.5;">${escapeHtml(
          note,
        )}</li>`,
    )
    .join("");

  const html = `
    <div style="margin:0; padding:0; background:#f6f4ef; font-family: Arial, sans-serif; color:#1f2428;">
      <div style="max-width:640px; margin:0 auto; padding:32px 18px;">
        <div style="background:#ffffff; border:1px solid #ded7ca; border-radius:8px; overflow:hidden;">
          <div style="padding:24px 26px; border-bottom:1px solid #e8e1d7;">
            <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#8a6f4d; font-weight:700;">Oyabun Tattoo</div>
            <h1 style="margin:10px 0 0 0; font-size:24px; line-height:1.25; color:#1f2428;">${escapeHtml(
              headline,
            )}</h1>
            <p style="margin:10px 0 0 0; font-size:15px; line-height:1.55; color:#697178;">${escapeHtml(
              intro,
            )}</p>
          </div>
          <div style="padding:24px 26px;">
            <p style="margin:0 0 18px 0; font-size:15px; line-height:1.5;">Hi ${escapeHtml(
              input.customerName,
            )},</p>
            <table style="width:100%; border-collapse:collapse; margin:0 0 22px 0;">
              ${htmlRows}
            </table>
            <div style="background:#f8f4ed; border:1px solid #e8dccb; border-radius:6px; padding:16px 18px; margin:0 0 20px 0;">
              <div style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#8a6f4d; font-weight:700; margin-bottom:10px;">Before your visit</div>
              <ul style="margin:0; padding-left:18px;">${htmlNotes}</ul>
            </div>
            <p style="margin:0; font-size:14px; line-height:1.5; color:#4d555c;">If you need to make changes, please reply to this email.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { html, subject, text };
}

export type { AppointmentConfirmationVariant };

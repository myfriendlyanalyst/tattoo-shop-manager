const studioLocation = "8199 Clairemont Mesa Blvd, Suite L, San Diego, CA 92111";
const defaultBaseUrl = "https://tattoo-shop-manager-navy.vercel.app";

export type CalendarEventInput = {
  appointmentId: string;
  artistName: string;
  baseUrl?: string | null;
  customerName: string;
  endsAt?: string | null;
  projectName: string;
  startsAt: string;
};

export type CalendarFeedEventInput = CalendarEventInput & {
  status?: string | null;
};

function compactDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function eventEnd(startsAt: string, endsAt?: string | null) {
  if (endsAt) return endsAt;
  return new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function configuredBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return defaultBaseUrl;
}

export function calendarEventTitle(input: CalendarEventInput) {
  return cleanText(`Oyabun Tattoo - ${input.customerName} - ${input.projectName}`);
}

export function calendarEventDescription(input: CalendarEventInput) {
  return cleanText(`Tattoo appointment with ${input.artistName}. Project: ${input.projectName}.`);
}

export function buildGoogleCalendarLink(input: CalendarEventInput) {
  const end = eventEnd(input.startsAt, input.endsAt);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    dates: `${compactDate(input.startsAt)}/${compactDate(end)}`,
    details: calendarEventDescription(input),
    location: studioLocation,
    text: calendarEventTitle(input),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsLink(input: CalendarEventInput) {
  const baseUrl = (input.baseUrl || configuredBaseUrl()).replace(/\/$/, "");
  return `${baseUrl}/api/calendar/appointments/${encodeURIComponent(input.appointmentId)}/ics`;
}

function escapeIcsValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcsContent(input: CalendarEventInput) {
  return buildIcsCalendarContent([input], { method: "PUBLISH" });
}

export function buildIcsCalendarContent(
  events: CalendarFeedEventInput[],
  options: { calendarName?: string; method?: "PUBLISH" | "REQUEST" } = {},
) {
  const now = compactDate(new Date().toISOString());
  const method = options.method ?? "PUBLISH";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oyabun Tattoo//Tattoo Shop Manager//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
  ];

  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeIcsValue(options.calendarName)}`);
  }

  for (const event of events) {
    const end = eventEnd(event.startsAt, event.endsAt);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsValue(event.appointmentId)}@oyabuntattoo.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${compactDate(event.startsAt)}`,
      `DTEND:${compactDate(end)}`,
      `SUMMARY:${escapeIcsValue(calendarEventTitle(event))}`,
      `DESCRIPTION:${escapeIcsValue(calendarEventDescription(event))}`,
      `LOCATION:${escapeIcsValue(studioLocation)}`,
      event.status ? `STATUS:${escapeIcsValue(event.status.toUpperCase())}` : "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR", "");

  return lines.join("\r\n");
}

export function buildCalendarLinks(input: CalendarEventInput) {
  return {
    googleCalendarLink: buildGoogleCalendarLink(input),
    icalLink: buildIcsLink(input),
  };
}

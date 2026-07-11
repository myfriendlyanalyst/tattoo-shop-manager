import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIcsCalendarContent, buildIcsContent } from "@/lib/email-templates/calendar-links";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AppointmentRecord = {
  id: string;
  appointment_type?: string | null;
  ends_at: string | null;
  starts_at: string;
  status?: string | null;
  customer: { name: string } | { name: string }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type StaffRecord = {
  id: string;
  active: boolean;
  calendar_feed_token: string | null;
  display_name: string;
};

type FeedTokenRecord = {
  scope: string;
  token: string;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function feedWindow() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 18);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

async function handleStaffFeed(
  adminClient: SupabaseClient,
  staffId: string,
  token: string | null,
) {
  if (!staffId || !token) {
    return errorResponse("Calendar feed token is required.", 401);
  }

  const { data: staffData, error: staffError } = await adminClient
    .from("staff")
    .select("id, active, display_name, calendar_feed_token")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    const suffix = staffError.message.includes("calendar_feed_token")
      ? " Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor."
      : "";
    return errorResponse(`${staffError.message}${suffix}`, 500);
  }

  const staff = staffData as StaffRecord | null;
  if (!staff || !staff.active || staff.calendar_feed_token !== token) {
    return errorResponse("Calendar feed was not found.", 404);
  }

  const { from, to } = feedWindow();
  const { data: appointmentsData, error: appointmentsError } = await adminClient
    .from("appointments")
    .select(
      "id, starts_at, ends_at, appointment_type, status, customer:customers(name), project:projects(subject), artist:staff(display_name)",
    )
    .eq("artist_id", staff.id)
    .neq("status", "cancelled")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (appointmentsError) {
    return errorResponse(appointmentsError.message, 500);
  }

  const events = ((appointmentsData as AppointmentRecord[] | null) ?? []).map((appointment) => {
    const customer = relatedOne(appointment.customer);
    const project = relatedOne(appointment.project);

    return {
      appointmentId: appointment.id,
      artistName: staff.display_name,
      customerName: customer?.name || "Client",
      endsAt: appointment.ends_at,
      projectName: project?.subject || appointment.appointment_type || "Tattoo appointment",
      startsAt: appointment.starts_at,
      status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
    };
  });

  const ics = buildIcsCalendarContent(events, {
    calendarName: `Oyabun - ${staff.display_name}`,
  });

  return new NextResponse(ics, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="oyabun-${staff.id}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}

async function handleShopFeed(adminClient: SupabaseClient, token: string | null) {
  if (!token) {
    return errorResponse("Calendar feed token is required.", 401);
  }

  const { data: feedData, error: feedError } = await adminClient
    .from("calendar_feed_tokens")
    .select("scope, token")
    .eq("scope", "shop")
    .maybeSingle();

  if (feedError) {
    const suffix = feedError.message.includes("calendar_feed_tokens")
      ? " Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor."
      : "";
    return errorResponse(`${feedError.message}${suffix}`, 500);
  }

  const feed = feedData as FeedTokenRecord | null;
  if (!feed || feed.token !== token) {
    return errorResponse("Calendar feed was not found.", 404);
  }

  const { from, to } = feedWindow();
  const { data: appointmentsData, error: appointmentsError } = await adminClient
    .from("appointments")
    .select(
      "id, starts_at, ends_at, appointment_type, status, customer:customers(name), project:projects(subject), artist:staff(display_name)",
    )
    .neq("status", "cancelled")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (appointmentsError) {
    return errorResponse(appointmentsError.message, 500);
  }

  const events = ((appointmentsData as AppointmentRecord[] | null) ?? []).map((appointment) => {
    const customer = relatedOne(appointment.customer);
    const project = relatedOne(appointment.project);
    const artist = relatedOne(appointment.artist);

    return {
      appointmentId: appointment.id,
      artistName: artist?.display_name || "Artist",
      customerName: customer?.name || "Client",
      endsAt: appointment.ends_at,
      projectName: project?.subject || appointment.appointment_type || "Tattoo appointment",
      startsAt: appointment.starts_at,
      status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
    };
  });

  const ics = buildIcsCalendarContent(events, {
    calendarName: "Oyabun - Shop calendar",
  });

  return new NextResponse(ics, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline; filename=\"oyabun-shop-calendar.ics\"",
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return errorResponse("Calendar export is missing server configuration.", 500);
  }

  const { id } = await context.params;
  const appointmentId = id?.trim();

  if (!appointmentId) {
    return errorResponse("Appointment id is required.", 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (request.nextUrl.searchParams.get("feed") === "shop") {
    return handleShopFeed(adminClient, request.nextUrl.searchParams.get("token"));
  }

  if (request.nextUrl.searchParams.get("feed") === "staff") {
    return handleStaffFeed(adminClient, appointmentId, request.nextUrl.searchParams.get("token"));
  }

  const { data, error } = await adminClient
    .from("appointments")
    .select(
      "id, starts_at, ends_at, customer:customers(name), project:projects(subject), artist:staff(display_name)",
    )
    .eq("id", appointmentId)
    .single();

  if (error || !data) {
    return errorResponse("Appointment was not found.", 404);
  }

  const appointment = data as unknown as AppointmentRecord;
  const customer = relatedOne(appointment.customer);
  const project = relatedOne(appointment.project);
  const artist = relatedOne(appointment.artist);
  const ics = buildIcsContent({
    appointmentId: appointment.id,
    artistName: artist?.display_name || "your artist",
    customerName: customer?.name || "Client",
    endsAt: appointment.ends_at,
    projectName: project?.subject || "Tattoo appointment",
    startsAt: appointment.starts_at,
  });

  return new NextResponse(ics, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `attachment; filename="oyabun-appointment-${appointment.id}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}

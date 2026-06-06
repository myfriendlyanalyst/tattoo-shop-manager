import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildIcsContent } from "@/lib/email-templates/calendar-links";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AppointmentRecord = {
  id: string;
  ends_at: string | null;
  starts_at: string;
  customer: { name: string } | { name: string }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: NextRequest, context: RouteContext) {
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

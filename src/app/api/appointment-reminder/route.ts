import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  cancelScheduledAppointmentReminder,
  createReminderAdminClient,
  scheduleAppointmentReminder,
} from "@/lib/appointment-reminder-scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ReminderPayload = {
  action?: "schedule" | "cancel";
  appointmentId?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Appointment reminder is missing Supabase configuration.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return jsonError("Missing login session.", 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: currentUserData, error: currentUserError } = await authClient.auth.getUser();

  if (currentUserError || !currentUserData.user) {
    return jsonError("Invalid login session.", 401);
  }

  const payload = (await request.json()) as ReminderPayload;
  const appointmentId = payload.appointmentId?.trim();
  const action = payload.action ?? "schedule";

  if (!appointmentId) {
    return jsonError("Appointment id is required.", 400);
  }

  const adminClient = createReminderAdminClient();
  const result =
    action === "cancel"
      ? await cancelScheduledAppointmentReminder(adminClient, appointmentId)
      : await scheduleAppointmentReminder(adminClient, appointmentId);

  return NextResponse.json(result);
}

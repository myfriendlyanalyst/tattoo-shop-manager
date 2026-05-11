import { NextRequest, NextResponse } from "next/server";
import {
  createReminderAdminClient,
  reminderAtForAppointment,
  scheduleAppointmentReminder,
} from "@/lib/appointment-reminder-scheduler";

const cronSecret = process.env.CRON_SECRET;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized.", 401);
  }

  const adminClient = createReminderAdminClient();
  const now = Date.now();
  const maxScheduleDate = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await adminClient
    .from("appointments")
    .select("id, starts_at")
    .is("reminder_email_sent_at", null)
    .is("reminder_email_provider_id", null)
    .neq("status", "cancelled")
    .lte("starts_at", maxScheduleDate)
    .or("reminder_email_schedule_status.is.null,reminder_email_schedule_status.eq.pending")
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    return jsonError(error.message, 500);
  }

  const candidates = (data ?? []).filter((appointment) => {
    const reminderAt = reminderAtForAppointment(appointment.starts_at).getTime();
    return reminderAt > now;
  });
  const results = [];

  for (const appointment of candidates) {
    results.push(await scheduleAppointmentReminder(adminClient, appointment.id));
  }

  return NextResponse.json({
    count: results.length,
    results,
  });
}

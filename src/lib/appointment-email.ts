import { getSafeSession } from "@/lib/auth-session";

type ConfirmationResult = {
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

type ReminderResult = {
  error?: string;
  reason?: string;
  status?: string;
};

type AppointmentEmailType =
  | "appointment_confirmation"
  | "appointment_cancellation"
  | "appointment_reschedule";

type AppointmentEmailOptions = {
  oldStartsAt?: string;
  oldEndsAt?: string | null;
};

async function sendAppointmentEmail(
  appointmentId: string,
  emailType: AppointmentEmailType,
  options: AppointmentEmailOptions = {},
) {
  const session = await getSafeSession();
  const token = session?.access_token;

  if (!token) {
    return { skipped: true, error: "Missing login session." } satisfies ConfirmationResult;
  }

  try {
    const response = await fetch("/api/appointment-email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ appointmentId, emailType, ...options }),
    });

    const payload = (await response.json().catch(() => ({}))) as ConfirmationResult;

    if (!response.ok) {
      return {
        sent: false,
        error: payload.error || payload.reason || "Appointment email failed.",
      };
    }

    return payload;
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Appointment email failed.",
    };
  }
}

export function sendAppointmentConfirmation(appointmentId: string) {
  return sendAppointmentEmail(appointmentId, "appointment_confirmation");
}

export function sendAppointmentCancellation(appointmentId: string) {
  return sendAppointmentEmail(appointmentId, "appointment_cancellation");
}

export function sendAppointmentReschedule(
  appointmentId: string,
  options: Required<AppointmentEmailOptions>,
) {
  return sendAppointmentEmail(appointmentId, "appointment_reschedule", options);
}

async function updateAppointmentReminder(appointmentId: string, action: "schedule" | "cancel") {
  const session = await getSafeSession();
  const token = session?.access_token;

  if (!token) {
    return { error: "Missing login session.", status: "skipped" } satisfies ReminderResult;
  }

  try {
    const response = await fetch("/api/appointment-reminder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, appointmentId }),
    });
    const payload = (await response.json().catch(() => ({}))) as ReminderResult;

    if (!response.ok) {
      return {
        error: payload.error || payload.reason || "Appointment reminder update failed.",
        status: "failed",
      } satisfies ReminderResult;
    }

    return payload;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Appointment reminder update failed.",
      status: "failed",
    } satisfies ReminderResult;
  }
}

export function scheduleAppointmentReminder(appointmentId: string) {
  return updateAppointmentReminder(appointmentId, "schedule");
}

export function cancelAppointmentReminder(appointmentId: string) {
  return updateAppointmentReminder(appointmentId, "cancel");
}

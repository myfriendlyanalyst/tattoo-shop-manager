import { supabase } from "@/lib/supabase";

type ConfirmationResult = {
  sent?: boolean;
  skipped?: boolean;
  error?: string;
};

export async function sendAppointmentConfirmation(appointmentId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

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
      body: JSON.stringify({ appointmentId, emailType: "appointment_confirmation" }),
    });

    const payload = (await response.json().catch(() => ({}))) as ConfirmationResult;

    if (!response.ok) {
      return { sent: false, error: payload.error || "Appointment email failed." };
    }

    return payload;
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Appointment email failed.",
    };
  }
}

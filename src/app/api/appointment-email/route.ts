import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderAppointmentCancellationEmail } from "@/lib/email-templates/appointment-cancellation";
import {
  renderAppointmentConfirmationEmail,
  type AppointmentConfirmationVariant,
} from "@/lib/email-templates/appointment-confirmation";
import { renderAppointmentRescheduleEmail } from "@/lib/email-templates/appointment-reschedule";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailReplyTo = process.env.EMAIL_REPLY_TO;

type EmailPayload = {
  appointmentId?: string;
  emailType?:
    | "appointment_confirmation"
    | "appointment_cancellation"
    | "appointment_reschedule"
    | "appointment_reminder";
  oldStartsAt?: string;
  oldEndsAt?: string | null;
};

type AppointmentEmailRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string | null;
  confirmation_email_sent_at: string | null;
  cancellation_email_sent_at: string | null;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist:
    | { display_name: string; email: string | null }
    | { display_name: string; email: string | null }[]
    | null;
};

type EmailLogClient = {
  from: (table: "email_logs") => {
    insert: (values: Record<string, unknown>) => Promise<unknown>;
  };
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanEmail(value: string | null | undefined) {
  return value?.trim() || null;
}

async function logEmail(
  adminClient: EmailLogClient,
  appointment: AppointmentEmailRecord | null,
  fields: {
    emailType: string;
    toEmail?: string | null;
    replyToEmail?: string | null;
    ccEmails?: string[] | null;
    subject?: string | null;
    status: "sent" | "skipped" | "failed";
    providerMessageId?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
  },
) {
  await adminClient.from("email_logs").insert({
    appointment_id: appointment?.id ?? null,
    customer_id: appointment?.customer_id ?? null,
    email_type: fields.emailType,
    to_email: fields.toEmail ?? null,
    reply_to_email: fields.replyToEmail ?? null,
    cc_emails: fields.ccEmails ?? null,
    subject: fields.subject ?? null,
    status: fields.status,
    provider: "resend",
    provider_message_id: fields.providerMessageId ?? null,
    error_message: fields.errorMessage ?? null,
    sent_at: fields.sentAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Appointment email is missing Supabase server configuration.", 500);
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
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: currentUserData, error: currentUserError } = await authClient.auth.getUser();

  if (currentUserError || !currentUserData.user) {
    return jsonError("Invalid login session.", 401);
  }

  const payload = (await request.json()) as EmailPayload;
  const appointmentId = payload.appointmentId?.trim();
  const emailType = payload.emailType ?? "appointment_confirmation";

  if (!appointmentId) {
    return jsonError("Appointment id is required.", 400);
  }

  if (
    emailType !== "appointment_confirmation" &&
    emailType !== "appointment_cancellation" &&
    emailType !== "appointment_reschedule"
  ) {
    return jsonError(
      "Only appointment confirmation, cancellation, and reschedule emails are available now.",
      400,
    );
  }

  if (emailType === "appointment_reschedule" && !payload.oldStartsAt) {
    return jsonError("Previous appointment time is required for reschedule email.", 400);
  }

  const { data: appointmentData, error: appointmentError } = await adminClient
    .from("appointments")
    .select(
      "id, customer_id, project_id, starts_at, ends_at, appointment_type, confirmation_email_sent_at, cancellation_email_sent_at, customer:customers(name, email), project:projects(subject), artist:staff(display_name, email)",
    )
    .eq("id", appointmentId)
    .single();

  if (appointmentError) {
    return jsonError(
      `${appointmentError.message}. Run docs/supabase_appointment_emails.sql in Supabase SQL Editor if the email columns are missing.`,
      500,
    );
  }

  const appointment = appointmentData as unknown as AppointmentEmailRecord;
  const customer = relatedOne(appointment.customer);
  const artist = relatedOne(appointment.artist);
  const project = relatedOne(appointment.project);
  const toEmail = cleanEmail(customer?.email);
  const replyToEmail = cleanEmail(emailReplyTo);
  const artistEmail = cleanEmail(artist?.email);
  const ccEmails = artistEmail && artistEmail !== toEmail ? [artistEmail] : [];
  const customerName = customer?.name || "there";
  const projectName = project?.subject || "Tattoo appointment";
  const artistName = artist?.display_name || "your artist";
  let emailContent: { html: string; subject: string; text: string };

  if (emailType === "appointment_confirmation") {
    const siblingAppointmentResult = appointment.project_id
      ? await adminClient
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("project_id", appointment.project_id)
          .neq("id", appointment.id)
      : { count: 0, error: null };

    if (siblingAppointmentResult.error) {
      return jsonError(siblingAppointmentResult.error.message, 500);
    }

    const confirmationVariant: AppointmentConfirmationVariant =
      (siblingAppointmentResult.count ?? 0) > 0
        ? "booking_confirmation_2"
        : "booking_confirmation_1";
    emailContent = renderAppointmentConfirmationEmail({
      variant: confirmationVariant,
      customerName,
      projectName,
      artistName,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
    });
  } else {
    emailContent =
      emailType === "appointment_cancellation"
        ? renderAppointmentCancellationEmail({
            customerName,
            projectName,
            artistName,
            startsAt: appointment.starts_at,
          })
        : renderAppointmentRescheduleEmail({
            customerName,
            projectName,
            artistName,
            oldStartsAt: payload.oldStartsAt!,
            oldEndsAt: payload.oldEndsAt ?? null,
            newStartsAt: appointment.starts_at,
            newEndsAt: appointment.ends_at,
          });
  }
  const subject = emailContent.subject;

  if (emailType === "appointment_confirmation" && appointment.confirmation_email_sent_at) {
    return NextResponse.json({ skipped: true, reason: "Confirmation email already sent." });
  }

  if (emailType === "appointment_cancellation" && appointment.cancellation_email_sent_at) {
    return NextResponse.json({ skipped: true, reason: "Cancellation email already sent." });
  }

  if (!toEmail) {
    await logEmail(adminClient as unknown as EmailLogClient, appointment, {
      emailType,
      status: "skipped",
      subject,
      errorMessage: "Customer email is missing.",
    });
    return NextResponse.json({ skipped: true, reason: "Customer email is missing." });
  }

  if (!resendApiKey || !emailFrom) {
    await logEmail(adminClient as unknown as EmailLogClient, appointment, {
      emailType,
      toEmail,
      replyToEmail,
      ccEmails,
      subject,
      status: "failed",
      errorMessage: "Missing RESEND_API_KEY or EMAIL_FROM.",
    });
    return jsonError("Missing RESEND_API_KEY or EMAIL_FROM.", 500);
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [toEmail],
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      subject,
      html: emailContent.html,
      text: emailContent.text,
      reply_to: replyToEmail || undefined,
    }),
  });
  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!resendResponse.ok) {
    const errorMessage = resendPayload.message || resendPayload.error || "Resend email failed.";

    await logEmail(adminClient as unknown as EmailLogClient, appointment, {
      emailType,
      toEmail,
      replyToEmail,
      ccEmails,
      subject,
      status: "failed",
      errorMessage,
    });
    return jsonError(errorMessage, 502);
  }

  const sentAt = new Date().toISOString();

  await adminClient
    .from("appointments")
    .update(
      emailType === "appointment_confirmation"
        ? { confirmation_email_sent_at: sentAt }
        : emailType === "appointment_cancellation"
          ? { cancellation_email_sent_at: sentAt }
          : {},
    )
    .eq("id", appointment.id);
  await logEmail(adminClient as unknown as EmailLogClient, appointment, {
    emailType,
    toEmail,
    replyToEmail,
    ccEmails,
    subject,
    status: "sent",
    providerMessageId: resendPayload.id ?? null,
    sentAt,
  });

  return NextResponse.json({ sent: true, sentAt });
}

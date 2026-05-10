import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailReplyTo = process.env.EMAIL_REPLY_TO;

type EmailPayload = {
  appointmentId?: string;
  emailType?: "appointment_confirmation" | "appointment_reminder";
};

type AppointmentEmailRecord = {
  id: string;
  customer_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string | null;
  confirmation_email_sent_at: string | null;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
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

function emailSubject(appointment: AppointmentEmailRecord) {
  const project = relatedOne(appointment.project);

  return `Appointment confirmed: ${project?.subject || "Tattoo appointment"}`;
}

function emailBodies(appointment: AppointmentEmailRecord) {
  const customer = relatedOne(appointment.customer);
  const project = relatedOne(appointment.project);
  const artist = relatedOne(appointment.artist);
  const customerName = customer?.name || "there";
  const projectName = project?.subject || "Tattoo appointment";
  const artistName = artist?.display_name || "your artist";
  const start = displayDateTime(appointment.starts_at);
  const end = appointment.ends_at ? displayDateTime(appointment.ends_at) : "";

  const text = [
    `Hi ${customerName},`,
    "",
    "Your tattoo appointment has been confirmed.",
    "",
    `Project: ${projectName}`,
    `Artist: ${artistName}`,
    `Start: ${start}`,
    end ? `End: ${end}` : null,
    "",
    "If you need to make changes, please reply to this email.",
    "",
    "Oyabun Tattoo",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2428; line-height: 1.5;">
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Your tattoo appointment has been confirmed.</p>
      <table style="border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 6px 12px 6px 0; color: #697178;">Project</td><td style="padding: 6px 0;"><strong>${escapeHtml(projectName)}</strong></td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #697178;">Artist</td><td style="padding: 6px 0;">${escapeHtml(artistName)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #697178;">Start</td><td style="padding: 6px 0;">${escapeHtml(start)}</td></tr>
        ${
          end
            ? `<tr><td style="padding: 6px 12px 6px 0; color: #697178;">End</td><td style="padding: 6px 0;">${escapeHtml(end)}</td></tr>`
            : ""
        }
      </table>
      <p>If you need to make changes, please reply to this email.</p>
      <p>Oyabun Tattoo</p>
    </div>
  `;

  return { html, text };
}

async function logEmail(
  adminClient: EmailLogClient,
  appointment: AppointmentEmailRecord | null,
  fields: {
    emailType: string;
    toEmail?: string | null;
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

  if (emailType !== "appointment_confirmation") {
    return jsonError("Only appointment confirmation email is available now.", 400);
  }

  const { data: appointmentData, error: appointmentError } = await adminClient
    .from("appointments")
    .select(
      "id, customer_id, starts_at, ends_at, appointment_type, confirmation_email_sent_at, customer:customers(name, email), project:projects(subject), artist:staff(display_name)",
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
  const toEmail = customer?.email?.trim();
  const subject = emailSubject(appointment);

  if (appointment.confirmation_email_sent_at) {
    return NextResponse.json({ skipped: true, reason: "Confirmation email already sent." });
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
      subject,
      status: "failed",
      errorMessage: "Missing RESEND_API_KEY or EMAIL_FROM.",
    });
    return jsonError("Missing RESEND_API_KEY or EMAIL_FROM.", 500);
  }

  const { html, text } = emailBodies(appointment);
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [toEmail],
      subject,
      html,
      text,
      reply_to: emailReplyTo || undefined,
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
      subject,
      status: "failed",
      errorMessage,
    });
    return jsonError(errorMessage, 502);
  }

  const sentAt = new Date().toISOString();

  await adminClient
    .from("appointments")
    .update({ confirmation_email_sent_at: sentAt })
    .eq("id", appointment.id);
  await logEmail(adminClient as unknown as EmailLogClient, appointment, {
    emailType,
    toEmail,
    subject,
    status: "sent",
    providerMessageId: resendPayload.id ?? null,
    sentAt,
  });

  return NextResponse.json({ sent: true, sentAt });
}

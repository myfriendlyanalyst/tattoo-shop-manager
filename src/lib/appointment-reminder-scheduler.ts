import { createClient } from "@supabase/supabase-js";
import { timeRange } from "@/lib/email-templates/custom-email-templates";
import { renderAppointmentReminderEmail } from "@/lib/email-templates/appointment-reminder";
import { buildCalendarLinks } from "@/lib/email-templates/calendar-links";
import { renderOperationsEmailTemplate } from "@/lib/email-templates/template-store";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailReplyTo = process.env.EMAIL_REPLY_TO;

const maxScheduleMs = 30 * 24 * 60 * 60 * 1000;
const reminderOffsetMs = 24 * 60 * 60 * 1000;

type ReminderScheduleStatus = "scheduled" | "pending" | "cancelled" | "skipped" | "failed";

type ReminderAppointmentRecord = {
  id: string;
  customer_id: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  reminder_email_sent_at: string | null;
  reminder_email_scheduled_at: string | null;
  reminder_email_provider_id: string | null;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist:
    | { display_name: string; email: string | null }
    | { display_name: string; email: string | null }[]
    | null;
};

type ReminderScheduleResult = {
  appointmentId: string;
  providerId?: string | null;
  reason?: string;
  scheduledAt?: string | null;
  status: ReminderScheduleStatus;
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function cleanEmail(value: string | null | undefined) {
  return value?.trim() || null;
}

export function reminderAtForAppointment(startsAt: string) {
  return new Date(new Date(startsAt).getTime() - reminderOffsetMs);
}

function serverReady() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey && resendApiKey && emailFrom);
}

export function createReminderAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type ReminderAdminClient = ReturnType<typeof createReminderAdminClient>;

async function fetchReminderAppointment(
  adminClient: ReminderAdminClient,
  appointmentId: string,
) {
  const { data, error } = await adminClient
    .from("appointments")
    .select(
      "id, customer_id, starts_at, ends_at, status, reminder_email_sent_at, reminder_email_scheduled_at, reminder_email_provider_id, customer:customers(name, email), project:projects(subject), artist:staff(display_name, email)",
    )
    .eq("id", appointmentId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as ReminderAppointmentRecord;
}

async function logReminderEmail(
  adminClient: ReminderAdminClient,
  appointment: ReminderAppointmentRecord,
  fields: {
    toEmail?: string | null;
    replyToEmail?: string | null;
    ccEmails?: string[] | null;
    subject?: string | null;
    status: "scheduled" | "skipped" | "failed" | "cancelled";
    providerMessageId?: string | null;
    errorMessage?: string | null;
    scheduledAt?: string | null;
  },
) {
  await adminClient.from("email_logs").insert({
    appointment_id: appointment.id,
    customer_id: appointment.customer_id,
    email_type: "appointment_reminder",
    to_email: fields.toEmail ?? null,
    reply_to_email: fields.replyToEmail ?? null,
    cc_emails: fields.ccEmails ?? null,
    subject: fields.subject ?? null,
    status: fields.status,
    provider: "resend",
    provider_message_id: fields.providerMessageId ?? null,
    error_message: fields.errorMessage ?? null,
    sent_at: fields.scheduledAt ?? null,
  });
}

async function cancelResendEmail(providerId: string) {
  if (!resendApiKey) {
    return;
  }

  await fetch(`https://api.resend.com/emails/${providerId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
  });
}

export async function cancelScheduledAppointmentReminder(
  adminClient: ReminderAdminClient,
  appointmentId: string,
) {
  const appointment = await fetchReminderAppointment(adminClient, appointmentId);

  if (appointment.reminder_email_provider_id) {
    await cancelResendEmail(appointment.reminder_email_provider_id);
  }

  await adminClient
    .from("appointments")
    .update({
      reminder_email_provider_id: null,
      reminder_email_scheduled_at: null,
      reminder_email_schedule_status: "cancelled",
    })
    .eq("id", appointment.id);
  await logReminderEmail(adminClient, appointment, {
    status: "cancelled",
    providerMessageId: appointment.reminder_email_provider_id,
    scheduledAt: appointment.reminder_email_scheduled_at,
  });

  return {
    appointmentId,
    providerId: appointment.reminder_email_provider_id,
    status: "cancelled",
  } satisfies ReminderScheduleResult;
}

export async function scheduleAppointmentReminder(
  adminClient: ReminderAdminClient,
  appointmentId: string,
) {
  if (!serverReady()) {
    throw new Error("Appointment reminder is missing server configuration.");
  }

  const appointment = await fetchReminderAppointment(adminClient, appointmentId);

  if (appointment.reminder_email_provider_id) {
    await cancelResendEmail(appointment.reminder_email_provider_id);
  }

  if (appointment.status === "cancelled") {
    return cancelScheduledAppointmentReminder(adminClient, appointmentId);
  }

  if (appointment.reminder_email_sent_at) {
    return {
      appointmentId,
      reason: "Reminder email was already sent.",
      status: "skipped",
    } satisfies ReminderScheduleResult;
  }

  const reminderAt = reminderAtForAppointment(appointment.starts_at);
  const now = new Date();
  const msUntilReminder = reminderAt.getTime() - now.getTime();

  if (msUntilReminder <= 0) {
    await adminClient
      .from("appointments")
      .update({
        reminder_email_provider_id: null,
        reminder_email_scheduled_at: null,
        reminder_email_schedule_status: "skipped",
      })
      .eq("id", appointment.id);
    await logReminderEmail(adminClient, appointment, {
      status: "skipped",
      errorMessage: "Appointment is less than 24 hours away.",
    });

    return {
      appointmentId,
      reason: "Appointment is less than 24 hours away.",
      status: "skipped",
    } satisfies ReminderScheduleResult;
  }

  if (msUntilReminder > maxScheduleMs) {
    await adminClient
      .from("appointments")
      .update({
        reminder_email_provider_id: null,
        reminder_email_scheduled_at: null,
        reminder_email_schedule_status: "pending",
      })
      .eq("id", appointment.id);

    return {
      appointmentId,
      reason: "Reminder is more than 30 days away.",
      status: "pending",
    } satisfies ReminderScheduleResult;
  }

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
  const calendarLinks = buildCalendarLinks({
    appointmentId: appointment.id,
    artistName,
    customerName,
    endsAt: appointment.ends_at,
    projectName,
    startsAt: appointment.starts_at,
  });
  let emailContent = renderAppointmentReminderEmail({
    customerName,
    projectName,
    artistName,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
  });
  emailContent = await renderOperationsEmailTemplate(
    adminClient,
    "appointment_reminder",
    {
      appointmentTime: timeRange(appointment.starts_at, appointment.ends_at),
      artistName,
      customerName,
      googleCalendarLink: calendarLinks.googleCalendarLink,
      icalLink: calendarLinks.icalLink,
      projectName,
    },
    emailContent,
  );

  if (!toEmail) {
    await adminClient
      .from("appointments")
      .update({
        reminder_email_provider_id: null,
        reminder_email_scheduled_at: null,
        reminder_email_schedule_status: "skipped",
      })
      .eq("id", appointment.id);
    await logReminderEmail(adminClient, appointment, {
      subject: emailContent.subject,
      status: "skipped",
      errorMessage: "Customer email is missing.",
    });

    return {
      appointmentId,
      reason: "Customer email is missing.",
      status: "skipped",
    } satisfies ReminderScheduleResult;
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
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      reply_to: replyToEmail || undefined,
      scheduled_at: reminderAt.toISOString(),
    }),
  });
  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!resendResponse.ok) {
    const errorMessage = resendPayload.message || resendPayload.error || "Resend reminder scheduling failed.";

    await adminClient
      .from("appointments")
      .update({
        reminder_email_provider_id: null,
        reminder_email_scheduled_at: null,
        reminder_email_schedule_status: "failed",
      })
      .eq("id", appointment.id);
    await logReminderEmail(adminClient, appointment, {
      toEmail,
      replyToEmail,
      ccEmails,
      subject: emailContent.subject,
      status: "failed",
      errorMessage,
    });

    return { appointmentId, reason: errorMessage, status: "failed" } satisfies ReminderScheduleResult;
  }

  await adminClient
    .from("appointments")
    .update({
      reminder_email_provider_id: resendPayload.id ?? null,
      reminder_email_scheduled_at: reminderAt.toISOString(),
      reminder_email_schedule_status: "scheduled",
    })
    .eq("id", appointment.id);
  await logReminderEmail(adminClient, appointment, {
    toEmail,
    replyToEmail,
    ccEmails,
    subject: emailContent.subject,
    status: "scheduled",
    providerMessageId: resendPayload.id ?? null,
    scheduledAt: reminderAt.toISOString(),
  });

  return {
    appointmentId,
    providerId: resendPayload.id ?? null,
    scheduledAt: reminderAt.toISOString(),
    status: "scheduled",
  } satisfies ReminderScheduleResult;
}

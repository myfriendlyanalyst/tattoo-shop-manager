import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.REQUEST_EMAIL_WEBHOOK_SECRET;

type EmailWebhookPayload = {
  provider?: string;
  direction?: "inbound" | "outbound";
  threadId?: string;
  messageId?: string;
  fromEmail?: string;
  fromName?: string;
  toEmails?: string[] | string;
  ccEmails?: string[] | string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  sentAt?: string;
  receivedAt?: string;
  request?: {
    clientName?: string;
    email?: string;
    phone?: string;
    tattooDescription?: string;
    approximateSize?: string;
    placement?: string;
    requestedArtistLabel?: string;
    tattooTimingPreference?: string;
    ageConfirmed?: boolean;
    externalId?: string;
  };
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function asEmailArray(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    return value.map(cleanEmail).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(cleanEmail)
      .filter(Boolean);
  }

  return [];
}

function isValidDate(value: string) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function requestSubjectFromPayload(payload: EmailWebhookPayload) {
  const clientName = cleanText(payload.request?.clientName);
  const placement = cleanText(payload.request?.placement);
  const description = cleanText(payload.request?.tattooDescription);
  const subject = cleanText(payload.subject);

  if (clientName && placement) return `${clientName} - ${placement} tattoo`;
  if (clientName && description) return `${clientName} - tattoo request`;
  return subject || "Email request";
}

function snippetFromPayload(payload: EmailWebhookPayload) {
  const snippet = cleanText(payload.snippet);
  if (snippet) return snippet.slice(0, 500);

  const text = cleanText(payload.bodyText);
  if (text) return text.replace(/\s+/g, " ").slice(0, 500);

  return null;
}

function normalizeTattooTimingPreference(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;

  const compact = raw.toLowerCase().replace(/[\s_-]+/g, "");

  if (compact === "asap" || compact.includes("assoonaspossible")) {
    return "asap";
  }

  if (
    compact.includes("1~2") ||
    compact.includes("1-2") ||
    compact.includes("12weeks") ||
    compact.includes("within2weeks") ||
    compact === "within12weeks"
  ) {
    return "within_1_2_weeks";
  }

  if (compact.includes("flexible") || compact.includes("anytime")) {
    return "flexible";
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !webhookSecret) {
    return jsonError("Request email webhook is not configured.", 500);
  }

  const providedSecret = request.headers.get("x-request-email-secret") ?? "";
  if (providedSecret !== webhookSecret) {
    return jsonError("Unauthorized webhook request.", 401);
  }

  const payload = (await request.json()) as EmailWebhookPayload;
  const provider = cleanText(payload.provider) || "gmail";
  const direction = payload.direction === "outbound" ? "outbound" : "inbound";
  const threadId = cleanText(payload.threadId) || null;
  const messageId = cleanText(payload.messageId) || null;
  const fromEmail = cleanEmail(payload.fromEmail) || cleanEmail(payload.request?.email) || null;
  const fromName = cleanText(payload.fromName) || cleanText(payload.request?.clientName) || null;
  const subject = cleanText(payload.subject) || null;
  const receivedAt = isValidDate(cleanText(payload.receivedAt))
    ? new Date(cleanText(payload.receivedAt)).toISOString()
    : new Date().toISOString();
  const sentAt = isValidDate(cleanText(payload.sentAt))
    ? new Date(cleanText(payload.sentAt)).toISOString()
    : null;
  const externalId = cleanText(payload.request?.externalId) || null;

  if (!threadId && !messageId && !fromEmail) {
    return jsonError("threadId, messageId, or fromEmail is required.", 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (messageId) {
    const { data: existingMessage, error: existingMessageError } = await adminClient
      .from("request_messages")
      .select("id, request_id")
      .eq("provider", provider)
      .eq("provider_message_id", messageId)
      .maybeSingle();

    if (existingMessageError) {
      return jsonError(existingMessageError.message, 500);
    }

    if (existingMessage) {
      return NextResponse.json({
        requestId: existingMessage.request_id,
        messageId: existingMessage.id,
        duplicate: true,
      });
    }
  }

  let requestRow:
    | {
        id: string;
        status: string;
        client_reply_at: string | null;
      }
    | null = null;
  let createdRequest = false;

  if (externalId) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, status, client_reply_at")
      .eq("external_source", "webflow")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && threadId) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, status, client_reply_at")
      .eq("gmail_thread_id", threadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && fromEmail && subject) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, status, client_reply_at")
      .ilike("email", fromEmail)
      .ilike("subject", `%${subject.replace(/^(re|fw|fwd):\s*/i, "").slice(0, 60)}%`)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow) {
    const requestPayload = payload.request ?? {};
    const clientName = cleanText(requestPayload.clientName) || fromName || fromEmail || "Email client";
    const email = cleanEmail(requestPayload.email) || fromEmail;
    const tattooTimingPreference = normalizeTattooTimingPreference(
      requestPayload.tattooTimingPreference,
    );

    const { data, error } = await adminClient
      .from("requests")
      .insert({
        client_name: clientName,
        email,
        phone: cleanText(requestPayload.phone) || null,
        subject: requestSubjectFromPayload(payload),
        tattoo_description: cleanText(requestPayload.tattooDescription) || cleanText(payload.bodyText) || null,
        approximate_size: cleanText(requestPayload.approximateSize) || null,
        placement: cleanText(requestPayload.placement) || null,
        requested_artist_label: cleanText(requestPayload.requestedArtistLabel) || null,
        tattoo_timing_preference: tattooTimingPreference,
        preferred_appointment_date: null,
        age_confirmed: Boolean(requestPayload.ageConfirmed),
        status: "new",
        priority: "normal",
        received_at: receivedAt,
        external_source: externalId ? "webflow" : "gmail",
        external_id: externalId ?? messageId ?? threadId,
        gmail_thread_id: threadId,
        gmail_message_id: messageId,
        source_email_subject: subject,
        source_email_from: fromEmail,
        source_email_to: asEmailArray(payload.toEmails).join(", "),
      })
      .select("id, status, client_reply_at")
      .single();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
    createdRequest = true;
  } else {
    const updatePatch: Record<string, string | null> = {};
    if (threadId) updatePatch.gmail_thread_id = threadId;
    if (messageId) updatePatch.gmail_message_id = messageId;
    if (subject) updatePatch.source_email_subject = subject;
    if (fromEmail) updatePatch.source_email_from = fromEmail;
    const toEmails = asEmailArray(payload.toEmails);
    if (toEmails.length > 0) updatePatch.source_email_to = toEmails.join(", ");

    if (Object.keys(updatePatch).length > 0) {
      const { error } = await adminClient.from("requests").update(updatePatch).eq("id", requestRow.id);
      if (error) return jsonError(error.message, 500);
    }
  }

  const { data: message, error: messageError } = await adminClient
    .from("request_messages")
    .insert({
      request_id: requestRow.id,
      provider,
      provider_thread_id: threadId,
      provider_message_id: messageId,
      direction,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: asEmailArray(payload.toEmails),
      cc_emails: asEmailArray(payload.ccEmails),
      subject,
      body_text: cleanText(payload.bodyText) || null,
      body_html: cleanText(payload.bodyHtml) || null,
      snippet: snippetFromPayload(payload),
      sent_at: sentAt,
      received_at: receivedAt,
      raw_payload: payload,
    })
    .select("id")
    .single();

  if (messageError) {
    return jsonError(messageError.message, 500);
  }

  if (direction === "inbound" && !createdRequest) {
    const terminalStatuses = new Set(["booked", "denied"]);
    const requestPatch: Record<string, string> = { client_reply_at: receivedAt };
    if (!terminalStatuses.has(requestRow.status)) {
      requestPatch.status = "client_replied";
    }

    const { error } = await adminClient.from("requests").update(requestPatch).eq("id", requestRow.id);

    if (error) return jsonError(error.message, 500);
  }

  return NextResponse.json({
    requestId: requestRow.id,
    messageId: message.id,
    duplicate: false,
  });
}

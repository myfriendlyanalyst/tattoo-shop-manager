import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.REQUEST_EMAIL_WEBHOOK_SECRET;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

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
    firstName?: string;
    lastName?: string;
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

function clientNameFromSubject(value: unknown) {
  const subject = cleanText(value);
  const match = subject.match(/request\s+from\s+(.+?)\s+for\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function clientNameFromPayload(payload: EmailWebhookPayload) {
  const firstName = cleanText(payload.request?.firstName);
  const lastName = cleanText(payload.request?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || clientNameFromSubject(payload.subject) || cleanText(payload.request?.clientName);
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
  const clientName = clientNameFromPayload(payload);
  const placement = cleanText(payload.request?.placement);
  const description = cleanText(payload.request?.tattooDescription);
  const subject = cleanText(payload.subject);

  if (clientName && placement) return `${clientName} - ${placement} tattoo`;
  if (clientName && description) return `${clientName} - tattoo request`;
  return subject || "Email request";
}

function publicThreadSubject(code: string, clientName: string, artistLabel: string | null) {
  return `${code} | Request from ${clientName || "client"} for ${artistLabel || "Any available"}`;
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

function reqIdFromSubject(value: string | null) {
  const match = value?.match(/\[REQ:([^\]]+)\]/i);
  return match?.[1]?.trim() || null;
}

function reqNumberFromSubject(value: string | null) {
  const match = value?.match(/\bREQ[-\s]?0*([0-9]{1,10})\b/i);
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function threadSubject(value: string | null) {
  return cleanText(value)
    .replace(/\+/g, " ")
    .replace(/^(re|fw|fwd):\s*/i, "")
    .trim()
    .slice(0, 80);
}

function isAnyAvailableLabel(value: string) {
  return value.trim().toLowerCase() === "any available";
}

function requestCode(requestNumber: number | null) {
  return `REQ-${String(requestNumber ?? 0).padStart(5, "0")}`;
}

function timingLabel(value: string | null) {
  return (
    {
      asap: "ASAP",
      within_1_2_weeks: "Within 1-2 weeks",
      flexible: "Flexible",
    }[value ?? ""] ?? "Not specified"
  );
}

function renderArtistForwardEmail(
  request: {
    request_number: number | null;
    client_name: string;
    email: string | null;
    phone: string | null;
    subject: string;
    tattoo_description: string | null;
    approximate_size: string | null;
    placement: string | null;
    requested_artist_label: string | null;
    tattoo_timing_preference: string | null;
  },
  artist: { display_name: string },
  acceptUrl: string,
  passUrl: string,
) {
  const code = requestCode(request.request_number);
  const subject = publicThreadSubject(code, request.client_name, artist.display_name);
  const text = [
    `${code} - New tattoo request`,
    "",
    `Client: ${request.client_name}`,
    `Email: ${request.email || "-"}`,
    `Phone: ${request.phone || "-"}`,
    `Requested artist: ${request.requested_artist_label || "-"}`,
    `Size: ${request.approximate_size ? `${request.approximate_size} inch` : "-"}`,
    `Placement: ${request.placement || "-"}`,
    `Timing: ${timingLabel(request.tattoo_timing_preference)}`,
    "",
    "Description:",
    request.tattoo_description || request.subject,
    "",
    `Accept / draft client email: ${acceptUrl}`,
    `Pass this request back to the shop: ${passUrl}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2428">
      <h2 style="margin:0 0 8px">${code} - New tattoo request</h2>
      <p style="margin:0 0 16px;color:#697178">Assigned to ${artist.display_name}</p>
      <p><strong>Client:</strong> ${request.client_name}<br>
      <strong>Email:</strong> ${request.email || "-"}<br>
      <strong>Phone:</strong> ${request.phone || "-"}<br>
      <strong>Placement:</strong> ${request.placement || "-"}<br>
      <strong>Size:</strong> ${request.approximate_size ? `${request.approximate_size} inch` : "-"}</p>
      <h3 style="margin:18px 0 8px">Description</h3>
      <p style="white-space:pre-wrap;margin:0 0 18px">${request.tattoo_description || request.subject}</p>
      <p>
        <a href="${acceptUrl}" style="display:inline-block;background:#1f2428;color:#fff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700;margin:0 8px 8px 0">
          Accept / draft client email
        </a>
        <a href="${passUrl}" style="display:inline-block;background:#fff;color:#8a3030;text-decoration:none;border:1px solid #8a3030;border-radius:6px;padding:11px 18px;font-weight:700;margin:0 0 8px 0">
          Pass
        </a>
      </p>
      <p style="font-size:13px;color:#697178">Accept opens an editable client email draft in the app. Pass opens a confirmation page and does not email the client.</p>
    </div>
  `;

  return { subject, text, html };
}

async function maybeForwardMatchedArtist(
  requestUrl: string,
  requestRow: {
    id: string;
    request_number: number | null;
    client_name: string;
    email: string | null;
    phone: string | null;
    subject: string;
    tattoo_description: string | null;
    approximate_size: string | null;
    placement: string | null;
    requested_artist_label: string | null;
    tattoo_timing_preference: string | null;
  },
  artist: { id: string; display_name: string; email: string | null },
) {
  if (!artist.email || !resendApiKey || !emailFrom) return;

  const client = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const { error: tokenError } = await client.from("request_artist_action_tokens").insert({
    request_id: requestRow.id,
    artist_id: artist.id,
    token,
  });
  if (tokenError) return;

  const encodedToken = encodeURIComponent(token);
  const origin = new URL(requestUrl).origin;
  const acceptUrl = `${origin}/artist-response?token=${encodedToken}`;
  const passUrl = `${origin}/artist-response?token=${encodedToken}&intent=pass`;
  const email = renderArtistForwardEmail(requestRow, artist, acceptUrl, passUrl);
  const now = new Date().toISOString();

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [artist.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  const resendPayload = (await resendResponse.json().catch(() => ({}))) as { id?: string };
  if (!resendResponse.ok) return;

  await client
    .from("requests")
    .update({ status: "forwarded", forwarded_at: now })
    .eq("id", requestRow.id);

  await client.from("request_messages").insert({
    request_id: requestRow.id,
    provider: "resend",
    provider_message_id: resendPayload.id ?? null,
    direction: "outbound",
    from_email: emailFrom,
    to_emails: [artist.email],
    subject: email.subject,
    body_text: email.text,
    snippet: email.text.replace(/\s+/g, " ").slice(0, 500),
    sent_at: now,
    received_at: now,
    raw_payload: { providerResponse: resendPayload, purpose: "artist_forward_auto" },
  });
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
  const fromName = cleanText(payload.fromName) || clientNameFromPayload(payload) || null;
  const subject = cleanText(payload.subject) || null;
  const receivedAt = isValidDate(cleanText(payload.receivedAt))
    ? new Date(cleanText(payload.receivedAt)).toISOString()
    : new Date().toISOString();
  const sentAt = isValidDate(cleanText(payload.sentAt))
    ? new Date(cleanText(payload.sentAt)).toISOString()
    : null;
  const externalId = cleanText(payload.request?.externalId) || reqIdFromSubject(subject);
  const requestNumber = reqNumberFromSubject(subject);

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
        request_number: number | null;
        status: string;
        email: string | null;
        client_name?: string;
        phone?: string | null;
        subject?: string;
        tattoo_description?: string | null;
        approximate_size?: string | null;
        placement?: string | null;
        requested_artist_label?: string | null;
        tattoo_timing_preference?: string | null;
        artist_id: string | null;
        client_reply_at: string | null;
        artist_reply_at: string | null;
      }
    | null = null;
  let createdRequest = false;

  if (externalId) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, request_number, status, email, artist_id, client_reply_at, artist_reply_at")
      .eq("external_source", "webflow")
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && requestNumber) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, request_number, status, email, artist_id, client_reply_at, artist_reply_at")
      .eq("request_number", requestNumber)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && threadId) {
    const { data, error } = await adminClient
      .from("requests")
      .select("id, request_number, status, email, artist_id, client_reply_at, artist_reply_at")
      .eq("gmail_thread_id", threadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && fromEmail && subject) {
    const normalizedSubject = threadSubject(subject);
    const { data, error } = await adminClient
      .from("requests")
      .select("id, request_number, status, email, artist_id, client_reply_at, artist_reply_at")
      .ilike("email", fromEmail)
      .ilike("subject", `%${normalizedSubject}%`)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow && fromEmail && subject) {
    const normalizedSubject = threadSubject(subject);
    const { data, error } = await adminClient
      .from("requests")
      .select("id, request_number, status, email, artist_id, client_reply_at, artist_reply_at")
      .ilike("email", fromEmail)
      .ilike("source_email_subject", `%${normalizedSubject}%`)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    requestRow = data;
  }

  if (!requestRow) {
    const requestPayload = payload.request ?? {};
    const clientName = clientNameFromPayload(payload) || fromName || fromEmail || "Email client";
    const email = cleanEmail(requestPayload.email) || fromEmail;
    const tattooTimingPreference = normalizeTattooTimingPreference(
      requestPayload.tattooTimingPreference,
    );
    const requestedArtistLabel = cleanText(requestPayload.requestedArtistLabel);
    const { data: matchedArtist } =
      requestedArtistLabel && !isAnyAvailableLabel(requestedArtistLabel)
        ? await adminClient
            .from("staff")
            .select("id, display_name, email")
            .eq("active", true)
            .ilike("display_name", requestedArtistLabel)
            .maybeSingle()
        : { data: null };

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
        requested_artist_label: requestedArtistLabel || null,
        tattoo_timing_preference: tattooTimingPreference,
        preferred_appointment_date: null,
        age_confirmed: Boolean(requestPayload.ageConfirmed),
        artist_id: matchedArtist?.id ?? null,
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
      .select("id, request_number, status, email, client_name, phone, subject, tattoo_description, approximate_size, placement, requested_artist_label, tattoo_timing_preference, artist_id, client_reply_at, artist_reply_at")
      .single();

    if (error) return jsonError(error.message, 500);

    const publicSubject = publicThreadSubject(
      requestCode(data.request_number),
      data.client_name,
      data.requested_artist_label ?? matchedArtist?.display_name ?? null,
    );
    const { data: normalizedRequest, error: normalizedError } = await adminClient
      .from("requests")
      .update({ source_email_subject: publicSubject })
      .eq("id", data.id)
      .select("id, request_number, status, email, client_name, phone, subject, tattoo_description, approximate_size, placement, requested_artist_label, tattoo_timing_preference, artist_id, client_reply_at, artist_reply_at")
      .single();

    if (normalizedError) return jsonError(normalizedError.message, 500);
    requestRow = normalizedRequest;
    createdRequest = true;

    if (matchedArtist) {
      await maybeForwardMatchedArtist(request.url, {
        id: normalizedRequest.id,
        request_number: normalizedRequest.request_number,
        client_name: normalizedRequest.client_name,
        email: normalizedRequest.email,
        phone: normalizedRequest.phone ?? null,
        subject: normalizedRequest.subject,
        tattoo_description: normalizedRequest.tattoo_description ?? null,
        approximate_size: normalizedRequest.approximate_size ?? null,
        placement: normalizedRequest.placement ?? null,
        requested_artist_label: normalizedRequest.requested_artist_label ?? null,
        tattoo_timing_preference: normalizedRequest.tattoo_timing_preference ?? null,
      }, matchedArtist);
    }
  } else {
    const updatePatch: Record<string, string | null> = {};
    if (threadId) updatePatch.gmail_thread_id = threadId;
    if (messageId) updatePatch.gmail_message_id = messageId;

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

  if (direction === "inbound" && !createdRequest && provider !== "webflow") {
    const terminalStatuses = new Set(["booked", "denied"]);
    const requestPatch: Record<string, string> = {};
    const normalizedFromEmail = fromEmail?.toLowerCase() ?? "";
    const normalizedClientEmail = requestRow.email?.toLowerCase() ?? "";
    let artistEmail = "";

    if (requestRow.artist_id) {
      const { data: artist, error: artistError } = await adminClient
        .from("staff")
        .select("email")
        .eq("id", requestRow.artist_id)
        .maybeSingle();

      if (artistError) return jsonError(artistError.message, 500);
      artistEmail = artist?.email?.toLowerCase() ?? "";
    }

    if (artistEmail && normalizedFromEmail === artistEmail) {
      requestPatch.artist_reply_at = receivedAt;
      if (!terminalStatuses.has(requestRow.status)) {
        requestPatch.status = "artist_replied";
      }
    } else if (normalizedClientEmail && normalizedFromEmail === normalizedClientEmail) {
      requestPatch.client_reply_at = receivedAt;
      if (!terminalStatuses.has(requestRow.status)) {
        requestPatch.status = "client_replied";
      }
    }

    if (Object.keys(requestPatch).length > 0) {
      const { error } = await adminClient.from("requests").update(requestPatch).eq("id", requestRow.id);
      if (error) return jsonError(error.message, 500);
    }
  }

  return NextResponse.json({
    requestId: requestRow.id,
    requestCode: requestRow.request_number
      ? `REQ-${String(requestRow.request_number).padStart(5, "0")}`
      : null,
    messageId: message.id,
    duplicate: false,
  });
}

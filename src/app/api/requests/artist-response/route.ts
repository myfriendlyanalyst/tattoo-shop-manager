import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

type TokenRow = {
  id: string;
  request_id: string;
  artist_id: string;
  expires_at: string;
  used_at: string | null;
};

type RequestRow = {
  id: string;
  request_number: number | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  source_email_subject: string | null;
  tattoo_description: string | null;
  approximate_size: string | null;
  placement: string | null;
  requested_artist_label: string | null;
  tattoo_timing_preference: string | null;
  status: string;
};

type ArtistRow = {
  id: string;
  display_name: string;
  email: string | null;
  artist_accept_template: string | null;
};

type SendPayload = {
  token?: string;
  action?: "send" | "pass";
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function adminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function displayFrom(artist: ArtistRow) {
  const match = emailFrom?.match(/<([^>]+)>/);
  const address = match?.[1] ?? emailFrom;
  return `${artist.display_name} via Oyabun Tattoo <${address}>`;
}

function defaultTemplate(artist: ArtistRow) {
  return (
    artist.artist_accept_template?.trim() ||
    `${artist.display_name} reviewed your request and would be happy to move forward. Pricing and scheduling depend on final size, placement, detail, and availability. Please reply directly to ${artist.display_name} so you can discuss the next steps together.`
  );
}

function templateHtml(artist: ArtistRow) {
  const template = defaultTemplate(artist);
  return template.includes("<") ? template : plainTextToHtml(template);
}

function cleanPublicSubject(value: string | null) {
  return (value ?? "")
    .replace(/\+/g, " ")
    .replace(/\[REQ:[^\]]+\]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function draftSubject(request: RequestRow, artist: ArtistRow) {
  const code = requestCode(request.request_number);
  const sourceSubject = cleanPublicSubject(request.source_email_subject);
  const baseSubject = cleanPublicSubject(request.subject);

  if (sourceSubject) {
    return sourceSubject.includes(code) ? sourceSubject : `${code} | ${sourceSubject}`;
  }

  return `${code} | ${baseSubject || "Tattoo request"} | ${artist.display_name}`;
}

function draftBody(request: RequestRow, artist: ArtistRow) {
  return [
    `Hi ${request.client_name},`,
    "",
    `Thanks for reaching out to Oyabun Tattoo. ${artist.display_name} reviewed your request and would be happy to work with you.`,
    "",
    defaultTemplate(artist),
    "",
    "Request summary:",
    `- Placement: ${request.placement || "-"}`,
    `- Approximate size: ${request.approximate_size ? `${request.approximate_size} inch` : "-"}`,
    `- Timing: ${timingLabel(request.tattoo_timing_preference)}`,
    "",
    `You can reply directly to ${artist.display_name} to discuss details, availability, and next steps.`,
    "",
    "Thank you,",
    "Oyabun Tattoo",
  ].join("\n");
}

function draftBodyHtml(request: RequestRow, artist: ArtistRow) {
  return [
    `<p>Hi ${escapeHtml(request.client_name)},</p>`,
    `<p>Thanks for reaching out to Oyabun Tattoo. ${escapeHtml(artist.display_name)} reviewed your request and would be happy to work with you.</p>`,
    templateHtml(artist),
    `<p><strong>Request summary:</strong><br>- Placement: ${escapeHtml(request.placement || "-")}<br>- Approximate size: ${escapeHtml(request.approximate_size ? `${request.approximate_size} inch` : "-")}<br>- Timing: ${escapeHtml(timingLabel(request.tattoo_timing_preference))}</p>`,
    `<p>You can reply directly to ${escapeHtml(artist.display_name)} to discuss details, availability, and next steps.</p>`,
    "<p>Thank you,<br>Oyabun Tattoo</p>",
  ].join("");
}

function replyMailto(request: RequestRow, artist: ArtistRow, subject: string) {
  const params = [`subject=${encodeURIComponent(`Re: ${subject}`)}`];
  return `mailto:${artist.email ?? ""}?${params.join("&")}`;
}

function renderClientEmail(request: RequestRow, artist: ArtistRow, subject: string, bodyHtml: string) {
  const mailto = replyMailto(request, artist, subject);
  const htmlBody = bodyHtml || plainTextToHtml(stripHtml(bodyHtml));

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2428">
      <div style="margin-bottom:16px">${htmlBody}</div>
      <p>
        <a href="${mailto}" style="display:inline-block;background:#1f2428;color:#fff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700">
          Reply to ${escapeHtml(artist.display_name)}
        </a>
      </p>
      <p style="font-size:12px;color:#697178">
        Request ${requestCode(request.request_number)}. Please keep this request code in the subject for tracking.
      </p>
    </div>
  `;
}

async function loadTokenBundle(token: string) {
  const client = adminClient();
  if (!client) return { error: "Artist response is not configured.", status: 500 as const };

  const { data: tokenRow, error: tokenError } = await client
    .from("request_artist_action_tokens")
    .select("id, request_id, artist_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) return { error: tokenError.message, status: 500 as const };
  if (!tokenRow) return { error: "This artist response link is invalid.", status: 404 as const };

  const typedToken = tokenRow as TokenRow;
  if (typedToken.used_at) return { error: "This artist response link has already been used.", status: 410 as const };
  if (new Date(typedToken.expires_at).getTime() < Date.now()) {
    return { error: "This artist response link has expired.", status: 410 as const };
  }

  const [requestResult, artistResult] = await Promise.all([
    client
      .from("requests")
      .select("id, request_number, client_name, email, phone, subject, source_email_subject, tattoo_description, approximate_size, placement, requested_artist_label, tattoo_timing_preference, status")
      .eq("id", typedToken.request_id)
      .single(),
    client
      .from("staff")
      .select("id, display_name, email, artist_accept_template")
      .eq("id", typedToken.artist_id)
      .single(),
  ]);

  if (requestResult.error) return { error: requestResult.error.message, status: 500 as const };
  if (artistResult.error) return { error: artistResult.error.message, status: 500 as const };

  return {
    client,
    token: typedToken,
    request: requestResult.data as RequestRow,
    artist: artistResult.data as ArtistRow,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return jsonError("Missing artist response token.", 400);

  const bundle = await loadTokenBundle(token);
  if ("error" in bundle) return jsonError(bundle.error ?? "Artist response failed.", bundle.status ?? 500);

  return NextResponse.json({
    request: {
      code: requestCode(bundle.request.request_number),
      clientName: bundle.request.client_name,
      email: bundle.request.email,
      phone: bundle.request.phone,
      subject: bundle.request.subject,
      description: bundle.request.tattoo_description,
      placement: bundle.request.placement,
      approximateSize: bundle.request.approximate_size,
      timing: timingLabel(bundle.request.tattoo_timing_preference),
    },
    artist: {
      name: bundle.artist.display_name,
      email: bundle.artist.email,
    },
    draft: {
      subject: draftSubject(bundle.request, bundle.artist),
      bodyText: draftBody(bundle.request, bundle.artist),
      bodyHtml: draftBodyHtml(bundle.request, bundle.artist),
    },
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as SendPayload;
  const token = payload.token?.trim() ?? "";
  if (!token) return jsonError("Missing artist response token.", 400);

  const bundle = await loadTokenBundle(token);
  if ("error" in bundle) return jsonError(bundle.error ?? "Artist response failed.", bundle.status ?? 500);

  const now = new Date().toISOString();

  if (payload.action === "pass") {
    const { error: updateError } = await bundle.client
      .from("requests")
      .update({ artist_id: null, status: "new" })
      .eq("id", bundle.request.id);
    if (updateError) return jsonError(updateError.message, 500);

    await bundle.client
      .from("request_artist_action_tokens")
      .update({ used_at: now })
      .eq("id", bundle.token.id);

    await bundle.client.from("request_messages").insert({
      request_id: bundle.request.id,
      provider: "artist_action",
      direction: "inbound",
      from_email: bundle.artist.email,
      from_name: bundle.artist.display_name,
      subject: `${requestCode(bundle.request.request_number)} | ${bundle.artist.display_name} passed`,
      body_text: `${bundle.artist.display_name} passed on this request.`,
      snippet: `${bundle.artist.display_name} passed on this request.`,
      received_at: now,
      raw_payload: { action: "pass" },
    });

    return NextResponse.json({ passed: true });
  }

  if (payload.action !== "send") return jsonError("Invalid artist response action.", 400);
  if (!resendApiKey || !emailFrom) return jsonError("Missing RESEND_API_KEY or EMAIL_FROM.", 500);
  if (!bundle.request.email) return jsonError("Client email is missing.", 400);
  if (!bundle.artist.email) return jsonError("Artist email is missing.", 400);

  const subject = payload.subject?.trim() || draftSubject(bundle.request, bundle.artist);
  const bodyText = payload.bodyText?.trim() || draftBody(bundle.request, bundle.artist);
  const bodyHtml = payload.bodyHtml?.trim() || plainTextToHtml(bodyText);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: displayFrom(bundle.artist),
      to: [bundle.request.email],
      subject,
      html: renderClientEmail(bundle.request, bundle.artist, subject, bodyHtml),
      text: bodyText,
      reply_to: bundle.artist.email,
    }),
  });

  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!resendResponse.ok) {
    return jsonError(resendPayload.message || resendPayload.error || "Client email failed.", 502);
  }

  await bundle.client
    .from("requests")
    .update({ status: "client_waiting_for_reply", artist_reply_at: now })
    .eq("id", bundle.request.id);

  await bundle.client
    .from("request_artist_action_tokens")
    .update({ used_at: now })
    .eq("id", bundle.token.id);

  await bundle.client.from("request_messages").insert({
    request_id: bundle.request.id,
    provider: "resend",
    provider_message_id: resendPayload.id ?? null,
    direction: "outbound",
    from_email: emailFrom,
    to_emails: [bundle.request.email],
    cc_emails: [],
    subject,
    body_text: bodyText,
    snippet: bodyText.replace(/\s+/g, " ").slice(0, 500),
    sent_at: now,
    received_at: now,
    raw_payload: { providerResponse: resendPayload, purpose: "artist_client_reply" },
  });

  return NextResponse.json({ sent: true, sentAt: now, providerMessageId: resendPayload.id ?? null });
}

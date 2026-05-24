import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const emailReplyTo = process.env.EMAIL_REPLY_TO;

type AssignmentPayload = {
  artistId?: string;
};

type RequestRow = {
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
  preferred_appointment_date: string | null;
  status: string;
  forwarded_at: string | null;
};

type ArtistRow = {
  id: string;
  display_name: string;
  email: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

function textLine(label: string, value: string | null | undefined) {
  return `${label}: ${value || "-"}`;
}

function renderArtistForwardEmail(request: RequestRow, artist: ArtistRow, responseUrl: string) {
  const code = requestCode(request.request_number);
  const subject = `${code} | ${request.subject} | ${artist.display_name}`;
  const text = [
    `${code} - New tattoo request`,
    "",
    textLine("Client", request.client_name),
    textLine("Email", request.email),
    textLine("Phone", request.phone),
    textLine("Requested artist", request.requested_artist_label),
    textLine("Size", request.approximate_size ? `${request.approximate_size} inch` : null),
    textLine("Placement", request.placement),
    textLine("Timing", timingLabel(request.tattoo_timing_preference)),
    "",
    "Description:",
    request.tattoo_description || request.subject,
    "",
    `Open this link to accept/pass and draft the client email: ${responseUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2428">
      <h2 style="margin:0 0 8px">${code} - New tattoo request</h2>
      <p style="margin:0 0 16px;color:#697178">Assigned to ${artist.display_name}</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px">
        ${[
          ["Client", request.client_name],
          ["Email", request.email || "-"],
          ["Phone", request.phone || "-"],
          ["Requested artist", request.requested_artist_label || "-"],
          ["Size", request.approximate_size ? `${request.approximate_size} inch` : "-"],
          ["Placement", request.placement || "-"],
          ["Timing", timingLabel(request.tattoo_timing_preference)],
        ]
          .map(
            ([label, value]) => `
              <tr>
                <td style="border:1px solid #eee8dd;padding:8px;font-weight:700;background:#f7f2e9">${label}</td>
                <td style="border:1px solid #eee8dd;padding:8px">${value}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
      <h3 style="margin:18px 0 8px">Description</h3>
      <p style="white-space:pre-wrap;margin:0 0 18px">${request.tattoo_description || request.subject}</p>
      <p>
        <a href="${responseUrl}" style="display:inline-block;background:#1f2428;color:#fff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700;margin-right:8px">
          Accept / draft client email
        </a>
      </p>
      <p style="font-size:13px;color:#697178">Use the same page to pass this request back to the shop.</p>
    </div>
  `;

  return { subject, text, html };
}

async function requireOperationsUser(token: string) {
  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Invalid login session.", status: 401 as const, adminClient };
  }

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: profileById, error: profileByIdError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileByIdError) return { error: profileByIdError.message, status: 500 as const, adminClient };

  const { data: profileByEmail, error: profileByEmailError } = profileById
    ? { data: null, error: null }
    : await adminClient.from("profiles").select("role").ilike("email", email).maybeSingle();

  if (profileByEmailError) return { error: profileByEmailError.message, status: 500 as const, adminClient };

  const role = profileById?.role ?? profileByEmail?.role;
  if (!["owner", "admin", "front_desk"].includes(role ?? "")) {
    return { error: "Only operations staff can forward requests.", status: 403 as const, adminClient };
  }

  return { user: userData.user, adminClient };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Request forwarding is missing Supabase server configuration.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOperationsUser(token);
  if (!("user" in access)) {
    return jsonError(access.error, access.status);
  }

  const { id } = await params;
  const payload = (await request.json()) as AssignmentPayload;
  const artistId = payload.artistId?.trim();
  if (!artistId) return jsonError("Artist id is required.", 400);

  const { data: requestRow, error: requestError } = await access.adminClient
    .from("requests")
    .select(
      "id, request_number, client_name, email, phone, subject, tattoo_description, approximate_size, placement, requested_artist_label, tattoo_timing_preference, preferred_appointment_date, status, forwarded_at",
    )
    .eq("id", id)
    .single();

  if (requestError) return jsonError(requestError.message, 500);

  const { data: artist, error: artistError } = await access.adminClient
    .from("staff")
    .select("id, display_name, email")
    .eq("id", artistId)
    .single();

  if (artistError) return jsonError(artistError.message, 500);

  const typedRequest = requestRow as RequestRow;
  const typedArtist = artist as ArtistRow;

  const { data: assignedRequest, error: assignError } = await access.adminClient
    .from("requests")
    .update({ artist_id: artistId })
    .eq("id", typedRequest.id)
    .select("id, request_number, artist_id, status, forwarded_at, artist:staff(display_name)")
    .single();

  if (assignError) return jsonError(assignError.message, 500);

  if (!typedArtist.email) {
    return NextResponse.json({
      request: assignedRequest,
      sent: false,
      warning: "Artist assigned, but email was not sent because the selected artist does not have an email address.",
    });
  }

  if (!resendApiKey || !emailFrom) {
    return NextResponse.json({
      request: assignedRequest,
      sent: false,
      warning: "Artist assigned, but email was not sent because RESEND_API_KEY or EMAIL_FROM is missing.",
    });
  }

  const forwardedAt = new Date().toISOString();
  const actionToken = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const { error: tokenError } = await access.adminClient.from("request_artist_action_tokens").insert({
    request_id: typedRequest.id,
    artist_id: typedArtist.id,
    token: actionToken,
  });

  if (tokenError) return jsonError(tokenError.message, 500);

  const responseUrl = `${request.nextUrl.origin}/artist-response?token=${encodeURIComponent(actionToken)}`;
  const { subject, text, html } = renderArtistForwardEmail(typedRequest, typedArtist, responseUrl);
  const replyTo = emailReplyTo || undefined;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [typedArtist.email],
      subject,
      html,
      text,
      reply_to: replyTo,
    }),
  });

  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!resendResponse.ok) {
    const errorMessage = resendPayload.message || resendPayload.error || "Artist email failed.";
    return NextResponse.json({
      request: assignedRequest,
      sent: false,
      warning: `Artist assigned, but email was not sent: ${errorMessage}`,
    });
  }

  const { data: updatedRequest, error: updateError } = await access.adminClient
    .from("requests")
    .update({
      artist_id: artistId,
      status: typedRequest.status === "new" ? "forwarded" : typedRequest.status,
      forwarded_at: typedRequest.forwarded_at ?? forwardedAt,
    })
    .eq("id", typedRequest.id)
    .select(
      "id, request_number, artist_id, status, forwarded_at, artist:staff(display_name)",
    )
    .single();

  if (updateError) return jsonError(updateError.message, 500);

  await access.adminClient.from("request_messages").insert({
    request_id: typedRequest.id,
    provider: "resend",
    provider_message_id: resendPayload.id ?? null,
    direction: "outbound",
    from_email: emailFrom,
    to_emails: [typedArtist.email],
    subject,
    body_text: text,
    snippet: text.replace(/\s+/g, " ").slice(0, 500),
    sent_at: forwardedAt,
    received_at: forwardedAt,
    raw_payload: { providerResponse: resendPayload, purpose: "artist_forward" },
  });

  return NextResponse.json({
    request: updatedRequest,
    sent: true,
    sentAt: forwardedAt,
    providerMessageId: resendPayload.id ?? null,
    toEmail: typedArtist.email,
    subject,
  });
}

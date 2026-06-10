import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ClientAction = "request_reassignment" | "close_request";

type TokenRow = {
  id: string;
  request_id: string;
  artist_id: string | null;
  expires_at: string;
  used_action: ClientAction | null;
  used_at: string | null;
};

type RequestRow = {
  id: string;
  request_number: number | null;
  client_name: string;
  email: string | null;
  subject: string;
  status: string;
};

type ArtistRow = {
  id: string;
  display_name: string;
  email: string | null;
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

function actionLabel(action: ClientAction) {
  return action === "request_reassignment"
    ? "Client requested a different artist"
    : "Client is no longer interested";
}

function actionMessage(action: ClientAction, artistName: string | null) {
  if (action === "request_reassignment") {
    return `The client requested a different artist${artistName ? ` instead of ${artistName}` : ""}.`;
  }

  return "The client closed this request and is no longer moving forward.";
}

async function loadBundle(token: string) {
  const client = adminClient();
  if (!client) return { error: "Client action links are not configured.", status: 500 as const };

  const { data: tokenRow, error: tokenError } = await client
    .from("request_client_action_tokens")
    .select("id, request_id, artist_id, expires_at, used_at, used_action")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) {
    return {
      error: `${tokenError.message}. Run docs/request_client_actions.sql in Supabase SQL Editor.`,
      status: 500 as const,
    };
  }
  if (!tokenRow) return { error: "This request action link is invalid.", status: 404 as const };

  const typedToken = tokenRow as TokenRow;
  const [requestResult, artistResult] = await Promise.all([
    client
      .from("requests")
      .select("id, request_number, client_name, email, subject, status")
      .eq("id", typedToken.request_id)
      .single(),
    typedToken.artist_id
      ? client.from("staff").select("id, display_name, email").eq("id", typedToken.artist_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (requestResult.error) return { error: requestResult.error.message, status: 500 as const };
  if (artistResult.error) return { error: artistResult.error.message, status: 500 as const };

  return {
    artist: artistResult.data as ArtistRow | null,
    client,
    request: requestResult.data as RequestRow,
    token: typedToken,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return jsonError("Missing request action token.", 400);

  const bundle = await loadBundle(token);
  if ("error" in bundle) return jsonError(bundle.error ?? "Request action failed.", bundle.status ?? 500);

  return NextResponse.json({
    artist: bundle.artist
      ? {
          email: bundle.artist.email,
          name: bundle.artist.display_name,
        }
      : null,
    expired: new Date(bundle.token.expires_at).getTime() < Date.now(),
    request: {
      clientName: bundle.request.client_name,
      code: requestCode(bundle.request.request_number),
      email: bundle.request.email,
      status: bundle.request.status,
      subject: bundle.request.subject,
    },
    usedAction: bundle.token.used_action,
    usedAt: bundle.token.used_at,
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as {
    action?: ClientAction;
    token?: string;
  };
  const token = payload.token?.trim() ?? "";
  if (!token) return jsonError("Missing request action token.", 400);
  if (payload.action !== "request_reassignment" && payload.action !== "close_request") {
    return jsonError("Invalid request action.", 400);
  }

  const bundle = await loadBundle(token);
  if ("error" in bundle) return jsonError(bundle.error ?? "Request action failed.", bundle.status ?? 500);
  if (bundle.token.used_at) return jsonError("This request action link has already been used.", 410);
  if (new Date(bundle.token.expires_at).getTime() < Date.now()) {
    return jsonError("This request action link has expired.", 410);
  }

  const now = new Date().toISOString();
  const update =
    payload.action === "request_reassignment"
      ? {
          artist_id: null,
          client_reply_at: now,
          requested_artist_label: "Any available",
          status: "new",
        }
      : {
          client_reply_at: now,
          status: "client_declined",
        };

  const { error: updateError } = await bundle.client
    .from("requests")
    .update(update)
    .eq("id", bundle.request.id);

  if (updateError) {
    return jsonError(
      `${updateError.message}. Run docs/request_client_actions.sql in Supabase SQL Editor.`,
      500,
    );
  }

  const { error: tokenError } = await bundle.client
    .from("request_client_action_tokens")
    .update({ used_action: payload.action, used_at: now })
    .eq("id", bundle.token.id);

  if (tokenError) return jsonError(tokenError.message, 500);

  await bundle.client.from("request_messages").insert({
    request_id: bundle.request.id,
    provider: "client_action",
    direction: "inbound",
    from_email: bundle.request.email,
    from_name: bundle.request.client_name,
    subject: `${requestCode(bundle.request.request_number)} | ${actionLabel(payload.action)}`,
    body_text: actionMessage(payload.action, bundle.artist?.display_name ?? null),
    snippet: actionMessage(payload.action, bundle.artist?.display_name ?? null),
    received_at: now,
    raw_payload: {
      action: payload.action,
      artistId: bundle.artist?.id ?? null,
      artistName: bundle.artist?.display_name ?? null,
    },
  });

  return NextResponse.json({
    action: payload.action,
    completed: true,
    message: actionMessage(payload.action, bundle.artist?.display_name ?? null),
  });
}

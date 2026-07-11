import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SettingsPayload = {
  artistAcceptTemplate?: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireOwnStaff(token: string) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: "Artist settings are not configured.", status: 500 as const };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Invalid login session.", status: 401 as const, adminClient };
  }

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: staffByProfileId, error: byIdError } = await adminClient
    .from("staff")
    .select("id, display_name, role, email, artist_accept_template, calendar_feed_token")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (byIdError) {
    const suffix = byIdError.message.includes("calendar_feed_token")
      ? " Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor."
      : "";
    return { error: `${byIdError.message}${suffix}`, status: 500 as const, adminClient };
  }

  const { data: staffByEmail, error: byEmailError } = staffByProfileId
    ? { data: null, error: null }
    : await adminClient
        .from("staff")
        .select("id, display_name, role, email, artist_accept_template, calendar_feed_token")
        .ilike("email", email)
        .maybeSingle();

  if (byEmailError) {
    const suffix = byEmailError.message.includes("calendar_feed_token")
      ? " Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor."
      : "";
    return { error: `${byEmailError.message}${suffix}`, status: 500 as const, adminClient };
  }

  const staff = staffByProfileId ?? staffByEmail;
  if (!staff || !["Artist", "Owner"].includes(staff.role)) {
    return { error: "Only artists can edit artist email settings.", status: 403 as const, adminClient };
  }

  return { user: userData.user, staff, adminClient };
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOwnStaff(token);
  if ("error" in access) return jsonError(access.error ?? "Artist settings failed.", access.status ?? 500);
  const staff = access.staff;

  return NextResponse.json({
    staff: {
      id: staff.id,
      displayName: staff.display_name,
      role: staff.role,
      email: staff.email,
      artistAcceptTemplate: staff.artist_accept_template ?? "",
      calendarFeedToken: staff.calendar_feed_token ?? "",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOwnStaff(token);
  if ("error" in access) return jsonError(access.error ?? "Artist settings failed.", access.status ?? 500);

  const payload = (await request.json()) as SettingsPayload;
  const template = payload.artistAcceptTemplate?.trim() || null;

  const { data, error } = await access.adminClient
    .from("staff")
    .update({ artist_accept_template: template })
    .eq("id", access.staff.id)
    .select("id, display_name, role, email, artist_accept_template, calendar_feed_token")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({
    staff: {
      id: data.id,
      displayName: data.display_name,
      role: data.role,
      email: data.email,
      artistAcceptTemplate: data.artist_accept_template ?? "",
      calendarFeedToken: data.calendar_feed_token ?? "",
    },
  });
}

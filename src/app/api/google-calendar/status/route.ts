import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { googleCalendarConfigured } from "@/lib/google-calendar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireOwnStaff(token: string) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: "Google Calendar status is not configured.", status: 500 as const };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return { error: "Invalid login session.", status: 401 as const };

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: staffByProfileId, error: byIdError } = await adminClient
    .from("staff")
    .select("id, role, active")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (byIdError) return { error: byIdError.message, status: 500 as const };

  const { data: staffByEmail, error: byEmailError } = staffByProfileId
    ? { data: null, error: null }
    : await adminClient.from("staff").select("id, role, active").ilike("email", email).maybeSingle();

  if (byEmailError) return { error: byEmailError.message, status: 500 as const };

  const staff = staffByProfileId ?? staffByEmail;
  if (!staff?.active || !["Artist", "Owner"].includes(staff.role)) {
    return { error: "Only artists can view Google Calendar status.", status: 403 as const };
  }

  return { adminClient, staff };
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOwnStaff(token);
  if ("error" in access) {
    return jsonError(access.error ?? "Google Calendar status failed.", access.status ?? 500);
  }

  if (!googleCalendarConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const { data, error } = await access.adminClient
    .from("staff_google_calendar_connections")
    .select("google_email, calendar_id, connected_at, updated_at, last_error")
    .eq("staff_id", access.staff.id)
    .maybeSingle();

  if (error) {
    const suffix = error.message.includes("staff_google_calendar_connections")
      ? " Run docs/google_calendar_oauth_mvp_migration.sql in Supabase SQL Editor."
      : "";
    return jsonError(`${error.message}${suffix}`, 500);
  }

  return NextResponse.json({
    configured: true,
    connected: Boolean(data),
    connection: data ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOwnStaff(token);
  if ("error" in access) {
    return jsonError(access.error ?? "Google Calendar disconnect failed.", access.status ?? 500);
  }

  const { error } = await access.adminClient
    .from("staff_google_calendar_connections")
    .delete()
    .eq("staff_id", access.staff.id);

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ connected: false });
}

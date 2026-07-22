import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { googleCalendarConfigured, missingGoogleCalendarConfig } from "@/lib/google-calendar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireOwnerOrAdmin(token: string) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: "Google Calendar admin status is not configured.", status: 500 as const };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: currentUserData, error: currentUserError } = await authClient.auth.getUser();
  if (currentUserError || !currentUserData.user) {
    return { error: "Invalid login session.", status: 401 as const };
  }

  const { data: currentProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", currentUserData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 as const };
  }

  if (!currentProfile || !["owner", "admin"].includes(currentProfile.role)) {
    return {
      error: "Only Owner/Admin users can view Google Calendar connection status.",
      status: 403 as const,
    };
  }

  return { adminClient };
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOwnerOrAdmin(token);
  if ("error" in access) {
    return jsonError(
      access.error ?? "Google Calendar admin status failed.",
      access.status ?? 500,
    );
  }

  if (!googleCalendarConfigured()) {
    return NextResponse.json({
      configured: false,
      missingConfig: missingGoogleCalendarConfig(),
      statuses: [],
    });
  }

  const { data: staffRows, error: staffError } = await access.adminClient
    .from("staff")
    .select("id, display_name, role, active")
    .order("sort_order", { ascending: true });

  if (staffError) return jsonError(staffError.message, 500);

  const { data: connectionRows, error: connectionError } = await access.adminClient
    .from("staff_google_calendar_connections")
    .select("staff_id, google_email, calendar_id, connected_at, updated_at, last_error");

  if (connectionError) {
    const suffix = connectionError.message.includes("staff_google_calendar_connections")
      ? " Run docs/google_calendar_oauth_mvp_migration.sql in Supabase SQL Editor."
      : "";
    return jsonError(`${connectionError.message}${suffix}`, 500);
  }

  const connections = new Map(
    (connectionRows ?? []).map((connection) => [connection.staff_id, connection]),
  );

  return NextResponse.json({
    configured: true,
    statuses: (staffRows ?? []).map((staff) => {
      const connection = connections.get(staff.id);

      return {
        staffId: staff.id,
        displayName: staff.display_name,
        role: staff.role,
        active: staff.active,
        connected: Boolean(connection),
        googleEmail: connection?.google_email ?? null,
        calendarId: connection?.calendar_id ?? null,
        connectedAt: connection?.connected_at ?? null,
        updatedAt: connection?.updated_at ?? null,
        lastError: connection?.last_error ?? null,
      };
    }),
  });
}

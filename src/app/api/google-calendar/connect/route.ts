import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildGoogleAuthorizationUrl,
  googleCalendarConfigured,
} from "@/lib/google-calendar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function roleKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !googleCalendarConfigured()) {
    return jsonError("Google Calendar OAuth is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return jsonError("Invalid login session.", 401);

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: staffByProfileId, error: byIdError } = await adminClient
    .from("staff")
    .select("id, role, active, email")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (byIdError) return jsonError(byIdError.message, 500);

  const { data: staffByEmail, error: byEmailError } = staffByProfileId
    ? { data: null, error: null }
    : await adminClient
        .from("staff")
        .select("id, role, active, email")
        .ilike("email", email)
        .maybeSingle();

  if (byEmailError) return jsonError(byEmailError.message, 500);

  const staff = staffByProfileId ?? staffByEmail;
  const staffRole = roleKey(staff?.role);
  if (!staff?.active || !["artist", "owner"].includes(staffRole)) {
    return jsonError("Only artists can connect a personal Google Calendar.", 403);
  }

  return NextResponse.json({
    url: buildGoogleAuthorizationUrl({
      loginHint: staff.email || email,
      staffId: staff.id,
      userId: userData.user.id,
    }),
  });
}

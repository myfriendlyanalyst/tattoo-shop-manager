import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type FeedTokenRecord = {
  scope: string;
  token: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Calendar feed settings are not configured.", 500);
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
  const { data: profileById, error: profileByIdError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileByIdError) return jsonError(profileByIdError.message, 500);

  const { data: profileByEmail, error: profileByEmailError } = profileById
    ? { data: null, error: null }
    : await adminClient.from("profiles").select("role").ilike("email", email).maybeSingle();

  if (profileByEmailError) return jsonError(profileByEmailError.message, 500);

  const role = profileById?.role ?? profileByEmail?.role ?? null;
  if (!["owner", "admin", "front_desk"].includes(role ?? "")) {
    return jsonError("Only operations staff can view shop calendar feed settings.", 403);
  }

  const { data, error } = await adminClient
    .from("calendar_feed_tokens")
    .select("scope, token")
    .eq("scope", "shop")
    .maybeSingle();

  if (error) {
    const suffix = error.message.includes("calendar_feed_tokens")
      ? " Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor."
      : "";
    return jsonError(`${error.message}${suffix}`, 500);
  }

  const feed = data as FeedTokenRecord | null;
  if (!feed) {
    return jsonError("Shop calendar feed token is missing. Run docs/artist_calendar_feed_migration.sql in Supabase SQL Editor.", 500);
  }

  return NextResponse.json({
    feed: {
      scope: feed.scope,
      token: feed.token,
    },
  });
}

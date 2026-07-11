import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  exchangeGoogleAuthorizationCode,
  googleCalendarConfigured,
  parseGoogleOAuthState,
  saveGoogleCalendarConnection,
} from "@/lib/google-calendar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function callbackRedirect(request: NextRequest, status: "connected" | "error", message?: string) {
  const url = new URL("/calendar", request.nextUrl.origin);
  url.searchParams.set("googleCalendar", status);
  if (message) url.searchParams.set("googleCalendarMessage", message);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !googleCalendarConfigured()) {
    return callbackRedirect(request, "error", "Google Calendar OAuth is not configured.");
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) return callbackRedirect(request, "error", error);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return callbackRedirect(request, "error", "Google Calendar authorization was incomplete.");

  const parsedState = parseGoogleOAuthState(state);
  if (!parsedState) return callbackRedirect(request, "error", "Google Calendar authorization expired. Try again.");

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: staff, error: staffError } = await adminClient
    .from("staff")
    .select("id, active")
    .eq("id", parsedState.staffId)
    .maybeSingle();

  if (staffError) return callbackRedirect(request, "error", staffError.message);
  if (!staff?.active) return callbackRedirect(request, "error", "The selected artist account is inactive.");

  try {
    const token = await exchangeGoogleAuthorizationCode(code);
    await saveGoogleCalendarConnection(adminClient, {
      staffId: parsedState.staffId,
      token,
    });
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : "Google Calendar connection failed.";
    return callbackRedirect(request, "error", message);
  }

  return callbackRedirect(request, "connected");
}

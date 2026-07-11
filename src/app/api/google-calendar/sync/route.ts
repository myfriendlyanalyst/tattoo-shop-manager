import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  deleteAppointmentFromGoogleCalendar,
  syncAppointmentToGoogleCalendar,
} from "@/lib/google-calendar";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SyncPayload = {
  action?: "delete" | "upsert";
  appointmentId?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function roleKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

function isOperationsRole(value: string | null | undefined) {
  return ["owner", "admin", "front_desk"].includes(roleKey(value));
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Google Calendar sync is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const payload = (await request.json()) as SyncPayload;
  const appointmentId = payload.appointmentId?.trim();
  if (!appointmentId) return jsonError("Appointment id is required.", 400);

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

  const { data: staffByProfileId, error: staffByProfileIdError } = await adminClient
    .from("staff")
    .select("id, role, active")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (staffByProfileIdError) return jsonError(staffByProfileIdError.message, 500);

  const { data: staffByEmail, error: staffByEmailError } = staffByProfileId
    ? { data: null, error: null }
    : await adminClient.from("staff").select("id, role, active").ilike("email", email).maybeSingle();

  if (staffByEmailError) return jsonError(staffByEmailError.message, 500);

  const staff = staffByProfileId ?? staffByEmail;
  const canSyncAsAdmin = [profileById?.role, profileByEmail?.role, staff?.role].some(isOperationsRole);
  if (!canSyncAsAdmin) {
    const { data: appointment, error: appointmentError } = await adminClient
      .from("appointments")
      .select("artist_id")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appointmentError) return jsonError(appointmentError.message, 500);
    if (!staff?.active || appointment?.artist_id !== staff.id) {
      return jsonError("Only operations staff or the assigned artist can sync this appointment.", 403);
    }
  }

  const result =
    payload.action === "delete"
      ? await deleteAppointmentFromGoogleCalendar(adminClient, appointmentId)
      : await syncAppointmentToGoogleCalendar(adminClient, appointmentId);

  return NextResponse.json(result);
}

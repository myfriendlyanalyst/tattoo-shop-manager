import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ManageAccountingAccess =
  | { allowed: true }
  | { allowed: false; error: string; status: number };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function canManageAccounting(token: string): Promise<ManageAccountingAccess> {
  if (!supabaseServiceRoleKey) {
    return { allowed: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured.", status: 500 };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return { allowed: false, error: "Invalid session.", status: 401 };
  }

  const userId = userData.user.id;
  const userEmail = userData.user.email?.toLowerCase() ?? "";

  const { data: profileById } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const { data: profileByEmail } = profileById
    ? { data: null }
    : await adminClient
        .from("profiles")
        .select("role")
        .ilike("email", userEmail)
        .maybeSingle();

  const profile = profileById ?? profileByEmail;
  if (profile?.role === "owner") {
    return { allowed: true };
  }

  const { data: acctUserById } = await adminClient
    .from("accounting_users")
    .select("access_level, active")
    .eq("profile_id", userId)
    .maybeSingle();

  const { data: acctUserByEmail } = acctUserById
    ? { data: null }
    : await adminClient
        .from("accounting_users")
        .select("access_level, active")
        .ilike("email", userEmail)
        .maybeSingle();

  const acctUser = acctUserById ?? acctUserByEmail;
  const isDedicatedAccountingUser = !profile || profile.role === "accounting";
  if (
    isDedicatedAccountingUser &&
    acctUser?.active === true &&
    ["owner", "admin"].includes(acctUser.access_level)
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: "Only accounting owners/admins can manage artist payout rates.",
    status: 403,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  const access = await canManageAccounting(token);
  if (!access.allowed) {
    return jsonError(access.error, access.status);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { id } = await params;
  const payload = (await request.json()) as { payoutRate?: number | null };
  const payoutRate = payload.payoutRate;

  if (
    payoutRate !== null &&
    payoutRate !== undefined &&
    (!Number.isFinite(payoutRate) || payoutRate < 0 || payoutRate > 100)
  ) {
    return jsonError("payoutRate must be null or a number between 0 and 100.", 400);
  }

  const { data, error } = await adminClient
    .from("staff")
    .update({ payout_rate: payoutRate ?? null })
    .eq("id", id)
    .select("id, payout_rate")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ artist: data });
}

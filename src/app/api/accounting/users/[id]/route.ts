import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PatchPayload = {
  active?: boolean;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ─── PATCH /api/accounting/users/[id] ────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServiceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);
  }

  const { id } = await params;

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  // Verify caller has admin-level accounting access.
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return jsonError("Invalid session.", 401);

  const callerId = userData.user.id;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  const isOwnerRole = callerProfile?.role === "owner";

  if (!isOwnerRole) {
    const { data: callerAcct } = await adminClient
      .from("accounting_users")
      .select("access_level, active")
      .eq("profile_id", callerId)
      .maybeSingle();

    if (!callerAcct?.active || !["owner", "admin"].includes(callerAcct.access_level)) {
      return jsonError("Only accounting owners/admins can manage users.", 403);
    }
  }

  const payload = (await request.json()) as PatchPayload;

  if (typeof payload.active !== "boolean") {
    return jsonError("Provide { active: true } or { active: false }.", 400);
  }

  const { data: target, error: targetError } = await adminClient
    .from("accounting_users")
    .select("profile_id, access_level")
    .eq("id", id)
    .maybeSingle();

  if (targetError) return jsonError(targetError.message, 500);
  if (!target) return jsonError("User not found.", 404);
  if (target.profile_id === callerId && payload.active === false) {
    return jsonError("You cannot deactivate your own accounting account.", 400);
  }
  if (!isOwnerRole && target.access_level === "owner") {
    return jsonError("Only the Tattoo Manager owner can deactivate accounting owners.", 403);
  }

  const { data: updated, error: updateError } = await adminClient
    .from("accounting_users")
    .update({ active: payload.active })
    .eq("id", id)
    .select("id, profile_id, display_name, email, access_level, active, must_change_password")
    .single();

  if (updateError) return jsonError(updateError.message, 500);
  if (!updated) return jsonError("User not found.", 404);

  return NextResponse.json({ user: updated });
}

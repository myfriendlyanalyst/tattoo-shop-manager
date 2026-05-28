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
  const callerEmail = userData.user.email?.toLowerCase() ?? "";

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfileById } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  const { data: callerProfileByEmail } = callerProfileById
    ? { data: null }
    : await adminClient
        .from("profiles")
        .select("role")
        .ilike("email", callerEmail)
        .maybeSingle();

  const callerProfile = callerProfileById ?? callerProfileByEmail;

  const isOwnerRole = callerProfile?.role === "owner";
  const isSystemAccountingAdmin = callerProfile?.role === "owner" || callerProfile?.role === "admin";

  if (!isSystemAccountingAdmin) {
    const { data: callerAcctById } = await adminClient
      .from("accounting_users")
      .select("access_level, active")
      .eq("profile_id", callerId)
      .maybeSingle();

    const { data: callerAcctByEmail } = callerAcctById
      ? { data: null }
      : await adminClient
          .from("accounting_users")
          .select("access_level, active")
          .ilike("email", callerEmail)
          .maybeSingle();

    const callerAcct = callerAcctById ?? callerAcctByEmail;

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseServiceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);
  }

  const { id } = await params;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return jsonError("Invalid session.", 401);

  const callerId = userData.user.id;
  const callerEmail = userData.user.email?.toLowerCase() ?? "";

  const { data: callerProfileById } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  const { data: callerProfileByEmail } = callerProfileById
    ? { data: null }
    : await adminClient
        .from("profiles")
        .select("role")
        .ilike("email", callerEmail)
        .maybeSingle();
  const callerRole = (callerProfileById ?? callerProfileByEmail)?.role;
  const isOwnerRole = callerRole === "owner";
  const isSystemAccountingAdmin = callerRole === "owner" || callerRole === "admin";

  if (!isSystemAccountingAdmin) {
    const { data: callerAcctById } = await adminClient
      .from("accounting_users")
      .select("access_level, active")
      .eq("profile_id", callerId)
      .maybeSingle();
    const { data: callerAcctByEmail } = callerAcctById
      ? { data: null }
      : await adminClient
          .from("accounting_users")
          .select("access_level, active")
          .ilike("email", callerEmail)
          .maybeSingle();
    const callerAcct = callerAcctById ?? callerAcctByEmail;

    if (!callerAcct?.active || !["owner", "admin"].includes(callerAcct.access_level)) {
      return jsonError("Only accounting owners/admins can manage users.", 403);
    }
  }

  const { data: target, error: targetError } = await adminClient
    .from("accounting_users")
    .select("profile_id, email, access_level")
    .eq("id", id)
    .maybeSingle();

  if (targetError) return jsonError(targetError.message, 500);
  if (!target) return jsonError("User not found.", 404);
  if (
    target.profile_id === callerId ||
    target.email?.toLowerCase() === callerEmail
  ) {
    return jsonError("You cannot delete your own accounting account.", 400);
  }
  if (!isOwnerRole && target.access_level === "owner") {
    return jsonError("Only the Tattoo Manager owner can delete accounting owners.", 403);
  }

  const { error: deleteError } = await adminClient
    .from("accounting_users")
    .delete()
    .eq("id", id);

  if (deleteError) return jsonError(deleteError.message, 500);

  if (target.profile_id) {
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target.profile_id);
    if (authDeleteError) return jsonError(authDeleteError.message, 500);
  } else if (target.email) {
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) return jsonError(listError.message, 500);

    const matchingUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === target.email?.toLowerCase(),
    );

    if (matchingUser) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(matchingUser.id);
      if (authDeleteError) return jsonError(authDeleteError.message, 500);
    }
  }

  return NextResponse.json({ ok: true });
}

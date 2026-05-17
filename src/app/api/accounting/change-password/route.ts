import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ─── POST /api/accounting/change-password ─────────────────────────────────────
// Called by /force-password-change page. Changes the user's password via the
// Admin API and clears must_change_password in accounting_users atomically.
export async function POST(request: NextRequest) {
  if (!supabaseServiceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return jsonError("Invalid session.", 401);

  const userId = userData.user.id;

  // Verify this user is an accounting user that actually needs to change password.
  const { data: acctUser, error: acctError } = await authClient
    .from("accounting_users")
    .select("id, must_change_password")
    .eq("profile_id", userId)
    .maybeSingle();

  if (acctError) return jsonError(acctError.message, 500);
  if (!acctUser) return jsonError("No accounting user record found.", 403);
  if (!acctUser.must_change_password) {
    return jsonError("Password change is not required for this account.", 400);
  }

  const { newPassword } = (await request.json()) as { newPassword?: string };

  if (!newPassword || newPassword.length < 8) {
    return jsonError("Password must be at least 8 characters.", 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Update the password via Admin API (server-side, no re-auth needed).
  const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (pwError) return jsonError(pwError.message, 400);

  // Clear the force-change flag.
  const { error: flagError } = await adminClient
    .from("accounting_users")
    .update({ must_change_password: false })
    .eq("id", acctUser.id);

  if (flagError) return jsonError(flagError.message, 500);

  return NextResponse.json({ ok: true });
}

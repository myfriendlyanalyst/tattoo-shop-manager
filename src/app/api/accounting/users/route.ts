import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AccessLevel = "owner" | "admin" | "viewer";

type CreatePayload = {
  displayName?: string;
  email?: string;
  accessLevel?: AccessLevel;
};

type CallerAccess =
  | { userId: string; isOwner: boolean; error: null; debug: Record<string, unknown> }
  | { error: string; status: 401 | 403; debug: Record<string, unknown> };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Generate a random temporary password: 16 chars, mix of letters/digits/symbols. */
function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  // Use crypto.getRandomValues for secure randomness in the Edge runtime.
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    password += chars[byte % chars.length];
  }
  return password;
}

/** Resolve the caller and verify they have admin-level accounting access. */
async function resolveCallerAccess(token: string): Promise<CallerAccess> {
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return {
      error: "Invalid session.",
      status: 401,
      debug: { authError: userError?.message ?? null },
    };
  }

  const userId = userData.user.id;
  const userEmail = userData.user.email?.toLowerCase() ?? "";

  // Owner by Tattoo Manager role is always allowed. Prefer the auth id, but
  // fall back to email because older data can have mismatched profile ids.
  const { data: profileById, error: profileByIdError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const { data: profileByEmail, error: profileByEmailError } = profileById
    ? { data: null, error: null }
    : await adminClient
        .from("profiles")
        .select("role")
        .ilike("email", userEmail)
        .maybeSingle();

  const profile = profileById ?? profileByEmail;
  const debug = {
    userId,
    userEmail,
    profileByIdRole: profileById?.role ?? null,
    profileByIdError: profileByIdError?.message ?? null,
    profileByEmailRole: profileByEmail?.role ?? null,
    profileByEmailError: profileByEmailError?.message ?? null,
    serviceRoleLooksConfigured: Boolean(supabaseServiceRoleKey),
  };

  if (profile?.role === "owner") {
    return { userId, isOwner: true, error: null, debug };
  }

  // Otherwise must be an active accounting user with admin or owner access_level.
  const { data: acctUserById, error: acctUserByIdError } = await adminClient
    .from("accounting_users")
    .select("access_level, active")
    .eq("profile_id", userId)
    .maybeSingle();

  const { data: acctUserByEmail, error: acctUserByEmailError } = acctUserById
    ? { data: null, error: null }
    : await adminClient
        .from("accounting_users")
        .select("access_level, active")
        .ilike("email", userEmail)
        .maybeSingle();

  const acctUser = acctUserById ?? acctUserByEmail;
  const accessDebug = {
    ...debug,
    acctByIdAccessLevel: acctUserById?.access_level ?? null,
    acctByIdActive: acctUserById?.active ?? null,
    acctByIdError: acctUserByIdError?.message ?? null,
    acctByEmailAccessLevel: acctUserByEmail?.access_level ?? null,
    acctByEmailActive: acctUserByEmail?.active ?? null,
    acctByEmailError: acctUserByEmailError?.message ?? null,
  };

  if (!acctUser?.active || !["owner", "admin"].includes(acctUser.access_level)) {
    return {
      error: "Only accounting owners/admins can manage users.",
      status: 403,
      debug: accessDebug,
    };
  }

  return { userId, isOwner: false, error: null, debug: accessDebug };
}

// ─── GET /api/accounting/users ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!supabaseServiceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  const access = await resolveCallerAccess(token);
  if (access.error !== null) {
    return NextResponse.json(
      { error: access.error, debug: access.debug },
      { status: access.status },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await adminClient
    .from("accounting_users")
    .select("id, profile_id, display_name, email, access_level, active, must_change_password, created_at")
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ users: data });
}

// ─── POST /api/accounting/users ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!supabaseServiceRoleKey) {
    return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing session.", 401);

  const access = await resolveCallerAccess(token);
  if (access.error !== null) {
    return NextResponse.json(
      { error: access.error, debug: access.debug },
      { status: access.status },
    );
  }

  const payload = (await request.json()) as CreatePayload;
  const displayName = payload.displayName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const accessLevel: AccessLevel = payload.accessLevel ?? "viewer";

  if (!displayName) return jsonError("Display name is required.", 400);
  if (!isValidEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (!["owner", "admin", "viewer"].includes(accessLevel)) {
    return jsonError("access_level must be owner, admin, or viewer.", 400);
  }
  if (!access.isOwner && accessLevel === "owner") {
    return jsonError("Only the Tattoo Manager owner can create accounting owner users.", 403);
  }

  const tempPassword = generateTempPassword();

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create the Supabase Auth user directly (no email invite).
  const { data: createdUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (createError) return jsonError(createError.message, 400);
  if (!createdUser.user) return jsonError("User creation failed.", 500);

  const profileId = createdUser.user.id;

  // Use a dedicated accounting role so this account does not inherit
  // Tattoo Manager operations access such as front_desk.
  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: profileId,
      email,
      display_name: displayName,
      role: "accounting",
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) return jsonError(profileError.message, 500);

  // Insert into accounting_users.
  const { data: acctUser, error: acctError } = await adminClient
    .from("accounting_users")
    .insert({
      profile_id: profileId,
      display_name: displayName,
      email,
      access_level: accessLevel,
      active: true,
      must_change_password: true,
    })
    .select("id, profile_id, display_name, email, access_level, active, must_change_password, created_at")
    .single();

  if (acctError) return jsonError(acctError.message, 500);

  // Return the temp password only once so the creator can hand it to the new user.
  return NextResponse.json({ user: acctUser, tempPassword }, { status: 201 });
}

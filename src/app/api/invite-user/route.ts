import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const roleMap: Record<string, "owner" | "admin" | "artist" | "front_desk"> = {
  Owner: "owner",
  Admin: "admin",
  Artist: "artist",
  "Front Desk": "front_desk",
};

type InvitePayload = {
  displayName?: string;
  email?: string;
  role?: string;
  permissionKeys?: string[];
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function appOrigin(request: NextRequest) {
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError(
      "Invite is not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel and local environment variables.",
      500,
    );
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return jsonError("Missing login session.", 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: currentUserData, error: currentUserError } = await authClient.auth.getUser();

  if (currentUserError || !currentUserData.user) {
    return jsonError("Invalid login session.", 401);
  }

  const { data: currentProfile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", currentUserData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError(profileError.message, 500);
  }

  if (!currentProfile || !["owner", "admin"].includes(currentProfile.role)) {
    return jsonError("Only Owner/Admin users can invite staff.", 403);
  }

  const payload = (await request.json()) as InvitePayload;
  const email = payload.email?.trim().toLowerCase() ?? "";
  const displayName = payload.displayName?.trim() ?? "";
  const role = payload.role?.trim() ?? "Artist";
  const profileRole = roleMap[role];
  const permissionKeys = Array.from(new Set(payload.permissionKeys ?? []));

  if (!displayName) {
    return jsonError("Display name is required.", 400);
  }

  if (!isValidEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  if (!profileRole) {
    return jsonError("Choose a valid role.", 400);
  }

  const redirectTo = `${appOrigin(request)}/set-password`;
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        display_name: displayName,
        role: profileRole,
      },
      redirectTo,
    },
  );

  if (inviteError) {
    return jsonError(inviteError.message, 400);
  }

  const invitedUser = inviteData.user;

  if (!invitedUser) {
    return jsonError("Supabase did not return the invited user.", 500);
  }

  const { error: profileUpsertError } = await authClient.from("profiles").upsert(
    {
      id: invitedUser.id,
      email,
      display_name: displayName,
      role: profileRole,
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileUpsertError) {
    return jsonError(profileUpsertError.message, 500);
  }

  const { data: staffRow, error: staffUpsertError } = await authClient
    .from("staff")
    .upsert(
      {
        profile_id: invitedUser.id,
        display_name: displayName,
        role,
        email,
        active: true,
      },
      { onConflict: "profile_id" },
    )
    .select("id, display_name, legal_name, role, email, phone, start_date, active")
    .single();

  if (staffUpsertError) {
    return jsonError(staffUpsertError.message, 500);
  }

  const permissionPayload = permissionKeys.map((permissionKey) => ({
    staff_id: staffRow.id,
    permission_key: permissionKey,
    enabled: true,
  }));

  if (permissionPayload.length > 0) {
    const { error: permissionError } = await authClient
      .from("staff_permissions")
      .upsert(permissionPayload, { onConflict: "staff_id,permission_key" });

    if (permissionError) {
      return jsonError(permissionError.message, 500);
    }
  }

  return NextResponse.json({
    staff: staffRow,
    permissions: permissionPayload.map((permission) => ({
      ...permission,
      id: `${permission.staff_id}-${permission.permission_key}`,
    })),
  });
}

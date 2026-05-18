import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type StaffUserPayload = {
  staffId?: string;
  mode?: "deactivate" | "delete";
};

type CreateStaffPayload = {
  displayName?: string;
  email?: string;
  role?: "owner" | "admin" | "artist" | "front_desk";
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function staffRoleLabel(role: CreateStaffPayload["role"]) {
  return {
    owner: "Owner",
    admin: "Admin",
    artist: "Artist",
    front_desk: "Front Desk",
  }[role ?? "artist"];
}

async function requireOwnerOrAdmin(token: string) {
  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: currentUserData, error: currentUserError } = await authClient.auth.getUser();
  if (currentUserError || !currentUserData.user) {
    return { error: "Invalid login session.", status: 401 as const, authClient, adminClient };
  }

  const { data: currentProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", currentUserData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 as const, authClient, adminClient };
  }

  if (!currentProfile || !["owner", "admin"].includes(currentProfile.role)) {
    return {
      error: "Only Owner/Admin users can manage staff users.",
      status: 403 as const,
      authClient,
      adminClient,
    };
  }

  return { user: currentUserData.user, authClient, adminClient };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Staff user management is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return jsonError("Missing login session.", 401);
  }

  const access = await requireOwnerOrAdmin(token);
  if (!("user" in access)) {
    return jsonError(access.error, access.status);
  }

  const payload = (await request.json()) as CreateStaffPayload;
  const displayName = payload.displayName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const role = payload.role ?? "artist";

  if (!displayName) return jsonError("Display name is required.", 400);
  if (!isValidEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (!["owner", "admin", "artist", "front_desk"].includes(role)) {
    return jsonError("Invalid staff role.", 400);
  }

  const tempPassword = generateTempPassword();
  const { data: createdUser, error: createError } = await access.adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createError) return jsonError(createError.message, 400);
  if (!createdUser.user) return jsonError("User creation failed.", 500);

  const { error: profileError } = await access.adminClient.from("profiles").upsert(
    {
      id: createdUser.user.id,
      email,
      display_name: displayName,
      role,
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) return jsonError(profileError.message, 500);

  const { data: staff, error: staffError } = await access.adminClient
    .from("staff")
    .insert({
      profile_id: createdUser.user.id,
      display_name: displayName,
      role: staffRoleLabel(role),
      email,
      active: true,
      sort_order: 999,
    })
    .select("id, profile_id, display_name, legal_name, role, email, phone, address, start_date, active")
    .single();

  if (staffError) return jsonError(staffError.message, 500);

  const schedulePayload = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    staff_id: staff.id,
    day_of_week: dayOfWeek,
    available: false,
    starts_at: null,
    ends_at: null,
  }));

  const { error: scheduleError } = await access.adminClient
    .from("staff_schedules")
    .upsert(schedulePayload, { onConflict: "staff_id,day_of_week" });

  if (scheduleError) return jsonError(scheduleError.message, 500);

  return NextResponse.json({ staff, tempPassword }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Staff user management is not configured.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return jsonError("Missing login session.", 401);
  }

  const access = await requireOwnerOrAdmin(token);
  if (!("user" in access)) {
    return jsonError(access.error, access.status);
  }
  const currentUserId = access.user?.id;
  if (!currentUserId) {
    return jsonError("Invalid login session.", 401);
  }

  const payload = (await request.json()) as StaffUserPayload;
  const staffId = payload.staffId;
  const mode = payload.mode ?? "deactivate";

  if (!staffId) {
    return jsonError("Staff id is required.", 400);
  }

  const { data: staffRow, error: staffError } = await access.adminClient
    .from("staff")
    .select("id, profile_id, email, display_name")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    return jsonError(staffError.message, 500);
  }

  if (!staffRow) {
    return jsonError("Staff record was not found.", 404);
  }

  if (staffRow.profile_id === currentUserId) {
    return jsonError("You cannot remove your own staff account.", 400);
  }

  if (mode === "deactivate") {
    const { error: staffUpdateError } = await access.adminClient
      .from("staff")
      .update({ active: false })
      .eq("id", staffId);

    if (staffUpdateError) {
      return jsonError(staffUpdateError.message, 500);
    }

    if (staffRow.profile_id) {
      const { error: profileUpdateError } = await access.adminClient
        .from("profiles")
        .update({ active: false })
        .eq("id", staffRow.profile_id);

      if (profileUpdateError) {
        return jsonError(profileUpdateError.message, 500);
      }
    }

    return NextResponse.json({ staffId, mode });
  }

  const { error: staffDeleteError } = await access.adminClient.from("staff").delete().eq("id", staffId);

  if (staffDeleteError) {
    return jsonError(staffDeleteError.message, 500);
  }

  if (staffRow.profile_id) {
    const { error: authDeleteError } = await access.adminClient.auth.admin.deleteUser(staffRow.profile_id);

    if (authDeleteError) {
      return jsonError(authDeleteError.message, 500);
    }
  } else if (staffRow.email) {
    const { data: usersData, error: listError } = await access.adminClient.auth.admin.listUsers();

    if (listError) {
      return jsonError(listError.message, 500);
    }

    const matchingUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === staffRow.email?.toLowerCase(),
    );

    if (matchingUser) {
      const { error: authDeleteError } = await access.adminClient.auth.admin.deleteUser(matchingUser.id);

      if (authDeleteError) {
        return jsonError(authDeleteError.message, 500);
      }
    }
  }

  return NextResponse.json({ staffId, mode });
}

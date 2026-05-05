import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type StaffUserPayload = {
  staffId?: string;
  mode?: "deactivate" | "delete";
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Staff user management is not configured.", 500);
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
    return jsonError("Only Owner/Admin users can manage staff users.", 403);
  }

  const payload = (await request.json()) as StaffUserPayload;
  const staffId = payload.staffId;
  const mode = payload.mode ?? "deactivate";

  if (!staffId) {
    return jsonError("Staff id is required.", 400);
  }

  const { data: staffRow, error: staffError } = await authClient
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

  if (staffRow.profile_id === currentUserData.user.id) {
    return jsonError("You cannot remove your own staff account.", 400);
  }

  if (mode === "deactivate") {
    const { error: staffUpdateError } = await authClient
      .from("staff")
      .update({ active: false })
      .eq("id", staffId);

    if (staffUpdateError) {
      return jsonError(staffUpdateError.message, 500);
    }

    if (staffRow.profile_id) {
      const { error: profileUpdateError } = await authClient
        .from("profiles")
        .update({ active: false })
        .eq("id", staffRow.profile_id);

      if (profileUpdateError) {
        return jsonError(profileUpdateError.message, 500);
      }
    }

    return NextResponse.json({ staffId, mode });
  }

  const { error: staffDeleteError } = await authClient.from("staff").delete().eq("id", staffId);

  if (staffDeleteError) {
    return jsonError(staffDeleteError.message, 500);
  }

  if (staffRow.profile_id) {
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(staffRow.profile_id);

    if (authDeleteError) {
      return jsonError(authDeleteError.message, 500);
    }
  } else if (staffRow.email) {
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      return jsonError(listError.message, 500);
    }

    const matchingUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === staffRow.email?.toLowerCase(),
    );

    if (matchingUser) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(matchingUser.id);

      if (authDeleteError) {
        return jsonError(authDeleteError.message, 500);
      }
    }
  }

  return NextResponse.json({ staffId, mode });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ProjectPayload = {
  requestId?: string;
  artistId?: string;
  projectName?: string;
  projectType?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  tattooDescription?: string;
  tattooSize?: string;
  tattooPlacement?: string;
  depositAmount?: number;
  depositPaymentMethod?: string;
  depositMemo?: string;
};

function jsonError(message: string, status: number, debug?: unknown) {
  return NextResponse.json(debug ? { error: message, debug } : { error: message }, { status });
}

function databaseError(message: string) {
  const grantHint = message.toLowerCase().includes("permission denied")
    ? " Run docs/supabase_service_role_operational_grants.sql in Supabase SQL Editor."
    : "";

  return jsonError(`${message}.${grantHint}`.replace("..", "."), 500);
}

function roleKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

function isOperationsRole(value: string | null | undefined) {
  return ["owner", "admin", "front_desk"].includes(roleKey(value));
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

function missingColumn(errorMessage: string, columnName: string) {
  return (
    errorMessage.toLowerCase().includes(columnName.toLowerCase()) &&
    errorMessage.toLowerCase().includes("column")
  );
}

function projectMemo(payload: ProjectPayload) {
  return [
    payload.tattooDescription?.trim() ? `Tattoo description: ${payload.tattooDescription.trim()}` : null,
    payload.tattooPlacement?.trim() ? `Placement: ${payload.tattooPlacement.trim()}` : null,
    payload.customerAddress?.trim() ? `Customer address: ${payload.customerAddress.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function requireProjectUser(token: string, artistId: string | null) {
  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Invalid login session.", status: 401 as const, adminClient };
  }

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: profileById, error: profileByIdError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileByIdError) return { error: profileByIdError.message, status: 500 as const, adminClient };

  const { data: profileByEmail, error: profileByEmailError } = profileById
    ? { data: null, error: null }
    : await adminClient.from("profiles").select("role").ilike("email", email).maybeSingle();

  if (profileByEmailError) return { error: profileByEmailError.message, status: 500 as const, adminClient };

  const profileRoles = [roleKey(profileById?.role), roleKey(profileByEmail?.role)];
  if (profileRoles.some(isOperationsRole)) {
    return { user: userData.user, adminClient };
  }

  const { data: staffByProfileId, error: staffByProfileIdError } = await adminClient
    .from("staff")
    .select("id, role, active")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (staffByProfileIdError) return { error: staffByProfileIdError.message, status: 500 as const, adminClient };

  const { data: staffByEmail, error: staffByEmailError } = staffByProfileId
    ? { data: null, error: null }
    : await adminClient.from("staff").select("id, role, active").ilike("email", email).maybeSingle();

  if (staffByEmailError) return { error: staffByEmailError.message, status: 500 as const, adminClient };

  const staff = staffByProfileId ?? staffByEmail;
  if (staff?.active && artistId && staff.id === artistId && roleKey(staff.role) === "artist") {
    return { user: userData.user, adminClient };
  }

  if (staff?.active && staff.id) {
    const { data: permissions, error: permissionError } = await adminClient
      .from("staff_permissions")
      .select("permission_key, enabled")
      .eq("staff_id", staff.id)
      .in("permission_key", ["calendarBooking", "staffAdmin", "requestAssignment"]);

    if (permissionError) return { error: permissionError.message, status: 500 as const, adminClient };
    if (permissions?.some((permission) => permission.enabled)) {
      return { user: userData.user, adminClient };
    }
  }

  return {
    error: "Only operations staff or the selected artist can create projects.",
    status: 403 as const,
    adminClient,
  };
}

async function findOrCreateCustomer(
  adminClient: SupabaseClient,
  payload: ProjectPayload,
  createdBy: string,
) {
  const customerId = payload.customerId?.trim();
  if (customerId) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id, name, email, phone")
      .eq("id", customerId)
      .maybeSingle();

    if (error) return { error };
    if (data) return { customer: data };
  }

  const email = normalizeEmail(payload.customerEmail);
  const phoneNormalized = normalizePhone(payload.customerPhone);
  let customer: { id: string; name: string; email: string | null; phone: string | null; address?: string | null } | null =
    null;

  if (email) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id, name, email, phone")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { error };
    customer = data;
  }

  if (!customer && phoneNormalized) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id, name, email, phone")
      .eq("phone_normalized", phoneNormalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && !missingColumn(error.message, "phone_normalized")) return { error };
    if (!error) customer = data;
  }

  const address = payload.customerAddress?.trim() || null;
  const notes = address ? `Address: ${address}` : null;
  if (!customer) {
    const insertPayload: Record<string, string | null> = {
      address,
      created_by: createdBy,
      email: payload.customerEmail?.trim() || null,
      name: payload.customerName!.trim(),
      notes,
      phone: payload.customerPhone?.trim() || null,
    };
    let result = await adminClient.from("customers").insert(insertPayload).select("id, name, email, phone").single();

    if (result.error && missingColumn(result.error.message, "address")) {
      delete insertPayload.address;
      result = await adminClient.from("customers").insert(insertPayload).select("id, name, email, phone").single();
    }

    if (result.error) return { error: result.error };
    return { customer: result.data };
  }

  const patch: Record<string, string | null> = {};
  if (payload.customerName?.trim() && payload.customerName.trim() !== customer.name) patch.name = payload.customerName.trim();
  if (!customer.email && payload.customerEmail?.trim()) patch.email = payload.customerEmail.trim();
  if (!customer.phone && payload.customerPhone?.trim()) patch.phone = payload.customerPhone.trim();
  if (address) patch.address = address;

  if (Object.keys(patch).length === 0) return { customer };

  let result = await adminClient
    .from("customers")
    .update(patch)
    .eq("id", customer.id)
    .select("id, name, email, phone")
    .single();

  if (result.error && missingColumn(result.error.message, "address")) {
    delete patch.address;
    result = await adminClient
      .from("customers")
      .update(patch)
      .eq("id", customer.id)
      .select("id, name, email, phone")
      .single();
  }

  if (result.error) return { error: result.error };
  return { customer: result.data };
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Project creation is missing Supabase server configuration.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const payload = (await request.json()) as ProjectPayload;
  const artistId = payload.artistId?.trim() || null;
  const projectName = payload.projectName?.trim() ?? "";
  const customerName = payload.customerName?.trim() ?? "";
  const depositAmount = Number(payload.depositAmount ?? 0);

  if (!projectName) return jsonError("Project name is required.", 400);
  if (!customerName) return jsonError("Customer name is required.", 400);
  if (!artistId) return jsonError("Select an artist.", 400);
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return jsonError("Deposit amount must be a valid number.", 400);
  }

  const access = await requireProjectUser(token, artistId);
  if (!("user" in access)) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.user) return jsonError("Invalid login session.", 401);

  const requestId = payload.requestId?.trim() || "";
  if (requestId) {
    const { data: requestRow, error: requestError } = await access.adminClient
      .from("requests")
      .select("id, project_id, status")
      .eq("id", requestId)
      .single();

    if (requestError) return databaseError(requestError.message);
    if (requestRow?.project_id) return jsonError("This request already has a project.", 400);
    if (requestRow?.status === "spam") return jsonError("Restore this request before creating a project.", 400);
  }

  const customerResult = await findOrCreateCustomer(access.adminClient, payload, access.user.id);
  if ("error" in customerResult && customerResult.error) {
    return databaseError(customerResult.error.message);
  }

  const customer = customerResult.customer!;
  const memo = projectMemo(payload);
  const { data: project, error: projectError } = await access.adminClient
    .from("projects")
    .insert({
      artist_id: artistId,
      customer_id: customer.id,
      memo: memo || null,
      session_type: payload.projectType?.trim() || "Multiple Session",
      size: payload.tattooSize?.trim() || null,
      status: "on_hold",
      subject: projectName,
      waiver_signed: false,
      waiver_status: "missing",
    })
    .select("id")
    .single();

  if (projectError) return databaseError(projectError.message);

  if (depositAmount > 0) {
    const { error: depositError } = await access.adminClient.from("deposits").insert({
      amount: depositAmount,
      artist_id: artistId,
      available: true,
      customer_id: customer.id,
      memo: payload.depositMemo?.trim() || null,
      payment_method: payload.depositPaymentMethod || "cash",
      project_id: project.id,
      received_at: new Date().toISOString(),
    });

    if (depositError) return databaseError(depositError.message);
  }

  if (requestId) {
    const { error: requestError } = await access.adminClient
      .from("requests")
      .update({
        booked_at: new Date().toISOString(),
        customer_id: customer.id,
        project_id: project.id,
        status: "booked",
      })
      .eq("id", requestId);

    if (requestError) return databaseError(requestError.message);
  }

  return NextResponse.json({
    customerId: customer.id,
    projectId: project.id,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BookingPayload = {
  artistId?: string;
  projectSubject?: string;
  projectType?: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  appointmentNotes?: string;
  depositAmount?: number;
  depositPaymentMethod?: string;
  depositMemo?: string;
};

type RequestRow = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  tattoo_description: string | null;
  approximate_size: string | null;
  placement: string | null;
  reference_image_url: string | null;
  requested_artist_label: string | null;
  tattoo_timing_preference: string | null;
  notes: string | null;
  booked_at: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function roleKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function localDateTimeFromParts(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function requestDetailMemo(request: RequestRow) {
  return [
    request.notes,
    request.tattoo_description ? `Tattoo description: ${request.tattoo_description}` : null,
    request.approximate_size ? `Approximate size: ${request.approximate_size} inch` : null,
    request.placement ? `Placement: ${request.placement}` : null,
    request.tattoo_timing_preference
      ? `Timing preference: ${request.tattoo_timing_preference}`
      : null,
    request.reference_image_url ? `Reference image: ${request.reference_image_url}` : null,
    request.requested_artist_label ? `Requested artist: ${request.requested_artist_label}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function requireOperationsUser(token: string) {
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

  const { data: profileByEmail, error: profileByEmailError } =
    await adminClient.from("profiles").select("role").ilike("email", email).maybeSingle();

  if (profileByEmailError) return { error: profileByEmailError.message, status: 500 as const, adminClient };

  const profileRoles = [roleKey(profileById?.role), roleKey(profileByEmail?.role)];
  if (profileRoles.some((role) => ["owner", "admin", "front_desk"].includes(role))) {
    return { user: userData.user, adminClient };
  }

  const { data: staffByProfileId, error: staffByProfileIdError } = await adminClient
    .from("staff")
    .select("id, role, active")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (staffByProfileIdError) {
    return { error: staffByProfileIdError.message, status: 500 as const, adminClient };
  }

  const { data: staffByEmail, error: staffByEmailError } =
    await adminClient
        .from("staff")
        .select("id, role, active")
        .ilike("email", email)
        .maybeSingle();

  if (staffByEmailError) {
    return { error: staffByEmailError.message, status: 500 as const, adminClient };
  }

  const staff = staffByProfileId ?? staffByEmail;
  const staffRole = roleKey(staff?.role);
  if (staff?.active && ["owner", "admin", "front_desk"].includes(staffRole)) {
    return { user: userData.user, adminClient };
  }

  if (staff?.active && staff.id) {
    const { data: permissions, error: permissionError } = await adminClient
      .from("staff_permissions")
      .select("permission_key, enabled")
      .eq("staff_id", staff.id)
      .in("permission_key", ["calendarBooking", "staffAdmin"]);

    if (permissionError) {
      return { error: permissionError.message, status: 500 as const, adminClient };
    }

    if (permissions?.some((permission) => permission.enabled)) {
      return { user: userData.user, adminClient };
    }
  }

  return {
    error: "Only operations staff can book requests.",
    status: 403 as const,
    adminClient,
    debug: {
      userId: userData.user.id,
      email,
      profileByIdRole: profileById?.role ?? null,
      profileByEmailRole: profileByEmail?.role ?? null,
      staffByProfileId,
      staffByEmail,
    },
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Request booking is missing Supabase server configuration.", 500);
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireOperationsUser(token);
  if (!("user" in access)) {
    return NextResponse.json(
      { error: access.error, debug: "debug" in access ? access.debug : undefined },
      { status: access.status },
    );
  }

  const { id } = await params;
  const payload = (await request.json()) as BookingPayload;
  const artistId = payload.artistId?.trim() ?? "";
  const projectSubject = payload.projectSubject?.trim() ?? "";
  const projectType = payload.projectType?.trim() || "Multiple Session";
  const appointmentDate = payload.appointmentDate?.trim() ?? "";
  const startTime = payload.startTime?.trim() ?? "";
  const endTime = payload.endTime?.trim() ?? "";
  const depositAmount = Number(payload.depositAmount ?? 0);

  if (!artistId) return jsonError("Select an artist before booking this project.", 400);
  if (!projectSubject) return jsonError("Project name is required.", 400);

  const startsAt = localDateTimeFromParts(appointmentDate, startTime);
  const endsAt = localDateTimeFromParts(appointmentDate, endTime);
  if (!appointmentDate || !startTime || !endTime || endsAt <= startsAt) {
    return jsonError("First appointment needs a valid date, start time, and end time.", 400);
  }
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return jsonError("Deposit amount must be a valid number.", 400);
  }

  const { data: requestRow, error: requestError } = await access.adminClient
    .from("requests")
    .select(
      "id, customer_id, project_id, client_name, email, phone, subject, tattoo_description, approximate_size, placement, reference_image_url, requested_artist_label, tattoo_timing_preference, notes, booked_at",
    )
    .eq("id", id)
    .single();

  if (requestError) return jsonError(requestError.message, 500);

  const typedRequest = requestRow as RequestRow;
  if (typedRequest.project_id) {
    return jsonError("This request has already been booked as a project.", 400);
  }

  let customerId = typedRequest.customer_id;
  let customer: { id: string; name: string; email: string | null; phone: string | null } | null = null;

  if (!customerId && typedRequest.email) {
    const { data: matchingCustomer, error: matchingError } = await access.adminClient
      .from("customers")
      .select("id, name, email, phone")
      .ilike("email", normalizeEmail(typedRequest.email))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchingError) return jsonError(matchingError.message, 500);
    customer = matchingCustomer;
    customerId = matchingCustomer?.id ?? null;
  }

  if (!customerId) {
    const { data: createdCustomer, error: customerError } = await access.adminClient
      .from("customers")
      .insert({
        name: typedRequest.client_name,
        email: typedRequest.email,
        phone: typedRequest.phone,
        notes: requestDetailMemo(typedRequest),
      })
      .select("id, name, email, phone")
      .single();

    if (customerError) return jsonError(customerError.message, 500);
    customer = createdCustomer;
    customerId = createdCustomer.id;
  }

  const memo = requestDetailMemo(typedRequest);
  const { data: project, error: projectError } = await access.adminClient
    .from("projects")
    .insert({
      customer_id: customerId,
      artist_id: artistId,
      subject: projectSubject,
      size: typedRequest.approximate_size,
      session_type: projectType,
      status: "booked",
      waiver_signed: false,
      waiver_status: "missing",
      memo,
    })
    .select("id")
    .single();

  if (projectError) return jsonError(projectError.message, 500);

  const { data: appointment, error: appointmentError } = await access.adminClient
    .from("appointments")
    .insert({
      customer_id: customerId,
      project_id: project.id,
      artist_id: artistId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      appointment_type: projectType,
      status: "scheduled",
      notes: payload.appointmentNotes?.trim() || null,
    })
    .select("id")
    .single();

  if (appointmentError) return jsonError(appointmentError.message, 500);

  if (depositAmount > 0) {
    const { error: depositError } = await access.adminClient.from("deposits").insert({
      customer_id: customerId,
      project_id: project.id,
      artist_id: artistId,
      amount: depositAmount,
      payment_method: payload.depositPaymentMethod || "cash",
      received_at: new Date().toISOString(),
      available: true,
      memo: payload.depositMemo?.trim() || null,
    });

    if (depositError) return jsonError(depositError.message, 500);
  }

  const requestPatch = {
    customer_id: customerId,
    project_id: project.id,
    status: "booked",
    booked_at: typedRequest.booked_at ?? new Date().toISOString(),
  };

  const { error: requestUpdateError } = await access.adminClient
    .from("requests")
    .update(requestPatch)
    .eq("id", typedRequest.id);

  if (requestUpdateError) return jsonError(requestUpdateError.message, 500);

  return NextResponse.json({
    customer,
    request: requestPatch,
    projectId: project.id,
    appointmentId: appointment.id,
  });
}

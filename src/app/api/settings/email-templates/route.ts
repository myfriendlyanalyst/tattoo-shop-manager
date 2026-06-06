import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  defaultOperationsEmailTemplates,
  renderTemplateContent,
  type OperationsEmailTemplateKey,
} from "@/lib/email-templates/custom-email-templates";
import { fetchOperationsEmailTemplates } from "@/lib/email-templates/template-store";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

type TemplatePayload = {
  enabled?: boolean;
  html?: string;
  key?: OperationsEmailTemplateKey;
  subject?: string;
  testEmail?: string;
  testMode?: boolean;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function adminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireTemplateAdmin(token: string) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: "Email templates are not configured.", status: 500 as const };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const serviceClient = adminClient();
  if (!serviceClient) return { error: "Email templates are not configured.", status: 500 as const };

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Invalid login session.", status: 401 as const };
  }

  const email = userData.user.email?.toLowerCase() ?? "";
  const { data: profileById, error: byIdError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (byIdError) return { error: byIdError.message, status: 500 as const };

  const { data: profileByEmail, error: byEmailError } = profileById
    ? { data: null, error: null }
    : await serviceClient.from("profiles").select("role").ilike("email", email).maybeSingle();

  if (byEmailError) return { error: byEmailError.message, status: 500 as const };

  const role = profileById?.role ?? profileByEmail?.role;
  if (role !== "owner" && role !== "admin") {
    return { error: "Only owner/admin users can manage email templates.", status: 403 as const };
  }

  return { adminClient: serviceClient, user: userData.user };
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireTemplateAdmin(token);
  if ("error" in access) return jsonError(access.error ?? "Email templates failed.", access.status ?? 500);

  let templates;
  try {
    templates = await fetchOperationsEmailTemplates(access.adminClient, { fallbackOnError: false });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? `${error.message}. Run docs/operations_email_templates_migration.sql in Supabase SQL Editor.`
        : "Email templates could not be loaded.",
      500,
    );
  }

  return NextResponse.json({ templates });
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireTemplateAdmin(token);
  if ("error" in access) return jsonError(access.error ?? "Email templates failed.", access.status ?? 500);

  const payload = (await request.json()) as TemplatePayload;
  const fallback = defaultOperationsEmailTemplates.find((template) => template.key === payload.key);
  if (!payload.key || !fallback) return jsonError("Unknown email template.", 400);

  const subject = payload.subject?.trim() || fallback.subject;
  const html = payload.html?.trim() || fallback.html;
  const { data, error } = await access.adminClient
    .from("operations_email_templates")
    .upsert(
      {
        body_html: html,
        enabled: payload.enabled ?? fallback.enabled,
        subject,
        template_key: payload.key,
        test_mode: payload.testMode ?? fallback.testMode,
        updated_at: new Date().toISOString(),
        updated_by: access.user.id,
      },
      { onConflict: "template_key" },
    )
    .select("template_key, subject, body_html, enabled, test_mode")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({
    template: {
      ...fallback,
      subject: data.subject ?? fallback.subject,
      html: data.body_html ?? fallback.html,
      enabled: data.enabled ?? fallback.enabled,
      testMode: data.test_mode ?? fallback.testMode,
    },
  });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return jsonError("Missing login session.", 401);

  const access = await requireTemplateAdmin(token);
  if ("error" in access) return jsonError(access.error ?? "Email templates failed.", access.status ?? 500);

  const payload = (await request.json()) as TemplatePayload;
  const template = defaultOperationsEmailTemplates.find((item) => item.key === payload.key);
  const testEmail = payload.testEmail?.trim();
  if (!payload.key || !template) return jsonError("Unknown email template.", 400);
  if (!testEmail) return jsonError("Test email is required.", 400);
  if (!resendApiKey || !emailFrom) return jsonError("Missing RESEND_API_KEY or EMAIL_FROM.", 500);

  const rendered = renderTemplateContent(
    {
      subject: payload.subject?.trim() || template.subject,
      html: payload.html?.trim() || template.html,
    },
    {
      artistName: "YUSHI",
      artistPreference: "YUSHI",
      appointmentTime: "Friday, June 5, 2:00 PM PDT",
      customerName: "Test Client",
      newAppointmentTime: "Saturday, June 6, 3:00 PM PDT",
      oldAppointmentTime: "Friday, June 5, 2:00 PM PDT",
      projectName: "Backpiece tattoo",
    },
  );

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [testEmail],
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    }),
  });
  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    message?: string;
  };

  if (!resendResponse.ok) {
    return jsonError(resendPayload.message || resendPayload.error || "Test email failed.", 502);
  }

  return NextResponse.json({ providerMessageId: resendPayload.id ?? null, sent: true });
}

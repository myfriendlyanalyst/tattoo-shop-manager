import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

type PasswordResetPayload = {
  email?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function originFromRequest(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (!host) {
    return request.nextUrl.origin;
  }

  return `${forwardedProto ?? request.nextUrl.protocol.replace(":", "")}://${host}`;
}

function resetEmailHtml(resetUrl: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f4ef;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1f2428">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #d9d3c7;border-radius:8px">
            <tr>
              <td style="padding:28px 28px 12px">
                <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8a6f4d;font-weight:700">Oyabun</div>
                <h1 style="font-size:24px;line-height:32px;margin:10px 0 0">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;font-size:15px;line-height:24px;color:#4d555c">
                We received a request to reset your password. Use the button below to set a new password.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 28px 28px">
                <a href="${resetUrl}" style="display:inline-block;background:#9f5c3c;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">Set new password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;font-size:12px;line-height:18px;color:#697178">
                If you did not request this, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey || !emailFrom) {
    return jsonError("Password reset email is not configured.", 500);
  }

  const payload = (await request.json().catch(() => ({}))) as PasswordResetPayload;
  const email = payload.email?.trim().toLowerCase() ?? "";

  if (!isValidEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const origin = originFromRequest(request);
  const redirectTo = `${origin}/auth/callback?next=/set-password`;
  const { data, error } = await adminClient.auth.admin.generateLink({
    email,
    options: { redirectTo },
    type: "recovery",
  });

  if (error?.message.toLowerCase().includes("not found")) {
    return NextResponse.json({ sent: true });
  }

  if (error) {
    return jsonError(error.message, 400);
  }

  const hashedToken = data.properties?.hashed_token;
  const resetUrl = hashedToken
    ? `${origin}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=/set-password`
    : data.properties?.action_link;

  if (!resetUrl) {
    return jsonError("Password reset link could not be generated.", 500);
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      html: resetEmailHtml(resetUrl),
      subject: "Reset your Oyabun password",
      text: `Reset your Oyabun password: ${resetUrl}`,
      to: [email],
    }),
  });
  const resendPayload = (await resendResponse.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!resendResponse.ok) {
    return jsonError(resendPayload.message || resendPayload.error || "Password reset email failed.", 502);
  }

  return NextResponse.json({ sent: true });
}

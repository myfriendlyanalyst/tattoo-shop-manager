import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resend = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

function escapePdf(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

function makePdf(lines: string[]) {
  const stream = `BT /F1 12 Tf 50 750 Td ${lines
    .map((line, index) => `${index ? "0 -22 Td " : ""}(${escapePdf(line)}) Tj`)
    .join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!url || !key || !service || !resend || !from) {
    return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });
  }
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing login session." }, { status: 401 });

  const auth = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Invalid login session." }, { status: 401 });
  const { data: canAccess, error: accessError } = await auth.rpc("can_access_accounting");
  if (accessError || canAccess !== true) {
    return NextResponse.json({ error: "Accounting access is required." }, { status: 403 });
  }

  const { id } = await params;
  const { data: payout, error } = await admin
    .from("payouts")
    .select("period_start, period_end, status, settlement_amount, calculation_snapshot, artist:staff(display_name,email)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!["ready", "paid"].includes(payout.status)) {
    return NextResponse.json({ error: "Finalize the payout before emailing it." }, { status: 400 });
  }

  const artist = Array.isArray(payout.artist) ? payout.artist[0] : payout.artist;
  if (!artist?.email) return NextResponse.json({ error: "This artist has no email address." }, { status: 400 });
  const amount = Number(payout.settlement_amount ?? 0);
  const snapshot = (payout.calculation_snapshot ?? {}) as Record<string, unknown>;
  const detailLines = [
    ["Cash tattoo", snapshot.cashTattoo],
    ["Card tattoo", snapshot.cardTattoo],
    ["App tattoo", snapshot.appTattoo],
    ["Cash tip", snapshot.cashTip],
    ["Card tip", snapshot.cardTip],
    ["Manual adjustment", snapshot.adjustment],
  ].filter((item) => typeof item[1] === "number") as [string, number][];
  const lines = [
    "OYABUN TATTOO - PAYOUT STATEMENT",
    `Artist: ${artist.display_name}`,
    `Period: ${payout.period_start} to ${payout.period_end}`,
    ...detailLines.map(([label, value]) => `${label}: $${value.toFixed(2)}`),
    `${amount < 0 ? "Artist pays shop" : "Shop pays artist"}: $${Math.abs(amount).toFixed(2)}`,
    `Status: ${payout.status}`,
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [artist.email],
      subject: `Payout statement: ${payout.period_start} - ${payout.period_end}`,
      html: `<p>Hi ${artist.display_name},</p><p>Thank you for your work during this payout period.</p><p>Your statement for <strong>${payout.period_start} through ${payout.period_end}</strong> is attached. The settlement amount is <strong>$${Math.abs(amount).toFixed(2)}</strong> (${amount < 0 ? "artist pays shop" : "shop pays artist"}).</p><p>Please review it and let us know if you have any questions.</p><p>Thank you,<br>Oyabun Tattoo</p>`,
      attachments: [{ filename: `payout-${payout.period_start}-${payout.period_end}.pdf`, content: makePdf(lines).toString("base64") }],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: (body as { message?: string }).message ?? "Payout email failed." }, { status: 502 });
  }
  return NextResponse.json({ sent: true, to: artist.email });
}

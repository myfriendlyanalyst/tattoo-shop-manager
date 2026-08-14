import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resend = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

function escapePdf(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: unknown, maxLength = 42) {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim() || "-";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function dollars(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
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
  if (!url || !key) {
    return NextResponse.json({ error: "Database service is not configured." }, { status: 500 });
  }
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing login session." }, { status: 401 });

  const auth = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Invalid login session." }, { status: 401 });
  const { data: canAccess, error: accessError } = await auth.rpc("can_access_accounting");
  if (accessError || canAccess !== true) {
    return NextResponse.json({ error: "Accounting access is required." }, { status: 403 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as { to?: string; subject?: string; message?: string; preview?: boolean };
  const { data: payout, error } = await auth
    .from("payouts")
    .select("period_start, period_end, status, settlement_amount, calculation_snapshot, artist:staff(display_name,email)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!["ready", "paid"].includes(payout.status)) {
    return NextResponse.json({ error: "Finalize the payout before emailing it." }, { status: 400 });
  }

  const artist = Array.isArray(payout.artist) ? payout.artist[0] : payout.artist;
  const amount = Number(payout.settlement_amount ?? 0);
  const snapshot = (payout.calculation_snapshot ?? {}) as Record<string, unknown>;
  const tattoo = (snapshot.tattoo ?? {}) as Record<string, unknown>;
  const tip = (snapshot.tip ?? {}) as Record<string, unknown>;
  const savedStatementRows = Array.isArray(snapshot.statementRows)
    ? snapshot.statementRows as Record<string, unknown>[]
    : [];
  const entries = Array.isArray(snapshot.entries)
    ? snapshot.entries as Record<string, unknown>[]
    : [];
  const artistRate = Number(snapshot.artistRate ?? 0);
  const statementRows = savedStatementRows.length
    ? savedStatementRows
    : entries.map((entry) => ({
        artistPayout:
          Number(entry.tattoo_amount ?? 0) * artistRate / 100 + Number(entry.tip_amount ?? 0),
        customerName: entry.customer_name,
        enteredAt: entry.entered_at,
        projectSubject: entry.project_subject,
      }));
  if (!savedStatementRows.length && statementRows.length) {
    const difference = Number(snapshot.artistEarnings ?? 0) - statementRows.reduce(
      (sum, row) => sum + Number(row.artistPayout ?? 0),
      0,
    );
    statementRows[statementRows.length - 1].artistPayout =
      Number(statementRows[statementRows.length - 1].artistPayout ?? 0) + difference;
  }
  const sessionLines = statementRows.map((row) => {
    const date = pdfText(row.enteredAt, 10);
    const clientProject = pdfText(
      [row.customerName, row.projectSubject].filter(Boolean).join(" / "),
      48,
    );
    return `${date}  ${clientProject}  ${dollars(row.artistPayout)}`;
  });
  const adjustment = Number(snapshot.adjustmentAmount ?? 0);
  const appTattoo = Number(tattoo.app ?? 0);
  const appTip = Number(tip.app ?? 0);
  const lines = [
    "OYABUN TATTOO - PAYOUT STATEMENT",
    `Artist: ${artist.display_name}`,
    `Period: ${payout.period_start} to ${payout.period_end}`,
    "",
    "DATE        CLIENT / PROJECT                                  ARTIST PAYOUT",
    ...(sessionLines.length ? sessionLines : ["No session details available"]),
    "",
    `Session payout total: ${dollars(snapshot.artistEarnings)}`,
    `  Tattoo earnings: ${dollars(snapshot.tattooArtistEarnings)}`,
    `  Tip earnings: ${dollars(snapshot.tipArtistEarnings)}`,
    ...(appTattoo ? [`App tattoo already held: -${dollars(appTattoo)}`] : []),
    ...(appTip ? [`App tips already held: -${dollars(appTip)}`] : []),
    `Adjustment: ${dollars(adjustment)}`,
    `${amount < 0 ? "Artist pays shop" : "Shop pays artist"}: $${Math.abs(amount).toFixed(2)}`,
    `Status: ${payout.status}`,
  ];
  const pdf = makePdf(lines);
  if (payload.preview) {
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Disposition": `inline; filename="payout-${payout.period_start}-${payout.period_end}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  }

  if (!resend || !from) {
    return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });
  }
  const recipient = payload.to?.trim() || artist?.email?.trim();
  if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: payload.subject?.trim() || `Payout statement: ${payout.period_start} - ${payout.period_end}`,
      text: payload.message?.trim() || `Hi ${artist.display_name},\n\nYour payout statement is attached.\n\nThank you,\nOyabun Tattoo`,
      attachments: [{ filename: `payout-${payout.period_start}-${payout.period_end}.pdf`, content: pdf.toString("base64") }],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: (body as { message?: string }).message ?? "Payout email failed." }, { status: 502 });
  }
  return NextResponse.json({ sent: true, to: recipient });
}

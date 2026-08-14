import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resend = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

function dollars(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

type PdfStatementRow = {
  artistPayout: number;
  customerName: unknown;
  enteredAt: unknown;
  projectSubject: unknown;
};

function fitText(value: unknown, font: PDFFont, size: number, maxWidth: number) {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim() || "-";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function statementDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

async function makePdf({
  adjustment,
  appTattoo,
  appTip,
  artistName,
  periodEnd,
  periodStart,
  rows,
  settlementAmount,
  status,
  tattooEarnings,
  tipEarnings,
  totalEarnings,
}: {
  adjustment: number;
  appTattoo: number;
  appTip: number;
  artistName: string;
  periodEnd: string;
  periodStart: string;
  rows: PdfStatementRow[];
  settlementAmount: number;
  status: string;
  tattooEarnings: number;
  tipEarnings: number;
  totalEarnings: number;
}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const ink = rgb(0.12, 0.14, 0.16);
  const muted = rgb(0.39, 0.44, 0.47);
  const blue = rgb(0.14, 0.42, 0.56);
  const cream = rgb(0.97, 0.95, 0.91);
  const line = rgb(0.87, 0.84, 0.78);
  const pages: PDFPage[] = [];

  function addPage(includeStatementHeader: boolean) {
    const page = document.addPage([pageWidth, pageHeight]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: pageHeight - 9, width: pageWidth, height: 9, color: ink });
    page.drawText("OYABUN TATTOO", { x: margin, y: pageHeight - 55, size: 18, font: bold, color: ink });
    page.drawText("PAYOUT STATEMENT", { x: pageWidth - margin - 152, y: pageHeight - 54, size: 12, font: bold, color: blue });
    if (includeStatementHeader) {
      page.drawText(`Artist  ${artistName}`, { x: margin, y: pageHeight - 92, size: 12, font: bold, color: ink });
      page.drawText(`Period  ${statementDate(periodStart)} - ${statementDate(periodEnd)}`, { x: margin, y: pageHeight - 114, size: 10, font: regular, color: muted });
      const statusText = status.toUpperCase();
      const statusWidth = bold.widthOfTextAtSize(statusText, 9) + 20;
      page.drawRectangle({ x: pageWidth - margin - statusWidth, y: pageHeight - 116, width: statusWidth, height: 20, color: cream });
      page.drawText(statusText, { x: pageWidth - margin - statusWidth + 10, y: pageHeight - 109, size: 9, font: bold, color: ink });
    }
    return page;
  }

  function drawTableHeader(page: PDFPage, y: number) {
    page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: ink });
    page.drawText("DATE", { x: margin + 10, y: y - 17, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText("CLIENT / PROJECT", { x: margin + 112, y: y - 17, size: 8, font: bold, color: rgb(1, 1, 1) });
    const payoutHeader = "ARTIST PAYOUT";
    page.drawText(payoutHeader, { x: pageWidth - margin - 10 - bold.widthOfTextAtSize(payoutHeader, 8), y: y - 17, size: 8, font: bold, color: rgb(1, 1, 1) });
    return y - 25;
  }

  let page = addPage(true);
  let y = drawTableHeader(page, pageHeight - 145);
  const displayedRows = rows.length ? rows : [{ artistPayout: 0, customerName: "No sessions", enteredAt: "", projectSubject: "" }];
  for (const [index, row] of displayedRows.entries()) {
    if (y < 105) {
      page = addPage(false);
      y = drawTableHeader(page, pageHeight - 78);
    }
    const rowHeight = 46;
    if (index % 2 === 1) page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.99, 0.98, 0.96) });
    page.drawText(statementDate(row.enteredAt), { x: margin + 10, y: y - 20, size: 9, font: regular, color: muted });
    page.drawText(fitText(row.customerName, bold, 10, 285), { x: margin + 112, y: y - 17, size: 10, font: bold, color: ink });
    page.drawText(fitText(row.projectSubject, regular, 8.5, 285), { x: margin + 112, y: y - 32, size: 8.5, font: regular, color: muted });
    const payoutText = dollars(row.artistPayout);
    page.drawText(payoutText, { x: pageWidth - margin - 10 - bold.widthOfTextAtSize(payoutText, 10), y: y - 23, size: 10, font: bold, color: ink });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: pageWidth - margin, y: y - rowHeight }, thickness: 0.5, color: line });
    y -= rowHeight;
  }

  const summaryRows = [
    ["Session payout total", dollars(totalEarnings)],
    ["Tattoo earnings", dollars(tattooEarnings)],
    ["Tip earnings", dollars(tipEarnings)],
    ...(appTattoo ? [["App tattoo already held", `-${dollars(appTattoo)}`]] : []),
    ...(appTip ? [["App tips already held", `-${dollars(appTip)}`]] : []),
    ["Adjustment", dollars(adjustment)],
  ];
  const summaryHeight = summaryRows.length * 22 + 64;
  if (y - summaryHeight < 65) {
    page = addPage(false);
    y = pageHeight - 82;
  } else {
    y -= 26;
  }
  const cardWidth = 310;
  const cardX = pageWidth - margin - cardWidth;
  page.drawRectangle({ x: cardX, y: y - summaryHeight, width: cardWidth, height: summaryHeight, color: cream, borderColor: line, borderWidth: 0.8 });
  page.drawText("SETTLEMENT SUMMARY", { x: cardX + 18, y: y - 23, size: 9, font: bold, color: muted });
  let summaryY = y - 47;
  for (const [label, value] of summaryRows) {
    page.drawText(label, { x: cardX + 18, y: summaryY, size: 9, font: regular, color: muted });
    page.drawText(value, { x: cardX + cardWidth - 18 - bold.widthOfTextAtSize(value, 9), y: summaryY, size: 9, font: bold, color: ink });
    summaryY -= 22;
  }
  page.drawLine({ start: { x: cardX + 18, y: summaryY + 8 }, end: { x: cardX + cardWidth - 18, y: summaryY + 8 }, thickness: 1.2, color: ink });
  const finalLabel = settlementAmount < 0 ? "ARTIST PAYS SHOP" : "SHOP PAYS ARTIST";
  const finalAmount = dollars(Math.abs(settlementAmount));
  page.drawText(finalLabel, { x: cardX + 18, y: summaryY - 14, size: 11, font: bold, color: ink });
  page.drawText(finalAmount, { x: cardX + cardWidth - 18 - bold.widthOfTextAtSize(finalAmount, 14), y: summaryY - 16, size: 14, font: bold, color: blue });

  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: margin, y: 38 }, end: { x: pageWidth - margin, y: 38 }, thickness: 0.5, color: line });
    currentPage.drawText("Thank you for your work. Please contact Oyabun Tattoo with any questions.", { x: margin, y: 22, size: 7.5, font: regular, color: muted });
    const pageNumber = `${index + 1} / ${pages.length}`;
    currentPage.drawText(pageNumber, { x: pageWidth - margin - regular.widthOfTextAtSize(pageNumber, 7.5), y: 22, size: 7.5, font: regular, color: muted });
  });

  return Buffer.from(await document.save());
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
  const adjustment = Number(snapshot.adjustmentAmount ?? 0);
  const appTattoo = Number(tattoo.app ?? 0);
  const appTip = Number(tip.app ?? 0);
  const pdf = await makePdf({
    adjustment,
    appTattoo,
    appTip,
    artistName: artist?.display_name ?? "Artist",
    periodEnd: payout.period_end,
    periodStart: payout.period_start,
    rows: statementRows.map((row) => ({
      artistPayout: Number(row.artistPayout ?? 0),
      customerName: row.customerName,
      enteredAt: row.enteredAt,
      projectSubject: row.projectSubject,
    })),
    settlementAmount: amount,
    status: payout.status,
    tattooEarnings: Number(snapshot.tattooArtistEarnings ?? 0),
    tipEarnings: Number(snapshot.tipArtistEarnings ?? 0),
    totalEarnings: Number(snapshot.artistEarnings ?? 0),
  });
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
      text: payload.message?.trim() || `Hi ${artist?.display_name ?? "Artist"},\n\nYour payout statement is attached.\n\nThank you,\nOyabun Tattoo`,
      attachments: [{ filename: `payout-${payout.period_start}-${payout.period_end}.pdf`, content: pdf.toString("base64") }],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: (body as { message?: string }).message ?? "Payout email failed." }, { status: 502 });
  }
  return NextResponse.json({ sent: true, to: recipient });
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeSession, getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";
import {
  calculatePayout,
  type PayoutCalculation,
  type PayoutSession,
} from "@/lib/payout-calculation";

type PayoutRow = {
  id: string;
  artist_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "ready" | "paid" | "void";
  paid_at: string | null;
  notes: string | null;
  // Requires migration: supabase_accounting_migration.sql section 5
  adjustment_amount: number;
  adjustment_note: string | null;
  calculation_snapshot: PayoutCalculationSnapshot | null;
  snapshot_at: string | null;
  artist_earnings: number | null;
  settlement_amount: number | null;
  created_at: string;
  artist: { display_name: string; email?: string | null; payout_rate?: number | null } | { display_name: string; email?: string | null; payout_rate?: number | null }[] | null;
};

type PayoutStatementRow = {
  sessionId: string;
  enteredAt: string;
  customerName: string | null;
  projectSubject: string | null;
  artistPayout: number;
};

type PayoutCalculationSnapshot = PayoutCalculation & {
    adjustmentAmount?: number;
    entries?: EntryRow[];
    sessionIds?: string[];
    statementRows?: PayoutStatementRow[];
};

type EntryRow = {
  id: string;
  entered_at: string;
  entry_type: string;
  customer_name: string | null;
  project_subject: string | null;
  tattoo_amount: number;
  tip_amount: number;
  merch_amount: number;
  total_amount: number;
  tattoo_payment_method: string | null;
  tip_payment_method: string | null;
};

type SessionPaymentRow = {
  session_entry_id: string;
  payment_type: "tattoo" | "tip";
  payment_method: string;
  amount: number;
};

type DepositApplicationRow = {
  session_entry_id: string;
  amount: number;
  deposit: { payment_method: string } | { payment_method: string }[] | null;
};

type PayoutBundle = {
  calculation: PayoutCalculationSnapshot;
  entries: EntryRow[];
};

type AdjFormEntry = { amount: string; note: string; isAutoCalc: boolean };

type StaffRecord = { id: string; display_name: string; payout_rate: number | null };
type FilterStatus = "all" | "draft" | "ready" | "paid" | "void";
type NewPayoutForm = {
  artist_id: string;
  period_start: string;
  period_end: string;
  notes: string;
};
type PayoutOverlapRow = Pick<PayoutRow, "id" | "period_start" | "period_end" | "status">;

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function localDateValue(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function statusLabel(status: string) {
  return { draft: "Draft", ready: "Finalized", paid: "Paid", void: "Cancelled" }[status] ?? status;
}

function statusClasses(status: string) {
  return (
    {
      draft: "bg-[#f1eadc] text-[#775f36]",
      ready: "bg-[#e8eef7] text-[#2a4a7f]",
      paid: "bg-[#e4f1df] text-[#476b33]",
      void: "bg-[#f5e8e8] text-[#7a2020]",
    }[status] ?? "bg-[#eee8dd] text-[#4d555c]"
  );
}

function paymentMethodLabel(method: string | null) {
  return (
    { cash: "Cash", credit_card: "Card", app: "App", other: "Other" }[method ?? ""] ??
    method ?? "-"
  );
}

function paymentMethodClasses(method: string | null) {
  return (
    {
      cash: "bg-[#e8f3e8] text-[#2d6a2d]",
      credit_card: "bg-[#e8eef7] text-[#2a4a7f]",
      app: "bg-[#f6efe3] text-[#7a5420]",
    }[method ?? ""] ?? "bg-[#eee8dd] text-[#4d555c]"
  );
}

function entryTypeLabel(type: string) {
  return { session: "Session", deposit: "Deposit", merch: "Merch" }[type] ?? type;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const payoutSelect =
  "id, artist_id, period_start, period_end, status, paid_at, notes, adjustment_amount, adjustment_note, calculation_snapshot, snapshot_at, artist_earnings, settlement_amount, created_at, artist:staff(display_name, email, payout_rate)";

const basePayoutSelect =
  "id, artist_id, period_start, period_end, status, paid_at, notes, created_at, artist:staff(display_name, email, payout_rate)";

const entrySelect =
  "id, entered_at, entry_type, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method, tip_payment_method";

function isMissingAdjustmentColumn(message: string) {
  return (
    message.includes("adjustment_amount") ||
    message.includes("adjustment_note") ||
    message.includes("calculation_snapshot") ||
    message.includes("snapshot_at") ||
    message.includes("artist_earnings") ||
    message.includes("settlement_amount")
  );
}

function withAdjustmentDefaults(rows: unknown[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    ...(row as Omit<PayoutRow, "adjustment_amount" | "adjustment_note">),
    adjustment_amount: Number((row as Partial<PayoutRow>).adjustment_amount ?? 0),
    adjustment_note: (row as Partial<PayoutRow>).adjustment_note ?? null,
    artist_earnings: (row as Partial<PayoutRow>).artist_earnings ?? null,
    calculation_snapshot: (row as Partial<PayoutRow>).calculation_snapshot ?? null,
    settlement_amount: (row as Partial<PayoutRow>).settlement_amount ?? null,
    snapshot_at: (row as Partial<PayoutRow>).snapshot_at ?? null,
  })) as PayoutRow[];
}

async function fetchPayouts() {
  const result = await supabase
    .from("payouts")
    .select(payoutSelect)
    .order("created_at", { ascending: false });

  if (!result.error || !isMissingAdjustmentColumn(result.error.message)) {
    return result;
  }

  return supabase
    .from("payouts")
    .select(basePayoutSelect)
    .order("created_at", { ascending: false });
}

async function fetchEntriesForPayout(artistId: string, periodStart: string, periodEnd: string) {
  const fromTs = new Date(`${periodStart}T00:00:00`).toISOString();
  const toTs = new Date(`${periodEnd}T23:59:59.999`).toISOString();
  return supabase
    .from("accounting_entries")
    .select(entrySelect)
    .eq("artist_id", artistId)
    .gte("entered_at", fromTs)
    .lte("entered_at", toTs)
    .order("entered_at", { ascending: false });
}

async function fetchPayoutBundle(
  artistId: string,
  periodStart: string,
  periodEnd: string,
  artistRate: number,
): Promise<{ data: PayoutBundle | null; error: string | null }> {
  const entryResult = await fetchEntriesForPayout(artistId, periodStart, periodEnd);
  if (entryResult.error) return { data: null, error: entryResult.error.message };

  const entries = ((entryResult.data ?? []) as EntryRow[]).filter(
    (entry) => entry.entry_type === "session",
  );
  if (!entries.length) {
    return { data: { calculation: calculatePayout([], artistRate), entries: [] }, error: null };
  }

  const sessionIds = entries.map((entry) => entry.id);
  const [paymentResult, depositResult] = await Promise.all([
    supabase
      .from("session_payments")
      .select("session_entry_id, payment_type, payment_method, amount")
      .in("session_entry_id", sessionIds),
    supabase
      .from("deposit_applications")
      .select("session_entry_id, amount, deposit:deposits(payment_method)")
      .in("session_entry_id", sessionIds),
  ]);

  if (paymentResult.error) return { data: null, error: paymentResult.error.message };
  if (depositResult.error) return { data: null, error: depositResult.error.message };

  const payments = (paymentResult.data ?? []) as SessionPaymentRow[];
  const deposits = (depositResult.data ?? []) as DepositApplicationRow[];
  const sessions: PayoutSession[] = entries.map((entry) => ({
    deposits: deposits
      .filter((deposit) => deposit.session_entry_id === entry.id)
      .map((deposit) => ({
        amount: Number(deposit.amount),
        paymentMethod: relatedOne(deposit.deposit)?.payment_method ?? null,
      })),
    id: entry.id,
    payments: payments
      .filter((payment) => payment.session_entry_id === entry.id)
      .map((payment) => ({
        amount: Number(payment.amount),
        paymentMethod: payment.payment_method,
        paymentType: payment.payment_type,
      })),
    tattooAmount: Number(entry.tattoo_amount),
    tattooPaymentMethod: entry.tattoo_payment_method,
    tipAmount: Number(entry.tip_amount),
    tipPaymentMethod: entry.tip_payment_method,
  }));

  const calculation = calculatePayout(sessions, artistRate);
  const statementRows = entries.map((entry, index) => {
    const sessionCalculation = calculatePayout([sessions[index]], artistRate);
    return {
      artistPayout: sessionCalculation.artistEarnings,
      customerName: entry.customer_name,
      enteredAt: entry.entered_at,
      projectSubject: entry.project_subject,
      sessionId: entry.id,
    };
  });
  const rowDifference = Math.round(
    (calculation.artistEarnings - statementRows.reduce((sum, row) => sum + row.artistPayout, 0)) * 100,
  ) / 100;
  if (statementRows.length && rowDifference) {
    statementRows[statementRows.length - 1].artistPayout = Math.round(
      (statementRows[statementRows.length - 1].artistPayout + rowDifference) * 100,
    ) / 100;
  }

  return {
    data: { calculation: { ...calculation, statementRows }, entries },
    error: null,
  };
}

function printPayout(
  payout: PayoutRow,
  entries: EntryRow[],
  calculation: PayoutCalculationSnapshot,
  adjustmentAmount: number,
  finalPayout: number,
  adjustmentNote: string | null,
) {
  const artist = relatedOne(payout.artist);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
    return;
  }

  const statementRows = calculation.statementRows ? [...calculation.statementRows] : entries.map((entry) => ({
    artistPayout: Number(entry.tattoo_amount) * calculation.artistRate / 100 + Number(entry.tip_amount),
    customerName: entry.customer_name,
    enteredAt: entry.entered_at,
    projectSubject: entry.project_subject,
    sessionId: entry.id,
  }));
  if (!calculation.statementRows?.length && statementRows.length) {
    const difference = Math.round(
      (calculation.artistEarnings - statementRows.reduce((sum, row) => sum + row.artistPayout, 0)) * 100,
    ) / 100;
    statementRows[statementRows.length - 1].artistPayout += difference;
  }
  const rows = statementRows
    .map(
      (row) => `<tr>
      <td>${formatDate(row.enteredAt)}</td>
      <td>${escapeHtml(row.customerName || "-")}<div class="project">${escapeHtml(row.projectSubject || "-")}</div></td>
      <td style="text-align:right"><strong>${money(Number(row.artistPayout))}</strong></td>
    </tr>`,
    )
    .join("");

  const adjNote = adjustmentNote ? ` (${escapeHtml(adjustmentNote)})` : "";
  const statusColor = payout.status === "paid" ? "#476b33" : payout.status === "void" ? "#7a2020" : "#775f36";
  const statusBg = payout.status === "paid" ? "#e4f1df" : payout.status === "void" ? "#f5e8e8" : "#f1eadc";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Payout - ${escapeHtml(artist?.display_name || "Unknown")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2428; max-width: 800px; margin: 40px auto; padding: 0 24px; }
    h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
    .meta { color: #697178; font-size: 12px; margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${statusBg}; color: ${statusColor}; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 16px 0; }
    th { text-align: left; border-bottom: 2px solid #1f2428; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #697178; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5dfd4; vertical-align: top; }
    .project { margin-top: 2px; color: #697178; font-size: 11px; }
    .totals-wrap { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-table { width: 300px; }
    .totals-table td { border-bottom: none; }
    .totals-table td:first-child { color: #697178; }
    .totals-table td:last-child { text-align: right; font-weight: 700; }
    .total-row td { font-size: 15px; font-weight: 900; border-top: 2px solid #1f2428; padding-top: 8px; }
    .total-row td:last-child { color: #236c8f; }
    .notes { margin-top: 16px; font-size: 12px; color: #697178; padding: 10px 12px; background: #f7f2e9; border-radius: 6px; }
    .footer { margin-top: 32px; font-size: 11px; color: #9a9a9a; border-top: 1px solid #e5dfd4; padding-top: 8px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Payout &mdash; ${escapeHtml(artist?.display_name || "Unknown")}</h1>
  <div class="meta">
    <span>Period: ${formatDate(payout.period_start)} &ndash; ${formatDate(payout.period_end)}</span>
    <span class="status-badge">${statusLabel(payout.status)}</span>
    ${payout.paid_at ? `<span>Paid: ${formatDate(payout.paid_at)}</span>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Client / Project</th>
        <th style="text-align:right">Artist payout</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="3" style="text-align:center;color:#697178;padding:20px">No sessions for this period</td></tr>`}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      <tr><td>Session payout total</td><td>${money(calculation.artistEarnings)}</td></tr>
      <tr><td>Includes tattoo earnings</td><td>${money(calculation.tattooArtistEarnings)}</td></tr>
      <tr><td>Includes tip earnings</td><td>${money(calculation.tipArtistEarnings)}</td></tr>
      ${calculation.tattoo.app ? `<tr><td>App tattoo already held</td><td>-${money(calculation.tattoo.app)}</td></tr>` : ""}
      ${calculation.tip.app ? `<tr><td>App tips already held</td><td>-${money(calculation.tip.app)}</td></tr>` : ""}
      <tr><td>Adjustment${adjNote}</td><td>${money(adjustmentAmount)}</td></tr>
      <tr class="total-row"><td>${finalPayout < 0 ? "Artist pays shop" : "Shop pays artist"}</td><td>${money(Math.abs(finalPayout))}</td></tr>
    </table>
  </div>

  ${payout.notes ? `<div class="notes">Notes: ${escapeHtml(payout.notes)}</div>` : ""}

  <div class="footer">Printed ${new Date().toLocaleString("en-US")} &nbsp;&middot;&nbsp; Oyabun Accounting</div>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

export default function PayoutsPage() {
  const router = useRouter();
  const now = new Date();

  // Page state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [emailPayoutDraft, setEmailPayoutDraft] = useState<PayoutRow | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // New payout modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPayoutForm>({
    artist_id: "",
    period_start: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    period_end: localDateValue(now),
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [previewEntries, setPreviewEntries] = useState<EntryRow[] | null>(null);
  const [previewCalculation, setPreviewCalculation] = useState<PayoutCalculation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Expanded detail
  const [expandedPayoutId, setExpandedPayoutId] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, EntryRow[]>>({});
  const [expandedCalculations, setExpandedCalculations] = useState<Record<string, PayoutCalculationSnapshot>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<string, boolean>>({});
  const [adjustmentForm, setAdjustmentForm] = useState<Record<string, AdjFormEntry>>({});
  const [adjustmentSaving, setAdjustmentSaving] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/payouts");
        return;
      }

      const hasAccess = await hasAccountingAccess(user.id);
      if (!hasAccess) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const [payoutResult, staffResult] = await Promise.all([
        fetchPayouts(),
        supabase
          .from("staff")
          .select("id, display_name, payout_rate")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (payoutResult.error) {
        setError(payoutResult.error.message);
        setLoading(false);
        return;
      }
      if (staffResult.error) {
        setError(staffResult.error.message);
        setLoading(false);
        return;
      }

      setPayouts(withAdjustmentDefaults(payoutResult.data));
      setArtists((staffResult.data ?? []) as StaffRecord[]);
      setLoading(false);
    }

    load();
  }, [router]);

  // Auto-preview entries when modal form is fully filled
  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      await Promise.resolve();
      if (cancelled) return;

      setPreviewEntries(null);
      setPreviewCalculation(null);

      if (!showModal || !form.artist_id || !form.period_start || !form.period_end) {
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);

      const artistRate = artists.find((artist) => artist.id === form.artist_id)?.payout_rate;
      if (artistRate === null || artistRate === undefined) {
        setPreviewLoading(false);
        return;
      }
      const result = await fetchPayoutBundle(
        form.artist_id,
        form.period_start,
        form.period_end,
        artistRate,
      );

      if (cancelled) return;
      if (!result.error && result.data) {
        setPreviewEntries(result.data.entries);
        setPreviewCalculation(result.data.calculation);
      }
      setPreviewLoading(false);
    }

    loadPreview();

    return () => { cancelled = true; };
  }, [artists, showModal, form.artist_id, form.period_start, form.period_end]);

  const filtered = statusFilter === "all" ? payouts.filter((p) => p.status !== "void") : payouts.filter((p) => p.status === statusFilter);

  const counts = {
    draft: payouts.filter((p) => p.status === "draft").length,
    ready: payouts.filter((p) => p.status === "ready").length,
    paid: payouts.filter((p) => p.status === "paid").length,
    void: payouts.filter((p) => p.status === "void").length,
  };

  async function updateStatus(
    payout: PayoutRow,
    newStatus: "ready" | "paid" | "void",
    label: string,
  ) {
    if (!window.confirm(`${label} this payout?`)) return;

    setSaving(true);
    setError("");
    setMessage("");

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();

    if (newStatus === "ready") {
      const calculation = expandedCalculations[payout.id];
      const entries = expandedEntries[payout.id];
      const adjustment = adjustmentForm[payout.id];
      const adjustmentAmount = adjustment
        ? Number(adjustment.amount || 0)
        : Number(payout.adjustment_amount ?? 0);
      if (!calculation || !entries) {
        setError("Open this payout and review its calculation before marking it ready.");
        setSaving(false);
        return;
      }
      if (adjustmentAmount !== 0 && !(adjustment?.note ?? payout.adjustment_note)?.trim()) {
        setError("An adjustment reason is required when the adjustment is not zero.");
        setSaving(false);
        return;
      }

      const itemResult = entries.length
        ? await supabase.from("payout_items").insert(
            entries.map((entry) => ({
              amount: Number(entry.tattoo_amount) + Number(entry.tip_amount),
              item_type: "session",
              payout_id: payout.id,
              session_entry_id: entry.id,
            })),
          )
        : { error: null };
      if (itemResult.error) {
        setError(
          itemResult.error.message.includes("idx_payout_items_unique_session")
            ? "One or more sessions are already included in another payout."
            : `${itemResult.error.message}. Run docs/payout_settlement_migration.sql in Supabase SQL Editor.`,
        );
        setSaving(false);
        return;
      }

      Object.assign(updates, {
        artist_earnings: calculation.artistEarnings,
        artist_rate_snapshot: calculation.artistRate,
        calculation_snapshot: {
          ...calculation,
          adjustmentAmount,
          entries,
          sessionIds: entries.map((entry) => entry.id),
        },
        card_tip_fee_rate_snapshot: calculation.cardTipFeeRate,
        settlement_amount: Math.round(
          (calculation.settlementBeforeAdjustment + adjustmentAmount) * 100,
        ) / 100,
        snapshot_at: new Date().toISOString(),
      });
    }

    const result = await supabase.from("payouts").update(updates).eq("id", payout.id);

    if (result.error) {
      if (newStatus === "ready") {
        await supabase.from("payout_items").delete().eq("payout_id", payout.id);
      }
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (newStatus === "void") {
      await supabase.from("payout_items").delete().eq("payout_id", payout.id);
    }

    setPayouts((current) =>
      current.map((p) =>
        p.id === payout.id
          ? {
              ...p,
              status: newStatus,
              paid_at: newStatus === "paid" ? new Date().toISOString() : p.paid_at,
            }
          : p,
      ),
    );
    setMessage(`Payout marked as ${statusLabel(newStatus).toLowerCase()}.`);
    setSaving(false);
  }

  function openEmailPayout(payout: PayoutRow) {
    const artist = relatedOne(payout.artist);
    const amount = Number(payout.settlement_amount ?? 0);
    setEmailPayoutDraft(payout);
    setEmailTo(artist?.email ?? "");
    setEmailSubject(`Payout statement: ${payout.period_start} - ${payout.period_end}`);
    setEmailBody(`Hi ${artist?.display_name ?? "Artist"},\n\nThank you for your work during this payout period.\n\nYour payout statement for ${payout.period_start} through ${payout.period_end} is attached. The settlement amount is ${money(Math.abs(amount))} (${amount < 0 ? "artist pays shop" : "shop pays artist"}).\n\nPlease review it and let us know if you have any questions.\n\nThank you,\nOyabun Tattoo`);
  }

  async function emailPayout() {
    if (!emailPayoutDraft || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) {
      setError("Recipient, subject, and message are required.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    const session = await getSafeSession();
    const response = await fetch(`/api/accounting/payouts/${emailPayoutDraft.id}/email`, { method:"POST", headers:{ Authorization:`Bearer ${session?.access_token ?? ""}`, "Content-Type":"application/json" }, body: JSON.stringify({ to: emailTo.trim(), subject: emailSubject.trim(), message: emailBody.trim() }) });
    const payload = await response.json() as { error?:string; to?:string };
    if (!response.ok) setError(payload.error ?? "Payout email failed."); else { setMessage(`Payout statement emailed to ${payload.to}.`); setEmailPayoutDraft(null); }
    setSaving(false);
  }

  async function previewPayoutPdf() {
    if (!emailPayoutDraft) return;
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      setError("Pop-up blocked. Please allow pop-ups to preview the PDF.");
      return;
    }
    previewWindow.document.write("<p style='font-family:sans-serif;padding:24px'>Loading payout PDF...</p>");
    setPreviewingPdf(true);
    setError("");
    const session = await getSafeSession();
    const response = await fetch(`/api/accounting/payouts/${emailPayoutDraft.id}/email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ preview: true }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      previewWindow.close();
      setError(payload.error ?? "Payout PDF preview failed.");
      setPreviewingPdf(false);
      return;
    }
    const pdfUrl = URL.createObjectURL(await response.blob());
    previewWindow.location.href = pdfUrl;
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    setPreviewingPdf(false);
  }

  async function deleteDraftPayout(payout: PayoutRow) {
    if (payout.status !== "draft") {
      setError("Only draft payouts can be deleted.");
      return;
    }

    if (
      !window.confirm(
        `Delete this draft payout for ${formatDate(payout.period_start)} - ${formatDate(
          payout.period_end,
        )}?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("payouts")
      .delete()
      .eq("id", payout.id)
      .eq("status", "draft");

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setPayouts((current) => current.filter((p) => p.id !== payout.id));
    setExpandedEntries((current) => {
      const next = { ...current };
      delete next[payout.id];
      return next;
    });
    setAdjustmentForm((current) => {
      const next = { ...current };
      delete next[payout.id];
      return next;
    });
    setExpandedPayoutId((current) => (current === payout.id ? null : current));
    setMessage("Draft payout deleted.");
    setSaving(false);
  }

  async function createPayout() {
    setFormError("");
    if (!form.artist_id) { setFormError("Select an artist."); return; }
    if (!form.period_start || !form.period_end) {
      setFormError("Period start and end are required.");
      return;
    }
    if (form.period_end < form.period_start) {
      setFormError("Period end must be on or after period start.");
      return;
    }

    setSaving(true);

    const { data: overlapping, error: overlapError } = await supabase
      .from("payouts")
      .select("id, period_start, period_end, status")
      .eq("artist_id", form.artist_id)
      .neq("status", "void")
      .lte("period_start", form.period_end)
      .gte("period_end", form.period_start)
      .limit(1);

    if (overlapError) {
      setFormError(overlapError.message);
      setSaving(false);
      return;
    }

    const conflict = ((overlapping ?? []) as PayoutOverlapRow[])[0];
    if (conflict) {
      setFormError(
        `This period overlaps an existing ${statusLabel(conflict.status).toLowerCase()} payout (${formatDate(
          conflict.period_start,
        )} - ${formatDate(conflict.period_end)}). Cancel it first or choose a different range.`,
      );
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("payouts")
      .insert({
        artist_id: form.artist_id,
        period_start: form.period_start,
        period_end: form.period_end,
        notes: form.notes || null,
        status: "draft",
      })
      .select(basePayoutSelect)
      .single();

    if (insertError) {
      setFormError(insertError.message);
      setSaving(false);
      return;
    }

    setPayouts((current) => [withAdjustmentDefaults([data])[0], ...current]);
    setShowModal(false);
    setPreviewEntries(null);
    setForm({
      artist_id: "",
      period_start: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      period_end: localDateValue(now),
      notes: "",
    });
    setMessage("Payout period created.");
    setSaving(false);
  }

  function seedAdjustmentForm(payout: PayoutRow) {
    setAdjustmentForm((prev) => {
      if (prev[payout.id]) return prev;

      const savedAdj = Number(payout.adjustment_amount ?? 0);
      const savedNote = payout.adjustment_note ?? "";

      return {
        ...prev,
        [payout.id]: {
          amount: String(savedAdj),
          note: savedNote,
          isAutoCalc: false,
        },
      };
    });
  }

  async function toggleExpand(payout: PayoutRow) {
    const id = payout.id;

    if (expandedPayoutId === id) {
      setExpandedPayoutId(null);
      return;
    }

    setExpandedPayoutId(id);

    if (expandedEntries[id] !== undefined) {
      // Already loaded; seed adjustment form if not yet done.
      seedAdjustmentForm(payout);
      return;
    }

    if (
      payout.status !== "draft" &&
      payout.calculation_snapshot &&
      payout.calculation_snapshot.entries
    ) {
      setExpandedEntries((prev) => ({
        ...prev,
        [id]: payout.calculation_snapshot!.entries!,
      }));
      setExpandedCalculations((prev) => ({
        ...prev,
        [id]: payout.calculation_snapshot!,
      }));
      seedAdjustmentForm(payout);
      return;
    }

    setExpandedLoading((prev) => ({ ...prev, [id]: true }));

    const artistRate = relatedOne(payout.artist)?.payout_rate;
    if (artistRate === null || artistRate === undefined) {
      setError("Set an artist payout rate before calculating this payout.");
      setExpandedLoading((prev) => ({ ...prev, [id]: false }));
      return;
    }
    const result = await fetchPayoutBundle(
      payout.artist_id,
      payout.period_start,
      payout.period_end,
      artistRate,
    );

    const entries = result.data?.entries ?? [];

    if (!result.error && result.data) {
      setExpandedEntries((prev) => ({ ...prev, [id]: entries }));
      setExpandedCalculations((prev) => ({
        ...prev,
        [id]:
          payout.status !== "draft" && payout.calculation_snapshot
            ? payout.calculation_snapshot
            : result.data!.calculation,
      }));
    } else if (result.error) {
      setError(result.error);
    }
    setExpandedLoading((prev) => ({ ...prev, [id]: false }));

    seedAdjustmentForm(payout);
  }

  async function saveAdjustment(payout: PayoutRow) {
    const adj = adjustmentForm[payout.id];
    if (!adj) return;

    const amount = parseFloat(adj.amount);
    if (isNaN(amount)) {
      setError("Adjustment amount must be a number.");
      return;
    }
    if (amount !== 0 && !adj.note.trim()) {
      setError("An adjustment reason is required when the adjustment is not zero.");
      return;
    }

    setAdjustmentSaving(payout.id);
    setError("");
    setMessage("");

    const result = await supabase
      .from("payouts")
      .update({ adjustment_amount: amount, adjustment_note: adj.note || null })
      .eq("id", payout.id);

    if (result.error) {
      setError(result.error.message);
    } else {
      setPayouts((current) =>
        current.map((p) =>
          p.id === payout.id
            ? { ...p, adjustment_amount: amount, adjustment_note: adj.note || null }
            : p,
        ),
      );
      setMessage("Adjustment saved.");
    }
    setAdjustmentSaving(null);
  }

  return (
    <AccountingShell
      active="Payouts"
      eyebrow="Artist payouts"
      title="Payouts"
      actions={
        <button
          className="inline-flex h-9 items-center rounded-md bg-[#191b1f] px-4 text-sm font-semibold text-white hover:bg-[#2e3238] disabled:opacity-50"
          disabled={loading || saving}
          onClick={() => setShowModal(true)}
          type="button"
        >
          + New payout
        </button>
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading payouts...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-3 py-2 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            {(["draft", "ready", "paid", "void"] as const).map((s) => (
              <div
                key={s}
                className="rounded-md border border-[#d9d3c7] bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  {statusLabel(s)}
                </p>
                <p className="mt-1 text-2xl font-black text-[#1f2428]">{counts[s]}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {(["all", "draft", "ready", "paid", "void"] as const).map((s) => (
              <button
                key={s}
                className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
                  statusFilter === s
                    ? "bg-[#191b1f] text-white"
                    : "border border-[#cfc7b8] text-[#30373d] hover:bg-[#eee8dd]"
                }`}
                onClick={() => setStatusFilter(s)}
                type="button"
              >
                {s === "all" ? "All" : statusLabel(s)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-10 text-sm font-semibold text-[#697178] shadow-sm">
              No payouts match the current filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((payout) => {
                const artist = relatedOne(payout.artist);
                const isExpanded = expandedPayoutId === payout.id;
                const entries = expandedEntries[payout.id] ?? [];
                const calculation = expandedCalculations[payout.id];
                const isLoadingEntries = expandedLoading[payout.id] ?? false;
                const adj = adjustmentForm[payout.id];
                const adjustmentAmount = adj
                  ? parseFloat(adj.amount) || 0
                  : Number(payout.adjustment_amount ?? 0);
                const finalPayout =
                  (calculation?.settlementBeforeAdjustment ?? 0) + adjustmentAmount;
                const canEdit = payout.status === "draft";

                return (
                  <div
                    key={payout.id}
                    className="overflow-hidden rounded-md border border-[#d9d3c7] bg-white shadow-sm"
                  >
                    {/* Summary row, clickable to expand */}
                    <button
                      className="w-full px-5 py-4 text-left transition hover:bg-[#f7f2e9]"
                      onClick={() => toggleExpand(payout)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191b1f] text-xs font-black text-white">
                            {(artist?.display_name ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold">{artist?.display_name ?? "-"}</p>
                            <p className="text-xs text-[#697178]">
                              {formatDate(payout.period_start)} - {formatDate(payout.period_end)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`rounded px-2 py-0.5 text-xs font-bold ${statusClasses(payout.status)}`}>
                            {statusLabel(payout.status)}
                          </span>
                          {payout.paid_at ? (
                            <span className="text-xs text-[#697178]">
                              Paid {formatDate(payout.paid_at)}
                            </span>
                          ) : null}
                          <span className="text-sm text-[#697178]">{isExpanded ? "Hide" : "Show"}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded ? (
                      <div className="border-t border-[#e5dfd4]">
                        {/* Entries table */}
                        {isLoadingEntries ? (
                          <div className="px-5 py-6 text-sm font-semibold text-[#697178]">
                            Loading entries...
                          </div>
                        ) : entries.length === 0 ? (
                          <div className="px-5 py-6 text-sm font-semibold text-[#697178]">
                            No accounting entries found for this period.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] text-left text-sm">
                              <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                                <tr>
                                  <th className="px-5 py-2">Date</th>
                                  <th className="px-5 py-2">Client</th>
                                  <th className="px-5 py-2">Project</th>
                                  <th className="px-5 py-2">Type</th>
                                  <th className="px-5 py-2 text-right">Tattoo</th>
                                  <th className="px-5 py-2 text-right">Tip</th>
                                  <th className="px-5 py-2 text-right">Total</th>
                                  <th className="px-5 py-2">Payment</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#eee8dd]">
                                {entries.map((e) => (
                                  <tr key={e.id} className="hover:bg-[#fffaf1]">
                                    <td className="px-5 py-2 text-xs text-[#4d555c]">
                                      {formatDate(e.entered_at)}
                                    </td>
                                    <td className="px-5 py-2">{e.customer_name ?? "-"}</td>
                                    <td className="px-5 py-2 text-xs text-[#697178]">
                                      {e.project_subject ?? "-"}
                                    </td>
                                    <td className="px-5 py-2">
                                      <span className="rounded bg-[#f1eadc] px-1.5 py-0.5 text-xs font-bold text-[#775f36]">
                                        {entryTypeLabel(e.entry_type)}
                                      </span>
                                    </td>
                                    <td className="px-5 py-2 text-right">
                                      {money(Number(e.tattoo_amount))}
                                    </td>
                                    <td className="px-5 py-2 text-right text-[#697178]">
                                      {money(Number(e.tip_amount))}
                                    </td>
                                    <td className="px-5 py-2 text-right font-bold text-[#236c8f]">
                                      {money(Number(e.total_amount))}
                                    </td>
                                    <td className="px-5 py-2">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${paymentMethodClasses(e.tattoo_payment_method)}`}
                                      >
                                        {paymentMethodLabel(e.tattoo_payment_method)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Totals + adjustment + actions */}
                        <div className="border-t border-[#e5dfd4] bg-[#f7f2e9] px-5 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            {/* Calculation */}
                            <div className="space-y-2 text-sm">
                              {calculation ? (
                                <>
                                  <div className="grid grid-cols-[9rem_6rem_6rem] gap-3 text-xs">
                                    <span className="font-semibold text-[#697178]">Cash tattoo</span>
                                    <span className="text-right">{money(calculation.tattoo.cash)}</span>
                                    <span className="text-right font-bold">
                                      +{money(calculation.tattoo.cash * calculation.artistRate / 100)}
                                    </span>
                                    <span className="font-semibold text-[#697178]">Card tattoo</span>
                                    <span className="text-right">{money(calculation.tattoo.credit_card)}</span>
                                    <span className="text-right font-bold">
                                      +{money(calculation.tattoo.credit_card * calculation.artistRate / 100)}
                                    </span>
                                    <span className="font-semibold text-[#697178]">App tattoo</span>
                                    <span className="text-right">{money(calculation.tattoo.app)}</span>
                                    <span className="text-right font-bold text-[#8a3030]">
                                      -{money(calculation.tattoo.app * (100 - calculation.artistRate) / 100)}
                                    </span>
                                    <span className="font-semibold text-[#697178]">Cash tips</span>
                                    <span className="text-right">{money(calculation.tip.cash)}</span>
                                    <span className="text-right font-bold">+{money(calculation.tip.cash)}</span>
                                    <span className="font-semibold text-[#697178]">Card tips</span>
                                    <span className="text-right">{money(calculation.tip.credit_card)}</span>
                                    <span className="text-right font-bold">
                                      +{money(calculation.tip.credit_card - calculation.cardTipFee)}
                                    </span>
                                    <span className="font-semibold text-[#697178]">App tips</span>
                                    <span className="text-right">{money(calculation.tip.app)}</span>
                                    <span className="text-right text-[#697178]">Already held</span>
                                  </div>
                                  <div className="flex items-center gap-8 border-t border-[#d9d3c7] pt-2">
                                    <span className="w-32 font-semibold text-[#697178]">Artist earnings</span>
                                    <span className="font-bold">{money(calculation.artistEarnings)}</span>
                                    <span className="text-xs text-[#697178]">
                                      {calculation.artistRate}% rate / card tip fee {calculation.cardTipFeeRate}%
                                    </span>
                                  </div>
                                </>
                              ) : null}

                              {/* Adjustment row */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-32 font-semibold text-[#697178]">Adjustment</span>
                                {canEdit ? (
                                  <>
                                    <input
                                      className="h-8 w-28 rounded border border-[#cfc7b8] bg-white px-2 text-right text-sm"
                                      onChange={(e) =>
                                        setAdjustmentForm((prev) => ({
                                          ...prev,
                                          [payout.id]: {
                                            ...prev[payout.id],
                                            amount: e.target.value,
                                            isAutoCalc: false,
                                          },
                                        }))
                                      }
                                      placeholder="0.00"
                                      type="number"
                                      step="0.01"
                                      value={adj?.amount ?? "0"}
                                    />
                                    <input
                                      className="h-8 flex-1 min-w-[120px] rounded border border-[#cfc7b8] bg-white px-2 text-sm"
                                      onChange={(e) =>
                                        setAdjustmentForm((prev) => ({
                                          ...prev,
                                          [payout.id]: {
                                            ...prev[payout.id],
                                            note: e.target.value,
                                            isAutoCalc: false,
                                          },
                                        }))
                                      }
                                      placeholder="Note (e.g. shop cut 30%)"
                                      value={adj?.note ?? ""}
                                    />
                                    <button
                                      className="h-8 rounded border border-[#cfc7b8] px-3 text-xs font-semibold hover:bg-[#eee8dd] disabled:opacity-50"
                                      disabled={adjustmentSaving === payout.id}
                                      onClick={() => saveAdjustment(payout)}
                                      type="button"
                                    >
                                      {adjustmentSaving === payout.id ? "Saving..." : "Save"}
                                    </button>
                                  </>
                                ) : (
                                  <span className="font-bold">
                                    {money(Number(payout.adjustment_amount ?? 0))}
                                    {payout.adjustment_note ? (
                                      <span className="ml-2 font-normal text-[#697178]">
                                        ({payout.adjustment_note})
                                      </span>
                                    ) : null}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-8 border-t border-[#d9d3c7] pt-2">
                                <span className="w-32 font-black text-[#1f2428]">
                                  {finalPayout < 0 ? "Artist pays shop" : "Shop pays artist"}
                                </span>
                                <span className={`text-lg font-black ${finalPayout < 0 ? "text-[#8a3030]" : "text-[#236c8f]"}`}>
                                  {money(Math.abs(finalPayout))}
                                </span>
                              </div>
                            </div>

                            {/* Status actions + print */}
                            <div className="flex flex-col items-end gap-2">
                              {/* Print button is available when entries are loaded. */}
                              {!isLoadingEntries && calculation ? (
                                <button
                                  className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                                  onClick={() =>
                                    printPayout(
                                      payout,
                                      entries,
                                      calculation,
                                      adjustmentAmount,
                                      finalPayout,
                                      adj?.note ?? payout.adjustment_note ?? null,
                                    )
                                  }
                                  type="button"
                                >
                                  Print
                                </button>
                              ) : null}
                              {["ready", "paid"].includes(payout.status) ? <button className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:opacity-50" disabled={saving} onClick={() => openEmailPayout(payout)} type="button">Email to artist</button> : null}

                              {payout.status === "draft" ? (
                                <>
                                  <button
                                    className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "ready", "Finalize payout")}
                                    type="button"
                                  >
                                    Finalize
                                  </button>
                                  <button
                                    className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "void", "Cancel payout")}
                                    type="button"
                                  >
                                    Cancel payout
                                  </button>
                                  <button
                                    className="h-8 w-28 rounded border border-[#8a3030] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => deleteDraftPayout(payout)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : payout.status === "ready" ? (
                                <>
                                  <button
                                    className="h-8 w-28 rounded bg-[#191b1f] px-2 text-xs font-semibold text-white hover:bg-[#2e3238] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "paid", "Mark paid")}
                                    type="button"
                                  >
                                    Mark paid
                                  </button>
                                  <button
                                    className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "void", "Cancel payout")}
                                    type="button"
                                  >
                                    Cancel payout
                                  </button>
                                </>
                              ) : (
                                <p className="text-xs text-[#697178]">
                                  {payout.status === "paid"
                                    ? `Paid ${payout.paid_at ? formatDate(payout.paid_at) : ""}`
                                    : "Cancelled"}
                                </p>
                              )}

                              {payout.notes ? (
                                <p className="mt-1 max-w-[220px] text-right text-xs text-[#697178]">
                                  {payout.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* New payout modal */}
      {emailPayoutDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
            <div className="border-b border-[#e5dfd4] px-5 py-4">
              <h2 className="text-lg font-black">Email payout statement</h2>
              <p className="mt-1 text-sm text-[#697178]">The payout PDF will be attached automatically.</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <label className="block text-sm font-bold">To
                <input className="mt-1.5 h-10 w-full rounded-md border border-[#cfc7b8] px-3 font-normal" onChange={(event) => setEmailTo(event.target.value)} type="email" value={emailTo} />
              </label>
              <label className="block text-sm font-bold">Subject
                <input className="mt-1.5 h-10 w-full rounded-md border border-[#cfc7b8] px-3 font-normal" onChange={(event) => setEmailSubject(event.target.value)} value={emailSubject} />
              </label>
              <label className="block text-sm font-bold">Message
                <textarea className="mt-1.5 min-h-64 w-full rounded-md border border-[#cfc7b8] px-3 py-2 font-normal" onChange={(event) => setEmailBody(event.target.value)} value={emailBody} />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5dfd4] px-5 py-4">
              <button className="h-9 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" disabled={saving} onClick={() => setEmailPayoutDraft(null)} type="button">Cancel</button>
              <button className="h-9 rounded-md border border-[#236c8f] px-4 text-sm font-semibold text-[#236c8f] disabled:opacity-50" disabled={saving || previewingPdf} onClick={previewPayoutPdf} type="button">{previewingPdf ? "Opening PDF..." : "Preview PDF"}</button>
              <button className="h-9 rounded-md bg-[#191b1f] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()} onClick={emailPayout} type="button">{saving ? "Sending..." : "Send with PDF"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <div className="w-full max-w-lg rounded-lg border border-[#d9d3c7] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-5 py-4">
              <h2 className="text-base font-bold">New Payout Period</h2>
              <button
                className="text-sm text-[#697178] hover:text-[#1f2428]"
                onClick={() => {
                  setShowModal(false);
                  setFormError("");
                  setPreviewEntries(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {formError ? (
                <p className="rounded bg-[#f5e8e8] px-3 py-2 text-sm font-semibold text-[#8a3030]">
                  {formError}
                </p>
              ) : null}

              <div>
                <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Artist
                </label>
                <select
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, artist_id: e.target.value }))}
                  value={form.artist_id}
                >
                  <option value="">Select artist...</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    Period Start
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                    type="date"
                    value={form.period_start}
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    Period End
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                    type="date"
                    value={form.period_end}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Notes (optional)
                </label>
                <textarea
                  className="mt-1.5 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes about this payout period..."
                  rows={2}
                  value={form.notes}
                />
              </div>

              {/* Preview */}
              {form.artist_id && form.period_start && form.period_end ? (
                <div className="rounded-md border border-[#d9d3c7] bg-[#f7f2e9] px-4 py-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    Period Preview
                  </p>
                  {previewLoading ? (
                    <p className="text-sm text-[#697178]">Loading...</p>
                  ) : previewEntries === null ? null : previewEntries.length === 0 ? (
                    <p className="text-sm text-[#697178]">No entries found for this period.</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#697178]">Entries</span>
                        <span className="font-semibold">{previewEntries.length}</span>
                      </div>
                      {previewCalculation ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#697178]">Artist earnings</span>
                            <span className="font-semibold">
                              {money(previewCalculation.artistEarnings)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-[#d9d3c7] pt-1">
                            <span className="font-black text-[#1f2428]">
                              {previewCalculation.settlementBeforeAdjustment < 0
                                ? "Artist pays shop"
                                : "Shop pays artist"}
                            </span>
                            <span className={`font-black ${
                              previewCalculation.settlementBeforeAdjustment < 0
                                ? "text-[#8a3030]"
                                : "text-[#236c8f]"
                            }`}>
                              {money(Math.abs(previewCalculation.settlementBeforeAdjustment))}
                            </span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e5dfd4] px-5 py-4">
              <button
                className="h-9 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                onClick={() => {
                  setShowModal(false);
                  setFormError("");
                  setPreviewEntries(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-9 rounded-md bg-[#191b1f] px-4 text-sm font-semibold text-white hover:bg-[#2e3238] disabled:opacity-50"
                disabled={saving}
                onClick={createPayout}
                type="button"
              >
                {saving ? "Creating..." : "Create payout"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AccountingShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

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
  created_at: string;
  artist: { display_name: string } | { display_name: string }[] | null;
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
};

type StaffRecord = { id: string; display_name: string };
type FilterStatus = "all" | "draft" | "ready" | "paid" | "void";
type NewPayoutForm = {
  artist_id: string;
  period_start: string;
  period_end: string;
  notes: string;
};

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
  return { draft: "Draft", ready: "Ready", paid: "Paid", void: "Void" }[status] ?? status;
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

const payoutSelect =
  "id, artist_id, period_start, period_end, status, paid_at, notes, adjustment_amount, adjustment_note, created_at, artist:staff(display_name)";

const basePayoutSelect =
  "id, artist_id, period_start, period_end, status, paid_at, notes, created_at, artist:staff(display_name)";

const entrySelect =
  "id, entered_at, entry_type, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method";

function isMissingAdjustmentColumn(message: string) {
  return message.includes("adjustment_amount") || message.includes("adjustment_note");
}

function withAdjustmentDefaults(rows: unknown[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    ...(row as Omit<PayoutRow, "adjustment_amount" | "adjustment_note">),
    adjustment_amount: Number((row as Partial<PayoutRow>).adjustment_amount ?? 0),
    adjustment_note: (row as Partial<PayoutRow>).adjustment_note ?? null,
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

export default function PayoutsPage() {
  const router = useRouter();
  const now = new Date();

  // Page state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

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
  const [previewLoading, setPreviewLoading] = useState(false);

  // Expanded detail
  const [expandedPayoutId, setExpandedPayoutId] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, EntryRow[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<string, boolean>>({});
  const [adjustmentForm, setAdjustmentForm] = useState<
    Record<string, { amount: string; note: string }>
  >({});
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
          .select("id, display_name")
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

      if (!showModal || !form.artist_id || !form.period_start || !form.period_end) {
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);

      const { data, error: qErr } = await fetchEntriesForPayout(
        form.artist_id,
        form.period_start,
        form.period_end,
      );

      if (cancelled) return;
      if (!qErr) {
        setPreviewEntries((data ?? []) as EntryRow[]);
      }
      setPreviewLoading(false);
    }

    loadPreview();

    return () => { cancelled = true; };
  }, [showModal, form.artist_id, form.period_start, form.period_end]);

  const filtered =
    statusFilter === "all" ? payouts : payouts.filter((p) => p.status === statusFilter);

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

    const result = await supabase.from("payouts").update(updates).eq("id", payout.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
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

  async function toggleExpand(payout: PayoutRow) {
    const id = payout.id;

    if (expandedPayoutId === id) {
      setExpandedPayoutId(null);
      return;
    }

    setExpandedPayoutId(id);

    if (expandedEntries[id] !== undefined) return; // already loaded

    setExpandedLoading((prev) => ({ ...prev, [id]: true }));

    const { data, error: qErr } = await fetchEntriesForPayout(
      payout.artist_id,
      payout.period_start,
      payout.period_end,
    );

    if (!qErr) {
      setExpandedEntries((prev) => ({ ...prev, [id]: (data ?? []) as EntryRow[] }));
    }
    setExpandedLoading((prev) => ({ ...prev, [id]: false }));

    // Seed adjustment form from saved values
    setAdjustmentForm((prev) => ({
      ...prev,
      [id]:
        prev[id] ?? {
          amount: String(payout.adjustment_amount ?? 0),
          note: payout.adjustment_note ?? "",
        },
    }));
  }

  async function saveAdjustment(payout: PayoutRow) {
    const adj = adjustmentForm[payout.id];
    if (!adj) return;

    const amount = parseFloat(adj.amount);
    if (isNaN(amount)) {
      setError("Adjustment amount must be a number.");
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

  const previewTotals = previewEntries
    ? {
        tattoo: previewEntries.reduce((s, e) => s + Number(e.tattoo_amount), 0),
        tip: previewEntries.reduce((s, e) => s + Number(e.tip_amount), 0),
        merch: previewEntries.reduce((s, e) => s + Number(e.merch_amount), 0),
        total: previewEntries.reduce((s, e) => s + Number(e.total_amount), 0),
      }
    : null;

  return (
    <AccountingShell
      active="Payouts"
      eyebrow="Artist payouts"
      title="Payouts"
      description="Track payout periods per artist from draft through payment."
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
                const isLoadingEntries = expandedLoading[payout.id] ?? false;
                const adj = adjustmentForm[payout.id];
                const grossTotal = entries.reduce((s, e) => s + Number(e.total_amount), 0);
                const adjustmentAmount = adj
                  ? parseFloat(adj.amount) || 0
                  : Number(payout.adjustment_amount ?? 0);
                const finalPayout = grossTotal + adjustmentAmount;
                const canEdit = payout.status === "draft" || payout.status === "ready";

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
                              <div className="flex items-center gap-8">
                                <span className="w-32 font-semibold text-[#697178]">Gross total</span>
                                <span className="font-bold">{money(grossTotal)}</span>
                              </div>

                              {/* Adjustment row */}
                              <div className="flex items-center gap-2">
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
                                          },
                                        }))
                                      }
                                      placeholder="0.00"
                                      type="number"
                                      step="0.01"
                                      value={adj?.amount ?? "0"}
                                    />
                                    <input
                                      className="h-8 flex-1 rounded border border-[#cfc7b8] bg-white px-2 text-sm"
                                      onChange={(e) =>
                                        setAdjustmentForm((prev) => ({
                                          ...prev,
                                          [payout.id]: {
                                            ...prev[payout.id],
                                            note: e.target.value,
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
                                <span className="w-32 font-black text-[#1f2428]">Payout total</span>
                                <span className="text-lg font-black text-[#236c8f]">
                                  {money(finalPayout)}
                                </span>
                              </div>
                            </div>

                            {/* Status actions */}
                            <div className="flex flex-col items-end gap-2">
                              {payout.status === "draft" ? (
                                <>
                                  <button
                                    className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "ready", "Mark ready")}
                                    type="button"
                                  >
                                    Mark ready
                                  </button>
                                  <button
                                    className="h-8 w-28 rounded border border-[#cfc7b8] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "void", "Void")}
                                    type="button"
                                  >
                                    Void
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
                                    onClick={() => updateStatus(payout, "void", "Void")}
                                    type="button"
                                  >
                                    Void
                                  </button>
                                </>
                              ) : (
                                <p className="text-xs text-[#697178]">
                                  {payout.status === "paid"
                                    ? `Paid ${payout.paid_at ? formatDate(payout.paid_at) : ""}`
                                    : "Void"}
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
                      <div className="flex justify-between">
                        <span className="text-[#697178]">Tattoo</span>
                        <span className="font-semibold">{money(previewTotals!.tattoo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#697178]">Tips</span>
                        <span className="font-semibold">{money(previewTotals!.tip)}</span>
                      </div>
                      {previewTotals!.merch > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-[#697178]">Merch</span>
                          <span className="font-semibold">{money(previewTotals!.merch)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between border-t border-[#d9d3c7] pt-1">
                        <span className="font-black text-[#1f2428]">Gross total</span>
                        <span className="font-black text-[#236c8f]">
                          {money(previewTotals!.total)}
                        </span>
                      </div>
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

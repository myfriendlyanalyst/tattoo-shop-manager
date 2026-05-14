"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

type PayoutRow = {
  id: string;
  artist_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "ready" | "paid" | "void";
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type StaffRecord = { id: string; display_name: string };

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
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
  return (
    { draft: "Draft", ready: "Ready", paid: "Paid", void: "Void" }[status] ?? status
  );
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

const payoutSelect =
  "id, artist_id, period_start, period_end, status, paid_at, notes, created_at, artist:staff(display_name)";

type FilterStatus = "all" | "draft" | "ready" | "paid" | "void";

type NewPayoutForm = {
  artist_id: string;
  period_start: string;
  period_end: string;
  notes: string;
};

export default function PayoutsPage() {
  const router = useRouter();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPayoutForm>({
    artist_id: "",
    period_start: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    period_end: localDateValue(now),
    notes: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/payouts");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "owner" && profile?.role !== "admin") {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const [payoutResult, staffResult] = await Promise.all([
        supabase
          .from("payouts")
          .select(payoutSelect)
          .order("created_at", { ascending: false }),
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

      setPayouts((payoutResult.data ?? []) as unknown as PayoutRow[]);
      setArtists((staffResult.data ?? []) as StaffRecord[]);
      setLoading(false);
    }

    load();
  }, [router]);

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
    const confirmed = window.confirm(`${label} this payout?`);
    if (!confirmed) return;

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
          ? { ...p, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : p.paid_at }
          : p,
      ),
    );
    setMessage(`Payout marked as ${statusLabel(newStatus).toLowerCase()}.`);
    setSaving(false);
  }

  async function createPayout() {
    setFormError("");
    if (!form.artist_id) {
      setFormError("Select an artist.");
      return;
    }
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
      .select(payoutSelect)
      .single();

    if (insertError) {
      setFormError(insertError.message);
      setSaving(false);
      return;
    }

    setPayouts((current) => [data as unknown as PayoutRow, ...current]);
    setShowModal(false);
    setForm({
      artist_id: "",
      period_start: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      period_end: localDateValue(now),
      notes: "",
    });
    setMessage("Payout period created.");
    setSaving(false);
  }

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
            <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    <tr>
                      <th className="px-5 py-3">Artist</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Paid</th>
                      <th className="px-5 py-3">Notes</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {filtered.map((payout) => {
                      const artist = relatedOne(payout.artist);
                      return (
                        <tr key={payout.id} className="hover:bg-[#fffaf1]">
                          <td className="px-5 py-3 font-semibold">
                            {artist?.display_name ?? "-"}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#4d555c]">
                            {formatDate(payout.period_start)} - {formatDate(payout.period_end)}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#4d555c]">
                            {formatDate(payout.created_at)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-bold ${statusClasses(payout.status)}`}
                            >
                              {statusLabel(payout.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-[#4d555c]">
                            {payout.paid_at ? formatDate(payout.paid_at) : "-"}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#697178]">
                            {payout.notes ?? "-"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1.5">
                              {payout.status === "draft" ? (
                                <>
                                  <button
                                    className="h-7 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "ready", "Mark ready")}
                                    type="button"
                                  >
                                    Mark ready
                                  </button>
                                  <button
                                    className="h-7 rounded border border-[#cfc7b8] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:cursor-not-allowed disabled:opacity-50"
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
                                    className="h-7 rounded border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "paid", "Mark paid")}
                                    type="button"
                                  >
                                    Mark paid
                                  </button>
                                  <button
                                    className="h-7 rounded border border-[#cfc7b8] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f5e8e8] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={saving}
                                    onClick={() => updateStatus(payout, "void", "Void")}
                                    type="button"
                                  >
                                    Void
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-[#697178]">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#d9d3c7] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-5 py-4">
              <h2 className="text-base font-bold">New Payout Period</h2>
              <button
                className="text-sm text-[#697178] hover:text-[#1f2428]"
                onClick={() => { setShowModal(false); setFormError(""); }}
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
                  rows={3}
                  value={form.notes}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e5dfd4] px-5 py-4">
              <button
                className="h-9 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                onClick={() => { setShowModal(false); setFormError(""); }}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

type AccountingEntry = {
  id: string;
  entered_at: string;
  entry_type: string;
  artist_id: string | null;
  artist_name: string | null;
  customer_name: string | null;
  project_subject: string | null;
  tattoo_amount: number;
  tip_amount: number;
  merch_amount: number;
  total_amount: number;
  tattoo_payment_method: string | null;
  tip_payment_method: string | null;
  merch_payment_method: string | null;
  memo: string | null;
};

type StaffRecord = { id: string; display_name: string };

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function localDateValue(value = new Date()) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function entryTypeLabel(type: string) {
  return { session: "Session", deposit: "Deposit", merch: "Merch" }[type] ?? type;
}

function paymentMethodLabel(method: string | null) {
  return (
    { cash: "Cash", credit_card: "Card", app: "App", other: "Other" }[method ?? ""] ??
    method ??
    "-"
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

const entrySelect =
  "id, entered_at, entry_type, artist_id, artist_name, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method, tip_payment_method, merch_payment_method, memo";

export default function TransactionsPage() {
  const router = useRouter();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [search, setSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(
    localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [dateTo, setDateTo] = useState(localDateValue());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/transactions");
        return;
      }

      const hasAccess = await hasAccountingAccess(user.id);
      if (!hasAccess) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const fromTs = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toTs = new Date(`${dateTo}T23:59:59.999`).toISOString();

      const [entryResult, staffResult] = await Promise.all([
        supabase
          .from("accounting_entries")
          .select(entrySelect)
          .gte("entered_at", fromTs)
          .lte("entered_at", toTs)
          .order("entered_at", { ascending: false }),
        supabase
          .from("staff")
          .select("id, display_name")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (entryResult.error) {
        setError(entryResult.error.message);
        setLoading(false);
        return;
      }
      if (staffResult.error) {
        setError(staffResult.error.message);
        setLoading(false);
        return;
      }

      setEntries((entryResult.data ?? []) as AccountingEntry[]);
      setArtists((staffResult.data ?? []) as StaffRecord[]);
      setLoading(false);
    }

    load();
  }, [router, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (artistFilter !== "all" && e.artist_id !== artistFilter) return false;
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
      if (term) {
        const haystack = [e.customer_name, e.artist_name, e.project_subject, e.memo]
          .filter(Boolean)
          .map((v) => v!.toLowerCase());
        if (!haystack.some((v) => v.includes(term))) return false;
      }
      return true;
    });
  }, [entries, artistFilter, typeFilter, search]);

  const totals = useMemo(
    () => ({
      tattoo: filtered.reduce((s, e) => s + Number(e.tattoo_amount), 0),
      tip: filtered.reduce((s, e) => s + Number(e.tip_amount), 0),
      merch: filtered.reduce((s, e) => s + Number(e.merch_amount), 0),
      total: filtered.reduce((s, e) => s + Number(e.total_amount), 0),
    }),
    [filtered],
  );

  return (
    <AccountingShell
      active="Transactions"
      eyebrow="Revenue records"
      title="Transactions"
      description="Session, deposit, and merch entries recorded by artists."
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading transactions...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto_auto]">
              <div className="sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Search
                </p>
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Client, artist, project, memo..."
                  value={search}
                />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Artist
                </p>
                <select
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setArtistFilter(e.target.value)}
                  value={artistFilter}
                >
                  <option value="all">All artists</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Type
                </p>
                <select
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setTypeFilter(e.target.value)}
                  value={typeFilter}
                >
                  <option value="all">All types</option>
                  <option value="session">Session</option>
                  <option value="deposit">Deposit</option>
                  <option value="merch">Merch</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  From
                </p>
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setDateFrom(e.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  To
                </p>
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setDateTo(e.target.value)}
                  type="date"
                  value={dateTo}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Tattoo", value: totals.tattoo, highlight: false },
              { label: "Tips", value: totals.tip, highlight: false },
              { label: "Merch", value: totals.merch, highlight: false },
              { label: "Total", value: totals.total, highlight: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-md border px-4 py-3 shadow-sm ${
                  item.highlight
                    ? "border-2 border-[#191b1f] bg-white"
                    : "border-[#d9d3c7] bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-xl font-black ${item.highlight ? "text-[#236c8f]" : "text-[#1f2428]"}`}
                >
                  {money(item.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-5 py-3">
              <p className="text-sm font-semibold text-[#697178]">{filtered.length} entries</p>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-sm font-semibold text-[#697178]">
                No entries match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Artist</th>
                      <th className="px-5 py-3">Client / Project</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Tattoo</th>
                      <th className="px-5 py-3 text-right">Tip</th>
                      <th className="px-5 py-3 text-right">Merch</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {filtered.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#fffaf1]">
                        <td className="px-5 py-3 text-xs text-[#4d555c]">
                          {formatDateTime(entry.entered_at)}
                        </td>
                        <td className="px-5 py-3 font-semibold">{entry.artist_name ?? "-"}</td>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{entry.customer_name ?? "-"}</p>
                          {entry.project_subject ? (
                            <p className="text-xs text-[#697178]">{entry.project_subject}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded px-2 py-0.5 text-xs font-bold bg-[#f1eadc] text-[#775f36]">
                            {entryTypeLabel(entry.entry_type)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {money(Number(entry.tattoo_amount))}
                        </td>
                        <td className="px-5 py-3 text-right text-[#697178]">
                          {money(Number(entry.tip_amount))}
                        </td>
                        <td className="px-5 py-3 text-right text-[#697178]">
                          {money(Number(entry.merch_amount))}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-[#236c8f]">
                          {money(Number(entry.total_amount))}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-bold ${paymentMethodClasses(entry.tattoo_payment_method)}`}
                          >
                            {paymentMethodLabel(entry.tattoo_payment_method)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-[#191b1f]">
                    <tr className="bg-[#f7f2e9] font-bold">
                      <td
                        className="px-5 py-3 text-xs uppercase tracking-[0.06em] text-[#697178]"
                        colSpan={4}
                      >
                        Total ({filtered.length})
                      </td>
                      <td className="px-5 py-3 text-right">{money(totals.tattoo)}</td>
                      <td className="px-5 py-3 text-right text-[#697178]">
                        {money(totals.tip)}
                      </td>
                      <td className="px-5 py-3 text-right text-[#697178]">
                        {money(totals.merch)}
                      </td>
                      <td className="px-5 py-3 text-right text-[#236c8f]">
                        {money(totals.total)}
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AccountingShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccountingShell } from "@/components/accounting-shell";
import { BarChart, DonutChart, StackedBar, type ChartPoint, type ChartSlice } from "@/components/accounting-charts";
import { getSafeUser } from "@/lib/auth-session";
import { hasAccountingAccess } from "@/lib/accounting-access";
import { supabase } from "@/lib/supabase";

type PaymentMethodKey = "cash" | "credit_card" | "app" | "other";

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
};

type ArtistOption = {
  id: string;
  display_name: string;
};

type DepositRow = {
  id: string;
  amount: number;
  available: boolean;
};

type PaymentBreakdown = {
  method: PaymentMethodKey;
  label: string;
  color: string;
  tattoo: number;
  tip: number;
  merch: number;
  total: number;
};

const PAYMENT_METHODS: Array<{ key: PaymentMethodKey; label: string; color: string }> = [
  { key: "cash", label: "Cash", color: "#2f6658" },
  { key: "credit_card", label: "Credit Card", color: "#236c8f" },
  { key: "app", label: "App", color: "#775f36" },
  { key: "other", label: "Other", color: "#8a5130" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateValue(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function paymentMethodLabel(method: string | null) {
  return PAYMENT_METHODS.find((item) => item.key === normalizePaymentMethod(method))?.label ?? "Other";
}

function paymentMethodClasses(method: string | null) {
  return (
    {
      cash: "bg-[#e8f3e8] text-[#2d6a2d]",
      credit_card: "bg-[#e8eef7] text-[#2a4a7f]",
      app: "bg-[#f6efe3] text-[#7a5420]",
      other: "bg-[#eee8dd] text-[#4d555c]",
    }[normalizePaymentMethod(method)] ?? "bg-[#eee8dd] text-[#4d555c]"
  );
}

function entryTypeLabel(type: string) {
  return { session: "Session", deposit: "Deposit", merch: "Merch" }[type] ?? type;
}

function normalizePaymentMethod(method: string | null): PaymentMethodKey {
  return method === "cash" || method === "credit_card" || method === "app" ? method : "other";
}

function pct(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function presetRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { from: localDateValue(start), to: localDateValue(end) };
}

const entrySelect =
  "id, entered_at, entry_type, artist_id, artist_name, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method, tip_payment_method, merch_payment_method";

export default function AccountingDashboardPage() {
  const router = useRouter();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [dateFrom, setDateFrom] = useState(localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(localDateValue(now));
  const [artistId, setArtistId] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/dashboard");
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

      let entryQuery = supabase
        .from("accounting_entries")
        .select(entrySelect)
        .gte("entered_at", fromTs)
        .lte("entered_at", toTs)
        .order("entered_at", { ascending: false });

      if (artistId !== "all") {
        entryQuery = entryQuery.eq("artist_id", artistId);
      }

      const [entryResult, artistResult, depositResult] = await Promise.all([
        entryQuery,
        supabase
          .from("staff")
          .select("id, display_name")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase.from("deposits").select("id, amount, available"),
      ]);

      if (entryResult.error) {
        setError(entryResult.error.message);
        setLoading(false);
        return;
      }
      if (artistResult.error) {
        setError(artistResult.error.message);
        setLoading(false);
        return;
      }
      if (depositResult.error) {
        setError(depositResult.error.message);
        setLoading(false);
        return;
      }

      setEntries((entryResult.data ?? []) as AccountingEntry[]);
      setArtists((artistResult.data ?? []) as ArtistOption[]);
      setDeposits((depositResult.data ?? []) as DepositRow[]);
      setLoading(false);
    }

    load();
  }, [artistId, dateFrom, dateTo, router]);

  const paymentBreakdown = useMemo<PaymentBreakdown[]>(() => {
    const map: Record<PaymentMethodKey, PaymentBreakdown> = Object.fromEntries(
      PAYMENT_METHODS.map((item) => [
        item.key,
        {
          method: item.key,
          label: item.label,
          color: item.color,
          tattoo: 0,
          tip: 0,
          merch: 0,
          total: 0,
        },
      ]),
    ) as Record<PaymentMethodKey, PaymentBreakdown>;

    function add(method: string | null, bucket: "tattoo" | "tip" | "merch", amount: number) {
      if (amount <= 0) return;
      const key = normalizePaymentMethod(method);
      map[key][bucket] += amount;
      map[key].total += amount;
    }

    for (const entry of entries) {
      add(entry.tattoo_payment_method, "tattoo", Number(entry.tattoo_amount));
      add(entry.tip_payment_method, "tip", Number(entry.tip_amount));
      add(entry.merch_payment_method, "merch", Number(entry.merch_amount));
    }

    return PAYMENT_METHODS.map((item) => map[item.key]);
  }, [entries]);

  const totalSales = paymentBreakdown.reduce((sum, item) => sum + item.total, 0);
  const tattooTotal = paymentBreakdown.reduce((sum, item) => sum + item.tattoo, 0);
  const tipTotal = paymentBreakdown.reduce((sum, item) => sum + item.tip, 0);
  const merchTotal = paymentBreakdown.reduce((sum, item) => sum + item.merch, 0);
  const availableDeposits = deposits
    .filter((deposit) => deposit.available)
    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);
  const usedDeposits = deposits
    .filter((deposit) => !deposit.available)
    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);

  const paymentSlices: ChartSlice[] = paymentBreakdown
    .filter((item) => item.total > 0)
    .map((item) => ({ label: item.label, value: item.total, color: item.color }));

  const paymentBars: ChartPoint[] = paymentBreakdown
    .filter((item) => item.total > 0)
    .map((item) => ({ label: item.label, value: item.total }));

  const selectedArtist = artists.find((artist) => artist.id === artistId);
  const activePeriodLabel = `${dateFrom} to ${dateTo}`;

  return (
    <AccountingShell active="Dashboard" eyebrow="Sales analytics" title="Accounting Dashboard">
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading dashboard...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  From
                </label>
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  To
                </label>
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  Artist
                </label>
                <select
                  className="mt-1.5 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setArtistId(event.target.value)}
                  value={artistId}
                >
                  <option value="all">All artists</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {[
                  { label: "7D", ...presetRange(7) },
                  { label: "30D", ...presetRange(30) },
                  { label: "MTD", from: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDateValue(now) },
                ].map((preset) => (
                  <button
                    className="h-10 rounded-md border border-[#cfc7b8] px-3 text-xs font-bold hover:bg-[#eee8dd]"
                    key={preset.label}
                    onClick={() => {
                      setDateFrom(preset.from);
                      setDateTo(preset.to);
                    }}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  {selectedArtist ? selectedArtist.display_name : "All artists"} / {activePeriodLabel}
                </p>
                <h2 className="mt-1 text-xl font-black">Sales by Payment Method</h2>
              </div>
              <Link
                className="inline-flex h-9 items-center rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                href="/accounting/transactions"
              >
                View transactions
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Total Sales
                </p>
                <p className="mt-2 text-3xl font-black text-[#236c8f]">{money(totalSales)}</p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">
                  {entries.length} entries / {money(merchTotal)} merch
                </p>
              </div>
              <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Tattoo
                </p>
                <p className="mt-2 text-2xl font-black text-[#236c8f]">{money(tattooTotal)}</p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">{pct(tattooTotal, totalSales)}</p>
              </div>
              <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Tips
                </p>
                <p className="mt-2 text-2xl font-black text-[#236c8f]">{money(tipTotal)}</p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">{pct(tipTotal, totalSales)}</p>
              </div>
              <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Deposits
                </p>
                <p className="mt-2 text-2xl font-black text-[#236c8f]">{money(availableDeposits)}</p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">
                  {money(usedDeposits)} applied
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold">Payment Method Mix</h3>
                <p className="mt-0.5 text-sm text-[#697178]">
                  Tattoo, tips, and merch are assigned to their own payment methods.
                </p>
              </div>
              {paymentSlices.length > 0 ? (
                <div className="space-y-4">
                  <DonutChart data={paymentSlices} size={158} />
                  <StackedBar data={paymentSlices} height={18} />
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[#d9d3c7] px-4 py-10 text-center text-sm font-semibold text-[#697178]">
                  No sales for this period.
                </div>
              )}
            </div>

            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold">Sales by Method</h3>
                <p className="mt-0.5 text-sm text-[#697178]">
                  Totals include tattoo, tips, and merch by each payment method.
                </p>
              </div>
              <BarChart data={paymentBars} height={170} color="#236c8f" />
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-5 py-4">
              <h3 className="text-base font-bold">Payment Method Detail</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Each amount type is grouped by its own payment method.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  <tr>
                    <th className="px-5 py-3">Payment Method</th>
                    <th className="px-5 py-3 text-right">Tattoo</th>
                    <th className="px-5 py-3 text-right">Tips</th>
                    <th className="px-5 py-3 text-right">Merch</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8dd]">
                  {paymentBreakdown.map((item) => (
                    <tr key={item.method} className="hover:bg-[#fffaf1]">
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-bold"
                          style={{ backgroundColor: `${item.color}18`, color: item.color }}
                        >
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          {item.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">{money(item.tattoo)}</td>
                      <td className="px-5 py-3 text-right">{money(item.tip)}</td>
                      <td className="px-5 py-3 text-right">{money(item.merch)}</td>
                      <td className="px-5 py-3 text-right font-bold text-[#236c8f]">{money(item.total)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#697178]">{pct(item.total, totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Recent Matching Transactions</h3>
                <p className="mt-1 text-sm text-[#697178]">
                  Latest entries for the selected period and artist filter.
                </p>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="px-5 py-10 text-sm font-semibold text-[#697178]">
                No entries recorded for this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Artist</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Tattoo</th>
                      <th className="px-5 py-3 text-right">Tip</th>
                      <th className="px-5 py-3 text-right">Merch</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {entries.slice(0, 20).map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#fffaf1]">
                        <td className="px-5 py-3 text-xs text-[#4d555c]">
                          {formatDateTime(entry.entered_at)}
                        </td>
                        <td className="px-5 py-3 font-semibold">{entry.artist_name ?? "-"}</td>
                        <td className="px-5 py-3">{entry.customer_name ?? "-"}</td>
                        <td className="px-5 py-3">
                          <span className="rounded px-2 py-0.5 text-xs font-bold bg-[#f1eadc] text-[#775f36]">
                            {entryTypeLabel(entry.entry_type)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">{money(Number(entry.tattoo_amount))}</td>
                        <td className="px-5 py-3 text-right text-[#697178]">{money(Number(entry.tip_amount))}</td>
                        <td className="px-5 py-3 text-right text-[#697178]">{money(Number(entry.merch_amount))}</td>
                        <td className="px-5 py-3 text-right font-bold text-[#236c8f]">{money(Number(entry.total_amount))}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Number(entry.tattoo_amount) > 0 ? (
                              <span className={`rounded px-2 py-0.5 text-xs font-bold ${paymentMethodClasses(entry.tattoo_payment_method)}`}>
                                T: {paymentMethodLabel(entry.tattoo_payment_method)}
                              </span>
                            ) : null}
                            {Number(entry.tip_amount) > 0 ? (
                              <span className={`rounded px-2 py-0.5 text-xs font-bold ${paymentMethodClasses(entry.tip_payment_method)}`}>
                                Tip: {paymentMethodLabel(entry.tip_payment_method)}
                              </span>
                            ) : null}
                            {Number(entry.merch_amount) > 0 ? (
                              <span className={`rounded px-2 py-0.5 text-xs font-bold ${paymentMethodClasses(entry.merch_payment_method)}`}>
                                M: {paymentMethodLabel(entry.merch_payment_method)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AccountingShell>
  );
}

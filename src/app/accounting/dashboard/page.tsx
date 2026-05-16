"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

type AccountingEntry = {
  id: string;
  entered_at: string;
  entry_type: string;
  artist_name: string | null;
  customer_name: string | null;
  project_subject: string | null;
  tattoo_amount: number;
  tip_amount: number;
  merch_amount: number;
  total_amount: number;
  tattoo_payment_method: string | null;
};

type DepositRow = {
  id: string;
  amount: number;
  available: boolean;
};

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

function entryTypeLabel(type: string) {
  return { session: "Session", deposit: "Deposit", merch: "Merch" }[type] ?? type;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function monthRangeFor(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AccountingDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthEntries, setMonthEntries] = useState<AccountingEntry[]>([]);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [recentEntries, setRecentEntries] = useState<AccountingEntry[]>([]);

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

      const thisMonth = monthRangeFor(0);
      const lastMonth = monthRangeFor(1);
      const entrySelect =
        "id, entered_at, entry_type, artist_name, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method";

      const [monthResult, lastMonthResult, depositResult, recentResult] = await Promise.all([
        supabase
          .from("accounting_entries")
          .select(entrySelect)
          .gte("entered_at", thisMonth.start)
          .lt("entered_at", thisMonth.end)
          .order("entered_at", { ascending: false }),
        supabase
          .from("accounting_entries")
          .select("total_amount")
          .gte("entered_at", lastMonth.start)
          .lt("entered_at", lastMonth.end),
        supabase.from("deposits").select("id, amount, available"),
        supabase
          .from("accounting_entries")
          .select(entrySelect)
          .order("entered_at", { ascending: false })
          .limit(20),
      ]);

      if (monthResult.error) {
        setError(monthResult.error.message);
        setLoading(false);
        return;
      }
      if (lastMonthResult.error) {
        setError(lastMonthResult.error.message);
        setLoading(false);
        return;
      }
      if (depositResult.error) {
        setError(depositResult.error.message);
        setLoading(false);
        return;
      }
      if (recentResult.error) {
        setError(recentResult.error.message);
        setLoading(false);
        return;
      }

      const lastTotal = (lastMonthResult.data ?? []).reduce(
        (sum, e) => sum + Number(e.total_amount),
        0,
      );

      setMonthEntries((monthResult.data ?? []) as AccountingEntry[]);
      setLastMonthTotal(lastTotal);
      setDeposits((depositResult.data ?? []) as DepositRow[]);
      setRecentEntries((recentResult.data ?? []) as AccountingEntry[]);
      setLoading(false);
    }

    load();
  }, [router]);

  const monthTotal = monthEntries.reduce((sum, e) => sum + Number(e.total_amount), 0);
  const monthTattoo = monthEntries.reduce((sum, e) => sum + Number(e.tattoo_amount), 0);
  const monthTip = monthEntries.reduce((sum, e) => sum + Number(e.tip_amount), 0);
  const monthMerch = monthEntries.reduce((sum, e) => sum + Number(e.merch_amount), 0);
  const availableDeposits = deposits
    .filter((d) => d.available)
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const usedDeposits = deposits
    .filter((d) => !d.available)
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const monthChange = pctChange(monthTotal, lastMonthTotal);

  const cashTotal = monthEntries
    .filter((e) => e.tattoo_payment_method === "cash")
    .reduce((sum, e) => sum + Number(e.tattoo_amount) + Number(e.tip_amount), 0);
  const cardTotal = monthEntries
    .filter((e) => e.tattoo_payment_method === "credit_card")
    .reduce((sum, e) => sum + Number(e.tattoo_amount) + Number(e.tip_amount), 0);
  const appTotal = monthEntries
    .filter((e) => e.tattoo_payment_method === "app")
    .reduce((sum, e) => sum + Number(e.tattoo_amount) + Number(e.tip_amount), 0);

  const currentMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <AccountingShell active="Dashboard" eyebrow="Overview" title="Accounting Dashboard">
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
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[#697178]">
              {currentMonthLabel}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Total Revenue
                </p>
                <p className="mt-2 text-3xl font-black text-[#236c8f]">{money(monthTotal)}</p>
                <p
                  className={`mt-1.5 text-xs font-bold ${monthChange >= 0 ? "text-[#2f6658]" : "text-[#8a3030]"}`}
                >
                  {monthChange >= 0 ? "+" : ""}
                  {monthChange.toFixed(1)}% vs last month
                </p>
              </div>

              <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Deposits on Hold
                </p>
                <p className="mt-2 text-3xl font-black text-[#236c8f]">
                  {money(availableDeposits)}
                </p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">
                  {money(usedDeposits)} applied
                </p>
              </div>

              <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Tips This Month
                </p>
                <p className="mt-2 text-3xl font-black text-[#236c8f]">{money(monthTip)}</p>
                <p className="mt-1.5 text-xs font-bold text-[#697178]">
                  {monthEntries.length} entries
                </p>
              </div>

              <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Breakdown
                </p>
                <div className="space-y-1.5 text-sm">
                  {[
                    { label: "Tattoo", value: monthTattoo },
                    { label: "Tips", value: monthTip },
                    { label: "Merch", value: monthMerch },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="font-semibold text-[#697178]">{item.label}</span>
                      <span className="font-bold">{money(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-[#d9d3c7] bg-[#e8f3e8] px-4 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#2d6a2d]">Cash</p>
              <p className="mt-2 text-2xl font-black text-[#2d6a2d]">{money(cashTotal)}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-[#e8eef7] px-4 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#2a4a7f]">
                Credit Card
              </p>
              <p className="mt-2 text-2xl font-black text-[#2a4a7f]">{money(cardTotal)}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-[#f6efe3] px-4 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7a5420]">
                App (Venmo / Zelle)
              </p>
              <p className="mt-2 text-2xl font-black text-[#7a5420]">{money(appTotal)}</p>
            </div>
          </div>

          <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Recent Transactions</h3>
                <p className="mt-1 text-sm text-[#697178]">Last 20 entries across all artists.</p>
              </div>
              <Link
                href="/accounting/transactions"
                className="inline-flex h-9 items-center rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
              >
                View all
              </Link>
            </div>

            {recentEntries.length === 0 ? (
              <div className="px-5 py-10 text-sm font-semibold text-[#697178]">
                No entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Artist</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3 text-right">Tattoo</th>
                      <th className="px-5 py-3 text-right">Tip</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {recentEntries.map((entry) => (
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
                        <td className="px-5 py-3 text-right font-semibold">
                          {money(Number(entry.tattoo_amount))}
                        </td>
                        <td className="px-5 py-3 text-right text-[#697178]">
                          {money(Number(entry.tip_amount))}
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
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AccountingShell>
  );
}

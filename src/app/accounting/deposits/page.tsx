"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

type DepositRecord = {
  id: string;
  amount: number;
  payment_method: string;
  received_at: string;
  available: boolean;
  used_at: string | null;
  memo: string | null;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
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

function paymentMethodLabel(method: string) {
  return (
    { cash: "Cash", credit_card: "Card", app: "App", other: "Other" }[method] ?? method
  );
}

function paymentMethodClasses(method: string) {
  return (
    {
      cash: "bg-[#e8f3e8] text-[#2d6a2d]",
      credit_card: "bg-[#e8eef7] text-[#2a4a7f]",
      app: "bg-[#f6efe3] text-[#7a5420]",
    }[method] ?? "bg-[#eee8dd] text-[#4d555c]"
  );
}

const depositSelect =
  "id, amount, payment_method, received_at, available, used_at, memo, customer:customers(name, email), project:projects(subject), artist:staff(display_name)";

export default function DepositsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "used">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/deposits");
        return;
      }

      const hasAccess = await hasAccountingAccess(user.id);
      if (!hasAccess) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("deposits")
        .select(depositSelect)
        .order("received_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setDeposits((data ?? []) as unknown as DepositRecord[]);
      setLoading(false);
    }

    load();
  }, [router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deposits.filter((d) => {
      if (statusFilter === "available" && !d.available) return false;
      if (statusFilter === "used" && d.available) return false;
      if (term) {
        const customer = relatedOne(d.customer);
        const project = relatedOne(d.project);
        const artist = relatedOne(d.artist);
        const haystack = [customer?.name, project?.subject, artist?.display_name, d.memo]
          .filter(Boolean)
          .map((v) => v!.toLowerCase());
        if (!haystack.some((v) => v.includes(term))) return false;
      }
      return true;
    });
  }, [deposits, statusFilter, search]);

  const availableTotal = useMemo(
    () =>
      deposits
        .filter((d) => d.available)
        .reduce((sum, d) => sum + Number(d.amount), 0),
    [deposits],
  );
  const usedTotal = useMemo(
    () =>
      deposits
        .filter((d) => !d.available)
        .reduce((sum, d) => sum + Number(d.amount), 0),
    [deposits],
  );

  async function markUsed(deposit: DepositRecord) {
    const confirmed = window.confirm(
      `Mark this deposit (${money(Number(deposit.amount))}) as applied/used?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("deposits")
      .update({ available: false, used_at: new Date().toISOString() })
      .eq("id", deposit.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setDeposits((current) =>
      current.map((d) =>
        d.id === deposit.id
          ? { ...d, available: false, used_at: new Date().toISOString() }
          : d,
      ),
    );
    setMessage("Deposit marked as applied.");
    setSaving(false);
  }

  return (
    <AccountingShell
      active="Deposits"
      eyebrow="Deposit management"
      title="Deposits"
      description="Customer deposits received and held against future sessions."
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading deposits...
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                Available (On Hold)
              </p>
              <p className="mt-2 text-3xl font-black text-[#236c8f]">{money(availableTotal)}</p>
              <p className="mt-1.5 text-xs font-bold text-[#697178]">
                {deposits.filter((d) => d.available).length} deposits
              </p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                Applied to Sessions
              </p>
              <p className="mt-2 text-2xl font-black text-[#4d555c]">{money(usedTotal)}</p>
              <p className="mt-1.5 text-xs font-bold text-[#697178]">
                {deposits.filter((d) => !d.available).length} deposits
              </p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                All Time Total
              </p>
              <p className="mt-2 text-2xl font-black text-[#4d555c]">
                {money(availableTotal + usedTotal)}
              </p>
              <p className="mt-1.5 text-xs font-bold text-[#697178]">
                {deposits.length} deposits total
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(["all", "available", "used"] as const).map((s) => (
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
                  {s === "all" ? "All" : s === "available" ? "On hold" : "Applied"}
                </button>
              ))}
            </div>
            <input
              className="h-9 flex-1 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, project, artist..."
              value={search}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-10 text-sm font-semibold text-[#697178] shadow-sm">
              No deposits match the current filters.
            </div>
          ) : (
            <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                    <tr>
                      <th className="px-5 py-3">Received</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Project</th>
                      <th className="px-5 py-3">Artist</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {filtered.map((deposit) => {
                      const customer = relatedOne(deposit.customer);
                      const project = relatedOne(deposit.project);
                      const artist = relatedOne(deposit.artist);
                      return (
                        <tr key={deposit.id} className="hover:bg-[#fffaf1]">
                          <td className="px-5 py-3 text-xs text-[#4d555c]">
                            {formatDate(deposit.received_at)}
                          </td>
                          <td className="px-5 py-3 font-semibold">
                            {customer?.name ?? "-"}
                          </td>
                          <td className="px-5 py-3 text-[#697178]">
                            {project?.subject ?? "-"}
                          </td>
                          <td className="px-5 py-3">{artist?.display_name ?? "-"}</td>
                          <td className="px-5 py-3 text-right font-bold text-[#236c8f]">
                            {money(Number(deposit.amount))}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-bold ${paymentMethodClasses(deposit.payment_method)}`}
                            >
                              {paymentMethodLabel(deposit.payment_method)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {deposit.available ? (
                              <span className="rounded px-2 py-0.5 text-xs font-bold bg-[#f1eadc] text-[#775f36]">
                                On hold
                              </span>
                            ) : (
                              <span className="rounded px-2 py-0.5 text-xs font-bold bg-[#e4f1df] text-[#476b33]">
                                Applied
                                {deposit.used_at
                                  ? ` ${formatDate(deposit.used_at)}`
                                  : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {deposit.available ? (
                              <button
                                className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={saving}
                                onClick={() => markUsed(deposit)}
                                type="button"
                              >
                                Mark applied
                              </button>
                            ) : (
                              <span className="text-xs text-[#697178]">-</span>
                            )}
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
    </AccountingShell>
  );
}

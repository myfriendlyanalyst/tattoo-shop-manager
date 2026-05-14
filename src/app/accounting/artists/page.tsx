"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

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

type ArtistSummary = {
  artist_id: string;
  artist_name: string;
  tattoo_total: number;
  tip_total: number;
  merch_total: number;
  total: number;
  entry_count: number;
  entries: EntryRow[];
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function localDateValue(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
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
  "id, entered_at, entry_type, artist_id, artist_name, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method";

export default function ArtistsPage() {
  const router = useRouter();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaries, setSummaries] = useState<ArtistSummary[]>([]);
  const [expandedArtistId, setExpandedArtistId] = useState<string | null>(null);
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
        router.replace("/?next=/accounting/artists");
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

      const fromTs = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toTs = new Date(`${dateTo}T23:59:59.999`).toISOString();

      const { data, error: queryError } = await supabase
        .from("accounting_entries")
        .select(entrySelect)
        .gte("entered_at", fromTs)
        .lte("entered_at", toTs)
        .order("entered_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const artistMap: Record<string, ArtistSummary> = {};
      for (const e of data ?? []) {
        const raw = e as unknown as EntryRow & {
          artist_id: string | null;
          artist_name: string | null;
        };
        const key = raw.artist_id ?? "__unassigned__";
        if (!artistMap[key]) {
          artistMap[key] = {
            artist_id: key,
            artist_name: raw.artist_name ?? "Unassigned",
            tattoo_total: 0,
            tip_total: 0,
            merch_total: 0,
            total: 0,
            entry_count: 0,
            entries: [],
          };
        }
        artistMap[key].tattoo_total += Number(raw.tattoo_amount);
        artistMap[key].tip_total += Number(raw.tip_amount);
        artistMap[key].merch_total += Number(raw.merch_amount);
        artistMap[key].total += Number(raw.total_amount);
        artistMap[key].entry_count += 1;
        artistMap[key].entries.push(raw as EntryRow);
      }

      setSummaries(Object.values(artistMap).sort((a, b) => b.total - a.total));
      setLoading(false);
    }

    load();
  }, [router, dateFrom, dateTo]);

  const grandTotal = useMemo(
    () => summaries.reduce((s, a) => s + a.total, 0),
    [summaries],
  );

  function setPreset(monthsAgo: number, endToday = false) {
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = endToday
      ? new Date()
      : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
    setDateFrom(localDateValue(start));
    setDateTo(localDateValue(end));
  }

  return (
    <AccountingShell
      active="Artists"
      eyebrow="Revenue by artist"
      title="Artist Summary"
      description="Revenue breakdown per artist for the selected period."
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading artist summary...
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
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  From
                </p>
                <input
                  className="mt-1.5 h-9 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
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
                  className="mt-1.5 h-9 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(e) => setDateTo(e.target.value)}
                  type="date"
                  value={dateTo}
                />
              </div>
              {[
                { label: "This month", fn: () => setPreset(0, true) },
                { label: "Last month", fn: () => setPreset(1) },
                {
                  label: "This year",
                  fn: () => {
                    setDateFrom(localDateValue(new Date(now.getFullYear(), 0, 1)));
                    setDateTo(localDateValue());
                  },
                },
              ].map((p) => (
                <button
                  key={p.label}
                  className="h-9 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                  onClick={p.fn}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border-2 border-[#191b1f] bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[#697178]">
                  Period Total
                </p>
                <p className="mt-1 text-3xl font-black text-[#236c8f]">{money(grandTotal)}</p>
              </div>
              <p className="text-sm font-semibold text-[#697178]">{summaries.length} artists</p>
            </div>
          </div>

          {summaries.length === 0 ? (
            <div className="rounded-md border border-[#d9d3c7] bg-white px-5 py-10 text-sm font-semibold text-[#697178] shadow-sm">
              No entries in this period.
            </div>
          ) : (
            <div className="space-y-3">
              {summaries.map((artist) => {
                const expanded = expandedArtistId === artist.artist_id;
                const initials = artist.artist_name.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={artist.artist_id}
                    className="overflow-hidden rounded-md border border-[#d9d3c7] bg-white shadow-sm"
                  >
                    <button
                      className="w-full px-5 py-4 text-left transition hover:bg-[#f7f2e9]"
                      onClick={() =>
                        setExpandedArtistId(expanded ? null : artist.artist_id)
                      }
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#191b1f] text-sm font-black text-white">
                            {initials}
                          </div>
                          <div>
                            <p className="text-lg font-bold">{artist.artist_name}</p>
                            <p className="text-sm text-[#697178]">
                              {artist.entry_count} entr{artist.entry_count === 1 ? "y" : "ies"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="hidden sm:block">
                            <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                              Tattoo
                            </p>
                            <p className="font-semibold">{money(artist.tattoo_total)}</p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                              Tips
                            </p>
                            <p className="font-semibold">{money(artist.tip_total)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.06em] text-[#236c8f]">
                              Total
                            </p>
                            <p className="text-xl font-black text-[#236c8f]">
                              {money(artist.total)}
                            </p>
                          </div>
                          <span className="text-sm text-[#697178]">{expanded ? "Hide" : "Show"}</span>
                        </div>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="overflow-x-auto border-t border-[#e5dfd4]">
                        <table className="w-full min-w-[580px] text-left text-sm">
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
                            {artist.entries.map((e) => (
                              <tr key={e.id} className="hover:bg-[#fffaf1]">
                                <td className="px-5 py-2 text-xs text-[#4d555c]">
                                  {formatDate(e.entered_at)}
                                </td>
                                <td className="px-5 py-2">{e.customer_name ?? "-"}</td>
                                <td className="px-5 py-2 text-[#697178]">
                                  {e.project_subject ?? "-"}
                                </td>
                                <td className="px-5 py-2">
                                  <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-[#f1eadc] text-[#775f36]">
                                    {e.entry_type}
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
                          <tfoot className="border-t border-[#d9d3c7]">
                            <tr className="bg-[#f7f2e9] font-bold">
                              <td
                                className="px-5 py-2 text-xs uppercase tracking-[0.06em] text-[#697178]"
                                colSpan={4}
                              >
                                Subtotal
                              </td>
                              <td className="px-5 py-2 text-right">
                                {money(artist.tattoo_total)}
                              </td>
                              <td className="px-5 py-2 text-right text-[#697178]">
                                {money(artist.tip_total)}
                              </td>
                              <td className="px-5 py-2 text-right text-[#236c8f]">
                                {money(artist.total)}
                              </td>
                              <td className="px-5 py-2" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </AccountingShell>
  );
}

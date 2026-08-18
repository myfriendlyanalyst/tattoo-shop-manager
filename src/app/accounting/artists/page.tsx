"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { BarChart } from "@/components/accounting-charts";
import { DatePicker } from "@/components/date-picker";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { hasAccountingAccess } from "@/lib/accounting-access";

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

type ArtistSummary = {
  artist_id: string;
  artist_name: string;
  tattoo_total: number;
  tip_total: number;
  merch_total: number;
  total: number;
  entry_count: number;
  entries: EntryRow[];
  active_projects: number;
  on_hold_projects: number;
  upcoming_appointments: number;
  finalized_payout: number;
  paid_payout: number;
  trend: ArtistTrend[];
};

type ArtistTrend = {
  key: string;
  label: string;
  tattoo: number;
  tips: number;
  sessions: number;
  payout: number;
};

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button aria-label={text} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#9b9fa2] text-[10px] font-black text-[#697178]" type="button">?</button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md bg-[#1f2428] px-3 py-2 text-left text-xs font-medium normal-case tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">{text}</span>
    </span>
  );
}

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function threeMonthTrend(reference = new Date()): ArtistTrend[] {
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - 2 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      payout: 0,
      sessions: 0,
      tattoo: 0,
      tips: 0,
    };
  });
}

function printArtistSummary(summary: ArtistSummary, periodLabel: string) {
  const rows = summary.entries
    .map(
      (entry) => `
        <tr>
          <td>${formatDate(entry.entered_at)}</td>
          <td>${escapeHtml(entry.customer_name ?? "-")}</td>
          <td>${escapeHtml(entry.project_subject ?? "-")}</td>
          <td style="text-align:right">${money(Number(entry.tattoo_amount))}</td>
          <td style="text-align:right">${money(Number(entry.tip_amount))}</td>
          <td style="text-align:right"><strong>${money(Number(entry.total_amount))}</strong></td>
        </tr>
      `,
    )
    .join("");
  const popup = window.open("", "_blank", "width=960,height=720");
  if (!popup) return;

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Artist Sales Analysis - ${escapeHtml(summary.artist_name)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #1f2428; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .meta { color: #697178; font-size: 13px; margin-bottom: 22px; }
          .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0 22px; }
          .box { border: 1px solid #d9d3c7; border-radius: 6px; padding: 12px; }
          .label { color: #697178; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .value { margin-top: 6px; font-size: 18px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f7f2e9; color: #697178; text-align: left; text-transform: uppercase; font-size: 10px; padding: 8px; }
          td { border-bottom: 1px solid #eee8dd; padding: 8px; }
          tfoot td { border-top: 2px solid #1f2428; border-bottom: 0; font-weight: 900; }
          .footer { margin-top: 18px; color: #697178; font-size: 11px; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(summary.artist_name)}</h1>
        <div class="meta">${escapeHtml(periodLabel)} · ${summary.entry_count} entr${summary.entry_count === 1 ? "y" : "ies"}</div>
        <div class="totals">
          <div class="box"><div class="label">Tattoo</div><div class="value">${money(summary.tattoo_total)}</div></div>
          <div class="box"><div class="label">Tips</div><div class="value">${money(summary.tip_total)}</div></div>
          <div class="box"><div class="label">Gross Total</div><div class="value">${money(summary.total)}</div></div>
          <div class="box"><div class="label">Finalized Payout</div><div class="value">${money(summary.finalized_payout)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Project</th>
              <th style="text-align:right">Tattoo</th>
              <th style="text-align:right">Tip</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">Subtotal</td>
              <td style="text-align:right">${money(summary.tattoo_total)}</td>
              <td style="text-align:right">${money(summary.tip_total)}</td>
              <td style="text-align:right">${money(summary.total)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">Printed ${new Date().toLocaleString("en-US")} · Oyabun Accounting</div>
        <script>window.onload = function() { window.print(); };<\/script>
      </body>
    </html>
  `);
  popup.document.close();
}

const entrySelect =
  "id, entered_at, entry_type, artist_id, artist_name, customer_name, project_subject, tattoo_amount, tip_amount, merch_amount, total_amount, tattoo_payment_method, tip_payment_method";

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

      const hasAccess = await hasAccountingAccess(user.id);
      if (!hasAccess) {
        setError("Access denied.");
        setLoading(false);
        return;
      }

      const fromTs = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toTs = new Date(`${dateTo}T23:59:59.999`).toISOString();

      const trendReference = new Date();
      const trendTemplate = threeMonthTrend(trendReference);
      const trendFrom = `${trendTemplate[0].key}-01`;
      const trendFromTs = new Date(`${trendFrom}T00:00:00`).toISOString();
      const [entriesResult, staffResult, projectResult, appointmentResult, payoutResult, trendEntryResult, trendPayoutResult] = await Promise.all([
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
          .in("role", ["Artist", "Owner"]),
        supabase.from("projects").select("artist_id, status"),
        supabase.from("appointments").select("artist_id, status, starts_at").gte("starts_at", new Date().toISOString()),
        supabase
          .from("payouts")
          .select("artist_id, status, settlement_amount, period_start, period_end")
          .in("status", ["ready", "paid"])
          .gte("period_end", dateFrom)
          .lte("period_start", dateTo),
        supabase
          .from("accounting_entries")
          .select(entrySelect)
          .gte("entered_at", trendFromTs)
          .lte("entered_at", new Date().toISOString()),
        supabase
          .from("payouts")
          .select("artist_id, status, settlement_amount, period_end")
          .in("status", ["ready", "paid"])
          .gte("period_end", trendFrom)
          .lte("period_end", localDateValue(trendReference)),
      ]);

      if (entriesResult.error) {
        setError(entriesResult.error.message);
        setLoading(false);
        return;
      }

      const artistMap: Record<string, ArtistSummary> = {};
      for (const staff of staffResult.data ?? []) {
        const artist = staff as { id: string; display_name: string };
        artistMap[artist.id] = {
          artist_id: artist.id,
          artist_name: artist.display_name,
          tattoo_total: 0,
          tip_total: 0,
          merch_total: 0,
          total: 0,
          entry_count: 0,
          entries: [],
          active_projects: 0,
          on_hold_projects: 0,
          upcoming_appointments: 0,
          finalized_payout: 0,
          paid_payout: 0,
          trend: threeMonthTrend(trendReference),
        };
      }
      for (const e of entriesResult.data ?? []) {
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
            active_projects: 0,
            on_hold_projects: 0,
            upcoming_appointments: 0,
            finalized_payout: 0,
            paid_payout: 0,
            trend: threeMonthTrend(trendReference),
          };
        }
        artistMap[key].tattoo_total += Number(raw.tattoo_amount);
        artistMap[key].tip_total += Number(raw.tip_amount);
        artistMap[key].merch_total += Number(raw.merch_amount);
        artistMap[key].total += Number(raw.total_amount);
        artistMap[key].entry_count += 1;
        artistMap[key].entries.push(raw as EntryRow);
      }

      for (const project of projectResult.data ?? []) {
        const row = project as { artist_id: string | null; status: string };
        if (!row.artist_id || !artistMap[row.artist_id]) continue;
        if (["booked", "in_progress"].includes(row.status)) artistMap[row.artist_id].active_projects += 1;
        if (row.status === "on_hold") artistMap[row.artist_id].on_hold_projects += 1;
      }
      for (const appointment of appointmentResult.data ?? []) {
        const row = appointment as { artist_id: string | null; status: string };
        if (row.artist_id && artistMap[row.artist_id] && ["scheduled", "checked_in"].includes(row.status)) {
          artistMap[row.artist_id].upcoming_appointments += 1;
        }
      }
      for (const payout of payoutResult.data ?? []) {
        const row = payout as { artist_id: string | null; status: string; settlement_amount: number | null };
        if (!row.artist_id || !artistMap[row.artist_id]) continue;
        const amount = Number(row.settlement_amount ?? 0);
        artistMap[row.artist_id].finalized_payout += amount;
        if (row.status === "paid") artistMap[row.artist_id].paid_payout += amount;
      }
      for (const entry of trendEntryResult.data ?? []) {
        const row = entry as unknown as EntryRow & { artist_id: string | null };
        if (!row.artist_id || !artistMap[row.artist_id]) continue;
        const date = new Date(row.entered_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const month = artistMap[row.artist_id].trend.find((item) => item.key === key);
        if (!month) continue;
        month.tattoo += Number(row.tattoo_amount);
        month.tips += Number(row.tip_amount);
        if (row.entry_type === "session") month.sessions += 1;
      }
      for (const payout of trendPayoutResult.data ?? []) {
        const row = payout as { artist_id: string | null; period_end: string; settlement_amount: number | null };
        if (!row.artist_id || !artistMap[row.artist_id]) continue;
        const key = row.period_end.slice(0, 7);
        const month = artistMap[row.artist_id].trend.find((item) => item.key === key);
        if (month) month.payout += Number(row.settlement_amount ?? 0);
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
  const periodLabel = `${dateFrom} - ${dateTo}`;

  function setPreset(monthsAgo: number, endToday = false) {
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = endToday
      ? new Date()
      : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
    setDateFrom(localDateValue(start));
    setDateTo(localDateValue(end));
  }

  function shiftMonth(direction: -1 | 1) {
    const current = new Date(`${dateFrom}T12:00:00`);
    const target = new Date(current.getFullYear(), current.getMonth() + direction, 1);
    setDateFrom(localDateValue(target));
    setDateTo(localDateValue(new Date(target.getFullYear(), target.getMonth() + 1, 0)));
  }

  return (
    <AccountingShell
      active="Artists"
      eyebrow="Revenue by artist"
      title="Artist Sales Analysis"
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading artist sales analysis...
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
              <button aria-label="Previous month" className="h-9 w-9 rounded-md border border-[#cfc7b8] text-lg font-black hover:bg-[#eee8dd]" onClick={() => shiftMonth(-1)} type="button">‹</button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  From
                </p>
                <DatePicker onChange={setDateFrom} value={dateFrom} />
              </div>
              <button aria-label="Next month" className="h-9 w-9 rounded-md border border-[#cfc7b8] text-lg font-black hover:bg-[#eee8dd]" onClick={() => shiftMonth(1)} type="button">›</button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                  To
                </p>
                <DatePicker onChange={setDateTo} value={dateTo} />
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
                const averageSession = artist.entry_count ? artist.tattoo_total / artist.entry_count : 0;
                const outstandingPayout = artist.finalized_payout - artist.paid_payout;

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
                              {` · ${artist.active_projects} active projects`}
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
                          <div className="hidden lg:block">
                            <p className="text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                              Outstanding payout
                            </p>
                            <p className="font-black text-[#1f2428]">
                              {money(outstandingPayout)}
                            </p>
                          </div>
                          <span className="text-sm text-[#697178]">{expanded ? "Hide" : "Show"}</span>
                        </div>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="border-t border-[#e5dfd4]">
                        <div className="bg-[#f7f2e9] px-5 py-4">
                          <p className="mb-3 text-xs font-black uppercase tracking-[0.06em] text-[#697178]">Artist summary</p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div><p className="text-xs text-[#697178]">Avg. tattoo / entry <InfoTip text="Tattoo sales in the selected period divided by the number of accounting entries. Tips and deposits are excluded from the numerator." /></p><p className="font-black">{money(averageSession)}</p></div>
                            <div><p className="text-xs text-[#697178]">Active projects <InfoTip text="Current snapshot of this artist's Booked and In progress projects. Historical project status is not reconstructed." /></p><p className="font-black">{artist.active_projects}</p></div>
                            <div><p className="text-xs text-[#697178]">On hold projects <InfoTip text="Current number of projects placed On hold for this artist." /></p><p className="font-black">{artist.on_hold_projects}</p></div>
                            <div><p className="text-xs text-[#697178]">Upcoming appointments <InfoTip text="Current future appointments with Scheduled or Checked in status." /></p><p className="font-black">{artist.upcoming_appointments}</p></div>
                            <div><p className="text-xs text-[#697178]">Outstanding payout <InfoTip text="Finalized settlement amounts in the selected period that have not yet been marked Paid. This uses Payout records, not gross sales × rate." /></p><p className="font-black">{money(outstandingPayout)}</p></div>
                          </div>
                          <p className="mt-3 text-xs text-[#697178]">Operational counts are current snapshots. Financial figures follow the selected period.</p>
                        </div>

                        <div className="border-t border-[#e5dfd4] px-5 py-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-bold">Recent 3-month trends <InfoTip text="Monthly activity for the current month and the two preceding calendar months, independent of the period filter above." /></h4>
                            <p className="mt-1 text-xs text-[#697178]">Current month and previous two calendar months</p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md border border-[#e5dfd4] p-3"><p className="text-xs font-bold text-[#697178]">Tattoo sales <InfoTip text="Tattoo amounts entered in Sessions during each month." /></p><BarChart data={artist.trend.map((month) => ({ label: month.label, value: month.tattoo }))} height={130} /></div>
                            <div className="rounded-md border border-[#e5dfd4] p-3"><p className="text-xs font-bold text-[#697178]">Tips <InfoTip text="Tip amounts entered during each month." /></p><BarChart color="#8a5130" data={artist.trend.map((month) => ({ label: month.label, value: month.tips }))} height={130} /></div>
                            <div className="rounded-md border border-[#e5dfd4] p-3"><p className="text-xs font-bold text-[#697178]">Sessions <InfoTip text="Number of completed Session accounting entries in each month." /></p><BarChart color="#476b33" data={artist.trend.map((month) => ({ label: month.label, value: month.sessions }))} height={130} valueFormatter={(value) => String(value)} /></div>
                            <div className="rounded-md border border-[#e5dfd4] p-3"><p className="text-xs font-bold text-[#697178]">Finalized payout <InfoTip text="Settlement amount from Ready or Paid Payout records, grouped by payout period end month." /></p><BarChart color="#775f36" data={artist.trend.map((month) => ({ label: month.label, value: month.payout }))} height={130} /></div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[580px] text-left text-sm">
                            <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
                              <tr>
                                <th className="px-5 py-2">Date</th>
                                <th className="px-5 py-2">Client</th>
                                <th className="px-5 py-2">Project</th>
                                <th className="px-5 py-2 text-right">Session sales</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eee8dd]">
                              {artist.entries.filter((entry) => entry.entry_type === "session").map((e) => (
                                <tr key={e.id} className="hover:bg-[#fffaf1]">
                                  <td className="px-5 py-2 text-xs text-[#4d555c]">
                                    {formatDate(e.entered_at)}
                                  </td>
                                  <td className="px-5 py-2">{e.customer_name ?? "-"}</td>
                                  <td className="px-5 py-2 text-[#697178]">
                                    {e.project_subject ?? "-"}
                                  </td>
                                  <td className="px-5 py-2 text-right font-bold text-[#236c8f]">
                                    {money(Number(e.total_amount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-[#d9d3c7]">
                              <tr className="bg-[#f7f2e9] font-bold">
                                <td
                                  className="px-5 py-2 text-xs uppercase tracking-[0.06em] text-[#697178]"
                                  colSpan={3}
                                >
                                  Subtotal
                                </td>
                                <td className="px-5 py-2 text-right text-[#236c8f]">
                                  {money(artist.entries.filter((entry) => entry.entry_type === "session").reduce((sum, entry) => sum + Number(entry.total_amount), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-[#e5dfd4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="grid gap-1 text-sm">
                            <p>
                              <span className="font-semibold text-[#697178]">Finalized payout:</span>{" "}
                              <span className="font-black text-[#1f2428]">
                                {money(artist.finalized_payout)}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-[#697178]">Paid {money(artist.paid_payout)} · Outstanding {money(outstandingPayout)}</span>
                            </p>
                          </div>
                          <button
                            className="h-9 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                            onClick={() => printArtistSummary(artist, periodLabel)}
                            type="button"
                          >
                            Print summary
                          </button>
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
    </AccountingShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountingShell } from "@/components/accounting-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash", color: "bg-[#e8f3e8] text-[#2d6a2d]" },
  { key: "credit_card", label: "Credit Card", color: "bg-[#e8eef7] text-[#2a4a7f]" },
  { key: "app", label: "App (Venmo / Zelle)", color: "bg-[#f6efe3] text-[#7a5420]" },
  { key: "other", label: "Other", color: "bg-[#eee8dd] text-[#4d555c]" },
];

const ENTRY_TYPES = [
  { key: "session", label: "Session", description: "Tattoo appointment revenue" },
  { key: "deposit", label: "Deposit", description: "Deposit received against a future session" },
  { key: "merch", label: "Merch", description: "Merchandise sale" },
];

const PAYOUT_STATUSES = [
  { key: "draft", label: "Draft", description: "Payout period created, not yet reviewed" },
  { key: "ready", label: "Ready", description: "Reviewed and ready to pay out" },
  { key: "paid", label: "Paid", description: "Artist has been paid" },
  { key: "void", label: "Void", description: "Cancelled or invalid payout period" },
];

export default function AccountingSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      if (!user) {
        router.replace("/?next=/accounting/settings");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "owner" && profile?.role !== "admin") {
        setError("Access denied.");
      }

      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <AccountingShell
      active="Settings"
      eyebrow="Accounting settings"
      title="Settings"
      description="Reference values and configuration for the accounting module."
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading settings...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
      <div className="space-y-6">
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-5 py-4">
            <h2 className="text-base font-bold">Payment Methods</h2>
            <p className="mt-1 text-sm text-[#697178]">
              Fixed values stored in accounting entries. To add new methods, a schema migration is required.
            </p>
          </div>
          <div className="divide-y divide-[#f0ebe2]">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.key} className="flex items-center gap-4 px-5 py-3">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${m.color}`}>
                  {m.label}
                </span>
                <span className="font-mono text-xs text-[#697178]">{m.key}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-5 py-4">
            <h2 className="text-base font-bold">Entry Types</h2>
            <p className="mt-1 text-sm text-[#697178]">
              Types used when recording accounting entries.
            </p>
          </div>
          <div className="divide-y divide-[#f0ebe2]">
            {ENTRY_TYPES.map((t) => (
              <div key={t.key} className="flex items-start gap-4 px-5 py-3">
                <span className="rounded bg-[#f1eadc] px-2 py-0.5 text-xs font-bold text-[#775f36]">
                  {t.label}
                </span>
                <div>
                  <p className="font-mono text-xs text-[#697178]">{t.key}</p>
                  <p className="mt-0.5 text-sm text-[#4d555c]">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-5 py-4">
            <h2 className="text-base font-bold">Payout Statuses</h2>
            <p className="mt-1 text-sm text-[#697178]">
              Lifecycle states for artist payout periods.
            </p>
          </div>
          <div className="divide-y divide-[#f0ebe2]">
            {PAYOUT_STATUSES.map((s) => (
              <div key={s.key} className="flex items-start gap-4 px-5 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    {
                      draft: "bg-[#f1eadc] text-[#775f36]",
                      ready: "bg-[#e8eef7] text-[#2a4a7f]",
                      paid: "bg-[#e4f1df] text-[#476b33]",
                      void: "bg-[#f5e8e8] text-[#7a2020]",
                    }[s.key] ?? "bg-[#eee8dd] text-[#4d555c]"
                  }`}
                >
                  {s.label}
                </span>
                <p className="mt-0.5 text-sm text-[#4d555c]">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d9d3c7] bg-[#fffaf1] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#775f36]">Future expansion</h2>
          <p className="mt-2 text-sm text-[#4d555c]">
            An <code className="rounded bg-[#f1eadc] px-1 py-0.5 text-xs">accounting_categories</code> table
            is planned to allow configurable revenue categories (e.g. flash, custom, coverup) per shop.
            This requires a SQL migration — see <code className="rounded bg-[#f1eadc] px-1 py-0.5 text-xs">docs/supabase_accounting_migration.sql</code> for the proposed schema.
          </p>
        </div>
      </div>
      ) : null}
    </AccountingShell>
  );
}

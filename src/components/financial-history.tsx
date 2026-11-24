"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuditEvent = {
  id: string;
  actor_id: string | null;
  action: "insert" | "update" | "delete";
  entity_type: string;
  entity_id: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string;
  occurred_at: string;
};

type FinancialHistoryProps = {
  entityId?: string;
  entityType?: string;
  title?: string;
};

const ignoredKeys = new Set(["created_at", "updated_at"]);

function changedFields(event: AuditEvent) {
  if (event.action !== "update" || !event.before_value || !event.after_value) return [];
  return Array.from(new Set([...Object.keys(event.before_value), ...Object.keys(event.after_value)]))
    .filter((key) => !ignoredKeys.has(key))
    .filter((key) => JSON.stringify(event.before_value?.[key]) !== JSON.stringify(event.after_value?.[key]));
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function FinancialHistory({ entityId, entityType, title = "Change history" }: FinancialHistoryProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      let query = supabase
        .from("financial_audit_events")
        .select("id, actor_id, action, entity_type, entity_id, before_value, after_value, reason, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(entityId ? 25 : 100);

      if (entityType) query = query.eq("entity_type", entityType);
      if (entityId) query = query.eq("entity_id", entityId);

      const result = await query;
      if (!active) return;
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setError("");
      setEvents((result.data ?? []) as AuditEvent[]);
    }

    void load();
    return () => {
      active = false;
    };
  }, [entityId, entityType]);

  return (
    <section className="rounded-lg border border-[#d9d3c7] bg-white p-5">
      <h3 className="text-base font-bold">{title}</h3>
      {loading ? <p className="mt-3 text-sm text-[#697178]">Loading history...</p> : null}
      {error ? <p className="mt-3 rounded bg-[#f3e1e1] px-3 py-2 text-sm text-[#8a3030]">{error}</p> : null}
      {!loading && !error && events.length === 0 ? (
        <p className="mt-3 text-sm text-[#697178]">No changes have been recorded yet.</p>
      ) : null}
      <ol className="mt-3 divide-y divide-[#e5dfd3]">
        {events.map((event) => {
          const fields = changedFields(event);
          return (
            <li className="py-3 first:pt-0 last:pb-0" key={event.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {label(event.action)} · {label(event.entity_type)}
                </p>
                <time className="text-xs text-[#697178]" dateTime={event.occurred_at}>
                  {new Date(event.occurred_at).toLocaleString("en-US")}
                </time>
              </div>
              <p className="mt-1 text-xs text-[#697178]">
                Actor: {event.actor_id ?? "System"} · Reason: {label(event.reason)}
              </p>
              {fields.length ? (
                <p className="mt-1 text-xs text-[#4d555c]">Changed: {fields.map(label).join(", ")}</p>
              ) : null}
              {!entityId ? <p className="mt-1 font-mono text-[11px] text-[#697178]">{event.entity_id}</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

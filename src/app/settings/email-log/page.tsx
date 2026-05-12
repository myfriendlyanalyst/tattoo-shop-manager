"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

type EmailLogRecord = {
  id: string;
  appointment_id: string | null;
  customer_id: string | null;
  email_type: string;
  to_email: string | null;
  reply_to_email: string | null;
  cc_emails: string[] | null;
  subject: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  appointment:
    | {
        starts_at: string;
        project: { subject: string } | { subject: string }[] | null;
      }
    | {
        starts_at: string;
        project: { subject: string } | { subject: string }[] | null;
      }[]
    | null;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
};

const statusOptions = ["all", "sent", "scheduled", "failed", "skipped", "cancelled"];
const typeOptions = [
  "all",
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_reschedule",
  "appointment_cancellation",
];

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function emailTypeLabel(type: string) {
  const labels: Record<string, string> = {
    appointment_cancellation: "Cancellation",
    appointment_confirmation: "Confirmation",
    appointment_reminder: "Reminder",
    appointment_reschedule: "Reschedule",
  };

  return labels[type] ?? type;
}

function statusClasses(status: string) {
  const labels: Record<string, string> = {
    cancelled: "bg-[#eee8dd] text-[#697178]",
    failed: "bg-[#f3e1e1] text-[#8a3030]",
    scheduled: "bg-[#e7f0eb] text-[#2f6658]",
    sent: "bg-[#e7f0eb] text-[#2f6658]",
    skipped: "bg-[#f7f2e9] text-[#8a6f4d]",
  };

  return labels[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

export default function EmailLogPage() {
  const [logs, setLogs] = useState<EmailLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const customer = relatedOne(log.customer);
      const appointment = relatedOne(log.appointment);
      const project = relatedOne(appointment?.project ?? null);
      const statusMatches = statusFilter === "all" || log.status === statusFilter;
      const typeMatches = typeFilter === "all" || log.email_type === typeFilter;
      const searchMatches =
        !term ||
        [
          customer?.name,
          customer?.email,
          log.to_email,
          log.subject,
          project?.subject,
          log.provider_message_id,
          log.error_message,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return statusMatches && typeMatches && searchMatches;
    });
  }, [logs, search, statusFilter, typeFilter]);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();

      if (!user) {
        setError("Please log in to view email logs.");
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("email_logs")
        .select(
          "id, appointment_id, customer_id, email_type, to_email, reply_to_email, cc_emails, subject, status, provider, provider_message_id, error_message, sent_at, created_at, appointment:appointments(starts_at, project:projects(subject)), customer:customers(name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(250);

      if (result.error) {
        setError(
          `${result.error.message}. Run docs/supabase_appointment_emails.sql in Supabase SQL Editor.`,
        );
        setLoading(false);
        return;
      }

      setLogs((result.data ?? []) as unknown as EmailLogRecord[]);
      setLoading(false);
    }

    loadLogs();
  }, []);

  return (
    <AppShell
      active="Settings"
      eyebrow="Settings"
      title="Email log"
      description="Review automated email activity, scheduled reminders, and delivery failures."
      actions={
        <Link
          className="h-10 rounded-md border border-[#cfc7b8] px-4 py-2 text-sm font-semibold hover:bg-[#eee8dd]"
          href="/settings"
        >
          Settings
        </Link>
      }
      wide
    >
      <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#e5dfd4] px-4 py-4 md:grid-cols-[1fr_180px_220px]">
          <input
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, subject, email, provider id..."
            value={search}
          />
          <select
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setTypeFilter(event.target.value)}
            value={typeFilter}
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All email types" : emailTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="m-4 rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="px-4 py-6 text-sm font-semibold text-[#697178]">Loading email logs...</p>
        ) : null}

        {!loading && filteredLogs.length === 0 ? (
          <p className="px-4 py-6 text-sm font-semibold text-[#697178]">No email logs found.</p>
        ) : null}

        <div className="divide-y divide-[#eee8dd]">
          {filteredLogs.map((log) => {
            const appointment = relatedOne(log.appointment);
            const project = relatedOne(appointment?.project ?? null);
            const customer = relatedOne(log.customer);
            const displayTime = log.sent_at || log.created_at;

            return (
              <div
                className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.9fr_1.1fr_1.1fr_0.8fr]"
                key={log.id}
              >
                <div>
                  <p className="font-semibold">{emailTypeLabel(log.email_type)}</p>
                  <p className="mt-1 text-[#697178]">{displayDateTime(displayTime)}</p>
                  {appointment ? (
                    <p className="mt-1 text-xs text-[#8a8174]">
                      Appointment {displayDateTime(appointment.starts_at)}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="font-semibold">{customer?.name || "-"}</p>
                  <p className="mt-1 text-[#697178]">{log.to_email || customer?.email || "-"}</p>
                </div>
                <div>
                  <p className="font-semibold">{project?.subject || "No project"}</p>
                  <p className="mt-1 text-[#697178]">{log.subject || "-"}</p>
                </div>
                <div>
                  <p className="text-[#697178]">Reply-To {log.reply_to_email || "-"}</p>
                  {log.cc_emails && log.cc_emails.length > 0 ? (
                    <p className="mt-1 text-[#697178]">CC {log.cc_emails.join(", ")}</p>
                  ) : null}
                  {log.provider_message_id ? (
                    <p className="mt-1 text-xs text-[#8a8174]">
                      {log.provider} {log.provider_message_id}
                    </p>
                  ) : null}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded px-2 py-1 text-xs font-bold ${statusClasses(
                      log.status,
                    )}`}
                  >
                    {log.status}
                  </span>
                  {log.error_message ? (
                    <p className="mt-2 text-xs font-semibold text-[#8a3030]">
                      {log.error_message}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPage } from "@/components/app-shell";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

type AppointmentEmailLogRecord = {
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

type RequestMessageRecord = {
  id: string;
  request_id: string;
  provider: string;
  provider_thread_id: string | null;
  provider_message_id: string | null;
  direction: "inbound" | "outbound";
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  request:
    | {
        request_number: number | null;
        client_name: string | null;
        email: string | null;
        subject: string | null;
        status: string | null;
      }
    | {
        request_number: number | null;
        client_name: string | null;
        email: string | null;
        subject: string | null;
        status: string | null;
      }[]
    | null;
};

type UnifiedEmailLog = {
  id: string;
  source: "request" | "appointment";
  type: string;
  status: string;
  time: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  context: string;
  direction?: "inbound" | "outbound";
  fromEmail?: string | null;
  fromName?: string | null;
  toEmails?: string[] | null;
  ccEmails?: string[] | null;
  replyToEmail?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  preview?: string | null;
};

const sourceOptions = ["all", "request", "appointment"];
const statusOptions = [
  "all",
  "inbound",
  "outbound",
  "sent",
  "scheduled",
  "failed",
  "skipped",
  "cancelled",
];
const typeOptions = [
  "all",
  "request_message",
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

function requestCode(value: number | null | undefined) {
  return value ? `REQ-${String(value).padStart(5, "0")}` : "Request";
}

function emailTypeLabel(type: string) {
  const labels: Record<string, string> = {
    appointment_cancellation: "Appointment cancellation",
    appointment_confirmation: "Appointment confirmation",
    appointment_reminder: "Appointment reminder",
    appointment_reschedule: "Appointment reschedule",
    request_message: "Request message",
  };

  return labels[type] ?? type;
}

function statusClasses(status: string) {
  const labels: Record<string, string> = {
    cancelled: "bg-[#eee8dd] text-[#697178]",
    failed: "bg-[#f3e1e1] text-[#8a3030]",
    inbound: "bg-[#e8f0ee] text-[#2f6658]",
    outbound: "bg-[#e5edf4] text-[#315f82]",
    scheduled: "bg-[#e7f0eb] text-[#2f6658]",
    sent: "bg-[#e7f0eb] text-[#2f6658]",
    skipped: "bg-[#f7f2e9] text-[#8a6f4d]",
  };

  return labels[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function mapAppointmentLog(log: AppointmentEmailLogRecord): UnifiedEmailLog {
  const appointment = relatedOne(log.appointment);
  const project = relatedOne(appointment?.project ?? null);
  const customer = relatedOne(log.customer);
  const time = log.sent_at || log.created_at;

  return {
    id: `appointment:${log.id}`,
    source: "appointment",
    type: log.email_type,
    status: log.status,
    time,
    clientName: customer?.name || "-",
    clientEmail: log.to_email || customer?.email || "-",
    subject: log.subject || "-",
    context: project?.subject || "No project",
    ccEmails: log.cc_emails,
    errorMessage: log.error_message,
    provider: log.provider,
    providerMessageId: log.provider_message_id,
    replyToEmail: log.reply_to_email,
    preview: appointment ? `Appointment ${displayDateTime(appointment.starts_at)}` : null,
  };
}

function mapRequestLog(log: RequestMessageRecord): UnifiedEmailLog {
  const request = relatedOne(log.request);
  const time = log.sent_at || log.received_at || log.created_at;
  const clientName = request?.client_name || log.from_name || "-";
  const clientEmail = request?.email || log.from_email || "-";
  const contextParts = [
    requestCode(request?.request_number),
    request?.subject,
    request?.status ? `Status: ${request.status}` : null,
  ].filter(Boolean);

  return {
    id: `request:${log.id}`,
    source: "request",
    type: "request_message",
    status: log.direction,
    time,
    clientName,
    clientEmail,
    subject: log.subject || "-",
    context: contextParts.join(" / "),
    ccEmails: log.cc_emails,
    direction: log.direction,
    fromEmail: log.from_email,
    fromName: log.from_name,
    provider: log.provider,
    providerMessageId: log.provider_message_id,
    preview: log.snippet || log.body_text,
    toEmails: log.to_emails,
  };
}

export default function EmailLogPage() {
  const [logs, setLogs] = useState<UnifiedEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const sourceMatches = sourceFilter === "all" || log.source === sourceFilter;
      const statusMatches = statusFilter === "all" || log.status === statusFilter;
      const typeMatches = typeFilter === "all" || log.type === typeFilter;
      const searchMatches =
        !term ||
        [
          log.clientName,
          log.clientEmail,
          log.context,
          log.errorMessage,
          log.fromEmail,
          log.fromName,
          log.preview,
          log.provider,
          log.providerMessageId,
          log.subject,
          ...(log.toEmails ?? []),
          ...(log.ccEmails ?? []),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return sourceMatches && statusMatches && typeMatches && searchMatches;
    });
  }, [logs, search, sourceFilter, statusFilter, typeFilter]);

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

      const [appointmentResult, requestResult] = await Promise.all([
        supabase
          .from("email_logs")
          .select(
            "id, appointment_id, customer_id, email_type, to_email, reply_to_email, cc_emails, subject, status, provider, provider_message_id, error_message, sent_at, created_at, appointment:appointments(starts_at, project:projects(subject)), customer:customers(name, email)",
          )
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("request_messages")
          .select(
            "id, request_id, provider, provider_thread_id, provider_message_id, direction, from_email, from_name, to_emails, cc_emails, subject, body_text, snippet, sent_at, received_at, created_at, request:requests(request_number, client_name, email, subject, status)",
          )
          .order("created_at", { ascending: false })
          .limit(250),
      ]);

      const errors = [appointmentResult.error, requestResult.error].filter(Boolean);

      if (errors.length > 0) {
        setError(
          errors
            .map((item) => item!.message)
            .join(" / ")
            .concat(
              ". Run docs/supabase_appointment_emails.sql and docs/request_email_tracking_migration.sql in Supabase SQL Editor if needed.",
            ),
        );
        setLoading(false);
        return;
      }

      const unifiedLogs = [
        ...((appointmentResult.data ?? []) as unknown as AppointmentEmailLogRecord[]).map(
          mapAppointmentLog,
        ),
        ...((requestResult.data ?? []) as unknown as RequestMessageRecord[]).map(mapRequestLog),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setLogs(unifiedLogs);
      setLoading(false);
    }

    loadLogs();
  }, []);

  return (
    <AppPage
      eyebrow="Settings"
      title="Email log"
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
        <div className="grid gap-3 border-b border-[#e5dfd4] px-4 py-4 md:grid-cols-[1fr_150px_170px_220px]">
          <input
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, subject, request, email, provider id..."
            value={search}
          />
          <select
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setSourceFilter(event.target.value)}
            value={sourceFilter}
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? "All sources" : source}
              </option>
            ))}
          </select>
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
          {filteredLogs.map((log) => (
            <div
              className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.85fr_0.95fr_1.2fr_1.2fr_0.8fr]"
              key={log.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#f7f2e9] px-2 py-1 text-xs font-bold uppercase text-[#7d684d]">
                    {log.source}
                  </span>
                  <p className="font-semibold">{emailTypeLabel(log.type)}</p>
                </div>
                <p className="mt-1 text-[#697178]">{displayDateTime(log.time)}</p>
                {log.preview ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[#8a8174]">{log.preview}</p>
                ) : null}
              </div>
              <div>
                <p className="font-semibold">{log.clientName}</p>
                <p className="mt-1 text-[#697178]">{log.clientEmail}</p>
              </div>
              <div>
                <p className="font-semibold">{log.context || "-"}</p>
                <p className="mt-1 text-[#697178]">{log.subject}</p>
              </div>
              <div>
                {log.fromEmail ? (
                  <p className="text-[#697178]">
                    From {log.fromName ? `${log.fromName} ` : ""}
                    {log.fromEmail}
                  </p>
                ) : null}
                {log.toEmails && log.toEmails.length > 0 ? (
                  <p className="mt-1 text-[#697178]">To {log.toEmails.join(", ")}</p>
                ) : null}
                {log.replyToEmail ? (
                  <p className="mt-1 text-[#697178]">Reply-To {log.replyToEmail}</p>
                ) : null}
                {log.ccEmails && log.ccEmails.length > 0 ? (
                  <p className="mt-1 text-[#697178]">CC {log.ccEmails.join(", ")}</p>
                ) : null}
                {log.providerMessageId ? (
                  <p className="mt-1 text-xs text-[#8a8174]">
                    {log.provider} {log.providerMessageId}
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
                {log.errorMessage ? (
                  <p className="mt-2 text-xs font-semibold text-[#8a3030]">
                    {log.errorMessage}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppPage>
  );
}

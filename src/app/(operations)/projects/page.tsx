"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage } from "@/components/app-shell";
import { DateTimeSelect } from "@/components/time-select";
import { getSafeUser } from "@/lib/auth-session";
import { getOperationsContext, type OperationsContext } from "@/lib/operations-access";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
};

type CustomerRelation = {
  name: string;
  email: string | null;
  phone: string | null;
};

type ArtistRelation = {
  display_name: string;
};

type ProjectRecord = {
  id: string;
  customer_id: string;
  artist_id: string | null;
  subject: string;
  size: string | null;
  session_type: string | null;
  waiver_signed: boolean;
  waiver_status: string;
  waiver_sent_at: string | null;
  waiver_signed_at: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  customer: CustomerRelation | CustomerRelation[] | null;
  artist: ArtistRelation | ArtistRelation[] | null;
};

type AppointmentRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  status: string;
};

type DepositRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  amount: number;
  payment_method: string | null;
  received_at: string;
  available: boolean;
  used_at: string | null;
  used_session_entry_id: string | null;
  memo: string | null;
};

type DepositApplicationRecord = {
  id: string;
  deposit_id: string;
  session_entry_id: string;
  amount: number;
  applied_at: string;
  memo: string | null;
};

type SessionPaymentRecord = {
  id: string;
  session_entry_id: string;
  payment_method: string;
  amount: number;
  memo: string | null;
};

type SessionEntryRecord = {
  id: string;
  appointment_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  entered_at: string;
  entry_type: string;
  tattoo_amount: number | null;
  tattoo_payment_method: string | null;
  tip_amount: number | null;
  tip_payment_method: string | null;
  memo: string | null;
};

type DepositForm = {
  amount: string;
  paymentMethod: string;
  receivedAt: string;
  memo: string;
};

type SessionForm = {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  depositAppliedAmount: string;
  tattooAmount: string;
  tattooPaymentMethod: string;
  paymentLines: PaymentLineForm[];
  tipAmount: string;
  tipPaymentMethod: string;
  memo: string;
};

type PaymentLineForm = {
  id: string;
  paymentMethod: string;
  amount: string;
};

const projectSelect =
  "id, customer_id, artist_id, subject, size, session_type, waiver_signed, waiver_status, waiver_sent_at, waiver_signed_at, status, memo, created_at, customer:customers(name, email, phone), artist:staff(display_name)";

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

const projectStatusOptions = [
  { value: "booked", label: "Booked" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "on_hold", label: "On hold" },
];

const projectTypeOptions = ["Walk-in", "One Done", "Multiple Session"];
const activeProjectStatuses = ["booked", "in_progress", "on_hold"];

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateTimeInput(value = new Date()) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function numberInputValue(value: number | null | undefined) {
  return value && value > 0 ? String(value) : "";
}

function paymentLabel(value: string | null | undefined) {
  return paymentMethods.find((method) => method.value === value)?.label ?? value ?? "-";
}

function appointmentLabel(appointment: AppointmentRecord) {
  return `${displayDateTime(appointment.starts_at)} / ${appointment.appointment_type}`;
}

function depositAppliedTotal(depositId: string, applications: DepositApplicationRecord[]) {
  return applications
    .filter((application) => application.deposit_id === depositId)
    .reduce((sum, application) => sum + Number(application.amount), 0);
}

function depositRemaining(deposit: DepositRecord, applications: DepositApplicationRecord[]) {
  return Math.max(Number(deposit.amount) - depositAppliedTotal(deposit.id, applications), 0);
}

function memoField(memo: string | null, label: string) {
  if (!memo) {
    return "";
  }

  const prefix = `${label}:`.toLowerCase();
  const line = memo
    .split(/\r?\n/)
    .find((item) => item.trim().toLowerCase().startsWith(prefix));

  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function plainProjectNotes(memo: string | null) {
  if (!memo) {
    return "";
  }

  const structuredLabels = [
    "Tattoo description",
    "Approximate size",
    "Placement",
    "Customer address",
    "Address",
    "Timing preference",
    "Reference image",
    "Requested artist",
  ];
  const structuredPrefixes = structuredLabels.map((label) => `${label}:`.toLowerCase());

  return memo
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = line.trim().toLowerCase();
      return normalized && !structuredPrefixes.some((prefix) => normalized.startsWith(prefix));
    })
    .join("\n")
    .trim();
}

function newPaymentLine(method = "cash", amount = ""): PaymentLineForm {
  return {
    id: crypto.randomUUID(),
    paymentMethod: method,
    amount,
  };
}

function projectStatusLabel(status: string) {
  const labels: Record<string, string> = {
    consultation: "Booked",
    booked: "Booked",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    on_hold: "On hold",
  };

  return labels[status] ?? status;
}

function projectStatusClasses(status: string) {
  const variants: Record<string, string> = {
    consultation: "bg-[#e4f1df] text-[#476b33]",
    booked: "bg-[#e4f1df] text-[#476b33]",
    in_progress: "bg-[#e5edf4] text-[#315f82]",
    completed: "bg-[#e8f0ee] text-[#2f6658]",
    cancelled: "bg-[#f3e1e1] text-[#8a3030]",
    on_hold: "bg-[#f4e7df] text-[#8a5130]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function waiverLabel(project: ProjectRecord) {
  if (project.waiver_signed || project.waiver_status === "signed") {
    return "Signed";
  }

  if (project.waiver_status === "sent") {
    return "Sent";
  }

  return "Missing";
}

function waiverClasses(project: ProjectRecord) {
  const status = waiverLabel(project);

  if (status === "Signed") {
    return "bg-[#e8f0ee] text-[#2f6658]";
  }

  if (status === "Sent") {
    return "bg-[#e5edf4] text-[#315f82]";
  }

  return "bg-[#f4e7df] text-[#8a5130]";
}

function artistName(project: ProjectRecord) {
  return relatedOne(project.artist)?.display_name ?? "Unassigned";
}

function customerName(project: ProjectRecord) {
  return relatedOne(project.customer)?.name ?? "Unknown customer";
}

function groupLabel(project: ProjectRecord) {
  return artistName(project);
}

function DepositEntryModal({
  error,
  saving,
  project,
  deposit,
  appliedAmount,
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  project: ProjectRecord;
  deposit?: DepositRecord | null;
  appliedAmount?: number;
  onClose: () => void;
  onSave: (form: DepositForm) => void;
}) {
  const [form, setForm] = useState<DepositForm>({
    amount: numberInputValue(deposit?.amount),
    paymentMethod: deposit?.payment_method ?? "cash",
    receivedAt: deposit ? localDateTimeInput(new Date(deposit.received_at)) : localDateTimeInput(),
    memo: deposit?.memo ?? "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">Deposit entry</p>
            <h3 className="mt-1 text-xl font-semibold">
              {deposit ? "Edit deposit" : project.subject}
            </h3>
            {deposit && appliedAmount ? (
              <p className="mt-1 text-sm text-[#697178]">
                Already applied: {money(appliedAmount)}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close deposit entry"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Amount
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                min="0"
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.amount}
              />
            </label>
            <label className="text-sm font-semibold">
              Payment method
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, paymentMethod: event.target.value }))
                }
                value={form.paymentMethod}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Received at
            <div className="mt-2">
              <DateTimeSelect
                onChange={(value) =>
                  setForm((current) => ({ ...current, receivedAt: value }))
                }
                startHour={8}
                value={form.receivedAt}
              />
            </div>
          </label>

          <textarea
            className="min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
            placeholder="Memo"
            value={form.memo}
          />

          <button
            className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(form)}
            type="button"
          >
            {saving ? "Saving..." : deposit ? "Update deposit" : "Save deposit"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SessionEntryModal({
  error,
  saving,
  project,
  session,
  appointments,
  depositApplications,
  availableDepositBalance,
  sessionPayments,
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  project: ProjectRecord;
  session?: SessionEntryRecord | null;
  appointments: AppointmentRecord[];
  depositApplications: DepositApplicationRecord[];
  availableDepositBalance: number;
  sessionPayments: SessionPaymentRecord[];
  onClose: () => void;
  onSave: (form: SessionForm) => void;
}) {
  const sessionDepositApplication = session
    ? depositApplications.filter((application) => application.session_entry_id === session.id)
    : [];
  const sessionAppliedDepositTotal = sessionDepositApplication.reduce(
    (sum, application) => sum + Number(application.amount),
    0,
  );
  const availableDepositForSession = availableDepositBalance + sessionAppliedDepositTotal;
  const sessionPaymentLines = session
    ? sessionPayments
        .filter((payment) => payment.session_entry_id === session.id)
        .map((payment) => newPaymentLine(payment.payment_method, numberInputValue(payment.amount)))
    : [];
  const [form, setForm] = useState<SessionForm>(() => {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    return {
      appointmentId: session?.appointment_id ?? appointments[0]?.id ?? "",
      startsAt: localDateTimeInput(startsAt),
      endsAt: localDateTimeInput(endsAt),
      depositAppliedAmount: numberInputValue(sessionAppliedDepositTotal),
      tattooAmount: numberInputValue(session?.tattoo_amount),
      tattooPaymentMethod: session?.tattoo_payment_method ?? "cash",
      paymentLines:
        sessionPaymentLines.length > 0
          ? sessionPaymentLines
          : [newPaymentLine(session?.tattoo_payment_method ?? "cash")],
      tipAmount: numberInputValue(session?.tip_amount),
      tipPaymentMethod: session?.tip_payment_method ?? "cash",
      memo: session?.memo ?? "",
    };
  });
  const tattooAmount = Number(form.tattooAmount || 0);
  const appliedDepositAmount = Number(form.depositAppliedAmount || 0);
  const nonDepositPaidAmount = form.paymentLines.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );
  const remainingTattooBalance = tattooAmount - appliedDepositAmount - nonDepositPaidAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">Session entry</p>
            <h3 className="mt-1 text-xl font-semibold">
              {session ? "Edit session" : project.subject}
            </h3>
          </div>
          <button
            aria-label="Close session entry"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <label className="block text-sm font-semibold">
            Appointment
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={Boolean(session)}
              onChange={(event) =>
                setForm((current) => ({ ...current, appointmentId: event.target.value }))
              }
              value={form.appointmentId}
            >
              <option value="">Manual / walk-in session</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointmentLabel(appointment)}
                </option>
              ))}
            </select>
          </label>

          {!form.appointmentId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Starts at
                <div className="mt-2">
                  <DateTimeSelect
                    onChange={(value) =>
                      setForm((current) => ({ ...current, startsAt: value }))
                    }
                    startHour={12}
                    value={form.startsAt}
                  />
                </div>
              </label>
              <label className="text-sm font-semibold">
                Ends at
                <div className="mt-2">
                  <DateTimeSelect
                    onChange={(value) =>
                      setForm((current) => ({ ...current, endsAt: value }))
                    }
                    startHour={12}
                    value={form.endsAt}
                  />
                </div>
              </label>
            </div>
          ) : null}

          <label className="block text-sm font-semibold">
            Tattoo amount
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, tattooAmount: event.target.value }))
              }
              placeholder="0.00"
              step="0.01"
              type="number"
              value={form.tattooAmount}
            />
          </label>

          <div className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Payment breakdown</p>
              <button
                className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    paymentLines: [...current.paymentLines, newPaymentLine()],
                  }))
                }
                type="button"
              >
              Add payment
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <label className="grid gap-2 text-sm font-semibold sm:grid-cols-[1fr_1fr_auto]">
                <span className="flex h-10 items-center rounded-md bg-[#f1eadc] px-3 text-[#775f36]">
                  Deposit
                </span>
                <input
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  max={availableDepositForSession}
                  min="0"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      depositAppliedAmount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.depositAppliedAmount}
                />
                <span className="flex min-h-10 items-center text-xs font-medium text-[#697178]">
                  Available {money(availableDepositForSession)}
                </span>
              </label>
              {form.paymentLines.map((line, index) => (
                <div key={line.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentLines: current.paymentLines.map((item) =>
                          item.id === line.id
                            ? { ...item, paymentMethod: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    value={line.paymentMethod}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentLines: current.paymentLines.map((item) =>
                          item.id === line.id ? { ...item, amount: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={line.amount}
                  />
                  <button
                    className="h-10 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={form.paymentLines.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        paymentLines: current.paymentLines.filter((item) => item.id !== line.id),
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                  {index === 0 ? null : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-[#f7f2e9] px-3 py-3 text-sm">
            <p className="font-semibold">Payment balance</p>
            <p className="mt-1 text-[#697178]">
              Deposit {money(appliedDepositAmount)} + other payments {money(nonDepositPaidAmount)}
            </p>
            <p
              className={`mt-1 font-semibold ${
                Math.abs(remainingTattooBalance) < 0.01 ? "text-[#2f6658]" : "text-[#8a5130]"
              }`}
            >
              Remaining {money(remainingTattooBalance)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Tip amount
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                min="0"
                onChange={(event) =>
                  setForm((current) => ({ ...current, tipAmount: event.target.value }))
                }
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.tipAmount}
              />
            </label>
            <label className="text-sm font-semibold">
              Tip payment
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, tipPaymentMethod: event.target.value }))
                }
                value={form.tipPaymentMethod}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <textarea
            className="min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
            placeholder="Memo"
            value={form.memo}
          />

          <button
            className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(form)}
            type="button"
          >
            {saving ? "Saving..." : session ? "Update session" : "Save session"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ProjectsPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [depositApplications, setDepositApplications] = useState<DepositApplicationRecord[]>([]);
  const [sessionPayments, setSessionPayments] = useState<SessionPaymentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionEntryRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [artistFilter, setArtistFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [entryError, setEntryError] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [editingProjectType, setEditingProjectType] = useState(false);
  const [projectTypeDraft, setProjectTypeDraft] = useState("");
  const [showDepositEntry, setShowDepositEntry] = useState(false);
  const [showSessionEntry, setShowSessionEntry] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<DepositRecord | null>(null);
  const [editingSession, setEditingSession] = useState<SessionEntryRecord | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [operationsContext, setOperationsContext] = useState<OperationsContext | null>(null);
  const isArtistUser = operationsContext?.isArtist === true;

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.filter((project) => {
      const customer = relatedOne(project.customer);
      const artistMatches = artistFilter === "all" || project.artist_id === artistFilter;
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? activeProjectStatuses.includes(project.status)
          : project.status === statusFilter);
      const searchMatches =
        !term ||
        [project.subject, project.size, customer?.name, customer?.email, artistName(project)]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return artistMatches && statusMatches && searchMatches;
    });
  }, [artistFilter, projects, search, statusFilter]);

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, ProjectRecord[]>();

    filteredProjects.forEach((project) => {
      const label = groupLabel(project);
      groups.set(label, [...(groups.get(label) ?? []), project]);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProjects]);

  const selectedProject = useMemo(
    () =>
      projects.find((project) => project.id === selectedProjectId) ??
      filteredProjects[0] ??
      projects[0],
    [filteredProjects, projects, selectedProjectId],
  );

  const selectedAppointments = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return appointments.filter((appointment) => appointment.project_id === selectedProject.id);
  }, [appointments, selectedProject]);

  const selectedDeposits = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return deposits.filter((deposit) => deposit.project_id === selectedProject.id);
  }, [deposits, selectedProject]);

  const selectedSessions = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return sessions.filter((session) => session.project_id === selectedProject.id);
  }, [selectedProject, sessions]);

  const selectedDepositBalance = useMemo(() => {
    return selectedDeposits.reduce(
      (sum, deposit) => sum + depositRemaining(deposit, depositApplications),
      0,
    );
  }, [depositApplications, selectedDeposits]);

  const selectedDepositApplications = useMemo(() => {
    const depositIds = new Set(selectedDeposits.map((deposit) => deposit.id));
    return depositApplications.filter((application) => depositIds.has(application.deposit_id));
  }, [depositApplications, selectedDeposits]);

  const selectedDepositWalletRows = useMemo(() => {
    const rows = [
      ...selectedDeposits.map((deposit) => ({
        id: deposit.id,
        type: "deposit" as const,
        date: deposit.received_at,
        amount: Number(deposit.amount),
        deposit,
        application: null,
      })),
      ...selectedDepositApplications.map((application) => ({
        id: application.id,
        type: "application" as const,
        date: application.applied_at,
        amount: Number(application.amount),
        deposit: null,
        application,
      })),
    ].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return a.type === "deposit" ? -1 : 1;
    });

    return rows.reduce<
      Array<
        (typeof rows)[number] & {
          balance: number;
          session: SessionEntryRecord | null;
        }
      >
    >((accumulator, row) => {
      const previousBalance = accumulator.at(-1)?.balance ?? 0;
      const balance = previousBalance + (row.type === "deposit" ? row.amount : -row.amount);

      return [
        ...accumulator,
        {
          ...row,
          balance,
          session: row.application
            ? selectedSessions.find((item) => item.id === row.application!.session_entry_id) ?? null
            : null,
        },
      ];
    }, []);
  }, [selectedDepositApplications, selectedDeposits, selectedSessions]);

  const selectedProjectDetail = useMemo(() => {
    if (!selectedProject) {
      return null;
    }

    const customer = relatedOne(selectedProject.customer);
    const depositTotal = selectedDeposits.reduce(
      (sum, deposit) => sum + Number(deposit.amount),
      0,
    );

    return {
      customer,
      tattooDescription:
        memoField(selectedProject.memo, "Tattoo description") ||
        plainProjectNotes(selectedProject.memo),
      placement: memoField(selectedProject.memo, "Placement"),
      customerAddress:
        memoField(selectedProject.memo, "Customer address") ||
        memoField(selectedProject.memo, "Address"),
      timingPreference: memoField(selectedProject.memo, "Timing preference"),
      referenceImage: memoField(selectedProject.memo, "Reference image"),
      requestedArtist: memoField(selectedProject.memo, "Requested artist"),
      notes: plainProjectNotes(selectedProject.memo),
      depositTotal,
      latestDeposit: [...selectedDeposits].sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      )[0],
    };
  }, [selectedDeposits, selectedProject]);

  const unenteredSelectedAppointments = useMemo(() => {
    const enteredAppointmentIds = new Set(
      selectedSessions
        .map((session) => session.appointment_id)
        .filter((appointmentId): appointmentId is string => Boolean(appointmentId)),
    );

    return selectedAppointments.filter(
      (appointment) =>
        !enteredAppointmentIds.has(appointment.id) && appointment.status !== "cancelled",
    );
  }, [selectedAppointments, selectedSessions]);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      const context = await getOperationsContext();

      if (!user) {
        setError("Please log in to view projects.");
        setLoading(false);
        return;
      }

      const [
        staffResult,
        projectResult,
        appointmentResult,
        depositResult,
        depositApplicationResult,
        sessionPaymentResult,
        sessionResult,
      ] =
        await Promise.all([
          supabase
            .from("staff")
            .select("id, display_name, role, active")
            .order("display_name", { ascending: true }),
          supabase.from("projects").select(projectSelect).order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
            .order("starts_at", { ascending: false }),
          supabase
            .from("deposits")
            .select(
              "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
            )
            .order("received_at", { ascending: false }),
          supabase
            .from("deposit_applications")
            .select("id, deposit_id, session_entry_id, amount, applied_at, memo")
            .order("applied_at", { ascending: false }),
          supabase
            .from("session_payments")
            .select("id, session_entry_id, payment_method, amount, memo")
            .order("created_at", { ascending: false }),
          supabase
            .from("session_entries")
            .select(
              "id, appointment_id, customer_id, project_id, artist_id, entered_at, entry_type, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo",
            )
            .order("entered_at", { ascending: false }),
        ]);

      if (staffResult.error) {
        setError(staffResult.error.message);
        setLoading(false);
        return;
      }

      if (projectResult.error) {
        setError(projectResult.error.message);
        setLoading(false);
        return;
      }

      if (appointmentResult.error) {
        setError(appointmentResult.error.message);
        setLoading(false);
        return;
      }

      if (depositResult.error) {
        setError(depositResult.error.message);
        setLoading(false);
        return;
      }

      if (depositApplicationResult.error) {
        setError(
          `${depositApplicationResult.error.message}. Run docs/supabase_deposit_applications.sql in Supabase SQL Editor.`,
        );
        setLoading(false);
        return;
      }

      if (sessionPaymentResult.error) {
        setError(
          `${sessionPaymentResult.error.message}. Run docs/supabase_session_payments.sql in Supabase SQL Editor.`,
        );
        setLoading(false);
        return;
      }

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setLoading(false);
        return;
      }

      const rawProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];
      const nextProjects =
        context?.isArtist && context.staffId
          ? rawProjects.filter((project) => project.artist_id === context.staffId)
          : rawProjects;
      const scopedStaff =
        context?.isArtist && context.staffId
          ? ((staffResult.data ?? []) as StaffRecord[]).filter((member) => member.id === context.staffId)
          : ((staffResult.data ?? []) as StaffRecord[]);
      const scopedAppointments =
        context?.isArtist && context.staffId
          ? ((appointmentResult.data ?? []) as AppointmentRecord[]).filter(
              (appointment) => appointment.artist_id === context.staffId,
            )
          : ((appointmentResult.data ?? []) as AppointmentRecord[]);
      const scopedDeposits =
        context?.isArtist && context.staffId
          ? ((depositResult.data ?? []) as DepositRecord[]).filter(
              (deposit) => deposit.artist_id === context.staffId,
            )
          : ((depositResult.data ?? []) as DepositRecord[]);
      const scopedSessions =
        context?.isArtist && context.staffId
          ? ((sessionResult.data ?? []) as SessionEntryRecord[]).filter(
              (session) => session.artist_id === context.staffId,
            )
          : ((sessionResult.data ?? []) as SessionEntryRecord[]);

      setOperationsContext(context);
      setStaff(scopedStaff);
      setProjects(nextProjects);
      setAppointments(scopedAppointments);
      setDeposits(scopedDeposits);
      setDepositApplications(
        (depositApplicationResult.data ?? []) as DepositApplicationRecord[],
      );
      setSessionPayments((sessionPaymentResult.data ?? []) as SessionPaymentRecord[]);
      setSessions(scopedSessions);
      setSelectedProjectId(nextProjects[0]?.id ?? "");
      if (context?.isArtist && context.staffId) {
        setArtistFilter(context.staffId);
      }
      setLoading(false);
    }

    loadProjects();
  }, []);

  async function saveProjectName() {
    if (!selectedProject) {
      return;
    }

    const subject = projectNameDraft.trim();

    if (!subject) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("projects")
      .update({ subject })
      .eq("id", selectedProject.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id ? { ...project, subject } : project,
      ),
    );
    setEditingProjectName(false);
    setMessage("Project name updated.");
    setSaving(false);
  }

  async function markWaiverSigned(project: ProjectRecord) {
    setSaving(true);
    setError("");
    setMessage("");

    const signedAt = new Date().toISOString();
    const result = await supabase
      .from("projects")
      .update({
        waiver_signed: true,
        waiver_status: "signed",
        waiver_signed_at: signedAt,
      })
      .eq("id", project.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setProjects((current) =>
      current.map((item) =>
        item.id === project.id
          ? {
              ...item,
              waiver_signed: true,
              waiver_status: "signed",
              waiver_signed_at: signedAt,
            }
          : item,
      ),
    );
    setMessage("Waiver marked as signed.");
    setSaving(false);
  }

  async function updateProjectType(project: ProjectRecord, sessionType: string) {
    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("projects")
      .update({ session_type: sessionType })
      .eq("id", project.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setProjects((current) =>
      current.map((item) =>
        item.id === project.id ? { ...item, session_type: sessionType } : item,
      ),
    );
    setEditingProjectType(false);
    setMessage("Project type updated.");
    setSaving(false);
  }

  async function setProjectStatus(project: ProjectRecord, status: string) {
    if (project.status === status) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("projects")
      .update({ status })
      .eq("id", project.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setProjects((current) =>
      current.map((item) => (item.id === project.id ? { ...item, status } : item)),
    );
    setMessage(`Project marked ${projectStatusLabel(status).toLowerCase()}.`);
    setSaving(false);
  }

  function closeProjectDetail() {
    setMobileDetailOpen(false);
    setEditingProjectName(false);
    setProjectNameDraft("");
    setEditingProjectType(false);
    setProjectTypeDraft("");
    setMessage("");
    setError("");
    setEntryError("");
  }

  async function promoteSelectedProjectStatus(status: string) {
    if (!selectedProject || selectedProject.status === status) {
      return true;
    }

    if (selectedProject.status === "completed" || selectedProject.status === "cancelled") {
      return true;
    }

    const result = await supabase
      .from("projects")
      .update({ status })
      .eq("id", selectedProject.id);

    if (result.error) {
      setEntryError(result.error.message);
      setSaving(false);
      return false;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id ? { ...project, status } : project,
      ),
    );
    return true;
  }

  async function saveDeposit(form: DepositForm) {
    if (!selectedProject) {
      return;
    }

    const amount = Number(form.amount);
    const alreadyApplied = editingDeposit
      ? depositAppliedTotal(editingDeposit.id, depositApplications)
      : 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setEntryError("Deposit amount must be greater than 0.");
      return;
    }

    if (editingDeposit && amount < alreadyApplied) {
      setEntryError(`Deposit amount cannot be less than already applied amount ${money(alreadyApplied)}.`);
      return;
    }

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    const user = await getSafeUser();
    const payload = {
      amount,
      payment_method: form.paymentMethod,
      received_at: new Date(form.receivedAt).toISOString(),
      available: amount - alreadyApplied > 0,
      used_at: amount - alreadyApplied > 0 ? null : new Date().toISOString(),
      memo: form.memo.trim() || null,
    };
    const result = editingDeposit
      ? await supabase
          .from("deposits")
          .update(payload)
          .eq("id", editingDeposit.id)
          .select(
            "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
          )
          .single()
      : await supabase
          .from("deposits")
          .insert({
            project_id: selectedProject.id,
            customer_id: selectedProject.customer_id,
            artist_id: selectedProject.artist_id,
            ...payload,
            created_by: user?.id ?? null,
          })
          .select(
            "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
          )
          .single();

    if (result.error) {
      setEntryError(result.error.message);
      setSaving(false);
      return;
    }

    setDeposits((current) =>
      editingDeposit
        ? current.map((deposit) =>
            deposit.id === editingDeposit.id ? (result.data as DepositRecord) : deposit,
          )
        : [result.data as DepositRecord, ...current],
    );
    setEditingDeposit(null);
    setShowDepositEntry(false);
    setMessage(editingDeposit ? "Deposit updated." : "Deposit entry saved.");
    setSaving(false);
  }

  async function saveSession(form: SessionForm) {
    if (!selectedProject) {
      return;
    }

    const appointment = editingSession
      ? selectedAppointments.find((item) => item.id === editingSession.appointment_id)
      : selectedAppointments.find((item) => item.id === form.appointmentId);
    const startsAt = appointment?.starts_at ?? form.startsAt;
    const endsAt = appointment?.ends_at ?? form.endsAt;
    const startsDate = new Date(startsAt);
    const endsDate = new Date(endsAt);

    const tattooAmount = Number(form.tattooAmount || 0);
    const tipAmount = Number(form.tipAmount || 0);
    const depositAppliedAmount = Number(form.depositAppliedAmount || 0);
    const paymentLines = form.paymentLines
      .map((line) => ({
        paymentMethod: line.paymentMethod,
        amount: Number(line.amount || 0),
      }))
      .filter((line) => line.amount > 0);
    const paymentLineTotal = paymentLines.reduce((sum, line) => sum + line.amount, 0);
    const priorDepositApplications = editingSession
      ? depositApplications.filter((application) => application.session_entry_id === editingSession.id)
      : [];
    const priorDepositAppliedTotal = priorDepositApplications.reduce(
      (sum, application) => sum + Number(application.amount),
      0,
    );
    const availableDepositForSession = selectedDeposits.reduce(
      (sum, deposit) => sum + depositRemaining(deposit, depositApplications),
      0,
    ) + priorDepositAppliedTotal;

    if (!editingSession && !appointment && (!startsAt || !endsAt || endsDate <= startsDate)) {
      setEntryError("Manual sessions need a valid start and end time.");
      return;
    }

    if (
      !Number.isFinite(tattooAmount) ||
      !Number.isFinite(tipAmount) ||
      !Number.isFinite(depositAppliedAmount) ||
      form.paymentLines.some((line) => !Number.isFinite(Number(line.amount || 0)))
    ) {
      setEntryError("Amounts must be valid numbers.");
      return;
    }

    if (tattooAmount <= 0 && tipAmount <= 0) {
      setEntryError("Enter a tattoo amount or a tip amount.");
      return;
    }

    if (depositAppliedAmount > availableDepositForSession) {
      setEntryError(`Applied deposit cannot exceed available balance ${money(availableDepositForSession)}.`);
      return;
    }

    if (depositAppliedAmount > tattooAmount) {
      setEntryError("Applied deposit cannot exceed the tattoo amount.");
      return;
    }

    if (Math.abs(tattooAmount - depositAppliedAmount - paymentLineTotal) >= 0.01) {
      setEntryError("Payment breakdown must equal tattoo amount minus applied deposit.");
      return;
    }

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    const user = await getSafeUser();
    let sessionAppointment = appointment;

    if (!editingSession && !sessionAppointment) {
      const appointmentResult = await supabase
        .from("appointments")
        .insert({
          project_id: selectedProject.id,
          customer_id: selectedProject.customer_id,
          artist_id: selectedProject.artist_id,
          starts_at: startsDate.toISOString(),
          ends_at: endsDate.toISOString(),
          appointment_type: "walk-in",
          status: "completed",
          notes: "Created from manual session entry.",
        })
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
        .single();

      if (appointmentResult.error) {
        setEntryError(appointmentResult.error.message);
        setSaving(false);
        return;
      }

      sessionAppointment = appointmentResult.data as AppointmentRecord;
      setAppointments((current) => [sessionAppointment!, ...current]);
    }

    const sessionPayload = {
      tattoo_amount: tattooAmount,
      tattoo_payment_method: paymentLines[0]?.paymentMethod ?? null,
      tip_amount: tipAmount,
      tip_payment_method: tipAmount > 0 ? form.tipPaymentMethod : null,
      memo: form.memo.trim() || null,
    };
    const result = editingSession
      ? await supabase
          .from("session_entries")
          .update(sessionPayload)
          .eq("id", editingSession.id)
          .select(
            "id, appointment_id, customer_id, project_id, artist_id, entered_at, entry_type, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo",
          )
          .single()
      : await supabase
          .from("session_entries")
          .insert({
            project_id: selectedProject.id,
            customer_id: selectedProject.customer_id,
            appointment_id: sessionAppointment!.id,
            artist_id: sessionAppointment!.artist_id ?? selectedProject.artist_id,
            entry_type: "session",
            entered_at: new Date(sessionAppointment!.starts_at).toISOString(),
            ...sessionPayload,
            created_by: user?.id ?? null,
          })
          .select(
            "id, appointment_id, customer_id, project_id, artist_id, entered_at, entry_type, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo",
          )
          .single();

    if (result.error) {
      setEntryError(result.error.message);
      setSaving(false);
      return;
    }

    const deletePaymentsResult = await supabase
      .from("session_payments")
      .delete()
      .eq("session_entry_id", result.data.id);

    if (deletePaymentsResult.error) {
      setEntryError(deletePaymentsResult.error.message);
      setSaving(false);
      return;
    }

    let nextSessionPayments = sessionPayments.filter(
      (payment) => payment.session_entry_id !== result.data.id,
    );

    if (paymentLines.length > 0) {
      const paymentResult = await supabase
        .from("session_payments")
        .insert(
          paymentLines.map((line) => ({
            session_entry_id: result.data.id,
            payment_method: line.paymentMethod,
            amount: line.amount,
            created_by: user?.id ?? null,
          })),
        )
        .select("id, session_entry_id, payment_method, amount, memo");

      if (paymentResult.error) {
        setEntryError(
          `${paymentResult.error.message}. Run docs/supabase_session_payments.sql in Supabase SQL Editor.`,
        );
        setSaving(false);
        return;
      }

      nextSessionPayments = [
        ...((paymentResult.data ?? []) as SessionPaymentRecord[]),
        ...nextSessionPayments,
      ];
    }

    const affectedDepositIds = new Set(priorDepositApplications.map((application) => application.deposit_id));
    let nextDepositApplications = depositApplications.filter(
      (application) => application.session_entry_id !== result.data.id,
    );

    if (priorDepositApplications.length > 0) {
      const deleteApplicationResult = await supabase
        .from("deposit_applications")
        .delete()
        .eq("session_entry_id", result.data.id);

      if (deleteApplicationResult.error) {
        setEntryError(deleteApplicationResult.error.message);
        setSaving(false);
        return;
      }
    }

    if (depositAppliedAmount > 0) {
      let remainingToApply = depositAppliedAmount;
      const applicationRows: Array<{
        deposit_id: string;
        session_entry_id: string;
        amount: number;
        memo: string | null;
        created_by: string | null;
      }> = [];

      for (const deposit of [...selectedDeposits].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
      )) {
        if (remainingToApply <= 0) {
          break;
        }

        const available = depositRemaining(deposit, nextDepositApplications);
        const amount = Math.min(available, remainingToApply);

        if (amount <= 0) {
          continue;
        }

        applicationRows.push({
          deposit_id: deposit.id,
          session_entry_id: result.data.id,
          amount,
          memo: form.memo.trim() || null,
          created_by: user?.id ?? null,
        });
        affectedDepositIds.add(deposit.id);
        remainingToApply -= amount;
      }

      if (remainingToApply > 0.009) {
        setEntryError("Not enough available deposit balance.");
        setSaving(false);
        return;
      }

      const applicationResult = await supabase
        .from("deposit_applications")
        .insert(applicationRows)
        .select("id, deposit_id, session_entry_id, amount, applied_at, memo")
        .order("applied_at", { ascending: false });

      if (applicationResult.error) {
        setEntryError(
          `${applicationResult.error.message}. Run docs/supabase_deposit_applications.sql in Supabase SQL Editor.`,
        );
        setSaving(false);
        return;
      }

      nextDepositApplications = [
        ...((applicationResult.data ?? []) as DepositApplicationRecord[]),
        ...nextDepositApplications,
      ];
    }

    const updatedDeposits: DepositRecord[] = [];

    for (const depositId of affectedDepositIds) {
      const deposit = deposits.find((item) => item.id === depositId);

      if (!deposit) {
        continue;
      }

      const remaining = depositRemaining(deposit, nextDepositApplications);
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: remaining > 0,
          used_at: remaining > 0 ? null : new Date().toISOString(),
          used_session_entry_id: remaining > 0 ? null : result.data.id,
        })
        .eq("id", depositId)
        .select(
          "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
        )
        .single();

      if (depositResult.error) {
        setEntryError(depositResult.error.message);
        setSaving(false);
        return;
      }

      updatedDeposits.push(depositResult.data as DepositRecord);
    }

    if (updatedDeposits.length > 0) {
      setDeposits((current) =>
        current.map((deposit) => updatedDeposits.find((item) => item.id === deposit.id) ?? deposit),
      );
    }

    const statusPromoted = await promoteSelectedProjectStatus("in_progress");

    if (!statusPromoted) {
      return;
    }

    setDepositApplications(nextDepositApplications);
    setSessionPayments(nextSessionPayments);
    setSessions((current) =>
      editingSession
        ? current.map((session) =>
            session.id === editingSession.id ? (result.data as SessionEntryRecord) : session,
          )
        : [result.data as SessionEntryRecord, ...current],
    );
    setEditingSession(null);
    setShowSessionEntry(false);
    setMessage(editingSession ? "Session entry updated." : "Session entry saved.");
    setSaving(false);
  }

  async function deleteSession(session: SessionEntryRecord) {
    const relatedApplications = depositApplications.filter(
      (application) => application.session_entry_id === session.id,
    );

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    if (relatedApplications.length > 0) {
      const applicationResult = await supabase
        .from("deposit_applications")
        .delete()
        .eq("session_entry_id", session.id);

      if (applicationResult.error) {
        setError(applicationResult.error.message);
        setSaving(false);
        return;
      }
    }

    const paymentResult = await supabase
      .from("session_payments")
      .delete()
      .eq("session_entry_id", session.id);

    if (paymentResult.error) {
      setError(paymentResult.error.message);
      setSaving(false);
      return;
    }

    const result = await supabase.from("session_entries").delete().eq("id", session.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const nextApplications = depositApplications.filter(
      (application) => application.session_entry_id !== session.id,
    );
    const affectedDepositIds = new Set(relatedApplications.map((application) => application.deposit_id));
    const updatedDeposits: DepositRecord[] = [];

    for (const depositId of affectedDepositIds) {
      const deposit = deposits.find((item) => item.id === depositId);

      if (!deposit) {
        continue;
      }

      const remaining = depositRemaining(deposit, nextApplications);
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: remaining > 0,
          used_at: remaining > 0 ? null : new Date().toISOString(),
          used_session_entry_id: null,
        })
        .eq("id", depositId)
        .select(
          "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
        )
        .single();

      if (depositResult.error) {
        setError(depositResult.error.message);
        setSaving(false);
        return;
      }

      updatedDeposits.push(depositResult.data as DepositRecord);
    }

    setDepositApplications(nextApplications);
    setSessionPayments((current) =>
      current.filter((payment) => payment.session_entry_id !== session.id),
    );
    if (updatedDeposits.length > 0) {
      setDeposits((current) =>
        current.map((deposit) => updatedDeposits.find((item) => item.id === deposit.id) ?? deposit),
      );
    }
    setSessions((current) => current.filter((item) => item.id !== session.id));
    setMessage("Session entry deleted.");
    setSaving(false);
  }

  async function deleteDeposit(deposit: DepositRecord) {
    const appliedAmount = depositAppliedTotal(deposit.id, depositApplications);

    if (appliedAmount > 0) {
      setError("Deposits with applied amounts cannot be deleted. Delete or edit the linked session first.");
      return;
    }

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    const result = await supabase.from("deposits").delete().eq("id", deposit.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setDeposits((current) => current.filter((item) => item.id !== deposit.id));
    setMessage("Deposit deleted.");
    setSaving(false);
  }

  return (
    <AppPage
      actions={
        <Link
          className="inline-flex h-10 items-center rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
          href="/projects/new"
        >
          New project
        </Link>
      }
      eyebrow="Project queue"
      title="Projects by artist"
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading projects...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <section
            className={`${mobileDetailOpen ? "hidden md:block" : "block"} rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm`}
          >
            <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_0.7fr]">
              <input
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setMobileDetailOpen(false);
                }}
                placeholder="Search project, customer, artist, email"
                value={search}
              />
              {!isArtistUser ? (
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => {
                  setArtistFilter(event.target.value);
                  setMobileDetailOpen(false);
                }}
                value={artistFilter}
              >
                <option value="all">All artists</option>
                {staff
                  .filter((member) => member.active && member.role === "Artist")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name}
                    </option>
                  ))}
              </select>
              ) : null}
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setMobileDetailOpen(false);
                }}
                value={statusFilter}
              >
                <option value="active">Active statuses</option>
                <option value="all">All statuses</option>
                {projectStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          <section>
            <div
              className="rounded-md border border-[#d9d3c7] bg-white shadow-sm"
            >
              <div className="border-b border-[#e5dfd4] px-4 py-4">
                <h3 className="text-base font-semibold">Artist project list</h3>
                <p className="mt-1 text-sm text-[#697178]">
                  {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <div className="max-h-[760px] overflow-y-auto">
                {groupedProjects.length === 0 ? (
                  <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                    No projects match these filters.
                  </p>
                ) : null}

                {groupedProjects.map(([artist, artistProjects]) => (
                  <div key={artist} className="border-b border-[#eee8dd] last:border-b-0">
                    <div className="bg-[#f7f2e9] px-4 py-2">
                      <p className="text-xs font-bold uppercase text-[#6f7275]">
                        {artist} / {artistProjects.length}
                      </p>
                    </div>
                    <div className="divide-y divide-[#eee8dd]">
                      {artistProjects.map((project) => (
                        <button
                          key={project.id}
                          className={`block w-full px-4 py-4 text-left transition hover:bg-[#fffaf1] ${
                            selectedProject?.id === project.id ? "bg-[#fffaf1]" : ""
                          }`}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setEditingProjectName(false);
                            setProjectNameDraft("");
                            setEditingProjectType(false);
                            setProjectTypeDraft("");
                            setMessage("");
                            setError("");
                            setEntryError("");
                            setMobileDetailOpen(true);
                          }}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{project.subject}</p>
                              <p className="mt-1 truncate text-sm text-[#697178]">
                                {customerName(project)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                                project.status,
                              )}`}
                            >
                              {projectStatusLabel(project.status)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                                project,
                              )}`}
                            >
                              Waiver {waiverLabel(project)}
                            </span>
                            <span className="rounded-md bg-[#eee8dd] px-2 py-1 text-xs font-semibold text-[#4d555c]">
                              {project.size || "Size not set"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedProject ? (
              <div
                className={`${mobileDetailOpen ? "fixed" : "hidden"} inset-0 z-40 flex flex-col overflow-hidden bg-[#f6f4ef] shadow-xl md:inset-6 md:left-1/2 md:max-h-[calc(100vh-3rem)] md:max-w-5xl md:-translate-x-1/2 md:rounded-md md:border md:border-[#d9d3c7]`}
              >
                <section className="shrink-0 border-b border-[#d9d3c7] bg-white shadow-sm md:rounded-t-md">
                  <div className="flex flex-col gap-4 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#8a6f4d]">
                        {selectedProject.id.slice(0, 8)}
                      </p>
                      {editingProjectName ? (
                        <div className="mt-2 flex max-w-2xl flex-col gap-2 sm:flex-row">
                          <input
                            className="h-10 min-w-0 flex-1 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold"
                            disabled={saving}
                            onChange={(event) => setProjectNameDraft(event.target.value)}
                            value={projectNameDraft}
                          />
                          <div className="flex gap-2">
                            <button
                              className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={saving}
                              onClick={saveProjectName}
                              type="button"
                            >
                              Save
                            </button>
                            <button
                              className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={saving}
                              onClick={() => {
                                setProjectNameDraft(selectedProject.subject);
                                setEditingProjectName(false);
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold">{selectedProject.subject}</h3>
                          <button
                            className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                            onClick={() => {
                              setProjectNameDraft(selectedProject.subject);
                              setEditingProjectName(true);
                            }}
                            type="button"
                          >
                            Edit name
                          </button>
                        </div>
                      )}
                      <p className="mt-1 text-sm text-[#697178]">
                        Created {displayDate(selectedProject.created_at)}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                          selectedProject.status,
                        )}`}
                      >
                        {projectStatusLabel(selectedProject.status)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                          selectedProject,
                        )}`}
                      >
                        Waiver {waiverLabel(selectedProject)}
                      </span>
                      </div>
                      <button
                        aria-label="Close project detail"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                        onClick={closeProjectDetail}
                        type="button"
                      >
                        x
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Artist</p>
                      <p className="mt-1 font-semibold">{artistName(selectedProject)}</p>
                    </div>
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#697178]">Project type</p>
                          {editingProjectType ? (
                            <select
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold"
                              disabled={saving}
                              onChange={(event) => setProjectTypeDraft(event.target.value)}
                              value={projectTypeDraft}
                            >
                              {projectTypeOptions.map((type) => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="mt-1 font-semibold">
                              {selectedProject.session_type || "Multiple Session"}
                            </p>
                          )}
                        </div>
                        {!editingProjectType ? (
                          <button
                            aria-label="Edit project type"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#cfc7b8] hover:bg-[#eee8dd]"
                            onClick={() => {
                              setProjectTypeDraft(selectedProject.session_type || "Multiple Session");
                              setEditingProjectType(true);
                            }}
                            type="button"
                          >
                            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                              <path
                                d="M4 20h4l11-11-4-4L4 16v4Zm13-13 1-1a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-1 1-3-3Z"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {editingProjectType ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            className="h-8 rounded-md bg-[#1f2428] px-2 text-xs font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={saving}
                            onClick={() => updateProjectType(selectedProject, projectTypeDraft)}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={saving}
                            onClick={() => {
                              setProjectTypeDraft(selectedProject.session_type || "Multiple Session");
                              setEditingProjectType(false);
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Waiver signed</p>
                      <p className="mt-1 font-semibold">
                        {displayDate(selectedProject.waiver_signed_at)}
                      </p>
                      {!selectedProject.waiver_signed ? (
                        <button
                          className="mt-2 h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={saving}
                          onClick={() => markWaiverSigned(selectedProject)}
                          type="button"
                        >
                          Mark signed
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div className="min-h-0 flex flex-1 flex-col gap-6 overflow-y-auto p-4">
                  <section className="order-1 rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                    <div className="border-b border-[#e5dfd4] px-4 py-4">
                      <h3 className="text-base font-semibold">Project details</h3>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-4 py-4">
                        <p className="text-xs font-bold uppercase text-[#8a8174]">Client info</p>
                        <div className="mt-3 divide-y divide-[#eee8dd] text-sm">
                          <div className="py-2 first:pt-0">
                            <p className="text-sm text-[#697178]">Name</p>
                            <p className="mt-1 font-semibold">{customerName(selectedProject)}</p>
                          </div>
                          <div className="py-2">
                            <p className="text-sm text-[#697178]">Email</p>
                            <p className="mt-1 font-semibold">
                              {selectedProjectDetail?.customer?.email || "-"}
                            </p>
                          </div>
                          <div className="py-2">
                            <p className="text-sm text-[#697178]">Phone</p>
                            <p className="mt-1 font-semibold">
                              {selectedProjectDetail?.customer?.phone || "-"}
                            </p>
                          </div>
                          <div className="py-2 last:pb-0">
                            <p className="text-sm text-[#697178]">Address</p>
                            <p className="mt-1 font-semibold">
                              {selectedProjectDetail?.customerAddress || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-4 py-4">
                        <p className="text-xs font-bold uppercase text-[#8a8174]">Tattoo description</p>
                        <div className="mt-3 divide-y divide-[#eee8dd] text-sm">
                          <div className="py-2 first:pt-0">
                            <p className="text-sm text-[#697178]">Size</p>
                            <p className="mt-1 font-semibold">{selectedProject.size || "-"}</p>
                          </div>
                          <div className="py-2">
                            <p className="text-sm text-[#697178]">Placement</p>
                            <p className="mt-1 font-semibold">
                              {selectedProjectDetail?.placement || "-"}
                            </p>
                          </div>
                          <div className="py-2">
                            <p className="text-sm text-[#697178]">Description</p>
                            <p className="mt-1 whitespace-pre-wrap font-semibold">
                              {selectedProjectDetail?.tattooDescription || "-"}
                            </p>
                          </div>
                          {selectedProjectDetail?.timingPreference ? (
                            <div className="py-2">
                              <p className="text-sm text-[#697178]">Timing preference</p>
                              <p className="mt-1 font-semibold">
                                {selectedProjectDetail.timingPreference}
                              </p>
                            </div>
                          ) : null}
                          {selectedProjectDetail?.referenceImage ? (
                            <div className="py-2 last:pb-0">
                              <p className="text-sm text-[#697178]">Reference image</p>
                              <a
                                className="mt-1 inline-flex font-semibold text-[#315f82] underline"
                                href={selectedProjectDetail.referenceImage}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open image
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="order-3 rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Session entries</h3>
                    <button
                      className="h-9 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                      onClick={() => {
                        setEntryError("");
                        setEditingSession(null);
                        setShowSessionEntry(true);
                      }}
                      type="button"
                    >
                      Add session
                    </button>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedSessions.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No session entries yet.
                      </p>
                    ) : null}
                    {selectedSessions.map((session) => (
                      <div
                        key={session.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.9fr_0.9fr_0.9fr_1fr_auto]"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase text-[#8a8174] md:hidden">Session</p>
                          <p className="font-semibold">{displayDateTime(session.entered_at)}</p>
                          <p className="text-[#697178]">
                            {selectedAppointments.find((item) => item.id === session.appointment_id)
                              ? appointmentLabel(
                                  selectedAppointments.find(
                                    (item) => item.id === session.appointment_id,
                                  )!,
                                )
                              : "No appointment"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-[#8a8174] md:hidden">Tattoo</p>
                          <p className="font-semibold">{money(session.tattoo_amount)} tattoo</p>
                          <p className="text-[#697178]">
                            {sessionPayments
                              .filter((payment) => payment.session_entry_id === session.id)
                              .map(
                                (payment) =>
                                  `${paymentLabel(payment.payment_method)} ${money(payment.amount)}`,
                              )
                              .join(" / ") || paymentLabel(session.tattoo_payment_method)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-[#8a8174] md:hidden">Tip</p>
                          <p className="font-semibold">{money(session.tip_amount)} tip</p>
                          <p className="text-[#697178]">{paymentLabel(session.tip_payment_method)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-[#8a8174] md:hidden">Deposit</p>
                          <p className="font-semibold">
                            {money(
                              depositApplications
                                .filter((application) => application.session_entry_id === session.id)
                                .reduce((sum, application) => sum + Number(application.amount), 0),
                            )}{" "}
                            deposit
                          </p>
                          <p className="text-[#697178]">Applied</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-[#8a8174] md:hidden">Memo</p>
                          <p className="text-[#4d555c]">{session.memo || "-"}</p>
                        </div>
                        <div className="flex gap-2 md:justify-end">
                          <button
                            className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                            disabled={saving}
                            onClick={() => {
                              setEntryError("");
                              setEditingSession(session);
                              setShowSessionEntry(true);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="h-8 rounded-md border border-[#8a3030] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f3e1e1]"
                            disabled={saving}
                            onClick={() => deleteSession(session)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                  <section className="order-2 rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Deposits</h3>
                    <button
                      className="h-9 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                      onClick={() => {
                        setEntryError("");
                        setEditingDeposit(null);
                        setShowDepositEntry(true);
                      }}
                      type="button"
                    >
                      Add deposit
                    </button>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedDeposits.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No deposits yet.
                      </p>
                    ) : null}
                    {selectedDeposits.length > 0 ? (
                      <div className="px-4 py-4 text-sm">
                        <div className="space-y-3 md:hidden">
                          {selectedDepositWalletRows.map((row) => (
                            <div
                              key={`${row.type}-${row.id}`}
                              className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-[#8a8174]">
                                    {displayDate(row.date)}
                                  </p>
                                  <p
                                    className={`mt-1 font-semibold ${
                                      row.type === "deposit" ? "text-[#2f6658]" : "text-[#8a5130]"
                                    }`}
                                  >
                                    {row.type === "deposit"
                                      ? "Deposit received"
                                      : `Applied to ${
                                          row.session ? displayDateTime(row.session.entered_at) : "session"
                                        }`}
                                  </p>
                                  <p className="mt-1 text-xs text-[#697178]">
                                    {row.type === "deposit"
                                      ? `${paymentLabel(row.deposit!.payment_method)}${
                                          row.deposit!.memo ? ` / ${row.deposit!.memo}` : ""
                                        }`
                                      : "Edit the linked session to change this application."}
                                  </p>
                                </div>
                                <p
                                  className={`shrink-0 font-semibold ${
                                    row.type === "deposit" ? "text-[#2f6658]" : "text-[#8a5130]"
                                  }`}
                                >
                                  {row.type === "deposit" ? "+" : "-"}
                                  {money(row.amount)}
                                </p>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eee8dd] pt-3">
                                <p className="text-sm font-semibold">
                                  Balance {money(row.balance)}
                                </p>
                                {row.type === "deposit" ? (
                                  <div className="flex gap-2">
                                    <button
                                      className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                                      disabled={saving}
                                      onClick={() => {
                                        setEntryError("");
                                        setEditingDeposit(row.deposit);
                                        setShowDepositEntry(true);
                                      }}
                                      type="button"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="h-8 rounded-md border border-[#8a3030] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f3e1e1]"
                                      disabled={saving}
                                      onClick={() => deleteDeposit(row.deposit!)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                          <div className="rounded-md border border-[#e4dccf] bg-[#f7f2e9] px-3 py-3 font-semibold">
                            Remaining balance{" "}
                            {money(selectedDepositWalletRows.at(-1)?.balance ?? 0)}
                          </div>
                        </div>

                        <div className="hidden overflow-hidden rounded-md border border-[#e4dccf] md:block">
                          <div className="grid grid-cols-[0.85fr_1.2fr_0.7fr_0.7fr_0.8fr] bg-[#f7f2e9] px-3 py-2 text-xs font-bold uppercase text-[#6f7275]">
                            <span>Date</span>
                            <span>History</span>
                            <span className="text-right">Change</span>
                            <span className="text-right">Balance</span>
                            <span className="text-right">Actions</span>
                          </div>
                          <>
                                {selectedDepositWalletRows.map((row) => (
                                    <div
                                      key={`${row.type}-${row.id}`}
                                      className="grid grid-cols-[0.85fr_1.2fr_0.7fr_0.7fr_0.8fr] border-t border-[#eee8dd] px-3 py-2"
                                    >
                                      <span>{displayDate(row.date)}</span>
                                      <span>
                                        {row.type === "deposit" ? (
                                          <>
                                            <span className="font-semibold text-[#2f6658]">
                                              Deposit received
                                            </span>
                                            <span className="block text-xs text-[#697178]">
                                              {paymentLabel(row.deposit!.payment_method)}
                                              {row.deposit!.memo ? ` / ${row.deposit!.memo}` : ""}
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            Applied to{" "}
                                            {row.session ? displayDateTime(row.session.entered_at) : "session"}
                                          </>
                                        )}
                                      </span>
                                      <span
                                        className={`text-right font-semibold ${
                                          row.type === "deposit"
                                            ? "text-[#2f6658]"
                                            : "text-[#8a5130]"
                                        }`}
                                      >
                                        {row.type === "deposit" ? "+" : "-"}
                                        {money(row.amount)}
                                      </span>
                                      <span className="text-right font-semibold">
                                        {money(row.balance)}
                                      </span>
                                      <span className="flex justify-end gap-2">
                                        {row.type === "deposit" ? (
                                          <>
                                            <button
                                              className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                                              disabled={saving}
                                              onClick={() => {
                                                setEntryError("");
                                                setEditingDeposit(row.deposit);
                                                setShowDepositEntry(true);
                                              }}
                                              type="button"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              className="h-8 rounded-md border border-[#8a3030] px-2 text-xs font-semibold text-[#8a3030] hover:bg-[#f3e1e1]"
                                              disabled={saving}
                                              onClick={() => deleteDeposit(row.deposit!)}
                                              type="button"
                                            >
                                              Delete
                                            </button>
                                          </>
                                        ) : (
                                          <span className="text-xs font-semibold text-[#697178]">
                                            Edit session
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                ))}
                                <div className="grid grid-cols-[0.85fr_1.2fr_0.7fr_0.7fr_0.8fr] border-t border-[#e4dccf] bg-[#fdfbf7] px-3 py-2 font-semibold">
                                  <span />
                                  <span>Remaining balance</span>
                                  <span />
                                  <span
                                    className={`text-right ${
                                      (selectedDepositWalletRows.at(-1)?.balance ?? 0) > 0
                                        ? "text-[#2f6658]"
                                        : "text-[#697178]"
                                    }`}
                                  >
                                    {money(selectedDepositWalletRows.at(-1)?.balance ?? 0)}
                                  </span>
                                  <span />
                                </div>
                              </>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className="order-4 rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
                  <p className="text-sm font-semibold">Project status actions</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || selectedProject.status === "completed"}
                      onClick={() => setProjectStatus(selectedProject, "completed")}
                      type="button"
                    >
                      Completed
                    </button>
                    <button
                      className="h-10 rounded-md border border-[#8a3030] px-3 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || selectedProject.status === "cancelled"}
                      onClick={() => setProjectStatus(selectedProject, "cancelled")}
                      type="button"
                    >
                      Cancelled
                    </button>
                    <button
                      className="h-10 rounded-md border border-[#b98238] px-3 text-sm font-semibold text-[#8a5130] hover:bg-[#f4e7df] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || selectedProject.status === "on_hold"}
                      onClick={() => setProjectStatus(selectedProject, "on_hold")}
                      type="button"
                    >
                      On Hold
                    </button>
                  </div>
                </div>

                <button
                  className="order-5 h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={closeProjectDetail}
                  type="button"
                >
                  Close
                </button>

              </div>
              </div>
            ) : (
              <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
                Select a project.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {showSessionEntry && selectedProject ? (
        <SessionEntryModal
          appointments={editingSession ? selectedAppointments : unenteredSelectedAppointments}
          availableDepositBalance={selectedDepositBalance}
          depositApplications={selectedDepositApplications}
          error={entryError}
          onClose={() => {
            setEditingSession(null);
            setShowSessionEntry(false);
          }}
          onSave={saveSession}
          project={selectedProject}
          saving={saving}
          session={editingSession}
          sessionPayments={sessionPayments}
        />
      ) : null}

      {showDepositEntry && selectedProject ? (
        <DepositEntryModal
          appliedAmount={
            editingDeposit ? depositAppliedTotal(editingDeposit.id, depositApplications) : 0
          }
          deposit={editingDeposit}
          error={entryError}
          onClose={() => {
            setEditingDeposit(null);
            setShowDepositEntry(false);
          }}
          onSave={saveDeposit}
          project={selectedProject}
          saving={saving}
        />
      ) : null}
    </AppPage>
  );
}

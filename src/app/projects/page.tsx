"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
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
  depositId: string;
  tattooAmount: string;
  tattooPaymentMethod: string;
  tipAmount: string;
  tipPaymentMethod: string;
  memo: string;
};

const projectSelect =
  "id, customer_id, artist_id, subject, size, session_type, waiver_signed, waiver_status, waiver_sent_at, waiver_signed_at, status, memo, created_at, customer:customers(name, email, phone), artist:staff(display_name)";

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

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

function paymentLabel(value: string | null | undefined) {
  return paymentMethods.find((method) => method.value === value)?.label ?? value ?? "-";
}

function appointmentLabel(appointment: AppointmentRecord) {
  return `${displayDateTime(appointment.starts_at)} / ${appointment.appointment_type}`;
}

function projectStatusLabel(status: string) {
  const labels: Record<string, string> = {
    lead: "Lead",
    consultation: "Consultation",
    booked: "Booked",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return labels[status] ?? status;
}

function projectStatusClasses(status: string) {
  const variants: Record<string, string> = {
    lead: "bg-[#f1eadc] text-[#775f36]",
    consultation: "bg-[#efe7f5] text-[#674b7a]",
    booked: "bg-[#e4f1df] text-[#476b33]",
    in_progress: "bg-[#e5edf4] text-[#315f82]",
    completed: "bg-[#e8f0ee] text-[#2f6658]",
    cancelled: "bg-[#f3e1e1] text-[#8a3030]",
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
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  project: ProjectRecord;
  onClose: () => void;
  onSave: (form: DepositForm) => void;
}) {
  const [form, setForm] = useState<DepositForm>({
    amount: "",
    paymentMethod: "cash",
    receivedAt: localDateTimeInput(),
    memo: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">Deposit entry</p>
            <h3 className="mt-1 text-xl font-semibold">{project.subject}</h3>
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
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, receivedAt: event.target.value }))
              }
              type="datetime-local"
              value={form.receivedAt}
            />
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
            {saving ? "Saving..." : "Save deposit"}
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
  appointments,
  availableDeposits,
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  project: ProjectRecord;
  appointments: AppointmentRecord[];
  availableDeposits: DepositRecord[];
  onClose: () => void;
  onSave: (form: SessionForm) => void;
}) {
  const [form, setForm] = useState<SessionForm>(() => {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    return {
      appointmentId: appointments[0]?.id ?? "",
      startsAt: localDateTimeInput(startsAt),
      endsAt: localDateTimeInput(endsAt),
      depositId: "",
      tattooAmount: "",
      tattooPaymentMethod: "cash",
      tipAmount: "",
      tipPaymentMethod: "cash",
      memo: "",
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">Session entry</p>
            <h3 className="mt-1 text-xl font-semibold">{project.subject}</h3>
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
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                  step={1800}
                  type="datetime-local"
                  value={form.startsAt}
                />
              </label>
              <label className="text-sm font-semibold">
                Ends at
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endsAt: event.target.value }))
                  }
                  step={1800}
                  type="datetime-local"
                  value={form.endsAt}
                />
              </label>
            </div>
          ) : null}

          <label className="block text-sm font-semibold">
            Apply deposit
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, depositId: event.target.value }))
              }
              value={form.depositId}
            >
              <option value="">No deposit applied</option>
              {availableDeposits.map((deposit) => (
                <option key={deposit.id} value={deposit.id}>
                  {money(deposit.amount)} / {displayDate(deposit.received_at)}
                </option>
              ))}
            </select>
            {availableDeposits.length === 0 ? (
              <span className="mt-2 block text-xs font-medium text-[#697178]">
                No available deposits for this project.
              </span>
            ) : null}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
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
            <label className="text-sm font-semibold">
              Tattoo payment
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, tattooPaymentMethod: event.target.value }))
                }
                value={form.tattooPaymentMethod}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
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
            {saving ? "Saving..." : "Save session"}
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
  const [showDepositEntry, setShowDepositEntry] = useState(false);
  const [showSessionEntry, setShowSessionEntry] = useState(false);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.filter((project) => {
      const customer = relatedOne(project.customer);
      const artistMatches = artistFilter === "all" || project.artist_id === artistFilter;
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? ["lead", "consultation", "booked", "in_progress"].includes(project.status)
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

  const availableSelectedDeposits = useMemo(() => {
    return selectedDeposits.filter((deposit) => deposit.available);
  }, [selectedDeposits]);

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

  const activeCount = projects.filter((project) =>
    ["lead", "consultation", "booked", "in_progress"].includes(project.status),
  ).length;
  const waiverMissingCount = projects.filter((project) => waiverLabel(project) !== "Signed").length;
  const availableDepositTotal = deposits
    .filter((deposit) => deposit.available)
    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError("Please log in to view projects.");
        setLoading(false);
        return;
      }

      const [staffResult, projectResult, appointmentResult, depositResult, sessionResult] =
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

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setLoading(false);
        return;
      }

      const nextProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];

      setStaff((staffResult.data ?? []) as StaffRecord[]);
      setProjects(nextProjects);
      setAppointments((appointmentResult.data ?? []) as AppointmentRecord[]);
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setSessions((sessionResult.data ?? []) as SessionEntryRecord[]);
      setSelectedProjectId(nextProjects[0]?.id ?? "");
      setLoading(false);
    }

    loadProjects();
  }, []);

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

  async function createDeposit(form: DepositForm) {
    if (!selectedProject) {
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setEntryError("Deposit amount must be greater than 0.");
      return;
    }

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    const result = await supabase
      .from("deposits")
      .insert({
        project_id: selectedProject.id,
        customer_id: selectedProject.customer_id,
        artist_id: selectedProject.artist_id,
        amount,
        payment_method: form.paymentMethod,
        received_at: new Date(form.receivedAt).toISOString(),
        available: true,
        memo: form.memo.trim() || null,
        created_by: userData.user?.id ?? null,
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

    setDeposits((current) => [result.data as DepositRecord, ...current]);
    setShowDepositEntry(false);
    setMessage("Deposit entry saved.");
    setSaving(false);
  }

  async function createSession(form: SessionForm) {
    if (!selectedProject) {
      return;
    }

    const appointment = selectedAppointments.find((item) => item.id === form.appointmentId);
    const startsAt = appointment?.starts_at ?? form.startsAt;
    const endsAt = appointment?.ends_at ?? form.endsAt;
    const startsDate = new Date(startsAt);
    const endsDate = new Date(endsAt);

    const tattooAmount = Number(form.tattooAmount || 0);
    const tipAmount = Number(form.tipAmount || 0);

    if (!appointment && (!startsAt || !endsAt || endsDate <= startsDate)) {
      setEntryError("Manual sessions need a valid start and end time.");
      return;
    }

    if (!Number.isFinite(tattooAmount) || !Number.isFinite(tipAmount)) {
      setEntryError("Amounts must be valid numbers.");
      return;
    }

    if (tattooAmount <= 0 && tipAmount <= 0) {
      setEntryError("Enter a tattoo amount or a tip amount.");
      return;
    }

    setSaving(true);
    setEntryError("");
    setError("");
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    let sessionAppointment = appointment;

    if (!sessionAppointment) {
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

    const result = await supabase
      .from("session_entries")
      .insert({
        project_id: selectedProject.id,
        customer_id: selectedProject.customer_id,
        appointment_id: sessionAppointment.id,
        artist_id: sessionAppointment.artist_id ?? selectedProject.artist_id,
        entry_type: "session",
        entered_at: new Date(sessionAppointment.starts_at).toISOString(),
        tattoo_amount: tattooAmount,
        tattoo_payment_method: tattooAmount > 0 ? form.tattooPaymentMethod : null,
        tip_amount: tipAmount,
        tip_payment_method: tipAmount > 0 ? form.tipPaymentMethod : null,
        memo: form.memo.trim() || null,
        created_by: userData.user?.id ?? null,
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

    if (form.depositId) {
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: false,
          used_at: new Date().toISOString(),
          used_session_entry_id: result.data.id,
        })
        .eq("id", form.depositId)
        .select(
          "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
        )
        .single();

      if (depositResult.error) {
        setEntryError(depositResult.error.message);
        setSaving(false);
        return;
      }

      setDeposits((current) =>
        current.map((deposit) =>
          deposit.id === form.depositId ? (depositResult.data as DepositRecord) : deposit,
        ),
      );
    }

    setSessions((current) => [result.data as SessionEntryRecord, ...current]);
    setShowSessionEntry(false);
    setMessage("Session entry saved.");
    setSaving(false);
  }

  return (
    <AppShell
      active="Projects"
      eyebrow="Project queue"
      title="Projects by artist"
      description="Track each tattoo project separately from the customer profile, including artist ownership, appointments, deposits, waiver state, and session entries."
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
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Total projects</p>
              <p className="mt-2 text-2xl font-semibold">{projects.length}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Active</p>
              <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Waiver pending</p>
              <p className="mt-2 text-2xl font-semibold">{waiverMissingCount}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Available deposits</p>
              <p className="mt-2 text-2xl font-semibold">{money(availableDepositTotal)}</p>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_0.7fr]">
              <input
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search project, customer, artist, email"
                value={search}
              />
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setArtistFilter(event.target.value)}
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
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="active">Active statuses</option>
                <option value="all">All statuses</option>
                <option value="lead">Lead</option>
                <option value="consultation">Consultation</option>
                <option value="booked">Booked</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </section>

          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
            <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
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
                            setMessage("");
                            setError("");
                            setEntryError("");
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
              <div className="space-y-6">
                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#8a6f4d]">
                        {selectedProject.id.slice(0, 8)}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">{selectedProject.subject}</h3>
                      <p className="mt-1 text-sm text-[#697178]">
                        {selectedProject.memo || "Project details"}
                      </p>
                    </div>
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
                  </div>

                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Customer</p>
                      <p className="mt-1 font-semibold">{customerName(selectedProject)}</p>
                      <p className="mt-1 text-sm text-[#697178]">
                        {relatedOne(selectedProject.customer)?.email || "-"}
                      </p>
                    </div>
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Artist</p>
                      <p className="mt-1 font-semibold">{artistName(selectedProject)}</p>
                      <p className="mt-1 text-sm text-[#697178]">
                        {selectedProject.session_type || "Session type not set"}
                      </p>
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

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Session entries</h3>
                    <button
                      className="h-9 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                      onClick={() => {
                        setEntryError("");
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
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.9fr_0.9fr_1fr]"
                      >
                        <div>
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
                          <p className="font-semibold">{money(session.tattoo_amount)} tattoo</p>
                          <p className="text-[#697178]">
                            {paymentLabel(session.tattoo_payment_method)}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">{money(session.tip_amount)} tip</p>
                          <p className="text-[#697178]">{paymentLabel(session.tip_payment_method)}</p>
                        </div>
                        <p className="text-[#4d555c]">{session.memo || "-"}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Deposits</h3>
                    <button
                      className="h-9 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                      onClick={() => {
                        setEntryError("");
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
                    {selectedDeposits.map((deposit) => (
                      <div
                        key={deposit.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.7fr_0.6fr_0.7fr_1fr]"
                      >
                        <p className="font-semibold">{displayDate(deposit.received_at)}</p>
                        <p className="font-semibold">{money(deposit.amount)}</p>
                        <p className={deposit.available ? "text-[#2f6658]" : "text-[#697178]"}>
                          {deposit.available ? "Available" : "Used"}
                        </p>
                        <p className="text-[#4d555c]">
                          {deposit.memo || paymentLabel(deposit.payment_method)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Appointments</h3>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedAppointments.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No appointments yet.
                      </p>
                    ) : null}
                    {selectedAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.8fr_0.6fr]"
                      >
                        <div>
                          <p className="font-semibold">{displayDateTime(appointment.starts_at)}</p>
                          <p className="text-[#697178]">
                            {appointment.ends_at ? displayDateTime(appointment.ends_at) : "-"}
                          </p>
                        </div>
                        <p className="font-semibold">{appointment.appointment_type}</p>
                        <p className="text-[#4d555c]">{appointment.status}</p>
                      </div>
                    ))}
                  </div>
                </section>
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
          appointments={unenteredSelectedAppointments}
          availableDeposits={availableSelectedDeposits}
          error={entryError}
          onClose={() => setShowSessionEntry(false)}
          onSave={createSession}
          project={selectedProject}
          saving={saving}
        />
      ) : null}

      {showDepositEntry && selectedProject ? (
        <DepositEntryModal
          error={entryError}
          onClose={() => setShowDepositEntry(false)}
          onSave={createDeposit}
          project={selectedProject}
          saving={saving}
        />
      ) : null}
    </AppShell>
  );
}

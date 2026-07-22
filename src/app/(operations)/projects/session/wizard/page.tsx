"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppPage } from "@/components/app-shell";
import { SessionEntryForm, type PaymentGrid, type SessionForm } from "@/components/session-entry-form";
import { TimeSelect } from "@/components/time-select";
import { getSafeSession, getSafeUser } from "@/lib/auth-session";
import { getOperationsContext } from "@/lib/operations-access";
import { supabase } from "@/lib/supabase";

type CustomerRelation = {
  name: string;
  email: string | null;
  phone: string | null;
};

type ArtistRelation = {
  display_name: string;
  default_session_duration_minutes: number | null;
};

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  default_session_duration_minutes: number | null;
};

type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type ProjectRecord = {
  id: string;
  customer_id: string;
  artist_id: string | null;
  subject: string;
  size: string | null;
  status: string;
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
  disposition: "available" | "applied" | "forfeited" | "refunded" | null;
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
  payment_type?: "tattoo" | "tip" | null;
  payment_method: string;
  amount: number;
  memo: string | null;
};

type SessionKind = "existing" | "walk_in";
type Step = "kind" | "client" | "details" | "appointment" | "payments" | "review" | "result";

type WalkInForm = {
  artistId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tattooDescription: string;
  tattooPlacement: string;
  tattooSize: string;
};

type SaveResult = {
  appointmentId: string;
  appointmentLabel: string;
  artistName: string;
  clientName: string;
  depositApplied: number;
  projectId: string;
  projectName: string;
  sessionId: string;
  kind: SessionKind;
  tattooTotal: number;
  tipTotal: number;
};

type SavedDraft = {
  depositAppliedAmount: string;
  memo: string;
  paymentGrid: PaymentGrid;
};

type WalkInAppointment = {
  date: string;
  startTime: string;
  endTime: string;
};

const projectSelect =
  "id, customer_id, artist_id, subject, size, status, customer:customers(name, email, phone), artist:staff(display_name, default_session_duration_minutes)";

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function depositAppliedTotal(depositId: string, applications: DepositApplicationRecord[]) {
  return applications
    .filter((application) => application.deposit_id === depositId)
    .reduce((sum, application) => sum + Number(application.amount), 0);
}

function depositRemaining(deposit: DepositRecord, applications: DepositApplicationRecord[]) {
  if (deposit.disposition === "forfeited" || deposit.disposition === "refunded") return 0;
  return Math.max(Number(deposit.amount) - depositAppliedTotal(deposit.id, applications), 0);
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value ?? 0);
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function appointmentLabel(appointment: AppointmentRecord | null | undefined) {
  if (!appointment) return "-";
  return `${displayDateTime(appointment.starts_at)} / ${appointment.appointment_type}`;
}

function projectLabel(project: ProjectRecord) {
  const customer = relatedOne(project.customer);
  return `${project.subject} / ${customer?.name ?? "No client"}`;
}

function projectNameFromWalkIn(form: WalkInForm) {
  const customer = form.customerName.trim();
  const placement = form.tattooPlacement.trim();
  const suffix = placement ? `${placement} tattoo` : "walk-in tattoo";
  return customer ? `${customer} - ${suffix}` : suffix;
}

function emptyWalkInForm(): WalkInForm {
  return {
    artistId: "",
    customerEmail: "",
    customerName: "",
    customerPhone: "",
    tattooDescription: "",
    tattooPlacement: "",
    tattooSize: "",
  };
}

function localDateValue(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function timeValue(value = new Date()) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function addMinutesToTime(date: string, time: string, minutesToAdd: number) {
  const next = new Date(`${date}T${time}:00`);
  next.setMinutes(next.getMinutes() + minutesToAdd);
  return {
    date: localDateValue(next),
    time: timeValue(next),
  };
}

export default function SessionWizardPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [depositApplications, setDepositApplications] = useState<DepositApplicationRecord[]>([]);
  const [kind, setKind] = useState<SessionKind | "">("");
  const [step, setStep] = useState<Step>("kind");
  const [projectId, setProjectId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentMode, setAppointmentMode] = useState<"scheduled" | "manual">("scheduled");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [walkInForm, setWalkInForm] = useState<WalkInForm>(() => emptyWalkInForm());
  const [walkInAppointment, setWalkInAppointment] = useState<WalkInAppointment>(() => {
    const date = localDateValue();
    const startTime = timeValue();
    const end = addMinutesToTime(date, startTime, 120);
    return { date, endTime: end.time, startTime };
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSavedSession, setEditingSavedSession] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [pendingForm, setPendingForm] = useState<SessionForm | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
  );
  const selectedAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.project_id === projectId && appointment.status !== "cancelled",
      ),
    [appointments, projectId],
  );
  const effectiveAppointmentId = appointmentId || selectedAppointments[0]?.id || "";
  const selectedAppointment = useMemo(
    () => selectedAppointments.find((appointment) => appointment.id === effectiveAppointmentId) ?? null,
    [effectiveAppointmentId, selectedAppointments],
  );
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 6);

    return customers
      .filter((customer) =>
        [customer.name, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term)),
      )
      .slice(0, 6);
  }, [customerSearch, customers]);
  const selectedDeposits = useMemo(
    () => deposits.filter((deposit) => deposit.project_id === projectId),
    [deposits, projectId],
  );
  const availableDeposit = useMemo(
    () =>
      selectedDeposits.reduce(
        (sum, deposit) => sum + depositRemaining(deposit, depositApplications),
        0,
      ),
    [depositApplications, selectedDeposits],
  );
  const selectedDepositApplications = useMemo(() => {
    const depositIds = new Set(selectedDeposits.map((deposit) => deposit.id));
    return depositApplications.filter((application) => depositIds.has(application.deposit_id));
  }, [depositApplications, selectedDeposits]);
  const selectedArtistDuration =
    (selectedProject
      ? relatedOne(selectedProject.artist)?.default_session_duration_minutes
      : artists.find((artist) => artist.id === walkInForm.artistId)?.default_session_duration_minutes) ?? 120;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const context = await getOperationsContext();
      const [artistResult, customerResult, projectResult, appointmentResult, depositResult, applicationResult] =
        await Promise.all([
          supabase
            .from("staff")
            .select("id, display_name, role, active, default_session_duration_minutes")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
          supabase.from("customers").select("id, name, email, phone").order("name", { ascending: true }),
          supabase
            .from("projects")
            .select(projectSelect)
            .in("status", ["booked", "in_progress", "on_hold"])
            .order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
            .order("starts_at", { ascending: false }),
          supabase
            .from("deposits")
            .select(
              "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, disposition, used_at, used_session_entry_id, memo",
            )
            .order("received_at", { ascending: true }),
          supabase.from("deposit_applications").select("id, deposit_id, session_entry_id, amount, applied_at, memo"),
        ]);

      if (artistResult.error) {
        setError(artistResult.error.message);
        setLoading(false);
        return;
      }
      if (customerResult.error) {
        setError(customerResult.error.message);
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
      if (applicationResult.error) {
        setError(applicationResult.error.message);
        setLoading(false);
        return;
      }

      const artistRows = (artistResult.data ?? []) as StaffRecord[];
      const visibleArtists =
        context?.isArtist && context.staffId
          ? artistRows.filter((artist) => artist.id === context.staffId)
          : artistRows.filter((artist) => ["Artist", "Owner"].includes(artist.role));
      const rawProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];
      const visibleProjects =
        context?.isArtist && context.staffId
          ? rawProjects.filter((project) => project.artist_id === context.staffId)
          : rawProjects;

      setArtists(visibleArtists);
      setCustomers((customerResult.data ?? []) as CustomerRecord[]);
      setProjects(visibleProjects);
      setProjectId(visibleProjects[0]?.id ?? "");
      setWalkInForm((current) => ({
        ...current,
        artistId: context?.staffId ?? visibleArtists[0]?.id ?? "",
      }));
      setAppointments((appointmentResult.data ?? []) as AppointmentRecord[]);
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setDepositApplications((applicationResult.data ?? []) as DepositApplicationRecord[]);

      const editSessionId = new URLSearchParams(window.location.search).get("editSessionId") ?? "";
      const storedEdit = editSessionId
        ? window.sessionStorage.getItem(`session-wizard-${editSessionId}`)
        : null;

      if (storedEdit) {
        const restored = JSON.parse(storedEdit) as {
          appointmentId?: string;
          appointmentMode?: "scheduled" | "manual";
          kind?: SessionKind;
          projectId?: string;
          saveResult?: SaveResult;
          savedDraft?: SavedDraft;
          walkInAppointment?: WalkInAppointment;
          walkInForm?: WalkInForm;
        };
        setKind(restored.kind ?? "existing");
        setProjectId(restored.projectId ?? visibleProjects[0]?.id ?? "");
        setAppointmentId(restored.appointmentId ?? "");
        setAppointmentMode(restored.appointmentMode ?? "scheduled");
        setSaveResult(restored.saveResult ?? null);
        setSavedDraft(restored.savedDraft ?? null);
        setWalkInAppointment((current) => restored.walkInAppointment ?? current);
        setWalkInForm(restored.walkInForm ?? emptyWalkInForm());
        setEditingSavedSession(true);
        setStep("payments");
      }
      setLoading(false);
    }

    load();
  }, []);

  function chooseKind(nextKind: SessionKind) {
    setKind(nextKind);
    setStep(nextKind === "walk_in" ? "client" : "details");
    setError("");
    setMessage("");
    setSaveResult(null);
  }

  function patchWalkIn(patch: Partial<WalkInForm>) {
    setWalkInForm((current) => ({ ...current, ...patch }));
  }

  function selectCustomer(customer: CustomerRecord) {
    setCustomerMode("existing");
    setSelectedCustomerId(customer.id);
    setCustomerSearch([customer.name, customer.email, customer.phone].filter(Boolean).join(" / "));
    setWalkInForm((current) => ({
      ...current,
      customerEmail: customer.email ?? "",
      customerName: customer.name,
      customerPhone: customer.phone ?? "",
    }));
  }

  function continueToPayments() {
    setError("");
    if (kind === "existing" && !selectedProject) {
      setError("Select a project.");
      return;
    }
    if (kind === "existing") {
      setStep("appointment");
      return;
    }
    if (kind === "walk_in") {
      if (customerMode === "existing" && !selectedCustomerId) {
        setError("Select an existing customer, or switch to New.");
        return;
      }
      if (!walkInForm.customerName.trim()) {
        setError("Customer name is required.");
        return;
      }
      if (!walkInForm.customerEmail.trim()) {
        setError("Customer email is required.");
        return;
      }
      if (!walkInForm.customerPhone.trim()) {
        setError("Customer phone is required.");
        return;
      }
      if (!walkInForm.artistId) {
        setError("Select an artist.");
        return;
      }
      if (!walkInForm.tattooPlacement.trim()) {
        setError("Placement is required.");
        return;
      }
      if (!walkInForm.tattooSize.trim()) {
        setError("Size is required.");
        return;
      }
      if (!walkInForm.tattooDescription.trim()) {
        setError("Description is required.");
        return;
      }
      setStep("appointment");
      return;
    }
    setStep("payments");
  }

  function continueAppointmentToPayments() {
    setError("");
    if (kind === "existing" && appointmentMode === "scheduled" && !selectedAppointment) {
      setError("Select an appointment.");
      return;
    }
    if (kind === "walk_in" || appointmentMode === "manual") {
      const startsAt = new Date(`${walkInAppointment.date}T${walkInAppointment.startTime}:00`);
      const endsAt = new Date(`${walkInAppointment.date}T${walkInAppointment.endTime}:00`);
      if (!walkInAppointment.date || endsAt <= startsAt) {
        setError("Select a valid date and time.");
        return;
      }
    }
    setStep("payments");
  }

  async function saveSessionForProject(form: SessionForm, project: ProjectRecord) {
    const existingSessionId = editingSavedSession ? saveResult?.sessionId ?? "" : "";
    const appointment = existingSessionId
      ? appointments.find((item) => item.id === saveResult?.appointmentId)
      : kind === "existing" && appointmentMode === "scheduled"
        ? selectedAppointments.find(
            (item) => item.id === (form.appointmentId || effectiveAppointmentId),
          )
        : undefined;
    const startsAt = appointment?.starts_at ?? form.startsAt;
    const endsAt = appointment?.ends_at ?? form.endsAt;
    const startsDate = new Date(startsAt);
    const endsDate = new Date(endsAt);
    const tattooAmount = Number(form.tattooAmount || 0);
    const tipAmount = Number(form.tipAmount || 0);
    const depositAppliedAmount = Number(form.depositAppliedAmount || 0);
    const paymentLines = form.paymentLines
      .map((line) => ({
        amount: Number(line.amount || 0),
        paymentMethod: line.paymentMethod,
        paymentType: line.paymentType ?? "tattoo",
      }))
      .filter((line) => line.amount > 0);
    const tattooPaymentTotal = paymentLines
      .filter((line) => line.paymentType === "tattoo")
      .reduce((sum, line) => sum + line.amount, 0);
    const tipPaymentTotal = paymentLines
      .filter((line) => line.paymentType === "tip")
      .reduce((sum, line) => sum + line.amount, 0);
    const priorDepositApplications = existingSessionId
      ? depositApplications.filter((application) => application.session_entry_id === existingSessionId)
      : [];
    const priorDepositAppliedTotal = priorDepositApplications.reduce(
      (sum, application) => sum + Number(application.amount),
      0,
    );
    const availableDepositForSession = availableDeposit + priorDepositAppliedTotal;

    if (!appointment && (!startsAt || !endsAt || endsDate <= startsDate)) {
      throw new Error("Manual sessions need a valid start and end time.");
    }
    if (!Number.isFinite(tattooAmount) || !Number.isFinite(tipAmount) || !Number.isFinite(depositAppliedAmount)) {
      throw new Error("Amounts must be valid numbers.");
    }
    if (tattooAmount <= 0 && tipAmount <= 0) {
      throw new Error("Enter a tattoo amount or a tip amount.");
    }
    if (depositAppliedAmount > availableDepositForSession) {
      throw new Error(`Applied deposit cannot exceed available balance ${money(availableDepositForSession)}.`);
    }
    if (depositAppliedAmount > tattooAmount) {
      throw new Error("Applied deposit cannot exceed tattoo amount.");
    }
    if (Math.abs(tattooAmount - depositAppliedAmount - tattooPaymentTotal) >= 0.01) {
      throw new Error("Tattoo payments must equal tattoo total minus applied deposit.");
    }
    if (Math.abs(tipAmount - tipPaymentTotal) >= 0.01) {
      throw new Error("Tip payments must equal tip total.");
    }

    const user = await getSafeUser();
    let sessionAppointment = appointment;

    if (!sessionAppointment) {
      const appointmentResult = await supabase
        .from("appointments")
        .insert({
          artist_id: project.artist_id,
          customer_id: project.customer_id,
          ends_at: endsDate.toISOString(),
          notes: "Created from session wizard.",
          appointment_type: project.status === "on_hold" ? "Walk-in" : "completed session",
          project_id: project.id,
          starts_at: startsDate.toISOString(),
          status: "completed",
        })
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
        .single();

      if (appointmentResult.error) throw new Error(appointmentResult.error.message);
      sessionAppointment = appointmentResult.data as AppointmentRecord;
      setAppointments((current) => [sessionAppointment!, ...current]);
    }

    if (existingSessionId && sessionAppointment && kind === "walk_in") {
      const appointmentResult = await supabase
        .from("appointments")
        .update({
          ends_at: endsDate.toISOString(),
          starts_at: startsDate.toISOString(),
        })
        .eq("id", sessionAppointment.id)
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
        .single();

      if (appointmentResult.error) throw new Error(appointmentResult.error.message);
      sessionAppointment = appointmentResult.data as AppointmentRecord;
    }

    const sessionPayload = {
        appointment_id: sessionAppointment.id,
        artist_id: sessionAppointment.artist_id ?? project.artist_id,
        customer_id: project.customer_id,
        entered_at: new Date(sessionAppointment.starts_at).toISOString(),
        entry_type: "session",
        memo: form.memo.trim() || null,
        project_id: project.id,
        tattoo_amount: tattooAmount,
        tattoo_payment_method:
          paymentLines.find((line) => line.paymentType === "tattoo")?.paymentMethod ?? null,
        tip_amount: tipAmount,
        tip_payment_method:
          paymentLines.find((line) => line.paymentType === "tip")?.paymentMethod ?? null,
    };
    const sessionResult = existingSessionId
      ? await supabase
          .from("session_entries")
          .update(sessionPayload)
          .eq("id", existingSessionId)
          .select("id")
          .single()
      : await supabase
          .from("session_entries")
          .insert({
            ...sessionPayload,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();

    if (sessionResult.error) throw new Error(sessionResult.error.message);

    if (existingSessionId) {
      const deletePaymentsResult = await supabase
        .from("session_payments")
        .delete()
        .eq("session_entry_id", existingSessionId);
      if (deletePaymentsResult.error) throw new Error(deletePaymentsResult.error.message);
    }

    if (paymentLines.length > 0) {
      const paymentResult = await supabase.from("session_payments").insert(
        paymentLines.map((line) => ({
          amount: line.amount,
          created_by: user?.id ?? null,
          payment_method: line.paymentMethod,
          payment_type: line.paymentType,
          session_entry_id: sessionResult.data.id,
        })),
      );
      if (paymentResult.error) {
        throw new Error(`${paymentResult.error.message}. Run docs/supabase_session_payments.sql in Supabase SQL Editor.`);
      }
    }

    const affectedDepositIds = new Set(priorDepositApplications.map((application) => application.deposit_id));
    let nextDepositApplications = depositApplications.filter(
      (application) => application.session_entry_id !== sessionResult.data.id,
    );

    if (existingSessionId && priorDepositApplications.length > 0) {
      const deleteApplicationResult = await supabase
        .from("deposit_applications")
        .delete()
        .eq("session_entry_id", existingSessionId);
      if (deleteApplicationResult.error) throw new Error(deleteApplicationResult.error.message);
    }

    if (depositAppliedAmount > 0) {
      let remainingToApply = depositAppliedAmount;
      const applicationRows: Array<{
        amount: number;
        created_by: string | null;
        deposit_id: string;
        memo: string | null;
        session_entry_id: string;
      }> = [];

      for (const deposit of [...selectedDeposits].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
      )) {
        if (remainingToApply <= 0) break;
        const available = depositRemaining(deposit, nextDepositApplications);
        const amount = Math.min(available, remainingToApply);
        if (amount <= 0) continue;
        applicationRows.push({
          amount,
          created_by: user?.id ?? null,
          deposit_id: deposit.id,
          memo: form.memo.trim() || null,
          session_entry_id: sessionResult.data.id,
        });
        affectedDepositIds.add(deposit.id);
        remainingToApply -= amount;
      }

      if (remainingToApply > 0.009) {
        throw new Error("Not enough available deposit balance.");
      }

      const applicationResult = await supabase
        .from("deposit_applications")
        .insert(applicationRows)
        .select("id, deposit_id, session_entry_id, amount, applied_at, memo");
      if (applicationResult.error) {
        throw new Error(`${applicationResult.error.message}. Run docs/supabase_deposit_applications.sql in Supabase SQL Editor.`);
      }

      nextDepositApplications = [
        ...((applicationResult.data ?? []) as DepositApplicationRecord[]),
        ...nextDepositApplications,
      ];
    }

    for (const depositId of affectedDepositIds) {
      const deposit = selectedDeposits.find((item) => item.id === depositId);
      if (!deposit) continue;
      const remaining = depositRemaining(deposit, nextDepositApplications);
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: remaining > 0,
          disposition: remaining > 0 ? "available" : "applied",
          used_at: remaining > 0 ? null : new Date().toISOString(),
          used_session_entry_id: remaining > 0 ? null : sessionResult.data.id,
        })
        .eq("id", depositId);
      if (depositResult.error) throw new Error(depositResult.error.message);
    }

    await supabase.from("projects").update({ status: "in_progress" }).eq("id", project.id);
    setDepositApplications(nextDepositApplications);

    return {
      appointmentId: sessionAppointment.id,
      appointmentLabel: appointmentLabel(sessionAppointment),
      artistName:
        relatedOne(project.artist)?.display_name ??
        artists.find((artist) => artist.id === project.artist_id)?.display_name ??
        "Artist",
      clientName: relatedOne(project.customer)?.name ?? walkInForm.customerName.trim() ?? "Client",
      depositApplied: depositAppliedAmount,
      projectId: project.id,
      projectName: project.subject,
      sessionId: sessionResult.data.id,
      tattooTotal: tattooAmount,
      tipTotal: tipAmount,
    };
  }

  async function createWalkInProject(form: SessionForm) {
    const session = await getSafeSession();
    if (!session) throw new Error("Please log in to save a session.");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        artistId: walkInForm.artistId,
        customerId: customerMode === "existing" ? selectedCustomerId : undefined,
        customerEmail: walkInForm.customerEmail,
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        depositAmount: 0,
        projectName: projectNameFromWalkIn(walkInForm),
        projectType: "Walk-in",
        tattooDescription: walkInForm.tattooDescription,
        tattooPlacement: walkInForm.tattooPlacement,
        tattooSize: walkInForm.tattooSize,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      customerId?: string;
      error?: string;
      projectId?: string;
    };

    if (!response.ok || !payload.projectId || !payload.customerId) {
      throw new Error(payload.error ?? "Walk-in project could not be created.");
    }

    const project: ProjectRecord = {
      artist: {
        default_session_duration_minutes:
          artists.find((artist) => artist.id === walkInForm.artistId)?.default_session_duration_minutes ?? 120,
        display_name:
          artists.find((artist) => artist.id === walkInForm.artistId)?.display_name ?? "Artist",
      },
      artist_id: walkInForm.artistId,
      customer: {
        email: walkInForm.customerEmail.trim() || null,
        name: walkInForm.customerName.trim(),
        phone: walkInForm.customerPhone.trim() || null,
      },
      customer_id: payload.customerId,
      id: payload.projectId,
      size: walkInForm.tattooSize.trim() || null,
      status: "on_hold",
      subject: projectNameFromWalkIn(walkInForm),
    };

    setProjects((current) => [project, ...current]);
    setProjectId(project.id);

    return saveSessionForProject(form, project);
  }

  function handlePaymentContinue(form: SessionForm) {
    setPendingForm(form);
    setSavedDraft({
      depositAppliedAmount: form.depositAppliedAmount,
      memo: form.memo,
      paymentGrid: form.paymentGrid,
    });
    setError("");
    setMessage("");
    setStep("review");
  }

  async function saveReviewedSession() {
    if (!pendingForm) return;

    const form = pendingForm;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const savedProject = saveResult
        ? projects.find((project) => project.id === saveResult.projectId) ?? selectedProject
        : selectedProject;
      const result = editingSavedSession && savedProject
        ? await saveSessionForProject(form, savedProject)
        : kind === "walk_in"
          ? await createWalkInProject(form)
          : selectedProject
            ? await saveSessionForProject(form, selectedProject)
            : null;

      if (!result) throw new Error("Select a project.");
      const nextResult = { ...result, kind: kind || "existing" } as SaveResult;
      setSaveResult(nextResult);
      setSavedDraft({
        depositAppliedAmount: form.depositAppliedAmount,
        memo: form.memo,
        paymentGrid: form.paymentGrid,
      });
      setEditingSavedSession(false);
      setMessage(editingSavedSession ? "Session updated." : "Session saved.");
      window.sessionStorage.setItem(
        `session-wizard-${nextResult.sessionId}`,
        JSON.stringify({
          appointmentId,
          appointmentMode,
          kind,
          projectId: nextResult.projectId,
          saveResult: nextResult,
          savedDraft: {
            depositAppliedAmount: form.depositAppliedAmount,
            memo: form.memo,
            paymentGrid: form.paymentGrid,
          },
          walkInAppointment,
          walkInForm,
        }),
      );
      router.push(`/projects/session/${nextResult.sessionId}/result`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Session could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSavedResult() {
    if (!saveResult) return;
    if (!window.confirm("Delete this saved session?")) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const applicationResult = await supabase
        .from("deposit_applications")
        .select("deposit_id")
        .eq("session_entry_id", saveResult.sessionId);

      if (applicationResult.error) throw new Error(applicationResult.error.message);

      const affectedDepositIds = (applicationResult.data ?? []).map((row) => row.deposit_id);
      const deleteApplications = await supabase
        .from("deposit_applications")
        .delete()
        .eq("session_entry_id", saveResult.sessionId);

      if (deleteApplications.error) throw new Error(deleteApplications.error.message);

      const deletePayments = await supabase
        .from("session_payments")
        .delete()
        .eq("session_entry_id", saveResult.sessionId);

      if (deletePayments.error) throw new Error(deletePayments.error.message);

      const deleteSession = await supabase.from("session_entries").delete().eq("id", saveResult.sessionId);
      if (deleteSession.error) throw new Error(deleteSession.error.message);

      for (const depositId of affectedDepositIds) {
        const depositResult = await supabase
          .from("deposits")
          .update({
            available: true,
            disposition: "available",
            used_at: null,
            used_session_entry_id: null,
          })
          .eq("id", depositId);

        if (depositResult.error) throw new Error(depositResult.error.message);
      }

      if (saveResult.kind === "walk_in") {
        const deleteAppointment = await supabase
          .from("appointments")
          .delete()
          .eq("id", saveResult.appointmentId);

        if (deleteAppointment.error) throw new Error(deleteAppointment.error.message);

        const deleteProject = await supabase.from("projects").delete().eq("id", saveResult.projectId);
        if (deleteProject.error) throw new Error(deleteProject.error.message);
      }

      setSaveResult(null);
      setSavedDraft(null);
      setEditingSavedSession(false);
      setStep("kind");
      setMessage("Saved session deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Session could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  function resetWizard() {
    setKind("");
    setStep("kind");
    setError("");
    setMessage("");
    setSaveResult(null);
    setSavedDraft(null);
    setEditingSavedSession(false);
    setCustomerMode("new");
    setSelectedCustomerId("");
    setCustomerSearch("");
    setWalkInForm((current) => ({
      ...emptyWalkInForm(),
      artistId: current.artistId || artists[0]?.id || "",
    }));
  }

  const totalSteps = kind === "walk_in" ? 6 : 5;
  const stepIndex =
    step === "kind"
      ? 1
      : step === "client"
        ? 2
        : step === "details"
          ? kind === "walk_in" ? 3 : 2
          : step === "appointment"
            ? kind === "walk_in" ? 4 : 3
            : step === "payments"
              ? kind === "walk_in" ? 5 : 4
              : totalSteps;

  return (
    <AppPage
      actions={
        <Link
          className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
          href="/projects/session/new"
        >
          Legacy session
        </Link>
      }
      eyebrow="Projects"
      title="New session beta"
    >
      <section className="mx-auto max-w-5xl rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Guided session entry</h3>
              <p className="mt-1 text-sm font-medium text-[#697178]">
                Step {stepIndex} of {totalSteps}
              </p>
            </div>
            <button
              className="h-9 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold hover:bg-[#eee8dd]"
              onClick={resetWizard}
              type="button"
            >
              Start over
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-3 py-2 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          {step === "kind" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <button
                className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-5 py-5 text-left hover:border-[#9c8260]"
                onClick={() => chooseKind("existing")}
                type="button"
              >
                <p className="text-base font-semibold">Existing project</p>
                <p className="mt-2 text-sm font-medium text-[#697178]">
                  Use this when the customer already has a project or appointment.
                </p>
              </button>
              <button
                className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-5 py-5 text-left hover:border-[#9c8260]"
                onClick={() => chooseKind("walk_in")}
                type="button"
              >
                <p className="text-base font-semibold">Walk-in / same-day</p>
                <p className="mt-2 text-sm font-medium text-[#697178]">
                  Enter the tattoo once, and the app will create the project and calendar record.
                </p>
              </button>
            </div>
          ) : null}

          {step === "client" && kind === "walk_in" ? (
            <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#697178]">Client type</p>
                <h4 className="mt-1 text-lg font-semibold">Has this client visited before?</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="rounded-md border border-[#d9d3c7] bg-white px-5 py-5 text-left hover:border-[#1f2428] hover:shadow-sm"
                  onClick={() => {
                    setCustomerMode("existing");
                    setSelectedCustomerId("");
                    setCustomerSearch("");
                    setStep("details");
                  }}
                  type="button"
                >
                  <p className="text-base font-semibold">Existing client</p>
                  <p className="mt-2 text-sm font-medium text-[#697178]">
                    Search by name, email, or phone.
                  </p>
                </button>
                <button
                  className="rounded-md border border-[#d9d3c7] bg-white px-5 py-5 text-left hover:border-[#1f2428] hover:shadow-sm"
                  onClick={() => {
                    setCustomerMode("new");
                    setSelectedCustomerId("");
                    setCustomerSearch("");
                    setWalkInForm((current) => ({
                      ...current,
                      customerEmail: "",
                      customerName: "",
                      customerPhone: "",
                    }));
                    setStep("details");
                  }}
                  type="button"
                >
                  <p className="text-base font-semibold">New client</p>
                  <p className="mt-2 text-sm font-medium text-[#697178]">
                    Create a new customer record.
                  </p>
                </button>
              </div>
              <div className="mt-4">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("kind")}
                  type="button"
                >
                  Go back
                </button>
              </div>
            </section>
          ) : null}

          {step === "details" && kind === "existing" ? (
            <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
              <label className="block text-sm font-semibold">
                Project
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  disabled={saving}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setAppointmentId("");
                  }}
                  value={projectId}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectLabel(project)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex justify-between gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("kind")}
                  type="button"
                >
                  Go back
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  onClick={continueToPayments}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "appointment" && kind === "existing" ? (
            <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#697178]">Appointment</p>
                <h4 className="mt-1 text-base font-semibold">{selectedProject?.subject}</h4>
              </div>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <button
                  className={`rounded-md border px-4 py-3 text-left text-sm ${appointmentMode === "scheduled" ? "border-[#1f2428] bg-white shadow-sm" : "border-[#d9d3c7] bg-white"}`}
                  disabled={selectedAppointments.length === 0}
                  onClick={() => setAppointmentMode("scheduled")}
                  type="button"
                >
                  <span className="font-semibold">Select scheduled appointment</span>
                </button>
                <button
                  className={`rounded-md border px-4 py-3 text-left text-sm ${appointmentMode === "manual" ? "border-[#1f2428] bg-white shadow-sm" : "border-[#d9d3c7] bg-white"}`}
                  onClick={() => setAppointmentMode("manual")}
                  type="button"
                >
                  <span className="font-semibold">No appointment / record completed session</span>
                </button>
              </div>
              {appointmentMode === "scheduled" && selectedAppointments.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#d9d3c7] bg-white px-3 py-5 text-sm font-semibold text-[#697178]">
                  <p>No appointment exists for this project.</p>
                  <button
                    className="mt-3 h-9 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                    onClick={() => setAppointmentMode("manual")}
                    type="button"
                  >
                    Record this session now
                  </button>
                </div>
              ) : appointmentMode === "scheduled" ? (
                <div className="grid gap-2">
                  {selectedAppointments.map((appointment) => (
                    <button
                      className={`rounded-md border px-4 py-3 text-left text-sm ${
                        effectiveAppointmentId === appointment.id
                          ? "border-[#1f2428] bg-white shadow-sm"
                          : "border-[#d9d3c7] bg-white hover:border-[#9c8260]"
                      }`}
                      key={appointment.id}
                      onClick={() => setAppointmentId(appointment.id)}
                      type="button"
                    >
                      <span className="font-semibold">{appointmentLabel(appointment)}</span>
                      <span className="ml-2 text-[#697178]">{appointment.status}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                  <label className="text-sm font-semibold">
                    Date
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) => setWalkInAppointment((current) => ({ ...current, date: event.target.value }))}
                      type="date"
                      value={walkInAppointment.date}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Start
                    <TimeSelect
                      endHour={24}
                      interval={30}
                      onChange={(value) => {
                        const end = addMinutesToTime(walkInAppointment.date, value, selectedArtistDuration);
                        setWalkInAppointment((current) => ({ ...current, endTime: end.time, startTime: value }));
                      }}
                      startHour={8}
                      value={walkInAppointment.startTime}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    End
                    <TimeSelect
                      endHour={24}
                      interval={30}
                      onChange={(value) => setWalkInAppointment((current) => ({ ...current, endTime: value }))}
                      startHour={8}
                      value={walkInAppointment.endTime}
                    />
                  </label>
                </div>
              )}
              <div className="mt-4 flex justify-between gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("details")}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={appointmentMode === "scheduled" && selectedAppointments.length === 0}
                  onClick={continueAppointmentToPayments}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "appointment" && kind === "walk_in" ? (
            <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#697178]">Appointment</p>
                <h4 className="mt-1 text-base font-semibold">{projectNameFromWalkIn(walkInForm)}</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Date
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) =>
                      setWalkInAppointment((current) => ({ ...current, date: event.target.value }))
                    }
                    type="date"
                    value={walkInAppointment.date}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Start
                  <TimeSelect
                    endHour={24}
                    interval={30}
                    onChange={(value) => {
                      const end = addMinutesToTime(
                        walkInAppointment.date,
                        value,
                        selectedArtistDuration,
                      );
                      setWalkInAppointment((current) => ({
                        ...current,
                        endTime: end.time,
                        startTime: value,
                      }));
                    }}
                    startHour={8}
                    value={walkInAppointment.startTime}
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-between gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("details")}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  onClick={continueAppointmentToPayments}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "details" && kind === "walk_in" ? (
            <section className="space-y-4 rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-[#697178]">
                  {customerMode === "existing" ? "Select existing client" : "New client details"}
                </p>
              </div>

              {customerMode === "existing" ? (
                <div className="rounded-md border border-[#d9d3c7] bg-white px-3 py-3">
                  <label className="block text-sm font-semibold">
                    Find existing customer
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Search name, email, or phone"
                      value={customerSearch}
                    />
                  </label>
                  <div className="mt-2 grid gap-1">
                    {filteredCustomers.map((customer) => (
                      <button
                        className={`rounded-md px-3 py-2 text-left text-sm hover:bg-[#eee8dd] ${
                          selectedCustomerId === customer.id ? "bg-[#f7f2e9] font-semibold" : ""
                        }`}
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        type="button"
                      >
                        {[customer.name, customer.email, customer.phone].filter(Boolean).join(" / ")}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 ? (
                      <p className="px-3 py-2 text-sm font-semibold text-[#697178]">No match found.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {customerMode === "new" || selectedCustomerId ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-semibold">
                  Client name <span className="text-[#8a3030]">*</span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    disabled={customerMode === "existing" && Boolean(selectedCustomerId)}
                    onChange={(event) => patchWalkIn({ customerName: event.target.value })}
                    value={walkInForm.customerName}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Email <span className="text-[#8a3030]">*</span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    disabled={customerMode === "existing" && Boolean(selectedCustomerId)}
                    onChange={(event) => patchWalkIn({ customerEmail: event.target.value })}
                    type="email"
                    value={walkInForm.customerEmail}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Phone <span className="text-[#8a3030]">*</span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    disabled={customerMode === "existing" && Boolean(selectedCustomerId)}
                    onChange={(event) => patchWalkIn({ customerPhone: event.target.value })}
                    value={walkInForm.customerPhone}
                  />
                </label>
              </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-semibold">
                  Artist <span className="text-[#8a3030]">*</span>
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => patchWalkIn({ artistId: event.target.value })}
                    value={walkInForm.artistId}
                  >
                    <option value="">Select artist</option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Placement <span className="text-[#8a3030]">*</span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => patchWalkIn({ tattooPlacement: event.target.value })}
                    value={walkInForm.tattooPlacement}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Size <span className="text-[#8a3030]">*</span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => patchWalkIn({ tattooSize: event.target.value })}
                    value={walkInForm.tattooSize}
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold">
                Description <span className="text-[#8a3030]">*</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(event) => patchWalkIn({ tattooDescription: event.target.value })}
                  value={walkInForm.tattooDescription}
                />
              </label>

              <div className="flex justify-between gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("client")}
                  type="button"
                >
                  Go back
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  onClick={continueToPayments}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {step === "payments" ? (
            <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#697178]">Payment entry</p>
                  <h4 className="mt-1 text-base font-semibold">
                    {kind === "walk_in" ? projectNameFromWalkIn(walkInForm) : selectedProject?.subject}
                  </h4>
                </div>
                <button
                  className="h-9 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("appointment")}
                  type="button"
                >
                  Back
                </button>
              </div>
              <SessionEntryForm
                appointments={kind === "existing" && selectedAppointment ? [selectedAppointment] : []}
                availableDepositBalance={kind === "existing" ? availableDeposit : 0}
                defaultDurationMinutes={selectedArtistDuration}
                depositApplications={kind === "existing" ? selectedDepositApplications : []}
                error=""
                hideAppointment
                hideDeposit={kind === "walk_in"}
                hideTiming
                initialDepositAppliedAmount={savedDraft?.depositAppliedAmount}
                initialEndTime={kind === "walk_in" || appointmentMode === "manual" ? walkInAppointment.endTime : undefined}
                initialAppointmentId={kind === "existing" && appointmentMode === "scheduled" ? effectiveAppointmentId : undefined}
                initialMemo={savedDraft?.memo}
                initialPaymentGrid={savedDraft?.paymentGrid}
                initialSessionDate={kind === "walk_in" || appointmentMode === "manual" ? walkInAppointment.date : undefined}
                initialStartTime={kind === "walk_in" || appointmentMode === "manual" ? walkInAppointment.startTime : undefined}
                key={`${kind}-${projectId}-${effectiveAppointmentId}-${walkInAppointment.date}-${walkInAppointment.startTime}-${walkInAppointment.endTime}-${saveResult?.sessionId ?? "new"}-${editingSavedSession ? "edit" : "new"}`}
                onNextAppointment={() => undefined}
                confirmBeforeSave={false}
                onSave={handlePaymentContinue}
                saving={saving}
                sessionPayments={[] as SessionPaymentRecord[]}
                submitLabel="Continue to review"
              />
            </section>
          ) : null}

          {step === "review" && pendingForm ? (
            <section className="rounded-md border border-[#d9d3c7] bg-white px-5 py-5 shadow-sm">
              <div className="border-b border-[#e5dfd4] pb-4">
                <p className="text-sm font-semibold text-[#697178]">Review</p>
                <h4 className="mt-1 text-xl font-semibold">Check before saving</h4>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-xs font-bold uppercase text-[#697178]">Project</p>
                  <p className="mt-1 font-semibold">
                    {kind === "walk_in" ? projectNameFromWalkIn(walkInForm) : selectedProject?.subject}
                  </p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-xs font-bold uppercase text-[#697178]">Date / Start</p>
                  <p className="mt-1 font-semibold">
                    {kind === "existing" && appointmentMode === "scheduled"
                      ? displayDateTime(selectedAppointment?.starts_at)
                      : `${walkInAppointment.date} / ${walkInAppointment.startTime}`}
                  </p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-xs font-bold uppercase text-[#697178]">Tattoo / Tip</p>
                  <p className="mt-1 font-semibold">
                    {money(Number(pendingForm.tattooAmount || 0))} / {money(Number(pendingForm.tipAmount || 0))}
                  </p>
                </div>
              </div>
              {kind === "existing" ? (
                <div className="mt-3 rounded-md border border-[#d9d3c7] px-3 py-3 text-sm">
                  <span className="font-semibold text-[#697178]">Deposit applied</span>
                  <span className="float-right font-bold">{money(Number(pendingForm.depositAppliedAmount || 0))}</span>
                </div>
              ) : null}
              <div className="mt-5 flex justify-between gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold hover:bg-[#eee8dd]"
                  onClick={() => setStep("payments")}
                  type="button"
                >
                  Go back
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={saveReviewedSession}
                  type="button"
                >
                  {saving ? "Saving..." : editingSavedSession ? "Update session" : "Save session"}
                </button>
              </div>
            </section>
          ) : null}

          {step === "result" && saveResult ? (
            <section className="rounded-md border border-[#d9d3c7] bg-white px-5 py-5 shadow-sm">
              <div className="border-b border-[#e5dfd4] pb-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#476b33]">Session saved</p>
                <h4 className="mt-1 text-2xl font-semibold">Session result</h4>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md bg-[#f7f2e9] px-4 py-4">
                  <p className="text-xs font-bold uppercase text-[#697178]">Client</p>
                  <p className="mt-1 text-lg font-semibold">{saveResult.clientName}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-4 py-4">
                  <p className="text-xs font-bold uppercase text-[#697178]">Artist</p>
                  <p className="mt-1 text-lg font-semibold">{saveResult.artistName}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-4 py-4">
                  <p className="text-xs font-bold uppercase text-[#697178]">Project</p>
                  <p className="mt-1 font-semibold">{saveResult.projectName}</p>
                  <p className="mt-1 text-xs font-semibold text-[#697178]">{saveResult.projectId.slice(0, 8)}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-4 py-4">
                  <p className="text-xs font-bold uppercase text-[#697178]">Appointment</p>
                  <p className="mt-1 font-semibold">{saveResult.appointmentLabel}</p>
                  <p className="mt-1 text-xs font-semibold text-[#697178]">{saveResult.appointmentId.slice(0, 8)}</p>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-[#d9d3c7]">
                <div className="grid grid-cols-2 border-b border-[#eee8dd] px-4 py-3 text-sm">
                  <span className="font-semibold text-[#697178]">Tattoo total</span>
                  <span className="text-right font-bold">{money(saveResult.tattooTotal)}</span>
                </div>
                <div className="grid grid-cols-2 border-b border-[#eee8dd] px-4 py-3 text-sm">
                  <span className="font-semibold text-[#697178]">Tip total</span>
                  <span className="text-right font-bold">{money(saveResult.tipTotal)}</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3 text-sm">
                  <span className="font-semibold text-[#697178]">Deposit applied</span>
                  <span className="text-right font-bold">{money(saveResult.depositApplied)}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                  onClick={() => {
                    setEditingSavedSession(true);
                    setMessage("");
                    setStep("payments");
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="h-10 rounded-md border border-[#8a3030] bg-white px-4 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={deleteSavedResult}
                  type="button"
                >
                  Delete
                </button>
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  onClick={resetWizard}
                  type="button"
                >
                  Next session
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </AppPage>
  );
}

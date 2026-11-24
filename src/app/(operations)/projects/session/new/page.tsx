"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage } from "@/components/app-shell";
import { SessionEntryForm, type SessionForm } from "@/components/session-entry-form";
import { getSafeUser } from "@/lib/auth-session";
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

type ProjectRecord = {
  id: string;
  customer_id: string;
  artist_id: string | null;
  subject: string;
  size: string | null;
  status: string;
  artist_default_duration_minutes?: number | null;
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
  session_completed_at: string | null;
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
  draft_deposit_applied_amount: number;
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
  app_provider: "venmo" | "zelle" | "legacy_unknown" | null;
  processed_at: string;
};

type DraftSessionRecord = {
  id: string;
  appointment_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  entered_at: string;
  tattoo_amount: number;
  tattoo_payment_method: string | null;
  tip_amount: number;
  tip_payment_method: string | null;
  memo: string | null;
  updated_at: string;
};

const projectSelect =
  "id, customer_id, artist_id, subject, size, status, customer:customers(name, email, phone), artist:staff(display_name, default_session_duration_minutes)";

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value ?? 0);
}

function depositAppliedTotal(depositId: string, applications: DepositApplicationRecord[]) {
  return applications
    .filter((application) => application.deposit_id === depositId)
    .reduce((sum, application) => sum + Number(application.amount), 0);
}

function depositRemaining(deposit: DepositRecord, applications: DepositApplicationRecord[]) {
  if (deposit.disposition === "forfeited" || deposit.disposition === "refunded") {
    return 0;
  }

  return Math.max(Number(deposit.amount) - depositAppliedTotal(deposit.id, applications), 0);
}

function projectLabel(project: ProjectRecord) {
  const customer = relatedOne(project.customer);
  return `${project.subject} / ${customer?.name ?? "No client"}`;
}

export default function NewSessionPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [depositApplications, setDepositApplications] = useState<DepositApplicationRecord[]>([]);
  const [projectId, setProjectId] = useState("");
  const [createdSessionId, setCreatedSessionId] = useState("");
  const [createdSessionAppointmentId, setCreatedSessionAppointmentId] = useState("");
  const [savedSessionLocked, setSavedSessionLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<DraftSessionRecord[]>([]);
  const [draftPayments, setDraftPayments] = useState<SessionPaymentRecord[]>([]);

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const context = await getOperationsContext();
      const [projectResult, appointmentResult, depositResult, applicationResult, draftResult] = await Promise.all([
        supabase
          .from("projects")
          .select(projectSelect)
          .in("status", ["booked", "in_progress", "on_hold"])
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status, session_completed_at")
          .order("starts_at", { ascending: false }),
        supabase
          .from("deposits")
          .select(
            "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, disposition, used_at, used_session_entry_id, memo",
          )
          .order("received_at", { ascending: true }),
        supabase
          .from("deposit_applications")
          .select("id, deposit_id, session_entry_id, amount, applied_at, memo"),
        supabase
          .from("session_entries")
          .select("id, appointment_id, project_id, artist_id, entered_at, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo, draft_deposit_applied_amount, updated_at")
          .eq("record_status", "draft")
          .order("entered_at", { ascending: false }),
      ]);

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

      if (draftResult.error) {
        setError(draftResult.error.message);
        setLoading(false);
        return;
      }

      const rawProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];
      const visibleProjects =
        context?.isArtist && context.staffId
          ? rawProjects.filter((project) => project.artist_id === context.staffId)
          : rawProjects;

      setProjects(visibleProjects);
      setProjectId(visibleProjects[0]?.id ?? "");
      setAppointments((appointmentResult.data ?? []) as AppointmentRecord[]);
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setDepositApplications((applicationResult.data ?? []) as DepositApplicationRecord[]);
      const visibleDrafts = (draftResult.data ?? []) as DraftSessionRecord[];
      setDrafts(visibleDrafts);
      if (visibleDrafts.length > 0) {
        const paymentResult = await supabase
          .from("session_payments")
          .select("id, session_entry_id, payment_type, payment_method, amount, memo, app_provider, processed_at")
          .in("session_entry_id", visibleDrafts.map((draft) => draft.id));
        if (paymentResult.error) {
          setError(paymentResult.error.message);
          setLoading(false);
          return;
        }
        setDraftPayments((paymentResult.data ?? []) as SessionPaymentRecord[]);
      }
      setLoading(false);
    }

    load();
  }, []);

  async function saveSession(form: SessionForm, targetStatus: "draft" | "complete" = "complete") {
    const project = selectedProject;
    const existingSessionId = createdSessionId;
    const appointmentId = form.appointmentId || createdSessionAppointmentId;
    const appointment = selectedAppointments.find((item) => item.id === appointmentId);
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
        appProvider: line.appProvider,
        paymentMethod: line.paymentMethod,
        paymentType: line.paymentType ?? "tattoo",
        processedAt: line.processedAt,
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

    setError("");
    setMessage("");
    setSavedSessionLocked(false);

    if (!project) {
      setError("Select a project.");
      return;
    }

    if (targetStatus === "complete" && !appointment && (!startsAt || !endsAt || endsDate <= startsDate)) {
      setError("Manual sessions need a valid start and end time.");
      return;
    }

    if (
      !Number.isFinite(tattooAmount) ||
      !Number.isFinite(tipAmount) ||
      !Number.isFinite(depositAppliedAmount) ||
      form.paymentLines.some((line) => !Number.isFinite(Number(line.amount || 0)))
    ) {
      setError("Amounts must be valid numbers.");
      return;
    }

    if (targetStatus === "complete" && tattooAmount <= 0 && tipAmount <= 0) {
      setError("Enter a tattoo amount or a tip amount.");
      return;
    }

    if (targetStatus === "complete" && depositAppliedAmount > availableDepositForSession) {
      setError(`Applied deposit cannot exceed available balance ${money(availableDepositForSession)}.`);
      return;
    }

    if (targetStatus === "complete" && depositAppliedAmount > tattooAmount) {
      setError("Applied deposit cannot exceed tattoo amount.");
      return;
    }

    if (targetStatus === "complete" && Math.abs(tattooAmount - depositAppliedAmount - tattooPaymentTotal) >= 0.01) {
      setError("Tattoo payments must equal tattoo total minus applied deposit.");
      return;
    }

    if (targetStatus === "complete" && Math.abs(tipAmount - tipPaymentTotal) >= 0.01) {
      setError("Tip payments must equal tip total.");
      return;
    }

    setSaving(true);

    const user = await getSafeUser();

    if (targetStatus === "draft") {
      const draftPayload = {
        appointment_id: appointment?.id ?? null,
        artist_id: appointment?.artist_id ?? project.artist_id,
        customer_id: project.customer_id,
        entered_at: appointment?.starts_at ?? startsDate.toISOString(),
        entry_type: "session" as const,
        draft_deposit_applied_amount: depositAppliedAmount,
        memo: form.memo.trim() || null,
        project_id: project.id,
        record_status: "draft" as const,
        tattoo_amount: tattooAmount,
        tattoo_payment_method: paymentLines.find((line) => line.paymentType === "tattoo")?.paymentMethod ?? null,
        tip_amount: tipAmount,
        tip_payment_method: paymentLines.find((line) => line.paymentType === "tip")?.paymentMethod ?? null,
      };
      const draftResult = existingSessionId
        ? await supabase.from("session_entries").update(draftPayload).eq("id", existingSessionId).select("id, appointment_id, project_id, artist_id, entered_at, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo, draft_deposit_applied_amount, updated_at").single()
        : await supabase.from("session_entries").insert({ ...draftPayload, created_by: user?.id ?? null }).select("id, appointment_id, project_id, artist_id, entered_at, tattoo_amount, tattoo_payment_method, tip_amount, tip_payment_method, memo, draft_deposit_applied_amount, updated_at").single();

      if (draftResult.error) {
        setError(draftResult.error.message);
        setSaving(false);
        return;
      }
      if (existingSessionId) {
        const deleteResult = await supabase.from("session_payments").delete().eq("session_entry_id", existingSessionId);
        if (deleteResult.error) {
          setError(deleteResult.error.message);
          setSaving(false);
          return;
        }
      }
      let savedPayments: SessionPaymentRecord[] = [];
      if (paymentLines.length > 0) {
        const paymentResult = await supabase.from("session_payments").insert(paymentLines.map((line) => ({
          amount: line.amount,
          created_by: user?.id ?? null,
          payment_method: line.paymentMethod,
          payment_type: line.paymentType,
          app_provider: line.appProvider,
          processed_at: new Date(line.processedAt).toISOString(),
          session_entry_id: draftResult.data.id,
        }))).select("id, session_entry_id, payment_type, payment_method, amount, memo, app_provider, processed_at");
        if (paymentResult.error) {
          setError(paymentResult.error.message);
          setSaving(false);
          return;
        }
        savedPayments = (paymentResult.data ?? []) as SessionPaymentRecord[];
      }
      setDrafts((current) => [draftResult.data as DraftSessionRecord, ...current.filter((draft) => draft.id !== draftResult.data.id)]);
      setDraftPayments((current) => [...savedPayments, ...current.filter((payment) => payment.session_entry_id !== draftResult.data.id)]);
      setCreatedSessionId(draftResult.data.id);
      setSavedSessionLocked(true);
      setMessage("Draft saved. Complete it before the end of the business day.");
      setSaving(false);
      return;
    }

    let sessionAppointment = appointment;

    if (!sessionAppointment) {
      const sessionCompletedAt = new Date().toISOString();
      const appointmentResult = await supabase
        .from("appointments")
        .insert({
          artist_id: project.artist_id,
          customer_id: project.customer_id,
          ends_at: endsDate.toISOString(),
          notes: "Created from manual session entry.",
          appointment_type: "walk-in",
          project_id: project.id,
          starts_at: startsDate.toISOString(),
          status: "completed",
          session_completed_at: sessionCompletedAt,
        })
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status, session_completed_at")
        .single();

      if (appointmentResult.error) {
        setError(appointmentResult.error.message);
        setSaving(false);
        return;
      }

      sessionAppointment = appointmentResult.data as AppointmentRecord;
      setAppointments((current) => [sessionAppointment!, ...current]);
    }

    if (existingSessionId && sessionAppointment) {
      const appointmentResult = await supabase
        .from("appointments")
        .update({
          ends_at: endsDate.toISOString(),
          starts_at: startsDate.toISOString(),
        })
        .eq("id", sessionAppointment.id)
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status, session_completed_at")
        .single();

      if (appointmentResult.error) {
        setError(appointmentResult.error.message);
        setSaving(false);
        return;
      }

      sessionAppointment = appointmentResult.data as AppointmentRecord;
      setAppointments((current) =>
        current.map((item) => (item.id === sessionAppointment!.id ? sessionAppointment! : item)),
      );
    }

    if (!sessionAppointment.session_completed_at) {
      const completionResult = await supabase
        .from("appointments")
        .update({ session_completed_at: new Date().toISOString() })
        .eq("id", sessionAppointment.id)
        .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status, session_completed_at")
        .single();

      if (completionResult.error) {
        setError(completionResult.error.message);
        setSaving(false);
        return;
      }

      sessionAppointment = completionResult.data as AppointmentRecord;
      setAppointments((current) =>
        current.map((item) => (item.id === sessionAppointment!.id ? sessionAppointment! : item)),
      );
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
      record_status: existingSessionId ? "complete" as const : "draft" as const,
      draft_deposit_applied_amount: 0,
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

    if (sessionResult.error) {
      setError(sessionResult.error.message);
      setSaving(false);
      return;
    }

    if (existingSessionId) {
      const deletePaymentsResult = await supabase
        .from("session_payments")
        .delete()
        .eq("session_entry_id", existingSessionId);

      if (deletePaymentsResult.error) {
        setError(deletePaymentsResult.error.message);
        setSaving(false);
        return;
      }
    }

    if (paymentLines.length > 0) {
      const paymentResult = await supabase.from("session_payments").insert(
        paymentLines.map((line) => ({
          amount: line.amount,
          created_by: user?.id ?? null,
          payment_method: line.paymentMethod,
          payment_type: line.paymentType,
          app_provider: line.appProvider,
          processed_at: new Date(line.processedAt).toISOString(),
          session_entry_id: sessionResult.data.id,
        })),
      );

      if (paymentResult.error) {
        setError(`${paymentResult.error.message}. Run docs/supabase_session_payments.sql in Supabase SQL Editor.`);
        setSaving(false);
        return;
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

      if (deleteApplicationResult.error) {
        setError(deleteApplicationResult.error.message);
        setSaving(false);
        return;
      }
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
        setError("Not enough available deposit balance.");
        setSaving(false);
        return;
      }

      const applicationResult = await supabase
        .from("deposit_applications")
        .insert(applicationRows)
        .select("id, deposit_id, session_entry_id, amount, applied_at, memo");

      if (applicationResult.error) {
        setError(`${applicationResult.error.message}. Run docs/supabase_deposit_applications.sql in Supabase SQL Editor.`);
        setSaving(false);
        return;
      }

      nextDepositApplications = [
        ...((applicationResult.data ?? []) as DepositApplicationRecord[]),
        ...nextDepositApplications,
      ];
    }

    for (const depositId of affectedDepositIds) {
      const deposit = selectedDeposits.find((item) => item.id === depositId);

      if (!deposit) continue;

      const remaining = depositRemaining(deposit, [
        ...nextDepositApplications,
      ]);
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: remaining > 0,
          disposition: remaining > 0 ? "available" : "applied",
          used_at: remaining > 0 ? null : new Date().toISOString(),
          used_session_entry_id: remaining > 0 ? null : sessionResult.data.id,
        })
        .eq("id", depositId);

      if (depositResult.error) {
        setError(depositResult.error.message);
        setSaving(false);
        return;
      }
    }

    const completionResult = await supabase
      .from("session_entries")
      .update({ record_status: "complete" })
      .eq("id", sessionResult.data.id);
    if (completionResult.error) {
      setError(completionResult.error.message);
      setSaving(false);
      return;
    }

    await supabase.from("projects").update({ status: "in_progress" }).eq("id", project.id);

    setDepositApplications(nextDepositApplications);
    setCreatedSessionId(sessionResult.data.id);
    setCreatedSessionAppointmentId(sessionAppointment.id);
    setSavedSessionLocked(true);
    setMessage(existingSessionId ? "Session entry updated." : "Session entry saved.");
    setDrafts((current) => current.filter((draft) => draft.id !== sessionResult.data.id));
    setDraftPayments((current) => current.filter((payment) => payment.session_entry_id !== sessionResult.data.id));
    setSaving(false);
  }

  return (
    <AppPage
      actions={
        <Link
          className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
          href="/projects"
        >
          Project list
        </Link>
      }
      eyebrow="Projects"
      title="New session"
    >
      {drafts.length > 0 ? (
        <section className="mx-auto mb-5 max-w-4xl rounded-md border border-[#d6a85f] bg-[#fff8e8] px-5 py-4">
          <h2 className="font-semibold">Drafts due by end of business day ({drafts.length})</h2>
          <p className="mt-1 text-sm text-[#6f5833]">Drafts are visible to the assigned Artist and Owner, but are excluded from reconciliation and payout.</p>
          <div className="mt-3 space-y-2">
            {drafts.map((draft) => {
              const draftProject = projects.find((project) => project.id === draft.project_id);
              return (
                <div className="flex items-center justify-between gap-3 rounded-md border border-[#ead2a7] bg-white px-3 py-3" key={draft.id}>
                  <div>
                    <p className="text-sm font-semibold">{draftProject ? projectLabel(draftProject) : "Session draft"}</p>
                    <p className="mt-1 text-xs text-[#697178]">Saved {new Date(draft.updated_at).toLocaleString()}</p>
                  </div>
                  <button
                    className="rounded-md border border-[#cfc7b8] px-3 py-2 text-sm font-semibold hover:bg-[#eee8dd]"
                    onClick={() => {
                      setProjectId(draft.project_id ?? "");
                      setCreatedSessionId(draft.id);
                      setCreatedSessionAppointmentId(draft.appointment_id ?? "");
                      setSavedSessionLocked(false);
                      setMessage("");
                      setError("");
                    }}
                    type="button"
                  >
                    Continue
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      <section className="mx-auto max-w-4xl rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-4">
          <h3 className="text-lg font-semibold">Session entry</h3>
        </div>
        <div className="space-y-5 px-5 py-5">
          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-3 py-2 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
            <div className="grid gap-3">
              <label className="block text-sm font-semibold">
                Project <span className="text-[#8a3030]">*</span>
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  disabled={loading || saving}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setCreatedSessionId("");
                    setCreatedSessionAppointmentId("");
                    setSavedSessionLocked(false);
                    setError("");
                    setMessage("");
                  }}
                  required
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
            </div>
          </section>

          {selectedProject ? (
            <SessionEntryForm
              key={createdSessionId || projectId}
              appointments={selectedAppointments}
              availableDepositBalance={availableDeposit}
              defaultDurationMinutes={
                relatedOne(selectedProject.artist)?.default_session_duration_minutes ?? 120
              }
              depositApplications={selectedDepositApplications}
              error={error}
              onEdit={() => {
                setSavedSessionLocked(false);
                setMessage("");
              }}
              onNextAppointment={() => {
                window.location.href = `/calendar?projectId=${selectedProject.id}`;
              }}
              onSave={(form) => saveSession(form, "complete")}
              onSaveDraft={(form) => saveSession(form, "draft")}
              saved={savedSessionLocked}
              saving={saving}
              session={drafts.find((draft) => draft.id === createdSessionId) ?? null}
              sessionPayments={draftPayments}
              submitLabel={createdSessionId ? "Update record" : "Complete Session Record"}
            />
          ) : (
            <p className="rounded-md border border-dashed border-[#d9d3c7] px-3 py-6 text-sm font-semibold text-[#697178]">
              Select a project to enter a session.
            </p>
          )}
        </div>
      </section>
    </AppPage>
  );
}

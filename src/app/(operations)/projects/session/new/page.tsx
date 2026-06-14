"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage } from "@/components/app-shell";
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

const projectSelect =
  "id, customer_id, artist_id, subject, size, status, customer:customers(name, email, phone), artist:staff(display_name)";

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function localDateTimeInput(value = new Date()) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
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
  return Math.max(Number(deposit.amount) - depositAppliedTotal(deposit.id, applications), 0);
}

function projectLabel(project: ProjectRecord) {
  const customer = relatedOne(project.customer);
  return `${project.subject} / ${customer?.name ?? "No client"}`;
}

export default function NewSessionPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [depositApplications, setDepositApplications] = useState<DepositApplicationRecord[]>([]);
  const [projectId, setProjectId] = useState("");
  const [startsAt, setStartsAt] = useState(() => localDateTimeInput());
  const [endsAt, setEndsAt] = useState(() => localDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [tattooAmount, setTattooAmount] = useState("");
  const [depositAppliedAmount, setDepositAppliedAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [tipPaymentMethod, setTipPaymentMethod] = useState("cash");
  const [memo, setMemo] = useState("");
  const [createdSessionId, setCreatedSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
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
  const requiredMark = <span className="text-[#8a3030]">*</span>;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const context = await getOperationsContext();
      const [projectResult, depositResult, applicationResult] = await Promise.all([
        supabase
          .from("projects")
          .select(projectSelect)
          .in("status", ["booked", "in_progress", "on_hold"])
          .order("created_at", { ascending: false }),
        supabase
          .from("deposits")
          .select(
            "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, used_at, used_session_entry_id, memo",
          )
          .order("received_at", { ascending: true }),
        supabase
          .from("deposit_applications")
          .select("id, deposit_id, session_entry_id, amount, applied_at, memo"),
      ]);

      if (projectResult.error) {
        setError(projectResult.error.message);
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

      const rawProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];
      const visibleProjects =
        context?.isArtist && context.staffId
          ? rawProjects.filter((project) => project.artist_id === context.staffId)
          : rawProjects;

      setProjects(visibleProjects);
      setProjectId(visibleProjects[0]?.id ?? "");
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setDepositApplications((applicationResult.data ?? []) as DepositApplicationRecord[]);
      setLoading(false);
    }

    load();
  }, []);

  async function saveSession() {
    const project = selectedProject;
    const startsDate = new Date(startsAt);
    const endsDate = new Date(endsAt);
    const tattoo = Number(tattooAmount || 0);
    const depositApplied = Number(depositAppliedAmount || 0);
    const paid = Number(paymentAmount || 0);
    const tip = Number(tipAmount || 0);

    setError("");
    setMessage("");
    setCreatedSessionId("");

    if (!project) {
      setError("Select a project.");
      return;
    }

    if (!startsAt || !endsAt || endsDate <= startsDate) {
      setError("Enter a valid session start and end time.");
      return;
    }

    if (![tattoo, depositApplied, paid, tip].every(Number.isFinite)) {
      setError("Amounts must be valid numbers.");
      return;
    }

    if (tattoo <= 0 && tip <= 0) {
      setError("Enter a tattoo amount or a tip amount.");
      return;
    }

    if (depositApplied > availableDeposit) {
      setError(`Applied deposit cannot exceed available balance ${money(availableDeposit)}.`);
      return;
    }

    if (depositApplied > tattoo) {
      setError("Applied deposit cannot exceed tattoo amount.");
      return;
    }

    if (Math.abs(tattoo - depositApplied - paid) >= 0.01) {
      setError("Payment amount must equal tattoo amount minus applied deposit.");
      return;
    }

    setSaving(true);

    const user = await getSafeUser();
    const appointmentResult = await supabase
      .from("appointments")
      .insert({
        artist_id: project.artist_id,
        customer_id: project.customer_id,
        ends_at: endsDate.toISOString(),
        notes: "Created from new session entry.",
        appointment_type: "completed session",
        project_id: project.id,
        starts_at: startsDate.toISOString(),
        status: "completed",
      })
      .select("id")
      .single();

    if (appointmentResult.error) {
      setError(appointmentResult.error.message);
      setSaving(false);
      return;
    }

    const sessionResult = await supabase
      .from("session_entries")
      .insert({
        appointment_id: appointmentResult.data.id,
        artist_id: project.artist_id,
        created_by: user?.id ?? null,
        customer_id: project.customer_id,
        entered_at: startsDate.toISOString(),
        entry_type: "session",
        memo: memo.trim() || null,
        project_id: project.id,
        tattoo_amount: tattoo,
        tattoo_payment_method: paid > 0 ? paymentMethod : null,
        tip_amount: tip,
        tip_payment_method: tip > 0 ? tipPaymentMethod : null,
      })
      .select("id")
      .single();

    if (sessionResult.error) {
      setError(sessionResult.error.message);
      setSaving(false);
      return;
    }

    if (paid > 0) {
      const paymentResult = await supabase.from("session_payments").insert({
        amount: paid,
        created_by: user?.id ?? null,
        payment_method: paymentMethod,
        session_entry_id: sessionResult.data.id,
      });

      if (paymentResult.error) {
        setError(`${paymentResult.error.message}. Run docs/supabase_session_payments.sql in Supabase SQL Editor.`);
        setSaving(false);
        return;
      }
    }

    const affectedDepositIds = new Set<string>();
    const addedApplicationsForRemaining: DepositApplicationRecord[] = [];

    if (depositApplied > 0) {
      let remainingToApply = depositApplied;
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

        const available = depositRemaining(deposit, depositApplications);
        const amount = Math.min(available, remainingToApply);

        if (amount <= 0) continue;

        applicationRows.push({
          amount,
          created_by: user?.id ?? null,
          deposit_id: deposit.id,
          memo: memo.trim() || null,
          session_entry_id: sessionResult.data.id,
        });
        addedApplicationsForRemaining.push({
          amount,
          applied_at: new Date().toISOString(),
          deposit_id: deposit.id,
          id: crypto.randomUUID(),
          memo: memo.trim() || null,
          session_entry_id: sessionResult.data.id,
        });
        affectedDepositIds.add(deposit.id);
        remainingToApply -= amount;
      }

      const applicationResult = await supabase.from("deposit_applications").insert(applicationRows);

      if (applicationResult.error) {
        setError(`${applicationResult.error.message}. Run docs/supabase_deposit_applications.sql in Supabase SQL Editor.`);
        setSaving(false);
        return;
      }
    }

    for (const depositId of affectedDepositIds) {
      const deposit = selectedDeposits.find((item) => item.id === depositId);

      if (!deposit) continue;

      const currentApplications = [...depositApplications, ...addedApplicationsForRemaining];
      const remaining = depositRemaining(deposit, currentApplications);
      const depositResult = await supabase
        .from("deposits")
        .update({
          available: remaining > 0,
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

    await supabase.from("projects").update({ status: "in_progress" }).eq("id", project.id);

    setCreatedSessionId(sessionResult.data.id);
    setMessage("Session entry saved.");
    setTattooAmount("");
    setDepositAppliedAmount("");
    setPaymentAmount("");
    setTipAmount("");
    setMemo("");
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
      <section className="mx-auto max-w-4xl rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-5 py-4">
          <h3 className="text-lg font-semibold">Session entry</h3>
        </div>
        <div className="space-y-5 px-5 py-5">
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

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
            <h4 className="text-sm font-semibold text-[#6f7275]">Project</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
              <label className="block text-sm font-semibold">
                Project {requiredMark}
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  disabled={loading}
                  onChange={(event) => setProjectId(event.target.value)}
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
              <div className="rounded-md bg-white px-3 py-3 text-sm">
                <p className="text-[#697178]">Available deposit</p>
                <p className="mt-1 font-semibold">{money(availableDeposit)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
            <h4 className="text-sm font-semibold text-[#6f7275]">Session time</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Start {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                  type="datetime-local"
                  value={startsAt}
                />
              </label>
              <label className="block text-sm font-semibold">
                End {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setEndsAt(event.target.value)}
                  required
                  type="datetime-local"
                  value={endsAt}
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
            <h4 className="text-sm font-semibold text-[#6f7275]">Payment</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Tattoo amount
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  min="0"
                  onChange={(event) => setTattooAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={tattooAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Apply deposit
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  max={availableDeposit}
                  min="0"
                  onChange={(event) => setDepositAppliedAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={depositAppliedAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Remaining payment
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  min="0"
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={paymentAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Payment method
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  value={paymentMethod}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Tip amount
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  min="0"
                  onChange={(event) => setTipAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={tipAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Tip payment
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => setTipPaymentMethod(event.target.value)}
                  value={tipPaymentMethod}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className="min-h-24 rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm lg:col-span-3"
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Memo"
                value={memo}
              />
            </div>
          </section>

          <button
            className="h-11 w-full rounded-md bg-[#1f2428] px-4 text-sm font-bold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || loading || Boolean(createdSessionId)}
            onClick={saveSession}
            type="button"
          >
            {saving ? "Saving..." : createdSessionId ? "Session saved" : "Save session"}
          </button>
        </div>
      </section>
    </AppPage>
  );
}

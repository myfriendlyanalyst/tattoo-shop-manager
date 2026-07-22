"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppPage } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type Relation<T> = T | T[] | null;

type SessionResultRecord = {
  id: string;
  created_by: string | null;
  entered_at: string;
  tattoo_amount: number | null;
  tip_amount: number | null;
  memo: string | null;
  appointment: Relation<{
    id: string;
    starts_at: string;
    ends_at: string | null;
    appointment_type: string;
  }>;
  project: Relation<{
    id: string;
    subject: string;
    session_type: string | null;
    customer: Relation<{ name: string; email: string | null; phone: string | null }>;
    artist: Relation<{ display_name: string }>;
  }>;
};

type PaymentRecord = {
  id: string;
  payment_type: "tattoo" | "tip" | null;
  payment_method: string;
  amount: number;
};

function relatedOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value ?? 0);
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function paymentLabel(value: string) {
  return value === "credit_card" ? "Card" : value === "app" ? "App" : value === "cash" ? "Cash" : value;
}

export default function SessionResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const [session, setSession] = useState<SessionResultRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [depositApplied, setDepositApplied] = useState(0);
  const [enteredBy, setEnteredBy] = useState("-");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const [sessionResult, paymentResult, depositResult] = await Promise.all([
        supabase
          .from("session_entries")
          .select(
            "id, created_by, entered_at, tattoo_amount, tip_amount, memo, appointment:appointments(id, starts_at, ends_at, appointment_type), project:projects(id, subject, session_type, customer:customers(name, email, phone), artist:staff(display_name))",
          )
          .eq("id", sessionId)
          .single(),
        supabase
          .from("session_payments")
          .select("id, payment_type, payment_method, amount")
          .eq("session_entry_id", sessionId),
        supabase
          .from("deposit_applications")
          .select("amount")
          .eq("session_entry_id", sessionId),
      ]);

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setLoading(false);
        return;
      }
      if (paymentResult.error) {
        setError(paymentResult.error.message);
        setLoading(false);
        return;
      }
      if (depositResult.error) {
        setError(depositResult.error.message);
        setLoading(false);
        return;
      }

      const nextSession = sessionResult.data as unknown as SessionResultRecord;
      setSession(nextSession);
      setPayments((paymentResult.data ?? []) as PaymentRecord[]);
      setDepositApplied(
        (depositResult.data ?? []).reduce((sum, application) => sum + Number(application.amount), 0),
      );

      if (nextSession.created_by) {
        const staffResult = await supabase
          .from("staff")
          .select("display_name")
          .eq("profile_id", nextSession.created_by)
          .maybeSingle();
        if (!staffResult.error && staffResult.data?.display_name) {
          setEnteredBy(staffResult.data.display_name);
        }
      }
      setLoading(false);
    }

    load();
  }, [sessionId]);

  const project = relatedOne(session?.project ?? null);
  const appointment = relatedOne(session?.appointment ?? null);
  const customer = relatedOne(project?.customer ?? null);
  const artist = relatedOne(project?.artist ?? null);
  const paymentTotal = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    [payments],
  );

  async function deleteSession() {
    if (!session || !window.confirm("Delete this session?")) return;
    setDeleting(true);
    setError("");

    const applicationResult = await supabase
      .from("deposit_applications")
      .select("deposit_id")
      .eq("session_entry_id", session.id);
    if (applicationResult.error) {
      setError(applicationResult.error.message);
      setDeleting(false);
      return;
    }

    await supabase.from("deposit_applications").delete().eq("session_entry_id", session.id);
    await supabase.from("session_payments").delete().eq("session_entry_id", session.id);
    const sessionDelete = await supabase.from("session_entries").delete().eq("id", session.id);
    if (sessionDelete.error) {
      setError(sessionDelete.error.message);
      setDeleting(false);
      return;
    }

    for (const row of applicationResult.data ?? []) {
      await supabase
        .from("deposits")
        .update({ available: true, disposition: "available", used_at: null, used_session_entry_id: null })
        .eq("id", row.deposit_id);
    }

    if (project?.session_type === "Walk-in" && appointment) {
      await supabase.from("appointments").delete().eq("id", appointment.id);
      await supabase.from("projects").delete().eq("id", project.id);
    }

    window.sessionStorage.removeItem(`session-wizard-${session.id}`);
    router.push("/projects/session/wizard");
  }

  return (
    <AppPage eyebrow="Projects" title="Session result">
      <style jsx global>{`
        @media print {
          @page {
            size: 72mm 210mm;
            margin: 4mm;
          }

          html,
          body {
            width: 72mm !important;
            background: white !important;
            color: #000 !important;
            font-size: 10px !important;
          }

          aside,
          header,
          .print\\:hidden {
            display: none !important;
          }

          main,
          main > div {
            display: block !important;
            width: 64mm !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .receipt-sheet {
            width: 64mm !important;
            max-width: 64mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }

          .receipt-header {
            padding-bottom: 3mm !important;
            border-bottom: 1px solid #000 !important;
          }

          .receipt-header h2 {
            margin-top: 1mm !important;
            font-size: 13px !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-info-grid {
            display: block !important;
            margin-top: 3mm !important;
          }

          .receipt-box {
            margin-top: 2mm !important;
            padding: 0 0 2mm 0 !important;
            border-bottom: 1px dashed #999 !important;
            border-radius: 0 !important;
            background: white !important;
            page-break-inside: avoid !important;
          }

          .receipt-box p {
            overflow-wrap: anywhere !important;
          }

          .receipt-lines {
            margin-top: 3mm !important;
            border: 0 !important;
            border-radius: 0 !important;
          }

          .receipt-line {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 2mm !important;
            padding: 1.5mm 0 !important;
            border-bottom: 1px dashed #999 !important;
            font-size: 10px !important;
          }

          .receipt-total {
            padding-top: 2mm !important;
            border-top: 1px solid #000 !important;
            border-bottom: 0 !important;
            background: white !important;
            font-size: 11px !important;
          }

          .receipt-memo {
            margin-top: 3mm !important;
            padding: 2mm 0 0 0 !important;
            border: 0 !important;
            border-top: 1px dashed #999 !important;
            border-radius: 0 !important;
            overflow-wrap: anywhere !important;
          }
        }
      `}</style>
      <section className="receipt-sheet mx-auto max-w-3xl rounded-md border border-[#d9d3c7] bg-white px-6 py-6 shadow-sm print:border-0 print:shadow-none">
        {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
        {error ? <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">{error}</p> : null}

        {session ? (
          <>
            <div className="receipt-header border-b border-[#d9d3c7] pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#476b33]">Saved session</p>
              <h2 className="mt-2 text-2xl font-semibold">{project?.subject ?? "Session"}</h2>
              <p className="mt-2 text-sm font-medium text-[#697178]">Entered {displayDateTime(session.entered_at)} by {enteredBy}</p>
            </div>

            <div className="receipt-info-grid mt-5 grid gap-3 sm:grid-cols-2">
              <div className="receipt-box rounded-md bg-[#f7f2e9] px-4 py-4">
                <p className="text-xs font-bold uppercase text-[#697178]">Client</p>
                <p className="mt-1 font-semibold">{customer?.name ?? "-"}</p>
                <p className="mt-1 text-sm text-[#697178]">{customer?.email ?? "-"} / {customer?.phone ?? "-"}</p>
              </div>
              <div className="receipt-box rounded-md bg-[#f7f2e9] px-4 py-4">
                <p className="text-xs font-bold uppercase text-[#697178]">Artist</p>
                <p className="mt-1 font-semibold">{artist?.display_name ?? "-"}</p>
              </div>
              <div className="receipt-box rounded-md bg-[#f7f2e9] px-4 py-4 sm:col-span-2">
                <p className="text-xs font-bold uppercase text-[#697178]">Appointment</p>
                <p className="mt-1 font-semibold">{displayDateTime(appointment?.starts_at)}</p>
              </div>
            </div>

            <div className="receipt-lines mt-5 overflow-hidden rounded-md border border-[#d9d3c7]">
              {payments.map((payment) => (
                <div className="receipt-line grid grid-cols-[1fr_auto] border-b border-[#eee8dd] px-4 py-3 text-sm last:border-b-0" key={payment.id}>
                  <span className="font-semibold capitalize">{payment.payment_type ?? "tattoo"} / {paymentLabel(payment.payment_method)}</span>
                  <span className="font-bold">{money(payment.amount)}</span>
                </div>
              ))}
              {depositApplied > 0 ? (
                <div className="receipt-line grid grid-cols-[1fr_auto] border-b border-[#eee8dd] px-4 py-3 text-sm">
                  <span className="font-semibold">Deposit applied</span>
                  <span className="font-bold">{money(depositApplied)}</span>
                </div>
              ) : null}
              <div className="receipt-line receipt-total grid grid-cols-[1fr_auto] bg-[#f7f2e9] px-4 py-4">
                <span className="font-bold">Recorded total</span>
                <span className="text-lg font-bold">{money(paymentTotal + depositApplied)}</span>
              </div>
            </div>

            {session.memo ? <p className="receipt-memo mt-4 rounded-md border border-[#d9d3c7] px-4 py-3 text-sm">{session.memo}</p> : null}

            <div className="mt-6 flex flex-wrap gap-2 print:hidden">
              <button className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white" onClick={() => window.print()} type="button">Print</button>
              <Link className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" href={`/projects/session/wizard?editSessionId=${session.id}`}>Edit</Link>
              <button className="h-10 rounded-md border border-[#8a3030] px-4 text-sm font-semibold text-[#8a3030] disabled:opacity-60" disabled={deleting} onClick={deleteSession} type="button">{deleting ? "Deleting..." : "Delete"}</button>
              <Link className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" href="/projects/session/wizard">Next session</Link>
            </div>
          </>
        ) : null}
      </section>
    </AppPage>
  );
}

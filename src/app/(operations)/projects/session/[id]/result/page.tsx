"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

function receiptMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
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

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placementLabel(projectSubject: string | null | undefined, customerName: string | null | undefined) {
  if (!projectSubject) return "-";

  const afterDash = projectSubject.includes(" - ")
    ? projectSubject.split(" - ").slice(1).join(" - ")
    : projectSubject;
  const withoutClient = customerName
    ? afterDash.replace(new RegExp(`^${escapeRegExp(customerName)}\\s*-\\s*`, "i"), "")
    : afterDash;

  return titleCase(withoutClient.trim() || projectSubject);
}

export default function SessionResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReprint = searchParams.get("reprint") === "1";
  const returnHref = searchParams.get("from") === "accounting" ? "/accounting/transactions" : "/projects";
  const sessionId = params.id;
  const [session, setSession] = useState<SessionResultRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [depositApplied, setDepositApplied] = useState(0);
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
  const cashToDrop = useMemo(
    () => payments.filter((payment) => payment.payment_method === "cash").reduce((sum, payment) => sum + Number(payment.amount), 0),
    [payments],
  );
  const receivedByType = useMemo(() => {
    const totals: Record<"tattoo" | "tip", Record<string, number>> = {
      tattoo: { app: 0, cash: 0, credit_card: 0 },
      tip: { app: 0, cash: 0, credit_card: 0 },
    };
    for (const payment of payments) {
      const type = payment.payment_type === "tip" ? "tip" : "tattoo";
      totals[type][payment.payment_method] =
        (totals[type][payment.payment_method] ?? 0) + Number(payment.amount);
    }
    return totals;
  }, [payments]);
  const artistName = artist?.display_name ?? "-";
  const customerName = customer?.name ?? "-";
  const contactLine = [customer?.email, customer?.phone].filter(Boolean).join(" / ");
  const placement = placementLabel(project?.subject, customer?.name ?? null);
  const sessionType = appointment?.appointment_type || project?.session_type || "Session";

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
        @media screen {
          .receipt-sheet {
            box-sizing: border-box;
            width: 64mm;
            max-width: 64mm;
            padding: 4mm;
            border: 0.7mm solid #000;
            font-size: 10px;
            line-height: 1.15;
          }

          .receipt-header {
            padding-bottom: 3mm !important;
            border-bottom: 0.5mm solid #176783 !important;
          }

          .receipt-artist {
            margin-top: 3mm !important;
            font-size: 13mm !important;
            line-height: 0.9 !important;
            letter-spacing: 0 !important;
          }

          .receipt-entered {
            margin-top: 3mm !important;
            font-size: 3mm !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
          }

          .receipt-section {
            padding: 2.5mm 0 !important;
            border-bottom: 0.45mm dashed #176783 !important;
          }

          .receipt-label {
            font-size: 3.4mm !important;
            line-height: 1 !important;
            letter-spacing: 0 !important;
          }

          .receipt-value {
            margin-top: 1.5mm !important;
            font-size: 6mm !important;
            line-height: 1.05 !important;
            letter-spacing: 0 !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-contact {
            margin-top: 1.5mm !important;
            font-size: 3.2mm !important;
            line-height: 1.15 !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-payments {
            padding-top: 4mm !important;
          }

          .receipt-group-title {
            margin-bottom: 1mm !important;
            font-size: 2.8mm !important;
            font-weight: 900 !important;
            letter-spacing: 0.08em !important;
          }

          .receipt-payment-group + .receipt-payment-group {
            margin-top: 3mm !important;
            padding-top: 3mm !important;
            border-top: 0.45mm dashed #176783 !important;
          }

          .receipt-payment-type {
            margin: 2mm 0 0.5mm !important;
            font-size: 3.6mm !important;
            font-weight: 900 !important;
          }

          .receipt-payment-type-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: baseline !important;
            gap: 1mm !important;
          }

          .receipt-payment-line {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 1mm !important;
            align-items: baseline !important;
            padding: 1mm 0 !important;
            border-bottom: 0 !important;
          }

          .receipt-payment-label {
            font-size: 4.2mm !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          .receipt-payment-amount {
            font-size: 7.2mm !important;
            font-weight: 700 !important;
            line-height: 1 !important;
          }

          .receipt-total {
            margin-top: 2mm !important;
            padding-top: 2.5mm !important;
            border-top: 0.5mm solid #176783 !important;
          }

          .receipt-total .receipt-payment-label {
            font-size: 4.6mm !important;
          }

          .receipt-total .receipt-payment-amount {
            font-size: 6.5mm !important;
          }
        }

        @media print {
          @page {
            size: 72mm 210mm;
            margin: 4mm;
          }

          html,
          body {
            width: 72mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #000 !important;
            font-size: 10px !important;
          }

          body * {
            visibility: hidden !important;
          }

          .receipt-sheet,
          .receipt-sheet * {
            visibility: visible !important;
          }

          aside,
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }

          main,
          main > div,
          main > div > div {
            display: block !important;
            width: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .receipt-sheet {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            box-sizing: border-box !important;
            width: 64mm !important;
            max-width: 64mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: 0.7mm solid #000 !important;
            background: white !important;
            box-shadow: none !important;
            color: #000 !important;
            font-size: 10px !important;
            line-height: 1.15 !important;
            transform: none !important;
            zoom: 1 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .receipt-sheet .text-\\[\\#476b33\\],
          .receipt-sheet .text-\\[\\#697178\\],
          .receipt-sheet .text-\\[\\#1f2428\\] {
            color: #000 !important;
          }

          .receipt-header {
            padding-bottom: 3mm !important;
            border-bottom: 0.5mm solid #176783 !important;
          }

          .receipt-artist {
            margin-top: 3mm !important;
            font-size: 13mm !important;
            line-height: 0.9 !important;
            letter-spacing: 0 !important;
          }

          .receipt-entered {
            margin-top: 3mm !important;
            font-size: 3mm !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
          }

          .receipt-section {
            padding: 2.5mm 0 !important;
            border-bottom: 0.45mm dashed #176783 !important;
          }

          .receipt-label {
            font-size: 3.4mm !important;
            line-height: 1 !important;
            letter-spacing: 0 !important;
          }

          .receipt-value {
            margin-top: 1.5mm !important;
            font-size: 6mm !important;
            line-height: 1.05 !important;
            letter-spacing: 0 !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-contact {
            margin-top: 1.5mm !important;
            font-size: 3.2mm !important;
            line-height: 1.15 !important;
            overflow-wrap: anywhere !important;
          }

          .receipt-payments {
            padding-top: 4mm !important;
          }

          .receipt-group-title {
            margin-bottom: 1mm !important;
            font-size: 2.8mm !important;
            font-weight: 900 !important;
            letter-spacing: 0.08em !important;
          }

          .receipt-payment-group + .receipt-payment-group {
            margin-top: 3mm !important;
            padding-top: 3mm !important;
            border-top: 0.45mm dashed #176783 !important;
          }

          .receipt-payment-type {
            margin: 2mm 0 0.5mm !important;
            font-size: 3.6mm !important;
            font-weight: 900 !important;
          }

          .receipt-payment-type-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: baseline !important;
            gap: 1mm !important;
          }

          .receipt-payment-line {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 1mm !important;
            align-items: baseline !important;
            padding: 1mm 0 !important;
            border-bottom: 0 !important;
          }

          .receipt-payment-label {
            font-size: 4.2mm !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }

          .receipt-payment-amount {
            font-size: 7.2mm !important;
            font-weight: 700 !important;
            line-height: 1 !important;
          }

          .receipt-total {
            margin-top: 2mm !important;
            padding-top: 2.5mm !important;
            border-top: 0.5mm solid #176783 !important;
            border-bottom: 0 !important;
            background: white !important;
          }

          .receipt-total .receipt-payment-label {
            font-size: 4.6mm !important;
          }

          .receipt-total .receipt-payment-amount {
            font-size: 6.5mm !important;
          }
        }
      `}</style>
      <section className="receipt-sheet mx-auto w-full max-w-[620px] border-2 border-black bg-white px-6 py-6 shadow-sm print:shadow-none">
        {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
        {error ? <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">{error}</p> : null}

        {session ? (
          <>
            <div className="receipt-header border-b-2 border-[#176783] pb-4">
              {isReprint ? <p className="mb-2 text-center text-lg font-black tracking-[0.2em] text-black">REPRINT</p> : null}
              <p className="receipt-label text-sm font-bold uppercase tracking-[0.1em] text-black">Session completed by</p>
              <h2 className="receipt-artist mt-2 text-5xl font-black leading-none tracking-normal text-black">
                {artistName}
              </h2>
              <p className="receipt-entered mt-2 text-sm text-[#697178]">
                {isReprint ? "Originally entered" : "Entered"} {displayDateTime(session.entered_at)}
              </p>
            </div>

            <div className="receipt-section border-b-2 border-dashed border-[#176783] py-4">
              <p className="receipt-label text-lg uppercase text-black">Client</p>
              <p className="receipt-value mt-1 text-3xl font-black leading-tight text-black">{customerName}</p>
              {contactLine ? (
                <p className="receipt-contact mt-3 text-2xl text-[#176783]">{contactLine}</p>
              ) : null}
            </div>

            <div className="receipt-section border-b-2 border-dashed border-[#176783] py-4">
              <p className="receipt-label text-2xl text-black">Placement</p>
              <p className="receipt-value mt-1 text-3xl font-black leading-tight text-black">{placement}</p>
            </div>

            <div className="receipt-section border-b-2 border-dashed border-[#176783] py-4">
              <p className="receipt-label text-lg uppercase text-black">Session type</p>
              <p className="receipt-value mt-1 font-black text-black">{sessionType}</p>
              <p className="receipt-label mt-3 text-lg uppercase text-black">Appointment</p>
              <p className="receipt-payment-label mt-1 font-semibold leading-tight text-black">
                {displayDateTime(appointment?.starts_at)}
              </p>
            </div>

            <div className="receipt-payments pt-4">
              <div className="receipt-payment-group">
                <p className="receipt-group-title uppercase text-[#697178]">Received today</p>
                {(["tattoo", "tip"] as const).map((type) => (
                  <div key={type}>
                    <div className="receipt-payment-type-row">
                      <p className="receipt-payment-type capitalize text-black">{type}</p>
                      <p className="receipt-payment-type text-black">
                        {receiptMoney(Object.values(receivedByType[type]).reduce((sum, amount) => sum + amount, 0))}
                      </p>
                    </div>
                    {type === "tattoo" && depositApplied > 0 ? (
                      <div className="receipt-payment-line grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-2 text-[#697178]">
                        <span className="receipt-payment-label">Deposit applied</span>
                        <span className="receipt-payment-amount font-bold">{receiptMoney(depositApplied)}</span>
                      </div>
                    ) : null}
                    {(["cash", "credit_card", "app"] as const).filter((method) =>
                      receivedByType[type][method] > 0,
                    ).map((method) => (
                      <div className="receipt-payment-line grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-2" key={`${type}-${method}`}>
                        <span className="receipt-payment-label text-black">{paymentLabel(method)}</span>
                        <span className="receipt-payment-amount font-bold leading-none text-black">{receiptMoney(receivedByType[type][method])}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="receipt-payment-line grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-t border-[#176783] py-2">
                  <span className="receipt-payment-label text-black">Total received</span>
                  <span className="receipt-payment-amount font-bold text-black">{receiptMoney(paymentTotal)}</span>
                </div>
              </div>
              <div className="receipt-payment-line receipt-total mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-t-4 border-[#176783] pt-5">
                <span className="receipt-payment-label text-5xl text-black">Cash to drop</span>
                <span className="receipt-payment-amount text-7xl font-bold leading-none text-black">
                  {receiptMoney(cashToDrop)}
                </span>
              </div>
            </div>

            {session.memo ? <p className="mt-6 text-sm text-[#697178] print:hidden">{session.memo}</p> : null}

          </>
        ) : null}
      </section>
      {session ? (
        <div className="mx-auto mt-4 flex w-full max-w-[620px] flex-wrap justify-center gap-2 print:hidden">
          <button className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white" onClick={() => window.print()} type="button">Print</button>
          {isReprint ? <Link className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" href={returnHref}>Back</Link> : null}
          <Link className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" href={`/projects/session/wizard?editSessionId=${session.id}`}>Edit</Link>
          <button className="h-10 rounded-md border border-[#8a3030] px-4 text-sm font-semibold text-[#8a3030] disabled:opacity-60" disabled={deleting} onClick={deleteSession} type="button">{deleting ? "Deleting..." : "Delete"}</button>
          <Link className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold" href="/projects/session/wizard">Next session</Link>
        </div>
      ) : null}
    </AppPage>
  );
}

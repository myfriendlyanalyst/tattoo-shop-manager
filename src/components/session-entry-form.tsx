"use client";

import { useState } from "react";
import { DateTimeSelect } from "@/components/time-select";

export type SessionAppointmentRecord = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
};

export type SessionDepositApplicationRecord = {
  id: string;
  deposit_id: string;
  session_entry_id: string;
  amount: number;
  applied_at?: string;
  memo: string | null;
};

export type SessionPaymentRecord = {
  id: string;
  session_entry_id: string;
  payment_method: string;
  amount: number;
  memo: string | null;
};

export type SessionEntryRecordForForm = {
  id: string;
  appointment_id: string | null;
  tattoo_amount: number | null;
  tattoo_payment_method: string | null;
  tip_amount: number | null;
  tip_payment_method: string | null;
  memo: string | null;
};

export type PaymentLineForm = {
  id: string;
  paymentMethod: string;
  amount: string;
};

export type SessionForm = {
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

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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

function numberInputValue(value: number | null | undefined) {
  return value && value > 0 ? String(value) : "";
}

function newPaymentLine(method = "cash", amount = ""): PaymentLineForm {
  return {
    amount,
    id: crypto.randomUUID(),
    paymentMethod: method,
  };
}

function appointmentLabel(appointment: SessionAppointmentRecord) {
  return `${displayDateTime(appointment.starts_at)} / ${appointment.appointment_type}`;
}

export function SessionEntryForm({
  appointments,
  availableDepositBalance,
  depositApplications,
  error,
  onSave,
  saving,
  session,
  sessionPayments,
  submitLabel,
}: {
  appointments: SessionAppointmentRecord[];
  availableDepositBalance: number;
  depositApplications: SessionDepositApplicationRecord[];
  error: string;
  onSave: (form: SessionForm) => void;
  saving: boolean;
  session?: SessionEntryRecordForForm | null;
  sessionPayments: SessionPaymentRecord[];
  submitLabel?: string;
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
      depositAppliedAmount: numberInputValue(sessionAppliedDepositTotal),
      endsAt: localDateTimeInput(endsAt),
      memo: session?.memo ?? "",
      paymentLines:
        sessionPaymentLines.length > 0
          ? sessionPaymentLines
          : [newPaymentLine(session?.tattoo_payment_method ?? "cash")],
      startsAt: localDateTimeInput(startsAt),
      tattooAmount: numberInputValue(session?.tattoo_amount),
      tattooPaymentMethod: session?.tattoo_payment_method ?? "cash",
      tipAmount: numberInputValue(session?.tip_amount),
      tipPaymentMethod: session?.tip_payment_method ?? "cash",
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
    <div className="space-y-4">
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
                onChange={(value) => setForm((current) => ({ ...current, startsAt: value }))}
                startHour={12}
                value={form.startsAt}
              />
            </div>
          </label>
          <label className="text-sm font-semibold">
            Ends at
            <div className="mt-2">
              <DateTimeSelect
                onChange={(value) => setForm((current) => ({ ...current, endsAt: value }))}
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
          onChange={(event) => setForm((current) => ({ ...current, tattooAmount: event.target.value }))}
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
          {form.paymentLines.map((line) => (
            <div key={line.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    paymentLines: current.paymentLines.map((item) =>
                      item.id === line.id ? { ...item, paymentMethod: event.target.value } : item,
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
            onChange={(event) => setForm((current) => ({ ...current, tipAmount: event.target.value }))}
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
            onChange={(event) => setForm((current) => ({ ...current, tipPaymentMethod: event.target.value }))}
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
        {saving ? "Saving..." : submitLabel ?? (session ? "Update session" : "Save session")}
      </button>
    </div>
  );
}

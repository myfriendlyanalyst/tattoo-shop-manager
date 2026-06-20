"use client";

import { useMemo, useState } from "react";
import { TimeSelect } from "@/components/time-select";

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
  payment_type?: "tattoo" | "tip" | null;
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
  paymentType: "tattoo" | "tip";
};

export type PaymentGrid = {
  tattooCash: string;
  tattooCreditCard: string;
  tattooApp: string;
  tipCash: string;
  tipCreditCard: string;
  tipApp: string;
};

export type SessionForm = {
  appointmentId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  depositAppliedAmount: string;
  tattooAmount: string;
  tattooPaymentMethod: string;
  paymentLines: PaymentLineForm[];
  paymentGrid: PaymentGrid;
  tipAmount: string;
  tipPaymentMethod: string;
  memo: string;
};

const paymentColumns = [
  { key: "cash", label: "Cash" },
  { key: "credit_card", label: "Card" },
  { key: "app", label: "App" },
] as const;

const paymentGridFields = {
  tattoo: {
    cash: "tattooCash",
    credit_card: "tattooCreditCard",
    app: "tattooApp",
  },
  tip: {
    cash: "tipCash",
    credit_card: "tipCreditCard",
    app: "tipApp",
  },
} as const;

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function localDateValue(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function timeValue(value = new Date()) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function localDateTimeInput(date: string, time: string) {
  return `${date}T${time}`;
}

function addMinutesToTime(date: string, time: string, minutesToAdd: number) {
  const next = new Date(`${date}T${time}:00`);
  next.setMinutes(next.getMinutes() + minutesToAdd);
  return {
    date: localDateValue(next),
    time: timeValue(next),
  };
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

function appointmentLabel(appointment: SessionAppointmentRecord) {
  return `${displayDateTime(appointment.starts_at)} / ${appointment.appointment_type}`;
}

function paymentGridFromSession(
  session: SessionEntryRecordForForm | null | undefined,
  sessionPayments: SessionPaymentRecord[],
) {
  const grid: PaymentGrid = {
    tattooCash: "",
    tattooCreditCard: "",
    tattooApp: "",
    tipCash: "",
    tipCreditCard: "",
    tipApp: "",
  };

  for (const payment of sessionPayments) {
    const type = payment.payment_type ?? "tattoo";
    const fields = paymentGridFields[type];
    const field = fields[payment.payment_method as keyof typeof fields];
    if (field) grid[field] = numberInputValue(payment.amount);
  }

  if (session && sessionPayments.length === 0) {
    const tattooMethod = session.tattoo_payment_method ?? "cash";
    const tipMethod = session.tip_payment_method ?? "cash";
    const tattooField = paymentGridFields.tattoo[tattooMethod as keyof typeof paymentGridFields.tattoo];
    const tipField = paymentGridFields.tip[tipMethod as keyof typeof paymentGridFields.tip];
    if (tattooField) grid[tattooField] = numberInputValue(session.tattoo_amount);
    if (tipField) grid[tipField] = numberInputValue(session.tip_amount);
  }

  return grid;
}

function gridAmount(grid: PaymentGrid, type: "tattoo" | "tip", method: "cash" | "credit_card" | "app") {
  return Number(grid[paymentGridFields[type][method]] || 0);
}

function gridTotal(grid: PaymentGrid, type: "tattoo" | "tip") {
  return paymentColumns.reduce((sum, column) => sum + gridAmount(grid, type, column.key), 0);
}

function paymentLinesFromGrid(grid: PaymentGrid): PaymentLineForm[] {
  return (["tattoo", "tip"] as const).flatMap((type) =>
    paymentColumns
      .map((column) => ({
        amount: grid[paymentGridFields[type][column.key]],
        id: `${type}-${column.key}`,
        paymentMethod: column.key,
        paymentType: type,
      }))
      .filter((line) => Number(line.amount || 0) > 0),
  );
}

export function SessionEntryForm({
  appointments,
  availableDepositBalance,
  depositApplications,
  defaultDurationMinutes = 120,
  error,
  onSave,
  onEdit,
  onNextAppointment,
  saved = false,
  saving,
  session,
  sessionPayments,
  submitLabel,
}: {
  appointments: SessionAppointmentRecord[];
  availableDepositBalance: number;
  depositApplications: SessionDepositApplicationRecord[];
  defaultDurationMinutes?: number;
  error: string;
  onSave: (form: SessionForm) => void;
  onEdit?: () => void;
  onNextAppointment?: () => void;
  saved?: boolean;
  saving: boolean;
  session?: SessionEntryRecordForForm | null;
  sessionPayments: SessionPaymentRecord[];
  submitLabel?: string;
}) {
  const locked = saving || saved;
  const sessionDepositApplication = session
    ? depositApplications.filter((application) => application.session_entry_id === session.id)
    : [];
  const sessionAppliedDepositTotal = sessionDepositApplication.reduce(
    (sum, application) => sum + Number(application.amount),
    0,
  );
  const sessionPaymentLines = session
    ? sessionPayments.filter((payment) => payment.session_entry_id === session.id)
    : [];
  const [form, setForm] = useState<SessionForm>(() => {
    const now = new Date();
    const startDate = localDateValue(now);
    const startTime = timeValue(now);
    const end = addMinutesToTime(startDate, startTime, defaultDurationMinutes);
    const paymentGrid = paymentGridFromSession(session, sessionPaymentLines);
    const tattooAmount = gridTotal(paymentGrid, "tattoo");
    const tipAmount = gridTotal(paymentGrid, "tip");

    return {
      appointmentId: session?.appointment_id ?? appointments[0]?.id ?? "",
      depositAppliedAmount: numberInputValue(sessionAppliedDepositTotal),
      endTime: end.time,
      endsAt: localDateTimeInput(end.date, end.time),
      memo: session?.memo ?? "",
      paymentGrid,
      paymentLines: paymentLinesFromGrid(paymentGrid),
      sessionDate: startDate,
      startTime,
      startsAt: localDateTimeInput(startDate, startTime),
      tattooAmount: numberInputValue(tattooAmount),
      tattooPaymentMethod: "cash",
      tipAmount: numberInputValue(tipAmount),
      tipPaymentMethod: "cash",
    };
  });
  const tattooTotal = gridTotal(form.paymentGrid, "tattoo");
  const tipTotal = gridTotal(form.paymentGrid, "tip");
  const appliedDepositAmount = Number(form.depositAppliedAmount || 0);
  const tattooWorkTotal = tattooTotal + appliedDepositAmount;
  const newPaymentTotal = tattooTotal + tipTotal;

  function patchGrid(field: keyof PaymentGrid, value: string) {
    setForm((current) => {
      const paymentGrid = { ...current.paymentGrid, [field]: value };
      const tattooAmount = gridTotal(paymentGrid, "tattoo");
      const tipAmount = gridTotal(paymentGrid, "tip");

      return {
        ...current,
        paymentGrid,
        paymentLines: paymentLinesFromGrid(paymentGrid),
        tattooAmount: numberInputValue(tattooAmount),
        tattooPaymentMethod:
          paymentColumns.find((column) => gridAmount(paymentGrid, "tattoo", column.key) > 0)?.key ?? "cash",
        tipAmount: numberInputValue(tipAmount),
        tipPaymentMethod:
          paymentColumns.find((column) => gridAmount(paymentGrid, "tip", column.key) > 0)?.key ?? "cash",
      };
    });
  }

  function updateStartTime(nextTime: string) {
    setForm((current) => {
      const end = addMinutesToTime(current.sessionDate, nextTime, defaultDurationMinutes);
      return {
        ...current,
        endTime: end.time,
        endsAt: localDateTimeInput(end.date, end.time),
        startTime: nextTime,
        startsAt: localDateTimeInput(current.sessionDate, nextTime),
      };
    });
  }

  function updateDate(nextDate: string) {
    setForm((current) => ({
      ...current,
      endsAt: localDateTimeInput(nextDate, current.endTime),
      sessionDate: nextDate,
      startsAt: localDateTimeInput(nextDate, current.startTime),
    }));
  }

  function updateEndTime(nextTime: string) {
    setForm((current) => ({
      ...current,
      endTime: nextTime,
      endsAt: localDateTimeInput(current.sessionDate, nextTime),
    }));
  }

  const summary = useMemo(
    () =>
      [
        `Date: ${form.sessionDate}`,
        `Time: ${form.startTime} - ${form.endTime}`,
        `Tattoo payments: ${money(tattooTotal)}`,
        `Deposit applied: ${money(appliedDepositAmount)}`,
        `Tattoo total: ${money(tattooWorkTotal)}`,
        `Tip: ${money(tipTotal)}`,
        `New payments received: ${money(newPaymentTotal)}`,
      ].join("\n"),
    [
      appliedDepositAmount,
      form.endTime,
      form.sessionDate,
      form.startTime,
      newPaymentTotal,
      tattooTotal,
      tattooWorkTotal,
      tipTotal,
    ],
  );

  function confirmAndSave() {
    if (!window.confirm(`Save this session?\n\n${summary}`)) return;
    onSave({
      ...form,
      paymentLines: paymentLinesFromGrid(form.paymentGrid),
      tattooAmount: String(tattooWorkTotal),
      tipAmount: String(tipTotal),
    });
  }

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
          disabled={locked || Boolean(session)}
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
        <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
          <label className="text-sm font-semibold">
            Date
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              disabled={locked}
              onChange={(event) => updateDate(event.target.value)}
              type="date"
              value={form.sessionDate}
            />
          </label>
          <label className="text-sm font-semibold">
            Start
              <TimeSelect
                endHour={24}
                interval={30}
                onChange={updateStartTime}
                startHour={8}
                value={form.startTime}
                disabled={locked}
              />
          </label>
          <label className="text-sm font-semibold">
            End
              <TimeSelect
                endHour={24}
                interval={30}
                onChange={updateEndTime}
                startHour={8}
                value={form.endTime}
                disabled={locked}
              />
          </label>
        </div>
      ) : null}

      <div>
        <div className="mb-2">
          <p className="text-sm font-semibold">Payments for this session</p>
          <p className="mt-0.5 text-xs font-medium text-[#697178]">
            Enter only the money received today.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-[#d9d3c7] bg-white">
          <table className="w-full min-w-[680px] table-fixed text-sm">
            <colgroup>
              <col className="w-[96px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[134px]" />
            </colgroup>
            <thead className="bg-[#f7f2e9] text-xs font-black uppercase tracking-[0.06em] text-[#697178]">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                {paymentColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-right">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee8dd]">
              {(["tattoo", "tip"] as const).map((type) => (
                <tr key={type}>
                  <td className="px-3 py-2 font-semibold capitalize">{type}</td>
                  {paymentColumns.map((column) => {
                    const field = paymentGridFields[type][column.key];
                    return (
                      <td key={column.key} className="px-3 py-2">
                        <input
                          className="h-9 w-full min-w-0 rounded-md border border-[#cfc7b8] bg-white px-2 text-right text-sm"
                          inputMode="decimal"
                          min="0"
                          disabled={locked}
                          onChange={(event) => patchGrid(field, event.target.value)}
                          placeholder="0.00"
                          type="number"
                          value={form.paymentGrid[field]}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold text-[#236c8f]">
                    {money(type === "tattoo" ? tattooTotal : tipTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <label className="block text-sm font-semibold">
        <span className="flex items-center justify-between gap-3">
          <span>Deposit applied</span>
          <span className="text-xs font-semibold text-[#697178]">
            Available {money(availableDepositBalance)}
          </span>
        </span>
        <input
          className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
          disabled={locked}
          min="0"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              depositAppliedAmount: event.target.value,
            }))
          }
          placeholder="0.00"
          type="number"
          value={form.depositAppliedAmount}
        />
      </label>

      <textarea
        className="min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
        disabled={locked}
        onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
        placeholder="Memo"
        value={form.memo}
      />

      {saved ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="h-10 rounded-md border border-[#cfc7b8] bg-white px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            onClick={onEdit}
            type="button"
          >
            Edit
          </button>
          {onNextAppointment ? (
            <button
              className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
              onClick={onNextAppointment}
              type="button"
            >
              Next Appointment
            </button>
          ) : null}
        </div>
      ) : (
        <button
          className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={confirmAndSave}
          type="button"
        >
          {saving ? "Saving..." : submitLabel ?? (session ? "Update session" : "Save session")}
        </button>
      )}
    </div>
  );
}

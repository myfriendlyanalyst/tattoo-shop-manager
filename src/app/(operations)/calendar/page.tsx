"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AppPage } from "@/components/app-shell";
import { TimeSelect, useTimeInterval } from "@/components/time-select";
import {
  cancelAppointmentReminder,
  scheduleAppointmentReminder,
  sendAppointmentCancellation,
  sendAppointmentConfirmation,
  sendAppointmentReschedule,
} from "@/lib/appointment-email";
import { getSafeUser } from "@/lib/auth-session";
import { getOperationsContext, type OperationsContext } from "@/lib/operations-access";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  default_session_duration_minutes: number | null;
};

type StaffSchedule = {
  staff_id: string;
  day_of_week: number;
  available: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type StaffPermission = {
  staff_id: string;
  permission_key: string;
  enabled: boolean;
};

type ArtistSchedule = {
  available: boolean;
  start: string;
  end: string;
};

type Appointment = {
  id: string;
  start: string;
  end: string;
  startsAt: string;
  endsAt: string | null;
  client: string;
  project: string;
  artistId: string;
  artist: string;
  type: string;
  status: string;
  waiver: string;
  notes: string;
};

type ProjectRecord = {
  id: string;
  customer_id: string;
  artist_id: string | null;
  subject: string;
  session_type: string | null;
  status: string;
  customer: { name: string; email: string | null } | { name: string; email: string | null }[] | null;
};

type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type AppointmentRow = {
  id: string;
  artist_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  status: string;
  notes: string | null;
  customer: { name: string } | { name: string }[] | null;
  project: { subject: string; waiver_signed: boolean } | { subject: string; waiver_signed: boolean }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type DraftAppointment = {
  artistId: string;
  artist: string;
  date: string;
  start: string;
  end: string;
  defaultDurationMinutes: number;
  prefillProjectId?: string;
};

type NewAppointmentForm = {
  mode: "project" | "walk_in";
  customerId: string;
  projectId: string;
  customerMode: "existing" | "new";
  newCustomerName: string;
  newCustomerEmail: string;
  newCustomerPhone: string;
  projectSubject: string;
  type: string;
  notes: string;
  date: string;
  start: string;
  end: string;
};

type AppointmentEditForm = {
  type: string;
  status: string;
  notes: string;
  start: string;
  end: string;
};

const dayStartHour = 12;
const dayEndHour = 24;
const pixelsPerHour = 88;
const timelineHeight = (dayEndHour - dayStartHour) * pixelsPerHour;

const appointmentTypes = [
  "Walk-in",
  "One Done",
  "First Session",
  "On-Going",
  "Final Session",
];

const appointmentStatusOptions = [
  "scheduled",
  "checked_in",
  "completed",
  "no_show",
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDateValue(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const hourMarkers = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => {
  const hour = dayStartHour + index;
  const normalizedHour = hour === 24 ? 0 : hour;
  const displayHour =
    normalizedHour === 0 ? 12 : normalizedHour > 12 ? normalizedHour - 12 : normalizedHour;
  const period = normalizedHour >= 12 ? "PM" : "AM";

  return {
    label: `${displayHour}:00 ${period}`,
    top: index * pixelsPerHour,
  };
});

function normalizeTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function appointmentTypeForProject(project?: Pick<ProjectRecord, "session_type"> | null) {
  const sessionType = project?.session_type?.trim().toLowerCase() ?? "";

  if (sessionType === "walk-in" || sessionType === "walk in") return "Walk-in";
  if (sessionType === "one done" || sessionType === "one-done") return "One Done";
  if (sessionType === "multiple session" || sessionType === "multiple sessions") {
    return "First Session";
  }

  return "Walk-in";
}

function normalizeAppointmentType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "walk-in" || normalized === "walk in") return "Walk-in";
  if (normalized === "one done" || normalized === "one-done") return "One Done";
  if (normalized === "multiple session" || normalized === "multiple sessions") return "First Session";
  if (normalized === "first session") return "First Session";
  if (normalized === "on-going" || normalized === "ongoing" || normalized === "on going") return "On-Going";
  if (normalized === "final session") return "Final Session";

  return value || "Walk-in";
}

function minutesFromStart(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const normalizedHour = hour === 0 && dayEndHour === 24 ? 24 : hour;
  return (normalizedHour - dayStartHour) * 60 + minute;
}

function minutesToTime(minutesFromDayStart: number) {
  const totalMinutes = dayStartHour * 60 + minutesFromDayStart;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function appointmentStyle(start: string, end: string) {
  const startMinutes = minutesFromStart(start);
  const endMinutes = minutesFromStart(end);

  return {
    top: `${(startMinutes / 60) * pixelsPerHour}px`,
    height: `${Math.max(((endMinutes - startMinutes) / 60) * pixelsPerHour, 44)}px`,
  };
}

function scheduleStyle(schedule: ArtistSchedule) {
  if (!schedule.available) {
    return {
      top: "0px",
      height: `${timelineHeight}px`,
    };
  }

  const startMinutes = Math.max(minutesFromStart(schedule.start), 0);
  const endMinutes = Math.min(minutesFromStart(schedule.end), timelineHeight / pixelsPerHour * 60);

  return {
    top: `${(startMinutes / 60) * pixelsPerHour}px`,
    height: `${Math.max(((endMinutes - startMinutes) / 60) * pixelsPerHour, 0)}px`,
  };
}

function formatTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const normalizedHour = hour === 24 ? 0 : hour;
  const displayHour =
    normalizedHour === 0 ? 12 : normalizedHour > 12 ? normalizedHour - 12 : normalizedHour;
  const period = normalizedHour >= 12 ? "PM" : "AM";

  return `${displayHour}:${minute} ${period}`;
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function addMonths(date: string, amount: number) {
  const nextDate = new Date(`${date}T00:00:00`);

  nextDate.setMonth(nextDate.getMonth() + amount);

  return localDateValue(nextDate);
}

function monthDays(date: string) {
  const selected = new Date(`${date}T00:00:00`);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);

  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);

    day.setDate(start.getDate() + index);

    return {
      date: localDateValue(day),
      day: day.getDate(),
      currentMonth: day.getMonth() === month,
    };
  });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    checked_in: "Checked-in",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
  };

  return labels[status] ?? status;
}

function projectStatusLabel(status: string) {
  if (status === "on_hold") {
    return "Unscheduled";
  }

  return statusLabel(status);
}

function statusClasses(status: string) {
  const variants: Record<string, string> = {
    scheduled: "bg-[#e5edf4] text-[#315f82]",
    checked_in: "bg-[#e8f0ee] text-[#2f6658]",
    completed: "bg-[#e4f1df] text-[#476b33]",
    cancelled: "bg-[#f3e1e1] text-[#8a3030]",
    no_show: "bg-[#f4e7df] text-[#8a5130]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function customerSearchLabel(
  customer: { name: string; email?: string | null; phone?: string | null } | null | undefined,
) {
  if (!customer) {
    return "";
  }

  return [customer.name, customer.email, customer.phone].filter(Boolean).join(" / ");
}

function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

function timestampFor(date: string, time: string) {
  const [hourText] = time.split(":");
  const timestamp = new Date(`${date}T${time}:00`);

  if (dayEndHour === 24 && Number(hourText) === 0) {
    timestamp.setDate(timestamp.getDate() + 1);
  }

  return timestamp.toISOString();
}

function endTimeFromStart(start: string, durationMinutes: number) {
  const endMinutes = Math.min(
    minutesFromStart(start) + durationMinutes,
    (dayEndHour - dayStartHour) * 60,
  );
  return minutesToTime(endMinutes);
}

function dayRangeFor(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function timeFromTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function draftFromClick(
  artist: StaffRecord,
  date: string,
  event: MouseEvent<HTMLDivElement>,
  interval: number,
  durationMinutes = 120,
): DraftAppointment {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = Math.max(0, Math.min(event.clientY - rect.top, timelineHeight));
  const rawMinutes = (y / pixelsPerHour) * 60;
  const startMinutes = Math.min(
    Math.round(rawMinutes / interval) * interval,
    (dayEndHour - dayStartHour - 1) * 60,
  );
  const endMinutes = Math.min(startMinutes + durationMinutes, (dayEndHour - dayStartHour) * 60);

  return {
    artistId: artist.id,
    artist: artist.display_name,
    date,
    start: minutesToTime(startMinutes),
    end: minutesToTime(endMinutes),
    defaultDurationMinutes: durationMinutes,
  };
}

function scheduleLabel(schedule: ArtistSchedule) {
  if (!schedule.available) {
    return "Off";
  }

  return `${formatTime(schedule.start)} - ${formatTime(schedule.end)}`;
}

function isWithinSchedule(schedule: ArtistSchedule, start: string, end: string) {
  if (!schedule.available) {
    return false;
  }

  const startMinutes = minutesFromStart(start);
  const endMinutes = minutesFromStart(end);
  const scheduleStart = minutesFromStart(schedule.start);
  const scheduleEnd = minutesFromStart(schedule.end);

  return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
}

function scheduleMapForDate(date: string, schedules: StaffSchedule[]) {
  const selectedDay = dayOfWeek(date);
  const nextMap: Record<string, ArtistSchedule> = {};

  schedules
    .filter((schedule) => schedule.day_of_week === selectedDay)
    .forEach((schedule) => {
      nextMap[schedule.staff_id] = {
        available: schedule.available,
        start: normalizeTime(schedule.starts_at) || "10:00",
        end: normalizeTime(schedule.ends_at) || "18:00",
      };
    });

  return nextMap;
}

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapAppointment(row: AppointmentRow): Appointment {
  const start = timeFromTimestamp(row.starts_at);
  const end = row.ends_at ? timeFromTimestamp(row.ends_at) : start;
  const customer = relatedOne(row.customer);
  const project = relatedOne(row.project);
  const artist = relatedOne(row.artist);

  return {
    id: row.id,
    start,
    end,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    client: customer?.name ?? "Unknown customer",
    project: project?.subject ?? "Untitled project",
    artistId: row.artist_id ?? "",
    artist: artist?.display_name ?? "Unassigned",
    type: normalizeAppointmentType(row.appointment_type),
    status: row.status,
    waiver: project?.waiver_signed ? "Signed" : "Missing",
    notes: row.notes ?? "",
  };
}

function canShowInCalendar(staff: StaffRecord, permissionRows: StaffPermission[]) {
  if (staff.role === "Owner") {
    return true;
  }

  const bookingPermission = permissionRows.find(
    (permission) =>
      permission.staff_id === staff.id && permission.permission_key === "calendarBooking",
  );

  if (bookingPermission) {
    return bookingPermission.enabled;
  }

  return staff.role === "Artist";
}

function MiniDatePicker({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const today = localDateValue();
  const days = monthDays(selectedDate);

  return (
    <div className="rounded-md border border-[#d9d3c7] bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-sm font-bold hover:bg-[#eee8dd]"
          onClick={() => onSelect(addMonths(selectedDate, -1))}
          type="button"
        >
          {"<"}
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{formatMonthLabel(selectedDate)}</p>
          <button
            className="mt-1 text-xs font-semibold text-[#8a6f4d] hover:text-[#1f2428]"
            onClick={() => onSelect(today)}
            type="button"
          >
            Today
          </button>
        </div>
        <button
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-sm font-bold hover:bg-[#eee8dd]"
          onClick={() => onSelect(addMonths(selectedDate, 1))}
          type="button"
        >
          {">"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-[#8a8174]">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = day.date === selectedDate;
          const isToday = day.date === today;

          return (
            <button
              className={`flex h-8 items-center justify-center rounded-md text-xs font-semibold transition ${
                selected
                  ? "bg-[#1f2428] text-white"
                  : isToday
                    ? "border border-[#9f5c3c] text-[#9f5c3c]"
                    : day.currentMonth
                      ? "text-[#30373d] hover:bg-[#eee8dd]"
                      : "text-[#b8afa2] hover:bg-[#f7f2e9]"
              }`}
              key={day.date}
              onClick={() => onSelect(day.date)}
              type="button"
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentDetailModal({
  appointment,
  saving,
  error,
  onClose,
  onCancel,
  onDelete,
  onSave,
}: {
  appointment: Appointment;
  saving: boolean;
  error: string;
  onClose: () => void;
  onCancel: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  onSave: (appointment: Appointment, form: AppointmentEditForm) => void;
}) {
  const [form, setForm] = useState<AppointmentEditForm>({
    type: appointment.type,
    status: appointment.status,
    notes: appointment.notes,
    start: appointment.start,
    end: appointment.end,
  });
  const defaultDurationMinutes = Math.max(
    minutesFromStart(appointment.end) - minutesFromStart(appointment.start),
    30,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 md:items-center md:px-4 md:py-6">
      <section className="h-full w-full overflow-hidden bg-white shadow-xl md:h-auto md:max-h-[92vh] md:max-w-xl md:rounded-md md:border md:border-[#d9d3c7]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">Selected appointment</p>
            <h3 className="mt-1 text-xl font-semibold">{appointment.client}</h3>
            <p className="mt-1 text-sm text-[#697178]">{appointment.project}</p>
          </div>
          <button
            aria-label="Close appointment detail"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="h-[calc(100vh-92px)] space-y-4 overflow-y-auto px-5 py-5 md:h-auto md:max-h-[72vh]">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Artist</p>
              <p className="mt-1 font-semibold">{appointment.artist}</p>
            </div>
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Waiver</p>
              <p className="mt-1 font-semibold">{appointment.waiver}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Start
              <TimeSelect
                endHour={dayEndHour}
                interval={30}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    start: value,
                    end: endTimeFromStart(value, defaultDurationMinutes),
                  }))
                }
                startHour={dayStartHour}
                value={form.start}
              />
            </label>
            <label className="text-sm font-semibold">
              End
              <TimeSelect
                endHour={dayEndHour}
                interval={30}
                onChange={(value) => setForm((current) => ({ ...current, end: value }))}
                startHour={dayStartHour}
                value={form.end}
              />
            </label>
            <label className="text-sm font-semibold">
              Type
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                value={form.type}
              >
                {appointmentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Status
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                value={form.status}
              >
                {appointmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Notes
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              value={form.notes}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button
              className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={() => onSave(appointment, form)}
              type="button"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              className="h-10 rounded-md border border-[#8a3030] px-4 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || appointment.status === "cancelled"}
              onClick={() => onCancel(appointment)}
              type="button"
            >
              {appointment.status === "cancelled" ? "Cancelled" : "Cancel appointment"}
            </button>
            <button
              className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={() => onDelete(appointment)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function NewAppointmentModal({
  draft,
  projects,
  customers,
  saving,
  error,
  onClose,
  onSave,
}: {
  draft: DraftAppointment;
  projects: ProjectRecord[];
  customers: CustomerRecord[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: NewAppointmentForm) => void;
}) {
  const preferredProject = draft.prefillProjectId
    ? projects.find((project) => project.id === draft.prefillProjectId)
    : null;
  const firstProject = preferredProject ?? projects[0];
  const firstCustomer = customers[0];
  const firstProjectCustomer = relatedOne(firstProject?.customer ?? null);
  const initialCustomer = firstProjectCustomer ?? firstCustomer;
  const [form, setForm] = useState<NewAppointmentForm>({
    mode: firstProject ? "project" : "walk_in",
    customerId: firstProject?.customer_id ?? firstCustomer?.id ?? "",
    projectId: firstProject?.id ?? "",
    customerMode: firstCustomer ? "existing" : "new",
    newCustomerName: "",
    newCustomerEmail: "",
    newCustomerPhone: "",
    projectSubject: "",
    type: firstProject ? appointmentTypeForProject(firstProject) : "Walk-in",
    notes: "",
    date: draft.date,
    start: draft.start,
    end: draft.end,
  });
  const defaultDurationMinutes = draft.defaultDurationMinutes || 120;
  const [customerSearch, setCustomerSearch] = useState(customerSearchLabel(initialCustomer));
  const selectedProject = projects.find((project) => project.id === form.projectId) ?? firstProject;
  const selectedProjectCustomer = relatedOne(selectedProject?.customer ?? null);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) ?? null;
  const canUseExistingCustomer = customers.length > 0;
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    if (!term) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) =>
        [customer.name, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [customerSearch, customers]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 md:items-center md:px-4 md:py-6">
      <section className="h-full w-full overflow-hidden bg-white shadow-xl md:h-auto md:max-h-[92vh] md:max-w-xl md:rounded-md md:border md:border-[#d9d3c7]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New appointment</p>
            <h3 className="mt-1 text-xl font-semibold">
              {draft.artist} / {formatDateLabel(form.date)} {formatTime(form.start)}
            </h3>
            <p className="mt-1 text-sm text-[#697178]">
              Created from the calendar position you clicked.
            </p>
          </div>
          <button
            aria-label="Close new appointment"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="h-[calc(100vh-92px)] space-y-3 overflow-y-auto px-5 py-5 md:h-auto md:max-h-[75vh]">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm font-semibold">
              Artist
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-[#f7f2e9] px-3 text-sm"
                readOnly
                value={draft.artist}
              />
            </label>
            <label className="text-sm font-semibold">
              Date
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                type="date"
                value={form.date}
              />
            </label>
            <label className="text-sm font-semibold">
              Start
              <TimeSelect
                endHour={dayEndHour}
                interval={30}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    start: value,
                    end: endTimeFromStart(value, defaultDurationMinutes),
                  }))
                }
                startHour={dayStartHour}
                value={form.start}
              />
            </label>
            <label className="text-sm font-semibold">
              End
              <TimeSelect
                endHour={dayEndHour}
                interval={30}
                onChange={(value) => setForm((current) => ({ ...current, end: value }))}
                startHour={dayStartHour}
                value={form.end}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Booking source
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => {
                const mode = event.target.value as NewAppointmentForm["mode"];
                const project = preferredProject ?? projects[0];
                const projectCustomer = relatedOne(project?.customer ?? null);
                const nextCustomerId =
                  mode === "project"
                    ? project?.customer_id ?? ""
                    : form.customerId || (firstCustomer?.id ?? "");
                const nextCustomer =
                  mode === "project"
                    ? projectCustomer
                    : customers.find((customer) => customer.id === nextCustomerId) ?? firstCustomer;

                setCustomerSearch(customerSearchLabel(nextCustomer));

                setForm((current) => ({
                  ...current,
                  mode,
                  projectId: mode === "project" ? project?.id ?? "" : "",
                  customerId: nextCustomerId,
                  type: mode === "project" ? appointmentTypeForProject(project) : "Walk-in",
                }));
              }}
              value={form.mode}
            >
              {projects.length > 0 ? <option value="project">Existing project</option> : null}
              <option value="walk_in">Walk-in / create project</option>
            </select>
          </label>

          {form.mode === "project" ? (
            <>
              <label className="block text-sm font-semibold">
                Project
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => {
                    const project = projects.find((item) => item.id === event.target.value);
                    const customer = relatedOne(project?.customer ?? null);

                    setCustomerSearch(customerSearchLabel(customer));

                    setForm((current) => ({
                      ...current,
                      projectId: event.target.value,
                      customerId: project?.customer_id ?? "",
                      type: appointmentTypeForProject(project),
                    }));
                  }}
                  value={form.projectId}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.subject} / {projectStatusLabel(project.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Customer
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-[#f7f2e9] px-3 text-sm"
                  readOnly
                  value={selectedProjectCustomer?.name ?? "Select a project"}
                />
              </label>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Customer
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => {
                      const nextMode = event.target.value as NewAppointmentForm["customerMode"];
                      const nextCustomerId =
                        nextMode === "existing" ? form.customerId || (firstCustomer?.id ?? "") : "";
                      const nextCustomer = customers.find((customer) => customer.id === nextCustomerId);

                      setCustomerSearch(nextMode === "existing" ? customerSearchLabel(nextCustomer) : "");
                      setForm((current) => ({
                        ...current,
                        customerMode: nextMode,
                        customerId: nextCustomerId,
                      }));
                    }}
                    value={form.customerMode}
                  >
                    {canUseExistingCustomer ? <option value="existing">Existing customer</option> : null}
                    <option value="new">New customer</option>
                  </select>
                </label>
                {form.customerMode === "existing" ? (
                  <div className="relative block text-sm font-semibold">
                    Find customer
                    <input
                      autoComplete="off"
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) => {
                        setCustomerSearch(event.target.value);
                        setForm((current) => ({ ...current, customerId: "" }));
                      }}
                      placeholder="Type name, email, or phone"
                      value={customerSearch}
                    />
                    <div className="absolute left-0 right-0 top-[72px] z-20 max-h-52 overflow-y-auto rounded-md border border-[#d9d3c7] bg-white shadow-lg">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f2e9] ${
                              customer.id === form.customerId ? "bg-[#f1eadc] font-semibold" : ""
                            }`}
                            key={customer.id}
                            onClick={() => {
                              setForm((current) => ({ ...current, customerId: customer.id }));
                              setCustomerSearch(customerSearchLabel(customer));
                            }}
                            type="button"
                          >
                            <span className="block font-semibold">{customer.name}</span>
                            <span className="mt-0.5 block text-xs font-normal text-[#697178]">
                              {[customer.email, customer.phone].filter(Boolean).join(" / ") || "No contact info"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm font-normal text-[#697178]">
                          No matching customers
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {form.customerMode === "new" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold">
                    Name
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, newCustomerName: event.target.value }))
                      }
                      placeholder="Customer name"
                      value={form.newCustomerName}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Email
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, newCustomerEmail: event.target.value }))
                      }
                      placeholder="Optional"
                      type="email"
                      value={form.newCustomerEmail}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Phone
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, newCustomerPhone: event.target.value }))
                      }
                      placeholder="Optional"
                      value={form.newCustomerPhone}
                    />
                  </label>
                </div>
              ) : null}

              <label className="block text-sm font-semibold">
                Project subject
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, projectSubject: event.target.value }))
                  }
                  placeholder={`Walk-in - ${selectedCustomer?.name ?? "customer"}`}
                  value={form.projectSubject}
                />
              </label>
            </>
          )}
          <label className="block text-sm font-semibold">
            Appointment type
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              value={form.type}
            >
              {appointmentTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <textarea
            className="min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notes"
            value={form.notes}
          />
          <button
            className="h-10 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(form)}
            type="button"
          >
            {saving ? "Saving..." : "Save appointment"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function CalendarPage() {
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => localDateValue());
  const [artistFilter, setArtistFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [draftAppointment, setDraftAppointment] = useState<DraftAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [operationsContext, setOperationsContext] = useState<OperationsContext | null>(null);
  const isArtistUser = operationsContext?.isArtist === true;
  const timeInterval = useTimeInterval();

  const visibleArtists = useMemo(() => {
    if (artistFilter === "all") {
      return artists;
    }

    return artists.filter((artist) => artist.id === artistFilter);
  }, [artistFilter, artists]);

  const mobileArtist = useMemo(() => {
    if (artistFilter !== "all") {
      return artists.find((artist) => artist.id === artistFilter) ?? artists[0];
    }

    return artists[0];
  }, [artistFilter, artists]);

  const mobileVisibleArtists = useMemo(
    () => (mobileArtist ? [mobileArtist] : []),
    [mobileArtist],
  );

  const visibleAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "cancelled"),
    [appointments],
  );

  const dailySchedules = useMemo(
    () => scheduleMapForDate(selectedDate, schedules),
    [schedules, selectedDate],
  );

  const draftProjects = useMemo(() => {
    if (!draftAppointment) {
      return [];
    }

    return projects.filter((project) => project.artist_id === draftAppointment.artistId);
  }, [draftAppointment, projects]);

  const currentTimeTop = useMemo(() => {
    if (selectedDate !== localDateValue(now)) {
      return null;
    }

    const currentMinutes = (now.getHours() - dayStartHour) * 60 + now.getMinutes();
    const timelineMinutes = (dayEndHour - dayStartHour) * 60;

    if (currentMinutes < 0 || currentMinutes > timelineMinutes) {
      return null;
    }

    return (currentMinutes / 60) * pixelsPerHour;
  }, [now, selectedDate]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadCalendar() {
      setLoading(true);
      setError("");
      setMessage("");

      const user = await getSafeUser();
      const context = await getOperationsContext();

      if (!user) {
        setError("Please log in to view the calendar.");
        setLoading(false);
        return;
      }

      const dayRange = dayRangeFor(selectedDate);

      const [
        staffResult,
        scheduleResult,
        permissionResult,
        customerResult,
        projectResult,
        appointmentResult,
      ] = await Promise.all([
        supabase
          .from("staff")
          .select("id, display_name, role, active, default_session_duration_minutes")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("staff_schedules")
          .select("staff_id, day_of_week, available, starts_at, ends_at"),
        supabase
          .from("staff_permissions")
          .select("staff_id, permission_key, enabled")
          .eq("permission_key", "calendarBooking"),
        supabase
          .from("customers")
          .select("id, name, email, phone")
          .order("name", { ascending: true }),
        supabase
          .from("projects")
          .select("id, customer_id, artist_id, subject, session_type, status, customer:customers(name, email)")
          .neq("status", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select(
            "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject, waiver_signed), artist:staff(display_name)",
          )
          .gte("starts_at", dayRange.start)
          .lte("starts_at", dayRange.end)
          .order("starts_at", { ascending: true }),
      ]);

      if (staffResult.error) {
        setError(staffResult.error.message);
        setLoading(false);
        return;
      }

      if (scheduleResult.error) {
        setError(scheduleResult.error.message);
        setLoading(false);
        return;
      }

      if (permissionResult.error) {
        setError(permissionResult.error.message);
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

      const nextPermissions = permissionResult.data ?? [];
      const rawArtists = (staffResult.data ?? []).filter((staff) =>
        canShowInCalendar(staff, nextPermissions),
      );
      const nextArtists =
        context?.isArtist && context.staffId
          ? rawArtists.filter((artist) => artist.id === context.staffId)
          : rawArtists;
      const nextProjects =
        context?.isArtist && context.staffId
          ? ((projectResult.data ?? []) as unknown as ProjectRecord[]).filter(
              (project) => project.artist_id === context.staffId,
            )
          : ((projectResult.data ?? []) as unknown as ProjectRecord[]);
      const nextAppointments =
        context?.isArtist && context.staffId
          ? ((appointmentResult.data ?? []) as unknown as AppointmentRow[]).filter(
              (appointment) => appointment.artist_id === context.staffId,
            )
          : ((appointmentResult.data ?? []) as unknown as AppointmentRow[]);

      setOperationsContext(context);
      setArtists(nextArtists);
      setCustomers((customerResult.data ?? []) as CustomerRecord[]);
      setProjects(nextProjects);
      setSchedules(scheduleResult.data ?? []);
      setAppointments(nextAppointments.map(mapAppointment));
      if (context?.isArtist && context.staffId) {
        setArtistFilter(context.staffId);
      }

      const params = new URLSearchParams(window.location.search);
      const prefillProjectId = params.get("projectId") ?? "";
      const prefillArtistId = params.get("artistId") ?? "";
      const prefillProject = nextProjects.find((project) => project.id === prefillProjectId);
      const prefillArtist = nextArtists.find(
        (artist) => artist.id === (prefillProject?.artist_id ?? prefillArtistId),
      );

      if (prefillProject && prefillArtist) {
        setArtistFilter(prefillArtist.id);
        setMessage("Project created. Choose a date and time to book the appointment.");
        setDraftAppointment({
          artistId: prefillArtist.id,
          artist: prefillArtist.display_name,
          date: selectedDate,
          start: "12:00",
          end: endTimeFromStart("12:00", prefillArtist.default_session_duration_minutes ?? 120),
          defaultDurationMinutes: prefillArtist.default_session_duration_minutes ?? 120,
          prefillProjectId: prefillProject.id,
        });
        window.history.replaceState(null, "", "/calendar");
      }
      setLoading(false);
    }

    loadCalendar();
  }, [selectedDate]);

  function appointmentsForArtist(artistId: string) {
    return visibleAppointments.filter((appointment) => appointment.artistId === artistId);
  }

  async function saveAppointment(form: NewAppointmentForm) {
    if (!draftAppointment) {
      return;
    }

    if (minutesFromStart(form.end) <= minutesFromStart(form.start)) {
      setModalError("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setModalError("");
    setError("");
    setMessage("");

    let project: ProjectRecord | null =
      projects.find(
        (item) => item.id === form.projectId && item.artist_id === draftAppointment.artistId,
      ) ?? null;
    let customerId = project?.customer_id ?? form.customerId;

    if (form.mode === "project" && !project) {
      setModalError("Select a project for this artist.");
      setSaving(false);
      return;
    }

    if (form.mode === "walk_in") {
      if (form.customerMode === "new") {
        const customerName = form.newCustomerName.trim();
        const customerEmail = form.newCustomerEmail.trim();

        if (!customerName) {
          setModalError("Customer name is required for a walk-in.");
          setSaving(false);
          return;
        }

        if (customerEmail && !isValidEmail(customerEmail)) {
          setModalError("Enter a valid customer email address.");
          setSaving(false);
          return;
        }

        const customerResult = await supabase
          .from("customers")
          .insert({
            name: customerName,
            email: customerEmail || null,
            phone: form.newCustomerPhone.trim() || null,
            notes: `Created from calendar walk-in on ${draftAppointment.date}.`,
          })
          .select("id, name, email, phone")
          .single();

        if (customerResult.error) {
          setModalError(customerResult.error.message);
          setSaving(false);
          return;
        }

        const customer = customerResult.data as CustomerRecord;

        customerId = customer.id;
        setCustomers((current) => [customer, ...current]);
      }

      if (!customerId) {
        setModalError("Select or create a customer for this walk-in.");
        setSaving(false);
        return;
      }

      const customerName =
        form.customerMode === "new"
          ? form.newCustomerName.trim()
          : customers.find((customer) => customer.id === customerId)?.name ?? "Customer";
      const projectSubject = form.projectSubject.trim() || `Walk-in - ${customerName}`;
      const projectResult = await supabase
        .from("projects")
        .insert({
          customer_id: customerId,
          artist_id: draftAppointment.artistId,
          subject: projectSubject,
          session_type: "Walk-in",
          status: "booked",
          waiver_signed: false,
          waiver_status: "missing",
          memo: `Auto-created from calendar walk-in for ${formatDateLabel(draftAppointment.date)}.`,
        })
        .select("id, customer_id, artist_id, subject, session_type, status, customer:customers(name, email)")
        .single();

      if (projectResult.error) {
        setModalError(projectResult.error.message);
        setSaving(false);
        return;
      }

      project = projectResult.data as unknown as ProjectRecord;
      setProjects((current) => [project!, ...current]);
    }

    if (!project || !customerId) {
      setModalError("Customer and project are required.");
      setSaving(false);
      return;
    }

    const appointmentResult = await supabase
      .from("appointments")
      .insert({
        project_id: project.id,
        customer_id: customerId,
        artist_id: draftAppointment.artistId,
        starts_at: timestampFor(form.date, form.start),
        ends_at: timestampFor(form.date, form.end),
        appointment_type: form.type,
        status: "scheduled",
        notes: form.notes.trim() || null,
      })
      .select(
        "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject, waiver_signed), artist:staff(display_name)",
      )
      .single();

    if (appointmentResult.error) {
      setModalError(appointmentResult.error.message);
      setSaving(false);
      return;
    }

    if (project.status === "on_hold") {
      const projectStatusResult = await supabase
        .from("projects")
        .update({ status: "booked" })
        .eq("id", project.id);

      if (projectStatusResult.error) {
        setModalError(projectStatusResult.error.message);
        setSaving(false);
        return;
      }

      setProjects((current) =>
        current.map((item) =>
          item.id === project!.id ? { ...item, status: "booked" } : item,
        ),
      );
    }

    setAppointments((current) => [
      ...current,
      mapAppointment(appointmentResult.data as unknown as AppointmentRow),
    ]);
    let hasDeliveryWarning = false;
    const emailResult = await sendAppointmentConfirmation(
      (appointmentResult.data as unknown as AppointmentRow).id,
    );
    if (!emailResult.sent) {
      hasDeliveryWarning = true;
      setError(
        `Appointment saved. Confirmation email was not sent${
          emailResult.error || emailResult.reason
            ? `: ${emailResult.error || emailResult.reason}`
            : "."
        }`,
      );
    }
    const reminderResult = await scheduleAppointmentReminder(
      (appointmentResult.data as unknown as AppointmentRow).id,
    );
    if (reminderResult.status === "failed") {
      hasDeliveryWarning = true;
      setError(
        `Appointment saved. Reminder email was not scheduled${
          reminderResult.error || reminderResult.reason
            ? `: ${reminderResult.error || reminderResult.reason}`
            : "."
        }`,
      );
    }
    if (!hasDeliveryWarning) {
      setMessage(
        `Appointment saved. Confirmation email sent${
          reminderResult.status === "scheduled" ? " and reminder scheduled" : ""
        }.`,
      );
    }
    setDraftAppointment(null);
    setSaving(false);
  }

  async function updateAppointment(appointment: Appointment, form: AppointmentEditForm) {
    if (minutesFromStart(form.end) <= minutesFromStart(form.start)) {
      setModalError("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setModalError("");
    setError("");
    setMessage("");
    const oldStartsAt = appointment.startsAt;
    const oldEndsAt = appointment.endsAt;
    const nextStartsAt = timestampFor(selectedDate, form.start);
    const nextEndsAt = timestampFor(selectedDate, form.end);
    const timeChanged = oldStartsAt !== nextStartsAt || oldEndsAt !== nextEndsAt;

    const appointmentResult = await supabase
      .from("appointments")
      .update({
        starts_at: nextStartsAt,
        ends_at: nextEndsAt,
        appointment_type: form.type,
        status: form.status,
        notes: form.notes.trim() || null,
      })
      .eq("id", appointment.id)
      .select(
        "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject, waiver_signed), artist:staff(display_name)",
      )
      .single();

    if (appointmentResult.error) {
      setModalError(appointmentResult.error.message);
      setSaving(false);
      return;
    }

    const updatedAppointment = mapAppointment(appointmentResult.data as unknown as AppointmentRow);

    setAppointments((current) =>
      updatedAppointment.status === "cancelled"
        ? current.filter((item) => item.id !== appointment.id)
        : current.map((item) => (item.id === appointment.id ? updatedAppointment : item)),
    );
    if (timeChanged && updatedAppointment.status !== "cancelled") {
      const emailResult = await sendAppointmentReschedule(appointment.id, {
        oldStartsAt,
        oldEndsAt,
      });

      if (!emailResult.sent) {
        setModalError(
          `Appointment updated. Reschedule email was not sent${
            emailResult.error || emailResult.reason
              ? `: ${emailResult.error || emailResult.reason}`
              : "."
          }`,
        );
        setSelectedAppointment(updatedAppointment);
        setSaving(false);
        return;
      }
    }
    if (updatedAppointment.status === "cancelled") {
      await cancelAppointmentReminder(appointment.id);
    } else if (timeChanged) {
      const reminderResult = await scheduleAppointmentReminder(appointment.id);

      if (reminderResult.status === "failed") {
        setModalError(
          `Appointment updated. Reminder email was not scheduled${
            reminderResult.error || reminderResult.reason
              ? `: ${reminderResult.error || reminderResult.reason}`
              : "."
          }`,
        );
        setSelectedAppointment(updatedAppointment);
        setSaving(false);
        return;
      }
    }
    setSelectedAppointment(updatedAppointment.status === "cancelled" ? null : updatedAppointment);
    setMessage(
      updatedAppointment.status === "cancelled"
        ? "Appointment marked cancelled and reminder cancelled."
        : `Appointment updated${timeChanged ? ". Reschedule email sent" : ""}.`,
    );
    setSaving(false);
  }

  async function cancelAppointment(appointment: Appointment) {
    const confirmed = window.confirm(`Cancel appointment for ${appointment.client}?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setModalError("");
    setError("");
    setMessage("");

    const result = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id)
      .select(
        "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject, waiver_signed), artist:staff(display_name)",
      )
      .single();

    if (result.error) {
      setModalError(result.error.message);
      setSaving(false);
      return;
    }

    const cancelledAppointment = mapAppointment(result.data as unknown as AppointmentRow);
    setAppointments((current) => current.filter((item) => item.id !== cancelledAppointment.id));
    await cancelAppointmentReminder(appointment.id);
    const emailResult = await sendAppointmentCancellation(appointment.id);

    if (!emailResult.sent) {
      setModalError(
        `Appointment cancelled. Cancellation email was not sent${
          emailResult.error || emailResult.reason
            ? `: ${emailResult.error || emailResult.reason}`
            : "."
        }`,
      );
      setSelectedAppointment(null);
      setSaving(false);
      return;
    }

    setSelectedAppointment(null);
    setMessage("Appointment cancelled. Cancellation email sent.");
    setSaving(false);
  }

  async function deleteAppointment(appointment: Appointment) {
    const confirmed = window.confirm(
      `Delete appointment for ${appointment.client}? No cancellation email will be sent.`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setModalError("");
    setError("");
    setMessage("");

    await cancelAppointmentReminder(appointment.id);
    const result = await supabase.from("appointments").delete().eq("id", appointment.id);

    if (result.error) {
      setModalError(result.error.message);
      setSaving(false);
      return;
    }

    setAppointments((current) => current.filter((item) => item.id !== appointment.id));
    setSelectedAppointment(null);
    setMessage("Appointment deleted. No email sent.");
    setSaving(false);
  }

  return (
    <AppPage
      eyebrow="Appointments"
      title="Calendar and booking"
      wide
      actions={
        isArtistUser ? null : (
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={artists.length === 0}
          onClick={() => {
            const artist = visibleArtists[0] ?? artists[0];

            if (artist) {
              setMessage("");
              setDraftAppointment({
                artistId: artist.id,
                artist: artist.display_name,
                date: selectedDate,
                start: "12:00",
                end: endTimeFromStart("12:00", artist.default_session_duration_minutes ?? 120),
                defaultDurationMinutes: artist.default_session_duration_minutes ?? 120,
              });
            }
          }}
          type="button"
        >
          New appointment
        </button>
        )
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading calendar...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && message ? (
        <div className="rounded-md border border-[#c8d8c1] bg-[#f1f7ee] px-4 py-3 text-sm font-semibold text-[#356237] shadow-sm">
          {message}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6 xl:min-w-80">
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <h3 className="text-base font-semibold">Filters</h3>
              <div className="mt-4 space-y-3">
                <div className="block text-sm font-semibold">
                  Date
                  <div className="mt-2">
                    <MiniDatePicker
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedAppointment(null);
                        setDraftAppointment(null);
                        setModalError("");
                        setMessage("");
                      }}
                      selectedDate={selectedDate}
                    />
                  </div>
                  <input
                    className="sr-only"
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedAppointment(null);
                      setDraftAppointment(null);
                      setModalError("");
                      setMessage("");
                    }}
                    type="date"
                    value={selectedDate}
                  />
                </div>
                {!isArtistUser ? (
                <label className="block text-sm font-semibold">
                  Artist
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setArtistFilter(event.target.value)}
                    value={artistFilter}
                  >
                    <option className="hidden md:block" value="all">
                      All calendar staff
                    </option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <h3 className="text-base font-semibold">Calendar model</h3>
              <div className="mt-4 space-y-3 text-sm text-[#4d555c]">
                <p>Each artist has a separate column.</p>
                <p>Card position is based on start time.</p>
                <p>Card height is based on appointment length.</p>
                <p>Grey areas are outside the artist&apos;s tattoo schedule.</p>
              </div>
            </div>
          </aside>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-4 py-4">
              <div>
                <h3 className="text-base font-semibold">{formatDateLabel(selectedDate)}</h3>
                <p className="mt-1 text-sm text-[#697178]">Artist timeline, 12:00 PM - 12:00 AM</p>
              </div>
              <span className="rounded-md bg-[#f1eadc] px-2 py-1 text-xs font-semibold text-[#775f36]">
                {visibleAppointments.length} appointments
              </span>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div style={{ minWidth: `${Math.max(visibleArtists.length, 1) * 150 + 76}px` }}>
                <div
                  className="border-b border-[#e5dfd4] bg-[#f7f2e9]"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `76px repeat(${Math.max(visibleArtists.length, 1)}, minmax(132px, 1fr))`,
                  }}
                >
                  <div className="px-3 py-3 text-xs font-semibold uppercase text-[#6f7275]">
                    Time
                  </div>
                  {visibleArtists.map((artist) => {
                    const schedule = dailySchedules[artist.id] ?? {
                      available: false,
                      start: "10:00",
                      end: "18:00",
                    };

                    return (
                      <div
                        key={artist.id}
                        className="border-l border-[#e5dfd4] px-3 py-3 text-center text-xs font-bold uppercase text-[#4d555c]"
                      >
                        <span className="block">{artist.display_name}</span>
                        <span className="mt-1 block text-[10px] font-semibold normal-case text-[#8a6f4d]">
                          {scheduleLabel(schedule)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {visibleArtists.length === 0 ? (
                  <div className="flex h-72 items-center justify-center border-t border-[#eee8dd] px-4 text-center text-sm font-semibold text-[#697178]">
                    No staff are enabled for Calendar / Booking.
                  </div>
                ) : null}

                <div
                  className={`relative ${visibleArtists.length === 0 ? "hidden" : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `76px repeat(${Math.max(visibleArtists.length, 1)}, minmax(132px, 1fr))`,
                    height: `${timelineHeight}px`,
                  }}
                >
                  {currentTimeTop !== null ? (
                    <div
                      className="pointer-events-none absolute right-0 z-30 border-t-2 border-[#d33b2f]"
                      style={{ left: "76px", top: `${currentTimeTop}px` }}
                    >
                      <span className="absolute -left-[38px] -top-[9px] rounded bg-[#d33b2f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Now
                      </span>
                    </div>
                  ) : null}
                  <div className="relative border-r border-[#e5dfd4] bg-[#fdfbf7]">
                    {hourMarkers.map((marker) => (
                      <p
                        key={marker.label}
                        className="absolute left-3 text-xs font-semibold text-[#697178]"
                        style={{ top: `${marker.top - 7}px` }}
                      >
                        {marker.label}
                      </p>
                    ))}
                  </div>

                  {visibleArtists.map((artist) => {
                    const schedule = dailySchedules[artist.id] ?? {
                      available: false,
                      start: "10:00",
                      end: "18:00",
                    };
                    const availableStyle = scheduleStyle(schedule);

                    return (
                      <div
                        key={artist.id}
                        className="relative border-l border-[#eee8dd] bg-[#eee8dd]"
                        onClick={(event) => {
                          const draft = draftFromClick(
                            artist,
                            selectedDate,
                            event,
                            timeInterval,
                            artist.default_session_duration_minutes ?? 120,
                          );

                          if (isWithinSchedule(schedule, draft.start, draft.end)) {
                            setModalError("");
                            setMessage("");
                            setDraftAppointment(draft);
                          }
                        }}
                        role="presentation"
                      >
                        {schedule.available ? (
                          <div
                            className="absolute left-0 right-0 bg-white"
                            style={{
                              ...availableStyle,
                              backgroundImage:
                                "linear-gradient(to bottom, transparent 87px, #eee8dd 88px)",
                              backgroundSize: `100% ${pixelsPerHour}px`,
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-[#8a8174]">
                            Off schedule
                          </div>
                        )}

                        {appointmentsForArtist(artist.id).map((appointment) => {
                          const inSchedule = isWithinSchedule(
                            schedule,
                            appointment.start,
                            appointment.end,
                          );
                          const isCancelled = appointment.status === "cancelled";

                          return (
                            <button
                              key={appointment.id}
                              className={`absolute left-2 right-2 overflow-hidden rounded-md border px-2 py-2 text-left text-xs shadow-sm transition hover:border-[#9f5c3c] hover:bg-[#fffaf1] ${
                                isCancelled
                                  ? "border-[#d9c7c7] bg-[#f8eeee] opacity-80"
                                  : inSchedule
                                    ? "border-[#e4dccf] bg-[#fdfbf7]"
                                    : "border-[#c66f5a] bg-[#fff2ed]"
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setModalError("");
                                setMessage("");
                                setSelectedAppointment(appointment);
                              }}
                              style={appointmentStyle(appointment.start, appointment.end)}
                              type="button"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold leading-4">{appointment.client}</p>
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(
                                    appointment.status,
                                  )}`}
                                >
                                  {statusLabel(appointment.status)}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[#4d555c]">
                                {appointment.project}
                              </p>
                              <p className="mt-1 font-semibold text-[#7d684d]">
                                {formatTime(appointment.start)} - {formatTime(appointment.end)}
                              </p>
                              {!isCancelled && !inSchedule ? (
                                <p className="mt-1 text-[10px] font-bold uppercase text-[#9f5c3c]">
                                  Outside schedule
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="md:hidden">
              <div style={{ minWidth: `${Math.max(mobileVisibleArtists.length, 1) * 132 + 76}px` }}>
                <div
                  className="border-b border-[#e5dfd4] bg-[#f7f2e9]"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `76px repeat(${Math.max(mobileVisibleArtists.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="px-3 py-3 text-xs font-semibold uppercase text-[#6f7275]">
                    Time
                  </div>
                  {mobileVisibleArtists.map((artist) => {
                    const schedule = dailySchedules[artist.id] ?? {
                      available: false,
                      start: "10:00",
                      end: "18:00",
                    };

                    return (
                      <div
                        key={artist.id}
                        className="border-l border-[#e5dfd4] px-3 py-3 text-center text-xs font-bold uppercase text-[#4d555c]"
                      >
                        <span className="block">{artist.display_name}</span>
                        <span className="mt-1 block text-[10px] font-semibold normal-case text-[#8a6f4d]">
                          {scheduleLabel(schedule)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {mobileVisibleArtists.length === 0 ? (
                  <div className="flex h-72 items-center justify-center border-t border-[#eee8dd] px-4 text-center text-sm font-semibold text-[#697178]">
                    No staff are enabled for Calendar / Booking.
                  </div>
                ) : null}

                <div
                  className={`relative ${mobileVisibleArtists.length === 0 ? "hidden" : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `76px repeat(${Math.max(mobileVisibleArtists.length, 1)}, minmax(0, 1fr))`,
                    height: `${timelineHeight}px`,
                  }}
                >
                  {currentTimeTop !== null ? (
                    <div
                      className="pointer-events-none absolute right-0 z-30 border-t-2 border-[#d33b2f]"
                      style={{ left: "76px", top: `${currentTimeTop}px` }}
                    >
                      <span className="absolute -left-[38px] -top-[9px] rounded bg-[#d33b2f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Now
                      </span>
                    </div>
                  ) : null}
                  <div className="relative border-r border-[#e5dfd4] bg-[#fdfbf7]">
                    {hourMarkers.map((marker) => (
                      <p
                        key={marker.label}
                        className="absolute left-3 text-xs font-semibold text-[#697178]"
                        style={{ top: `${marker.top - 7}px` }}
                      >
                        {marker.label}
                      </p>
                    ))}
                  </div>

                  {mobileVisibleArtists.map((artist) => {
                    const schedule = dailySchedules[artist.id] ?? {
                      available: false,
                      start: "10:00",
                      end: "18:00",
                    };
                    const availableStyle = scheduleStyle(schedule);

                    return (
                      <div
                        key={artist.id}
                        className="relative border-l border-[#eee8dd] bg-[#eee8dd]"
                        onClick={(event) => {
                          const draft = draftFromClick(
                            artist,
                            selectedDate,
                            event,
                            timeInterval,
                            artist.default_session_duration_minutes ?? 120,
                          );

                          if (isWithinSchedule(schedule, draft.start, draft.end)) {
                            setModalError("");
                            setMessage("");
                            setDraftAppointment(draft);
                          }
                        }}
                        role="presentation"
                      >
                        {schedule.available ? (
                          <div
                            className="absolute left-0 right-0 bg-white"
                            style={{
                              ...availableStyle,
                              backgroundImage:
                                "linear-gradient(to bottom, transparent 87px, #eee8dd 88px)",
                              backgroundSize: `100% ${pixelsPerHour}px`,
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-[#8a8174]">
                            Off schedule
                          </div>
                        )}

                        {appointmentsForArtist(artist.id).map((appointment) => {
                          const inSchedule = isWithinSchedule(
                            schedule,
                            appointment.start,
                            appointment.end,
                          );
                          const isCancelled = appointment.status === "cancelled";

                          return (
                            <button
                              key={appointment.id}
                              className={`absolute left-2 right-2 overflow-hidden rounded-md border px-2 py-2 text-left text-xs shadow-sm transition hover:border-[#9f5c3c] hover:bg-[#fffaf1] ${
                                isCancelled
                                  ? "border-[#d9c7c7] bg-[#f8eeee] opacity-80"
                                  : inSchedule
                                    ? "border-[#e4dccf] bg-[#fdfbf7]"
                                    : "border-[#c66f5a] bg-[#fff2ed]"
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setModalError("");
                                setMessage("");
                                setSelectedAppointment(appointment);
                              }}
                              style={appointmentStyle(appointment.start, appointment.end)}
                              type="button"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold leading-4">{appointment.client}</p>
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(
                                    appointment.status,
                                  )}`}
                                >
                                  {statusLabel(appointment.status)}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[#4d555c]">
                                {appointment.project}
                              </p>
                              <p className="mt-1 font-semibold text-[#7d684d]">
                                {formatTime(appointment.start)} - {formatTime(appointment.end)}
                              </p>
                              {!isCancelled && !inSchedule ? (
                                <p className="mt-1 text-[10px] font-bold uppercase text-[#9f5c3c]">
                                  Outside schedule
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {selectedAppointment ? (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          error={modalError}
          onCancel={cancelAppointment}
          onClose={() => {
            setSelectedAppointment(null);
            setModalError("");
          }}
          onDelete={deleteAppointment}
          onSave={updateAppointment}
          saving={saving}
        />
      ) : null}

      {draftAppointment ? (
        <NewAppointmentModal
          draft={draftAppointment}
          error={modalError}
          onClose={() => setDraftAppointment(null)}
          customers={customers}
          projects={draftProjects}
          onSave={saveAppointment}
          saving={saving}
        />
      ) : null}
    </AppPage>
  );
}

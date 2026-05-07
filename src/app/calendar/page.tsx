"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
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
  start: string;
  end: string;
};

const dayStartHour = 12;
const dayEndHour = 24;
const pixelsPerHour = 88;
const timelineHeight = (dayEndHour - dayStartHour) * pixelsPerHour;
const defaultDate = "2026-05-03";

const appointmentTypes = [
  "Walk-in",
  "One-Done",
  "On-Going",
];

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
): DraftAppointment {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = Math.max(0, Math.min(event.clientY - rect.top, timelineHeight));
  const rawMinutes = (y / pixelsPerHour) * 60;
  const startMinutes = Math.min(
    Math.round(rawMinutes / 30) * 30,
    (dayEndHour - dayStartHour - 1) * 60,
  );
  const endMinutes = Math.min(startMinutes + 60, (dayEndHour - dayStartHour) * 60);

  return {
    artistId: artist.id,
    artist: artist.display_name,
    date,
    start: minutesToTime(startMinutes),
    end: minutesToTime(endMinutes),
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
    client: customer?.name ?? "Unknown customer",
    project: project?.subject ?? "Untitled project",
    artistId: row.artist_id ?? "",
    artist: artist?.display_name ?? "Unassigned",
    type: row.appointment_type,
    status: row.status,
    waiver: project?.waiver_signed ? "Signed" : "Missing",
    notes: row.notes ?? "",
  };
}

function canShowInCalendar(staff: StaffRecord, permissionRows: StaffPermission[]) {
  const bookingPermission = permissionRows.find(
    (permission) =>
      permission.staff_id === staff.id && permission.permission_key === "calendarBooking",
  );

  if (bookingPermission) {
    return bookingPermission.enabled;
  }

  return staff.role === "Artist";
}

function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
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

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Artist</p>
              <p className="mt-1 font-semibold">{appointment.artist}</p>
            </div>
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Time</p>
              <p className="mt-1 font-semibold">
                {formatTime(appointment.start)} - {formatTime(appointment.end)}
              </p>
            </div>
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Type</p>
              <p className="mt-1 font-semibold">{appointment.type}</p>
            </div>
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Waiver</p>
              <p className="mt-1 font-semibold">{appointment.waiver}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Notes</h4>
            <p className="mt-2 rounded-md bg-[#f7f2e9] px-3 py-3 text-sm text-[#4d555c]">
              {appointment.notes || "No notes yet."}
            </p>
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
  const firstProject = projects[0];
  const firstCustomer = customers[0];
  const [form, setForm] = useState<NewAppointmentForm>({
    mode: firstProject ? "project" : "walk_in",
    customerId: firstProject?.customer_id ?? "",
    projectId: firstProject?.id ?? "",
    customerMode: firstCustomer ? "existing" : "new",
    newCustomerName: "",
    newCustomerEmail: "",
    newCustomerPhone: "",
    projectSubject: "",
    type: "Walk-in",
    notes: "",
    start: draft.start,
    end: draft.end,
  });
  const selectedProject = projects.find((project) => project.id === form.projectId) ?? firstProject;
  const selectedProjectCustomer = relatedOne(selectedProject?.customer ?? null);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) ?? firstCustomer;
  const canUseExistingCustomer = customers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New appointment</p>
            <h3 className="mt-1 text-xl font-semibold">
              {draft.artist} / {formatTime(form.start)}
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

        <div className="max-h-[75vh] space-y-3 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">
              Artist
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-[#f7f2e9] px-3 text-sm"
                readOnly
                value={draft.artist}
              />
            </label>
            <label className="text-sm font-semibold">
              Start
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                type="time"
                value={form.start}
              />
            </label>
            <label className="text-sm font-semibold">
              End
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                type="time"
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
                const project = projects[0];

                setForm((current) => ({
                  ...current,
                  mode,
                  projectId: mode === "project" ? project?.id ?? "" : "",
                  customerId:
                    mode === "project"
                      ? project?.customer_id ?? ""
                      : current.customerId || (firstCustomer?.id ?? ""),
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

                    setForm((current) => ({
                      ...current,
                      projectId: event.target.value,
                      customerId: project?.customer_id ?? "",
                    }));
                  }}
                  value={form.projectId}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.subject}
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
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerMode: event.target.value as NewAppointmentForm["customerMode"],
                        customerId:
                          event.target.value === "existing"
                            ? current.customerId || (firstCustomer?.id ?? "")
                            : "",
                      }))
                    }
                    value={form.customerMode}
                  >
                    {canUseExistingCustomer ? <option value="existing">Existing customer</option> : null}
                    <option value="new">New customer</option>
                  </select>
                </label>
                {form.customerMode === "existing" ? (
                  <label className="block text-sm font-semibold">
                    Select customer
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, customerId: event.target.value }))
                      }
                      value={form.customerId || (firstCustomer?.id ?? "")}
                    >
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
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
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [artistFilter, setArtistFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [draftAppointment, setDraftAppointment] = useState<DraftAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const visibleArtists = useMemo(() => {
    if (artistFilter === "all") {
      return artists;
    }

    return artists.filter((artist) => artist.id === artistFilter);
  }, [artistFilter, artists]);

  const visibleAppointments = useMemo(() => {
    if (typeFilter === "all") {
      return appointments;
    }

    return appointments.filter((appointment) => appointment.type === typeFilter);
  }, [appointments, typeFilter]);

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

  useEffect(() => {
    async function loadCalendar() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError("Please log in to view the calendar.");
        setLoading(false);
        return;
      }

      const dayStart = timestampFor(selectedDate, "00:00");
      const dayEnd = timestampFor(selectedDate, "23:59");

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
          .select("id, display_name, role, active")
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
          .select("id, customer_id, artist_id, subject, status, customer:customers(name, email)")
          .neq("status", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select(
            "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject, waiver_signed), artist:staff(display_name)",
          )
          .gte("starts_at", dayStart)
          .lte("starts_at", dayEnd)
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

      setArtists((staffResult.data ?? []).filter((staff) => canShowInCalendar(staff, nextPermissions)));
      setCustomers((customerResult.data ?? []) as CustomerRecord[]);
      setProjects((projectResult.data ?? []) as unknown as ProjectRecord[]);
      setSchedules(scheduleResult.data ?? []);
      setAppointments(((appointmentResult.data ?? []) as unknown as AppointmentRow[]).map(mapAppointment));
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
          status: "booked",
          waiver_signed: false,
          waiver_status: "missing",
          memo: `Auto-created from calendar walk-in for ${formatDateLabel(draftAppointment.date)}.`,
        })
        .select("id, customer_id, artist_id, subject, status, customer:customers(name, email)")
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
        starts_at: timestampFor(draftAppointment.date, form.start),
        ends_at: timestampFor(draftAppointment.date, form.end),
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

    setAppointments((current) => [
      ...current,
      mapAppointment(appointmentResult.data as unknown as AppointmentRow),
    ]);
    setDraftAppointment(null);
    setSaving(false);
  }

  return (
    <AppShell
      active="Calendar"
      eyebrow="Appointments"
      title="Calendar and booking"
      description="Book tattoo sessions by artist. Staff schedules now come from Supabase."
      actions={
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={artists.length === 0}
          onClick={() => {
            const artist = visibleArtists[0] ?? artists[0];

            if (artist) {
              setDraftAppointment({
                artistId: artist.id,
                artist: artist.display_name,
                date: selectedDate,
                start: "12:00",
                end: "13:00",
              });
            }
          }}
          type="button"
        >
          New appointment
        </button>
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

      {!loading && !error ? (
        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.65fr]">
          <aside className="space-y-6">
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <h3 className="text-base font-semibold">Filters</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold">
                  Date
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setSelectedDate(event.target.value)}
                    type="date"
                    value={selectedDate}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Artist
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setArtistFilter(event.target.value)}
                    value={artistFilter}
                  >
                    <option value="all">All calendar staff</option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Appointment type
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setTypeFilter(event.target.value)}
                    value={typeFilter}
                  >
                    <option value="all">All types</option>
                    {appointmentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
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

            <div className="overflow-x-auto">
              <div style={{ minWidth: `${Math.max(visibleArtists.length, 1) * 132 + 76}px` }}>
                <div
                  className="border-b border-[#e5dfd4] bg-[#f7f2e9]"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `76px repeat(${Math.max(visibleArtists.length, 1)}, minmax(112px, 1fr))`,
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
                    gridTemplateColumns: `76px repeat(${Math.max(visibleArtists.length, 1)}, minmax(112px, 1fr))`,
                    height: `${timelineHeight}px`,
                  }}
                >
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
                          const draft = draftFromClick(artist, selectedDate, event);

                          if (isWithinSchedule(schedule, draft.start, draft.end)) {
                            setModalError("");
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

                          return (
                            <button
                              key={appointment.id}
                              className={`absolute left-2 right-2 overflow-hidden rounded-md border px-2 py-2 text-left text-xs shadow-sm transition hover:border-[#9f5c3c] hover:bg-[#fffaf1] ${
                                inSchedule
                                  ? "border-[#e4dccf] bg-[#fdfbf7]"
                                  : "border-[#c66f5a] bg-[#fff2ed]"
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
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
                              {!inSchedule ? (
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
          onClose={() => setSelectedAppointment(null)}
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
    </AppShell>
  );
}

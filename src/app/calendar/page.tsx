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
  customer: string;
  project: string;
  type: string;
  notes: string;
  start: string;
  end: string;
};

const dayStartHour = 10;
const dayEndHour = 18;
const pixelsPerHour = 88;
const timelineHeight = (dayEndHour - dayStartHour) * pixelsPerHour;
const defaultDate = "2026-05-03";

const appointmentTypes = [
  "Consultation",
  "Walk-in",
  "One-Done",
  "On-Going",
  "Closing",
  "Deposit",
];

const hourMarkers = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => {
  const hour = dayStartHour + index;
  const displayHour = hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? "PM" : "AM";

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
  return (hour - dayStartHour) * 60 + minute;
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

  const startMinutes = minutesFromStart(schedule.start);
  const endMinutes = minutesFromStart(schedule.end);

  return {
    top: `${(startMinutes / 60) * pixelsPerHour}px`,
    height: `${Math.max(((endMinutes - startMinutes) / 60) * pixelsPerHour, 0)}px`,
  };
}

function formatTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const displayHour = hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? "PM" : "AM";

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

function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

function timestampFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
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
  saving,
  error,
  onClose,
  onSave,
}: {
  draft: DraftAppointment;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: NewAppointmentForm) => void;
}) {
  const [form, setForm] = useState<NewAppointmentForm>({
    customer: "",
    project: "",
    type: "Consultation",
    notes: "",
    start: draft.start,
    end: draft.end,
  });

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

        <div className="space-y-3 px-5 py-5">
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

          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value }))}
            placeholder="Customer"
            value={form.customer}
          />
          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}
            placeholder="Project"
            value={form.project}
          />
          <select
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            value={form.type}
          >
            {appointmentTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
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

      const [staffResult, scheduleResult, appointmentResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, display_name, role, active")
          .eq("active", true)
          .in("role", ["Artist", "Owner", "Admin"])
          .order("sort_order", { ascending: true }),
        supabase
          .from("staff_schedules")
          .select("staff_id, day_of_week, available, starts_at, ends_at"),
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

      if (appointmentResult.error) {
        setError(appointmentResult.error.message);
        setLoading(false);
        return;
      }

      setArtists(staffResult.data ?? []);
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

    const customerName = form.customer.trim();
    const projectSubject = form.project.trim();

    if (!customerName || !projectSubject) {
      setModalError("Customer and project are required.");
      return;
    }

    if (minutesFromStart(form.end) <= minutesFromStart(form.start)) {
      setModalError("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setModalError("");

    const customerResult = await supabase
      .from("customers")
      .insert({ name: customerName })
      .select("id, name")
      .single();

    if (customerResult.error) {
      setModalError(customerResult.error.message);
      setSaving(false);
      return;
    }

    const projectResult = await supabase
      .from("projects")
      .insert({
        customer_id: customerResult.data.id,
        artist_id: draftAppointment.artistId,
        subject: projectSubject,
        session_type: form.type,
        status: "booked",
      })
      .select("id, subject, waiver_signed")
      .single();

    if (projectResult.error) {
      setModalError(projectResult.error.message);
      setSaving(false);
      return;
    }

    const appointmentResult = await supabase
      .from("appointments")
      .insert({
        project_id: projectResult.data.id,
        customer_id: customerResult.data.id,
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
      description="Book consultations and tattoo sessions by artist. Staff schedules now come from Supabase."
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
                start: "10:00",
                end: "11:00",
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
                    <option value="all">All artists</option>
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
                <p className="mt-1 text-sm text-[#697178]">Artist timeline, 10:00 AM - 6:00 PM</p>
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

                <div
                  className="relative"
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
          onSave={saveAppointment}
          saving={saving}
        />
      ) : null}
    </AppShell>
  );
}

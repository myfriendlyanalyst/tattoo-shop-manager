"use client";

import { useState, type MouseEvent } from "react";
import { AppShell } from "@/components/app-shell";

type Appointment = {
  start: string;
  end: string;
  client: string;
  project: string;
  artist: string;
  type: string;
  status: string;
  deposit: string;
  waiver: string;
  notes: string;
};

type DraftAppointment = {
  artist: string;
  start: string;
  end: string;
};

type ArtistSchedule = {
  available: boolean;
  start: string;
  end: string;
};

const artists = [
  "YUSHI",
  "BAKI",
  "QSUN",
  "JC",
  "AIMEE",
  "PHANGS",
  "LESLIE",
  "Mina",
  "Alex",
  "Sam",
];

const dayStartHour = 10;
const dayEndHour = 18;
const pixelsPerHour = 88;
const timelineHeight = (dayEndHour - dayStartHour) * pixelsPerHour;

const sundaySchedules: Record<string, ArtistSchedule> = {
  YUSHI: { available: false, start: "", end: "" },
  BAKI: { available: true, start: "11:00", end: "16:00" },
  QSUN: { available: false, start: "", end: "" },
  JC: { available: false, start: "", end: "" },
  AIMEE: { available: true, start: "12:00", end: "17:00" },
  PHANGS: { available: true, start: "13:00", end: "18:00" },
  LESLIE: { available: false, start: "", end: "" },
  Mina: { available: true, start: "10:00", end: "15:00" },
  Alex: { available: true, start: "12:00", end: "18:00" },
  Sam: { available: false, start: "", end: "" },
};

const appointments: Appointment[] = [
  {
    start: "10:30",
    end: "11:00",
    client: "Mina David",
    project: "Fine line floral sleeve",
    artist: "JC",
    type: "Consultation",
    status: "Scheduled",
    deposit: "No deposit",
    waiver: "Missing",
    notes: "Converted from REQ-1046. Client prefers afternoon follow-up.",
  },
  {
    start: "11:00",
    end: "13:00",
    client: "Armando Gonzales",
    project: "Vagabond",
    artist: "JC",
    type: "On-Going",
    status: "Checked-in",
    deposit: "$180 available",
    waiver: "Signed",
    notes: "First session outline. Confirm deposit before closing session.",
  },
  {
    start: "13:00",
    end: "17:00",
    client: "Sora Kim",
    project: "Dragon sleeve",
    artist: "YUSHI",
    type: "One-Done",
    status: "Scheduled",
    deposit: "$250 available",
    waiver: "Missing",
    notes: "Long appointment block: 1:00 PM to 5:00 PM.",
  },
  {
    start: "13:30",
    end: "15:00",
    client: "Leo Grant",
    project: "Walk-in flash",
    artist: "BAKI",
    type: "Walk-in",
    status: "Scheduled",
    deposit: "No deposit",
    waiver: "Signed",
    notes: "Same day overlap with another artist is normal.",
  },
  {
    start: "14:00",
    end: "15:00",
    client: "Nora Lee",
    project: "Color flower thigh",
    artist: "AIMEE",
    type: "Consultation",
    status: "Scheduled",
    deposit: "No deposit",
    waiver: "Missing",
    notes: "Short consultation that overlaps with longer artist blocks.",
  },
  {
    start: "14:30",
    end: "16:30",
    client: "Chris Morgan",
    project: "Cover up review",
    artist: "PHANGS",
    type: "On-Going",
    status: "Scheduled",
    deposit: "$200 available",
    waiver: "Signed",
    notes: "Two-hour project review and touch-up.",
  },
  {
    start: "16:00",
    end: "16:30",
    client: "Nina Park",
    project: "Minimal crescent",
    artist: "AIMEE",
    type: "Deposit",
    status: "Scheduled",
    deposit: "$150 due",
    waiver: "Not needed yet",
    notes: "Deposit appointment only. Schedule tattoo date after payment.",
  },
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

function statusClasses(status: string) {
  const variants: Record<string, string> = {
    Scheduled: "bg-[#e5edf4] text-[#315f82]",
    "Checked-in": "bg-[#e8f0ee] text-[#2f6658]",
    Completed: "bg-[#e4f1df] text-[#476b33]",
    Cancelled: "bg-[#f3e1e1] text-[#8a3030]",
    "No-show": "bg-[#f4e7df] text-[#8a5130]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function appointmentsForArtist(artist: string) {
  return appointments.filter((appointment) => appointment.artist === artist);
}

function isWithinSchedule(artist: string, start: string, end: string) {
  const schedule = sundaySchedules[artist];

  if (!schedule?.available) {
    return false;
  }

  const startMinutes = minutesFromStart(start);
  const endMinutes = minutesFromStart(end);
  const scheduleStart = minutesFromStart(schedule.start);
  const scheduleEnd = minutesFromStart(schedule.end);

  return startMinutes >= scheduleStart && endMinutes <= scheduleEnd;
}

function draftFromClick(artist: string, event: MouseEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = Math.max(0, Math.min(event.clientY - rect.top, timelineHeight));
  const rawMinutes = (y / pixelsPerHour) * 60;
  const startMinutes = Math.min(Math.round(rawMinutes / 30) * 30, (dayEndHour - dayStartHour - 1) * 60);
  const endMinutes = Math.min(startMinutes + 60, (dayEndHour - dayStartHour) * 60);

  return {
    artist,
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
              <p className="text-[#697178]">Deposit</p>
              <p className="mt-1 font-semibold">{appointment.deposit}</p>
            </div>
            <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
              <p className="text-[#697178]">Waiver</p>
              <p className="mt-1 font-semibold">{appointment.waiver}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Notes</h4>
            <p className="mt-2 rounded-md bg-[#f7f2e9] px-3 py-3 text-sm text-[#4d555c]">
              {appointment.notes}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
              type="button"
            >
              Reschedule
            </button>
            <button
              className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
              type="button"
            >
              Artist entry
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function NewAppointmentModal({
  draft,
  onClose,
}: {
  draft: DraftAppointment;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New appointment</p>
            <h3 className="mt-1 text-xl font-semibold">
              {draft.artist} / {formatTime(draft.start)}
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
                defaultValue={draft.start}
                type="time"
              />
            </label>
            <label className="text-sm font-semibold">
              End
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                defaultValue={draft.end}
                type="time"
              />
            </label>
          </div>

          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            placeholder="Customer"
          />
          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            placeholder="Project"
          />
          <select className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
            <option>Consultation</option>
            <option>Walk-in</option>
            <option>One-Done</option>
            <option>On-Going</option>
            <option>Closing</option>
            <option>Deposit</option>
          </select>
          <button
            className="h-10 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            onClick={onClose}
            type="button"
          >
            Save appointment
          </button>
        </div>
      </section>
    </div>
  );
}

export default function CalendarPage() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [draftAppointment, setDraftAppointment] = useState<DraftAppointment | null>(null);

  return (
    <AppShell
      active="Calendar"
      eyebrow="Appointments"
      title="Calendar and booking"
      description="Book consultations and tattoo sessions by artist. Click a booking for details, or click an open position in an artist column to create an appointment there."
      actions={
        <>
          <button
            className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            onClick={() => setDraftAppointment({ artist: "JC", start: "10:00", end: "11:00" })}
            type="button"
          >
            Book consultation
          </button>
          <button
            className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            onClick={() => setDraftAppointment({ artist: "YUSHI", start: "10:00", end: "11:00" })}
            type="button"
          >
            New appointment
          </button>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.65fr]">
        <aside className="space-y-6">
          <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <h3 className="text-base font-semibold">Filters</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Date
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="2026-05-03"
                  type="date"
                />
              </label>
              <label className="block text-sm font-semibold">
                Artist
                <select className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
                  <option>All artists</option>
                  {artists.map((artist) => (
                    <option key={artist}>{artist}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Appointment type
                <select className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
                  <option>All types</option>
                  <option>Consultation</option>
                  <option>Walk-in</option>
                  <option>One-Done</option>
                  <option>On-Going</option>
                  <option>Closing</option>
                  <option>Deposit</option>
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
              <h3 className="text-base font-semibold">Sunday, May 3</h3>
              <p className="mt-1 text-sm text-[#697178]">Artist timeline, 10:00 AM - 6:00 PM</p>
            </div>
            <span className="rounded-md bg-[#f1eadc] px-2 py-1 text-xs font-semibold text-[#775f36]">
              {appointments.length} appointments
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1280px]">
              <div className="grid grid-cols-[76px_repeat(10,minmax(112px,1fr))] border-b border-[#e5dfd4] bg-[#f7f2e9]">
                <div className="px-3 py-3 text-xs font-semibold uppercase text-[#6f7275]">
                  Time
                </div>
                {artists.map((artist) => (
                  <div
                    key={artist}
                    className="border-l border-[#e5dfd4] px-3 py-3 text-center text-xs font-bold uppercase text-[#4d555c]"
                  >
                    <span className="block">{artist}</span>
                    <span className="mt-1 block text-[10px] font-semibold normal-case text-[#8a6f4d]">
                      {scheduleLabel(sundaySchedules[artist])}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="relative grid grid-cols-[76px_repeat(10,minmax(112px,1fr))]"
                style={{ height: `${timelineHeight}px` }}
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

                {artists.map((artist) => {
                  const schedule = sundaySchedules[artist];
                  const availableStyle = scheduleStyle(schedule);

                  return (
                      <div
                        key={artist}
                        className="relative border-l border-[#eee8dd] bg-[#eee8dd]"
                        onClick={(event) => {
                          const draft = draftFromClick(artist, event);

                          if (isWithinSchedule(artist, draft.start, draft.end)) {
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

                        {appointmentsForArtist(artist).map((appointment) => {
                          const inSchedule = isWithinSchedule(
                            artist,
                            appointment.start,
                            appointment.end,
                          );

                          return (
                            <button
                              key={`${appointment.artist}-${appointment.start}-${appointment.client}`}
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
                                  {appointment.type}
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

      {selectedAppointment ? (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      ) : null}

      {draftAppointment ? (
        <NewAppointmentModal draft={draftAppointment} onClose={() => setDraftAppointment(null)} />
      ) : null}
    </AppShell>
  );
}

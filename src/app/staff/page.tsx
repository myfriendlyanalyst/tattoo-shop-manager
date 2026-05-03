"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  legal_name: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  start_date: string | null;
  active: boolean;
};

type StaffSchedule = {
  id: string;
  staff_id: string;
  day_of_week: number;
  available: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const permissions = [
  { key: "artistSchedule", label: "Artist Schedule" },
  { key: "session", label: "Session" },
  { key: "deposit", label: "Deposit" },
  { key: "merch", label: "Merch" },
  { key: "staffAdmin", label: "Staff Admin" },
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function roleClasses(role: string) {
  const variants: Record<string, string> = {
    Owner: "bg-[#1f2428] text-white",
    Admin: "bg-[#efe7f5] text-[#674b7a]",
    Artist: "bg-[#e8f0ee] text-[#2f6658]",
    "Front Desk": "bg-[#e5edf4] text-[#315f82]",
  };

  return variants[role] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function displayDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function normalizeTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function fallbackSchedule(dayOfWeek: number, staffId: string): StaffSchedule {
  return {
    id: `${staffId}-${dayOfWeek}`,
    staff_id: staffId,
    day_of_week: dayOfWeek,
    available: false,
    starts_at: null,
    ends_at: null,
  };
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStaff() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setLoading(false);
        setError("Please log in to view staff records.");
        return;
      }

      const [staffResult, scheduleResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, display_name, legal_name, role, email, phone, start_date, active")
          .order("sort_order", { ascending: true }),
        supabase
          .from("staff_schedules")
          .select("id, staff_id, day_of_week, available, starts_at, ends_at")
          .order("day_of_week", { ascending: true }),
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

      const nextStaff = staffResult.data ?? [];
      setStaff(nextStaff);
      setSchedules(scheduleResult.data ?? []);
      setSelectedStaffId((current) => current || nextStaff[0]?.id || "");
      setLoading(false);
    }

    loadStaff();
  }, []);

  const selectedStaff = useMemo(
    () => staff.find((person) => person.id === selectedStaffId) ?? staff[0],
    [selectedStaffId, staff],
  );

  const selectedSchedule = useMemo(() => {
    if (!selectedStaff) {
      return [];
    }

    return dayLabels.map((_, dayOfWeek) => {
      return (
        schedules.find(
          (schedule) =>
            schedule.staff_id === selectedStaff.id && schedule.day_of_week === dayOfWeek,
        ) ?? fallbackSchedule(dayOfWeek, selectedStaff.id)
      );
    });
  }, [schedules, selectedStaff]);

  return (
    <AppShell
      active="Staff"
      eyebrow="Access control"
      title="Staff and permissions"
      description="Manage artists, front desk users, and owner/admin access. Accounting permissions are handled by the separate accounting app and should not be granted to artist accounts."
      actions={
        <>
          <button
            className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            type="button"
          >
            Invite user
          </button>
          <button
            className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            type="button"
          >
            New staff
          </button>
        </>
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading staff records...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 shadow-sm">
          <p className="text-sm font-semibold text-[#8a3030]">{error}</p>
          <Link
            className="mt-4 inline-flex h-10 items-center rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
            href="/login"
          >
            Log in
          </Link>
        </div>
      ) : null}

      {!loading && !error && selectedStaff ? (
        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
          <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold">Team</h3>
                <p className="mt-1 text-sm text-[#697178]">
                  Staff records are loaded from Supabase.
                </p>
              </div>
              <select className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
                <option>All roles</option>
                <option>Owner</option>
                <option>Admin</option>
                <option>Artist</option>
                <option>Front Desk</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Staff</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Start</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8dd]">
                  {staff.map((person) => (
                    <tr
                      key={person.id}
                      className={person.id === selectedStaff.id ? "bg-[#fffaf1]" : undefined}
                      onClick={() => setSelectedStaffId(person.id)}
                    >
                      <td className="px-4 py-4">
                        <p className="text-xs font-semibold text-[#8a6f4d]">
                          {person.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 font-semibold">{person.display_name}</p>
                        <p className="mt-1 text-[#697178]">{person.legal_name || "-"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${roleClasses(
                            person.role,
                          )}`}
                        >
                          {person.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#4d555c]">
                        <p>{person.email || "-"}</p>
                        <p className="mt-1">{person.phone || "-"}</p>
                      </td>
                      <td className="px-4 py-4 text-[#4d555c]">
                        {displayDate(person.start_date)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-md bg-[#e4f1df] px-2 py-1 text-xs font-semibold text-[#476b33]">
                          {person.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
              <div className="border-b border-[#e5dfd4] px-4 py-4">
                <p className="text-xs font-semibold text-[#8a6f4d]">
                  {selectedStaff.id.slice(0, 8)}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{selectedStaff.display_name}</h3>
                <p className="mt-1 text-sm text-[#697178]">{selectedStaff.role}</p>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Display name
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      defaultValue={selectedStaff.display_name}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Role
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      defaultValue={selectedStaff.role}
                    >
                      <option>Owner</option>
                      <option>Admin</option>
                      <option>Artist</option>
                      <option>Front Desk</option>
                    </select>
                  </label>
                </div>

                <div>
                  <h4 className="text-sm font-semibold">Permissions</h4>
                  <div className="mt-3 space-y-2">
                    {permissions.map((permission) => (
                      <label
                        key={permission.key}
                        className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                      >
                        <span className="font-semibold">{permission.label}</span>
                        <input type="checkbox" />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold">Tattoo schedule</h4>
                  <p className="mt-1 text-sm text-[#697178]">
                    These working hours should feed the calendar booking availability.
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedSchedule.map((slot) => (
                      <div
                        key={slot.day_of_week}
                        className="grid grid-cols-[54px_1fr_1fr_56px] items-center gap-2 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                      >
                        <span className="font-semibold">{dayLabels[slot.day_of_week]}</span>
                        <input
                          className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                          defaultValue={normalizeTime(slot.starts_at)}
                          disabled={!slot.available}
                          type="time"
                        />
                        <input
                          className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                          defaultValue={normalizeTime(slot.ends_at)}
                          disabled={!slot.available}
                          type="time"
                        />
                        <label className="flex items-center justify-end gap-2 text-xs font-semibold text-[#4d555c]">
                          <input defaultChecked={slot.available} type="checkbox" />
                          On
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                  type="button"
                >
                  Save staff record
                </button>
              </div>
            </section>

            <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <h3 className="text-base font-semibold">Security note</h3>
              <p className="mt-3 text-sm text-[#4d555c]">
                Artist accounts should never receive accounting or payout access. The accounting app
                should only accept owner/admin users through Supabase RLS.
              </p>
            </section>
          </aside>
        </section>
      ) : null}
    </AppShell>
  );
}

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

type StaffPermission = {
  id: string;
  staff_id: string;
  permission_key: string;
  enabled: boolean;
};

type StaffForm = {
  displayName: string;
  role: string;
  schedule: StaffSchedule[];
  permissionKeys: string[];
};

const permissions = [
  { key: "artistSchedule", label: "Artist Schedule" },
  { key: "calendarBooking", label: "Calendar / Booking" },
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
  return value ? value.slice(0, 5) : "";
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

function scheduleForStaff(staffId: string, schedules: StaffSchedule[]) {
  return dayLabels.map((_, dayOfWeek) => {
    return (
      schedules.find((schedule) => schedule.staff_id === staffId && schedule.day_of_week === dayOfWeek) ??
      fallbackSchedule(dayOfWeek, staffId)
    );
  });
}

function permissionKeysForStaff(staffId: string, permissionRows: StaffPermission[]) {
  return permissionRows
    .filter((permission) => permission.staff_id === staffId && permission.enabled)
    .map((permission) => permission.permission_key);
}

function errorMessage(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return `${message}. 현재 로그인 계정이 Supabase에서 owner/admin 직원으로 연결되어 있어야 저장할 수 있습니다.`;
  }

  return message;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermission[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [form, setForm] = useState<StaffForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

      const [staffResult, scheduleResult, permissionResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, display_name, legal_name, role, email, phone, start_date, active")
          .order("sort_order", { ascending: true }),
        supabase
          .from("staff_schedules")
          .select("id, staff_id, day_of_week, available, starts_at, ends_at")
          .order("day_of_week", { ascending: true }),
        supabase
          .from("staff_permissions")
          .select("id, staff_id, permission_key, enabled")
          .order("permission_key", { ascending: true }),
      ]);

      if (staffResult.error) {
        setError(errorMessage(staffResult.error.message));
        setLoading(false);
        return;
      }

      if (scheduleResult.error) {
        setError(errorMessage(scheduleResult.error.message));
        setLoading(false);
        return;
      }

      if (permissionResult.error) {
        setError(errorMessage(permissionResult.error.message));
        setLoading(false);
        return;
      }

      const nextStaff = staffResult.data ?? [];
      const nextSchedules = scheduleResult.data ?? [];
      const nextPermissions = permissionResult.data ?? [];
      const nextSelectedId = nextStaff[0]?.id || "";

      setStaff(nextStaff);
      setSchedules(nextSchedules);
      setStaffPermissions(nextPermissions);
      setSelectedStaffId(nextSelectedId);
      setForm(
        nextStaff[0]
          ? {
              displayName: nextStaff[0].display_name,
              role: nextStaff[0].role,
              schedule: scheduleForStaff(nextSelectedId, nextSchedules),
              permissionKeys: permissionKeysForStaff(nextSelectedId, nextPermissions),
            }
          : null,
      );
      setLoading(false);
    }

    loadStaff();
  }, []);

  const selectedStaff = useMemo(
    () => staff.find((person) => person.id === selectedStaffId) ?? staff[0],
    [selectedStaffId, staff],
  );

  function selectStaff(person: StaffRecord) {
    setSelectedStaffId(person.id);
    setMessage("");
    setError("");
    setForm({
      displayName: person.display_name,
      role: person.role,
      schedule: scheduleForStaff(person.id, schedules),
      permissionKeys: permissionKeysForStaff(person.id, staffPermissions),
    });
  }

  function updateSchedule(dayOfWeek: number, patch: Partial<StaffSchedule>) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        schedule: current.schedule.map((slot) =>
          slot.day_of_week === dayOfWeek ? { ...slot, ...patch } : slot,
        ),
      };
    });
  }

  function updatePermission(permissionKey: string, enabled: boolean) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        permissionKeys: enabled
          ? Array.from(new Set([...current.permissionKeys, permissionKey]))
          : current.permissionKeys.filter((key) => key !== permissionKey),
      };
    });
  }

  async function saveStaffRecord() {
    if (!selectedStaff || !form) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const staffResult = await supabase
      .from("staff")
      .update({
        display_name: form.displayName.trim(),
        role: form.role,
      })
      .eq("id", selectedStaff.id);

    if (staffResult.error) {
      setError(errorMessage(staffResult.error.message));
      setSaving(false);
      return;
    }

    const schedulePayload = form.schedule.map((slot) => ({
      staff_id: selectedStaff.id,
      day_of_week: slot.day_of_week,
      available: slot.available,
      starts_at: slot.available ? normalizeTime(slot.starts_at) || null : null,
      ends_at: slot.available ? normalizeTime(slot.ends_at) || null : null,
    }));

    const scheduleResult = await supabase
      .from("staff_schedules")
      .upsert(schedulePayload, { onConflict: "staff_id,day_of_week" });

    if (scheduleResult.error) {
      setError(errorMessage(scheduleResult.error.message));
      setSaving(false);
      return;
    }

    const permissionPayload = permissions.map((permission) => ({
      staff_id: selectedStaff.id,
      permission_key: permission.key,
      enabled: form.permissionKeys.includes(permission.key),
    }));

    const permissionResult = await supabase
      .from("staff_permissions")
      .upsert(permissionPayload, { onConflict: "staff_id,permission_key" });

    if (permissionResult.error) {
      setError(errorMessage(permissionResult.error.message));
      setSaving(false);
      return;
    }

    setStaff((current) =>
      current.map((person) =>
        person.id === selectedStaff.id
          ? { ...person, display_name: form.displayName.trim(), role: form.role }
          : person,
      ),
    );
    setSchedules((current) => {
      const others = current.filter((slot) => slot.staff_id !== selectedStaff.id);
      return [...others, ...schedulePayload.map((slot) => ({ ...slot, id: `${slot.staff_id}-${slot.day_of_week}` }))];
    });
    setStaffPermissions((current) => {
      const others = current.filter((permission) => permission.staff_id !== selectedStaff.id);
      return [
        ...others,
        ...permissionPayload.map((permission) => ({
          ...permission,
          id: `${permission.staff_id}-${permission.permission_key}`,
        })),
      ];
    });
    setMessage("Staff record saved.");
    setSaving(false);
  }

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

      {!loading && error && !selectedStaff ? (
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

      {!loading && !error && !selectedStaff ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          No staff records found.
        </div>
      ) : null}

      {!loading && selectedStaff && form ? (
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
                      className={`cursor-pointer ${person.id === selectedStaff.id ? "bg-[#fffaf1]" : ""}`}
                      onClick={() => selectStaff(person)}
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Display name
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, displayName: event.target.value } : current,
                        )
                      }
                      value={form.displayName}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Role
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, role: event.target.value } : current,
                        )
                      }
                      value={form.role}
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
                        <input
                          checked={form.permissionKeys.includes(permission.key)}
                          onChange={(event) =>
                            updatePermission(permission.key, event.target.checked)
                          }
                          type="checkbox"
                        />
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
                    {form.schedule.map((slot) => (
                      <div
                        key={slot.day_of_week}
                        className="grid grid-cols-[54px_1fr_1fr_56px] items-center gap-2 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                      >
                        <span className="font-semibold">{dayLabels[slot.day_of_week]}</span>
                        <input
                          className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                          disabled={!slot.available}
                          onChange={(event) =>
                            updateSchedule(slot.day_of_week, { starts_at: event.target.value })
                          }
                          type="time"
                          value={normalizeTime(slot.starts_at)}
                        />
                        <input
                          className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                          disabled={!slot.available}
                          onChange={(event) =>
                            updateSchedule(slot.day_of_week, { ends_at: event.target.value })
                          }
                          type="time"
                          value={normalizeTime(slot.ends_at)}
                        />
                        <label className="flex items-center justify-end gap-2 text-xs font-semibold text-[#4d555c]">
                          <input
                            checked={slot.available}
                            onChange={(event) =>
                              updateSchedule(slot.day_of_week, {
                                available: event.target.checked,
                                starts_at: event.target.checked ? slot.starts_at || "10:00" : null,
                                ends_at: event.target.checked ? slot.ends_at || "18:00" : null,
                              })
                            }
                            type="checkbox"
                          />
                          On
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={saveStaffRecord}
                  type="button"
                >
                  {saving ? "Saving..." : "Save staff record"}
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

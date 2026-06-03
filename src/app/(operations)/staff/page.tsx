"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPage } from "@/components/app-shell";
import { TimeSelect } from "@/components/time-select";
import { getSafeUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  profile_id: string | null;
  display_name: string;
  legal_name: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  artist_accept_template: string | null;
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
  legalName: string;
  role: string;
  phone: string;
  address: string;
  artistAcceptTemplate: string;
  startDate: string;
  schedule: StaffSchedule[];
  permissionKeys: string[];
};

type CreateStaffForm = {
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  startDate: string;
  role: "owner" | "admin" | "artist" | "front_desk";
};

type ManageStaffMode = "deactivate" | "delete";

// Permissions relevant to Tattoo Manager operations.
// Accounting access is managed separately in /accounting/users.
const permissions = [
  {
    key: "requestAssignment",
    label: "Request assignment",
    description: "Allow assigning incoming requests to artists and sending artist review emails.",
  },
  {
    key: "calendarBooking",
    label: "Calendar booking",
    description: "Show this staff member on the calendar and allow appointment booking.",
  },
  {
    key: "session",
    label: "Session entry",
    description: "Allow recording tattoo sessions and payments.",
  },
  {
    key: "deposit",
    label: "Deposit management",
    description: "Allow creating, applying, and correcting deposits.",
  },
  {
    key: "merch",
    label: "Merch sales",
    description: "Allow recording merchandise sales.",
  },
  {
    key: "staffAdmin",
    label: "Staff admin",
    description: "Allow staff settings and permission management.",
  },
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
  if (!value) return "-";
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
      schedules.find(
        (schedule) => schedule.staff_id === staffId && schedule.day_of_week === dayOfWeek,
      ) ?? fallbackSchedule(dayOfWeek, staffId)
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

function ManageStaffUserModal({
  person,
  mode,
  error,
  saving,
  onClose,
  onConfirm,
}: {
  person: StaffRecord;
  mode: ManageStaffMode;
  error: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDelete = mode === "delete";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">
              {isDelete ? "Delete user" : "Deactivate user"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{person.display_name}</h3>
            <p className="mt-1 text-sm text-[#697178]">{person.email || "No email"}</p>
          </div>
          <button
            aria-label="Close staff user management"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <p className="text-sm text-[#4d555c]">
            {isDelete
              ? "This removes the staff record and the linked Supabase Auth user. Use this for test entries or mistaken duplicate accounts."
              : "This keeps historical records but removes this person from active staff workflows."}
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`h-10 rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                isDelete ? "bg-[#8a3030] hover:bg-[#6f2424]" : "bg-[#1f2428] hover:bg-[#30373d]"
              }`}
              disabled={saving}
              onClick={onConfirm}
              type="button"
            >
              {saving ? "Working..." : isDelete ? "Delete user" : "Deactivate"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CreateStaffModal({
  error,
  saving,
  onClose,
  onCreate,
}: {
  error: string;
  saving: boolean;
  onClose: () => void;
  onCreate: (form: CreateStaffForm) => void;
}) {
  const [form, setForm] = useState<CreateStaffForm>({
    displayName: "",
    legalName: "",
    email: "",
    phone: "",
    startDate: "",
    role: "artist",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New staff</p>
            <h3 className="mt-1 text-xl font-semibold">Create staff login</h3>
            <p className="mt-1 text-sm text-[#697178]">
              A temporary password will be shown once after creation.
            </p>
          </div>
          <button
            aria-label="Close new staff"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Display name
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                value={form.displayName}
              />
            </label>
            <label className="text-sm font-semibold">
              Legal name
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, legalName: event.target.value }))
                }
                value={form.legalName}
              />
            </label>
            <label className="text-sm font-semibold">
              Email
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                type="email"
                value={form.email}
              />
            </label>
            <label className="text-sm font-semibold">
              Phone
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                value={form.phone}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Role
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as CreateStaffForm["role"],
                }))
              }
              value={form.role}
            >
              <option value="artist">Artist</option>
              <option value="front_desk">Front Desk</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>
            <label className="text-sm font-semibold">
              Start date
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({ ...current, startDate: event.target.value }))
                }
                type="date"
                value={form.startDate}
              />
            </label>
          </div>

          <button
            className="h-10 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onCreate(form)}
            type="button"
          >
            {saving ? "Creating..." : "Create staff"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TempPasswordModal({
  displayName,
  email,
  tempPassword,
  onClose,
}: {
  displayName: string;
  email: string;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="border-b border-[#e5dfd4] px-5 py-4">
          <p className="text-xs font-semibold text-[#476b33]">Staff created</p>
          <h3 className="mt-1 text-xl font-semibold">Temporary password</h3>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="rounded-md bg-[#fff8e5] px-3 py-2 text-sm font-semibold text-[#7a5c00]">
            Copy this password now. It will not be shown again.
          </p>
          <p className="text-sm text-[#697178]">
            Account: <strong>{displayName}</strong> ({email})
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-[#cfc7b8] bg-[#f7f2e9] px-3 py-2 font-mono text-sm font-semibold tracking-wider">
              {tempPassword}
            </code>
            <button
              className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
              onClick={copyPassword}
              type="button"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            className="h-10 w-full rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermission[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffDetailOpen, setStaffDetailOpen] = useState(false);
  const [form, setForm] = useState<StaffForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manageMode, setManageMode] = useState<ManageStaffMode | null>(null);
  const [manageError, setManageError] = useState("");
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newTempPassword, setNewTempPassword] = useState<{
    displayName: string;
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    async function loadStaff() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();

      if (!user) {
        setLoading(false);
        setError("Please log in to view staff records.");
        return;
      }

      const [staffResult, scheduleResult, permissionResult] = await Promise.all([
        supabase
          .from("staff")
          .select(
            "id, profile_id, display_name, legal_name, role, email, phone, address, artist_accept_template, start_date, active",
          )
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
              legalName: nextStaff[0].legal_name ?? "",
              role: nextStaff[0].role,
              phone: nextStaff[0].phone ?? "",
              address: nextStaff[0].address ?? "",
              artistAcceptTemplate: nextStaff[0].artist_accept_template ?? "",
              startDate: nextStaff[0].start_date ?? "",
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
    setStaffDetailOpen(true);
    setMessage("");
    setError("");
    setForm({
      displayName: person.display_name,
      legalName: person.legal_name ?? "",
      role: person.role,
      phone: person.phone ?? "",
      address: person.address ?? "",
      artistAcceptTemplate: person.artist_accept_template ?? "",
      startDate: person.start_date ?? "",
      schedule: scheduleForStaff(person.id, schedules),
      permissionKeys: permissionKeysForStaff(person.id, staffPermissions),
    });
  }

  function updateSchedule(dayOfWeek: number, patch: Partial<StaffSchedule>) {
    setForm((current) => {
      if (!current) return current;
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
      if (!current) return current;
      return {
        ...current,
        permissionKeys: enabled
          ? Array.from(new Set([...current.permissionKeys, permissionKey]))
          : current.permissionKeys.filter((key) => key !== permissionKey),
      };
    });
  }

  async function saveStaffRecord() {
    if (!selectedStaff || !form) return;

    setSaving(true);
    setError("");
    setMessage("");

    const staffResult = await supabase
      .from("staff")
      .update({
        display_name: form.displayName.trim(),
        legal_name: form.legalName.trim() || null,
        role: form.role,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        artist_accept_template: form.artistAcceptTemplate.trim() || null,
        start_date: form.startDate || null,
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
          ? {
              ...person,
              display_name: form.displayName.trim(),
              legal_name: form.legalName.trim() || null,
              role: form.role,
              phone: form.phone.trim() || null,
              address: form.address.trim() || null,
              artist_accept_template: form.artistAcceptTemplate.trim() || null,
              start_date: form.startDate || null,
            }
          : person,
      ),
    );
    setSchedules((current) => {
      const others = current.filter((slot) => slot.staff_id !== selectedStaff.id);
      return [
        ...others,
        ...schedulePayload.map((slot) => ({
          ...slot,
          id: `${slot.staff_id}-${slot.day_of_week}`,
        })),
      ];
    });
    setStaffPermissions((current) => {
      const others = current.filter(
        (permission) => permission.staff_id !== selectedStaff.id,
      );
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

  async function createStaffRecord(createForm: CreateStaffForm) {
    const displayName = createForm.displayName.trim();
    const legalName = createForm.legalName.trim();
    const email = createForm.email.trim().toLowerCase();
    const phone = createForm.phone.trim();
    const startDate = createForm.startDate;

    if (!displayName) {
      setCreateError("Display name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }

    setSaving(true);
    setCreateError("");
    setError("");
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      setCreateError("Please log in again.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/staff-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
        legalName,
        email,
        phone,
        startDate,
        role: createForm.role,
      }),
    });

    const result = (await response.json()) as {
      staff?: StaffRecord;
      tempPassword?: string;
      error?: string;
    };

    if (!response.ok || !result.staff || !result.tempPassword) {
      setCreateError(result.error ?? "Could not create staff user.");
      setSaving(false);
      return;
    }

    const newSchedules = dayLabels.map((_, dayOfWeek) =>
      fallbackSchedule(dayOfWeek, result.staff!.id),
    );

    setStaff((current) => [...current, result.staff!]);
    setSchedules((current) => [...current, ...newSchedules]);
    setSelectedStaffId(result.staff.id);
    setForm({
      displayName: result.staff.display_name,
      legalName: result.staff.legal_name ?? "",
      role: result.staff.role,
      phone: result.staff.phone ?? "",
      address: "",
      artistAcceptTemplate: result.staff.artist_accept_template ?? "",
      startDate: result.staff.start_date ?? "",
      schedule: scheduleForStaff(result.staff.id, newSchedules),
      permissionKeys: [],
    });
    setStaffDetailOpen(true);
    setShowCreateStaff(false);
    setNewTempPassword({
      displayName: result.staff.display_name,
      email: result.staff.email ?? email,
      password: result.tempPassword,
    });
    setMessage("Staff login created.");
    setSaving(false);
  }

  async function manageStaffUser(mode: ManageStaffMode) {
    if (!selectedStaff) return;

    setSaving(true);
    setManageError("");
    setError("");
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      setManageError("Please log in again before managing this user.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/staff-user", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffId: selectedStaff.id, mode }),
    });

    const result = (await response.json()) as { staffId?: string; error?: string };

    if (!response.ok || !result.staffId) {
      setManageError(result.error ?? "Could not update staff user.");
      setSaving(false);
      return;
    }

    if (mode === "deactivate") {
      setStaff((current) =>
        current.map((person) =>
          person.id === selectedStaff.id ? { ...person, active: false } : person,
        ),
      );
      setMessage(`${selectedStaff.display_name} was deactivated.`);
    } else {
      const nextStaff = staff.filter((person) => person.id !== selectedStaff.id);
      setStaff(nextStaff);
      setStaffPermissions((current) =>
        current.filter((permission) => permission.staff_id !== selectedStaff.id),
      );
      setSchedules((current) =>
        current.filter((slot) => slot.staff_id !== selectedStaff.id),
      );
      const nextSelected = nextStaff[0];
      setSelectedStaffId(nextSelected?.id ?? "");
      setForm(
        nextSelected
          ? {
              displayName: nextSelected.display_name,
              legalName: nextSelected.legal_name ?? "",
              role: nextSelected.role,
              phone: nextSelected.phone ?? "",
              address: nextSelected.address ?? "",
              artistAcceptTemplate: nextSelected.artist_accept_template ?? "",
              startDate: nextSelected.start_date ?? "",
              schedule: scheduleForStaff(nextSelected.id, schedules),
              permissionKeys: permissionKeysForStaff(nextSelected.id, staffPermissions),
            }
          : null,
      );
      setStaffDetailOpen(false);
      setMessage(`${selectedStaff.display_name} was deleted.`);
    }

    setManageMode(null);
    setSaving(false);
  }

  return (
    <AppPage
      eyebrow="Operations"
      title="Staff and permissions"
      description="Manage artists, front desk users, and owner/admin access. Accounting app users are managed separately at /accounting/users."
      actions={
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            setCreateError("");
            setShowCreateStaff(true);
          }}
          type="button"
        >
          New Staff
        </button>
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

      {!loading && staff.length > 0 ? (
        <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
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

          <div className="divide-y divide-[#eee8dd] md:hidden">
            {staff.map((person) => (
              <button
                key={person.id}
                className="block w-full px-4 py-4 text-left transition hover:bg-[#f7f2e9]"
                onClick={() => selectStaff(person)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{person.display_name}</p>
                    {person.legal_name ? (
                      <p className="mt-1 truncate text-sm text-[#697178]">
                        {person.legal_name}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${roleClasses(person.role)}`}
                  >
                    {person.role}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-[#4d555c]">
                  <p>{person.email || "-"}</p>
                  <p>{person.phone || "-"}</p>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span>Started {displayDate(person.start_date)}</span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        person.active
                          ? "bg-[#e4f1df] text-[#476b33]"
                          : "bg-[#f3e1e1] text-[#8a3030]"
                      }`}
                    >
                      {person.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                    className="cursor-pointer hover:bg-[#f7f2e9]"
                    onClick={() => selectStaff(person)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold">{person.display_name}</p>
                      {person.legal_name ? (
                        <p className="mt-1 text-[#697178]">{person.legal_name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${roleClasses(person.role)}`}
                      >
                        {person.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#4d555c]">
                      <p>{person.email || "-"}</p>
                      <p className="mt-1">{person.phone || "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-[#4d555c]">{displayDate(person.start_date)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          person.active
                            ? "bg-[#e4f1df] text-[#476b33]"
                            : "bg-[#f3e1e1] text-[#8a3030]"
                        }`}
                      >
                        {person.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {staffDetailOpen && selectedStaff && form ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-6">
          <section className="w-full max-w-3xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-4 py-4">
              <div>
                <p className="text-xs font-semibold text-[#8a6f4d]">Staff detail</p>
                <h3 className="mt-1 text-lg font-semibold">{selectedStaff.display_name}</h3>
                <p className="mt-1 text-sm text-[#697178]">{selectedStaff.role}</p>
              </div>
              <button
                aria-label="Close staff detail"
                className="h-9 w-9 rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
                onClick={() => setStaffDetailOpen(false)}
                type="button"
              >
                x
              </button>
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
                  Legal name
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, legalName: event.target.value } : current,
                      )
                    }
                    value={form.legalName}
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
                <label className="text-sm font-semibold">
                  Phone
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, phone: event.target.value } : current,
                      )
                    }
                    value={form.phone}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Start date
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, startDate: event.target.value } : current,
                      )
                    }
                    type="date"
                    value={form.startDate}
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold">
                Home address
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, address: event.target.value } : current,
                    )
                  }
                  placeholder="Enter the staff member's home address"
                  value={form.address}
                />
              </label>

              <div>
                <h4 className="text-sm font-semibold">Permissions</h4>
                <div className="mt-3 space-y-2">
                  {permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                    >
                      <span>
                        <span className="block font-semibold">{permission.label}</span>
                        <span className="mt-1 block text-xs font-normal text-[#697178]">
                          {permission.description}
                        </span>
                      </span>
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
                  These working hours feed the calendar booking availability.
                </p>
                <div className="mt-3 space-y-2">
                  {form.schedule.map((slot) => (
                    <div
                      key={slot.day_of_week}
                      className="grid gap-2 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm sm:grid-cols-[54px_1fr_1fr_56px] sm:items-center"
                    >
                      <div className="flex items-center justify-between gap-2 sm:block">
                        <span className="font-semibold">{dayLabels[slot.day_of_week]}</span>
                        <span className="text-xs font-semibold text-[#697178] sm:hidden">
                          {slot.available
                            ? `${normalizeTime(slot.starts_at)} - ${normalizeTime(slot.ends_at)}`
                            : "Off"}
                        </span>
                      </div>
                      <label className="text-xs font-semibold text-[#697178] sm:contents">
                        <span className="sm:hidden">Start</span>
                        <TimeSelect
                          className="mt-1 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd] sm:mt-0"
                          disabled={!slot.available}
                          onChange={(value) =>
                            updateSchedule(slot.day_of_week, { starts_at: value })
                          }
                          startHour={8}
                          value={normalizeTime(slot.starts_at)}
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#697178] sm:contents">
                        <span className="sm:hidden">End</span>
                        <TimeSelect
                          className="mt-1 h-9 w-full rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd] sm:mt-0"
                          disabled={!slot.available}
                          onChange={(value) =>
                            updateSchedule(slot.day_of_week, { ends_at: value })
                          }
                          startHour={8}
                          value={normalizeTime(slot.ends_at)}
                        />
                      </label>
                      <label className="flex items-center justify-start gap-2 text-xs font-semibold text-[#4d555c] sm:justify-end">
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

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={saveStaffRecord}
                  type="button"
                >
                  {saving ? "Saving..." : "Save staff record"}
                </button>
                <button
                  className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving || !selectedStaff.active}
                  onClick={() => {
                    setManageError("");
                    setManageMode("deactivate");
                  }}
                  type="button"
                >
                  Deactivate
                </button>
              </div>

              <button
                className="h-10 w-full rounded-md border border-[#d6b8b8] px-4 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={() => {
                  setManageError("");
                  setManageMode("delete");
                }}
                type="button"
              >
                Delete user
              </button>

              <div className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4">
                <h3 className="text-base font-semibold">Note on accounting access</h3>
                <p className="mt-3 text-sm text-[#4d555c]">
                  Accounting access is managed separately. To create or manage accounting app
                  users, go to{" "}
                  <a
                    className="font-semibold text-[#236c8f] hover:underline"
                    href="/accounting/users"
                  >
                    /accounting/users
                  </a>
                  . Tattoo Manager staff accounts do not grant accounting access.
                </p>
              </div>

              <button
                className="h-10 w-full rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                onClick={() => setStaffDetailOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {manageMode && selectedStaff ? (
        <ManageStaffUserModal
          error={manageError}
          mode={manageMode}
          onClose={() => setManageMode(null)}
          onConfirm={() => manageStaffUser(manageMode)}
          person={selectedStaff}
          saving={saving}
        />
      ) : null}

      {showCreateStaff ? (
        <CreateStaffModal
          error={createError}
          onClose={() => setShowCreateStaff(false)}
          onCreate={createStaffRecord}
          saving={saving}
        />
      ) : null}

      {newTempPassword ? (
        <TempPasswordModal
          displayName={newTempPassword.displayName}
          email={newTempPassword.email}
          onClose={() => setNewTempPassword(null)}
          tempPassword={newTempPassword.password}
        />
      ) : null}
    </AppPage>
  );
}

import { AppShell } from "@/components/app-shell";

const permissions = [
  { key: "artistSchedule", label: "Artist Schedule" },
  { key: "session", label: "Session" },
  { key: "deposit", label: "Deposit" },
  { key: "merch", label: "Merch" },
  { key: "staffAdmin", label: "Staff Admin" },
];

const staff = [
  {
    id: "STF-1001",
    displayName: "YUSHI",
    legalName: "Yushi",
    role: "Artist",
    email: "yushi@oyabun.local",
    phone: "213-555-0101",
    startDate: "Jan 1, 2026",
    active: true,
    permissions: ["artistSchedule", "session", "deposit", "merch"],
    schedule: [
      { day: "Mon", enabled: false, start: "", end: "" },
      { day: "Tue", enabled: true, start: "11:00", end: "18:00" },
      { day: "Wed", enabled: true, start: "11:00", end: "18:00" },
      { day: "Thu", enabled: true, start: "12:00", end: "19:00" },
      { day: "Fri", enabled: true, start: "12:00", end: "19:00" },
      { day: "Sat", enabled: true, start: "10:00", end: "17:00" },
      { day: "Sun", enabled: false, start: "", end: "" },
    ],
  },
  {
    id: "STF-1002",
    displayName: "BAKI",
    legalName: "Baki",
    role: "Artist",
    email: "baki@oyabun.local",
    phone: "213-555-0102",
    startDate: "Jan 1, 2026",
    active: true,
    permissions: ["artistSchedule", "session", "deposit"],
    schedule: [
      { day: "Mon", enabled: false, start: "", end: "" },
      { day: "Tue", enabled: false, start: "", end: "" },
      { day: "Wed", enabled: true, start: "13:00", end: "20:00" },
      { day: "Thu", enabled: true, start: "13:00", end: "20:00" },
      { day: "Fri", enabled: true, start: "13:00", end: "20:00" },
      { day: "Sat", enabled: true, start: "11:00", end: "18:00" },
      { day: "Sun", enabled: true, start: "11:00", end: "16:00" },
    ],
  },
  {
    id: "STF-1003",
    displayName: "JC",
    legalName: "JC",
    role: "Artist",
    email: "jc@oyabun.local",
    phone: "213-555-0103",
    startDate: "Jan 1, 2026",
    active: true,
    permissions: ["artistSchedule", "session", "deposit"],
    schedule: [
      { day: "Mon", enabled: true, start: "10:00", end: "16:00" },
      { day: "Tue", enabled: true, start: "10:00", end: "16:00" },
      { day: "Wed", enabled: true, start: "10:00", end: "16:00" },
      { day: "Thu", enabled: false, start: "", end: "" },
      { day: "Fri", enabled: true, start: "11:00", end: "18:00" },
      { day: "Sat", enabled: true, start: "11:00", end: "18:00" },
      { day: "Sun", enabled: false, start: "", end: "" },
    ],
  },
  {
    id: "STF-1004",
    displayName: "Front Desk",
    legalName: "Front Desk",
    role: "Front Desk",
    email: "frontdesk@oyabun.local",
    phone: "213-555-0104",
    startDate: "Feb 1, 2026",
    active: true,
    permissions: ["artistSchedule", "deposit"],
    schedule: [
      { day: "Mon", enabled: true, start: "10:00", end: "18:00" },
      { day: "Tue", enabled: true, start: "10:00", end: "18:00" },
      { day: "Wed", enabled: true, start: "10:00", end: "18:00" },
      { day: "Thu", enabled: true, start: "10:00", end: "18:00" },
      { day: "Fri", enabled: true, start: "10:00", end: "18:00" },
      { day: "Sat", enabled: true, start: "10:00", end: "18:00" },
      { day: "Sun", enabled: true, start: "10:00", end: "18:00" },
    ],
  },
  {
    id: "STF-1005",
    displayName: "Owner",
    legalName: "Owner",
    role: "Owner",
    email: "owner@oyabun.local",
    phone: "213-555-0105",
    startDate: "Jan 1, 2026",
    active: true,
    permissions: ["artistSchedule", "session", "deposit", "merch", "staffAdmin"],
    schedule: [
      { day: "Mon", enabled: true, start: "10:00", end: "18:00" },
      { day: "Tue", enabled: true, start: "10:00", end: "18:00" },
      { day: "Wed", enabled: true, start: "10:00", end: "18:00" },
      { day: "Thu", enabled: true, start: "10:00", end: "18:00" },
      { day: "Fri", enabled: true, start: "10:00", end: "18:00" },
      { day: "Sat", enabled: true, start: "10:00", end: "18:00" },
      { day: "Sun", enabled: false, start: "", end: "" },
    ],
  },
];

const selectedStaff = staff[0];

function roleClasses(role: string) {
  const variants: Record<string, string> = {
    Owner: "bg-[#1f2428] text-white",
    Admin: "bg-[#efe7f5] text-[#674b7a]",
    Artist: "bg-[#e8f0ee] text-[#2f6658]",
    "Front Desk": "bg-[#e5edf4] text-[#315f82]",
  };

  return variants[role] ?? "bg-[#eee8dd] text-[#4d555c]";
}

export default function StaffPage() {
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
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold">Team</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Staff records will connect to Supabase profiles later.
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
                  >
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-[#8a6f4d]">{person.id}</p>
                      <p className="mt-1 font-semibold">{person.displayName}</p>
                      <p className="mt-1 text-[#697178]">{person.legalName}</p>
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
                      <p>{person.email}</p>
                      <p className="mt-1">{person.phone}</p>
                    </td>
                    <td className="px-4 py-4 text-[#4d555c]">{person.startDate}</td>
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
              <p className="text-xs font-semibold text-[#8a6f4d]">{selectedStaff.id}</p>
              <h3 className="mt-1 text-lg font-semibold">{selectedStaff.displayName}</h3>
              <p className="mt-1 text-sm text-[#697178]">{selectedStaff.role}</p>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Display name
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    defaultValue={selectedStaff.displayName}
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
                  {permissions.map((permission) => {
                    const enabled = selectedStaff.permissions.includes(permission.key);

                    return (
                      <label
                        key={permission.key}
                        className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                      >
                        <span className="font-semibold">{permission.label}</span>
                        <input defaultChecked={enabled} type="checkbox" />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold">Tattoo schedule</h4>
                <p className="mt-1 text-sm text-[#697178]">
                  These working hours should feed the calendar booking availability.
                </p>
                <div className="mt-3 space-y-2">
                  {selectedStaff.schedule.map((slot) => (
                    <div
                      key={slot.day}
                      className="grid grid-cols-[54px_1fr_1fr_56px] items-center gap-2 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                    >
                      <span className="font-semibold">{slot.day}</span>
                      <input
                        className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                        defaultValue={slot.start}
                        disabled={!slot.enabled}
                        type="time"
                      />
                      <input
                        className="h-9 rounded-md border border-[#cfc7b8] bg-white px-2 text-sm disabled:bg-[#eee8dd]"
                        defaultValue={slot.end}
                        disabled={!slot.enabled}
                        type="time"
                      />
                      <label className="flex items-center justify-end gap-2 text-xs font-semibold text-[#4d555c]">
                        <input defaultChecked={slot.enabled} type="checkbox" />
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
    </AppShell>
  );
}

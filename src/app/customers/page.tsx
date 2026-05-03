import { AppShell } from "@/components/app-shell";

const customers = [
  {
    id: "CUS-2031",
    name: "Armando Gonzales",
    phone: "870-496-4620",
    email: "gon@gmail.com",
    source: "Converted from REQ-1042",
    lastVisit: "Jun 18, 2026",
    projects: [
      {
        subject: "Vagabond",
        artist: "JC",
        size: "10x10",
        status: "In progress",
        waiver: "Signed",
        deposit: "$180 available",
      },
      {
        subject: "Dragon forearm",
        artist: "YUSHI",
        size: "6x8",
        status: "Completed",
        waiver: "Signed",
        deposit: "$150 used",
      },
      {
        subject: "Fine line rose",
        artist: "AIMEE",
        size: "3x4",
        status: "Booked",
        waiver: "Missing",
        deposit: "$100 available",
      },
    ],
  },
  {
    id: "CUS-2030",
    name: "Sora Kim",
    phone: "213-555-0198",
    email: "sora@gmail.com",
    source: "Website request",
    lastVisit: "Jun 15, 2026",
    projects: [
      {
        subject: "Dragon sleeve",
        artist: "YUSHI",
        size: "Full arm",
        status: "In progress",
        waiver: "Missing",
        deposit: "$250 available",
      },
    ],
  },
  {
    id: "CUS-2029",
    name: "Mina David",
    phone: "213-555-0188",
    email: "mina.client@gmail.com",
    source: "Converted from REQ-1046",
    lastVisit: "Consultation pending",
    projects: [
      {
        subject: "Fine line floral sleeve",
        artist: "JC",
        size: "Half sleeve",
        status: "Consultation",
        waiver: "Missing",
        deposit: "No deposit",
      },
    ],
  },
];

const selectedCustomer = customers[0];

const sessions = [
  {
    date: "May 20",
    time: "5:00 PM",
    project: "Vagabond",
    artist: "JC",
    type: "On-Going",
    entry: "$200 tattoo / $0 tip",
  },
  {
    date: "Jun 18",
    time: "1:00 PM",
    project: "Dragon forearm",
    artist: "YUSHI",
    type: "One-Done",
    entry: "$480 tattoo / $80 tip",
  },
  {
    date: "Jul 15",
    time: "3:30 PM",
    project: "Fine line rose",
    artist: "AIMEE",
    type: "Booked",
    entry: "Pending",
  },
];

function projectStatusClasses(status: string) {
  const variants: Record<string, string> = {
    Consultation: "bg-[#efe7f5] text-[#674b7a]",
    Booked: "bg-[#e4f1df] text-[#476b33]",
    "In progress": "bg-[#e5edf4] text-[#315f82]",
    Completed: "bg-[#e8f0ee] text-[#2f6658]",
    Cancelled: "bg-[#f3e1e1] text-[#8a3030]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function waiverClasses(waiver: string) {
  return waiver === "Signed" ? "text-[#2f6658]" : "text-[#9f5c3c]";
}

export default function CustomersPage() {
  return (
    <AppShell
      active="Customers"
      eyebrow="Customer records"
      title="Customers and tattoo projects"
      description="Customer records can originate from Requests. Each customer can hold multiple tattoo projects, with separate artists, deposits, waiver state, and session history."
      actions={
        <>
          <button
            className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            type="button"
          >
            From request
          </button>
          <button
            className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            type="button"
          >
            New customer
          </button>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <h3 className="text-base font-semibold">Customer list</h3>
            <p className="mt-1 text-sm text-[#697178]">
              Search and filters will connect to Supabase later.
            </p>
          </div>

          <div className="divide-y divide-[#eee8dd]">
            {customers.map((customer) => (
              <button
                key={customer.id}
                className={`block w-full px-4 py-4 text-left transition hover:bg-[#f7f2e9] ${
                  customer.id === selectedCustomer.id ? "bg-[#fffaf1]" : ""
                }`}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#8a6f4d]">{customer.id}</p>
                    <p className="mt-1 font-semibold">{customer.name}</p>
                    <p className="mt-1 text-sm text-[#697178]">{customer.email}</p>
                  </div>
                  <span className="rounded-md bg-[#f1eadc] px-2 py-1 text-xs font-semibold text-[#775f36]">
                    {customer.projects.length} project{customer.projects.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#4d555c]">{customer.source}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold text-[#8a6f4d]">{selectedCustomer.id}</p>
                <h3 className="mt-1 text-xl font-semibold">{selectedCustomer.name}</h3>
                <p className="mt-1 text-sm text-[#697178]">{selectedCustomer.source}</p>
              </div>
              <button
                className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                type="button"
              >
                Edit profile
              </button>
            </div>

            <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-sm text-[#697178]">Phone</p>
                <p className="mt-1 font-semibold">{selectedCustomer.phone}</p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-sm text-[#697178]">Email</p>
                <p className="mt-1 font-semibold">{selectedCustomer.email}</p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-sm text-[#697178]">Last visit</p>
                <p className="mt-1 font-semibold">{selectedCustomer.lastVisit}</p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5dfd4] px-4 py-4">
              <div>
                <h3 className="text-base font-semibold">Projects</h3>
                <p className="mt-1 text-sm text-[#697178]">
                  A customer can have multiple projects with different artists.
                </p>
              </div>
              <button
                className="h-10 rounded-md bg-[#1f2428] px-4 text-sm font-semibold text-white hover:bg-[#30373d]"
                type="button"
              >
                New project
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Artist</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Waiver</th>
                    <th className="px-4 py-3 font-semibold">Deposit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8dd]">
                  {selectedCustomer.projects.map((project) => (
                    <tr key={`${project.subject}-${project.artist}`}>
                      <td className="px-4 py-4 font-semibold">{project.subject}</td>
                      <td className="px-4 py-4">{project.artist}</td>
                      <td className="px-4 py-4 text-[#4d555c]">{project.size}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                            project.status,
                          )}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className={`px-4 py-4 font-semibold ${waiverClasses(project.waiver)}`}>
                        {project.waiver}
                      </td>
                      <td className="px-4 py-4 text-[#4d555c]">{project.deposit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Session history</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Artists enter individual amounts here; full reporting stays in the accounting app.
              </p>
            </div>

            <div className="divide-y divide-[#eee8dd]">
              {sessions.map((session) => (
                <div
                  key={`${session.date}-${session.project}`}
                  className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.7fr_1fr_0.8fr_1fr]"
                >
                  <div>
                    <p className="font-semibold">{session.date}</p>
                    <p className="text-[#697178]">{session.time}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{session.project}</p>
                    <p className="text-[#697178]">{session.type}</p>
                  </div>
                  <p className="font-semibold">{session.artist}</p>
                  <p className="text-[#4d555c]">{session.entry}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

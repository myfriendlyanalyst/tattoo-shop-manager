import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const stats = [
  { label: "Open requests", value: "18", detail: "5 waiting on artist" },
  { label: "Today sessions", value: "7", detail: "$3,480 projected" },
  { label: "Deposits held", value: "$2,130", detail: "12 active projects" },
  { label: "Entries pending sync", value: "4", detail: "for accounting app" },
];

const requests = [
  {
    client: "Daniel Park",
    subject: "Japanese dragon back piece",
    artist: "YUSHI",
    status: "Forwarded",
    priority: "Normal",
  },
  {
    client: "Sora Kim",
    subject: "Small lettering tattoo",
    artist: "AIMEE",
    status: "Artist Replied",
    priority: "Low",
  },
  {
    client: "Mina David",
    subject: "Fine line floral sleeve",
    artist: "JC",
    status: "Consultation",
    priority: "High",
  },
];

const sessions = [
  {
    time: "11:00 AM",
    client: "Armando Gonzales",
    artist: "JC",
    type: "On-Going",
    amount: "$200",
  },
  {
    time: "1:30 PM",
    client: "Sora Kim",
    artist: "YUSHI",
    type: "One-Done",
    amount: "$580",
  },
  {
    time: "4:00 PM",
    client: "Nina Park",
    artist: "AIMEE",
    type: "Deposit",
    amount: "$150",
  },
];

const buildSteps = [
  "Create Supabase project and run schema",
  "Connect authentication and role-based navigation",
  "Replace mock dashboard data with real queries",
  "Build request intake before customer/project workflows",
];

export default function Home() {
  return (
    <AppShell
      active="Dashboard"
      eyebrow="Owner dashboard"
      title="Shop operations"
      description="Requests are the intake starting point. Artists enter customer session amounts here; shop-wide accounting lives in a separate owner/admin app."
      actions={
        <>
          <button
            className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            type="button"
          >
            New customer
          </button>
          <button
            className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            type="button"
          >
            Artist entry
          </button>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm"
          >
            <p className="text-sm font-medium text-[#697178]">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-sm text-[#7d684d]">{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5dfd4] px-4 py-3">
            <h3 className="text-base font-semibold">Request queue</h3>
            <Link className="text-sm font-semibold text-[#9f5c3c]" href="/requests">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Artist</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8dd]">
                {requests.map((request) => (
                  <tr key={`${request.client}-${request.subject}`}>
                    <td className="px-4 py-3 font-medium">{request.client}</td>
                    <td className="px-4 py-3 text-[#4d555c]">{request.subject}</td>
                    <td className="px-4 py-3">{request.artist}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[#e8f0ee] px-2 py-1 text-xs font-semibold text-[#2f6658]">
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{request.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-3">
            <h3 className="text-base font-semibold">Today</h3>
          </div>
          <div className="divide-y divide-[#eee8dd]">
            {sessions.map((session) => (
              <div key={`${session.time}-${session.client}`} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{session.time}</p>
                    <p className="mt-1 font-medium">{session.client}</p>
                    <p className="mt-1 text-sm text-[#697178]">
                      {session.artist} / {session.type}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#9f5c3c]">{session.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
          <h3 className="text-base font-semibold">MVP modules</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["Requests", "Customers", "Projects", "Artist Entry"].map((module) => (
              <div
                key={module}
                className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm font-semibold"
              >
                {module}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
          <h3 className="text-base font-semibold">Next build steps</h3>
          <ol className="mt-4 space-y-3 text-sm text-[#4d555c]">
            {buildSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1f2428] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </AppShell>
  );
}

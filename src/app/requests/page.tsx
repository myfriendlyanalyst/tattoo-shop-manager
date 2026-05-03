import { AppShell } from "@/components/app-shell";

const statusSummary = [
  { label: "New", count: 4 },
  { label: "Forwarded", count: 5 },
  { label: "Artist Replied", count: 3 },
  { label: "Consultation", count: 2 },
  { label: "Booked", count: 4 },
];

const requests = [
  {
    id: "REQ-1048",
    client: "Daniel Park",
    email: "daniel.park@gmail.com",
    phone: "818-555-0147",
    subject: "Japanese dragon back piece",
    artist: "YUSHI",
    status: "Forwarded",
    priority: "Normal",
    received: "Apr 25, 12:40 PM",
    lastTouch: "Apr 25, 1:05 PM",
    notes: "Waiting for artist direction before answering client.",
  },
  {
    id: "REQ-1047",
    client: "Sora Kim",
    email: "sora.kim@gmail.com",
    phone: "626-555-0102",
    subject: "Small lettering tattoo",
    artist: "AIMEE",
    status: "Artist Replied",
    priority: "Low",
    received: "Apr 26, 3:12 PM",
    lastTouch: "Apr 26, 4:22 PM",
    notes: "Artist approved. Client has not replied yet.",
  },
  {
    id: "REQ-1046",
    client: "Mina David",
    email: "mina.client@gmail.com",
    phone: "213-555-0188",
    subject: "Fine line floral sleeve request",
    artist: "JC",
    status: "Consultation",
    priority: "High",
    received: "Apr 24, 9:20 AM",
    lastTouch: "Apr 28, 2:00 PM",
    notes: "Client prefers afternoon consultation. Sent reference photos by email.",
  },
  {
    id: "REQ-1045",
    client: "Nora Lee",
    email: "nora.lee@gmail.com",
    phone: "323-555-0171",
    subject: "Color flower thigh tattoo",
    artist: "LESLIE",
    status: "No Answer",
    priority: "Normal",
    received: "Apr 27, 9:10 AM",
    lastTouch: "Apr 27, 12:20 PM",
    notes: "Artist replied with availability. Client has not answered yet.",
  },
  {
    id: "REQ-1044",
    client: "Chris Morgan",
    email: "chris.morgan@gmail.com",
    phone: "424-555-0166",
    subject: "Finger tattoo request",
    artist: "PHANGS",
    status: "Denied",
    priority: "Normal",
    received: "Apr 27, 3:25 PM",
    lastTouch: "Apr 27, 5:30 PM",
    notes: "Artist declined this request after reviewing placement and reference.",
  },
];

const selectedRequest = requests[0];

const timeline = [
  { label: "Request received", value: "Apr 25, 12:40 PM", done: true },
  { label: "Forwarded to artist", value: "Apr 25, 1:05 PM", done: true },
  { label: "Artist replied", value: "Waiting", done: false },
  { label: "Client replied", value: "Not yet", done: false },
  { label: "Consultation booked", value: "Not yet", done: false },
];

function statusClasses(status: string) {
  const variants: Record<string, string> = {
    New: "bg-[#f1eadc] text-[#775f36]",
    Forwarded: "bg-[#e5edf4] text-[#315f82]",
    "Artist Replied": "bg-[#e8f0ee] text-[#2f6658]",
    Consultation: "bg-[#efe7f5] text-[#674b7a]",
    Booked: "bg-[#e4f1df] text-[#476b33]",
    "No Answer": "bg-[#f4e7df] text-[#8a5130]",
    Denied: "bg-[#f3e1e1] text-[#8a3030]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

export default function RequestsPage() {
  return (
    <AppShell
      active="Requests"
      eyebrow="Request intake"
      title="Website and email requests"
      description="This is the normal starting point: website request form, email follow-up, artist assignment, consultation, then conversion into customer and project records."
      actions={
        <>
          <button
            className="h-10 rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
            type="button"
          >
            Import email
          </button>
          <button
            className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            type="button"
          >
            New request
          </button>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statusSummary.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm"
          >
            <p className="text-sm font-medium text-[#697178]}">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold">{item.count}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e5dfd4] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold">Request queue</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Sort and filter controls will connect to Supabase later.
              </p>
            </div>
            <div className="flex gap-2">
              <select className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
                <option>All statuses</option>
                <option>New</option>
                <option>Forwarded</option>
                <option>Artist Replied</option>
                <option>Consultation</option>
              </select>
              <select className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm">
                <option>All artists</option>
                <option>YUSHI</option>
                <option>BAKI</option>
                <option>JC</option>
                <option>AIMEE</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Request</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Artist</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last touch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8dd]">
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className={request.id === selectedRequest.id ? "bg-[#fffaf1]" : undefined}
                  >
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-[#8a6f4d]">{request.id}</p>
                      <p className="mt-1 font-semibold">{request.client}</p>
                      <p className="mt-1 text-[#4d555c]">{request.subject}</p>
                    </td>
                    <td className="px-4 py-4 text-[#4d555c]">
                      <p>{request.email}</p>
                      <p className="mt-1">{request.phone}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold">{request.artist}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                          request.status,
                        )}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#4d555c]">{request.lastTouch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
          <div className="border-b border-[#e5dfd4] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a6f4d]">{selectedRequest.id}</p>
            <h3 className="mt-1 text-lg font-semibold">{selectedRequest.client}</h3>
            <p className="mt-1 text-sm text-[#697178]">{selectedRequest.subject}</p>
          </div>

          <div className="space-y-5 px-4 py-4">
            <div>
              <h4 className="text-sm font-semibold">Assignment</h4>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Artist</p>
                  <p className="mt-1 font-semibold">{selectedRequest.artist}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-[#697178]">Priority</p>
                  <p className="mt-1 font-semibold">{selectedRequest.priority}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Timeline</h4>
              <ol className="mt-3 space-y-3">
                {timeline.map((item) => (
                  <li key={item.label} className="flex gap-3 text-sm">
                    <span
                      className={`mt-1 h-3 w-3 rounded-full ${
                        item.done ? "bg-[#2f6658]" : "border border-[#bdb3a3] bg-white"
                      }`}
                    />
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="text-[#697178]">{item.value}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Notes</h4>
              <p className="mt-2 rounded-md bg-[#f7f2e9] px-3 py-3 text-sm text-[#4d555c]">
                {selectedRequest.notes}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                type="button"
              >
                Update status
              </button>
              <button
                className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                type="button"
              >
                Convert to project
              </button>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

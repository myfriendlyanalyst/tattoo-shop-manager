import { AppShell } from "@/components/app-shell";

const paymentMethods = [
  { name: "Cash", enabled: true },
  { name: "Credit Card", enabled: true },
  { name: "Venmo / Zelle / Cash App", enabled: true },
  { name: "Other", enabled: false },
];

const integrationStatus = [
  { label: "Supabase", value: "Not connected", tone: "warning" },
  { label: "Website request form", value: "Email import planned", tone: "neutral" },
  { label: "Accounting app", value: "Separate app planned", tone: "neutral" },
  { label: "File storage", value: "Pending Supabase storage", tone: "warning" },
];

function statusClasses(tone: string) {
  if (tone === "warning") {
    return "bg-[#f4e7df] text-[#8a5130]";
  }

  return "bg-[#e5edf4] text-[#315f82]";
}

export default function SettingsPage() {
  return (
    <AppShell
      active="Settings"
      eyebrow="System setup"
      title="Settings"
      description="Operational defaults for the tattoo shop manager. These values will later move into Supabase-backed settings."
      actions={
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
          type="button"
        >
          Save settings
        </button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Shop profile</h3>
              <p className="mt-1 text-sm text-[#697178]">Displayed in internal records and receipts.</p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Shop name
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Oyabun Tattoo"
                />
              </label>
              <label className="text-sm font-semibold">
                Phone
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="213-555-0100"
                />
              </label>
              <label className="text-sm font-semibold">
                Email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="hello@oyabun.local"
                />
              </label>
              <label className="text-sm font-semibold">
                Timezone
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="America/Los_Angeles"
                >
                  <option>America/Los_Angeles</option>
                  <option>America/New_York</option>
                  <option>Asia/Seoul</option>
                </select>
              </label>
              <label className="sm:col-span-2 text-sm font-semibold">
                Address
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Los Angeles, CA"
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Request intake</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Requests are the normal start of the workflow.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Request email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="requests@oyabun.local"
                />
              </label>
              <label className="text-sm font-semibold">
                Default priority
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="Normal"
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm sm:col-span-2">
                <span className="font-semibold">Auto-create customer when request is booked</span>
                <input defaultChecked type="checkbox" />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Booking defaults</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Used by Calendar when creating appointments.
              </p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Booking interval
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="30 minutes"
                >
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>60 minutes</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Default appointment
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="1 hour"
                >
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>4 hours</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Consultation length
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="30 minutes"
                >
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>60 minutes</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Day view range
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  defaultValue="10 AM - 6 PM"
                >
                  <option>10 AM - 6 PM</option>
                  <option>9 AM - 7 PM</option>
                  <option>12 PM - 10 PM</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Payment methods</h3>
              <p className="mt-1 text-sm text-[#697178]">
                Available in Artist Entry. Totals remain in the accounting app.
              </p>
            </div>
            <div className="space-y-2 px-4 py-4">
              {paymentMethods.map((method) => (
                <label
                  key={method.name}
                  className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                >
                  <span className="font-semibold">{method.name}</span>
                  <input defaultChecked={method.enabled} type="checkbox" />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Data and integrations</h3>
              <p className="mt-1 text-sm text-[#697178]">Connection checklist for the next phase.</p>
            </div>
            <div className="space-y-2 px-4 py-4">
              {integrationStatus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                      item.tone,
                    )}`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

type ProjectRecord = {
  id: string;
  customer_id: string;
  artist_id: string | null;
  subject: string;
  size: string | null;
  session_type: string | null;
  waiver_signed: boolean;
  waiver_status: string;
  waiver_sent_at: string | null;
  waiver_signed_at: string | null;
  status: string;
  memo: string | null;
  created_at: string;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type AppointmentRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  status: string;
  artist: { display_name: string } | { display_name: string }[] | null;
  project: { subject: string } | { subject: string }[] | null;
};

type DepositRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  amount: number;
  available: boolean;
};

type NewCustomerForm = {
  name: string;
  email: string;
  phone: string;
  notes: string;
};

const customerSelect = "id, name, phone, email, notes, created_at";

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function projectStatusLabel(status: string) {
  const labels: Record<string, string> = {
    lead: "Booked",
    consultation: "Booked",
    booked: "Booked",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return labels[status] ?? status;
}

function projectStatusClasses(status: string) {
  const variants: Record<string, string> = {
    lead: "bg-[#e4f1df] text-[#476b33]",
    consultation: "bg-[#e4f1df] text-[#476b33]",
    booked: "bg-[#e4f1df] text-[#476b33]",
    in_progress: "bg-[#e5edf4] text-[#315f82]",
    completed: "bg-[#e8f0ee] text-[#2f6658]",
    cancelled: "bg-[#f3e1e1] text-[#8a3030]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function waiverLabel(project: ProjectRecord) {
  if (project.waiver_signed || project.waiver_status === "signed") {
    return "Signed";
  }

  if (project.waiver_status === "sent") {
    return "Sent";
  }

  return "Missing";
}

function waiverClasses(project: ProjectRecord) {
  const status = waiverLabel(project);

  if (status === "Signed") {
    return "bg-[#e8f0ee] text-[#2f6658]";
  }

  if (status === "Sent") {
    return "bg-[#e5edf4] text-[#315f82]";
  }

  return "bg-[#f4e7df] text-[#8a5130]";
}

function displayDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function projectDepositLabel(project: ProjectRecord, deposits: DepositRecord[]) {
  const projectDeposits = deposits.filter((deposit) => deposit.project_id === project.id);

  if (projectDeposits.length === 0) {
    return "No deposit";
  }

  const available = projectDeposits
    .filter((deposit) => deposit.available)
    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);
  const total = projectDeposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0);

  return available > 0 ? `${money(available)} available` : `${money(total)} used`;
}

function projectSizeLabel(project: ProjectRecord) {
  if (project.size) {
    return `${project.size} inch`;
  }

  const memoSize = project.memo?.match(/Approximate size:\s*([^\n]+)/i)?.[1]?.trim();

  return memoSize || "-";
}

function latestAppointment(customerId: string, appointments: AppointmentRecord[]) {
  return appointments
    .filter((appointment) => appointment.customer_id === customerId)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
}

function NewCustomerModal({
  error,
  saving,
  onClose,
  onSave,
}: {
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (form: NewCustomerForm) => void;
}) {
  const [form, setForm] = useState<NewCustomerForm>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-lg rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New customer</p>
            <h3 className="mt-1 text-xl font-semibold">Customer profile</h3>
          </div>
          <button
            aria-label="Close new customer"
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
          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Name"
            value={form.name}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="Email"
              type="email"
              value={form.email}
            />
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="Phone"
              value={form.phone}
            />
          </div>
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
            {saving ? "Saving..." : "Create customer"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newCustomerError, setNewCustomerError] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0],
    [customers, selectedCustomerId],
  );

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [customers, search]);

  const selectedProjects = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return projects.filter((project) => project.customer_id === selectedCustomer.id);
  }, [projects, selectedCustomer]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError("Please log in to view customers.");
        setLoading(false);
        return;
      }

      const [customerResult, projectResult, appointmentResult, depositResult] =
        await Promise.all([
          supabase.from("customers").select(customerSelect).order("created_at", { ascending: false }),
          supabase
            .from("projects")
            .select(
              "id, customer_id, artist_id, subject, size, session_type, waiver_signed, waiver_status, waiver_sent_at, waiver_signed_at, status, memo, created_at, artist:staff(display_name)",
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select(
              "id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status, artist:staff(display_name), project:projects(subject)",
            )
            .order("starts_at", { ascending: false }),
          supabase.from("deposits").select("id, customer_id, project_id, amount, available"),
        ]);

      if (customerResult.error) {
        setError(customerResult.error.message);
        setLoading(false);
        return;
      }

      if (projectResult.error) {
        setError(projectResult.error.message);
        setLoading(false);
        return;
      }

      if (appointmentResult.error) {
        setError(appointmentResult.error.message);
        setLoading(false);
        return;
      }

      if (depositResult.error) {
        setError(depositResult.error.message);
        setLoading(false);
        return;
      }

      const nextCustomers = (customerResult.data ?? []) as CustomerRecord[];

      setCustomers(nextCustomers);
      setProjects((projectResult.data ?? []) as unknown as ProjectRecord[]);
      setAppointments((appointmentResult.data ?? []) as unknown as AppointmentRecord[]);
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setSelectedCustomerId(nextCustomers[0]?.id ?? "");
      setCustomerDetailOpen(false);
      setLoading(false);
    }

    loadCustomers();
  }, []);

  async function createCustomer(form: NewCustomerForm) {
    const name = form.name.trim();

    if (!name) {
      setNewCustomerError("Customer name is required.");
      return;
    }

    setSaving(true);
    setNewCustomerError("");
    setMessage("");

    if (form.email.trim() && !isValidEmail(form.email.trim())) {
      setNewCustomerError("Enter a valid email address.");
      setSaving(false);
      return;
    }

    const result = await supabase
      .from("customers")
      .insert({
        name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      })
      .select(customerSelect)
      .single();

    if (result.error) {
      setNewCustomerError(result.error.message);
      setSaving(false);
      return;
    }

    const customer = result.data as CustomerRecord;

    setCustomers((current) => [customer, ...current]);
    setSelectedCustomerId(customer.id);
    setCustomerDetailOpen(true);
    setShowNewCustomer(false);
    setMessage("Customer created.");
    setSaving(false);
  }

  async function markWaiverSigned(project: ProjectRecord) {
    setSaving(true);
    setError("");
    setMessage("");

    const signedAt = new Date().toISOString();
    const result = await supabase
      .from("projects")
      .update({
        waiver_signed: true,
        waiver_status: "signed",
        waiver_signed_at: signedAt,
      })
      .eq("id", project.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setProjects((current) =>
      current.map((item) =>
        item.id === project.id
          ? {
              ...item,
              waiver_signed: true,
              waiver_status: "signed",
              waiver_signed_at: signedAt,
            }
          : item,
      ),
    );
    setMessage("Waiver marked as signed.");
    setSaving(false);
  }

  return (
    <AppShell
      active="Customers"
      eyebrow="Customer records"
      title="Customer directory"
      description="Customer records can originate from Requests. Use this page for contact details and a quick project overview; project work is managed in Projects."
      actions={
        <button
          className="h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
          onClick={() => {
            setNewCustomerError("");
            setShowNewCustomer(true);
          }}
          type="button"
        >
          New customer
        </button>
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading customers...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error && customers.length === 0 ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 shadow-sm">
          <p className="text-sm font-semibold text-[#30373d]">No customers yet.</p>
          <p className="mt-2 text-sm text-[#697178]">
            Convert a request to a project, or create a customer manually.
          </p>
          <button
            className="mt-4 h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            onClick={() => setShowNewCustomer(true)}
            type="button"
          >
            New customer
          </button>
        </div>
      ) : null}

      {!loading && !error && customers.length > 0 ? (
        <section className="space-y-6">
          <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
            <div className="border-b border-[#e5dfd4] px-4 py-4">
              <h3 className="text-base font-semibold">Customer list</h3>
              <input
                className="mt-3 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone"
                value={search}
              />
            </div>

            <div className="divide-y divide-[#eee8dd]">
              {filteredCustomers.map((customer) => {
                const customerProjects = projects.filter(
                  (project) => project.customer_id === customer.id,
                );

                return (
                  <button
                    key={customer.id}
                    className={`block w-full px-4 py-4 text-left transition hover:bg-[#f7f2e9] ${
                      customer.id === selectedCustomer.id ? "bg-[#fffaf1]" : ""
                    }`}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerDetailOpen(true);
                      setSelectedProjectId("");
                      setMessage("");
                      setError("");
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#8a6f4d]">
                          {customer.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 truncate font-semibold">{customer.name}</p>
                        <p className="mt-1 truncate text-sm text-[#697178]">
                          {customer.email || "-"}
                        </p>
                      </div>
                      <span className="rounded-md bg-[#f1eadc] px-2 py-1 text-xs font-semibold text-[#775f36]">
                        {customerProjects.length} project{customerProjects.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#4d555c]">
                      Created {displayDate(customer.created_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCustomer && customerDetailOpen ? (
          <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#f6f4ef] shadow-xl md:inset-6 md:left-1/2 md:max-h-[calc(100vh-3rem)] md:max-w-5xl md:-translate-x-1/2 md:rounded-md md:border md:border-[#d9d3c7]">
            {message ? (
              <p className="rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
                {message}
              </p>
            ) : null}

            <section className="shrink-0 border-b border-[#d9d3c7] bg-white shadow-sm md:rounded-t-md">
              <div className="flex flex-col gap-4 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#8a6f4d]">
                    {selectedCustomer.id.slice(0, 8)}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{selectedCustomer.name}</h3>
                  <p className="mt-1 text-sm text-[#697178]">
                    {selectedCustomer.notes || "Customer profile"}
                  </p>
                </div>
                <button
                  aria-label="Close customer detail"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                  onClick={() => {
                    setCustomerDetailOpen(false);
                    setSelectedProjectId("");
                  }}
                  type="button"
                >
                  x
                </button>
              </div>

              <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-sm text-[#697178]">Phone</p>
                  <p className="mt-1 font-semibold">{selectedCustomer.phone || "-"}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-sm text-[#697178]">Email</p>
                  <p className="mt-1 font-semibold">{selectedCustomer.email || "-"}</p>
                </div>
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                  <p className="text-sm text-[#697178]">Last appointment</p>
                  <p className="mt-1 font-semibold">
                    {displayDate(latestAppointment(selectedCustomer.id, appointments)?.starts_at ?? null)}
                  </p>
                </div>
              </div>
            </section>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e5dfd4] px-4 py-4">
                <div>
                  <h3 className="text-base font-semibold">Projects</h3>
                  <p className="mt-1 text-sm text-[#697178]">
                    Projects are created from Requests or added directly later.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#eee8dd] md:hidden">
                {selectedProjects.length === 0 ? (
                  <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                    No projects yet.
                  </p>
                ) : null}
                {selectedProjects.map((project) => {
                  const artist = relatedOne(project.artist);

                  return (
                    <button
                      key={project.id}
                      className="block w-full px-4 py-4 text-left text-sm hover:bg-[#fffaf1]"
                      onClick={() => setSelectedProjectId(project.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{project.subject}</p>
                          <p className="mt-1 text-[#697178]">
                            {artist?.display_name ?? "-"} / {projectSizeLabel(project)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                            project.status,
                          )}`}
                        >
                          {projectStatusLabel(project.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(project)}`}>
                          Waiver {waiverLabel(project)}
                        </span>
                        <span className="rounded-md bg-[#eee8dd] px-2 py-1 text-xs font-semibold text-[#4d555c]">
                          Deposit {projectDepositLabel(project, deposits)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                    {selectedProjects.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm font-semibold text-[#697178]" colSpan={6}>
                          No projects yet.
                        </td>
                      </tr>
                    ) : null}
                    {selectedProjects.map((project) => {
                      const artist = relatedOne(project.artist);

                      return (
                        <tr
                          key={project.id}
                          className="cursor-pointer hover:bg-[#fffaf1]"
                          onClick={() => setSelectedProjectId(project.id)}
                        >
                          <td className="px-4 py-4 font-semibold">{project.subject}</td>
                          <td className="px-4 py-4">{artist?.display_name ?? "-"}</td>
                          <td className="px-4 py-4 text-[#4d555c]">{projectSizeLabel(project)}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                                project.status,
                              )}`}
                            >
                              {projectStatusLabel(project.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                                  project,
                                )}`}
                              >
                                {waiverLabel(project)}
                              </span>
                              {!project.waiver_signed ? (
                                <button
                                  className="h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={saving}
                                  onClick={() => markWaiverSigned(project)}
                                  type="button"
                                >
                                  Mark signed
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-[#4d555c]">
                            {projectDepositLabel(project, deposits)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <button
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold hover:bg-[#eee8dd]"
              onClick={() => {
                setCustomerDetailOpen(false);
                setSelectedProjectId("");
              }}
              type="button"
            >
              Close
            </button>
            </div>
          </div>
          ) : null}
        </section>
      ) : null}

      {selectedProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <section className="w-full max-w-2xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-[#8a6f4d]">
                  Project detail
                </p>
                <h3 className="mt-1 text-xl font-semibold">{selectedProject.subject}</h3>
              </div>
              <button
                aria-label="Close project detail"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold hover:bg-[#eee8dd]"
                onClick={() => setSelectedProjectId("")}
                type="button"
              >
                x
              </button>
            </div>
            <div className="grid gap-3 px-5 py-5 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Artist</p>
                <p className="mt-1 font-semibold">
                  {relatedOne(selectedProject.artist)?.display_name ?? "-"}
                </p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Size</p>
                <p className="mt-1 font-semibold">{projectSizeLabel(selectedProject)}</p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Project type</p>
                <p className="mt-1 font-semibold">
                  {selectedProject.session_type || "Multiple Session"}
                </p>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                    selectedProject.status,
                  )}`}
                >
                  {projectStatusLabel(selectedProject.status)}
                </span>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Waiver</p>
                <span
                  className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                    selectedProject,
                  )}`}
                >
                  {waiverLabel(selectedProject)}
                </span>
              </div>
              <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                <p className="text-[#697178]">Deposit</p>
                <p className="mt-1 font-semibold">
                  {projectDepositLabel(selectedProject, deposits)}
                </p>
              </div>
              {selectedProject.memo ? (
                <div className="rounded-md bg-[#f7f2e9] px-3 py-3 sm:col-span-2">
                  <p className="text-[#697178]">Memo</p>
                  <p className="mt-1 whitespace-pre-wrap text-[#4d555c]">{selectedProject.memo}</p>
                </div>
              ) : null}
              <button
                className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd] sm:col-span-2"
                onClick={() => setSelectedProjectId("")}
                type="button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNewCustomer ? (
        <NewCustomerModal
          error={newCustomerError}
          onClose={() => setShowNewCustomer(false)}
          onSave={createCustomer}
          saving={saving}
        />
      ) : null}
    </AppShell>
  );
}

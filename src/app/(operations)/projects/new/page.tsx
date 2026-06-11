"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppPage } from "@/components/app-shell";
import { getSafeSession } from "@/lib/auth-session";
import { getOperationsContext } from "@/lib/operations-access";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
};

type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type RequestRecord = {
  id: string;
  artist_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  tattoo_description: string | null;
  approximate_size: string | null;
  placement: string | null;
  project_id: string | null;
};

type FormState = {
  artistId: string;
  projectName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  projectType: string;
  tattooDescription: string;
  tattooSize: string;
  tattooPlacement: string;
  depositAmount: string;
  depositPaymentMethod: string;
  depositMemo: string;
};

const projectTypeOptions = ["Walk-in", "One Done", "Multiple Session"];
const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

function emptyForm(): FormState {
  return {
    artistId: "",
    customerAddress: "",
    customerEmail: "",
    customerName: "",
    customerPhone: "",
    depositAmount: "",
    depositMemo: "",
    depositPaymentMethod: "cash",
    projectName: "",
    projectType: "Multiple Session",
    tattooDescription: "",
    tattooPlacement: "",
    tattooSize: "",
  };
}

function customerLabel(customer: CustomerRecord | null | undefined) {
  if (!customer) return "";
  return [customer.name, customer.email, customer.phone].filter(Boolean).join(" / ");
}

function projectNameFromRequest(request: RequestRecord) {
  if (request.subject?.trim()) return request.subject.trim();
  const placement = request.placement?.trim();
  return placement ? `${request.client_name} - ${placement} tattoo` : `${request.client_name} - tattoo project`;
}

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId") ?? "";
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [createdProjectId, setCreatedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 8);

    return customers
      .filter((customer) =>
        [customer.name, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [customerSearch, customers]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const context = await getOperationsContext();
      const [artistResult, customerResult, requestResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, display_name, role, active")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase.from("customers").select("id, name, email, phone").order("name", { ascending: true }),
        requestId
          ? supabase
              .from("requests")
              .select(
                "id, artist_id, client_name, email, phone, subject, tattoo_description, approximate_size, placement, project_id",
              )
              .eq("id", requestId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (artistResult.error) {
        setError(artistResult.error.message);
        setLoading(false);
        return;
      }

      if (customerResult.error) {
        setError(customerResult.error.message);
        setLoading(false);
        return;
      }

      if (requestResult.error) {
        setError(requestResult.error.message);
        setLoading(false);
        return;
      }

      const artistRows = (artistResult.data ?? []) as StaffRecord[];
      const visibleArtists =
        context?.isArtist && context.staffId
          ? artistRows.filter((artist) => artist.id === context.staffId)
          : artistRows.filter((artist) => ["Artist", "Owner"].includes(artist.role));
      const request = requestResult.data as RequestRecord | null;

      setArtists(visibleArtists);
      setCustomers((customerResult.data ?? []) as CustomerRecord[]);

      if (request?.project_id) {
        setError("This request already has a project.");
      }

      setForm((current) => ({
        ...current,
        artistId: request?.artist_id ?? context?.staffId ?? visibleArtists[0]?.id ?? "",
        customerEmail: request?.email ?? "",
        customerName: request?.client_name ?? "",
        customerPhone: request?.phone ?? "",
        projectName: request ? projectNameFromRequest(request) : "",
        tattooDescription: request?.tattoo_description ?? "",
        tattooPlacement: request?.placement ?? "",
        tattooSize: request?.approximate_size ?? "",
      }));
      setCustomerSearch(request?.client_name ?? "");
      setLoading(false);
    }

    load();
  }, [requestId]);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function selectCustomer(customer: CustomerRecord) {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customerLabel(customer));
    updateForm({
      customerEmail: customer.email ?? "",
      customerName: customer.name,
      customerPhone: customer.phone ?? "",
    });
  }

  async function saveProject() {
    setSaving(true);
    setError("");
    setMessage("");
    setCreatedProjectId("");

    const session = await getSafeSession();
    if (!session) {
      setError("Please log in to create a project.");
      setSaving(false);
      return;
    }

    const depositAmount = Number(form.depositAmount || 0);
    if (!form.projectName.trim()) {
      setError("Project name is required.");
      setSaving(false);
      return;
    }
    if (!form.customerName.trim()) {
      setError("Customer name is required.");
      setSaving(false);
      return;
    }
    if (!form.artistId) {
      setError("Select an artist.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setError("Deposit amount must be a valid number.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        artistId: form.artistId,
        customerAddress: form.customerAddress,
        customerEmail: form.customerEmail,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        depositAmount,
        depositMemo: form.depositMemo,
        depositPaymentMethod: form.depositPaymentMethod,
        projectName: form.projectName,
        projectType: form.projectType,
        requestId: requestId || undefined,
        tattooDescription: form.tattooDescription,
        tattooPlacement: form.tattooPlacement,
        tattooSize: form.tattooSize,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      projectId?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Project could not be created.");
      setSaving(false);
      return;
    }

    setCreatedProjectId(payload.projectId ?? "");
    setMessage("Project created.");
    setSaving(false);
  }

  return (
    <AppPage
      actions={
        <Link
          className="inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-4 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
          href="/projects"
        >
          Project list
        </Link>
      }
      eyebrow="Projects"
      title="New project"
    >
      <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
        <div className="border-b border-[#e5dfd4] px-4 py-4">
          <h3 className="text-base font-semibold">Project intake</h3>
        </div>
        <div className="space-y-5 px-4 py-4">
          {loading ? <p className="text-sm font-semibold text-[#697178]">Loading...</p> : null}
          {error ? (
            <p className="rounded-md bg-[#f3e1e1] px-3 py-2 text-sm font-semibold text-[#8a3030]">
              {error}
            </p>
          ) : null}
          {message ? (
            <div className="rounded-md bg-[#e4f1df] px-3 py-3 text-sm font-semibold text-[#476b33]">
              <p>{message}</p>
              {createdProjectId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="h-9 rounded-md bg-[#1f2428] px-3 text-sm font-bold text-white"
                    onClick={() => router.push(`/calendar?projectId=${createdProjectId}&artistId=${form.artistId}`)}
                    type="button"
                  >
                    Schedule now
                  </button>
                  <Link
                    className="inline-flex h-9 items-center rounded-md border border-[#cfc7b8] px-3 text-sm font-bold text-[#30373d]"
                    href="/projects"
                  >
                    Back to list
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-semibold">
              Project name
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => updateForm({ projectName: event.target.value })}
                value={form.projectName}
              />
            </label>
            <label className="block text-sm font-semibold">
              Artist
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => updateForm({ artistId: event.target.value })}
                value={form.artistId}
              >
                <option value="">Select artist</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Customer info</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="relative block text-sm font-semibold lg:col-span-2">
                Find existing customer
                <input
                  autoComplete="off"
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => {
                    setSelectedCustomerId("");
                    setCustomerSearch(event.target.value);
                  }}
                  placeholder="Type name, email, or phone"
                  value={customerSearch}
                />
                {customerSearch ? (
                  <div className="absolute left-0 right-0 top-[72px] z-20 max-h-52 overflow-y-auto rounded-md border border-[#d9d3c7] bg-white shadow-lg">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <button
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f2e9] ${
                            customer.id === selectedCustomerId ? "bg-[#f1eadc] font-semibold" : ""
                          }`}
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          type="button"
                        >
                          <span className="block font-semibold">{customer.name}</span>
                          <span className="mt-0.5 block text-xs font-normal text-[#697178]">
                            {[customer.email, customer.phone].filter(Boolean).join(" / ") || "No contact info"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm font-normal text-[#697178]">No matching customers</div>
                    )}
                  </div>
                ) : null}
              </div>
              <label className="block text-sm font-semibold">
                Name
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerName: event.target.value })}
                  value={form.customerName}
                />
              </label>
              <label className="block text-sm font-semibold">
                Email
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerEmail: event.target.value })}
                  type="email"
                  value={form.customerEmail}
                />
              </label>
              <label className="block text-sm font-semibold">
                Phone
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerPhone: event.target.value })}
                  value={form.customerPhone}
                />
              </label>
              <label className="block text-sm font-semibold">
                Address
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerAddress: event.target.value })}
                  value={form.customerAddress}
                />
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Tattoo description</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Project type
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ projectType: event.target.value })}
                  value={form.projectType}
                >
                  {projectTypeOptions.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Size
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ tattooSize: event.target.value })}
                  value={form.tattooSize}
                />
              </label>
              <label className="block text-sm font-semibold">
                Placement
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ tattooPlacement: event.target.value })}
                  value={form.tattooPlacement}
                />
              </label>
              <label className="block text-sm font-semibold lg:col-span-3">
                Description
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(event) => updateForm({ tattooDescription: event.target.value })}
                  value={form.tattooDescription}
                />
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Deposit</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Amount
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  min="0"
                  onChange={(event) => updateForm({ depositAmount: event.target.value })}
                  type="number"
                  value={form.depositAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Payment method
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ depositPaymentMethod: event.target.value })}
                  value={form.depositPaymentMethod}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold lg:col-span-3">
                Deposit memo
                <textarea
                  className="mt-2 min-h-20 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(event) => updateForm({ depositMemo: event.target.value })}
                  value={form.depositMemo}
                />
              </label>
            </div>
          </div>

          <button
            className="h-11 w-full rounded-md bg-[#1f2428] px-4 text-sm font-bold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || loading}
            onClick={saveProject}
            type="button"
          >
            {saving ? "Creating..." : "Create project"}
          </button>
        </div>
      </section>
    </AppPage>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <AppPage eyebrow="Projects" title="New project">
          <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178]">
            Loading...
          </div>
        </AppPage>
      }
    >
      <NewProjectContent />
    </Suspense>
  );
}

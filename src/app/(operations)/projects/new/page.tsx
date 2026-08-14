"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppPage } from "@/components/app-shell";
import { CustomerSearch, customerSearchLabel } from "@/components/customer-search";
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
  depositNotCollected: boolean;
  depositPaymentMethod: string;
  depositMemo: string;
};

const projectTypeOptions = ["Walk-in", "One Done", "Multiple Session"];
function emptyForm(): FormState {
  return {
    artistId: "",
    customerAddress: "",
    customerEmail: "",
    customerName: "",
    customerPhone: "",
    depositAmount: "",
    depositMemo: "",
    depositNotCollected: false,
    depositPaymentMethod: "cash",
    projectName: "",
    projectType: "Multiple Session",
    tattooDescription: "",
    tattooPlacement: "",
    tattooSize: "",
  };
}

function projectNameFromRequest(request: RequestRecord) {
  if (request.subject?.trim()) return request.subject.trim();
  const placement = request.placement?.trim();
  return placement ? `${request.client_name} - ${placement} tattoo` : `${request.client_name} - tattoo project`;
}

function projectNameFromForm(form: FormState) {
  const customer = form.customerName.trim();
  const placement = form.tattooPlacement.trim();
  const suffix = placement ? `${placement} tattoo` : form.projectType;

  return customer ? `${customer} - ${suffix}` : suffix;
}

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId") ?? "";
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [createdProjectId, setCreatedProjectId] = useState("");
  const [createdDepositId, setCreatedDepositId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      setCustomerSearch("");
      setLoading(false);
    }

    load();
  }, [requestId]);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function selectCustomer(customer: CustomerRecord) {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customerSearchLabel(customer));
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
    if (!form.customerName.trim()) {
      setError("Customer name is required.");
      setSaving(false);
      return;
    }
    if (!form.customerEmail.trim()) {
      setError("Customer email is required.");
      setSaving(false);
      return;
    }
    if (!form.customerPhone.trim()) {
      setError("Customer phone is required.");
      setSaving(false);
      return;
    }
    if (!form.artistId) {
      setError("Select an artist.");
      setSaving(false);
      return;
    }
    if (!form.tattooSize.trim()) {
      setError("Tattoo size is required.");
      setSaving(false);
      return;
    }
    if (!form.tattooPlacement.trim()) {
      setError("Tattoo placement is required.");
      setSaving(false);
      return;
    }
    if (!form.tattooDescription.trim()) {
      setError("Tattoo description is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setError("Deposit amount must be a valid number.");
      setSaving(false);
      return;
    }
    if (depositAmount <= 0 && !form.depositNotCollected) {
      setError("Enter a deposit amount, or check No deposit collected.");
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
        customerEmail: form.customerEmail,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        depositAmount,
        depositMemo: form.depositMemo,
        depositPaymentMethod: form.depositPaymentMethod,
        projectName: projectNameFromForm(form),
        projectType: form.projectType,
        requestId: requestId || undefined,
        tattooDescription: form.tattooDescription,
        tattooPlacement: form.tattooPlacement,
        tattooSize: form.tattooSize,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      depositId?: string | null;
      projectId?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Project could not be created.");
      setSaving(false);
      return;
    }

    setCreatedProjectId(payload.projectId ?? "");
    setCreatedDepositId(payload.depositId ?? "");
    setMessage("Project created.");
    setSaving(false);
  }

  const requiredMark = <span className="text-[#8a3030]">*</span>;

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
          {message && createdProjectId ? (
            <div className="rounded-md border border-[#b8d5ae] bg-[#eef8ea] px-5 py-5 text-[#355b27]">
              <p className="text-xs font-black uppercase tracking-[0.1em]">Project created</p>
              <h3 className="mt-2 text-xl font-black text-[#1f2428]">{projectNameFromForm(form)}</h3>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs font-bold uppercase text-[#697178]">Customer</dt><dd className="mt-1 font-semibold text-[#1f2428]">{form.customerName}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-[#697178]">Project type</dt><dd className="mt-1 font-semibold text-[#1f2428]">{form.projectType}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-[#697178]">Deposit</dt><dd className="mt-1 font-semibold text-[#1f2428]">{Number(form.depositAmount) > 0 ? `$${Number(form.depositAmount).toFixed(2)} / ${form.depositPaymentMethod === "app" ? "App" : "Cash"}` : "Not collected"}</dd></div>
              </dl>
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
                    className="inline-flex h-9 items-center rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-bold text-[#30373d]"
                    href="/projects"
                  >
                    View or edit project
                  </Link>
                  {createdDepositId ? <Link className="inline-flex h-9 items-center rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-bold text-[#30373d]" href={`/projects/deposit/${createdDepositId}/receipt`}>Print deposit receipt</Link> : null}
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

          {!createdProjectId ? <><section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 shadow-sm">
            <h4 className="text-sm font-semibold text-[#6f7275]">Project type {requiredMark}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {projectTypeOptions.map((type) => (
                  <button className={`min-h-20 rounded-md border px-4 py-3 text-left transition ${form.projectType === type ? "border-[#1f2428] bg-[#1f2428] text-white" : "border-[#cfc7b8] bg-white hover:bg-[#eee8dd]"}`} key={type} onClick={() => updateForm({ projectType: type })} type="button">
                    <span className="block text-base font-black">{type}</span>
                    <span className={`mt-1 block text-xs ${form.projectType === type ? "text-white/70" : "text-[#697178]"}`}>{type === "Multiple Session" ? "Several appointments" : type === "Walk-in" ? "Same-day client" : "Single appointment"}</span>
                  </button>
                ))}
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 shadow-sm">
            <h4 className="text-sm font-semibold text-[#6f7275]">Customer info</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <CustomerSearch
                  customers={customers}
                  onChange={(value) => {
                    setSelectedCustomerId("");
                    setCustomerSearch(value);
                  }}
                  onSelect={selectCustomer}
                  selectedCustomerId={selectedCustomerId}
                  value={customerSearch}
                />
              </div>
              <label className="block text-sm font-semibold">
                Name {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerName: event.target.value })}
                  required
                  value={form.customerName}
                />
              </label>
              <label className="block text-sm font-semibold">
                Email {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerEmail: event.target.value })}
                  required
                  type="email"
                  value={form.customerEmail}
                />
              </label>
              <label className="block text-sm font-semibold">
                Phone {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ customerPhone: event.target.value })}
                  required
                  value={form.customerPhone}
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 shadow-sm">
            <h4 className="text-sm font-semibold text-[#6f7275]">Tattoo description</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Size {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ tattooSize: event.target.value })}
                  required
                  value={form.tattooSize}
                />
              </label>
              <label className="block text-sm font-semibold">
                Placement {requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  onChange={(event) => updateForm({ tattooPlacement: event.target.value })}
                  required
                  value={form.tattooPlacement}
                />
              </label>
              <label className="block text-sm font-semibold lg:col-span-3">
                Description {requiredMark}
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  onChange={(event) => updateForm({ tattooDescription: event.target.value })}
                  required
                  value={form.tattooDescription}
                />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-[#fdfbf7] px-4 py-4 shadow-sm">
            <h4 className="text-sm font-semibold text-[#6f7275]">Deposit</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <label className="block text-sm font-semibold">
                Amount {form.depositNotCollected ? null : requiredMark}
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                  disabled={form.depositNotCollected}
                  min="0"
                  onChange={(event) => updateForm({ depositAmount: event.target.value })}
                  required={!form.depositNotCollected}
                  type="number"
                  value={form.depositAmount}
                />
              </label>
              <label className="block text-sm font-semibold">
                Payment method
                <select className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm" disabled={form.depositNotCollected} onChange={(event) => updateForm({ depositPaymentMethod: event.target.value })} value={form.depositPaymentMethod}>
                  <option value="cash">Cash</option>
                  <option value="app">App</option>
                </select>
              </label>
              <label className="flex min-h-10 items-center gap-2 self-end rounded-md border border-[#d9d3c7] bg-white px-3 py-2 text-sm font-semibold">
                <input
                  checked={form.depositNotCollected}
                  onChange={(event) =>
                    updateForm({
                      depositAmount: event.target.checked ? "" : form.depositAmount,
                      depositNotCollected: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                No deposit collected {form.depositAmount ? null : requiredMark}
              </label>
              <label className="block text-sm font-semibold lg:col-span-3">
                Deposit memo
                <textarea
                  className="mt-2 min-h-20 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                  disabled={form.depositNotCollected}
                  onChange={(event) => updateForm({ depositMemo: event.target.value })}
                  value={form.depositMemo}
                />
              </label>
            </div>
          </section>

          <button
            className="h-11 w-full rounded-md bg-[#1f2428] px-4 text-sm font-bold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || loading || Boolean(createdProjectId)}
            onClick={saveProject}
            type="button"
          >
            {saving ? "Creating..." : createdProjectId ? "Project created" : "Create project"}
          </button>
          </> : null}
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

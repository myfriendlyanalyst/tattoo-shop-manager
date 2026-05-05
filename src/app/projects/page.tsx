"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
};

type CustomerRelation = {
  name: string;
  email: string | null;
  phone: string | null;
};

type ArtistRelation = {
  display_name: string;
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
  customer: CustomerRelation | CustomerRelation[] | null;
  artist: ArtistRelation | ArtistRelation[] | null;
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
};

type DepositRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  amount: number;
  payment_method: string | null;
  received_at: string;
  available: boolean;
  memo: string | null;
};

type SessionEntryRecord = {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  artist_id: string | null;
  entered_at: string;
  entry_type: string;
  tattoo_amount: number | null;
  tip_amount: number | null;
};

const projectSelect =
  "id, customer_id, artist_id, subject, size, session_type, waiver_signed, waiver_status, waiver_sent_at, waiver_signed_at, status, memo, created_at, customer:customers(name, email, phone), artist:staff(display_name)";

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
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

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function projectStatusLabel(status: string) {
  const labels: Record<string, string> = {
    lead: "Lead",
    consultation: "Consultation",
    booked: "Booked",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return labels[status] ?? status;
}

function projectStatusClasses(status: string) {
  const variants: Record<string, string> = {
    lead: "bg-[#f1eadc] text-[#775f36]",
    consultation: "bg-[#efe7f5] text-[#674b7a]",
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

function artistName(project: ProjectRecord) {
  return relatedOne(project.artist)?.display_name ?? "Unassigned";
}

function customerName(project: ProjectRecord) {
  return relatedOne(project.customer)?.name ?? "Unknown customer";
}

function groupLabel(project: ProjectRecord) {
  return artistName(project);
}

export default function ProjectsPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [sessions, setSessions] = useState<SessionEntryRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [artistFilter, setArtistFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.filter((project) => {
      const customer = relatedOne(project.customer);
      const artistMatches = artistFilter === "all" || project.artist_id === artistFilter;
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? ["lead", "consultation", "booked", "in_progress"].includes(project.status)
          : project.status === statusFilter);
      const searchMatches =
        !term ||
        [project.subject, project.size, customer?.name, customer?.email, artistName(project)]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return artistMatches && statusMatches && searchMatches;
    });
  }, [artistFilter, projects, search, statusFilter]);

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, ProjectRecord[]>();

    filteredProjects.forEach((project) => {
      const label = groupLabel(project);
      groups.set(label, [...(groups.get(label) ?? []), project]);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProjects]);

  const selectedProject = useMemo(
    () =>
      projects.find((project) => project.id === selectedProjectId) ??
      filteredProjects[0] ??
      projects[0],
    [filteredProjects, projects, selectedProjectId],
  );

  const selectedAppointments = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return appointments.filter((appointment) => appointment.project_id === selectedProject.id);
  }, [appointments, selectedProject]);

  const selectedDeposits = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return deposits.filter((deposit) => deposit.project_id === selectedProject.id);
  }, [deposits, selectedProject]);

  const selectedSessions = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return sessions.filter((session) => session.project_id === selectedProject.id);
  }, [selectedProject, sessions]);

  const activeCount = projects.filter((project) =>
    ["lead", "consultation", "booked", "in_progress"].includes(project.status),
  ).length;
  const waiverMissingCount = projects.filter((project) => waiverLabel(project) !== "Signed").length;
  const availableDepositTotal = deposits
    .filter((deposit) => deposit.available)
    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError("Please log in to view projects.");
        setLoading(false);
        return;
      }

      const [staffResult, projectResult, appointmentResult, depositResult, sessionResult] =
        await Promise.all([
          supabase
            .from("staff")
            .select("id, display_name, role, active")
            .order("display_name", { ascending: true }),
          supabase.from("projects").select(projectSelect).order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select("id, customer_id, project_id, artist_id, starts_at, ends_at, appointment_type, status")
            .order("starts_at", { ascending: false }),
          supabase
            .from("deposits")
            .select(
              "id, customer_id, project_id, artist_id, amount, payment_method, received_at, available, memo",
            )
            .order("received_at", { ascending: false }),
          supabase
            .from("session_entries")
            .select(
              "id, customer_id, project_id, artist_id, entered_at, entry_type, tattoo_amount, tip_amount",
            )
            .order("entered_at", { ascending: false }),
        ]);

      if (staffResult.error) {
        setError(staffResult.error.message);
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

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setLoading(false);
        return;
      }

      const nextProjects = (projectResult.data ?? []) as unknown as ProjectRecord[];

      setStaff((staffResult.data ?? []) as StaffRecord[]);
      setProjects(nextProjects);
      setAppointments((appointmentResult.data ?? []) as AppointmentRecord[]);
      setDeposits((depositResult.data ?? []) as DepositRecord[]);
      setSessions((sessionResult.data ?? []) as SessionEntryRecord[]);
      setSelectedProjectId(nextProjects[0]?.id ?? "");
      setLoading(false);
    }

    loadProjects();
  }, []);

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
      active="Projects"
      eyebrow="Project queue"
      title="Projects by artist"
      description="Track each tattoo project separately from the customer profile, including artist ownership, appointments, deposits, waiver state, and session entries."
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading projects...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Total projects</p>
              <p className="mt-2 text-2xl font-semibold">{projects.length}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Active</p>
              <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Waiver pending</p>
              <p className="mt-2 text-2xl font-semibold">{waiverMissingCount}</p>
            </div>
            <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-[#697178]">Available deposits</p>
              <p className="mt-2 text-2xl font-semibold">{money(availableDepositTotal)}</p>
            </div>
          </section>

          <section className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_0.7fr]">
              <input
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search project, customer, artist, email"
                value={search}
              />
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setArtistFilter(event.target.value)}
                value={artistFilter}
              >
                <option value="all">All artists</option>
                {staff
                  .filter((member) => member.active && member.role === "Artist")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name}
                    </option>
                  ))}
              </select>
              <select
                className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="active">Active statuses</option>
                <option value="all">All statuses</option>
                <option value="lead">Lead</option>
                <option value="consultation">Consultation</option>
                <option value="booked">Booked</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </section>

          {message ? (
            <p className="rounded-md bg-[#e4f1df] px-4 py-3 text-sm font-semibold text-[#476b33]">
              {message}
            </p>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
            <div className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
              <div className="border-b border-[#e5dfd4] px-4 py-4">
                <h3 className="text-base font-semibold">Artist project list</h3>
                <p className="mt-1 text-sm text-[#697178]">
                  {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <div className="max-h-[760px] overflow-y-auto">
                {groupedProjects.length === 0 ? (
                  <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                    No projects match these filters.
                  </p>
                ) : null}

                {groupedProjects.map(([artist, artistProjects]) => (
                  <div key={artist} className="border-b border-[#eee8dd] last:border-b-0">
                    <div className="bg-[#f7f2e9] px-4 py-2">
                      <p className="text-xs font-bold uppercase text-[#6f7275]">
                        {artist} · {artistProjects.length}
                      </p>
                    </div>
                    <div className="divide-y divide-[#eee8dd]">
                      {artistProjects.map((project) => (
                        <button
                          key={project.id}
                          className={`block w-full px-4 py-4 text-left transition hover:bg-[#fffaf1] ${
                            selectedProject?.id === project.id ? "bg-[#fffaf1]" : ""
                          }`}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setMessage("");
                            setError("");
                          }}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{project.subject}</p>
                              <p className="mt-1 truncate text-sm text-[#697178]">
                                {customerName(project)}
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
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                                project,
                              )}`}
                            >
                              Waiver {waiverLabel(project)}
                            </span>
                            <span className="rounded-md bg-[#eee8dd] px-2 py-1 text-xs font-semibold text-[#4d555c]">
                              {project.size || "Size not set"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedProject ? (
              <div className="space-y-6">
                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-[#e5dfd4] px-4 py-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#8a6f4d]">
                        {selectedProject.id.slice(0, 8)}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">{selectedProject.subject}</h3>
                      <p className="mt-1 text-sm text-[#697178]">
                        {selectedProject.memo || "Project details"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${projectStatusClasses(
                          selectedProject.status,
                        )}`}
                      >
                        {projectStatusLabel(selectedProject.status)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${waiverClasses(
                          selectedProject,
                        )}`}
                      >
                        Waiver {waiverLabel(selectedProject)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Customer</p>
                      <p className="mt-1 font-semibold">{customerName(selectedProject)}</p>
                      <p className="mt-1 text-sm text-[#697178]">
                        {relatedOne(selectedProject.customer)?.email || "-"}
                      </p>
                    </div>
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Artist</p>
                      <p className="mt-1 font-semibold">{artistName(selectedProject)}</p>
                      <p className="mt-1 text-sm text-[#697178]">
                        {selectedProject.session_type || "Session type not set"}
                      </p>
                    </div>
                    <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                      <p className="text-sm text-[#697178]">Waiver signed</p>
                      <p className="mt-1 font-semibold">
                        {displayDate(selectedProject.waiver_signed_at)}
                      </p>
                      {!selectedProject.waiver_signed ? (
                        <button
                          className="mt-2 h-8 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={saving}
                          onClick={() => markWaiverSigned(selectedProject)}
                          type="button"
                        >
                          Mark signed
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Session entries</h3>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedSessions.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No session entries yet.
                      </p>
                    ) : null}
                    {selectedSessions.map((session) => (
                      <div
                        key={session.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.8fr_1fr]"
                      >
                        <div>
                          <p className="font-semibold">{displayDateTime(session.entered_at)}</p>
                          <p className="text-[#697178]">{session.entry_type}</p>
                        </div>
                        <p className="font-semibold">{money(session.tattoo_amount)} tattoo</p>
                        <p className="text-[#4d555c]">{money(session.tip_amount)} tip</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Deposits</h3>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedDeposits.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No deposits yet.
                      </p>
                    ) : null}
                    {selectedDeposits.map((deposit) => (
                      <div
                        key={deposit.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.7fr_0.6fr_0.7fr_1fr]"
                      >
                        <p className="font-semibold">{displayDate(deposit.received_at)}</p>
                        <p className="font-semibold">{money(deposit.amount)}</p>
                        <p className={deposit.available ? "text-[#2f6658]" : "text-[#697178]"}>
                          {deposit.available ? "Available" : "Used"}
                        </p>
                        <p className="text-[#4d555c]">{deposit.memo || deposit.payment_method || "-"}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                  <div className="border-b border-[#e5dfd4] px-4 py-4">
                    <h3 className="text-base font-semibold">Appointments</h3>
                  </div>
                  <div className="divide-y divide-[#eee8dd]">
                    {selectedAppointments.length === 0 ? (
                      <p className="px-4 py-6 text-sm font-semibold text-[#697178]">
                        No appointments yet.
                      </p>
                    ) : null}
                    {selectedAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.8fr_0.8fr_0.6fr]"
                      >
                        <div>
                          <p className="font-semibold">{displayDateTime(appointment.starts_at)}</p>
                          <p className="text-[#697178]">
                            {appointment.ends_at ? displayDateTime(appointment.ends_at) : "-"}
                          </p>
                        </div>
                        <p className="font-semibold">{appointment.appointment_type}</p>
                        <p className="text-[#4d555c]">{appointment.status}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
                Select a project.
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

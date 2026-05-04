"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
};

type StaffPermission = {
  staff_id: string;
  permission_key: string;
  enabled: boolean;
};

type RequestRecord = {
  id: string;
  customer_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  tattoo_description: string | null;
  approximate_size: string | null;
  placement: string | null;
  reference_image_url: string | null;
  requested_artist_label: string | null;
  age_confirmed: boolean;
  artist_id: string | null;
  status: string;
  priority: string;
  received_at: string;
  forwarded_at: string | null;
  artist_reply_at: string | null;
  client_reply_at: string | null;
  consultation_at: string | null;
  booked_at: string | null;
  notes: string | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type CandidateRecord = {
  id: string;
  request_id: string;
  artist_id: string;
  status: string;
  responded_at: string | null;
  notes: string | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type RequestFile = {
  id: string;
  request_id: string | null;
  file_type: string;
  storage_path: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  url?: string;
};

type NewRequestForm = {
  clientName: string;
  email: string;
  phone: string;
  subject: string;
  tattooDescription: string;
  approximateSize: string;
  placement: string;
  referenceFile: File | null;
  requestedArtistLabel: string;
  ageConfirmed: boolean;
  artistId: string;
  priority: string;
  notes: string;
};

const statusOptions = [
  "new",
  "forwarded",
  "artist_replied",
  "client_replied",
  "consultation",
  "booked",
  "client_waiting_for_reply",
  "no_answer",
  "denied",
];

const summaryStatuses = [
  "new",
  "forwarded",
  "artist_replied",
  "consultation",
  "booked",
];

const referenceBucket = "request-references";
const requestSelect =
  "id, customer_id, client_name, email, phone, subject, tattoo_description, approximate_size, placement, reference_image_url, requested_artist_label, age_confirmed, artist_id, status, priority, received_at, forwarded_at, artist_reply_at, client_reply_at, consultation_at, booked_at, notes, artist:staff(display_name)";

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    forwarded: "Forwarded",
    artist_replied: "Artist Replied",
    client_replied: "Client Replied",
    consultation: "Consultation",
    booked: "Booked",
    client_waiting_for_reply: "Waiting Client",
    no_answer: "No Answer",
    denied: "Denied",
    sent: "Sent",
    interested: "Interested",
    passed: "Pass",
    selected: "Selected",
    declined: "Declined",
  };

  return labels[status] ?? status;
}

function statusClasses(status: string) {
  const variants: Record<string, string> = {
    new: "bg-[#f1eadc] text-[#775f36]",
    forwarded: "bg-[#e5edf4] text-[#315f82]",
    artist_replied: "bg-[#e8f0ee] text-[#2f6658]",
    client_replied: "bg-[#e8f0ee] text-[#2f6658]",
    consultation: "bg-[#efe7f5] text-[#674b7a]",
    booked: "bg-[#e4f1df] text-[#476b33]",
    client_waiting_for_reply: "bg-[#f4e7df] text-[#8a5130]",
    no_answer: "bg-[#f4e7df] text-[#8a5130]",
    denied: "bg-[#f3e1e1] text-[#8a3030]",
    sent: "bg-[#e5edf4] text-[#315f82]",
    interested: "bg-[#e8f0ee] text-[#2f6658]",
    passed: "bg-[#f4e7df] text-[#8a5130]",
    selected: "bg-[#e4f1df] text-[#476b33]",
    declined: "bg-[#f3e1e1] text-[#8a3030]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function priorityLabel(priority: string) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function displayDateTime(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function canShowInCalendar(staff: StaffRecord, permissionRows: StaffPermission[]) {
  const bookingPermission = permissionRows.find(
    (permission) =>
      permission.staff_id === staff.id && permission.permission_key === "calendarBooking",
  );

  if (bookingPermission) {
    return bookingPermission.enabled;
  }

  return staff.role === "Artist";
}

function timelineFor(request: RequestRecord) {
  return [
    { label: "Request received", value: displayDateTime(request.received_at), done: true },
    {
      label: "Forwarded to artist",
      value: displayDateTime(request.forwarded_at),
      done: Boolean(request.forwarded_at),
    },
    {
      label: "Artist replied",
      value: displayDateTime(request.artist_reply_at),
      done: Boolean(request.artist_reply_at),
    },
    {
      label: "Client replied",
      value: displayDateTime(request.client_reply_at),
      done: Boolean(request.client_reply_at),
    },
    {
      label: "Consultation booked",
      value: displayDateTime(request.consultation_at),
      done: Boolean(request.consultation_at),
    },
  ];
}

function requestDetailMemo(request: RequestRecord) {
  return [
    request.notes,
    request.tattoo_description ? `Tattoo description: ${request.tattoo_description}` : null,
    request.approximate_size ? `Approximate size: ${request.approximate_size}` : null,
    request.placement ? `Placement: ${request.placement}` : null,
    request.reference_image_url ? `Reference image: ${request.reference_image_url}` : null,
    request.requested_artist_label ? `Requested artist: ${request.requested_artist_label}` : null,
    `Age confirmed: ${request.age_confirmed ? "Yes" : "No"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function filesWithSignedUrls(files: RequestFile[]) {
  return Promise.all(
    files.map(async (file) => {
      const { data } = await supabase.storage
        .from(referenceBucket)
        .createSignedUrl(file.storage_path, 60 * 60);

      return {
        ...file,
        url: data?.signedUrl,
      };
    }),
  );
}

function NewRequestModal({
  artists,
  error,
  saving,
  onClose,
  onSave,
}: {
  artists: StaffRecord[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (form: NewRequestForm) => void;
}) {
  const [form, setForm] = useState<NewRequestForm>({
    clientName: "",
    email: "",
    phone: "",
    subject: "",
    tattooDescription: "",
    approximateSize: "",
    placement: "",
    referenceFile: null,
    requestedArtistLabel: "Any available artist",
    ageConfirmed: true,
    artistId: "",
    priority: "normal",
    notes: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <section className="w-full max-w-xl rounded-md border border-[#d9d3c7] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfd4] px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#8a6f4d]">New request</p>
            <h3 className="mt-1 text-xl font-semibold">Manual intake</h3>
            <p className="mt-1 text-sm text-[#697178]">
              Use this for testing before Make.com starts inserting Webflow requests.
            </p>
          </div>
          <button
            aria-label="Close new request"
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
            onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
            placeholder="Client name"
            value={form.clientName}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              type="email"
              value={form.email}
            />
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone"
              value={form.phone}
            />
          </div>
          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            placeholder="Short request subject"
            value={form.subject}
          />
          <textarea
            className="min-h-24 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
            onChange={(event) =>
              setForm((current) => ({ ...current, tattooDescription: event.target.value }))
            }
            placeholder="Tattoo description"
            value={form.tattooDescription}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, approximateSize: event.target.value }))
              }
              placeholder="Approximate size"
              value={form.approximateSize}
            />
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, placement: event.target.value }))
              }
              placeholder="Placement"
              value={form.placement}
            />
          </div>
          <label className="block rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm font-semibold">
            Reference image
            <input
              accept="image/*"
              className="mt-2 block w-full text-sm text-[#4d555c]"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  referenceFile: event.target.files?.[0] ?? null,
                }))
              }
              type="file"
            />
            {form.referenceFile ? (
              <span className="mt-2 block text-xs font-medium text-[#697178]">
                {form.referenceFile.name}
              </span>
            ) : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => {
                const selectedArtist = artists.find((artist) => artist.id === event.target.value);

                setForm((current) => ({
                  ...current,
                  artistId: event.target.value,
                  requestedArtistLabel: selectedArtist?.display_name ?? "Any available artist",
                }));
              }}
              value={form.artistId}
            >
              <option value="">Any available</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.display_name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              value={form.priority}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm font-semibold">
            <input
              checked={form.ageConfirmed}
              onChange={(event) =>
                setForm((current) => ({ ...current, ageConfirmed: event.target.checked }))
              }
              type="checkbox"
            />
            Client confirmed they are 18 years or older
          </label>
          <textarea
            className="min-h-28 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Request notes, placement, references, availability, budget, etc."
            value={form.notes}
          />
          <button
            className="h-10 w-full rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            onClick={() => onSave(form)}
            type="button"
          >
            {saving ? "Saving..." : "Create request"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [requestFiles, setRequestFiles] = useState<RequestFile[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [artistToAdd, setArtistToAdd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artistFilter, setArtistFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequestError, setNewRequestError] = useState("");

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? requests[0],
    [requests, selectedRequestId],
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const statusMatches = statusFilter === "all" || request.status === statusFilter;
      const artistMatches = artistFilter === "all" || request.artist_id === artistFilter;

      return statusMatches && artistMatches;
    });
  }, [artistFilter, requests, statusFilter]);

  const selectedCandidates = useMemo(() => {
    if (!selectedRequest) {
      return [];
    }

    return candidates.filter((candidate) => candidate.request_id === selectedRequest.id);
  }, [candidates, selectedRequest]);

  const selectedFiles = useMemo(() => {
    if (!selectedRequest) {
      return [];
    }

    return requestFiles.filter((file) => file.request_id === selectedRequest.id);
  }, [requestFiles, selectedRequest]);

  const candidateArtistIds = new Set(selectedCandidates.map((candidate) => candidate.artist_id));
  const availableArtistsToAdd = artists.filter((artist) => !candidateArtistIds.has(artist.id));

  const statusSummary = summaryStatuses.map((status) => ({
    label: statusLabel(status),
    count: requests.filter((request) => request.status === status).length,
  }));

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setError("Please log in to view requests.");
        setLoading(false);
        return;
      }

      const [requestResult, staffResult, permissionResult, candidateResult, fileResult] = await Promise.all([
        supabase
          .from("requests")
          .select(requestSelect)
          .order("received_at", { ascending: false }),
        supabase
          .from("staff")
          .select("id, display_name, role")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("staff_permissions")
          .select("staff_id, permission_key, enabled")
          .eq("permission_key", "calendarBooking"),
        supabase
          .from("request_artist_candidates")
          .select("id, request_id, artist_id, status, responded_at, notes, artist:staff(display_name)")
          .order("created_at", { ascending: true }),
        supabase
          .from("files")
          .select("id, request_id, file_type, storage_path, original_name, mime_type, size_bytes")
          .eq("file_type", "reference")
          .not("request_id", "is", null)
          .order("created_at", { ascending: true }),
      ]);

      if (requestResult.error) {
        setError(requestResult.error.message);
        setLoading(false);
        return;
      }

      if (staffResult.error) {
        setError(staffResult.error.message);
        setLoading(false);
        return;
      }

      if (permissionResult.error) {
        setError(permissionResult.error.message);
        setLoading(false);
        return;
      }

      if (candidateResult.error) {
        setError(`${candidateResult.error.message}. Run docs/supabase_request_candidates.sql in Supabase SQL Editor.`);
        setLoading(false);
        return;
      }

      if (fileResult.error) {
        setError(fileResult.error.message);
        setLoading(false);
        return;
      }

      const nextRequests = (requestResult.data ?? []) as unknown as RequestRecord[];
      const nextPermissions = permissionResult.data ?? [];
      const nextArtists = (staffResult.data ?? []).filter((staff) =>
        canShowInCalendar(staff, nextPermissions),
      );
      const nextFiles = await filesWithSignedUrls((fileResult.data ?? []) as RequestFile[]);

      setRequests(nextRequests);
      setArtists(nextArtists);
      setCandidates((candidateResult.data ?? []) as unknown as CandidateRecord[]);
      setRequestFiles(nextFiles);
      setSelectedRequestId(nextRequests[0]?.id ?? "");
      setArtistToAdd(nextArtists[0]?.id ?? "");
      setLoading(false);
    }

    loadRequests();
  }, []);

  async function updateRequestStatus(status: string) {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const patch: Partial<RequestRecord> = { status };

    if (status === "forwarded") {
      patch.forwarded_at = new Date().toISOString();
    }

    if (status === "artist_replied") {
      patch.artist_reply_at = new Date().toISOString();
    }

    if (status === "consultation") {
      patch.consultation_at = new Date().toISOString();
    }

    if (status === "booked") {
      patch.booked_at = new Date().toISOString();
    }

    const result = await supabase.from("requests").update(patch).eq("id", selectedRequest.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id ? { ...request, ...patch } : request,
      ),
    );
    setMessage("Request status updated.");
    setSaving(false);
  }

  async function createRequest(form: NewRequestForm) {
    const clientName = form.clientName.trim();
    const subject = form.subject.trim();

    if (!clientName || !subject) {
      setNewRequestError("Client name and subject are required.");
      return;
    }

    setSaving(true);
    setNewRequestError("");

    const result = await supabase
      .from("requests")
      .insert({
        client_name: clientName,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        subject,
        tattoo_description: form.tattooDescription.trim() || subject,
        approximate_size: form.approximateSize.trim() || null,
        placement: form.placement.trim() || null,
        reference_image_url: null,
        requested_artist_label: form.requestedArtistLabel,
        age_confirmed: form.ageConfirmed,
        artist_id: form.artistId || null,
        priority: form.priority,
        notes: form.notes.trim() || null,
        status: "new",
      })
      .select(requestSelect)
      .single();

    if (result.error) {
      setNewRequestError(result.error.message);
      setSaving(false);
      return;
    }

    const request = result.data as unknown as RequestRecord;

    if (form.referenceFile) {
      const storagePath = `requests/${request.id}/${Date.now()}-${safeFileName(
        form.referenceFile.name,
      )}`;
      const uploadResult = await supabase.storage
        .from(referenceBucket)
        .upload(storagePath, form.referenceFile, {
          contentType: form.referenceFile.type || undefined,
        });

      if (uploadResult.error) {
        setNewRequestError(uploadResult.error.message);
        setSaving(false);
        return;
      }

      const fileResult = await supabase
        .from("files")
        .insert({
          request_id: request.id,
          file_type: "reference",
          storage_path: storagePath,
          original_name: form.referenceFile.name,
          mime_type: form.referenceFile.type || null,
          size_bytes: form.referenceFile.size,
        })
        .select("id, request_id, file_type, storage_path, original_name, mime_type, size_bytes")
        .single();

      if (fileResult.error) {
        setNewRequestError(fileResult.error.message);
        setSaving(false);
        return;
      }

      const [newFile] = await filesWithSignedUrls([fileResult.data as RequestFile]);
      setRequestFiles((current) => [...current, newFile]);
    }

    setRequests((current) => [request, ...current]);
    setSelectedRequestId(request.id);
    setShowNewRequest(false);
    setMessage("Request created.");
    setSaving(false);
  }

  async function addCandidate() {
    if (!selectedRequest || !artistToAdd) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase
      .from("request_artist_candidates")
      .insert({
        request_id: selectedRequest.id,
        artist_id: artistToAdd,
        status: "sent",
      })
      .select("id, request_id, artist_id, status, responded_at, notes, artist:staff(display_name)")
      .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const requestPatch = {
      status: "forwarded",
      forwarded_at: selectedRequest.forwarded_at ?? new Date().toISOString(),
    };

    await supabase.from("requests").update(requestPatch).eq("id", selectedRequest.id);

    setCandidates((current) => [...current, result.data as unknown as CandidateRecord]);
    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id ? { ...request, ...requestPatch } : request,
      ),
    );
    setMessage("Candidate artist added.");
    setArtistToAdd(availableArtistsToAdd.find((artist) => artist.id !== artistToAdd)?.id ?? "");
    setSaving(false);
  }

  async function updateCandidate(candidate: CandidateRecord, status: string) {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const candidatePatch = {
      status,
      responded_at: ["interested", "passed", "declined", "selected"].includes(status)
        ? new Date().toISOString()
        : candidate.responded_at,
    };

    const candidateResult = await supabase
      .from("request_artist_candidates")
      .update(candidatePatch)
      .eq("id", candidate.id);

    if (candidateResult.error) {
      setError(candidateResult.error.message);
      setSaving(false);
      return;
    }

    const requestPatch =
      status === "selected"
        ? {
            artist_id: candidate.artist_id,
            status: "artist_replied",
            artist_reply_at: selectedRequest.artist_reply_at ?? new Date().toISOString(),
          }
        : status === "interested"
          ? {
              status: "artist_replied",
              artist_reply_at: selectedRequest.artist_reply_at ?? new Date().toISOString(),
            }
          : null;

    if (status === "selected") {
      await supabase
        .from("request_artist_candidates")
        .update({ status: "sent" })
        .eq("request_id", selectedRequest.id)
        .neq("id", candidate.id)
        .eq("status", "selected");
    }

    if (requestPatch) {
      await supabase.from("requests").update(requestPatch).eq("id", selectedRequest.id);
    }

    setCandidates((current) =>
      current.map((item) =>
        item.id === candidate.id
          ? { ...item, ...candidatePatch }
          : status === "selected" &&
              item.request_id === selectedRequest.id &&
              item.status === "selected"
            ? { ...item, status: "sent" }
            : item,
      ),
    );
    if (requestPatch) {
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? { ...request, ...requestPatch } : request,
        ),
      );
    }
    setMessage(status === "selected" ? "Artist selected for this request." : "Candidate updated.");
    setSaving(false);
  }

  async function convertToProject() {
    if (!selectedRequest) {
      return;
    }

    if (!selectedRequest.artist_id) {
      setError("Select an artist before converting this request.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let customerId = selectedRequest.customer_id;

    if (!customerId) {
      const customerResult = await supabase
        .from("customers")
        .insert({
          name: selectedRequest.client_name,
          email: selectedRequest.email,
          phone: selectedRequest.phone,
          notes: requestDetailMemo(selectedRequest),
        })
        .select("id")
        .single();

      if (customerResult.error) {
        setError(customerResult.error.message);
        setSaving(false);
        return;
      }

      customerId = customerResult.data.id;
    }

    const projectResult = await supabase
      .from("projects")
      .insert({
        customer_id: customerId,
        artist_id: selectedRequest.artist_id,
        subject: selectedRequest.subject,
        status: "consultation",
        memo: requestDetailMemo(selectedRequest),
      })
      .select("id")
      .single();

    if (projectResult.error) {
      setError(projectResult.error.message);
      setSaving(false);
      return;
    }

    const requestPatch = {
      customer_id: customerId,
      status: "consultation",
      consultation_at: selectedRequest.consultation_at ?? new Date().toISOString(),
    };

    await supabase.from("requests").update(requestPatch).eq("id", selectedRequest.id);

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id ? { ...request, ...requestPatch } : request,
      ),
    );
    setMessage("Request converted to customer/project.");
    setSaving(false);
  }

  return (
    <AppShell
      active="Requests"
      eyebrow="Request intake"
      title="Website and email requests"
      description="Manage Webflow/Gmail requests, artist candidates, and conversion into customer/project records."
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
            onClick={() => {
              setNewRequestError("");
              setShowNewRequest(true);
            }}
            type="button"
          >
            New request
          </button>
        </>
      }
    >
      {loading ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#697178] shadow-sm">
          Loading requests...
        </div>
      ) : null}

      {!loading && error && requests.length === 0 ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 text-sm font-semibold text-[#8a3030] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && requests.length === 0 && !error ? (
        <div className="rounded-md border border-[#d9d3c7] bg-white px-4 py-8 shadow-sm">
          <p className="text-sm font-semibold text-[#30373d]">No requests yet.</p>
          <p className="mt-2 text-sm text-[#697178]">
            Create a manual request for testing, or connect Make.com to insert Webflow requests.
          </p>
          <button
            className="mt-4 h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
            onClick={() => setShowNewRequest(true)}
            type="button"
          >
            New request
          </button>
        </div>
      ) : null}

      {!loading && requests.length > 0 ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statusSummary.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-[#d9d3c7] bg-white px-4 py-4 shadow-sm"
              >
                <p className="text-sm font-medium text-[#697178]">{item.label}</p>
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
                    Webflow/Make.com requests should land here from Supabase.
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setStatusFilter(event.target.value)}
                    value={statusFilter}
                  >
                    <option value="all">All statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => setArtistFilter(event.target.value)}
                    value={artistFilter}
                  >
                    <option value="all">All artists</option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.display_name}
                      </option>
                    ))}
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
                    {filteredRequests.map((request) => {
                      const artist = relatedOne(request.artist);

                      return (
                        <tr
                          key={request.id}
                          className={`cursor-pointer ${
                            request.id === selectedRequest?.id ? "bg-[#fffaf1]" : ""
                          }`}
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            setError("");
                            setMessage("");
                          }}
                        >
                          <td className="px-4 py-4">
                            <p className="text-xs font-semibold text-[#8a6f4d]">
                              {request.id.slice(0, 8)}
                            </p>
                            <p className="mt-1 font-semibold">{request.client_name}</p>
                            <p className="mt-1 text-[#4d555c]">{request.subject}</p>
                          </td>
                          <td className="px-4 py-4 text-[#4d555c]">
                            <p>{request.email || "-"}</p>
                            <p className="mt-1">{request.phone || "-"}</p>
                          </td>
                          <td className="px-4 py-4 font-semibold">
                            {artist?.display_name ?? "Any available"}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                                request.status,
                              )}`}
                            >
                              {statusLabel(request.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[#4d555c]">
                            {displayDateTime(request.artist_reply_at ?? request.forwarded_at ?? request.received_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRequest ? (
              <aside className="rounded-md border border-[#d9d3c7] bg-white shadow-sm">
                <div className="border-b border-[#e5dfd4] px-4 py-4">
                  <p className="text-xs font-semibold text-[#8a6f4d]">
                    {selectedRequest.id.slice(0, 8)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{selectedRequest.client_name}</h3>
                  <p className="mt-1 text-sm text-[#697178]">{selectedRequest.subject}</p>
                </div>

                <div className="space-y-5 px-4 py-4">
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

                  <div>
                    <h4 className="text-sm font-semibold">Assignment</h4>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Selected artist</p>
                        <p className="mt-1 font-semibold">
                          {relatedOne(selectedRequest.artist)?.display_name ?? "Any available"}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Priority</p>
                        <p className="mt-1 font-semibold">{priorityLabel(selectedRequest.priority)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Tattoo details</h4>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3 sm:col-span-2">
                        <p className="text-[#697178]">Description</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.tattoo_description || selectedRequest.subject}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Size</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.approximate_size || "-"}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Placement</p>
                        <p className="mt-1 font-semibold">{selectedRequest.placement || "-"}</p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Requested artist</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.requested_artist_label || "Any available"}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Age confirmed</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.age_confirmed ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                    {selectedFiles.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file) => (
                          <a
                            key={file.id}
                            className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[#cfc7b8] px-3 py-2 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                            href={file.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span className="min-w-0 truncate">
                              {file.original_name || "Reference image"}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-[#697178]">
                              {file.size_bytes ? `${Math.round(file.size_bytes / 1024)} KB` : ""}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {selectedFiles.length === 0 && selectedRequest.reference_image_url ? (
                      <a
                        className="mt-3 inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                        href={selectedRequest.reference_image_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open legacy reference link
                      </a>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Candidate artists</h4>
                    <div className="mt-3 flex gap-2">
                      <select
                        className="h-10 min-w-0 flex-1 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                        onChange={(event) => setArtistToAdd(event.target.value)}
                        value={artistToAdd}
                      >
                        {availableArtistsToAdd.map((artist) => (
                          <option key={artist.id} value={artist.id}>
                            {artist.display_name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="h-10 rounded-md bg-[#9f5c3c] px-3 text-sm font-semibold text-white hover:bg-[#884a2f] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={saving || !artistToAdd}
                        onClick={addCandidate}
                        type="button"
                      >
                        Send
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {selectedCandidates.length === 0 ? (
                        <p className="rounded-md bg-[#f7f2e9] px-3 py-3 text-sm text-[#697178]">
                          No candidate artists yet.
                        </p>
                      ) : null}
                      {selectedCandidates.map((candidate) => {
                        const artist = relatedOne(candidate.artist);

                        return (
                          <div
                            key={candidate.id}
                            className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  {artist?.display_name ?? "Artist"}
                                </p>
                                <p className="mt-1 text-xs text-[#697178]">
                                  {candidate.responded_at
                                    ? displayDateTime(candidate.responded_at)
                                    : "Waiting for response"}
                                </p>
                              </div>
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                                  candidate.status,
                                )}`}
                              >
                                {statusLabel(candidate.status)}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button
                                className="h-9 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                                disabled={saving}
                                onClick={() => updateCandidate(candidate, "interested")}
                                type="button"
                              >
                                Interested
                              </button>
                              <button
                                className="h-9 rounded-md border border-[#cfc7b8] px-2 text-xs font-semibold hover:bg-[#eee8dd]"
                                disabled={saving}
                                onClick={() => updateCandidate(candidate, "passed")}
                                type="button"
                              >
                                Pass
                              </button>
                              <button
                                className="h-9 rounded-md bg-[#1f2428] px-2 text-xs font-semibold text-white hover:bg-[#30373d]"
                                disabled={saving}
                                onClick={() => updateCandidate(candidate, "selected")}
                                type="button"
                              >
                                Select
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Timeline</h4>
                    <ol className="mt-3 space-y-3">
                      {timelineFor(selectedRequest).map((item) => (
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
                      {selectedRequest.notes || "No notes yet."}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                      disabled={saving}
                      onChange={(event) => updateRequestStatus(event.target.value)}
                      value={selectedRequest.status}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={saving}
                      onClick={convertToProject}
                      type="button"
                    >
                      Convert to project
                    </button>
                  </div>
                </div>
              </aside>
            ) : null}
          </section>
        </>
      ) : null}

      {showNewRequest ? (
        <NewRequestModal
          artists={artists}
          error={newRequestError}
          onClose={() => setShowNewRequest(false)}
          onSave={createRequest}
          saving={saving}
        />
      ) : null}
    </AppShell>
  );
}

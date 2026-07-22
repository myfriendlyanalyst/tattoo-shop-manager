"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage } from "@/components/app-shell";
import {
  scheduleAppointmentReminder,
  sendAppointmentConfirmation,
} from "@/lib/appointment-email";
import { getSafeSession, getSafeUser } from "@/lib/auth-session";
import { getOperationsContext, type OperationsContext } from "@/lib/operations-access";
import { supabase } from "@/lib/supabase";

type StaffRecord = {
  id: string;
  display_name: string;
  role: string;
};

type ArtistFilterOption = {
  value: string;
  label: string;
};

type StaffPermission = {
  staff_id: string;
  permission_key: string;
  enabled: boolean;
};

type RequestRecord = {
  id: string;
  request_number: number | null;
  customer_id: string | null;
  project_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  tattoo_description: string | null;
  approximate_size: string | null;
  placement: string | null;
  reference_image_url: string | null;
  requested_artist_label: string | null;
  tattoo_timing_preference: string | null;
  preferred_appointment_date: string | null;
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

type RequestMessage = {
  id: string;
  request_id: string;
  provider: string;
  provider_thread_id: string | null;
  provider_message_id: string | null;
  direction: "inbound" | "outbound";
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  received_at: string;
};

type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type NewRequestForm = {
  customerId: string;
  clientName: string;
  email: string;
  phone: string;
  tattooDescription: string;
  approximateSize: string;
  placement: string;
  referenceFile: File | null;
  requestedArtistLabel: string;
  artistId: string;
  tattooTimingPreference: string;
  notes: string;
};

type BookingForm = {
  projectSubject: string;
  projectType: string;
  depositAmount: string;
  depositPaymentMethod: string;
  depositMemo: string;
};

type BookRequestResponse = {
  customer?: CustomerRecord | null;
  request?: {
    customer_id: string;
    project_id: string;
    status: string;
    booked_at: string;
  };
  projectId?: string;
  appointmentId?: string | null;
  error?: string;
  debug?: unknown;
};

type SchedulePrompt = {
  projectId: string;
  artistId: string;
};

type QueueFilter =
  | "active"
  | "needs_action"
  | "needs_assignment"
  | "waiting_artist"
  | "waiting_client"
  | "reassignment"
  | "closed";

const statusOptions = [
  "new",
  "forwarded",
  "artist_replied",
  "client_replied",
  "booked",
  "client_waiting_for_reply",
  "client_declined",
  "no_answer",
  "denied",
  "spam",
];

const referenceBucket = "request-references";
const requestSelect =
  "id, request_number, customer_id, project_id, client_name, email, phone, subject, tattoo_description, approximate_size, placement, reference_image_url, requested_artist_label, tattoo_timing_preference, preferred_appointment_date, age_confirmed, artist_id, status, priority, received_at, forwarded_at, artist_reply_at, client_reply_at, consultation_at, booked_at, notes, artist:staff(display_name)";
const requestMessageSelect =
  "id, request_id, provider, provider_thread_id, provider_message_id, direction, from_email, from_name, to_emails, cc_emails, subject, body_text, snippet, received_at";

const projectTypes = ["Walk-in", "One Done", "Multiple Session"];
const tattooTimingOptions = [
  { value: "", label: "Not specified" },
  { value: "asap", label: "ASAP" },
  { value: "within_1_2_weeks", label: "Within 1-2 weeks" },
  { value: "flexible", label: "Flexible" },
];
const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "app", label: "App" },
  { value: "other", label: "Other" },
];

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^\+?[0-9\s().-]{7,20}$/.test(value);
}

function isValidPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isAnyAvailableLabel(value: string | null | undefined) {
  return (value?.trim().toLowerCase() ?? "") === "any available";
}

function effectiveArtistId(request: RequestRecord, artists: StaffRecord[]) {
  if (request.artist_id) {
    return request.artist_id;
  }

  if (isAnyAvailableLabel(request.requested_artist_label)) {
    return "";
  }

  return (
    artists.find(
      (artist) =>
        artist.display_name.trim().toLowerCase() ===
        (request.requested_artist_label?.trim().toLowerCase() ?? ""),
    )?.id ?? ""
  );
}

function artistMatchesFilter(request: RequestRecord, artistFilter: string) {
  if (artistFilter === "all") return true;
  if (artistFilter === "unassigned") return !request.artist_id;
  if (artistFilter.startsWith("label:")) {
    return (
      !request.artist_id &&
      (request.requested_artist_label?.trim().toLowerCase() ?? "") ===
        artistFilter.slice("label:".length).toLowerCase()
    );
  }

  return request.artist_id === artistFilter;
}

function requestNameFromParts(clientName: string, placement: string) {
  const cleanClient = clientName.trim();
  const cleanPlacement = placement.trim();
  const projectType = cleanPlacement ? `${cleanPlacement} tattoo` : "Tattoo project";

  return cleanClient ? `${cleanClient} - ${projectType}` : projectType;
}

function requestCode(request: Pick<RequestRecord, "request_number" | "id">) {
  return request.request_number ? `REQ-${String(request.request_number).padStart(5, "0")}` : `REQ-${request.id.slice(0, 5)}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    forwarded: "Forwarded",
    artist_replied: "Artist Replied",
    client_replied: "Client Replied",
    consultation: "Booked",
    booked: "Booked",
    client_waiting_for_reply: "Artist Replied",
    client_declined: "Closed by client",
    no_answer: "No answer from client",
    denied: "Declined by shop",
    spam: "Spam",
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
    new: "bg-[#fff4d8] text-[#7a5a00]",
    forwarded: "bg-[#e5edf4] text-[#245c86]",
    artist_replied: "bg-[#e7f7ec] text-[#24703d]",
    client_replied: "bg-[#def7ee] text-[#17634a]",
    consultation: "bg-[#dff4df] text-[#2f6b2f]",
    booked: "bg-[#dff4df] text-[#2f6b2f]",
    client_waiting_for_reply: "bg-[#e3f6df] text-[#2f6b2f]",
    client_declined: "bg-[#f3e1e1] text-[#8a3030]",
    no_answer: "bg-[#f9dddd] text-[#9a1f1f]",
    denied: "bg-[#f3e1e1] text-[#8a3030]",
    spam: "bg-[#f3e1e1] text-[#8a3030]",
    sent: "bg-[#e5edf4] text-[#315f82]",
    interested: "bg-[#e8f0ee] text-[#2f6658]",
    passed: "bg-[#f4e7df] text-[#8a5130]",
    selected: "bg-[#e4f1df] text-[#476b33]",
    declined: "bg-[#f3e1e1] text-[#8a3030]",
  };

  return variants[status] ?? "bg-[#eee8dd] text-[#4d555c]";
}

function hasArtistReplied(request: RequestRecord) {
  if (!request.artist_reply_at) return false;
  if (!request.forwarded_at) return true;

  return new Date(request.artist_reply_at).getTime() >= new Date(request.forwarded_at).getTime();
}

function hasCurrentArtistReplied(request: RequestRecord, messages: RequestMessage[]) {
  return hasArtistReplied(request) && !hasClientReassignmentRequest(request, messages);
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

function displayEmailList(value: string[] | null) {
  return value && value.length > 0 ? value.join(", ") : "-";
}

function displayEmailSender(message: RequestMessage) {
  const name = message.from_name?.trim();
  const email = message.from_email?.trim();

  if (name && email) return `${name} <${email}>`;
  return name || email || "-";
}

function emailLogEventLabel(message: RequestMessage, request?: RequestRecord | null) {
  if (message.provider === "webflow") return "Request received";

  if (message.provider === "resend" && message.direction === "outbound") {
    const clientEmail = normalizeEmail(request?.email);
    const toClient = Boolean(
      clientEmail && message.to_emails?.some((email) => normalizeEmail(email) === clientEmail),
    );

    return toClient ? "Artist replied" : "Artist assigned";
  }

  if (message.provider === "artist_action") return "Artist action";
  if (message.provider === "client_action") return "Client action";
  return message.direction === "inbound" ? "Inbound email" : "Outbound email";
}

function emailLogBody(message: RequestMessage) {
  return message.body_text || message.snippet || "No preview text.";
}

function isActionEmail(message: RequestMessage, request: RequestRecord) {
  if (message.provider === "artist_action" || message.provider === "client_action") {
    return true;
  }

  if (message.provider !== "resend" || message.direction !== "outbound") {
    return false;
  }

  const clientEmail = normalizeEmail(request.email);
  const sentToClient = Boolean(
    clientEmail && message.to_emails?.some((email) => normalizeEmail(email) === clientEmail),
  );

  if (!sentToClient) {
    return true;
  }

  return Boolean(
    request.artist_reply_at &&
      new Date(message.received_at).getTime() >= new Date(request.artist_reply_at).getTime() - 60_000,
  );
}

function tattooTimingLabel(value: string | null) {
  return tattooTimingOptions.find((option) => option.value === (value ?? ""))?.label ?? value ?? "-";
}

function hasClientReassignmentRequest(request: RequestRecord, messages: RequestMessage[]) {
  return (
    request.status === "new" &&
    !request.artist_id &&
    messages.some(
      (message) =>
        message.provider === "client_action" &&
        (message.subject?.toLowerCase().includes("request another artist") ||
          message.body_text?.toLowerCase().includes("different artist") ||
          message.snippet?.toLowerCase().includes("different artist")),
    )
  );
}

function isNeedsAssignment(request: RequestRecord) {
  return request.status === "new" && !request.artist_id;
}

function isWaitingForArtist(request: RequestRecord) {
  return request.status === "forwarded";
}

function isWaitingForClient(request: RequestRecord) {
  return request.status === "client_waiting_for_reply";
}

function isClosedRequest(request: RequestRecord) {
  return ["booked", "client_declined", "denied", "spam"].includes(request.status);
}

function matchesQueueFilter(
  request: RequestRecord,
  messages: RequestMessage[],
  filter: QueueFilter,
) {
  const reassignment = hasClientReassignmentRequest(request, messages);

  if (filter === "active") return request.status !== "spam";
  if (filter === "needs_assignment") return isNeedsAssignment(request);
  if (filter === "waiting_artist") return isWaitingForArtist(request);
  if (filter === "waiting_client") return isWaitingForClient(request);
  if (filter === "reassignment") return reassignment;
  if (filter === "closed") return isClosedRequest(request);

  return (
    reassignment ||
    isNeedsAssignment(request) ||
    isWaitingForArtist(request) ||
    request.status === "client_replied"
  );
}

function canShowInCalendar(staff: StaffRecord, permissionRows: StaffPermission[]) {
  if (staff.role === "Owner") {
    return true;
  }

  const bookingPermission = permissionRows.find(
    (permission) =>
      permission.staff_id === staff.id && permission.permission_key === "calendarBooking",
  );

  if (bookingPermission) {
    return bookingPermission.enabled;
  }

  return staff.role === "Artist";
}

function hasStaffPermission(
  staffId: string | null | undefined,
  permissionRows: StaffPermission[],
  permissionKey: string,
) {
  return Boolean(
    staffId &&
      permissionRows.some(
        (permission) =>
          permission.staff_id === staffId &&
          permission.permission_key === permissionKey &&
          permission.enabled,
      ),
  );
}

function timelineFor(request: RequestRecord) {
  return [
    {
      label: "Request received",
      value: displayDateTime(request.received_at),
      done: true,
      tone: "received",
    },
    {
      label: "Forwarded to artist",
      value: displayDateTime(request.forwarded_at),
      done: Boolean(request.forwarded_at),
      tone: "forwarded",
    },
    {
      label: "Artist replied",
      value: displayDateTime(request.artist_reply_at),
      done: hasArtistReplied(request),
      tone: "clientSent",
    },
    {
      label: "Project booked",
      value: displayDateTime(request.booked_at),
      done: Boolean(request.booked_at),
      tone: "booked",
    },
  ];
}

function timelineDotClasses(item: ReturnType<typeof timelineFor>[number], request: RequestRecord) {
  if (!item.done) {
    if (item.tone === "clientSent" && request.status === "no_answer") {
      return "bg-[#9a1f1f] text-white";
    }

    return "border border-[#bdb3a3] bg-white text-[#8a8174]";
  }

  const tones: Record<string, string> = {
    booked: "bg-[#2f6b2f] text-white",
    clientSent: "bg-[#2f6b2f] text-white",
    forwarded: "bg-[#245c86] text-white",
    received: "bg-[#7a5a00] text-white",
  };

  return tones[item.tone] ?? "bg-[#2f6658] text-white";
}

function timelineMarker(item: ReturnType<typeof timelineFor>[number], request: RequestRecord) {
  if (!item.done) {
    return item.tone === "clientSent" && request.status === "no_answer" ? "!" : "";
  }

  const markers: Record<string, string> = {
    booked: "B",
    clientSent: "S",
    forwarded: "A",
    received: "R",
  };

  return markers[item.tone] ?? "Y";
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
  customers,
  error,
  saving,
  onClose,
  onSave,
}: {
  artists: StaffRecord[];
  customers: CustomerRecord[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (form: NewRequestForm) => void;
}) {
  const [form, setForm] = useState<NewRequestForm>({
    customerId: "",
    clientName: "",
    email: "",
    phone: "",
    tattooDescription: "",
    approximateSize: "",
    placement: "",
    referenceFile: null,
    requestedArtistLabel: "Any available",
    artistId: "",
    tattooTimingPreference: "",
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

          <label className="block text-sm font-semibold">
            Existing customer
            <select
              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value);

                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                  clientName: customer?.name ?? "",
                  email: customer?.email ?? "",
                  phone: customer?.phone ?? "",
                }));
              }}
              value={form.customerId}
            >
              <option value="">New customer from this request</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.email ? ` / ${customer.email}` : ""}
                </option>
              ))}
            </select>
          </label>

          <input
            className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                customerId: "",
                clientName: event.target.value,
              }))
            }
            placeholder="Client name"
            value={form.clientName}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerId: "",
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              type="email"
              value={form.email}
            />
            <input
              className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerId: "",
                  phone: event.target.value,
                }))
              }
              placeholder="Phone"
              value={form.phone}
            />
          </div>
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
              placeholder="Approximate size (inch)"
              step="0.1"
              type="number"
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
                  requestedArtistLabel: selectedArtist?.display_name ?? "Any available",
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Tattoo timing
              <select
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tattooTimingPreference: event.target.value,
                  }))
                }
                value={form.tattooTimingPreference}
              >
                {tattooTimingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
  const router = useRouter();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [requestFiles, setRequestFiles] = useState<RequestFile[]>([]);
  const [requestMessages, setRequestMessages] = useState<RequestMessage[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artistFilter, setArtistFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequestError, setNewRequestError] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm | null>(null);
  const [schedulePrompt, setSchedulePrompt] = useState<SchedulePrompt | null>(null);
  const [assignmentArtistId, setAssignmentArtistId] = useState("");
  const [canAssignRequests, setCanAssignRequests] = useState(false);
  const [operationsContext, setOperationsContext] = useState<OperationsContext | null>(null);
  const isArtistUser = operationsContext?.isArtist === true;

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? requests[0],
    [requests, selectedRequestId],
  );

  const messagesByRequestId = useMemo(() => {
    const map = new Map<string, RequestMessage[]>();
    for (const email of requestMessages) {
      const current = map.get(email.request_id) ?? [];
      current.push(email);
      map.set(email.request_id, current);
    }
    return map;
  }, [requestMessages]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const requestMessageList = messagesByRequestId.get(request.id) ?? [];
      const statusMatches =
        statusFilter === "all"
          ? queueFilter === "closed" || request.status !== "spam"
          : request.status === statusFilter;
      const artistMatches = artistMatchesFilter(request, artistFilter);
      const queueMatches = matchesQueueFilter(request, requestMessageList, queueFilter);

      return statusMatches && artistMatches && queueMatches;
    });
  }, [artistFilter, messagesByRequestId, queueFilter, requests, statusFilter]);

  const artistFilterOptions = useMemo<ArtistFilterOption[]>(() => {
    const registeredArtistNames = new Set(
      artists.map((artist) => artist.display_name.trim().toLowerCase()),
    );
    const requestedLabels = new Map<string, string>();
    let hasUnassignedRequests = false;

    for (const request of requests) {
      if (!request.artist_id) {
        hasUnassignedRequests = true;
      }

      const label = request.requested_artist_label?.trim();
      if (
        label &&
        !isAnyAvailableLabel(label) &&
        !registeredArtistNames.has(label.toLowerCase())
      ) {
        requestedLabels.set(label.toLowerCase(), label);
      }
    }

    return [
      ...artists.map((artist) => ({ label: artist.display_name, value: artist.id })),
      ...Array.from(requestedLabels.values()).map((label) => ({
        label: `${label} (requested)`,
        value: `label:${label}`,
      })),
      ...(hasUnassignedRequests ? [{ label: "Unassigned / any available", value: "unassigned" }] : []),
    ];
  }, [artists, requests]);

  const queueSummary = useMemo(() => {
    const summary = {
      waitingArtist: 0,
      waitingClient: 0,
    };

    for (const request of requests) {
      if (isWaitingForArtist(request)) summary.waitingArtist += 1;
      if (isWaitingForClient(request)) summary.waitingClient += 1;
    }

    return summary;
  }, [requests]);

  const selectedFiles = useMemo(() => {
    if (!selectedRequest) {
      return [];
    }

    return requestFiles.filter((file) => file.request_id === selectedRequest.id);
  }, [requestFiles, selectedRequest]);

  const selectedMessages = useMemo(() => {
    if (!selectedRequest) {
      return [];
    }

    return messagesByRequestId.get(selectedRequest.id) ?? [];
  }, [messagesByRequestId, selectedRequest]);

  const selectedActionMessages = useMemo(() => {
    if (!selectedRequest) {
      return [];
    }

    return selectedMessages.filter((message) => isActionEmail(message, selectedRequest));
  }, [selectedMessages, selectedRequest]);

  const needsArtistAssignment = useMemo(() => {
    if (!selectedRequest) {
      return false;
    }

    return canAssignRequests && !selectedRequest.artist_id && selectedRequest.status !== "spam";
  }, [canAssignRequests, selectedRequest]);

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setError("");

      const user = await getSafeUser();
      const context = await getOperationsContext();

      if (!user) {
        setError("Please log in to view requests.");
        setLoading(false);
        return;
      }

      const [requestResult, staffResult, permissionResult, customerResult, fileResult, messageResult] = await Promise.all([
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
          .in("permission_key", ["calendarBooking", "requestAssignment"]),
        supabase
          .from("customers")
          .select("id, name, email, phone")
          .order("name", { ascending: true }),
        supabase
          .from("files")
          .select("id, request_id, file_type, storage_path, original_name, mime_type, size_bytes")
          .eq("file_type", "reference")
          .not("request_id", "is", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("request_messages")
          .select(requestMessageSelect)
          .order("received_at", { ascending: false }),
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

      if (customerResult.error) {
        setError(customerResult.error.message);
        setLoading(false);
        return;
      }

      if (fileResult.error) {
        setError(fileResult.error.message);
        setLoading(false);
        return;
      }

      const rawRequests = (requestResult.data ?? []) as unknown as RequestRecord[];
      const nextPermissions = permissionResult.data ?? [];
      const canAssignRequests =
        !context?.isArtist &&
        (context?.role === "owner" ||
          hasStaffPermission(context?.staffId, nextPermissions, "requestAssignment"));
      const rawArtists = (staffResult.data ?? []).filter((staff) =>
        canShowInCalendar(staff, nextPermissions),
      );
      const nextRequests =
        context?.isArtist && context.staffId
          ? rawRequests.filter((request) => request.artist_id === context.staffId)
          : rawRequests;
      const nextArtists =
        context?.isArtist && context.staffId
          ? rawArtists.filter((artist) => artist.id === context.staffId)
          : rawArtists;
      const nextFiles = await filesWithSignedUrls((fileResult.data ?? []) as RequestFile[]);

      setOperationsContext(context);
      setCanAssignRequests(canAssignRequests);
      setRequests(nextRequests);
      setArtists(nextArtists);
      setCustomers((customerResult.data ?? []) as CustomerRecord[]);
      setRequestFiles(nextFiles);
      setRequestMessages(messageResult.error ? [] : ((messageResult.data ?? []) as RequestMessage[]));
      setSelectedRequestId(nextRequests[0]?.id ?? "");
      if (messageResult.error) {
        setError(
          `${messageResult.error.message}. Run docs/request_email_tracking_migration.sql in Supabase SQL Editor.`,
        );
      }
      if (context?.isArtist && context.staffId) {
        setArtistFilter(context.staffId);
      }
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
    const tattooDescription = form.tattooDescription.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const approximateSize = form.approximateSize.trim();
    const placement = form.placement.trim();
    const tattooTimingPreference = form.tattooTimingPreference || null;
    const requestName = requestNameFromParts(clientName, placement);

    if (
      !clientName ||
      !email ||
      !phone ||
      !tattooDescription ||
      !approximateSize ||
      !placement ||
      !form.requestedArtistLabel
    ) {
      setNewRequestError(
        "Name, email, phone, tattoo description, size, placement, and artist are required.",
      );
      return;
    }

    if (!isValidEmail(email)) {
      setNewRequestError("Enter a valid email address.");
      return;
    }

    if (!isValidPhone(phone)) {
      setNewRequestError("Enter a valid phone number.");
      return;
    }

    if (!isValidPositiveNumber(approximateSize)) {
      setNewRequestError("Approximate size must be a number greater than 0.");
      return;
    }

    setSaving(true);
    setNewRequestError("");

    const existingCustomer = customers.find(
      (customer) =>
        customer.id === form.customerId || normalizeEmail(customer.email) === normalizeEmail(email),
    );

    const result = await supabase
      .from("requests")
      .insert({
        customer_id: existingCustomer?.id ?? null,
        client_name: clientName,
        email,
        phone,
        subject: requestName,
        tattoo_description: tattooDescription,
        approximate_size: approximateSize,
        placement,
        reference_image_url: null,
        requested_artist_label: form.requestedArtistLabel,
        tattoo_timing_preference: tattooTimingPreference,
        preferred_appointment_date: null,
        age_confirmed: false,
        artist_id: form.artistId || null,
        priority: "normal",
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
    setMobileDetailOpen(true);
    setShowNewRequest(false);
    setMessage("Request created.");
    setSaving(false);
  }

  async function assignRequestArtist() {
    if (!selectedRequest) {
      return;
    }

    if (selectedRequest.status === "spam") {
      setError("Restore this request before assigning it to an artist.");
      return;
    }

    const nextArtistId = assignmentArtistId || effectiveArtistId(selectedRequest, artists);
    if (!nextArtistId) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const session = await getSafeSession();
    if (!session) {
      setError("Please log in to forward this request.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/requests/${selectedRequest.id}/artist-assignment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ artistId: nextArtistId }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      sent?: boolean;
      toEmail?: string;
      subject?: string;
      warning?: string;
      request?: {
        artist_id?: string | null;
        status?: string;
        forwarded_at?: string | null;
        artist_reply_at?: string | null;
        client_reply_at?: string | null;
      };
    };

    if (!response.ok) {
      setError(payload.error || "Artist forwarding failed.");
      setSaving(false);
      return;
    }

    const requestPatch = {
      artist_id: payload.request?.artist_id ?? nextArtistId,
      status: payload.request?.status ?? selectedRequest.status,
      forwarded_at: payload.request?.forwarded_at ?? selectedRequest.forwarded_at,
      artist_reply_at: payload.request?.artist_reply_at ?? null,
      client_reply_at: payload.request?.client_reply_at ?? null,
    };

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id
          ? {
              ...request,
              ...requestPatch,
              artist: artists.find((item) => item.id === nextArtistId)
                ? {
                    display_name: artists.find((item) => item.id === nextArtistId)!
                      .display_name,
                  }
                : request.artist,
            }
          : request,
      ),
    );
    setMessage(
      payload.sent
        ? `Artist assigned and email sent to ${payload.toEmail}.`
        : payload.warning || "Artist assigned, but email was not sent.",
    );
    setSaving(false);
  }

  function openBookingSetup() {
    if (!selectedRequest) {
      return;
    }

    if (selectedRequest.status === "spam") {
      setError("Restore this request before creating a project.");
      return;
    }

    if (!effectiveArtistId(selectedRequest, artists)) {
      setError("Select an artist before booking this project.");
      return;
    }

    if (selectedRequest.project_id) {
      setError("This request has already been booked as a project.");
      return;
    }

    setError("");
    setMessage("");
    router.push(`/projects/new?requestId=${selectedRequest.id}`);
  }

  function closeRequestDetail() {
    setMobileDetailOpen(false);
    setBookingMode(false);
    setBookingForm(null);
    setSchedulePrompt(null);
    setError("");
    setMessage("");
  }

  async function bookProject() {
    if (!selectedRequest) {
      return;
    }

    if (selectedRequest.status === "spam") {
      setError("Restore this request before creating a project.");
      return;
    }

    if (!bookingForm) {
      setError("Booking details are required.");
      return;
    }

    const bookingArtistId = effectiveArtistId(selectedRequest, artists);

    if (!bookingArtistId) {
      setError("Select an artist before booking this project.");
      return;
    }

    if (selectedRequest.project_id) {
      setError("This request has already been booked as a project.");
      return;
    }

    const depositAmount = Number(bookingForm.depositAmount || 0);

    if (!bookingForm.projectSubject.trim()) {
      setError("Project name is required.");
      return;
    }

    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setError("Deposit amount must be a valid number.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const session = await getSafeSession();
    const token = session?.access_token;

    if (!token) {
      setError("Missing login session.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/requests/${selectedRequest.id}/book`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        artistId: bookingArtistId,
        projectSubject: bookingForm.projectSubject.trim(),
        projectType: bookingForm.projectType,
        depositAmount,
        depositPaymentMethod: bookingForm.depositPaymentMethod,
        depositMemo: bookingForm.depositMemo,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as BookRequestResponse;

    if (!response.ok || !payload.request || !payload.projectId) {
      const debugMessage = payload.debug ? ` ${JSON.stringify(payload.debug)}` : "";
      setError(`${payload.error ?? "Project creation failed."}${debugMessage}`);
      setSaving(false);
      return;
    }

    const emailResult = payload.appointmentId
      ? await sendAppointmentConfirmation(payload.appointmentId)
      : null;
    const reminderResult = payload.appointmentId
      ? await scheduleAppointmentReminder(payload.appointmentId)
      : null;

    if (payload.customer) {
      setCustomers((current) =>
        current.some((customer) => customer.id === payload.customer?.id)
          ? current
          : [...current, payload.customer as CustomerRecord],
      );
    }

    const requestPatch = payload.request;

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id ? { ...request, ...requestPatch } : request,
      ),
    );
    setBookingMode(false);
    setBookingForm(null);
    const reminderMessage =
      reminderResult?.status === "failed"
        ? ` Reminder email was not scheduled: ${reminderResult.error || reminderResult.reason}.`
        : "";
    setMessage(
      emailResult
        ? emailResult.sent
          ? `Project created. Confirmation email sent.${reminderMessage}`
          : `Project created. Confirmation email was not sent yet${
            emailResult.error || emailResult.reason
              ? `: ${emailResult.error || emailResult.reason}`
              : "."
          }${reminderMessage}`
        : "Project created. Schedule the first appointment now or do it later.",
    );
    setSchedulePrompt({ projectId: payload.projectId, artistId: bookingArtistId });
    setSaving(false);
  }

  return (
    <AppPage
      eyebrow="Request intake"
      title="Website and email requests"
      actions={
        isArtistUser ? null : (
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
        )
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
            {isArtistUser
              ? "No assigned requests yet."
              : "Create a manual request for testing, or connect Make.com to insert Webflow requests."}
          </p>
          {!isArtistUser ? (
            <button
              className="mt-4 h-10 rounded-md bg-[#9f5c3c] px-4 text-sm font-semibold text-white hover:bg-[#884a2f]"
              onClick={() => setShowNewRequest(true)}
              type="button"
            >
              New request
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && requests.length > 0 ? (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                count: queueSummary.waitingArtist,
                filter: "waiting_artist" as QueueFilter,
                label: "Waiting artist",
                tone: "border-[#c9d8e4] bg-[#f4f8fb]",
              },
              {
                count: queueSummary.waitingClient,
                filter: "waiting_client" as QueueFilter,
                label: "Waiting client",
                tone: "border-[#ead2c3] bg-[#fdf7f2]",
              },
            ].map((card) => (
              <button
                className={`rounded-md border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${card.tone} ${
                  queueFilter === card.filter ? "ring-2 ring-[#1f2428]" : ""
                }`}
                key={card.filter}
                onClick={() => {
                  setQueueFilter(card.filter);
                  setStatusFilter("all");
                  setMobileDetailOpen(false);
                }}
                type="button"
              >
                <span className="block text-2xl font-black">{card.count}</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-[#697178]">
                  {card.label}
                </span>
              </button>
            ))}
          </section>

          <section>
            <div
              className="rounded-md border border-[#d9d3c7] bg-white shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-[#e5dfd4] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold">Request queue</h3>
                  <p className="mt-1 text-sm text-[#697178]">
                    Webflow/Make.com requests should land here from Supabase.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex flex-wrap gap-1">
                    {[
                      ["active", "Active"],
                      ["needs_action", "Needs action"],
                      ["needs_assignment", "New"],
                      ["waiting_artist", "Waiting artist"],
                      ["waiting_client", "Waiting client"],
                      ["reassignment", "Reassignment"],
                      ["closed", "Closed"],
                    ].map(([value, label]) => (
                      <button
                        className={`h-10 rounded-md border px-3 text-sm font-semibold transition ${
                          queueFilter === value
                            ? "border-[#1f2428] bg-[#1f2428] text-white"
                            : "border-[#cfc7b8] bg-white text-[#30373d] hover:bg-[#f7f2e9]"
                        }`}
                        key={value}
                        onClick={() => {
                          setQueueFilter(value as QueueFilter);
                          setStatusFilter("all");
                          setMobileDetailOpen(false);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setQueueFilter("active");
                      setMobileDetailOpen(false);
                    }}
                    value={statusFilter}
                  >
                    <option value="all">Active statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  {!isArtistUser ? (
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => {
                      setArtistFilter(event.target.value);
                      setMobileDetailOpen(false);
                    }}
                    value={artistFilter}
                  >
                    <option value="all">All artists</option>
                    {artistFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  ) : null}
                </div>
              </div>

              <div className="divide-y divide-[#eee8dd] md:hidden">
                {filteredRequests.map((request) => {
                  const artist = relatedOne(request.artist);
                  const isReassignment = hasClientReassignmentRequest(
                    request,
                    messagesByRequestId.get(request.id) ?? [],
                  );
                  const currentArtistReplied = hasCurrentArtistReplied(
                    request,
                    messagesByRequestId.get(request.id) ?? [],
                  );

                  return (
                    <button
                      className={`block w-full px-4 py-4 text-left ${
                        request.id === selectedRequest?.id ? "bg-[#fffaf1]" : ""
                      }`}
                      key={request.id}
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setMobileDetailOpen(true);
                        setAssignmentArtistId(request.artist_id ?? "");
                        setBookingMode(false);
                        setBookingForm(null);
                        setError("");
                        setMessage("");
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-semibold">{request.subject}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {currentArtistReplied ? (
                              <span className="inline-flex rounded bg-[#e3f6df] px-2 py-1 text-xs font-bold text-[#2f6b2f]">
                                Artist replied
                              </span>
                            ) : null}
                            {isReassignment ? (
                              <span className="inline-flex rounded bg-[#f1eadc] px-2 py-1 text-xs font-bold text-[#775f36]">
                                Client requested another artist
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
                            request.status,
                          )}`}
                        >
                          {statusLabel(request.status)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[#697178]">
                        <p>{request.email || "-"}</p>
                        <p>{request.phone || "-"}</p>
                        <p className="font-semibold text-[#4d555c]">
                          {artist?.display_name ?? "Any available"}
                        </p>
                        <p>
                          Last touch:{" "}
                          {displayDateTime(
                            request.artist_reply_at ?? request.forwarded_at ?? request.received_at,
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-[#f7f2e9] text-xs uppercase text-[#6f7275]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Request</th>
                      <th className="px-4 py-3 font-semibold">Contact</th>
                      <th className="px-4 py-3 font-semibold">Artist</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Artist replied</th>
                      <th className="px-4 py-3 font-semibold">Last touch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8dd]">
                    {filteredRequests.map((request) => {
                      const artist = relatedOne(request.artist);
                      const isReassignment = hasClientReassignmentRequest(
                        request,
                        messagesByRequestId.get(request.id) ?? [],
                      );
                      const currentArtistReplied = hasCurrentArtistReplied(
                        request,
                        messagesByRequestId.get(request.id) ?? [],
                      );
                      return (
                        <tr
                          key={request.id}
                          className={`cursor-pointer ${
                            request.id === selectedRequest?.id ? "bg-[#fffaf1]" : ""
                          }`}
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            setMobileDetailOpen(true);
                            setAssignmentArtistId(request.artist_id ?? "");
                            setBookingMode(false);
                            setBookingForm(null);
                            setError("");
                            setMessage("");
                          }}
                        >
                          <td className="px-4 py-4">
                            <p className="text-xs font-bold text-[#8a6f4d]">{requestCode(request)}</p>
                            <p className="mt-1 font-semibold">{request.subject}</p>
                            {isReassignment ? (
                              <span className="mt-2 inline-flex rounded bg-[#f1eadc] px-2 py-1 text-xs font-bold text-[#775f36]">
                                Client requested another artist
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-[#4d555c]">
                            <p className="font-semibold text-[#1f2428]">{request.client_name}</p>
                            <p className="mt-1">{request.email || "-"}</p>
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
                          <td className="px-4 py-4">
                            {currentArtistReplied ? (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-[#e3f6df] px-2 py-1 text-xs font-bold text-[#2f6b2f]"
                                title={displayDateTime(request.artist_reply_at)}
                              >
                                <span aria-hidden="true">&#10003;</span>
                                Sent
                              </span>
                            ) : null}
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
              <aside
                className={`${mobileDetailOpen ? "fixed" : "hidden"} inset-0 z-40 flex flex-col overflow-hidden bg-white shadow-xl md:inset-6 md:left-1/2 md:max-h-[calc(100vh-3rem)] md:max-w-4xl md:-translate-x-1/2 md:rounded-md md:border md:border-[#d9d3c7]`}
              >
                <div className="shrink-0 border-b border-[#e5dfd4] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedRequest.subject}</h3>
                      <p className="mt-1 text-sm text-[#697178]">
                        {requestCode(selectedRequest)} /{" "}
                        {bookingMode
                          ? "Create a project and optional deposit."
                          : statusLabel(selectedRequest.status)}
                      </p>
                      {hasClientReassignmentRequest(
                        selectedRequest,
                        messagesByRequestId.get(selectedRequest.id) ?? [],
                      ) ? (
                        <span className="mt-2 inline-flex rounded bg-[#f1eadc] px-2 py-1 text-xs font-bold text-[#775f36]">
                          Client requested another artist
                        </span>
                      ) : null}
                      {hasCurrentArtistReplied(
                        selectedRequest,
                        messagesByRequestId.get(selectedRequest.id) ?? [],
                      ) ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded bg-[#e3f6df] px-2 py-1 text-xs font-bold text-[#2f6b2f]">
                          <span aria-hidden="true">&#10003;</span>
                          Artist replied
                        </span>
                      ) : null}
                    </div>
                    <button
                      aria-label="Close request detail"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#cfc7b8] text-lg font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                      onClick={closeRequestDetail}
                      type="button"
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
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

                  {bookingMode && bookingForm ? (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold">Project setup</h4>
                        <div className="mt-3 space-y-3">
                          <label className="block text-sm font-semibold">
                            Project name
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              onChange={(event) =>
                                setBookingForm((current) =>
                                  current ? { ...current, projectSubject: event.target.value } : current,
                                )
                              }
                              value={bookingForm.projectSubject}
                            />
                          </label>
                          <label className="block text-sm font-semibold">
                            Project type
                            <select
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              onChange={(event) =>
                                setBookingForm((current) =>
                                  current ? { ...current, projectType: event.target.value } : current,
                                )
                              }
                              value={bookingForm.projectType}
                            >
                              {projectTypes.map((type) => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold">Deposit</h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-semibold">
                            Amount
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              min="0"
                              onChange={(event) =>
                                setBookingForm((current) =>
                                  current ? { ...current, depositAmount: event.target.value } : current,
                                )
                              }
                              placeholder="Optional"
                              step="0.01"
                              type="number"
                              value={bookingForm.depositAmount}
                            />
                          </label>
                          <label className="text-sm font-semibold">
                            Payment method
                            <select
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              onChange={(event) =>
                                setBookingForm((current) =>
                                  current ? { ...current, depositPaymentMethod: event.target.value } : current,
                                )
                              }
                              value={bookingForm.depositPaymentMethod}
                            >
                              {paymentMethods.map((method) => (
                                <option key={method.value} value={method.value}>
                                  {method.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <textarea
                          className="mt-3 min-h-20 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                          disabled={saving}
                          onChange={(event) =>
                            setBookingForm((current) =>
                              current ? { ...current, depositMemo: event.target.value } : current,
                            )
                          }
                          placeholder="Deposit memo"
                          value={bookingForm.depositMemo}
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={saving}
                          onClick={() => {
                            setBookingMode(false);
                            setBookingForm(null);
                            setError("");
                          }}
                          type="button"
                        >
                          Back to request
                        </button>
                        <button
                          className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={saving}
                          onClick={bookProject}
                          type="button"
                        >
                          {saving ? "Saving..." : "Create project"}
                        </button>
                      </div>
                      <button
                        className="h-10 w-full rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                        onClick={closeRequestDetail}
                        type="button"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                  <div>
                    <h4 className="text-sm font-semibold">Basic info</h4>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Client name</p>
                        <p className="mt-1 font-semibold">{selectedRequest.client_name}</p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Contact</p>
                        <p className="mt-1 font-semibold">{selectedRequest.email || "-"}</p>
                        <p className="mt-1 text-[#697178]">{selectedRequest.phone || "-"}</p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Size</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.approximate_size
                            ? `${selectedRequest.approximate_size} inch`
                            : "-"}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Placement</p>
                        <p className="mt-1 font-semibold">{selectedRequest.placement || "-"}</p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3 lg:col-span-2">
                        <p className="text-[#697178]">Artist</p>
                        {needsArtistAssignment ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <select
                              className="h-10 min-w-0 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              onChange={(event) => setAssignmentArtistId(event.target.value)}
                              value={assignmentArtistId || effectiveArtistId(selectedRequest, artists)}
                            >
                              <option value="">Select artist</option>
                              {artists.map((artist) => (
                                <option key={artist.id} value={artist.id}>
                                  {artist.display_name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={saving || !(assignmentArtistId || effectiveArtistId(selectedRequest, artists))}
                              onClick={assignRequestArtist}
                              type="button"
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 font-semibold">
                              {isAnyAvailableLabel(selectedRequest.requested_artist_label)
                                ? relatedOne(selectedRequest.artist)?.display_name || "Any available"
                                : selectedRequest.requested_artist_label || "-"}
                            </p>
                            {isAnyAvailableLabel(selectedRequest.requested_artist_label) &&
                            relatedOne(selectedRequest.artist)?.display_name ? (
                              <p className="mt-1 text-xs font-medium text-[#697178]">
                                Requested: Any available
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3 lg:col-span-2">
                        <p className="text-[#697178]">Timing preference</p>
                        <p className="mt-1 font-semibold">
                          {tattooTimingLabel(selectedRequest.tattoo_timing_preference)}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3 lg:col-span-4">
                        <p className="text-[#697178]">Description</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.tattoo_description || selectedRequest.subject}
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
                      <div className="mt-3 rounded-md border border-[#d9d3c7] bg-white p-3">
                        <p className="text-sm font-semibold">Reference image</p>
                        <a
                          className="mt-3 block overflow-hidden rounded-md border border-[#e4dccf] bg-[#f7f2e9]"
                          href={selectedRequest.reference_image_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt="Request reference"
                            className="max-h-72 w-full object-contain"
                            src={selectedRequest.reference_image_url}
                          />
                        </a>
                        <a
                          className="mt-3 inline-flex h-10 items-center rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold text-[#30373d] hover:bg-[#eee8dd]"
                          href={selectedRequest.reference_image_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open reference image
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Timeline</h4>
                    <ol className="mt-3 grid gap-2 overflow-x-auto pb-1 sm:grid-cols-4">
                      {timelineFor(selectedRequest).map((item) => (
                        <li
                          key={item.label}
                          className="relative min-w-32 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                timelineDotClasses(item, selectedRequest)
                              }`}
                            >
                              {timelineMarker(item, selectedRequest)}
                            </span>
                            <span className="hidden h-px flex-1 bg-[#d9d3c7] sm:block" />
                            <span className="hidden text-[#bdb3a3] sm:block">&gt;</span>
                          </div>
                          <span className="block text-xs font-semibold">{item.label}</span>
                          <span className="mt-1 block text-xs text-[#697178]">{item.value}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold">Email log</h4>
                      <span className="rounded bg-[#f1eadc] px-2 py-1 text-xs font-bold text-[#775f36]">
                        {selectedActionMessages.length} messages
                      </span>
                    </div>
                    {selectedActionMessages.length === 0 ? (
                      <p className="mt-3 rounded-md border border-dashed border-[#d9d3c7] px-3 py-4 text-sm font-semibold text-[#697178]">
                        No email activity yet. The first artist-to-client email will be recorded
                        here after the artist sends it from the draft page.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selectedActionMessages.map((email) => (
                          <details
                            className="group rounded-md border border-[#e4dccf] bg-[#fdfbf7] text-sm"
                            key={email.id}
                          >
                            <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 marker:hidden sm:grid-cols-[1fr_auto] sm:items-start">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-[#1f2428] px-2 py-1 text-xs font-bold text-white">
                                    {emailLogEventLabel(email, selectedRequest)}
                                  </span>
                                  <p className="min-w-0 flex-1 truncate font-semibold">
                                    {email.subject || selectedRequest.subject}
                                  </p>
                                </div>
                                <p className="mt-1 text-xs text-[#697178]">
                                  From {displayEmailSender(email)} / To {displayEmailList(email.to_emails)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span
                                  className={`rounded px-2 py-1 text-xs font-bold ${
                                    email.direction === "inbound"
                                      ? "bg-[#e8f0ee] text-[#2f6658]"
                                      : "bg-[#e5edf4] text-[#315f82]"
                                  }`}
                                >
                                  {email.direction === "inbound" ? "Inbound" : "Outbound"}
                                </span>
                                <span className="text-xs font-semibold text-[#697178]">
                                  {displayDateTime(email.received_at)}
                                </span>
                                <span className="text-xs font-bold text-[#8a6f4d] group-open:hidden">
                                  Open
                                </span>
                                <span className="hidden text-xs font-bold text-[#8a6f4d] group-open:inline">
                                  Close
                                </span>
                              </div>
                            </summary>
                            <div className="border-t border-[#e4dccf] px-3 py-3">
                              <p className="whitespace-pre-wrap break-words text-[#4d555c]">
                                {emailLogBody(email)}
                              </p>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedRequest.notes ? (
                  <div>
                    <h4 className="text-sm font-semibold">Notes</h4>
                    <p className="mt-2 rounded-md bg-[#f7f2e9] px-3 py-3 text-sm text-[#4d555c]">
                      {selectedRequest.notes}
                    </p>
                  </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <button
                      className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        saving ||
                        Boolean(selectedRequest.project_id) ||
                        selectedRequest.status === "spam"
                      }
                      onClick={openBookingSetup}
                      type="button"
                    >
                      {selectedRequest.project_id ? "Project created" : "Create project"}
                    </button>
                    <button
                      className="h-10 rounded-md border border-[#b98238] px-3 text-sm font-semibold text-[#8a5130] hover:bg-[#f4e7df] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || selectedRequest.status === "no_answer"}
                      onClick={() => updateRequestStatus("no_answer")}
                      type="button"
                    >
                      No answer from client
                    </button>
                    <button
                      className="h-10 rounded-md border border-[#8a3030] px-3 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || selectedRequest.status === "denied"}
                      onClick={() => updateRequestStatus("denied")}
                      type="button"
                    >
                      Declined by shop
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <p className="text-xs text-[#697178]">
                      Spam requests are hidden from the default queue and cannot be assigned or
                      converted into projects.
                    </p>
                    {selectedRequest.status === "spam" ? (
                      <button
                        className="h-10 rounded-md border border-[#2f6658] px-3 text-sm font-semibold text-[#2f6658] hover:bg-[#e8f0ee] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                        onClick={() => updateRequestStatus("new")}
                        type="button"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        className="h-10 rounded-md border border-[#8a3030] px-3 text-sm font-semibold text-[#8a3030] hover:bg-[#f3e1e1] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving || Boolean(selectedRequest.project_id)}
                        onClick={() => updateRequestStatus("spam")}
                        type="button"
                      >
                        Mark spam
                      </button>
                    )}
                  </div>

                  <button
                    className="h-10 w-full rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                    onClick={closeRequestDetail}
                    type="button"
                  >
                    Close
                  </button>

                  <p className="border-t border-[#eee8dd] pt-3 text-[11px] text-[#9a9183]">
                    Internal request ID: {selectedRequest.id.slice(0, 8)}
                  </p>
                    </>
                  )}
                </div>
              </aside>
            ) : null}
          </section>
        </>
      ) : null}

      {schedulePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <section className="w-full max-w-md rounded-md border border-[#d9d3c7] bg-white shadow-xl">
            <div className="border-b border-[#e5dfd4] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4d]">
                Project created
              </p>
              <h3 className="mt-1 text-xl font-semibold">Schedule the first appointment?</h3>
              <p className="mt-2 text-sm text-[#697178]">
                You can book a schedule now, or leave this project unscheduled and come back later.
              </p>
            </div>
            <div className="grid gap-2 px-5 py-5 sm:grid-cols-2">
              <button
                className="h-10 rounded-md bg-[#1f2428] px-3 text-sm font-semibold text-white hover:bg-[#30373d]"
                onClick={() => {
                  const params = new URLSearchParams({
                    projectId: schedulePrompt.projectId,
                    artistId: schedulePrompt.artistId,
                  });
                  window.location.assign(`/calendar?${params.toString()}`);
                }}
                type="button"
              >
                Schedule now
              </button>
              <button
                className="h-10 rounded-md border border-[#cfc7b8] px-3 text-sm font-semibold hover:bg-[#eee8dd]"
                onClick={() => setSchedulePrompt(null)}
                type="button"
              >
                Later
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNewRequest ? (
        <NewRequestModal
          artists={artists}
          customers={customers}
          error={newRequestError}
          onClose={() => setShowNewRequest(false)}
          onSave={createRequest}
          saving={saving}
        />
      ) : null}
    </AppPage>
  );
}

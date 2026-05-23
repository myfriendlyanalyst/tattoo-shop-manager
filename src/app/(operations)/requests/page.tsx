"use client";

import { useEffect, useMemo, useState } from "react";
import { AppPage } from "@/components/app-shell";
import { TimeSelect } from "@/components/time-select";
import {
  scheduleAppointmentReminder,
  sendAppointmentConfirmation,
} from "@/lib/appointment-email";
import { getSafeUser } from "@/lib/auth-session";
import { getOperationsContext, type OperationsContext } from "@/lib/operations-access";
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
  preferredAppointmentDate: string;
  notes: string;
};

type BookingForm = {
  projectSubject: string;
  projectType: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentNotes: string;
  depositAmount: string;
  depositPaymentMethod: string;
  depositMemo: string;
};

const statusOptions = [
  "new",
  "forwarded",
  "artist_replied",
  "client_replied",
  "booked",
  "client_waiting_for_reply",
  "no_answer",
  "denied",
];

const referenceBucket = "request-references";
const requestSelect =
  "id, customer_id, project_id, client_name, email, phone, subject, tattoo_description, approximate_size, placement, reference_image_url, requested_artist_label, tattoo_timing_preference, preferred_appointment_date, age_confirmed, artist_id, status, priority, received_at, forwarded_at, artist_reply_at, client_reply_at, consultation_at, booked_at, notes, artist:staff(display_name)";
const requestMessageSelect =
  "id, request_id, provider, provider_thread_id, provider_message_id, direction, from_email, from_name, to_emails, cc_emails, subject, body_text, snippet, received_at";

const projectTypes = ["Walk-in", "One Done", "Multiple Session"];
const tattooTimingOptions = [
  { value: "", label: "Not specified" },
  { value: "asap", label: "ASAP" },
  { value: "within_1_2_weeks", label: "Within 1-2 weeks" },
  { value: "flexible", label: "Flexible" },
  { value: "preferred_date", label: "Preferred date" },
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

function selectedArtistName(request: RequestRecord) {
  return relatedOne(request.artist)?.display_name ?? "-";
}

function requestNameFromParts(clientName: string, placement: string) {
  const cleanClient = clientName.trim();
  const cleanPlacement = placement.trim();
  const projectType = cleanPlacement ? `${cleanPlacement} tattoo` : "Tattoo project";

  return cleanClient ? `${cleanClient} - ${projectType}` : projectType;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    forwarded: "Forwarded",
    artist_replied: "Artist Replied",
    client_replied: "Client Replied",
    consultation: "Booked",
    booked: "Booked",
    client_waiting_for_reply: "Waiting Client",
    no_answer: "No answer from client",
    denied: "Declined by shop",
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
    consultation: "bg-[#e4f1df] text-[#476b33]",
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

function displayDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function displayEmailList(value: string[] | null) {
  return value && value.length > 0 ? value.join(", ") : "-";
}

function tattooTimingLabel(value: string | null) {
  return tattooTimingOptions.find((option) => option.value === (value ?? ""))?.label ?? value ?? "-";
}

function localDateInput(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localTimeInput(value = new Date()) {
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function localDateTimeFromParts(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function defaultBookingForm(request: RequestRecord): BookingForm {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  return {
    projectSubject: projectSubjectFromRequest(request),
    projectType: "Multiple Session",
    appointmentDate: localDateInput(start),
    startTime: localTimeInput(start),
    endTime: localTimeInput(end),
    appointmentNotes: request.notes ?? "",
    depositAmount: "",
    depositPaymentMethod: "cash",
    depositMemo: "",
  };
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
      label: "Project booked",
      value: displayDateTime(request.booked_at),
      done: Boolean(request.booked_at),
    },
  ];
}

function requestDetailMemo(request: RequestRecord) {
  return [
    request.notes,
    request.tattoo_description ? `Tattoo description: ${request.tattoo_description}` : null,
    request.approximate_size ? `Approximate size: ${request.approximate_size} inch` : null,
    request.placement ? `Placement: ${request.placement}` : null,
    request.tattoo_timing_preference
      ? `Timing preference: ${tattooTimingLabel(request.tattoo_timing_preference)}`
      : null,
    request.preferred_appointment_date
      ? `Preferred date: ${displayDate(request.preferred_appointment_date)}`
      : null,
    request.reference_image_url ? `Reference image: ${request.reference_image_url}` : null,
    request.requested_artist_label ? `Requested artist: ${request.requested_artist_label}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function projectSubjectFromRequest(request: RequestRecord) {
  return request.subject?.trim() || requestNameFromParts(request.client_name, request.placement ?? "");
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
    preferredAppointmentDate: "",
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
                    preferredAppointmentDate:
                      event.target.value === "preferred_date"
                        ? current.preferredAppointmentDate
                        : "",
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
            <label className="text-sm font-semibold">
              Preferred date
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm disabled:bg-[#eee8dd]"
                disabled={form.tattooTimingPreference !== "preferred_date"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preferredAppointmentDate: event.target.value,
                    tattooTimingPreference: event.target.value
                      ? "preferred_date"
                      : current.tattooTimingPreference,
                  }))
                }
                type="date"
                value={form.preferredAppointmentDate}
              />
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
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [requestFiles, setRequestFiles] = useState<RequestFile[]>([]);
  const [requestMessages, setRequestMessages] = useState<RequestMessage[]>([]);
  const [artists, setArtists] = useState<StaffRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artistFilter, setArtistFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequestError, setNewRequestError] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm | null>(null);
  const [assignmentArtistId, setAssignmentArtistId] = useState("");
  const [operationsContext, setOperationsContext] = useState<OperationsContext | null>(null);
  const isArtistUser = operationsContext?.isArtist === true;

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

    return requestMessages.filter((email) => email.request_id === selectedRequest.id);
  }, [requestMessages, selectedRequest]);

  const needsArtistAssignment = useMemo(() => {
    if (!selectedRequest) {
      return false;
    }

    return isAnyAvailableLabel(selectedRequest.requested_artist_label) && !selectedRequest.artist_id;
  }, [selectedRequest]);

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
          .eq("permission_key", "calendarBooking"),
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
    const preferredAppointmentDate = form.preferredAppointmentDate || null;
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

    if (tattooTimingPreference === "preferred_date" && !preferredAppointmentDate) {
      setNewRequestError("Preferred date is required when timing is set to Preferred date.");
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
        preferred_appointment_date: preferredAppointmentDate,
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
    if (!selectedRequest || !assignmentArtistId) {
      return;
    }

    const requestPatch = {
      artist_id: assignmentArtistId,
      status: selectedRequest.status === "new" ? "forwarded" : selectedRequest.status,
      forwarded_at: selectedRequest.forwarded_at ?? new Date().toISOString(),
    };

    setSaving(true);
    setError("");
    setMessage("");

    const result = await supabase.from("requests").update(requestPatch).eq("id", selectedRequest.id);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id
          ? {
              ...request,
              ...requestPatch,
              artist: artists.find((item) => item.id === assignmentArtistId)
                ? {
                    display_name: artists.find((item) => item.id === assignmentArtistId)!
                      .display_name,
                  }
                : request.artist,
            }
          : request,
      ),
    );
    setMessage("Artist assigned.");
    setSaving(false);
  }

  function openBookingSetup() {
    if (!selectedRequest) {
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
    setBookingForm(defaultBookingForm(selectedRequest));
    setBookingMode(true);
  }

  function closeRequestDetail() {
    setMobileDetailOpen(false);
    setBookingMode(false);
    setBookingForm(null);
    setError("");
    setMessage("");
  }

  async function bookProject() {
    if (!selectedRequest) {
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

    const startsAt = localDateTimeFromParts(bookingForm.appointmentDate, bookingForm.startTime);
    const endsAt = localDateTimeFromParts(bookingForm.appointmentDate, bookingForm.endTime);
    const depositAmount = Number(bookingForm.depositAmount || 0);

    if (!bookingForm.projectSubject.trim()) {
      setError("Project name is required.");
      return;
    }

    if (!bookingForm.appointmentDate || !bookingForm.startTime || !bookingForm.endTime || endsAt <= startsAt) {
      setError("First appointment needs a valid date, start time, and end time.");
      return;
    }

    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setError("Deposit amount must be a valid number.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let customerId = selectedRequest.customer_id;

    if (!customerId) {
      const matchingCustomer = customers.find(
        (customer) => normalizeEmail(customer.email) === normalizeEmail(selectedRequest.email),
      );

      customerId = matchingCustomer?.id ?? null;
    }

    if (!customerId) {
      const customerResult = await supabase
        .from("customers")
        .insert({
          name: selectedRequest.client_name,
          email: selectedRequest.email,
          phone: selectedRequest.phone,
          notes: requestDetailMemo(selectedRequest),
        })
        .select("id, name, email, phone")
        .single();

      if (customerResult.error) {
        setError(customerResult.error.message);
        setSaving(false);
        return;
      }

      customerId = customerResult.data.id;
      setCustomers((current) => [...current, customerResult.data as CustomerRecord]);
    }

    const projectResult = await supabase
      .from("projects")
      .insert({
        customer_id: customerId,
        artist_id: bookingArtistId,
        subject: bookingForm.projectSubject.trim(),
        size: selectedRequest.approximate_size,
        session_type: bookingForm.projectType,
        status: "booked",
        waiver_signed: false,
        waiver_status: "missing",
        memo: requestDetailMemo(selectedRequest),
      })
      .select("id")
      .single();

    if (projectResult.error) {
      setError(projectResult.error.message);
      setSaving(false);
      return;
    }

    const appointmentResult = await supabase
      .from("appointments")
      .insert({
        customer_id: customerId,
        project_id: projectResult.data.id,
        artist_id: bookingArtistId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        appointment_type: bookingForm.projectType,
        status: "scheduled",
        notes: bookingForm.appointmentNotes.trim() || null,
      })
      .select("id")
      .single();

    if (appointmentResult.error) {
      setError(appointmentResult.error.message);
      setSaving(false);
      return;
    }

    const emailResult = await sendAppointmentConfirmation(appointmentResult.data.id);
    const reminderResult = await scheduleAppointmentReminder(appointmentResult.data.id);

    if (depositAmount > 0) {
      const depositResult = await supabase
        .from("deposits")
        .insert({
          customer_id: customerId,
          project_id: projectResult.data.id,
          artist_id: bookingArtistId,
          amount: depositAmount,
          payment_method: bookingForm.depositPaymentMethod,
          received_at: new Date().toISOString(),
          available: true,
          memo: bookingForm.depositMemo.trim() || null,
        });

      if (depositResult.error) {
        setError(depositResult.error.message);
        setSaving(false);
        return;
      }
    }

    const requestPatch = {
      customer_id: customerId,
      project_id: projectResult.data.id,
      status: "booked",
      booked_at: selectedRequest.booked_at ?? new Date().toISOString(),
    };

    await supabase.from("requests").update(requestPatch).eq("id", selectedRequest.id);

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id ? { ...request, ...requestPatch } : request,
      ),
    );
    setBookingMode(false);
    setBookingForm(null);
    const reminderMessage =
      reminderResult.status === "failed"
        ? ` Reminder email was not scheduled: ${reminderResult.error || reminderResult.reason}.`
        : "";
    setMessage(
      emailResult.sent
        ? `Request booked as a project. Confirmation email sent.${reminderMessage}`
        : `Request booked as a project. Confirmation email was not sent yet${
            emailResult.error || emailResult.reason
              ? `: ${emailResult.error || emailResult.reason}`
              : "."
          }${reminderMessage}`,
    );
    setSaving(false);
  }

  return (
    <AppPage
      eyebrow="Request intake"
      title="Website and email requests"
      description="Manage Webflow/Gmail requests, artist candidates, and conversion into customer/project records."
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
                <div className="flex gap-2">
                  <select
                    className="h-10 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setMobileDetailOpen(false);
                    }}
                    value={statusFilter}
                  >
                    <option value="all">All statuses</option>
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
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.display_name}
                      </option>
                    ))}
                  </select>
                  ) : null}
                </div>
              </div>

              <div className="divide-y divide-[#eee8dd] md:hidden">
                {filteredRequests.map((request) => {
                  const artist = relatedOne(request.artist);

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
                            setMobileDetailOpen(true);
                            setAssignmentArtistId(request.artist_id ?? "");
                            setBookingMode(false);
                            setBookingForm(null);
                            setError("");
                            setMessage("");
                          }}
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold">{request.subject}</p>
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
                        {bookingMode
                          ? "Book project, first appointment, and optional deposit."
                          : statusLabel(selectedRequest.status)}
                      </p>
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
                        <h4 className="text-sm font-semibold">Booking setup</h4>
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
                            Appointment date
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                              disabled={saving}
                              onChange={(event) =>
                                setBookingForm((current) =>
                                  current ? { ...current, appointmentDate: event.target.value } : current,
                                )
                              }
                              type="date"
                              value={bookingForm.appointmentDate}
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm font-semibold">
                              Start time
                              <TimeSelect
                                disabled={saving}
                                onChange={(value) =>
                                  setBookingForm((current) =>
                                    current ? { ...current, startTime: value } : current,
                                  )
                                }
                                startHour={12}
                                value={bookingForm.startTime}
                              />
                            </label>
                            <label className="text-sm font-semibold">
                              End time
                              <TimeSelect
                                disabled={saving}
                                onChange={(value) =>
                                  setBookingForm((current) =>
                                    current ? { ...current, endTime: value } : current,
                                  )
                                }
                                startHour={12}
                                value={bookingForm.endTime}
                              />
                            </label>
                          </div>
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
                          <textarea
                            className="min-h-20 w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm"
                            disabled={saving}
                            onChange={(event) =>
                              setBookingForm((current) =>
                                current ? { ...current, appointmentNotes: event.target.value } : current,
                              )
                            }
                            placeholder="Appointment notes"
                            value={bookingForm.appointmentNotes}
                          />
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
                          {saving ? "Saving..." : "Save booking"}
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
                        <p className="text-[#697178]">Timing preference</p>
                        <p className="mt-1 font-semibold">
                          {tattooTimingLabel(selectedRequest.tattoo_timing_preference)}
                        </p>
                      </div>
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3 lg:col-span-2">
                        <p className="text-[#697178]">Preferred date</p>
                        <p className="mt-1 font-semibold">
                          {displayDate(selectedRequest.preferred_appointment_date)}
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
                    <h4 className="text-sm font-semibold">Assignment</h4>
                    <div
                      className={`mt-3 grid gap-3 text-sm ${
                        isAnyAvailableLabel(selectedRequest.requested_artist_label)
                          ? "lg:grid-cols-3"
                          : "lg:grid-cols-1"
                      }`}
                    >
                      <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                        <p className="text-[#697178]">Requested artist</p>
                        <p className="mt-1 font-semibold">
                          {selectedRequest.requested_artist_label || "Any available"}
                        </p>
                      </div>
                      {isAnyAvailableLabel(selectedRequest.requested_artist_label) ? (
                        <>
                          <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                            <p className="text-[#697178]">Selected artist</p>
                            <p className="mt-1 font-semibold">
                              {selectedArtistName(selectedRequest)}
                            </p>
                          </div>
                          <div className="rounded-md bg-[#f7f2e9] px-3 py-3">
                            <p className="text-[#697178]">Artist assignment</p>
                            {needsArtistAssignment ? (
                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1 xl:grid-cols-[1fr_auto]">
                                <select
                                  className="h-10 min-w-0 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
                                  disabled={saving}
                                  onChange={(event) => setAssignmentArtistId(event.target.value)}
                                  value={assignmentArtistId}
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
                                  disabled={saving || !assignmentArtistId}
                                  onClick={assignRequestArtist}
                                  type="button"
                                >
                                  Confirm
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 font-semibold text-[#697178]">Assigned</p>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Timeline</h4>
                    <ol className="mt-3 grid gap-2 overflow-x-auto pb-1 sm:grid-cols-5">
                      {timelineFor(selectedRequest).map((item) => (
                        <li
                          key={item.label}
                          className="relative min-w-32 rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                item.done
                                  ? "bg-[#2f6658] text-white"
                                  : "border border-[#bdb3a3] bg-white text-[#8a8174]"
                              }`}
                            >
                              {item.done ? "Y" : ""}
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
                      <h4 className="text-sm font-semibold">Email tracking</h4>
                      <span className="rounded bg-[#f1eadc] px-2 py-1 text-xs font-bold text-[#775f36]">
                        {selectedMessages.length} messages
                      </span>
                    </div>
                    {selectedMessages.length === 0 ? (
                      <p className="mt-3 rounded-md border border-dashed border-[#d9d3c7] px-3 py-4 text-sm font-semibold text-[#697178]">
                        No tracked emails yet. Connect the Make.com Gmail watcher to start
                        recording this request thread automatically.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selectedMessages.map((email) => (
                          <article
                            className="rounded-md border border-[#e4dccf] bg-[#fdfbf7] px-3 py-3 text-sm"
                            key={email.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">
                                  {email.subject || selectedRequest.subject}
                                </p>
                                <p className="mt-1 text-xs text-[#697178]">
                                  From {email.from_name || email.from_email || "-"} / To{" "}
                                  {displayEmailList(email.to_emails)}
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
                              </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-[#4d555c]">
                              {email.snippet || email.body_text || "No preview text."}
                            </p>
                          </article>
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
                      disabled={saving || Boolean(selectedRequest.project_id)}
                      onClick={openBookingSetup}
                      type="button"
                    >
                      {selectedRequest.project_id ? "Project booked" : "Book project"}
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

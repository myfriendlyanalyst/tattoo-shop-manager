import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calendarEventDescription,
  calendarEventTitle,
  configuredBaseUrl,
} from "@/lib/email-templates/calendar-links";

const calendarScope = [
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const calendarApiBase = "https://www.googleapis.com/calendar/v3";
const studioLocation = "8199 Clairemont Mesa Blvd, Suite L, San Diego, CA 92111";

type GoogleCalendarConnection = {
  staff_id: string;
  google_email: string | null;
  calendar_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  last_error: string | null;
};

type GoogleCalendarEventMap = {
  appointment_id: string;
  google_event_id: string;
};

type AppointmentForGoogle = {
  id: string;
  artist_id: string | null;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  status: string;
  notes: string | null;
  customer: { name: string } | { name: string }[] | null;
  project: { subject: string } | { subject: string }[] | null;
  artist: { display_name: string } | { display_name: string }[] | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleEventResponse = {
  id?: string;
  error?: {
    code?: number;
    message?: string;
  };
};

type GoogleUserInfoResponse = {
  email?: string;
};

export type GoogleSyncResult = {
  status: "connected" | "skipped" | "synced" | "deleted" | "failed";
  error?: string;
};

function googleClientId() {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "";
}

function googleClientSecret() {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "";
}

function stateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function googleCalendarConfigured() {
  return Boolean(googleClientId() && googleClientSecret() && stateSecret());
}

export function missingGoogleCalendarConfig() {
  return [
    googleClientId() ? null : "GOOGLE_CALENDAR_CLIENT_ID",
    googleClientSecret() ? null : "GOOGLE_CALENDAR_CLIENT_SECRET",
    stateSecret() ? null : "GOOGLE_OAUTH_STATE_SECRET",
  ].filter(Boolean) as string[];
}

export function googleRedirectUri() {
  const explicit = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (explicit) return explicit;

  return `${configuredBaseUrl().replace(/\/$/, "")}/api/google-calendar/callback`;
}

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function eventEnd(startsAt: string, endsAt?: string | null) {
  if (endsAt) return endsAt;
  return new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signStatePayload(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

export function createGoogleOAuthState(input: { staffId: string; userId: string; returnTo?: string }) {
  const payload = encodeBase64Url(
    JSON.stringify({
      createdAt: Date.now(),
      nonce: randomBytes(16).toString("hex"),
      returnTo: input.returnTo || "/calendar",
      staffId: input.staffId,
      userId: input.userId,
    }),
  );
  const signature = signStatePayload(payload);

  return `${payload}.${signature}`;
}

export function parseGoogleOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = signStatePayload(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const parsed = JSON.parse(decodeBase64Url(payload)) as {
    createdAt?: number;
    returnTo?: string;
    staffId?: string;
    userId?: string;
  };

  if (!parsed.createdAt || Date.now() - parsed.createdAt > 10 * 60 * 1000) return null;
  if (!parsed.staffId || !parsed.userId) return null;

  return parsed as {
    createdAt: number;
    returnTo?: string;
    staffId: string;
    userId: string;
  };
}

export function buildGoogleAuthorizationUrl(input: {
  loginHint?: string | null;
  staffId: string;
  userId: string;
}) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: googleClientId(),
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: calendarScope,
    state: createGoogleOAuthState({ staffId: input.staffId, userId: input.userId }),
  });

  if (input.loginHint) {
    params.set("login_hint", input.loginHint);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function fetchToken(body: Record<string, string>) {
  const response = await fetch(tokenEndpoint, {
    body: new URLSearchParams({
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      ...body,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Google token exchange failed.");
  }

  return payload;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  return fetchToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(),
  });
}

async function getGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => ({}))) as GoogleUserInfoResponse;
  return payload.email ?? null;
}

export async function saveGoogleCalendarConnection(
  adminClient: SupabaseClient,
  input: {
    fallbackGoogleEmail?: string | null;
    staffId: string;
    token: GoogleTokenResponse;
  },
) {
  if (!input.token.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const googleEmail = await getGoogleUserEmail(input.token.access_token);
  const expiresAt = input.token.expires_in
    ? new Date(Date.now() + input.token.expires_in * 1000).toISOString()
    : null;

  const { error } = await adminClient.from("staff_google_calendar_connections").upsert({
    access_token: input.token.access_token,
    calendar_id: "primary",
    google_email: googleEmail || input.fallbackGoogleEmail || null,
    last_error: null,
    refresh_token: input.token.refresh_token,
    scope: input.token.scope ?? calendarScope,
    staff_id: input.staffId,
    token_expires_at: expiresAt,
  });

  if (error) {
    const suffix = error.message.includes("staff_google_calendar_connections")
      ? " Run docs/google_calendar_oauth_mvp_migration.sql in Supabase SQL Editor."
      : "";
    throw new Error(`${error.message}${suffix}`);
  }
}

async function refreshAccessToken(adminClient: SupabaseClient, connection: GoogleCalendarConnection) {
  if (!connection.refresh_token) {
    throw new Error("Google Calendar connection is missing a refresh token. Reconnect Google Calendar.");
  }

  const token = await fetchToken({
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  const { data, error } = await adminClient
    .from("staff_google_calendar_connections")
    .update({
      access_token: token.access_token,
      last_error: null,
      refresh_token: token.refresh_token ?? connection.refresh_token,
      token_expires_at: expiresAt,
    })
    .eq("staff_id", connection.staff_id)
    .select("staff_id, google_email, calendar_id, access_token, refresh_token, token_expires_at, scope, last_error")
    .single();

  if (error) throw new Error(error.message);
  return data as GoogleCalendarConnection;
}

async function usableConnection(adminClient: SupabaseClient, staffId: string) {
  const { data, error } = await adminClient
    .from("staff_google_calendar_connections")
    .select("staff_id, google_email, calendar_id, access_token, refresh_token, token_expires_at, scope, last_error")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (error) {
    const suffix = error.message.includes("staff_google_calendar_connections")
      ? " Run docs/google_calendar_oauth_mvp_migration.sql in Supabase SQL Editor."
      : "";
    throw new Error(`${error.message}${suffix}`);
  }

  const connection = data as GoogleCalendarConnection | null;
  if (!connection) return null;

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() > 60 * 1000) {
    return connection;
  }

  return refreshAccessToken(adminClient, connection);
}

function googleEventBody(appointment: AppointmentForGoogle) {
  const customer = relatedOne(appointment.customer);
  const project = relatedOne(appointment.project);
  const artist = relatedOne(appointment.artist);
  const eventInput = {
    appointmentId: appointment.id,
    artistName: artist?.display_name || "your artist",
    customerName: customer?.name || "Client",
    endsAt: appointment.ends_at,
    projectName: project?.subject || appointment.appointment_type || "Tattoo appointment",
    startsAt: appointment.starts_at,
  };

  return {
    description: [calendarEventDescription(eventInput), appointment.notes || null]
      .filter(Boolean)
      .join("\n\n"),
    end: { dateTime: eventEnd(appointment.starts_at, appointment.ends_at) },
    location: studioLocation,
    start: { dateTime: appointment.starts_at },
    status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
    summary: calendarEventTitle(eventInput),
  };
}

function googleEventIdForAppointment(appointmentId: string) {
  return `0${appointmentId.replace(/[^a-fA-F0-9]/g, "").toLowerCase()}`;
}

async function googleCalendarRequest(
  connection: GoogleCalendarConnection,
  path: string,
  init: RequestInit,
) {
  const response = await fetch(`${calendarApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleEventResponse;

  if (!response.ok) {
    const error = new Error(payload.error?.message || "Google Calendar request failed.");
    error.name = String(payload.error?.code ?? response.status);
    throw error;
  }

  return payload;
}

async function recordGoogleSyncError(
  adminClient: SupabaseClient,
  appointmentId: string,
  staffId: string | null,
  message: string,
) {
  const { data } = await adminClient
    .from("appointment_google_calendar_events")
    .select("appointment_id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (data) {
    await adminClient
      .from("appointment_google_calendar_events")
      .update({ last_error: message, staff_id: staffId })
      .eq("appointment_id", appointmentId);
    return;
  }

  await adminClient.from("appointment_google_calendar_events").insert({
    appointment_id: appointmentId,
    google_event_id: "sync_failed",
    last_error: message,
    staff_id: staffId,
  });
}

export async function syncAppointmentToGoogleCalendar(
  adminClient: SupabaseClient,
  appointmentId: string,
): Promise<GoogleSyncResult> {
  const { data, error } = await adminClient
    .from("appointments")
    .select(
      "id, artist_id, starts_at, ends_at, appointment_type, status, notes, customer:customers(name), project:projects(subject), artist:staff(display_name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) return { status: "failed", error: error.message };
  const appointment = data as AppointmentForGoogle | null;
  if (!appointment?.artist_id) return { status: "skipped" };

  try {
    const connection = await usableConnection(adminClient, appointment.artist_id);
    if (!connection) return { status: "skipped" };

    const { data: eventMapData } = await adminClient
      .from("appointment_google_calendar_events")
      .select("appointment_id, google_event_id")
      .eq("appointment_id", appointment.id)
      .maybeSingle();
    const eventMap = eventMapData as GoogleCalendarEventMap | null;

    if (appointment.status === "cancelled") {
      if (eventMap?.google_event_id && eventMap.google_event_id !== "sync_failed") {
        await googleCalendarRequest(
          connection,
          `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(
            eventMap.google_event_id,
          )}`,
          { method: "DELETE" },
        );
      }
      await adminClient.from("appointment_google_calendar_events").delete().eq("appointment_id", appointment.id);
      return { status: "deleted" };
    }

    const googleEventId =
      eventMap?.google_event_id && eventMap.google_event_id !== "sync_failed"
        ? eventMap.google_event_id
        : googleEventIdForAppointment(appointment.id);
    const eventBody = googleEventBody(appointment);
    const patchBody = JSON.stringify(eventBody);
    const insertBody = JSON.stringify({ ...eventBody, id: googleEventId });
    let event: GoogleEventResponse;

    if (eventMap?.google_event_id && eventMap.google_event_id !== "sync_failed") {
      event = await googleCalendarRequest(
        connection,
        `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(
          googleEventId,
        )}`,
        { body: patchBody, method: "PATCH" },
      );
    } else {
      try {
        event = await googleCalendarRequest(
          connection,
          `/calendars/${encodeURIComponent(connection.calendar_id)}/events`,
          { body: insertBody, method: "POST" },
        );
      } catch (insertError) {
        if (insertError instanceof Error && insertError.name === "409") {
          event = await googleCalendarRequest(
            connection,
            `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(
              googleEventId,
            )}`,
            { body: patchBody, method: "PATCH" },
          );
        } else {
          throw insertError;
        }
      }
    }

    if (!event.id) throw new Error("Google Calendar did not return an event id.");

    await adminClient.from("appointment_google_calendar_events").upsert({
      appointment_id: appointment.id,
      google_event_id: event.id,
      last_error: null,
      staff_id: appointment.artist_id,
      synced_at: new Date().toISOString(),
    });

    return { status: "synced" };
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "Google Calendar sync failed.";
    await recordGoogleSyncError(adminClient, appointment.id, appointment.artist_id, message);
    return { status: "failed", error: message };
  }
}

export async function deleteAppointmentFromGoogleCalendar(
  adminClient: SupabaseClient,
  appointmentId: string,
): Promise<GoogleSyncResult> {
  const { data: eventMapData } = await adminClient
    .from("appointment_google_calendar_events")
    .select("appointment_id, google_event_id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  const eventMap = eventMapData as GoogleCalendarEventMap | null;
  if (!eventMap?.google_event_id || eventMap.google_event_id === "sync_failed") return { status: "skipped" };

  const { data: appointmentData } = await adminClient
    .from("appointments")
    .select("artist_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const appointment = appointmentData as { artist_id: string | null } | null;
  if (!appointment?.artist_id) return { status: "skipped" };

  try {
    const connection = await usableConnection(adminClient, appointment.artist_id);
    if (!connection) return { status: "skipped" };

    await googleCalendarRequest(
      connection,
      `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(
        eventMap.google_event_id,
      )}`,
      { method: "DELETE" },
    );
    await adminClient.from("appointment_google_calendar_events").delete().eq("appointment_id", appointmentId);
    return { status: "deleted" };
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "Google Calendar delete failed.";
    await recordGoogleSyncError(adminClient, appointmentId, appointment.artist_id, message);
    return { status: "failed", error: message };
  }
}

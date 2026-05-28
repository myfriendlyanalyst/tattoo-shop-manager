import { supabase } from "@/lib/supabase";

export type OperationsRole = "owner" | "admin" | "artist" | "front_desk" | "accounting" | null;
export type OperationsViewMode = "admin" | "artist";

export type OperationsContext = {
  userId: string;
  email: string;
  role: OperationsRole;
  staffRole: string | null;
  staffId: string | null;
  isArtist: boolean;
  isOperationsAdmin: boolean;
  canUseArtistView: boolean;
  viewMode: OperationsViewMode;
};

let cachedOperationsContext: OperationsContext | null | undefined;
let pendingOperationsContext: Promise<OperationsContext | null> | null = null;
let authCacheInvalidationBound = false;
const operationsViewModeKey = "oyabun.operationsViewMode";
export const operationsViewModeChangedEvent = "oyabun:operations-view-mode-changed";

export function getCachedOperationsContext() {
  return cachedOperationsContext;
}

export function clearOperationsContextCache() {
  cachedOperationsContext = undefined;
  pendingOperationsContext = null;
}

export function getOperationsViewMode(): OperationsViewMode {
  if (typeof window === "undefined") {
    return "admin";
  }

  return window.localStorage.getItem(operationsViewModeKey) === "artist" ? "artist" : "admin";
}

export function setOperationsViewMode(mode: OperationsViewMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(operationsViewModeKey, mode);
  clearOperationsContextCache();
  window.dispatchEvent(new Event(operationsViewModeChangedEvent));
}

function bindAuthCacheInvalidation() {
  if (authCacheInvalidationBound || typeof window === "undefined") {
    return;
  }

  authCacheInvalidationBound = true;
  supabase.auth.onAuthStateChange(() => {
    clearOperationsContextCache();
  });
}

async function loadOperationsContext(): Promise<OperationsContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const email = user.email?.toLowerCase() ?? "";

  const { data: profileById } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: profileByEmail } = profileById
    ? { data: null }
    : await supabase
        .from("profiles")
        .select("role")
        .ilike("email", email)
        .maybeSingle();

  const profile = profileById ?? profileByEmail;

  const { data: staffByProfileId } = await supabase
    .from("staff")
    .select("id, role")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: staffByEmail } = staffByProfileId
    ? { data: null }
    : await supabase
        .from("staff")
        .select("id, role")
        .ilike("email", email)
        .maybeSingle();

  const role = (profile?.role ?? null) as OperationsRole;
  const staff = staffByProfileId ?? staffByEmail;
  const staffId = staff?.id ?? null;
  const staffRole = staff?.role ?? null;
  const isOperationsAdmin = role === "owner" || role === "admin" || role === "front_desk";
  const canUseArtistView = Boolean(staffId) && (role === "artist" || isOperationsAdmin);
  const viewMode = canUseArtistView ? getOperationsViewMode() : "admin";
  const isArtist = role === "artist" || (viewMode === "artist" && canUseArtistView);

  return {
    userId: user.id,
    email,
    role,
    staffRole,
    staffId,
    isArtist,
    isOperationsAdmin,
    canUseArtistView,
    viewMode,
  };
}

export async function getOperationsContext(options: { force?: boolean } = {}): Promise<OperationsContext | null> {
  bindAuthCacheInvalidation();

  if (!options.force && cachedOperationsContext !== undefined) {
    return cachedOperationsContext;
  }

  if (!options.force && pendingOperationsContext) {
    return pendingOperationsContext;
  }

  pendingOperationsContext = loadOperationsContext()
    .then((context) => {
      cachedOperationsContext = context;
      return context;
    })
    .finally(() => {
      pendingOperationsContext = null;
    });

  return pendingOperationsContext;
}

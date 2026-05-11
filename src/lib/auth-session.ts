import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function isRefreshTokenError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("refresh token") || message.includes("invalid refresh");
}

export async function clearStoredAuthSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The local session may already be corrupt. In that case, there is nothing
    // useful to ask Supabase to revoke remotely.
  }
}

export async function getSafeSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await clearStoredAuthSession();
      return null;
    }

    throw error;
  }
}

export async function getSafeUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user;
  } catch (error) {
    if (isRefreshTokenError(error)) {
      await clearStoredAuthSession();
      return null;
    }

    throw error;
  }
}

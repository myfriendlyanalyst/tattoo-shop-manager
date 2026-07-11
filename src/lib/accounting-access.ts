/**
 * Client-side accounting access check.
 *
 * Primary source of truth is public.can_access_accounting(), a security definer
 * SQL function that mirrors the proxy and RLS rules without exposing table reads.
 */

import { supabase } from "@/lib/supabase";

export async function hasAccountingAccess(userId: string): Promise<boolean> {
  const { data: canAccess, error: accessError } = await supabase.rpc("can_access_accounting");
  if (!accessError) {
    return canAccess === true;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role === "owner") return true;

  const { data: acctUserById } = await supabase
    .from("accounting_users")
    .select("active")
    .eq("profile_id", userId)
    .maybeSingle();

  const { data: acctUserByEmail } = acctUserById
    ? { data: null }
    : await supabase
        .from("accounting_users")
        .select("active")
        .ilike("email", user?.email?.toLowerCase() ?? "")
        .maybeSingle();

  const acctUser = acctUserById ?? acctUserByEmail;
  return acctUser?.active === true && (!profile || profile.role === "accounting");
}

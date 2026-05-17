/**
 * Client-side accounting access check.
 *
 * Rules:
 *   - accounting_users.active = true  → allowed
 *   - profiles.role = 'owner'         → always allowed (legacy bypass)
 *
 * The same logic runs in src/proxy.ts (server/Edge).
 * staff_permissions.accountingAccess is no longer used.
 */

import { supabase } from "@/lib/supabase";

export async function hasAccountingAccess(userId: string): Promise<boolean> {
  // Primary: check accounting_users table.
  const { data: acctUser } = await supabase
    .from("accounting_users")
    .select("active")
    .eq("profile_id", userId)
    .maybeSingle();

  if (acctUser?.active === true) return true;

  // Legacy bypass: Tattoo Manager owner role always has accounting access.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "owner";
}

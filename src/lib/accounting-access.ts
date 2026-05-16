/**
 * Shared accounting access check for client-side components.
 *
 * Rules:
 *   - profiles.role = 'owner'  → always allowed
 *   - all other roles           → staff_permissions.accountingAccess must be enabled=true
 *
 * The same logic runs in src/proxy.ts (server/Edge) using the SSR client.
 * This module is for browser client components only.
 */

import { supabase } from "@/lib/supabase";

export async function hasAccountingAccess(userId: string): Promise<boolean> {
  // 1. Fetch the user's app role.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile) return false;

  // Owner always has accounting access, regardless of permissions.
  if (profile.role === "owner") return true;

  // 2. Resolve the staff record linked to this auth user.
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!staffRow) return false;

  // 3. Check the accountingAccess permission key.
  const { data: perm } = await supabase
    .from("staff_permissions")
    .select("enabled")
    .eq("staff_id", staffRow.id)
    .eq("permission_key", "accountingAccess")
    .maybeSingle();

  return perm?.enabled === true;
}

import { supabase } from "@/lib/supabase";

export type OperationsRole = "owner" | "admin" | "artist" | "front_desk" | "accounting" | null;

export type OperationsContext = {
  userId: string;
  email: string;
  role: OperationsRole;
  staffId: string | null;
  isArtist: boolean;
  isOperationsAdmin: boolean;
};

export async function getOperationsContext(): Promise<OperationsContext | null> {
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
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: staffByEmail } = staffByProfileId
    ? { data: null }
    : await supabase
        .from("staff")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

  const role = (profile?.role ?? null) as OperationsRole;

  return {
    userId: user.id,
    email,
    role,
    staffId: staffByProfileId?.id ?? staffByEmail?.id ?? null,
    isArtist: role === "artist",
    isOperationsAdmin: role === "owner" || role === "admin" || role === "front_desk",
  };
}

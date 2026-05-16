import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

// createBrowserClient stores the session in cookies (not localStorage).
// This allows middleware to read the session server-side.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

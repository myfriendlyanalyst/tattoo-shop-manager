import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Paths the proxy must not intercept even for authenticated users.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/force-password-change", "/set-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Pass through Next.js internals, static assets, and API routes.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )
    : supabase;

  // Validate the JWT with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Accounting routes require authentication.
    if (pathname.startsWith("/accounting")) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Operations app handles its own auth; pass through.
    return response;
  }

  // Public paths are reachable even when authenticated.
  if (isPublicPath(pathname)) {
    return response;
  }

  // Look up the authenticated user's accounting_users record.
  // Returns null for regular Tattoo Manager staff (no record).
  const { data: acctUserById } = await adminClient
    .from("accounting_users")
    .select("active, must_change_password, access_level")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: acctUserByEmail } = acctUserById
    ? { data: null }
    : await adminClient
        .from("accounting_users")
        .select("active, must_change_password, access_level")
        .ilike("email", user.email?.toLowerCase() ?? "")
        .maybeSingle();

  const acctUser = acctUserById ?? acctUserByEmail;

  // Force all accounting users to change their temporary password before
  // accessing any page.
  if (acctUser?.must_change_password === true) {
    return NextResponse.redirect(new URL("/force-password-change", request.url));
  }

  // Accounting-only users should not browse the Tattoo Manager app.
  if (acctUser?.active === true && !pathname.startsWith("/accounting")) {
    return NextResponse.redirect(new URL("/accounting/dashboard", request.url));
  }

  // Accounting access check.
  if (pathname.startsWith("/accounting")) {
    // Tattoo Manager owners bypass accounting_users entirely.
    const { data: profileById } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const { data: profileByEmail } = profileById
      ? { data: null }
      : await adminClient
          .from("profiles")
          .select("role")
          .ilike("email", user.email?.toLowerCase() ?? "")
          .maybeSingle();

    const profile = profileById ?? profileByEmail;

    if (profile?.role === "owner") {
      return response;
    }

    // All others must have an active accounting_users record.
    if (acctUser?.active !== true) {
      return NextResponse.redirect(new URL("/requests", request.url));
    }
  }

  return response;
}

export const config = {
  // Match all page routes. Excludes _next internals and favicon handled above.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

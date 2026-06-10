import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Paths the proxy must not intercept even for authenticated users.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/force-password-change",
  "/set-password",
  "/artist-response",
];
const ARTIST_ALLOWED_PREFIX_PATHS = ["/requests", "/projects", "/calendar"];
const ARTIST_ALLOWED_EXACT_PATHS = ["/settings"];
const MANAGER_HOST = "manager.oyabuntattoo.com";
const ACCOUNTING_HOST = "accounting.oyabuntattoo.com";

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Operations paths must leave the accounting host, otherwise the
// accounting-host catch-all bounces them back and a redirect loop forms.
function operationsUrl(pathname: string, request: NextRequest) {
  const url = new URL(pathname, request.url);
  if (url.hostname.toLowerCase() === ACCOUNTING_HOST) {
    url.hostname = MANAGER_HOST;
  }
  return url;
}

function isArtistAllowedPath(pathname: string) {
  return (
    ARTIST_ALLOWED_EXACT_PATHS.includes(pathname) ||
    ARTIST_ALLOWED_PREFIX_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.nextUrl.hostname.toLowerCase();

  // Pass through Next.js internals, static assets, and API routes.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next({ request });
  }

  if (host === MANAGER_HOST && pathname === "/") {
    return NextResponse.redirect(new URL("/requests", request.url));
  }

  if (host === MANAGER_HOST && pathname.startsWith("/accounting")) {
    const accountingUrl = new URL(request.url);
    accountingUrl.hostname = ACCOUNTING_HOST;
    return NextResponse.redirect(accountingUrl);
  }

  if (host === ACCOUNTING_HOST && pathname === "/") {
    return NextResponse.redirect(new URL("/accounting/dashboard", request.url));
  }

  if (
    host === ACCOUNTING_HOST &&
    !pathname.startsWith("/accounting") &&
    !isPublicPath(pathname)
  ) {
    return NextResponse.redirect(new URL("/accounting/dashboard", request.url));
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

    if (host === MANAGER_HOST && !isPublicPath(pathname)) {
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

  const email = user.email?.toLowerCase() ?? "";

  const [acctByIdResult, profileByIdResult, staffByProfileIdResult] = await Promise.all([
    adminClient
      .from("accounting_users")
      .select("active, must_change_password, access_level")
      .eq("profile_id", user.id)
      .maybeSingle(),
    adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    adminClient.from("staff").select("must_change_password").eq("profile_id", user.id).maybeSingle(),
  ]);

  const acctUserById = acctByIdResult.data;
  const profileById = profileByIdResult.data;
  const staffByProfileId = staffByProfileIdResult.data;

  // Fall back to email matching for legacy rows that predate profile_id wiring.
  const [acctByEmailResult, profileByEmailResult, staffByEmailResult] = await Promise.all([
    acctUserById
      ? Promise.resolve({ data: null })
      : adminClient
          .from("accounting_users")
          .select("active, must_change_password, access_level")
          .ilike("email", email)
          .maybeSingle(),
    profileById
      ? Promise.resolve({ data: null })
      : adminClient.from("profiles").select("role").ilike("email", email).maybeSingle(),
    staffByProfileId
      ? Promise.resolve({ data: null })
      : adminClient.from("staff").select("must_change_password").ilike("email", email).maybeSingle(),
  ]);

  const acctUser = acctUserById ?? acctByEmailResult.data;
  const profile = profileById ?? profileByEmailResult.data;
  const staffUser = staffByProfileId ?? staffByEmailResult.data;
  const isOperationsUser = ["owner", "admin", "front_desk", "artist"].includes(profile?.role ?? "");

  // Force temporary-password users to set a permanent password before access.
  if (acctUser?.must_change_password === true || staffUser?.must_change_password === true) {
    return NextResponse.redirect(new URL("/force-password-change", request.url));
  }

  // Accounting-only users should not browse the Tattoo Manager app, but
  // regular operations users with accounting access may still use /requests.
  if (acctUser?.active === true && !isOperationsUser && !pathname.startsWith("/accounting")) {
    return NextResponse.redirect(new URL("/accounting/dashboard", request.url));
  }

  if (profile?.role === "artist" && !isArtistAllowedPath(pathname)) {
    return NextResponse.redirect(operationsUrl("/requests", request));
  }

  // Accounting access check.
  if (pathname.startsWith("/accounting")) {
    // Tattoo Manager admins bypass accounting_users entirely for system management.
    if (profile?.role === "owner" || profile?.role === "admin") {
      return response;
    }

    // All others must have an active accounting_users record.
    if (acctUser?.active !== true) {
      return NextResponse.redirect(operationsUrl("/requests", request));
    }
  }

  return response;
}

export const config = {
  // Match all page routes. Excludes _next internals and favicon handled above.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

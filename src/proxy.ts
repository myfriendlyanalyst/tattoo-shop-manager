import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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

  // getUser() validates the JWT with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Accounting access check ---
  // Rule: profiles.role = 'owner'            → always allowed
  //       all other roles                     → staff_permissions.accountingAccess = true required
  //       (admin is NOT automatically allowed)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Owner always has access.
  if (profile?.role === "owner") {
    return response;
  }

  // For all other roles, check the explicit accountingAccess permission.
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (staffRow) {
    const { data: perm } = await supabase
      .from("staff_permissions")
      .select("enabled")
      .eq("staff_id", staffRow.id)
      .eq("permission_key", "accountingAccess")
      .maybeSingle();

    if (perm?.enabled === true) {
      return response;
    }
  }

  // No access — redirect to operations home.
  return NextResponse.redirect(new URL("/requests", request.url));
}

export const config = {
  matcher: ["/accounting/:path*"],
};

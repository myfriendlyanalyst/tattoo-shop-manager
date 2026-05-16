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

  // Rule: owner always passes; every other role needs active staff + accountingAccess=true.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") {
    return response;
  }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
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

  return NextResponse.redirect(new URL("/requests", request.url));
}

export const config = {
  matcher: ["/accounting/:path*"],
};

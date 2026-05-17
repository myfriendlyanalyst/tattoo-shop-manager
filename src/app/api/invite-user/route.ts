import { NextResponse } from "next/server";

// This endpoint is deprecated.
// Staff invitations via email are no longer used.
//
// Tattoo Manager staff: add records directly in /staff.
// Accounting users: create accounts at /accounting/users (admin only).
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Accounting users are now created at /accounting/users. Tattoo Manager staff are managed directly in /staff without Auth accounts.",
    },
    { status: 410 },
  );
}

# Invite User setup

The Staff page can send Supabase Auth invite emails through `/api/invite-user`.

This route must run on the server with the Supabase service role key. Do not expose this key with
`NEXT_PUBLIC_`.

## Vercel environment variable

Add this variable in Vercel:

```txt
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep the existing public variables too:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://tkblwbahhtnoxbzkgvbb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

## Supabase redirect URLs

In Supabase, go to Authentication > URL Configuration and add the Vercel app URL:

```txt
Site URL:
https://your-vercel-domain.vercel.app

Redirect URLs:
https://your-vercel-domain.vercel.app/**
```

Invited users are sent through:

```txt
https://your-vercel-domain.vercel.app/auth/callback
```

If an invite is sent while running the app locally, the link can point to `localhost`. For external
testing, send invites from the Vercel deployment or set `NEXT_PUBLIC_SITE_URL` to the Vercel URL.

## Staff invitation flow

1. Owner/Admin opens Staff.
2. Click Invite user.
3. Enter display name, email, role, and initial permissions.
4. The API sends a Supabase invite email.
5. The API creates or updates:
   - `profiles`
   - `staff`
   - `staff_permissions`

The invite sender must already have a `profiles.role` of `owner` or `admin`.

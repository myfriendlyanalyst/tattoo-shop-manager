> **DEPRECATED** — The email-invite flow described below is no longer used.
> Accounting users are now created directly at `/accounting/users` (no email required).
> Tattoo Manager staff are managed in `/staff` without Auth account creation.
> The `/api/invite-user` endpoint returns HTTP 410 Gone.

---

# [DEPRECATED] Invite User setup

The Staff page previously sent Supabase Auth invite emails through `/api/invite-user`.

## Replacement

| Use case | New flow |
|---|---|
| Accounting user | Owner/Admin visits `/accounting/users` → Create user → copy one-time temp password → user sets permanent password on first login |
| Tattoo Manager staff | Add staff record in `/staff` (no Auth account needed unless they log in to the ops app) |

## Environment variables still required

`SUPABASE_SERVICE_ROLE_KEY` is still used by `/api/accounting/users` and `/api/accounting/change-password` for the accounting user flow. Keep it configured in Vercel.

```txt
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

## Supabase email templates

The Supabase invite email template is no longer needed. You can leave the default template or remove customisation.

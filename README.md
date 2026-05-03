# Tattoo Shop Manager

Integrated tattoo shop operations app built from the five original static prototypes.

## Current Status

This is the new main app skeleton. It currently uses mock data and does not require Supabase yet.

Included in this first version:

- Next.js app foundation
- Owner/admin dashboard shell
- Main navigation structure
- Request queue preview
- Today sessions preview
- MVP module placeholders
- Next build step checklist

## Product Rules

- Customer request intake is the normal starting point of the workflow.
- Requests come from the public website request form/email flow.
- Artists can enter individual customer sessions and deposits.
- Accounting, payout, and shop-wide revenue views belong in a separate owner/admin app.
- The operations app stores session/deposit entries in the shared database, but does not show shop-wide accounting screens.

## Planned Stack

- Next.js
- Supabase for database, authentication, and file storage
- Vercel for hosting

## Local Development

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Next Steps

1. Create a Supabase project.
2. Run the schema from `../supabase_schema.sql`.
3. Add Supabase environment variables.
4. Connect authentication and staff roles.
5. Replace mock dashboard data with real database queries.
6. Create the separate `tattoo-shop-accounting` app for owner/admin reporting.

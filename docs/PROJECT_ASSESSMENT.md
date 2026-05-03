# Tattoo Shop Management App - Initial Assessment

Date: 2026-05-03

## Repository Summary

The GitHub account `masteryushi-Oyabun` contains five public repositories. All five are small static JavaScript prototypes: each repository has only `index.html`, `styles.css`, and `app.js` files, with no `package.json`, backend server, database schema, authentication service, or deployment configuration.

## Current Repositories

| Repository | Apparent feature | Current storage | Notes |
| --- | --- | --- | --- |
| `Admin--log-in` | Employee/admin management | `localStorage` | Hard-coded demo login, employee records, permissions, drag ordering |
| `customer-data-base` | Customer database and project/session tracking | `localStorage` | Client profiles, projects, deposits, waiver status, sessions |
| `Artist-session-log-in` | Artist run/session entry flow | `localStorage` | Artist login, session/deposit entry, receipt display, local submission history |
| `Artist-acounting-log-in-` | Artist accounting and payout dashboard | In-memory sample data | Reports, invoice summaries, paid status dialogs, print preview |
| `request---email---tracking` | Request/email tracking dashboard | `localStorage` | Request statuses, artist assignment, thread/timeline display |

## Important Findings

- These repositories are not production applications yet. They are static prototypes.
- Login is not secure. Credentials such as `admin / 1234` and artist passwords are hard-coded in JavaScript.
- Data is stored in browser `localStorage` or hard-coded arrays, so it stays only on one browser/device.
- There is no shared data model across the five apps.
- There is no real database, API, user account system, permission enforcement, file upload, audit log, backup, or deployment setup.
- The prototypes are still useful because they describe the intended business workflows and screen ideas.

## Recommended Direction

Build one integrated application rather than trying to run five separate apps.

Recommended stack for a non-developer-maintainable project:

- App: Next.js
- Database/auth/file storage: Supabase
- Hosting: Vercel
- Source control: one main GitHub repository

## Suggested Modules For The Integrated App

- Authentication and roles: owner/admin/artist/front desk
- Staff and permissions
- Customer profiles
- Tattoo projects
- Appointments and sessions
- Deposits and payments
- Artist accounting and payout status
- Request/email intake tracking
- Waiver/document/photo storage

## Suggested First Build Milestone

The first real version should focus on shared data and core workflows:

1. Create one new integrated app repository.
2. Define Supabase tables for staff, customers, projects, appointments/sessions, payments, deposits, and requests.
3. Implement real login and role-based access.
4. Migrate the strongest UI pieces from the prototypes into one navigation structure.
5. Replace `localStorage` with database-backed create/read/update/delete flows.

## Practical Interpretation

Treat the existing five repositories as UI prototypes and workflow references, not as five production systems to connect directly. The safest path is to use them as a blueprint while building a clean single app with a real backend.

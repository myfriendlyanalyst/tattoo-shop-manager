# Integrated Tattoo Shop Management App Plan

Date: 2026-05-03

## Product Goal

Build one production-ready tattoo shop operations app from the five existing static prototypes, plus a separate owner/admin-only accounting app that uses the same database.

The existing repositories should be treated as UI and workflow references. The new system should have one shared database and one login system, but two app surfaces:

- `tattoo-shop-manager`: daily operations, request intake, customers, projects, scheduling, and artist entry
- `tattoo-shop-accounting`: owner/admin-only accounting, revenue reporting, and payout management

## Recommended Stack

- Framework: Next.js for both apps
- Database/Auth/File Storage: Supabase
- Hosting: Vercel
- Repository model: preferably two app folders or two repositories, both connected to the same Supabase project

This keeps the system simple enough for Code x-assisted maintenance while still providing a real database, authentication, file storage, and deployment path.

## Main Navigation

1. Dashboard
2. Requests
3. Customers
4. Calendar / Sessions
5. Artist Entry
6. Staff / Permissions
7. Settings

Accounting is intentionally not part of the main operations app navigation. It belongs in the separate `tattoo-shop-accounting` app.

## User Roles

| Role | Purpose |
| --- | --- |
| Owner | Full access to all operations plus the separate accounting app |
| Admin / Manager | Manage customers, requests, appointments, deposits, sessions, staff operations, and accounting if explicitly allowed |
| Artist | Enter own sessions/deposits and view assigned customers/appointments only |
| Front Desk | Manage requests, customers, scheduling, deposits, and communication status |

Important access rule: accounting, payout, and shop-wide revenue views are only available in the separate accounting app for owner/admin users. Artists can enter amounts for individual customer sessions or deposits, but they should not see total shop revenue, other artists' revenue, payout reports, or accounting dashboards.

## Primary Workflow

The normal process starts with a website request form.

1. A customer submits the request form on the public website.
2. The submission arrives by email or is imported into `requests`.
3. Front desk/admin reviews the request, assigns an artist, and tracks replies.
4. A request can become a consultation, customer profile, tattoo project, appointment, and deposit.
5. Artists enter session/deposit results for their own appointments.
6. Owner/admin reviews accounting and payout data in the separate accounting app.

## Core Data Model

### `profiles`

Extends Supabase Auth users.

- `id`
- `email`
- `display_name`
- `role`
- `active`
- `created_at`

### `staff`

Business staff/artist records.

- `id`
- `profile_id`
- `display_name`
- `legal_name`
- `role`
- `phone`
- `email`
- `address`
- `start_date`
- `active`
- `notes`
- `created_at`

### `staff_permissions`

- `id`
- `staff_id`
- `permission_key`
- `enabled`

Permission keys from the prototype:

- `artistSchedule`
- `session`
- `deposit`
- `merch`
- `accounting`
- `staffAdmin`

### `customers`

- `id`
- `name`
- `phone`
- `email`
- `notes`
- `created_at`
- `created_by`

### `projects`

A customer can have multiple tattoo projects, possibly with different artists.

- `id`
- `customer_id`
- `artist_id`
- `subject`
- `size`
- `session_type`
- `waiver_signed`
- `status`
- `memo`
- `created_at`

Suggested statuses:

- `lead`
- `consultation`
- `booked`
- `in_progress`
- `completed`
- `cancelled`

### `appointments`

Scheduled work items.

- `id`
- `project_id`
- `artist_id`
- `starts_at`
- `ends_at`
- `appointment_type`
- `status`
- `notes`
- `created_at`

Prototype appointment types:

- `Walk-in`
- `One-Done`
- `On-Going`
- `Closing`

### `session_entries`

Actual session/transaction entries submitted by artists.

- `id`
- `appointment_id`
- `project_id`
- `artist_id`
- `customer_id`
- `entry_type`
- `tattoo_amount`
- `tattoo_payment_method`
- `tip_amount`
- `tip_payment_method`
- `memo`
- `entered_at`
- `created_by`

Entry types:

- `Session`
- `Deposit`
- `Merch`

### `deposits`

Deposit records connected to projects and optionally used on sessions.

- `id`
- `project_id`
- `customer_id`
- `artist_id`
- `amount`
- `payment_method`
- `received_at`
- `available`
- `used_at`
- `used_session_entry_id`
- `memo`
- `created_at`

### `payouts`

Tracks whether sales/deposits/tips have been paid out or reconciled.

- `id`
- `artist_id`
- `period_start`
- `period_end`
- `status`
- `paid_at`
- `paid_by`
- `notes`

### `payout_items`

- `id`
- `payout_id`
- `session_entry_id`
- `amount`
- `payment_method`
- `item_type`

### `requests`

Email/request intake tracking.

- `id`
- `customer_id`
- `client_name`
- `email`
- `phone`
- `subject`
- `artist_id`
- `status`
- `priority`
- `received_at`
- `forwarded_at`
- `artist_reply_at`
- `client_reply_at`
- `consultation_at`
- `booked_at`
- `notes`
- `created_at`

Prototype request statuses:

- `New`
- `Forwarded`
- `Artist Replied`
- `Client Replied`
- `Consultation`
- `Booked`
- `Client Waiting for Reply`
- `No Answer`
- `Denied`

### `files`

For reference images, waivers, before/after photos, and documents.

- `id`
- `customer_id`
- `project_id`
- `request_id`
- `uploaded_by`
- `file_type`
- `storage_path`
- `created_at`

## MVP Scope

The first build should avoid trying to reproduce every screen at once. The best MVP is:

1. Real login with owner/admin/artist roles.
2. Staff and artist records.
3. Customer profiles.
4. Tattoo projects under each customer.
5. Artist session/deposit entry.
6. Request tracker as the lead intake starting point.
7. Send session/deposit data to the shared database so the separate accounting app can report on it.

## What To Reuse From Existing Prototypes

| Existing prototype | Reuse as |
| --- | --- |
| `Admin--log-in` | Staff fields, permission labels, admin screen reference |
| `customer-data-base` | Customer/project/session/deposit workflow reference |
| `Artist-session-log-in` | Artist entry flow and receipt-style confirmation reference |
| `Artist-acounting-log-in-` | Separate accounting app layout and payout workflow reference |
| `request---email---tracking` | Request statuses, timeline, email tracking dashboard reference |

## Implementation Phases

### Phase 1 - Foundation

- Create new Next.js app.
- Connect Supabase.
- Configure Auth.
- Create initial database schema.
- Add seed data matching the prototype artists and sample records.

### Phase 2 - Internal Operations

- Staff list and permissions.
- Customer list and profile.
- Project CRUD.
- Session and deposit entry.

### Phase 3 - Request Intake

- Request tracker.
- Status timeline.
- Assign request to artist.
- Convert request into customer/project.

### Phase 4 - Separate Accounting App

- Create `tattoo-shop-accounting`.
- Daily sales report for owner/admin only.
- Artist summary for owner/admin only.
- Invoice/payout view for owner/admin only.
- Mark item or period as paid.

### Phase 5 - Polish and Deployment

- Role-based navigation.
- File uploads for waivers/photos/references.
- Audit/history log for critical edits.
- Vercel deployment.
- Supabase backup/checklist.

## Near-Term Next Step

Create the new integrated app skeleton, then implement the database schema before migrating UI. The database model should lead the work because the current blocker is shared data, not screens.

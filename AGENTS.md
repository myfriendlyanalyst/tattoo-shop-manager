<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared project context

Before planning or implementing any ticket, read the following files:

- `CONTEXT.md` — domain language, business concepts, and agreed rules
- `docs/PRODUCT_DIRECTION.md` — product problem, users, scope, priorities, and success criteria
- `docs/IMPLEMENTATION_AUDIT.md` — audited current implementation, gaps, risks, and preservation guidance
- `docs/EXECUTION_BACKLOG.md` — epic and ticket definitions, dependencies, acceptance criteria, and implementation order
- `docs/OWNER_CONFIRMATION.md` — owner-confirmed decisions, unresolved decisions, and deferred details

Use these documents as shared project memory across separate chats. Do not rely on a previous chat being available.

For ticket work:

1. Find the requested ticket in `docs/EXECUTION_BACKLOG.md` and keep the work within its stated purpose, scope, acceptance criteria, and dependencies.
2. Inspect the current code and schema before changing them. The audit records a point-in-time assessment and does not replace verification against the repository.
3. Preserve unrelated user changes and do not expand the ticket into adjacent features without explicit direction.
4. Distinguish an implemented behavior from an approved product requirement. Existing behavior is not automatically the desired behavior.
5. If the documents, code, deployed state, or current user request conflict, do not silently guess. Follow the current explicit user request, state the conflict, and identify any product or owner decision still required.
6. Do not delete or replace legacy behavior until the replacement is implemented, verified, and the ticket explicitly permits removal.

## Database changes

- Use `supabase/migrations` for all new DB changes. `docs/*.sql` are historical references, not a deployment sequence.
- Read `docs/DATABASE_MIGRATIONS.md` and `supabase/legacy-inventory.json` before DB work. FND-01 migrations 1–8 have passed a fresh local replay and catalog comparison with explicitly reviewed differences. Preserve this verified baseline; add forward migrations.
- Never apply the reconstruction chain to an existing database or mark migrations applied without evidence of equivalent deployed definitions.
- Preserve applied migration files; add forward migrations. Register migration versions/checksums and run `node scripts/db/check-migrations.mjs`.

## Ticket completion

When a requested ticket is fully implemented:

1. Run the relevant tests, lint, build, and migration verification for the changed scope.
2. Stage only files that belong to the ticket and preserve unrelated user changes.
3. Commit with a ticket-specific message and push the commit to `origin/main`.
4. Report the commit hash, push result, verification performed, and any deployment or migration step that remains separate from Git push.

If verification fails, the branch has diverged, a conflict exists, sensitive data may be included, or safe deployment requires an unresolved decision, stop before commit or push and report the blocker.

After completing the requested work, consult `docs/EXECUTION_BACKLOG.md` and the recorded dependencies, then state the single next recommended ticket or operational step and why it is next. Distinguish implementation, Git push, application deployment, and production database migration. Recommend the next work without starting it unless the user asks to continue.

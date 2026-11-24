import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261124000009_financial_audit_and_locks.sql",
  import.meta.url,
);
const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

test("financial audit events are append-only and capture required fields", () => {
  for (const field of [
    "actor_id uuid",
    "action text not null",
    "entity_type text not null",
    "entity_id uuid not null",
    "before_value jsonb",
    "after_value jsonb",
    "reason text not null",
    "occurred_at timestamptz not null",
  ]) {
    assert.match(sql, new RegExp(field.replaceAll(" ", "\\s+")));
  }

  assert.match(sql, /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.financial_audit_events/);
  assert.match(sql, /security\s+definer[\s\S]*insert\s+into\s+public\.financial_audit_events/);
});

test("every current financial table receives audit and lock triggers", () => {
  for (const table of [
    "session_entries",
    "session_payments",
    "deposits",
    "deposit_applications",
    "payouts",
    "payout_items",
  ]) {
    assert.match(sql, new RegExp(`'${table}'`));
  }

  assert.match(sql, /before\s+insert\s+or\s+update\s+or\s+delete/);
  assert.match(sql, /after\s+insert\s+or\s+update\s+or\s+delete/);
  assert.match(sql, /status\s+in\s*\('ready',\s*'paid'\)/);
  assert.match(sql, /old\.status\s*=\s*'ready'[\s\S]*new\.status\s*=\s*'paid'/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261124000010_session_completion.sql",
  import.meta.url,
);
const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

test("Session Completion and Record Completion are stored separately", () => {
  assert.match(sql, /appointments[\s\S]*add\s+column\s+session_completed_at\s+timestamptz/);
  assert.match(sql, /session_entries[\s\S]*add\s+column\s+record_status\s+text/);
  assert.match(sql, /record_status\s+in\s*\('draft',\s*'complete'\)/);
});

test("existing completed work is backfilled", () => {
  assert.match(sql, /from\s+public\.session_entries[\s\S]*group\s+by\s+appointment_id/);
  assert.match(sql, /where\s+status\s*=\s*'completed'\s+and\s+session_completed_at\s+is\s+null/);
});

test("a complete record requires Session Completion", () => {
  assert.match(sql, /new\.record_status\s*=\s*'complete'[\s\S]*appointment\.session_completed_at\s+is\s+not\s+null/);
  assert.match(sql, /session_entries_enforce_record_completion/);
  assert.match(sql, /appointments_enforce_session_completion/);
});

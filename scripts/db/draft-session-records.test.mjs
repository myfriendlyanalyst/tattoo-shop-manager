import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261124000011_draft_session_records.sql",
  import.meta.url,
);
const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

test("complete Session Records require amounts and Payment Methods", () => {
  assert.match(sql, /tattoo_amount[\s\S]*<=\s*0[\s\S]*tip_amount[\s\S]*<=\s*0/);
  assert.match(sql, /tattoo_amount[\s\S]*>\s*0[\s\S]*tattoo_payment_method\s+is\s+null/);
  assert.match(sql, /tip_amount[\s\S]*>\s*0[\s\S]*tip_payment_method\s+is\s+null/);
});

test("draft records remain incomplete financial facts", () => {
  assert.match(sql, /new\.record_status\s*=\s*'draft'[\s\S]*record_completed_at\s*:=\s*null/);
  assert.match(sql, /from\s+public\.session_entries\s+se[\s\S]*where\s+se\.record_status\s*=\s*'complete'/);
  assert.match(sql, /session_entries_open_drafts_idx/);
});

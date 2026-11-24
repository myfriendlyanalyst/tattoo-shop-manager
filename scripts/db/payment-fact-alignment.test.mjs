import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20261124000012_payment_fact_alignment.sql", import.meta.url),
  "utf8",
).toLowerCase();

test("SES-03 records provider, processing time, and fee override evidence", () => {
  assert.match(sql, /add column app_provider text/);
  assert.match(sql, /add column processed_at timestamptz/);
  assert.match(sql, /card_fee_rate_override/);
  assert.match(sql, /card_fee_override_reason/);
  assert.match(sql, /square_transaction_id/);
});

test("SES-03 preserves legacy App facts without inventing a provider", () => {
  assert.match(sql, /then 'legacy_unknown'/);
  assert.match(sql, /new app payments require venmo or zelle/);
});

test("SES-03 validates all Session amount categories before completion", () => {
  assert.match(sql, /payment_type = 'merchandise'/);
  assert.match(sql, /tattoo_paid \+ deposit_applied/);
  assert.match(sql, /tip_paid <>/);
  assert.match(sql, /merchandise_paid <>/);
  assert.match(sql, /session_entries_validate_payment_totals/);
});

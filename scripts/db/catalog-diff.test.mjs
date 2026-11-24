import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareCatalogs } from './catalog-diff.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
const production = read('snapshots/production-catalog-20261123.json');
const local = read('snapshots/local-catalog-20261124.json');
const reviewed = read('reviewed-differences.json').differences;
const unresolved = (actual) => compareCatalogs(production, actual, reviewed).filter((change) => !change.reviewed);

test('raw replay differences stay visible unless explicitly reviewed', () => {
  assert.equal(compareCatalogs(production, local).length, 90);
  assert.equal(unresolved(local).length, 0);
  assert.equal(compareCatalogs(production, production).length, 0);
});
test('new policy behavior cannot be hidden by the reviewed schema differences', () => {
  const changed = structuredClone(local);
  changed.policies[0].qual = 'true';
  assert.ok(unresolved(changed).some((change) => change.section === 'policies' && change.field === 'qual'));
});
test('new column type and missing column both fail', () => {
  const changed = structuredClone(local);
  changed.columns.find((row) => row.table === 'deposits' && row.name === 'amount').type = 'text';
  assert.ok(unresolved(changed).some((change) => change.key === 'deposits.amount' && change.field === 'type'));
  changed.columns = changed.columns.filter((row) => !(row.table === 'customers' && row.name === 'address'));
  assert.ok(unresolved(changed).some((change) => change.key === 'customers.address' && change.kind === 'missing'));
});
test('later changes to a previously reviewed function still fail', () => {
  const changed = structuredClone(local);
  changed.functions.find((row) => row.name === 'can_access_accounting').definition += '\n-- unexpected change';
  assert.ok(unresolved(changed).some((change) => change.key === 'can_access_accounting()'));
});
test('future Vault versions and new column positions require another review', () => {
  const changed = structuredClone(local);
  changed.extensions.find((row) => row.name === 'supabase_vault').version = '9.0.0';
  changed.columns.find((row) => row.table === 'customers' && row.name === 'email').position = 99;
  assert.ok(unresolved(changed).some((change) => change.key === 'supabase_vault'));
  assert.ok(unresolved(changed).some((change) => change.key === 'customers.email'));
});
test('incomplete or duplicate catalog rows cannot silently pass', () => {
  const changed = structuredClone(local);
  changed.policies.push(structuredClone(changed.policies[0]));
  assert.throws(() => unresolved(changed), /Duplicate catalog identity/);
  assert.throws(() => compareCatalogs(production, {}), /Missing snapshot section/);
});

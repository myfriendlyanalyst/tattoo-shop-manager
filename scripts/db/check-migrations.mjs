import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const hash = (value) => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const inventory = JSON.parse(read('supabase/legacy-inventory.json'));
if (inventory.snapshot) {
  assert.equal(hash(read(inventory.snapshot.file)), inventory.snapshot.sha256, 'Captured production catalog changed');
}
if (inventory.localReplay) {
  assert.equal(hash(read(inventory.localReplay.file)), inventory.localReplay.sha256, 'Local replay evidence changed');
  const review = JSON.parse(read('supabase/reviewed-differences.json'));
  assert.equal(review.expectedSnapshotSha256, inventory.snapshot.sha256, 'Reviewed differences use another production snapshot');
  assert.equal(review.localSnapshotSha256, inventory.localReplay.sha256, 'Reviewed differences use another local replay');
}
const expected = inventory.migrations.map(({ file }) => file);
const actual = readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
assert.deepEqual(actual, expected, 'Every migration must be registered in ordered inventory');
assert.equal(new Set(actual.map((file) => file.split('_')[0])).size, actual.length, 'Duplicate migration versions');
for (const entry of inventory.migrations) {
  assert.match(entry.file, /^\d{14}_[a-z0-9_]+\.sql$/);
  assert.equal(hash(read(`supabase/migrations/${entry.file}`)), entry.sha256, `Migration changed: ${entry.file}`);
}
const legacyFiles = readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.sql')).map((f) => `docs/${f}`).sort();
assert.deepEqual(inventory.legacy.map(({ source }) => source).sort(), legacyFiles, 'Every legacy SQL file needs an inventory entry');
assert.equal(new Set(inventory.legacy.map(({ source }) => source)).size, legacyFiles.length, 'Duplicate legacy inventory entries');
for (const entry of inventory.legacy) {
  assert.ok(['applied', 'pending', 'superseded', 'excluded'].includes(entry.status));
  assert.equal(hash(read(entry.source)), entry.sourceSha256, `Legacy source changed; review inventory: ${entry.source}`);
  if (entry.migration) {
    assert.ok(expected.includes(entry.migration), `Unknown migration for ${entry.source}`);
    assert.ok(read(`supabase/migrations/${entry.migration}`).includes(`-- BEGIN legacy source: ${entry.source}`));
  }
  if (entry.status === 'applied') assert.ok(entry.evidence, 'Applied status requires evidence');
}
const baseline = read(`supabase/migrations/${actual[0]}`);
assert.ok(!baseline.includes('insert into public.staff ('), 'Do not seed staff in schema baseline');
console.log(`OK: ${actual.length} migration checksums and ${legacyFiles.length} legacy sources. SQL execution and live equivalence are NOT verified by this check.`);

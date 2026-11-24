import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { compareCatalogs } from './catalog-diff.mjs';

const [expectedFile, actualFile, ...options] = process.argv.slice(2);
const usage = 'Usage: node scripts/db/compare-snapshots.mjs expected.json actual.json [--reviewed rules.json] [--json-output report.json]';
assert.ok(expectedFile && actualFile && options.length % 2 === 0, usage);
const settings = {};
for (let index = 0; index < options.length; index += 2) {
  assert.ok(['--reviewed', '--json-output'].includes(options[index]), usage);
  assert.ok(!settings[options[index]], 'Duplicate comparison option');
  settings[options[index]] = options[index + 1];
}
const read = (file) => readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const expectedText = read(expectedFile);
const expected = JSON.parse(expectedText);
const actual = JSON.parse(read(actualFile));
let reviewed = [];
if (settings['--reviewed']) {
  const rules = JSON.parse(read(settings['--reviewed']));
  const digest = createHash('sha256').update(expectedText.replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(rules.expectedSnapshotSha256, digest, 'Reviewed differences belong to another production snapshot');
  reviewed = rules.differences;
}
const changes = compareCatalogs(expected, actual, reviewed);
const unreviewed = changes.filter((change) => !change.reviewed);
const accepted = changes.filter((change) => change.reviewed);
for (const change of unreviewed) console.log(`UNREVIEWED [${change.section}] ${change.key}${change.field ? `.${change.field}` : ''}: ${JSON.stringify(change)}`);
const summary = { unreviewed: unreviewed.length, reviewedFields: accepted.length,
  reviewedObjects: new Set(accepted.map((change) => `${change.section}:${change.key}`)).size };
console.log(`${summary.unreviewed} unreviewed differences; ${summary.reviewedFields} explicitly reviewed field differences across ${summary.reviewedObjects} objects. No data compared.`);
if (settings['--json-output']) writeFileSync(settings['--json-output'], JSON.stringify({ summary, changes }, null, 2) + '\n');
process.exitCode = unreviewed.length ? 1 : 0;

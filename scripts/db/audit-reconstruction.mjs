// Static coverage of the known reconstruction SQL. This is not a PostgreSQL parser,
// SQL execution test or proof of equivalence. Run compare-snapshots after db reset.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const inventory = JSON.parse(read('supabase/legacy-inventory.json'));
const live = JSON.parse(read(inventory.snapshot.file));
const sql = inventory.migrations.map(({ file }) => read(`supabase/migrations/${file}`)).join('\n');
const clean = sql.replace(/--[^\n]*/g, '');
const identifiers = (regex) => [...clean.matchAll(regex)].map((m) => m[1]);
const unique = (values) => [...new Set(values)].sort();
const failures = [];
const check = (description, expected, actual) => {
  try { assert.deepEqual(actual, expected); console.log(`PASS: ${description}`); }
  catch { failures.push(description); console.error(`FAIL: ${description}\nexpected ${JSON.stringify(expected)}\nactual   ${JSON.stringify(actual)}`); }
};

check('25 public table names', live.relations.filter((r) => r.kind === 'r').map((r) => r.name).sort(),
  unique(identifiers(/create table if not exists public\.(\w+)/gi)));
check('public view names', live.relations.filter((r) => r.kind === 'v').map((r) => r.name).sort(),
  unique(identifiers(/create or replace view public\.(\w+)/gi)));
check('tables with RLS enabled', live.relations.filter((r) => r.rls).map((r) => r.name).sort(),
  unique(identifiers(/alter table public\.(\w+) enable row level security/gi)));

for (const type of unique(live.enums.map((e) => e.type))) {
  const base = new RegExp(`create type public\\.${type} as enum \\(([\\s\\S]*?)\\);`, 'i').exec(clean);
  const labels = base ? [...base[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  for (const match of clean.matchAll(new RegExp(`alter type public\\.${type}\\s+add value if not exists '([^']+)'`, 'gi'))) {
    if (!labels.includes(match[1])) labels.push(match[1]);
  }
  check(`enum labels and order: ${type}`, live.enums.filter((e) => e.type === type).map((e) => e.label), labels);
}

// Track CREATE/DROP in file order rather than counting obsolete intermediate policies.
const policies = new Set();
for (const m of clean.matchAll(/(create policy|drop policy if exists) "([^"]+)"\s+on\s+(public|storage)\.(\w+)/gi)) {
  const key = `${m[3]}.${m[4]}:${m[2]}`;
  if (m[1].toLowerCase() === 'create policy') policies.add(key); else policies.delete(key);
}
check('final public/app storage policy names', live.policies.map((p) => `${p.schemaname}.${p.tablename}:${p.policyname}`).sort(), [...policies].sort());

const triggers = new Set();
for (const m of clean.matchAll(/(?:create trigger (\w+)\s+(?:before|after)[\s\S]*?on public\.(\w+)|drop trigger if exists (\w+)\s+on public\.(\w+))/gi)) {
  if (m[1]) triggers.add(`${m[2]}:${m[1]}`); else triggers.delete(`${m[4]}:${m[3]}`);
}
check('final trigger names', live.triggers.map((t) => `${t.table}:${t.name}`).sort(), [...triggers].sort());
check('function names', unique(live.functions.map((f) => f.name)),
  unique(identifiers(/create or replace function public\.(\w+)\(/gi)));

// Column name coverage only; keep multiline CHECK expressions out of the field list.
const columns = new Map();
for (const m of clean.matchAll(/create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  const names = [...m[2].matchAll(/^\s+(\w+)\s+(?:uuid|text|boolean|bigint|smallint|integer|date|timestamptz|numeric|time|jsonb|public\.\w+)\b/gmi)].map((field) => field[1]);
  if (!columns.has(m[1])) columns.set(m[1], new Set(names));
}
for (const m of clean.matchAll(/alter table public\.(\w+)\s+([\s\S]*?);/gi)) {
  for (const field of m[2].matchAll(/add column if not exists (\w+)\s/gi)) {
    assert.ok(columns.has(m[1]), `ALTER before CREATE: ${m[1]}`);
    columns.get(m[1]).add(field[1]);
  }
}
const actualNames = [...columns].flatMap(([table, names]) => [...names].map((name) => `${table}.${name}`)).sort();
const liveTableNames = live.columns.filter((c) => columns.has(c.table)).map((c) => `${c.table}.${c.name}`).sort();
check('public table column names (excludes view fields)', liveTableNames, actualNames);

const optionalFields = ['customers.address', 'customers.phone_normalized', 'deposits.disposition', 'deposits.used_session_entry_id',
  'payouts.adjustment_amount', 'payouts.adjustment_note', 'payouts.calculation_snapshot', 'payouts.snapshot_at', 'payouts.artist_earnings', 'payouts.settlement_amount'];
check('all documented missing-column fallbacks exist in the captured DB', optionalFields, optionalFields.filter((field) => liveTableNames.includes(field)));
console.log(`Captured: ${live.relations.length} relations, ${live.columns.length} columns, ${live.constraints.length} constraints, ${live.indexes.length} indexes, ${live.policies.length} policies, ${live.grants.length} ACL entries.`);
console.log('NOT VERIFIED: SQL execution, column types/defaults/order, constraint/index definitions, policy/function semantics, effective privileges, full Supabase replay or snapshot exclusions.');
process.exitCode = failures.length ? 1 : 0;

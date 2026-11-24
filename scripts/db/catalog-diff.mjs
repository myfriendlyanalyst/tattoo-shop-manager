import assert from 'node:assert/strict';

export const identity = {
  relations: (r) => r.name,
  columns: (r) => `${r.table}.${r.name}`,
  constraints: (r) => `${r.table}.${r.name}`,
  indexes: (r) => `${r.schemaname}.${r.tablename}.${r.indexname}`,
  functions: (r) => `${r.name}(${r.arguments})`,
  triggers: (r) => `${r.table}.${r.name}`,
  policies: (r) => `${r.schemaname}.${r.tablename}.${r.policyname}`,
  enums: (r) => `${r.type}.${r.label}`,
  grants: (r) => `${r.object}:${r.grantee}:${r.privilege}`,
  extensions: (r) => r.name,
  sequences: (r) => r.name,
  buckets: (r) => r.id,
};

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function compareCatalogs(expected, actual, reviewed = []) {
  const changes = [];
  const rules = new Map();
  for (const rule of reviewed) {
    assert.ok(rule.reason?.trim(), 'Each reviewed difference needs a reason');
    assert.ok(Object.hasOwn(identity, rule.section), 'Unknown reviewed section');
    const id = canonical([rule.section, rule.key, rule.field]);
    assert.ok(!rules.has(id), `Duplicate reviewed difference: ${id}`);
    rules.set(id, rule);
  }
  for (const [section, keyFor] of Object.entries(identity)) {
    const index = (catalog) => {
      assert.ok(Array.isArray(catalog[section]), `Missing snapshot section: ${section}`);
      const map = new Map();
      for (const row of catalog[section]) {
        const key = keyFor(row);
        assert.ok(!map.has(key), `Duplicate catalog identity: ${section}/${key}`);
        map.set(key, row);
      }
      return map;
    };
    const left = index(expected);
    const right = index(actual);
    for (const key of new Set([...left.keys(), ...right.keys()])) {
      if (!left.has(key) || !right.has(key)) {
        changes.push({ section, key, field: null, kind: left.has(key) ? 'missing' : 'extra',
          expected: left.get(key) ?? null, actual: right.get(key) ?? null, reviewed: false });
        continue;
      }
      const before = left.get(key);
      const after = right.get(key);
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (canonical(before[field]) === canonical(after[field])) continue;
        const rule = rules.get(canonical([section, key, field]));
        // Bind each exception to exact values; never strip SQL whitespace or ignore a field globally.
        const accepted = Boolean(rule && Object.hasOwn(before, field) && Object.hasOwn(after, field)
          && canonical(rule.expected) === canonical(before[field]) && canonical(rule.actual) === canonical(after[field]));
        changes.push({ section, key, field, kind: 'changed', expected: before[field] ?? null,
          actual: after[field] ?? null, reviewed: accepted, ...(accepted ? { reason: rule.reason } : {}) });
      }
    }
  }
  return changes;
}

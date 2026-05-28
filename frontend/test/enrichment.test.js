import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEnrichmentIndex } from '../src/data/fencerInfo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const info = JSON.parse(readFileSync(resolve(__dirname, '../../ingest/fencers.json'), 'utf8'));
const idx = buildEnrichmentIndex(info);

// Each key must resolve to the record actually named that way — not a sibling
// whose record carries the key as a stray alias (licence mix-ups in the source
// XML). Values are the correct person + DOB year.
const expected = {
  'daniel gourley': ['Daniel Gourley', 2007],
  'craig chong': ['Craig Chong', 2006],
  'milo henshaw': ['Milo Henshaw', 2006],
  'luke boyd': ['Luke Boyd', 2008],
  'tim wang': ['Tim Wang', 2004],
  'stacy chong': ['Stacy Chong', 2008],
};

for (const [key, [name, dob]] of Object.entries(expected)) {
  test(`enrichment "${key}" resolves to the right person, not a sibling`, () => {
    const rec = idx[key];
    assert.ok(rec, `${key} present`);
    assert.equal(rec.display_name, name);
    assert.equal(rec.dob_year, dob);
  });
}

test('a record always wins its own canonical name key', () => {
  // No key should resolve to a record whose display_name differs, UNLESS no
  // record is literally named that key (nicknames like "charlie"/"charles").
  let foreignWins = 0;
  for (const [key, rec] of Object.entries(idx)) {
    const ownerExists = info.some(
      (r) => (r.name_keys || []).some((k) => k.trim().toLowerCase().replace(/\s+/g, ' ') === key)
        && r.display_name.trim().toLowerCase().replace(/\s+/g, ' ') === key,
    );
    if (ownerExists && rec.display_name.trim().toLowerCase().replace(/\s+/g, ' ') !== key) foreignWins++;
  }
  assert.equal(foreignWins, 0, 'a canonically-named owner should never lose its key to a sibling');
});

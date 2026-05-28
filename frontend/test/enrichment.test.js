import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEnrichmentIndex, genderFromEnrichment } from '../src/data/fencerInfo.js';

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

// Same person split into two records by a data-entry typo on one DOB. The
// impossible year (Chantelle May as 2018 — she holds a national foil ranking,
// so she can't be 6) is activity-implausible and must lose to the real 2004.
test('an activity-implausible DOB is demoted (Chantelle May → 2004, not 2018)', () => {
  const rec = idx['chantelle may'];
  assert.ok(rec);
  assert.equal(rec.dob_year, 2004);
});

// The fix must be surgical: a genuine namesake whose DOBs are both plausible
// is left alone. "James McKenzie" is a 1977 veteran and a 1997 senior; the
// veteran-consistent 1977 record should keep the key, unchanged by the guard.
test('plausible namesake DOBs are not disturbed (James McKenzie stays 1977)', () => {
  const rec = idx['james mckenzie'];
  assert.ok(rec);
  assert.equal(rec.dob_year, 1977);
});

// Gender fallback for mixed-event-only fencers, from registry ranking keys.
test('genderFromEnrichment reads gender from FNZ ranking keys', () => {
  assert.equal(genderFromEnrichment({ rankings: { foil_W: {} } }), 'W');
  assert.equal(genderFromEnrichment({ rankings: { epee_M: {}, foil_M: {} } }), 'M');
  assert.equal(genderFromEnrichment({ rankings: { foil_W: {}, epee_M: {} } }), null); // straddles
  assert.equal(genderFromEnrichment({ rankings: {} }), null);
  assert.equal(genderFromEnrichment(null), null);
});

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

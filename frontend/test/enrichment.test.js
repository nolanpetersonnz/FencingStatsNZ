import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEnrichmentIndex, genderFromEnrichment, ageEligible, displayBirthYear } from '../src/data/fencerInfo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const info = JSON.parse(readFileSync(resolve(__dirname, '../../ingest/fencers.json'), 'utf8'));
const idx = buildEnrichmentIndex(info);

// Each key must resolve to the record actually named that way — not a sibling
// whose record carries the key as a stray alias (licence mix-ups in the source
// XML). Values are the correct person plus their DOB year or, for anyone
// possibly under 18 (the public file withholds their year), the Cadet/Junior
// eligibility that replaced it.
const expected = {
  'daniel gourley': ['Daniel Gourley', 2007],
  'craig chong': ['Craig Chong', 2006],
  'milo henshaw': ['Milo Henshaw', 2006],
  'luke boyd': ['Luke Boyd', { season: 2026, junior: true, cadet: false }],
  'tim wang': ['Tim Wang', 2004],
  'stacy chong': ['Stacy Chong', { season: 2026, junior: true, cadet: false }],
};

for (const [key, [name, dob]] of Object.entries(expected)) {
  test(`enrichment "${key}" resolves to the right person, not a sibling`, () => {
    const rec = idx[key];
    assert.ok(rec, `${key} present`);
    assert.equal(rec.display_name, name);
    if (typeof dob === 'number') {
      assert.equal(rec.dob_year, dob);
    } else {
      assert.equal(rec.dob_year, null);
      assert.equal(rec.dob_withheld, true);
      assert.deepEqual(rec.age_eligibility, dob);
    }
  });
}

test('ageEligible: a published year, else withheld flags for the same season, else null', () => {
  // Junior is born season - 20 or later, Cadet season - 17 or later.
  assert.equal(ageEligible({ dob_year: 2006 }, 'junior', 2026), true);
  assert.equal(ageEligible({ dob_year: 2005 }, 'junior', 2026), false);
  assert.equal(ageEligible({ dob_year: 2009 }, 'cadet', 2026), true);
  assert.equal(ageEligible({ dob_year: 2008 }, 'cadet', 2026), false);
  const withheld = { dob_year: null, dob_withheld: true, age_eligibility: { season: 2026, junior: true, cadet: false } };
  assert.equal(ageEligible(withheld, 'junior', 2026), true);
  assert.equal(ageEligible(withheld, 'cadet', 2026), false);
  // Flags built for another season can't be trusted: fall back (null).
  assert.equal(ageEligible(withheld, 'cadet', 2027), null);
  assert.equal(ageEligible({ dob_year: null }, 'junior', 2026), null);
  assert.equal(ageEligible(null, 'junior', 2026), null);
  assert.equal(ageEligible({ dob_year: 1980 }, 'veteran', 2026), null);
});

test('displayBirthYear hides anyone born in or after this year minus 18', () => {
  assert.equal(displayBirthYear({ dob_year: 2007 }, 2026), 2007);
  assert.equal(displayBirthYear({ dob_year: 2008 }, 2026), null); // the whole year counts
  assert.equal(displayBirthYear({ dob_year: 2012 }, 2026), null);
  assert.equal(displayBirthYear({ dob_year: null, dob_withheld: true }, 2026), null);
  assert.equal(displayBirthYear(null, 2026), null);
});

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

// Taking licence hashes (and later, minors' birth years) out of the public
// registry must not change which record any name resolves to. The fixture
// maps every name key to the index of its canonical record. It was captured
// from the original selection logic on the original, hash-carrying file.
// After deliberately regenerating the registry, refresh it with
// `node scripts/snapshot-enrichment.mjs`.
test('every name key resolves to the same registry record as before the privacy scrub', () => {
  const fixture = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/enrichment-canonical.json'), 'utf8'));
  const actual = {};
  for (const key of Object.keys(idx).sort()) actual[key] = info.indexOf(idx[key]);
  assert.deepEqual(actual, fixture);
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

// v1.1 #9 (I-13): who the Veteran view lists, and the Vet 40 to Vet 70 bands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseCSV, processBouts } from '../src/data/pipeline.js';
import {
  buildEnrichmentIndex, genderFromEnrichment,
  VET_BANDS, vetBand, vetBandOf, vetBandCategory, vetEligible, veteranListed,
} from '../src/data/fencerInfo.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Band helper -------------------------------------------------------------
test('vetBand: 40 to 49, 50 to 59, 60 to 69, then 70 and over, by season minus birth year', () => {
  const at = (age) => vetBand({ dob_year: 2026 - age }, 2026);
  assert.equal(at(39), null);
  assert.equal(at(40), 40);
  assert.equal(at(49), 40);
  assert.equal(at(50), 50);
  assert.equal(at(59), 50);
  assert.equal(at(60), 60);
  assert.equal(at(69), 60);
  assert.equal(at(70), 70);
  assert.equal(at(91), 70);
});

test('vetBand: no band without a published birth year', () => {
  assert.equal(vetBand({ dob_year: null }, 2026), null);
  assert.equal(vetBand({}, 2026), null);
  assert.equal(vetBand(null, 2026), null);
  // A withheld year (anyone possibly under 18) gives no band either.
  const withheld = { dob_year: null, dob_withheld: true, age_eligibility: { season: 2026, junior: true, cadet: false } };
  assert.equal(vetBand(withheld, 2026), null);
});

test('vetBand follows the season', () => {
  assert.equal(vetBand({ dob_year: 1986 }, 2025), null); // 39 in 2025
  assert.equal(vetBand({ dob_year: 1986 }, 2026), 40);
  assert.equal(vetBand({ dob_year: 1986 }, 2036), 50);
});

test('band menu values round-trip, and Veteran itself is not a band', () => {
  for (const b of VET_BANDS) assert.equal(vetBandOf(vetBandCategory(b)), b);
  assert.equal(vetBandOf('veteran'), null);
  assert.equal(vetBandOf('vet45'), null);
  assert.equal(vetBandOf('junior'), null);
  assert.equal(vetBandOf(undefined), null);
});

// ---- Eligibility ---------------------------------------------------------------
test('vetEligible: the registry decides when it knows the age, otherwise null', () => {
  assert.equal(vetEligible({ dob_year: 1986 }, 2026), true); // 40
  assert.equal(vetEligible({ dob_year: 1987 }, 2026), false); // 39
  assert.equal(vetEligible({ dob_year: null }, 2026), null);
  assert.equal(vetEligible(null, 2026), null);
  // A withheld year means possibly under 18, so not a veteran...
  assert.equal(vetEligible({ dob_year: null, dob_withheld: true }, 2026), false);
  // ...unless that year failed the activity check, which leaves the age unknown.
  assert.equal(vetEligible({ dob_year: null, dob_withheld: true, dob_implausible: true }, 2026), null);
});

test('veteranListed: vet-stream bouts required, registry age first, event tags only without a year', () => {
  const base = { season: 2026, fencedVetEvent: true, vetBouts: 5 };
  // 40 and over by the registry: listed, whenever they last fenced a vet event.
  assert.equal(veteranListed({ ...base, rec: { dob_year: 1970 } }), true);
  // No bouts in the vet stream: nothing to show, so not listed.
  assert.equal(veteranListed({ ...base, rec: { dob_year: 1970 }, vetBouts: 0 }), false);
  // The registry says under 40: not listed, even with vet bouts.
  assert.equal(veteranListed({ ...base, rec: { dob_year: 1990 } }), false);
  // No birth year: having fenced a vet-tagged event is enough for all veterans...
  assert.equal(veteranListed({ ...base, rec: { dob_year: null } }), true);
  assert.equal(veteranListed({ ...base, rec: undefined }), true);
  assert.equal(veteranListed({ ...base, rec: undefined, fencedVetEvent: false }), false);
  // ...but a band needs a birth year.
  assert.equal(veteranListed({ ...base, rec: { dob_year: null }, band: 40 }), false);
  // A band lists only its own ages.
  assert.equal(veteranListed({ ...base, rec: { dob_year: 1963 }, band: 60 }), true);
  assert.equal(veteranListed({ ...base, rec: { dob_year: 1963 }, band: 50 }), false);
  // Possibly under 18 (withheld year): never a veteran.
  assert.equal(veteranListed({ ...base, rec: { dob_year: null, dob_withheld: true } }), false);
});

// ---- The committed dataset -------------------------------------------------------
const raw = parseCSV(readFileSync(resolve(__dirname, '../../ingest/bouts.csv'), 'utf8'));
const idx = buildEnrichmentIndex(JSON.parse(readFileSync(resolve(__dirname, '../../ingest/fencers.json'), 'utf8')));
const { fencers, bouts } = processBouts(raw, DEFAULT_SETTINGS);
const season = bouts.reduce((y, b) => Math.max(y, Number(b.date.slice(0, 4))), 0);
const LISTS = ['foil', 'epee', 'sabre'].flatMap((w) => ['M', 'W'].map((g) => [w, g]));

// The Veteran view's membership as Leaderboard.jsx applies it, with App.jsx's
// registry fallback for fencers whose gender the bouts can't tell.
function veteranKeys(weapon, gender, band = 'all') {
  const keys = [];
  for (const f of Object.values(fencers)) {
    const w = f.byWeapon[weapon];
    if (!w) continue;
    const genders = f.genders.size ? f.genders : new Set([genderFromEnrichment(idx[f.key])].filter(Boolean));
    if (!genders.has(gender)) continue;
    const vet = w.byAge.veteran;
    const listed = veteranListed({
      rec: idx[f.key],
      season,
      band,
      fencedVetEvent: !!f.nativeCategories[weapon]?.has('veteran'),
      vetBouts: vet.pool.bouts + vet.de.bouts,
    });
    if (listed) keys.push(f.key);
  }
  return keys;
}

test('committed data: the Veteran lists hold far more than the 14 people the year gate left', () => {
  const people = new Set(LISTS.flatMap(([w, g]) => veteranKeys(w, g)));
  assert.ok(people.size > 40, `only ${people.size} veterans listed across all weapons`);
});

test('committed data: a 40+ fencer whose only vet bouts are from 2025 is listed, in his band', () => {
  // Kyle Macdonald, Vet 60, fenced vet epee only in 2025, so the old
  // "vet bout this season" gate hid him. If a later refresh gives him a vet
  // bout this season, swap in another such fencer.
  const key = 'kyle macdonald';
  assert.equal(vetBand(idx[key], season), 60);
  const vetYears = new Set(bouts
    .filter((b) => b.ageCategory === 'veteran' && (b.keyA === key || b.keyB === key))
    .map((b) => Number(b.date.slice(0, 4))));
  assert.deepEqual([...vetYears], [2025]);
  assert.ok(season > 2025);
  assert.ok(veteranKeys('epee', 'M').includes(key), 'in the Veteran list');
  assert.ok(veteranKeys('epee', 'M', 60).includes(key), 'in Vet 60');
  for (const b of [40, 50, 70]) assert.ok(!veteranKeys('epee', 'M', b).includes(key), `not in Vet ${b}`);
});

test('committed data: every listed veteran with a birth year is in exactly one band', () => {
  for (const [w, g] of LISTS) {
    const banded = VET_BANDS.flatMap((b) => veteranKeys(w, g, b));
    assert.equal(new Set(banded).size, banded.length, `${g} ${w}: someone is in two bands`);
    const withYear = veteranKeys(w, g).filter((k) => vetBand(idx[k], season) !== null);
    assert.deepEqual([...banded].sort(), [...withYear].sort(), `${g} ${w}`);
  }
});

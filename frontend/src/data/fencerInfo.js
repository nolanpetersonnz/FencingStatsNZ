// FencerInfo — privacy-scrubbed enrichment from the Fencing Time XML
// dataset (DOB year, handedness, nation, current club, official FNZ
// rankings). Loaded from /data/fencers.json at app startup and merged
// over the bout-derived `fencers` map by name_key.
//
// The public file carries no licence data beyond a `has_licence` flag.
// Licence numbers and their hashes never leave the machine the ingest
// script runs on. Nor does the birth year of anyone who may be under 18:
// their record has `dob_year: null` and `dob_withheld: true`, plus the
// facts the site needs from the year, worked out when the file was built
// (`age_eligibility` for one season, `dob_implausible` when it applies).
// See ingest/fencerinfo_ingest.py.

import { nameKey } from './pipeline.js';

export async function loadFencerInfo() {
  try {
    const res = await fetch('/data/fencers.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Build a name_key → enrichment record lookup. A single info entry may
// carry multiple `name_keys` (alias spellings); each becomes a lookup.
// When two info records claim the same name_key (e.g. two different
// "Joel Ball-La Hood" with different DOBs), prefer the one with more
// signal: a licence on record, then a DOB, then number of clubs known.
//
// Two collision modes are handled:
//   1. Cross-person alias: a shared/mis-entered licence in the source XML
//      folds one fencer's name alias into a sibling's record, so the sibling's
//      record carries the other's name as a stray alias. The ownership bonus
//      (a record whose own `display_name` IS this key) makes the canonical
//      owner outrank any record that merely lists the key as an alias.
//   2. Same person, typo DOB: the (loose-name, dob_year) registry merge splits
//      one fencer into two records when a data-entry typo gives one a bad DOB.
//      One senior fencer appeared with both her real birth year and an
//      impossible one from a bad source row, which put her into the
//      Junior/Cadet leaderboards. We demote any DOB that is
//      activity-implausible (younger than MIN_PLAUSIBLE_AGE at the time of
//      an official ranking the record holds). This is deliberately narrow: it
//      fixes clear errors without disturbing real namesakes, e.g. two fencers
//      who share a name but were born twenty years apart both stay plausible.
const MIN_PLAUSIBLE_AGE = 8;
export function buildEnrichmentIndex(info) {
  if (!Array.isArray(info)) return {};
  // A withheld year still counts as a known DOB, and its implausibility was
  // decided at build time with the same rule, so records score as before.
  const signal = (r) =>
    (r.has_licence ? 100 : 0) +
    (r.dob_year || r.dob_withheld ? 10 : 0) +
    (r.clubs?.length || 0);
  const implausibleDob = (r) => {
    if (r.dob_withheld) return r.dob_implausible === true;
    if (!r.dob_year) return false;
    const asOf = Object.values(r.rankings || {})
      .map((x) => parseInt((x.as_of || '').slice(0, 4), 10))
      .filter(Number.isFinite);
    return asOf.length > 0 && Math.min(...asOf) - r.dob_year < MIN_PLAUSIBLE_AGE;
  };
  const score = (r, key) =>
    signal(r)
    + (nameKey(r.display_name) === key ? 1e6 : 0)
    - (implausibleDob(r) ? 1e9 : 0);
  const idx = {};
  for (const rec of info) {
    for (const k of rec.name_keys || []) {
      const key = nameKey(k);
      if (!key) continue;
      const existing = idx[key];
      if (!existing || score(rec, key) > score(existing, key)) idx[key] = rec;
    }
  }
  return idx;
}

// Junior (U20) and Cadet (U17) eligibility for `season`, the leaderboard's
// current year: born `season - 20` or later for Junior, `season - 17` or later
// for Cadet. Returns true/false when the registry knows, null when it can't
// say: no DOB on record, or withheld-year flags built for another season.
// Callers fall back to event tagging on null.
export function ageEligible(rec, category, season) {
  if (!rec || (category !== 'junior' && category !== 'cadet')) return null;
  if (rec.dob_year != null) {
    return rec.dob_year >= season - (category === 'junior' ? 20 : 17);
  }
  const flags = rec.age_eligibility;
  if (flags && flags.season === season && typeof flags[category] === 'boolean') return flags[category];
  return null;
}

// The birth year to show on a profile, or null. Hidden for anyone born in or
// after (this year - 18): only the year is known, so that whole year counts
// as possibly under 18. The public registry already withholds those years;
// this also covers an older or locally imported registry file.
export function displayBirthYear(rec, year = new Date().getFullYear()) {
  const dob = rec?.dob_year;
  if (dob == null || dob >= year - 18) return null;
  return dob;
}

// Infer a fencer's gender from their registry record when the bout data
// couldn't — fencers who only ever appear in mixed events have their per-row
// gender label cleared during dedupe, so the majority vote in processBouts
// comes up empty and they vanish from both gendered leaderboards. The FNZ
// ranking keys encode gender ("foil_W" / "epee_M"). Returns 'M' | 'W' | null
// (null when there's no ranking, or the record straddles both — unresolvable).
export function genderFromEnrichment(rec) {
  if (!rec || !rec.rankings) return null;
  const keys = Object.keys(rec.rankings);
  const hasW = keys.some((k) => k.endsWith('_W'));
  const hasM = keys.some((k) => k.endsWith('_M'));
  if (hasW && !hasM) return 'W';
  if (hasM && !hasW) return 'M';
  return null;
}

// Human-readable label for a ranking entry. `key` is a "weapon_gender"
// string like "epee_M".
export function rankingLabel(key) {
  const [weapon, gender] = key.split('_');
  const w = weapon === 'epee' ? 'Épée' : weapon[0].toUpperCase() + weapon.slice(1);
  const g = gender === 'W' ? "Women's" : "Men's";
  return `${g} ${w}`;
}

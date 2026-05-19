// FencerInfo — privacy-scrubbed enrichment from the Fencing Time XML
// dataset (DOB year, handedness, nation, current club, official FNZ
// rankings). Loaded from /data/fencers.json at app startup and merged
// over the bout-derived `fencers` map by name_key.
//
// The shipped JSON also carries `licence_hashes` per fencer — SHA-256
// hashes (peppered) of every licence number known for that person.
// LoginModal hashes a user-entered licence client-side and looks for a
// matching hash here. Licence numbers themselves never leave the local
// machine the ingest script runs on.

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
// signal — license hashes, then a DOB, then number of clubs known.
export function buildEnrichmentIndex(info) {
  if (!Array.isArray(info)) return {};
  const score = (r) =>
    (r.licence_hashes?.length ? 100 : 0) +
    (r.dob_year ? 10 : 0) +
    (r.clubs?.length || 0);
  const idx = {};
  for (const rec of info) {
    for (const k of rec.name_keys || []) {
      const key = nameKey(k);
      if (!key) continue;
      const existing = idx[key];
      if (!existing || score(rec) > score(existing)) idx[key] = rec;
    }
  }
  return idx;
}

// Pepper bundled in at build time. Vite exposes import.meta.env.VITE_*
// to client code. If absent, hashing still works but isn't peppered —
// the ingest script will have emitted unsalted hashes in that case too.
const PEPPER = import.meta.env.VITE_LICENCE_PEPPER || '';

// Tolerate copy-paste cruft from member cards ("FNZ #20499", "20377'",
// lowercase "sp7893420"). KEEP IN SYNC with normalise_licence() in
// ingest/fencerinfo_ingest.py — both sides must produce the same input
// to the hash for the lookup to succeed.
const LICENCE_PREFIX_RE = /^\s*(FE?NZ\s*#?\s*)+/i;
const LICENCE_TRIM_RE = /[^A-Za-z0-9]+$/;
export function normaliseLicence(licence) {
  if (!licence) return '';
  return (licence + '').trim().replace(LICENCE_PREFIX_RE, '').replace(LICENCE_TRIM_RE, '').trim().toUpperCase();
}

export async function hashLicence(licence) {
  const text = `${PEPPER}|${normaliseLicence(licence)}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Find the enrichment record whose `licence_hashes` contains `hash`.
// Returns null if none. The same hash should only ever appear once
// across the bundle.
export function findFencerByLicenceHash(info, hash) {
  if (!hash) return null;
  for (const rec of info) {
    if (rec.licence_hashes?.includes(hash)) return rec;
  }
  return null;
}

// Map the matched info record back to a fencer key in the bout-derived
// `fencers` map (`{ [nameKey]: fencer, ... }`). Returns the first key
// in `rec.name_keys` that exists in `fencers`; falls back to null.
export function fencerKeyForInfo(rec, fencers) {
  if (!rec) return null;
  for (const k of rec.name_keys || []) {
    const key = nameKey(k);
    if (fencers[key]) return key;
  }
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

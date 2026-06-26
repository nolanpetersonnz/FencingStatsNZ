// Throwaway diagnostic: explains why a withdrawal-flagged input row fails to
// surface as a withdrawal bout in processBouts output. Mirrors the assertion in
// frontend/test/pipeline.test.js ("all flagged bouts emitted as withdrawals").
//
// Usage:
//   node frontend/scripts/diagnose-withdrawals.mjs [path/to/bouts.csv]
//
// Defaults to the committed ingest/bouts.csv. Point it at the refreshed CSV
// (the one the refresh-data workflow generates) to find the specific dropped
// row. The committed dataset passes CI, so against it this prints "clean".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseCSV, processBouts, withdrawalSide,
  nameKey, normWeapon, parseCompVariant, detectMixedEvents, normDate, boutHash,
} from '../src/data/pipeline.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../ingest/bouts.csv');

const raw = parseCSV(readFileSync(csvPath, 'utf8'));
const flagged = raw.filter(b => withdrawalSide(b));
const { bouts } = processBouts(raw, DEFAULT_SETTINGS);
const wdBouts = bouts.filter(b => b.withdrawal);

console.log(`dataset:        ${csvPath}`);
console.log(`flagged rows:   ${flagged.length}`);
console.log(`withdrawal out: ${wdBouts.length}`);

if (wdBouts.length === flagged.length) {
  console.log('\nclean: every flagged row surfaced as a withdrawal bout. Test would pass.');
  process.exit(0);
}

// Build a consumable multiset of output withdrawal identities, matched on the
// unordered fencer-key pair + integer scores (date-format-independent, so we
// don't depend on the non-exported detectDateFormat).
const idOf = (kA, kB, sA, sB) => {
  const [x, y] = [kA, kB].sort();
  // scores normalised the same way: low|high keyed to the sorted name pair
  const lowKey = x === kA ? sA : sB;
  const highKey = x === kA ? sB : sA;
  return `${x}|${y}|${lowKey}|${highKey}`;
};
const outRemaining = new Map();
for (const b of wdBouts) {
  const id = idOf(b.keyA, b.keyB, b.scoreA, b.scoreB);
  outRemaining.set(id, (outRemaining.get(id) || 0) + 1);
}

// Reproduce the dedup pass so we can label duplicate-dropped rows.
const mixedKeys = detectMixedEvents(raw);
const seen = new Set();
const dedupVerdict = new Map(); // row index -> true if dropped as duplicate
raw.forEach((b, i) => {
  const weapon = normWeapon(b.weapon);
  const { base, variant } = parseCompVariant(b.competition);
  const mixKey = `${b.date}|${weapon}|${base.toLowerCase()}`;
  const isMixed = variant && mixedKeys.has(mixKey);
  const competition = isMixed ? base : (b.competition || '').trim();
  const dedupKey = `${b.date}|${weapon}|${competition.toLowerCase()}|${boutHash(b, weapon)}`;
  dedupVerdict.set(i, seen.has(dedupKey));
  seen.add(dedupKey);
});

function diagnose(b, idx) {
  const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
  const sA = parseInt(b.score_a, 10), sB = parseInt(b.score_b, 10);
  if (!kA || !kB) return `blank/unresolvable name (key_a='${kA}', key_b='${kB}')`;
  if (kA === kB) return `self-bout: both sides resolve to the same fencer key '${kA}'`;
  if (isNaN(sA) || isNaN(sB)) return `non-numeric score (score_a='${b.score_a}', score_b='${b.score_b}')`;
  if (dedupVerdict.get(idx)) return 'deduped: collides with an earlier row by canonical bout hash';
  return 'survived dedup + filters but produced no withdrawal output (likely missing rating snapshot: a fencer had no rating-bearing bout in this period/category)';
}

const dropped = [];
flagged.forEach(b => {
  const idx = raw.indexOf(b);
  const id = idOf(nameKey(b.fencer_a), nameKey(b.fencer_b), parseInt(b.score_a, 10), parseInt(b.score_b, 10));
  const have = outRemaining.get(id) || 0;
  if (have > 0) { outRemaining.set(id, have - 1); return; }
  dropped.push({ b, idx });
});

console.log(`\ndropped flagged rows: ${dropped.length}\n`);
for (const { b, idx } of dropped) {
  console.log(`row ${idx + 2} (CSV line, 1-based incl. header):`); // +2: header + 0-index
  console.log(`  date=${b.date}  weapon=${b.weapon}  comp=${b.competition}`);
  console.log(`  ${b.fencer_a} (${b.score_a}) vs ${b.fencer_b} (${b.score_b})  flag=${b.flag}`);
  console.log(`  reason: ${diagnose(b, idx)}\n`);
}

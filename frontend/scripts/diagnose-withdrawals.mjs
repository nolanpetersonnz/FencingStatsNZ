// Throwaway diagnostic: explains why a withdrawal-flagged input row fails to
// surface as a withdrawal bout in processBouts output. Mirrors the assertion in
// frontend/test/pipeline.test.js ("all flagged bouts emitted as withdrawals"):
// the expected count is taken AFTER mixed-event dedup, because two flagged
// copies of the same physical bout legitimately collapse into one withdrawal.
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
  parseCSV, processBouts, withdrawalSide, dedupeBouts, nameKey,
} from '../src/data/pipeline.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(__dirname, '../../ingest/bouts.csv');

const raw = parseCSV(readFileSync(csvPath, 'utf8'));
const flaggedRaw = raw.filter(b => withdrawalSide(b));
// Same expectation as the test: flagged bouts that survive dedup. dedupeBouts
// merges a duplicate's flag onto the kept copy, so no withdrawal is lost here.
const flagged = dedupeBouts(raw).filter(b => withdrawalSide(b));
const { bouts } = processBouts(raw, DEFAULT_SETTINGS);
const wdBouts = bouts.filter(b => b.withdrawal);

console.log(`dataset:        ${csvPath}`);
console.log(`flagged rows:   ${flaggedRaw.length} raw, ${flagged.length} after mixed-event dedup`);
console.log(`withdrawal out: ${wdBouts.length}`);

if (wdBouts.length === flagged.length) {
  console.log('\nclean: every deduped flagged bout surfaced as a withdrawal. Test would pass.');
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

function diagnose(b) {
  const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
  const sA = parseInt(b.score_a, 10), sB = parseInt(b.score_b, 10);
  if (!kA || !kB) return `blank/unresolvable name (key_a='${kA}', key_b='${kB}')`;
  if (kA === kB) return `self-bout: both sides resolve to the same fencer key '${kA}'`;
  if (isNaN(sA) || isNaN(sB)) return `non-numeric score (score_a='${b.score_a}', score_b='${b.score_b}')`;
  return 'survived dedup + filters but produced no withdrawal output (likely missing rating snapshot: a fencer had no rating-bearing bout in this period/category)';
}

// dedupeBouts returns clones (with the competition rewritten for mixed events),
// so locate the original CSV line by content instead of reference.
function rawLineOf(b) {
  const idx = raw.findIndex(r =>
    r.date === b.date && r.fencer_a === b.fencer_a && r.fencer_b === b.fencer_b
    && r.score_a === b.score_a && r.score_b === b.score_b && r.weapon === b.weapon);
  return idx === -1 ? '?' : String(idx + 2); // +2: header + 0-index
}

const dropped = [];
flagged.forEach(b => {
  const id = idOf(nameKey(b.fencer_a), nameKey(b.fencer_b), parseInt(b.score_a, 10), parseInt(b.score_b, 10));
  const have = outRemaining.get(id) || 0;
  if (have > 0) { outRemaining.set(id, have - 1); return; }
  dropped.push(b);
});

console.log(`\ndropped flagged bouts: ${dropped.length}\n`);
for (const b of dropped) {
  console.log(`row ${rawLineOf(b)} (CSV line, 1-based incl. header):`);
  console.log(`  date=${b.date}  weapon=${b.weapon}  comp=${b.competition}`);
  console.log(`  ${b.fencer_a} (${b.score_a}) vs ${b.fencer_b} (${b.score_b})  flag=${b.flag}`);
  console.log(`  reason: ${diagnose(b)}\n`);
}

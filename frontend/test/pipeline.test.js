import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseCSV, processBouts, parseAgeCategory, withdrawalSide, deFinish,
} from '../src/data/pipeline.js';
import { DEFAULT_SETTINGS } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const S = DEFAULT_SETTINGS;

// ---- Age-category classification (Phase 0: secondary-schools leak) ----------
test('secondary-schools events classify as cadet, not senior', () => {
  const names = [
    'NZ Secondary Schools Championship 2024',
    'Mid South Secondary Schools Champs 2024',
    'MidSouth Sec Schools #2 2024',
    'North Sec Schools #1 2024',
    'North Secondary Schools Championship 2024',
  ];
  for (const n of names) assert.equal(parseAgeCategory(n), 'cadet', n);
});

test('genuine open / age events still classify correctly', () => {
  assert.equal(parseAgeCategory('North Island Championship 2026'), 'senior');
  assert.equal(parseAgeCategory('Central Open Championship 2025'), 'senior');
  assert.equal(parseAgeCategory('MidSouth U17 Championship 2026'), 'cadet');
  assert.equal(parseAgeCategory('New Zealand U20 Championship 2024'), 'junior');
  assert.equal(parseAgeCategory('NZ National Championship Vets 2024'), 'veteran');
});

// ---- Withdrawal flag parsing ------------------------------------------------
test('withdrawalSide parses the flag column', () => {
  assert.equal(withdrawalSide({ flag: 'wd_a' }), 'a');
  assert.equal(withdrawalSide({ flag: 'wd_b' }), 'b');
  assert.equal(withdrawalSide({ flag: 'wd' }), 'both');
  assert.equal(withdrawalSide({ flag: '' }), null);
  assert.equal(withdrawalSide({}), null);
});

// ---- Withdrawal rating behaviour (synthetic) --------------------------------
const mkBout = (extra) => ({
  date: '2025-01-01', competition: 'Test Open 2025', weapon: 'epee',
  bout_type: 'de', de_round: 'Final', gender: 'Mens',
  fencer_a: 'Alice A', club_a: 'Club', fencer_b: 'Bob B', club_b: 'Club',
  score_a: '15', score_b: '10', ...extra,
});

test('a normal DE win moves both ratings', () => {
  const { fencers } = processBouts([mkBout()], S);
  const a = fencers['alice a'].byWeapon.epee.de;
  const b = fencers['bob b'].byWeapon.epee.de;
  assert.ok(a.rating > S.initialRating, 'winner rating rises');
  assert.ok(b.rating < S.initialRating, 'loser rating falls');
  assert.equal(a.wins, 1);
  assert.equal(b.losses, 1);
});

test('a withdrawal is a loss for the withdrawer but moves no rating', () => {
  const { fencers, bouts } = processBouts([mkBout({ flag: 'wd_b' })], S);
  const a = fencers['alice a'].byWeapon.epee.de;
  const b = fencers['bob b'].byWeapon.epee.de;
  // No rating movement on either side.
  assert.equal(a.rating, S.initialRating);
  assert.equal(b.rating, S.initialRating);
  // Recorded as win for A, loss for B.
  assert.equal(a.wins, 1);
  assert.equal(a.losses, 0);
  assert.equal(b.losses, 1);
  assert.equal(b.wins, 0);
  // Public bout record: zero delta, opponent is the winner.
  assert.equal(bouts.length, 1);
  assert.equal(bouts[0].deltaA, 0);
  assert.equal(bouts[0].deltaB, 0);
  assert.equal(bouts[0].winnerKey, 'alice a');
  assert.equal(bouts[0].withdrawal, 'b');
});

// ---- DE finish derivation (Phase 1 Results view) ----------------------------
test('deFinish reconstructs numeric placement from the DE bracket', () => {
  const champ = [{ deRound: 'SF', winnerKey: 'me' }, { deRound: 'Final', winnerKey: 'me' }];
  assert.deepEqual(deFinish(champ, 'me'), { rank: 1, label: '1' });

  const runnerUp = [{ deRound: 'SF', winnerKey: 'me' }, { deRound: 'Final', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(runnerUp, 'me'), { rank: 2, label: '2' });

  const lostSF = [{ deRound: 'QF', winnerKey: 'me' }, { deRound: 'SF', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(lostSF, 'me'), { rank: 3, label: '3rd tied' });

  const lostQF = [{ deRound: 'T16', winnerKey: 'me' }, { deRound: 'QF', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(lostQF, 'me'), { rank: 5, label: '5th tied' });

  const lostT16 = [{ deRound: 'T16', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(lostT16, 'me'), { rank: 9, label: '9th tied' });

  assert.equal(deFinish([], 'me'), null); // pool-only fencer
});

// ---- Real dataset smoke test ------------------------------------------------
test('committed bouts.csv processes cleanly with withdrawal flags', () => {
  const raw = parseCSV(readFileSync(resolve(__dirname, '../../ingest/bouts.csv'), 'utf8'));
  const flagged = raw.filter(b => withdrawalSide(b));
  assert.ok(flagged.length >= 1, 'dataset carries at least one withdrawal flag');

  const { fencers, bouts } = processBouts(raw, S);

  // No NaN / Infinity ratings anywhere.
  for (const k in fencers) {
    for (const w in fencers[k].byWeapon) {
      const slot = fencers[k].byWeapon[w];
      for (const stream of [slot.pool, slot.de]) {
        assert.ok(Number.isFinite(stream.rating), `${k} ${w} rating finite`);
        assert.ok(Number.isFinite(stream.rd), `${k} ${w} rd finite`);
      }
    }
  }

  // Every withdrawal bout in the output has zero rating movement.
  const wdBouts = bouts.filter(b => b.withdrawal);
  assert.equal(wdBouts.length, flagged.length, 'all flagged bouts emitted as withdrawals');
  for (const b of wdBouts) {
    assert.equal(b.deltaA, 0);
    assert.equal(b.deltaB, 0);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseCSV, processBouts, parseAgeCategory, withdrawalSide, deFinish,
  difficultyTier, fieldOverview, predictiveAccuracy, buildTableau,
  lineDifficulty, matchups, makeDemoBouts,
} from '../src/data/pipeline.js';
import { decayRD } from '../src/engine/glicko2.js';
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
  assert.deepEqual(deFinish(lostQF, 'me'), { rank: 5, label: '5–8' });

  const lostT16 = [{ deRound: 'T16', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(lostT16, 'me'), { rank: 9, label: '9–16' });

  const lostT32 = [{ deRound: 'T32', winnerKey: 'opp' }];
  assert.deepEqual(deFinish(lostT32, 'me'), { rank: 17, label: '17–32' });

  assert.equal(deFinish([], 'me'), null); // pool-only fencer
});

// ---- Field overview / expected pool wins ------------------------------------
test('difficultyTier buckets win probability blue→red', () => {
  assert.equal(difficultyTier(0.90).key, 'easy');
  assert.equal(difficultyTier(0.70).key, 'favoured');
  assert.equal(difficultyTier(0.50).key, 'even');
  assert.equal(difficultyTier(0.30).key, 'hard');
  assert.equal(difficultyTier(0.10).key, 'veryhard');
});

test('fieldOverview: expected pool wins sum, actual, and per-fencer diff', () => {
  // Round-robin pool of 3, plus a DE bout, so we can check the invariants.
  const pool = (a, b, sa, sb) => ({ date: '2025-01-01', competition: 'Cup 2025', weapon: 'epee', bout_type: 'pool', de_round: '', gender: 'Mens', fencer_a: a, club_a: 'C', fencer_b: b, club_b: 'C', score_a: String(sa), score_b: String(sb) });
  const raw = [
    pool('Ann A', 'Bea B', 5, 3), pool('Ann A', 'Cat C', 5, 4), pool('Bea B', 'Cat C', 5, 2),
  ];
  const { fencers, bouts } = processBouts(raw, S);
  const fo = (name) => fieldOverview(bouts.filter(b => b.keyA === name || b.keyB === name), name, fencers);
  // Conservation: expected wins across the pool == actual wins == number of bouts.
  const keys = ['ann a', 'bea b', 'cat c'];
  const totalExp = keys.reduce((s, k) => s + fo(k).exp, 0);
  const totalAct = keys.reduce((s, k) => s + fo(k).act, 0);
  assert.equal(totalAct, 3);                       // 3 pool bouts, 3 wins total
  assert.ok(Math.abs(totalExp - 3) < 1e-9, `Σ expected ${totalExp} ≈ 3`);
  // Ann won both her pool bouts.
  const ann = fo('ann a');
  assert.equal(ann.act, 2);
  assert.equal(ann.pool.length, 2);
  assert.ok(ann.pool.every(p => typeof p.tier.color === 'string'));
});

// ---- Most-recent club (Phase 1: Brendan's affiliation request) --------------
test('a fencer\'s club follows their most recent bout, not the first', () => {
  const raw = [
    { date: '2024-01-01', competition: 'Old Cup 2024', weapon: 'epee', bout_type: 'de', de_round: 'Final', gender: 'Mens', fencer_a: 'Mover M', club_a: 'Alpha Club', fencer_b: 'Other O', club_b: 'Beta Club', score_a: '15', score_b: '10' },
    { date: '2026-01-01', competition: 'New Cup 2026', weapon: 'epee', bout_type: 'de', de_round: 'Final', gender: 'Mens', fencer_a: 'Mover M', club_a: 'Gamma Club', fencer_b: 'Other O', club_b: 'Beta Club', score_a: '15', score_b: '8' },
  ];
  const { fencers } = processBouts(raw, S);
  assert.equal(fencers['mover m'].club, 'Gamma Club');
});

// ---- Inactivity decay (experimental, off by default) ------------------------
test('decayRD inflates with idle time, caps at initial RD, no-ops when off', () => {
  const init = 200;
  assert.equal(decayRD(80, 2, 0, init), 80);        // c = 0 → untouched
  assert.equal(decayRD(80, 0, 0.3, init), 80);      // no elapsed time → untouched
  assert.ok(decayRD(80, 2, 0.3, init) > 80);        // idle two years widens
  assert.ok(decayRD(80, 50, 0.3, init) <= init);    // never exceeds a fresh fencer
});

test('inactivity decay widens a returning fencer\'s pre-bout RD only when on', () => {
  // Same fencer competes in 2024, then again two years later. The gap should
  // inflate their pre-bout RD when decay is on, and do nothing when it's off.
  const mk = (date, comp, opp, sa, sb) => ({
    date, competition: comp, weapon: 'epee', bout_type: 'de', de_round: 'Final', gender: 'Mens',
    fencer_a: 'Gap G', club_a: 'C', fencer_b: opp, club_b: 'C', score_a: String(sa), score_b: String(sb),
  });
  const raw = [mk('2024-01-01', 'Cup A 2024', 'Foe One', 15, 10), mk('2026-01-01', 'Cup B 2026', 'Foe Two', 15, 9)];
  const rdBefore2026 = (res) => {
    const b = res.bouts.find((x) => x.date === '2026-01-01');
    return b.keyA === 'gap g' ? b.rdABefore : b.rdBBefore;
  };
  const off = rdBefore2026(processBouts(raw, { ...S, inactivityDecayC: 0 }));
  const on = rdBefore2026(processBouts(raw, { ...S, inactivityDecayC: 0.3 }));
  assert.ok(off < S.initialRD, 'no inflation when decay off — RD stays where the 2024 bout left it');
  assert.ok(on > off, 'idle gap inflates RD when decay on');
  assert.ok(on <= S.initialRD, 'inflation capped at the initial RD');
});

// ---- Predictive-accuracy backtest -------------------------------------------
test('predictiveAccuracy scores the model out-of-sample and bins calibrate', () => {
  const { bouts } = processBouts(makeDemoBouts(), S);
  const acc = predictiveAccuracy(bouts, { initialRD: S.initialRD });
  assert.ok(acc.n > 0);
  assert.ok(acc.accuracy >= 0 && acc.accuracy <= 1);
  assert.ok(acc.brier >= 0 && acc.brier <= 1);
  // Demo bouts are generated from a fixed skill model, so favourites should win
  // more often than not and the model should beat a coin flip.
  assert.ok(acc.accuracy > 0.5, 'favourites win the majority on skill-driven demo data');
  assert.ok(acc.brier < acc.baselineBrier, 'Brier beats the 0.25 coin-flip baseline');
  const binTotal = acc.buckets.reduce((s, b) => s + b.n, 0);
  assert.equal(binTotal, acc.n, 'every scored bout lands in exactly one calibration bin');
});

// ---- Tableau reconstruction + line difficulty -------------------------------
test('buildTableau chains winners into a bracket and crowns the champion', () => {
  const mkDe = (round, fa, fb, sa, sb) => ({
    date: '2025-01-01', competition: 'Knockout 2025', weapon: 'epee', bout_type: 'de', de_round: round,
    gender: 'Mens', fencer_a: fa, club_a: 'C', fencer_b: fb, club_b: 'C', score_a: String(sa), score_b: String(sb),
  });
  const raw = [
    mkDe('SF', 'Ana A', 'Bee B', 15, 10),
    mkDe('SF', 'Cy C', 'Dee D', 15, 12),
    mkDe('Final', 'Ana A', 'Cy C', 15, 8),
  ];
  const { bouts, fencers } = processBouts(raw, S);
  const t = buildTableau(bouts.filter((b) => b.type === 'de'), fencers);
  assert.equal(t.rounds.length, 2);
  assert.deepEqual(t.rounds.map((r) => r.label), ['Semis', 'Final']);
  assert.equal(t.rounds[0].matches.length, 2);
  assert.equal(t.rounds[1].matches.length, 1);
  assert.equal(t.champion.key, 'ana a');

  // Layout: two columns, semis stacked at rows 0 and 1, final centred at 0.5.
  assert.equal(t.cols, 2);
  assert.equal(t.rows, 2);
  assert.deepEqual(t.rounds[0].matches.map((m) => m.row), [0, 1]);
  const final = t.rounds[1].matches[0];
  assert.equal(final.row, 0.5);
  assert.ok(final.winnerPWin > 0 && final.winnerPWin <= 1);
  // The final's feeders are the two semis.
  const semiIds = t.rounds[0].matches.map((m) => m.id);
  assert.ok(semiIds.includes(final.topChildId) && semiIds.includes(final.bottomChildId));

  // Line difficulty reads the whole field's DE bouts so it can trace a fencer's
  // full path to the title, not only the bouts they fenced. Both reads — the
  // line average and the sweep odds — span that whole path.
  const deAll = bouts.filter((b) => b.type === 'de');
  const prod = (xs) => xs.reduce((p, x) => p * x, 1);

  // Ana won it all: as champion her full line IS her real run (beat Bee, Cy), so
  // every figure matches the product over the bouts she actually fenced.
  const ld = lineDifficulty(deAll, 'ana a', fencers);
  assert.equal(ld.steps.length, 2);
  assert.ok(ld.steps.every((s) => s.won));
  assert.equal(ld.path.length, 2, 'champion fenced her whole line');
  assert.deepEqual(ld.path.map((p) => p.oppKey), ['bee b', 'cy c']);
  assert.ok(ld.path.every((p) => p.fenced), 'every step on a champion path was actually fenced');
  assert.ok(ld.runProbability > 0 && ld.runProbability < 1);
  assert.ok(Math.abs(ld.runProbability - prod(ld.path.map((p) => p.pWin))) < 1e-12, 'sweep odds is the product over the path');
  assert.ok(Math.abs(ld.runProbability - prod(ld.steps.map((s) => s.pWin))) < 1e-9, 'and equals the real run for a champion');
  assert.ok(Number.isFinite(ld.avgOpp) && Number.isFinite(ld.peakOpp));
  assert.equal(lineDifficulty([], 'ana a', fencers), null); // pool-only fencer

  // Cy reached the final, so their whole line is also just their real run. A
  // fencer who lost still gets a sweep chance — the final they lost counts as a
  // bout they'd have needed to win.
  const cy = lineDifficulty(deAll, 'cy c', fencers);
  assert.equal(cy.steps.length, 2);            // won the semi, lost the final
  assert.ok(!cy.steps.every((s) => s.won));
  assert.equal(cy.path.length, 2, 'a finalist also fenced their whole line');
  assert.ok(cy.runProbability > 0 && cy.runProbability < 1, 'a fencer who lost still gets a sweep chance');
  assert.ok(Math.abs(cy.runProbability - prod(cy.steps.map((s) => s.pWin))) < 1e-9, 'finalist sweep equals their real run');

  // Bee lost the semi to Ana, so she fenced one bout — but her line extends
  // through the final she never reached: had she beaten Ana she'd have met Cy,
  // the other semi's winner. Both reads now span both opponents: the line
  // average covers a fencer she never met, and the sweep odds multiply the
  // would-be final in, so they fall below her single real bout alone.
  const bee = lineDifficulty(deAll, 'bee b', fencers);
  assert.equal(bee.steps.length, 1, 'Bee fenced only the semi');
  assert.deepEqual(bee.path.map((p) => p.oppKey), ['ana a', 'cy c']);
  assert.deepEqual(bee.path.map((p) => p.fenced), [true, false]);
  assert.ok(!bee.steps.some((s) => s.oppKey === 'cy c'), 'Bee never fenced Cy');
  assert.ok(bee.path.some((p) => p.oppKey === 'cy c' && !p.fenced), 'but Cy is on her would-be path');
  assert.equal(bee.avgOpp, (bee.path[0].oppRating + bee.path[1].oppRating) / 2, 'line avg spans the full path');
  assert.equal(bee.peakOpp, Math.max(bee.path[0].oppRating, bee.path[1].oppRating));
  assert.ok(bee.path.every((p) => p.pWin > 0 && p.pWin <= 1), 'every step is priced, including the would-be final');
  assert.ok(Math.abs(bee.runProbability - bee.path[0].pWin * bee.path[1].pWin) < 1e-12, 'sweep multiplies the would-be final in');
  assert.ok(bee.runProbability < bee.steps[0].pWin, 'extending past her exit lowers the sweep');

  // Dee lost the other semi: had they won they'd have met Ana in the final, so
  // their would-be path trails the conqueror (Cy) into the final against Ana.
  const dee = lineDifficulty(deAll, 'dee d', fencers);
  assert.deepEqual(dee.path.map((p) => p.oppKey), ['cy c', 'ana a'], 'Dee would have met the other finalist');
  assert.deepEqual(dee.path.map((p) => p.fenced), [true, false]);
});

// ---- Bogey / favourable matchups --------------------------------------------
test('matchups splits opponents by actual minus expected wins', () => {
  // Ana beats Bo all four meetings; Ana over-performs (favourable), Bo under-
  // performs (bogey). Each direction is the other's mirror.
  const mk = (date, comp, sa, sb) => ({
    date, competition: comp, weapon: 'epee', bout_type: 'pool', de_round: '', gender: 'Mens',
    fencer_a: 'Ana A', club_a: 'C', fencer_b: 'Bo B', club_b: 'C', score_a: String(sa), score_b: String(sb),
  });
  const raw = [mk('2025-01-01', 'C1', 5, 3), mk('2025-02-01', 'C2', 5, 2), mk('2025-03-01', 'C3', 5, 4), mk('2025-04-01', 'C4', 5, 1)];
  const { bouts, fencers } = processBouts(raw, S);
  const aM = matchups('ana a', 'epee', bouts, fencers, { minMeetings: 3 });
  const bM = matchups('bo b', 'epee', bouts, fencers, { minMeetings: 3 });
  assert.equal(aM.all.length, 1);
  assert.equal(aM.all[0].meetings, 4);
  assert.equal(aM.best.length, 1);
  assert.equal(aM.best[0].oppKey, 'bo b');
  assert.equal(bM.worst.length, 1);
  assert.equal(bM.worst[0].oppKey, 'ana a');
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

test('predictiveAccuracy on the real dataset reproduces the cited calibration', () => {
  const raw = parseCSV(readFileSync(resolve(__dirname, '../../ingest/bouts.csv'), 'utf8'));
  const { bouts } = processBouts(raw, S);
  const all = predictiveAccuracy(bouts, { initialRD: S.initialRD });
  const est = predictiveAccuracy(bouts, { initialRD: S.initialRD, establishedOnly: true });
  // The project documents ~67% accuracy overall, ~73% for established fencers,
  // Brier 0.18–0.20. Loose ranges here mainly guard the favourite-orientation
  // (a flipped sign would crater accuracy below 0.5).
  assert.ok(all.accuracy > 0.6 && all.accuracy < 0.75, `overall accuracy ${all.accuracy}`);
  assert.ok(est.accuracy >= all.accuracy - 1e-9, 'established-only is at least as accurate');
  assert.ok(all.brier > 0.15 && all.brier < 0.22, `Brier ${all.brier}`);
  // Observed win rate should broadly rise across the predicted bins (allowing
  // noise in any bin with real volume).
  const obs = all.buckets.filter((b) => b.n > 30).map((b) => b.observed);
  for (let i = 1; i < obs.length; i++) assert.ok(obs[i] >= obs[i - 1] - 0.12, 'calibration broadly monotone');
});

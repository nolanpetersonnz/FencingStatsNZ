// Tests for analysis/metrics.mjs on tiny hand-made cases with known answers.
// Run from the repo root:  node --test analysis/metrics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brier, headline, favourite, bandIndex, bandGroups, rates, calibrationBins, mergeSmall, mergeSmallUnordered,
  disagreement, ratingGap, ratingLevel, GAP_EDGES, WIDE_GAP_EDGES, LEVEL_EDGES, COIN_FLIP_BRIER,
} from './metrics.mjs';

const close = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-12, `${msg || ''} got ${actual}, expected ${expected}`);
const bout = (p, aWon, extra = {}) => ({ p, aWon, ratingA: 1500, ratingB: 1500, ...extra });

// ---- Brier ------------------------------------------------------------------
test('Brier: mean squared error against the result', () => {
  // (0.8 - 1)^2 = 0.04, (0.6 - 0)^2 = 0.36, (0.5 - 1)^2 = 0.25; mean 0.65 / 3.
  close(brier([bout(0.8, true), bout(0.6, false), bout(0.5, true)]), 0.65 / 3);
  // A certain call that comes true scores 0; one that fails scores 1.
  close(brier([bout(1, true)]), 0);
  close(brier([bout(1, false)]), 1);
  assert.equal(brier([]), null);
});

test('Brier: always saying 50% scores the coin-flip 0.25 whatever happens', () => {
  close(brier([bout(0.5, true), bout(0.5, false), bout(0.5, false)]), COIN_FLIP_BRIER);
});

// ---- Favourite, accuracy, expected accuracy -----------------------------------
test('favourite: the higher chance, and fencer A at exactly 50%', () => {
  assert.deepEqual(favourite(bout(0.8, true)), { pFav: 0.8, favWon: true });
  assert.deepEqual(favourite(bout(0.5, true)), { pFav: 0.5, favWon: true });
  assert.deepEqual(favourite(bout(0.5, false)), { pFav: 0.5, favWon: false });
  const b = favourite(bout(0.3, false)); // B is the 70% favourite and won
  close(b.pFav, 0.7);
  assert.equal(b.favWon, true);
});

test('headline: accuracy and expected accuracy', () => {
  const h = headline([
    bout(0.8, true),   // A favourite, won: right
    bout(0.6, false),  // A favourite, lost: wrong
    bout(0.3, false),  // B favourite at 0.7, won: right
    bout(0.5, true),   // level; A counts as favourite, won: right
  ]);
  assert.equal(h.n, 4);
  close(h.accuracy, 3 / 4);
  close(h.expectedAccuracy, (0.8 + 0.6 + 0.7 + 0.5) / 4);
  close(h.brier, (0.04 + 0.36 + 0.09 + 0.25) / 4);
  assert.deepEqual(headline([]), { n: 0, brier: null, accuracy: null, expectedAccuracy: null });
});

// ---- Calibration bins ---------------------------------------------------------
test('calibration bins: a band includes its lower edge, and 100% is in the top band', () => {
  const bins = calibrationBins([
    bout(0.5, true), bout(0.59, false),   // 50 to 60: 2 bouts, 1 favourite win
    bout(0.6, true),                      // exactly 0.6 goes in 60 to 70
    bout(0.25, false),                    // B favourite at 0.75, won: 70 to 80
    bout(0.95, true), bout(1, true), bout(0.05, true), // 90 to 100: B favourite at 0.95 lost
  ]);
  assert.deepEqual(bins.map((b) => [b.lo, b.hi, b.n, b.favWins]), [
    [0.5, 0.6, 2, 1], [0.6, 0.7, 1, 1], [0.7, 0.8, 1, 1], [0.8, 0.9, 0, 0], [0.9, 1, 3, 2],
  ]);
  close(rates(bins[0]).predicted, (0.5 + 0.59) / 2);
  close(rates(bins[0]).observed, 0.5);
  close(rates(bins[4]).predicted, (0.95 + 1 + 0.95) / 3);
  close(rates(bins[4]).observed, 2 / 3);
  assert.deepEqual(rates(bins[3]), { predicted: null, observed: null });
});

// ---- Gap and level binning ----------------------------------------------------
test('gap bands: 0 to 50, 50 to 100, 100 to 200, 200 to 300, over 300', () => {
  const band = (gap) => bandIndex(gap, GAP_EDGES);
  assert.deepEqual([0, 49.99, 50, 99.9, 100, 199.9, 200, 299.9, 300, 1000].map(band), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([0, 99.9, 100, 199.9, 200, 900].map((g) => bandIndex(g, WIDE_GAP_EDGES)), [0, 0, 1, 1, 2, 2]);
});

test('level bands: below 1500, 1500 to 1700, above 1700, on the mean of the two ratings', () => {
  const band = (level) => bandIndex(level, LEVEL_EDGES);
  assert.deepEqual([900, 1499.9, 1500, 1699.9, 1700, 2100].map(band), [0, 0, 1, 1, 2, 2]);
  const r = { p: 0.5, aWon: true, ratingA: 1450, ratingB: 1650 };
  assert.equal(ratingGap(r), 200);
  assert.equal(ratingGap({ ...r, ratingA: 1650, ratingB: 1450 }), 200);
  assert.equal(ratingLevel(r), 1550);
});

test('bandGroups: counts, and the favourite as the higher-rated fencer', () => {
  const rows = [
    bout(0.55, true, { ratingA: 1530, ratingB: 1500 }),   // gap 30: favourite A won
    bout(0.45, true, { ratingA: 1500, ratingB: 1540 }),   // gap 40: favourite B lost
    bout(0.9, true, { ratingA: 1900, ratingB: 1500 }),    // gap 400
  ];
  const groups = bandGroups(rows, GAP_EDGES, ratingGap);
  assert.deepEqual(groups.map((g) => g.n), [2, 0, 0, 0, 1]);
  assert.deepEqual(groups.map((g) => g.favWins), [1, 0, 0, 0, 1]);
  close(rates(groups[0]).predicted, 0.55);
  assert.equal(groups[4].hi, null);
});

// ---- Merging groups under 100 bouts -------------------------------------------
const g = (lo, hi, n, favWins = 0, sumPFav = 0) => ({ lo, hi, n, favWins, sumPFav, merged: 1 });

test('mergeSmall: the smallest group under 100 joins its neighbour, the smaller one of two', () => {
  // 30 is smallest; its only neighbour is 120. Then 40 sits between 150 and
  // 150: a tie, so it joins the lower band.
  const { groups, log } = mergeSmall([g(0, 50, 150), g(50, 100, 40), g(100, 200, 120), g(200, null, 30)]);
  assert.deepEqual(groups.map((x) => [x.lo, x.hi, x.n, x.merged]), [[0, 100, 190, 2], [100, null, 150, 2]]);
  assert.equal(log.length, 2);
});

test('mergeSmall: a middle group joins the neighbour with fewer bouts, and merging repeats', () => {
  // 30 joins 60 (fewer than 200), making 90, still under 100, so that joins 200.
  const { groups, log } = mergeSmall([g(0, 50, 60, 30, 33), g(50, 100, 30, 20, 18), g(100, null, 200, 150, 160)]);
  assert.deepEqual(groups.map((x) => [x.lo, x.hi, x.n, x.favWins, x.sumPFav, x.merged]), [[0, null, 290, 200, 211, 3]]);
  assert.equal(log.length, 2);
});

test('mergeSmall: groups of 100 or more are left alone, and 100 is enough', () => {
  const input = [g(0, 50, 100), g(50, 100, 250), g(100, null, 101)];
  const { groups, log } = mergeSmall(input);
  assert.deepEqual(groups, input);
  assert.deepEqual(log, []);
});

test('mergeSmall: when everything together is under 100, one group is left', () => {
  const { groups } = mergeSmall([g(0, 50, 10), g(50, 100, 20), g(100, null, 5)]);
  assert.deepEqual(groups.map((x) => [x.lo, x.hi, x.n]), [[0, null, 35]]);
});

test('mergeSmallUnordered: the smallest group under 100 joins the next-smallest', () => {
  const rowsOf = (n) => Array.from({ length: n }, () => bout(0.6, true));
  const { groups, log } = mergeSmallUnordered([
    { name: 'epee', rows: rowsOf(300) }, { name: 'foil', rows: rowsOf(120) }, { name: 'sabre', rows: rowsOf(40) },
  ]);
  assert.deepEqual(groups.map((x) => [x.name, x.rows.length]), [['epee', 300], ['foil + sabre', 160]]);
  assert.equal(log.length, 1);
  const same = mergeSmallUnordered([{ name: 'epee', rows: rowsOf(100) }, { name: 'foil', rows: rowsOf(100) }]);
  assert.deepEqual(same.groups.map((x) => x.name), ['epee', 'foil']);
});

// ---- FeNZ ranking against FencingStatsNZ rating --------------------------------
test('disagreement count: who is higher on each side, and who won', () => {
  const b = (seedA, seedB, ratingA, ratingB, aWon, extra = {}) => ({ p: 0.5, seedA, seedB, ratingA, ratingB, aWon, ...extra });
  const d = disagreement([
    b(1, 5, 1600, 1500, true),                       // both pick A: agree
    b(1, 5, 1500, 1600, true),                       // FeNZ picks A, rating picks B; A won
    b(7, 2, 1700, 1650, true),                       // FeNZ picks B, rating picks A; A won
    b(7, 2, 1700, 1650, false),                      // the same disagreement; B won
    b(3, 9, 1500, 1600, true, { rankedB: false }),   // B unranked: left out
    b(3, null, 1500, 1600, false),                   // B has no seed: left out
    b(4, 6, 1550, 1550, true),                       // equal ratings: not a disagreement
    b(4, 4, 1500, 1600, true),                       // equal seeds: left out
  ]);
  assert.deepEqual(d, {
    total: 8, unranked: 2, equalSeed: 1, equalRating: 1, agree: 1, disagree: 3, fenzHigherWon: 2, fsnzHigherWon: 1,
  });
  assert.equal(d.fenzHigherWon + d.fsnzHigherWon, d.disagree);
  assert.equal(d.unranked + d.equalSeed + d.equalRating + d.agree + d.disagree, d.total);
});

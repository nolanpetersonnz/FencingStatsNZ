// Metric functions for the accuracy analysis (PREREGISTRATION.md). Pure
// functions over plain arrays: no file access, no dates, no engine imports.
// analysis/run.mjs builds the rows; analysis/metrics.test.mjs checks each
// function on hand-made cases with known answers.
//
// A row is one counted bout, seen from fencer A:
//   p        the predicted chance that A wins (winProbability in glicko2.js)
//   aWon     true if A won
//   ratingA, ratingB   each fencer's rating before the competition
// and, for the seeding comparison, seedA, seedB (numbers, or null when the
// sheet has none) and rankedA, rankedB (false for an unranked fencer).

export const COIN_FLIP_BRIER = 0.25;

// The site's five confidence bands, on the favourite's predicted chance.
export const CALIBRATION_EDGES = [0.5, 0.6, 0.7, 0.8, 0.9];
export const GAP_EDGES = [0, 50, 100, 200, 300];
export const WIDE_GAP_EDGES = [0, 100, 200];
export const LEVEL_EDGES = [-Infinity, 1500, 1700];

// The favourite is the fencer with the higher predicted chance. At exactly
// 50% it is fencer A, as predictiveAccuracy in pipeline.js has it.
export function favourite(row) {
  const aIsFav = row.p >= 0.5;
  return { pFav: aIsFav ? row.p : 1 - row.p, favWon: aIsFav ? row.aWon : !row.aWon };
}

// Mean squared error of the predicted chance against the result (1 or 0).
export function brier(rows) {
  if (rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) sum += (r.p - (r.aWon ? 1 : 0)) ** 2;
  return sum / rows.length;
}

// n, Brier score, accuracy (how often the favourite won) and expected
// accuracy (the mean of the favourite's predicted chance: what accuracy would
// be if every predicted chance were exactly right).
export function headline(rows) {
  const n = rows.length;
  if (n === 0) return { n: 0, brier: null, accuracy: null, expectedAccuracy: null };
  let correct = 0, expected = 0;
  for (const r of rows) {
    const { pFav, favWon } = favourite(r);
    if (favWon) correct++;
    expected += pFav;
  }
  return { n, brier: brier(rows), accuracy: correct / n, expectedAccuracy: expected / n };
}

// Which band a value falls in. `edges` are the bands' lower bounds, ascending;
// a band includes its lower bound and runs up to the next one, and the last
// band has no upper bound. Returns -1 for a value below the first edge.
export function bandIndex(value, edges) {
  let i = -1;
  for (let k = 0; k < edges.length; k++) if (value >= edges[k]) i = k;
  return i;
}

export const ratingGap = (row) => Math.abs(row.ratingA - row.ratingB);
export const ratingLevel = (row) => (row.ratingA + row.ratingB) / 2;

// Split rows into ordered bands by `valueOf(row)`. Each group keeps the sums
// its rates are worked out from, so merged groups stay exact.
//   lo, hi     the band's bounds (hi is null for the open-ended last band)
//   n          bouts
//   sumPFav    sum of the favourite's predicted chance
//   favWins    bouts the favourite won
export function bandGroups(rows, edges, valueOf, top = null) {
  const groups = edges.map((lo, i) => ({
    lo, hi: i + 1 < edges.length ? edges[i + 1] : top, n: 0, sumPFav: 0, favWins: 0, merged: 1,
  }));
  for (const r of rows) {
    const i = bandIndex(valueOf(r), edges);
    if (i < 0) throw new Error(`value ${valueOf(r)} is below the first band`);
    const { pFav, favWon } = favourite(r);
    groups[i].n++;
    groups[i].sumPFav += pFav;
    if (favWon) groups[i].favWins++;
  }
  return groups;
}

// Predicted and observed win rate of the favourite in one group.
export function rates(group) {
  return {
    predicted: group.n ? group.sumPFav / group.n : null,
    observed: group.n ? group.favWins / group.n : null,
  };
}

// Calibration: bands on the favourite's predicted chance, 50% to 100%.
export function calibrationBins(rows, edges = CALIBRATION_EDGES) {
  return bandGroups(rows, edges, (r) => favourite(r).pFav, 1);
}

const join = (a, b) => ({
  lo: a.lo, hi: b.hi, n: a.n + b.n, sumPFav: a.sumPFav + b.sumPFav, favWins: a.favWins + b.favWins,
  merged: a.merged + b.merged,
});

// The plan: "Any group with fewer than 100 bouts is merged with its neighbour."
// For ordered bands: take the smallest group under `min` (the lowest band on a
// tie) and join it to its neighbour; where it has two, the one with fewer
// bouts (the lower band on a tie). Repeat until every group has `min` bouts or
// one group is left. Returns { groups, log }, the log naming each merge.
export function mergeSmall(groups, min = 100, label = (g) => `${g.lo} to ${g.hi ?? 'up'}`) {
  let out = groups.map((g) => ({ ...g }));
  const log = [];
  while (out.length > 1) {
    let i = -1;
    for (let k = 0; k < out.length; k++) if (out[k].n < min && (i < 0 || out[k].n < out[i].n)) i = k;
    if (i < 0) break;
    let j;
    if (i === 0) j = 1;
    else if (i === out.length - 1) j = i - 1;
    else j = out[i + 1].n < out[i - 1].n ? i + 1 : i - 1;
    const [a, b] = i < j ? [i, j] : [j, i];
    log.push(`${label(out[i])} (${out[i].n} bouts) merged with ${label(out[j])} (${out[j].n} bouts)`);
    out = [...out.slice(0, a), join(out[a], out[b]), ...out.slice(b + 1)];
  }
  return { groups: out, log };
}

// The same rule for groups with no order (the three weapons), which have no
// neighbour: the smallest group under `min` joins the next-smallest group.
// Groups are { name, rows }; a merged group's name joins the two with " + ".
export function mergeSmallUnordered(groups, min = 100) {
  let out = groups.map((g) => ({ name: g.name, rows: [...g.rows] }));
  const log = [];
  while (out.length > 1) {
    const order = out.map((g, i) => i).sort((a, b) => out[a].rows.length - out[b].rows.length || a - b);
    const [i, j] = order;
    if (out[i].rows.length >= min) break;
    log.push(`${out[i].name} (${out[i].rows.length} bouts) merged with ${out[j].name} (${out[j].rows.length} bouts)`);
    const [a, b] = i < j ? [i, j] : [j, i];
    const merged = { name: `${out[a].name} + ${out[b].name}`, rows: [...out[a].rows, ...out[b].rows] };
    out = [...out.slice(0, a), merged, ...out.slice(a + 1, b), ...out.slice(b + 1)];
  }
  return { groups: out, log };
}

// FeNZ ranking against FencingStatsNZ rating. The FeNZ-higher fencer has the
// lower seed number; the FencingStatsNZ-higher fencer has the higher rating.
// A bout is a disagreement when those are different fencers.
//   total            bouts given
//   unranked         left out: either fencer is unranked or has no seed
//   equalSeed        left out: both have the same seed number
//   equalRating      not a disagreement: both have the same rating
//   agree            both pick the same fencer
//   disagree         the two pick different fencers
//   fenzHigherWon, fsnzHigherWon   who won the disagreement bouts
export function disagreement(rows) {
  const out = { total: rows.length, unranked: 0, equalSeed: 0, equalRating: 0, agree: 0, disagree: 0, fenzHigherWon: 0, fsnzHigherWon: 0 };
  const seeded = (seed, ranked) => ranked !== false && Number.isFinite(seed);
  for (const r of rows) {
    if (!seeded(r.seedA, r.rankedA) || !seeded(r.seedB, r.rankedB)) { out.unranked++; continue; }
    if (r.seedA === r.seedB) { out.equalSeed++; continue; }
    if (r.ratingA === r.ratingB) { out.equalRating++; continue; }
    const fenzPicksA = r.seedA < r.seedB;
    const fsnzPicksA = r.ratingA > r.ratingB;
    if (fenzPicksA === fsnzPicksA) { out.agree++; continue; }
    out.disagree++;
    if (fenzPicksA === r.aWon) out.fenzHigherWon++;
    else out.fsnzHigherWon++;
  }
  return out;
}

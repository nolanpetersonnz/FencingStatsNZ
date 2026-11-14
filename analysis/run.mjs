#!/usr/bin/env node
// analysis/run.mjs: runs the accuracy analysis of PREREGISTRATION.md.
//
//   node analysis/run.mjs
//
// reads every CSV in ingest/ the way the site does, rates the bouts with the
// site's own pipeline and settings, and writes
//
//   analysis/ANALYSIS.md          tables, sample sizes and settings; every
//                                 interpretive sentence is a slot for Nolan
//   analysis/results/*.csv        one CSV per table
//   analysis/results/*.svg        the calibration chart and the rating gap chart
//
// It changes nothing outside analysis/. The same inputs give the same files.
//
// A run on other dates is a rehearsal of the code, not the analysis: it must
// be given --out, and its ANALYSIS.md says so on the first line.
//
//   node analysis/run.mjs --from 2026-03-01 --to 2026-07-20 --out <a folder outside the repo>

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseCSV, processBouts, predictiveAccuracy, dedupeBouts, nameKey } from '../frontend/src/data/pipeline.js';
import { winProbability } from '../frontend/src/engine/glicko2.js';
import { DEFAULT_SETTINGS as S } from '../frontend/src/constants.js';
import * as M from './metrics.mjs';
import { calibrationChart, gapChart } from './charts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const INGEST = resolve(REPO, 'ingest');

// ---- The plan's constants ---------------------------------------------------
const PLAN_FROM = '2026-07-20';   // "bouts from competitions from 20 July 2026 onwards"
const MIN_GROUP = 100;            // "Any group with fewer than 100 bouts is merged with its neighbour"
const FEW_PRIOR = 10;             // "a fencer with fewer than 10 prior bouts"
const SLOT = '> [NOLAN: what this shows]';

// What the Method tab showed when the sanity check was made, typed in from the
// page: bouts scored, accuracy, and the five bands (bouts, predicted, observed).
const METHOD_TAB = {
  read: '14 November 2026',
  where: 'the Method tab of the intl-results-prototype preview deployment (built from commit d981950), both streams, all bouts',
  n: 19300,
  accuracy: '68.4%',
  bands: [[7099, '54.0%', '55.4%'], [4925, '64.8%', '65.3%'], [3789, '74.7%', '76.8%'], [2576, '84.6%', '87.9%'], [911, '93.1%', '97.1%']],
};

// What each commit to the rating code since the cut-off changed, read from its
// diff. A commit not listed here is reported as not described.
const RATING_FILES = ['frontend/src/constants.js', 'frontend/src/engine/glicko2.js', 'frontend/src/data/pipeline.js'];
const CHANGE_NOTES = {
  '218aa0f': 'A win on priority (flag `pri_a` or `pri_b`) is rated as a win. Before, a bout with level scores was rated as a draw. One bout in the dataset carries the flag.',
  'f70b6b8': 'Adds expected accuracy to `predictiveAccuracy`. No change to ratings.',
  '2d5dc0a': 'Adds the header\'s data feed note below `DEFAULT_SETTINGS`. No change to the settings.',
  '13f1c73': 'Turns the header\'s data feed note off. No change to the settings.',
};

// ---- Arguments --------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const FROM = arg('from', PLAN_FROM);
const TO = arg('to', null);
const OUT = resolve(arg('out', HERE));
const REHEARSAL = FROM !== PLAN_FROM || TO !== null;
if (REHEARSAL && OUT === HERE) throw new Error('A run on other dates is a rehearsal: give it --out, so it cannot overwrite the analysis.');
const RESULTS = resolve(OUT, 'results');
mkdirSync(RESULTS, { recursive: true });

// ---- Small helpers ----------------------------------------------------------
const pct = (v, d = 1) => (v == null ? '' : `${(v * 100).toFixed(d)}%`);
const dec = (v, d = 4) => (v == null ? '' : v.toFixed(d));
const int = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const table = (head, rows, right = []) => [
  `| ${head.join(' | ')} |`,
  `| ${head.map((_, i) => (right.includes(i) ? '---:' : '---')).join(' | ')} |`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
].join('\n');
const git = (...a) => { try { return execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const gitOk = (...a) => { try { execFileSync('git', a, { cwd: REPO, stdio: 'ignore' }); return true; } catch { return false; } };

function writeCsv(name, cols, rows) {
  const cell = (v) => {
    const s = v == null ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(6)) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  writeFileSync(resolve(RESULTS, name), [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
}

const checks = [];
const check = (fact) => { checks.push(fact); return `[CHECK ${checks.length}] ${fact}`; };
const mergeLog = [];   // { table, subset, text }: every merge of a group under 100 bouts
const smallLeft = [];  // groups still under 100 bouts after merging

// ---- Load the data the way the site does ------------------------------------
const files = readdirSync(INGEST).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
const rawBouts = files.flatMap((f) => parseCSV(readFileSync(resolve(INGEST, f), 'utf8')));

// Name merges. The site rewrites fencer names on the raw bouts before
// processBouts runs (mergedRawBouts in frontend/src/App.jsx); this is that code.
const mergeDoc = JSON.parse(readFileSync(resolve(HERE, 'merges.json'), 'utf8')).merges;
const siteMerges = Object.fromEntries(Object.entries(mergeDoc).filter(([, m]) => m.on_site));
function applyMerges(raw, merges) {
  const sources = Object.keys(merges);
  if (sources.length === 0) return raw;
  const targetNames = {};
  for (const src of sources) {
    const m = merges[src];
    if (m?.merge_into_name) targetNames[m.merge_into] = m.merge_into_name;
  }
  for (const b of raw) {
    const ka = nameKey(b.fencer_a), kb = nameKey(b.fencer_b);
    if (ka && !targetNames[ka]) targetNames[ka] = b.fencer_a;
    if (kb && !targetNames[kb]) targetNames[kb] = b.fencer_b;
  }
  return raw.map((b) => {
    const ta = merges[nameKey(b.fencer_a)]?.merge_into;
    const tb = merges[nameKey(b.fencer_b)]?.merge_into;
    if (!ta && !tb) return b;
    const next = { ...b };
    if (ta) next.fencer_a = targetNames[ta] || ta;
    if (tb) next.fencer_b = targetNames[tb] || tb;
    return next;
  });
}
const mergedKey = (name) => { const k = nameKey(name); return mergeDoc[k]?.merge_into || k; };

// ---- Sanity check against the Method tab ------------------------------------
// The site as it is now: the CSVs, the site's own merges, predictiveAccuracy.
const site = processBouts(applyMerges(rawBouts, siteMerges), S);
const siteAll = predictiveAccuracy(site.bouts, { initialRD: S.initialRD });
const csvOnly = predictiveAccuracy(processBouts(rawBouts, S).bouts, { initialRD: S.initialRD });
const tabMatches = siteAll.n === METHOD_TAB.n && pct(siteAll.accuracy) === METHOD_TAB.accuracy
  && siteAll.buckets.every((b, i) => b.n === METHOD_TAB.bands[i][0] && pct(b.predicted) === METHOD_TAB.bands[i][1] && pct(b.observed) === METHOD_TAB.bands[i][2]);
if (!tabMatches) {
  throw new Error(`Sanity check failed. With the site's merges this run scores ${siteAll.n} bouts at ${pct(siteAll.accuracy)}; `
    + `the Method tab showed ${METHOD_TAB.n} at ${METHOD_TAB.accuracy} on ${METHOD_TAB.read}. Stopped: nothing written.`);
}

// ---- The analysis dataset ---------------------------------------------------
const { bouts } = processBouts(applyMerges(rawBouts, mergeDoc), S);
const inTest = (b) => b.date >= FROM && (!TO || b.date < TO);

// Which bouts count (the plan): no withdrawals, no ties, no wins on priority.
const reasonOut = (b) => (b.withdrawal ? 'withdrawal' : !b.winnerKey ? 'tie' : b.priority ? 'priority' : null);
const toRow = (b) => ({
  p: winProbability(b.ratingABefore, b.rdABefore, b.ratingBBefore, b.rdBBefore),
  aWon: b.winnerKey === b.keyA,
  ratingA: b.ratingABefore, ratingB: b.ratingBBefore,
  established: b.rdABefore < S.initialRD && b.rdBBefore < S.initialRD,
  type: b.type, weapon: b.weapon, bout: b,
});
const testBouts = bouts.filter(inTest);
const fullRows = bouts.filter((b) => !reasonOut(b)).map(toRow);
const testRows = testBouts.filter((b) => !reasonOut(b)).map(toRow);
if (testRows.length === 0) throw new Error(`No bouts from ${FROM}${TO ? ` to ${TO}` : ' onwards'}.`);
const SUBSETS = [['All bouts', (rows) => rows], ['Established only', (rows) => rows.filter((r) => r.established)]];

// Prior rated bouts: for each bout, how many rated bouts each fencer had in the
// same weapon and stream in earlier competitions. processBouts emits a
// competition's bouts together, in date order.
const periodOf = (b) => `${b.date}|${b.competition}|${b.weapon}`;
const prior = new Map();
{
  const seen = new Map();
  const key = (k, b) => `${k}|${b.weapon}|${b.type}`;
  for (let i = 0; i < bouts.length;) {
    let j = i;
    while (j < bouts.length && periodOf(bouts[j]) === periodOf(bouts[i])) j++;
    for (let k = i; k < j; k++) prior.set(bouts[k].id, Math.min(seen.get(key(bouts[k].keyA, bouts[k])) || 0, seen.get(key(bouts[k].keyB, bouts[k])) || 0));
    for (let k = i; k < j; k++) {
      if (bouts[k].withdrawal) continue;
      for (const f of [bouts[k].keyA, bouts[k].keyB]) seen.set(key(f, bouts[k]), (seen.get(key(f, bouts[k])) || 0) + 1);
    }
    i = j;
  }
}

// ---- Tables -----------------------------------------------------------------
const STREAMS = [['Pool', 'pool'], ['DE', 'de']];
const WEAPONS = [['Epee', 'epee'], ['Foil', 'foil'], ['Sabre', 'sabre']];

// Section 2: counts.
const countBy = (list, get) => (value) => list.filter((x) => get(x) === value).length;
const counts = [
  ['All', (x) => true],
  ...STREAMS.map(([name, v]) => [name, (b) => b.type === v]),
  ...WEAPONS.map(([name, v]) => [name, (b) => b.weapon === v]),
].map(([group, keep]) => ({
  group,
  full: bouts.filter(keep).length,
  fullCounted: fullRows.filter((r) => keep(r.bout)).length,
  test: testBouts.filter(keep).length,
  testCounted: testRows.filter((r) => keep(r.bout)).length,
}));
const range = (list) => { const d = list.map((b) => b.date).sort(); return `${d[0]} to ${d[d.length - 1]}`; };
const REASONS = [['withdrawal', 'Withdrawal or walkover (flag `wd_a`, `wd_b` or `wd`)'], ['tie', 'Tie (level scores, no winner marked)'], ['priority', 'Win on priority (flag `pri_a` or `pri_b`)']];
const exclusions = REASONS.map(([reason, label]) => ({
  reason, label, full: bouts.filter((b) => reasonOut(b) === reason).length, test: testBouts.filter((b) => reasonOut(b) === reason).length,
}));
const excludedTest = testBouts.filter(reasonOut).map((b) => ({
  date: b.date, competition: b.competition, weapon: b.weapon, stream: b.type, round: b.deRound,
  fencer_a: b.keyA, fencer_b: b.keyB, score: `${b.scoreA}-${b.scoreB}`, winner: b.winnerKey || '', reason: reasonOut(b),
}));
const baseName = (c) => c.replace(/ - (Mens|Womens)$/, '').replace(/ Mixed$/, '');
const competitions = [...new Set(testBouts.map((b) => `${b.date}|${baseName(b.competition)}`))].sort().map((k) => {
  const [date, name] = k.split('|');
  const here = (b) => b.date === date && baseName(b.competition) === name;
  return {
    date, competition: name,
    events: new Set(testBouts.filter(here).map((b) => `${b.competition}|${b.weapon}`)).size,
    pool: testBouts.filter((b) => here(b) && b.type === 'pool').length,
    de: testBouts.filter((b) => here(b) && b.type === 'de').length,
    counted: testRows.filter((r) => here(r.bout)).length,
  };
});

// The site's current method on the test set: predictiveAccuracy counts a win on
// priority as a result.
const siteMethodTest = SUBSETS.map(([subset], i) => ({ subset, ...predictiveAccuracy(testBouts, { initialRD: S.initialRD, establishedOnly: i === 1 }) }));

// Section 4: headline.
const headlineRows = [];
for (const [subset, pick] of SUBSETS) {
  headlineRows.push({ subset, set: 'Test set', ...M.headline(pick(testRows)) });
  headlineRows.push({ subset, set: 'Full dataset, the plan\'s rules', ...M.headline(pick(fullRows)) });
  const now = predictiveAccuracy(site.bouts, { initialRD: S.initialRD, establishedOnly: subset !== 'All bouts' });
  headlineRows.push({ subset, set: 'Full dataset, as the Method page shows it now', n: now.n, brier: now.brier, accuracy: now.accuracy, expectedAccuracy: now.expectedAccuracy });
}

// Banded tables: split, merge groups under 100 bouts, work out the rates.
const calLabel = (g) => `${pct(g.lo, 0)} to ${pct(g.hi, 0)}`;
const gapLabel = (g) => (g.hi == null ? (g.lo === 0 ? 'all gaps' : `${g.lo} and over`) : `${g.lo} to ${g.hi}`);
const gapTick = (g) => (g.hi == null ? `${g.lo}+` : `${g.lo}–${g.hi}`);
const levelLabel = (g) => (g.lo === -Infinity ? (g.hi == null ? 'all levels' : `below ${g.hi}`) : g.hi == null ? `${g.lo} and over` : `${g.lo} to ${g.hi}`);
function banded(rows, edges, valueOf, top, label, name, subset) {
  const { groups, log } = M.mergeSmall(M.bandGroups(rows, edges, valueOf, top), MIN_GROUP, label);
  for (const text of log) mergeLog.push({ table: name, subset, text });
  for (const g of groups) if (g.n < MIN_GROUP) smallLeft.push({ table: name, subset, group: label(g), n: g.n });
  return groups.map((g) => ({ subset, band: label(g), lo: g.lo, hi: g.hi, n: g.n, ...M.rates(g), bands_merged: g.merged }));
}
function split(rows, names, field, name, subset) {
  const { groups, log } = M.mergeSmallUnordered(names.map(([label, v]) => ({ name: label, rows: rows.filter((r) => r[field] === v) })), MIN_GROUP);
  for (const text of log) mergeLog.push({ table: name, subset, text });
  for (const g of groups) if (g.rows.length < MIN_GROUP) smallLeft.push({ table: name, subset, group: g.name, n: g.rows.length });
  return groups.map((g) => ({ subset, group: g.name, ...M.headline(g.rows), rows: g.rows }));
}

const pFav = (r) => M.favourite(r).pFav;
const calibration = [], gap = [], level = [], gapInLevel = [], byStream = [], byWeapon = [];
for (const [subset, pick] of SUBSETS) {
  const rows = pick(testRows);
  calibration.push(...banded(rows, M.CALIBRATION_EDGES, pFav, 1, calLabel, 'Calibration', subset));
  gap.push(...banded(rows, M.GAP_EDGES, M.ratingGap, null, gapLabel, 'Rating gap', subset));
  const levels = banded(rows, M.LEVEL_EDGES, M.ratingLevel, null, levelLabel, 'Rating level', subset);
  level.push(...levels);
  for (const lv of levels) {
    const inLevel = rows.filter((r) => M.ratingLevel(r) >= lv.lo && (lv.hi == null || M.ratingLevel(r) < lv.hi));
    gapInLevel.push(...banded(inLevel, M.WIDE_GAP_EDGES, M.ratingGap, null, gapLabel, `Rating gap within level ${lv.band}`, subset)
      .map((g) => ({ ...g, level: lv.band })));
  }
  byStream.push(...split(rows, STREAMS, 'type', 'Pool and DE', subset));
  byWeapon.push(...split(rows, WEAPONS, 'weapon', 'Weapon', subset));
}

// Section 10: what the Method page shows, on the test set.
const methodPage = [], methodBands = [];
for (const [streamName, streamValue] of [['Both streams', null], ...STREAMS]) {
  for (const [subset, pick] of SUBSETS) {
    const rows = pick(testRows).filter((r) => !streamValue || r.type === streamValue);
    methodPage.push({ stream: streamName, subset, ...M.headline(rows) });
    methodBands.push(...banded(rows, M.CALIBRATION_EDGES, pFav, 1, calLabel, `Method page bands, ${streamName}`, subset).map((g) => ({ stream: streamName, ...g })));
  }
}

// Section 11: bouts with a fencer who has few prior bouts.
const fewPrior = SUBSETS.map(([subset, pick]) => {
  const rows = pick(testRows);
  return { subset, n: rows.length, few: rows.filter((r) => prior.get(r.bout.id) < FEW_PRIOR).length, none: rows.filter((r) => prior.get(r.bout.id) === 0).length };
});
const levelCalls = testRows.filter((r) => r.p === 0.5).length;
let intl = null;
try {
  const doc = JSON.parse(readFileSync(resolve(INGEST, 'intl_results.json'), 'utf8'));
  intl = { placings: doc.results.length, events: new Set(doc.results.map((r) => `${r.event}|${r.date}`)).size };
} catch { /* no file: reported as such */ }

// ---- Section 6: FeNZ ranking against FencingStatsNZ rating --------------------
// analysis/seeds.csv is entered by hand from FencingTimeLive (see fetch_seeds.py).
const seedsFile = resolve(HERE, 'seeds.csv');
const eventKey = (competition, weapon) => `${competition}|${weapon}`;
const testEvents = [...new Set(testBouts.map((b) => eventKey(b.competition, b.weapon)))].sort();
const seeding = { entered: !REHEARSAL && existsSync(seedsFile), events: new Map(), problems: [] };
if (seeding.entered) {
  for (const r of parseCSV(readFileSync(seedsFile, 'utf8'))) {
    const k = eventKey(r.competition, r.weapon);
    if (!seeding.events.has(k)) seeding.events.set(k, { label: r.event, fencers: new Map() });
    const seedText = (r.seed || '').trim();
    if (seedText && !/^\d+$/.test(seedText)) seeding.problems.push(`${k}: ${r.fencer} has seed "${seedText}"`);
    const ranked = /^n/i.test(r.ranked || '') ? false : /^y/i.test(r.ranked || '') ? true : null;
    seeding.events.get(k).fencers.set(mergedKey(r.fencer), { seed: /^\d+$/.test(seedText) ? Number(seedText) : null, ranked });
  }
  for (const [k, ev] of seeding.events) {
    const seeds = [...ev.fencers.values()].map((f) => f.seed).filter((s) => s != null);
    const twice = [...new Set(seeds.filter((s, i) => seeds.indexOf(s) !== i))];
    if (twice.length) seeding.problems.push(`${k}: seed ${twice.join(', ')} entered more than once`);
  }
  if (seeding.problems.length) throw new Error(`analysis/seeds.csv needs fixing:\n  ${seeding.problems.join('\n  ')}`);
}
const hasSeeds = (k) => [...(seeding.events.get(k)?.fencers.values() || [])].some((f) => f.seed != null);
const noSeeding = testEvents.filter((k) => !hasSeeds(k));
const seedRow = (r) => {
  const ev = seeding.events.get(eventKey(r.bout.competition, r.bout.weapon));
  const a = ev.fencers.get(r.bout.keyA) || {}, b = ev.fencers.get(r.bout.keyB) || {};
  return { ...r, seedA: a.seed ?? null, seedB: b.seed ?? null, rankedA: a.ranked ?? null, rankedB: b.ranked ?? null };
};
const isDisagreement = (r) => M.disagreement([r]).disagree === 1;
const seedingTable = [], seedingStreams = [];
for (const [subset, pick] of SUBSETS) {
  const rows = pick(testRows);
  const seeded = rows.filter((r) => hasSeeds(eventKey(r.bout.competition, r.bout.weapon))).map(seedRow);
  const d = M.disagreement(seeded);
  seedingTable.push({ subset, counted: rows.length, no_seeding: rows.length - seeded.length, ...d });
  const groups = M.mergeSmallUnordered(STREAMS.map(([name, v]) => ({ name, rows: seeded.filter((r) => r.type === v && isDisagreement(r)) })), MIN_GROUP);
  for (const text of groups.log) mergeLog.push({ table: 'Disagreement bouts by stream', subset, text });
  for (const g of groups.groups) {
    const s = M.disagreement(g.rows);
    if (seeding.entered && s.disagree < MIN_GROUP) smallLeft.push({ table: 'Disagreement bouts by stream', subset, group: g.name, n: s.disagree });
    seedingStreams.push({ subset, stream: g.name, disagree: s.disagree, fenzHigherWon: s.fenzHigherWon, fsnzHigherWon: s.fsnzHigherWon });
  }
}

// ---- Commits and the rating code --------------------------------------------
const lastCommit = (...paths) => git('log', '-1', '--format=%H', '--', ...paths) || 'unknown';
const head = git('rev-parse', 'HEAD') || 'unknown';
const dirty = git('status', '--porcelain', '--', 'analysis/run.mjs', 'analysis/metrics.mjs', 'analysis/charts.mjs', 'analysis/merges.json', 'analysis/seeds.csv', 'frontend/src', 'ingest') !== '';
const commits = {
  code: head + (dirty ? ' (with uncommitted changes)' : ''),
  rating: lastCommit(...RATING_FILES),
  data: lastCommit(...files.map((f) => `ingest/${f}`)),
  plan: lastCommit('PREREGISTRATION.md'),
};
const remote = git('config', '--get', 'remote.origin.url').replace(/\.git$/, '');
const base = git('rev-list', '-1', `--before=${PLAN_FROM}T00:00:00`, 'HEAD');
// The values in the DEFAULT_SETTINGS block of a constants.js, as "key=value"
// pairs, comments left out: compared with the settings this run imported.
const settingsIn = (text) => ((/export const DEFAULT_SETTINGS = \{([\s\S]*?)\r?\n\};/.exec(text) || ['', ''])[1].split(/\r?\n/)
  .map((line) => /^\s*(\w+):\s*(.+?),?\s*$/.exec(line)).filter(Boolean).map((m) => `${m[1]}=${m[2]}`).join(';'));
const settingsNow = Object.entries(S).map(([k, v]) => `${k}=${v}`).join(';');
const ratingCode = base ? {
  base: git('log', '-1', '--format=%h, %ad', '--date=short', base),
  settingsSame: settingsIn(git('show', `${base}:frontend/src/constants.js`)) === settingsNow,
  engineSame: gitOk('diff', '--quiet', base, 'HEAD', '--', 'frontend/src/engine/glicko2.js'),
  since: RATING_FILES.flatMap((file) => git('log', `${base}..HEAD`, '--format=%h|%ad|%s', '--date=short', '--', file).split('\n').filter(Boolean)
    .map((line) => { const [hash, date, subject] = line.split('|'); return { file, hash, date, subject, note: CHANGE_NOTES[hash] || 'Not described.' }; })),
} : null;

// ---- CSVs -------------------------------------------------------------------
const H = ['n', 'brier', 'accuracy', 'expectedAccuracy'];
writeCsv('data_counts.csv', ['group', 'full', 'fullCounted', 'test', 'testCounted'], counts);
writeCsv('exclusions.csv', ['reason', 'full', 'test'], exclusions);
writeCsv('excluded_test_bouts.csv', ['date', 'competition', 'weapon', 'stream', 'round', 'fencer_a', 'fencer_b', 'score', 'winner', 'reason'], excludedTest);
writeCsv('test_competitions.csv', ['date', 'competition', 'events', 'pool', 'de', 'counted'], competitions);
writeCsv('headline.csv', ['subset', 'set', ...H], headlineRows);
writeCsv('site_method_on_test_set.csv', ['subset', ...H], siteMethodTest);
writeCsv('calibration.csv', ['subset', 'band', 'n', 'predicted', 'observed', 'bands_merged'], calibration);
writeCsv('seeding_disagreement.csv', ['subset', 'counted', 'no_seeding', 'unranked', 'equalSeed', 'equalRating', 'agree', 'disagree', 'fenzHigherWon', 'fsnzHigherWon'], seedingTable);
writeCsv('seeding_disagreement_by_stream.csv', ['subset', 'stream', 'disagree', 'fenzHigherWon', 'fsnzHigherWon'], seedingStreams);
writeCsv('rating_gap.csv', ['subset', 'band', 'n', 'predicted', 'observed', 'bands_merged'], gap);
writeCsv('rating_level.csv', ['subset', 'band', 'n', 'predicted', 'observed', 'bands_merged'], level);
writeCsv('rating_gap_within_level.csv', ['subset', 'level', 'band', 'n', 'predicted', 'observed', 'bands_merged'], gapInLevel);
writeCsv('split_pool_de.csv', ['subset', 'group', ...H], byStream);
writeCsv('split_weapon.csv', ['subset', 'group', ...H], byWeapon);
writeCsv('all_vs_established.csv', ['subset', ...H], SUBSETS.map(([subset, pick]) => ({ subset, ...M.headline(pick(testRows)) })));
writeCsv('method_page.csv', ['stream', 'subset', ...H], methodPage);
writeCsv('method_page_bands.csv', ['stream', 'subset', 'band', 'n', 'predicted', 'observed', 'bands_merged'], methodBands);
writeCsv('few_prior_bouts.csv', ['subset', 'n', 'few', 'none'], fewPrior);
writeCsv('merge_log.csv', ['table', 'subset', 'text'], mergeLog);

// ---- Charts -----------------------------------------------------------------
const panels = (rows, tick) => SUBSETS.map(([subset, pick]) => ({
  title: `${subset} (${int(pick(testRows).length)} bouts)`,
  points: rows.filter((r) => r.subset === subset && r.n > 0).map((r) => ({ label: r.band, tick: tick ? tick(r) : r.band, predicted: r.predicted, observed: r.observed, n: r.n })),
}));
const window = TO ? `${FROM} to ${TO}` : `from ${FROM}`;
writeFileSync(resolve(RESULTS, 'calibration.svg'), calibrationChart({
  title: `Calibration, ${REHEARSAL ? 'rehearsal' : 'test set'}`,
  subtitle: `Bouts ${window}. Favourite: the fencer with the higher predicted chance.`,
  panels: panels(calibration),
}));
writeFileSync(resolve(RESULTS, 'rating_gap.svg'), gapChart({
  title: `Win rate of the higher-rated fencer by rating gap, ${REHEARSAL ? 'rehearsal' : 'test set'}`,
  subtitle: `Bouts ${window}. Predicted and observed, for each band of the gap between the two ratings.`,
  panels: panels(gap, gapTick),
}));

// ---- ANALYSIS.md ------------------------------------------------------------
// The merges made in one table. With `family`, the tables whose names start
// with `name` (the gap table of each rating level).
const tableLog = (name, family = false) => {
  const lines = mergeLog.filter((m) => (family ? m.table.startsWith(`${name} `) : m.table === name));
  return lines.length ? `Groups under ${MIN_GROUP} bouts, merged:\n\n${lines.map((m) => `- ${m.subset}${family ? `, level ${m.table.slice(name.length + 1)}` : ''}: ${m.text}.`).join('\n')}` : `No group had fewer than ${MIN_GROUP} bouts.`;
};
const headlineCells = (r) => [int(r.n), dec(r.brier), pct(r.accuracy), pct(r.expectedAccuracy)];
const bandCells = (r) => [r.band, int(r.n), pct(r.predicted), pct(r.observed)];
const test = headlineRows.find((r) => r.subset === 'All bouts' && r.set === 'Test set');
const full = headlineRows.find((r) => r.subset === 'All bouts' && r.set.includes('plan'));
const priorityTest = exclusions.find((e) => e.reason === 'priority').test;
const out = [];
const add = (...lines) => out.push(...lines, '');

if (REHEARSAL) add(`**REHEARSAL of the code on bouts ${window}. This is not the preregistered test set and these are not results.**`);
add('# Accuracy analysis: results');
add('Written by `analysis/run.mjs`. It holds tables, sample sizes and settings. Each `[NOLAN: ...]` line is a slot for the interpretation, and each `[CHECK n]` is one fact to look at.');

add('## 1. Question');
add(SLOT);

add('## 2. Data and test set');
add('### Bouts');
add(`The full dataset is every bout in ${files.map((f) => `\`ingest/${f}\``).join(' and ')}: ${int(rawBouts.length)} rows, ${int(dedupeBouts(rawBouts).length)} bouts once mixed events are folded. The test set is every bout from a competition dated ${TO ? `${FROM} to ${TO}` : `${FROM} or later`}. The full dataset includes the test set.`);
add(table(['', 'Full dataset', 'Full dataset, counted', 'Test set', 'Test set, counted'],
  [...counts.map((c) => [c.group === 'All' ? 'All bouts' : c.group, int(c.full), int(c.fullCounted), int(c.test), int(c.testCounted)]),
    ['Date range', range(bouts), '', range(testBouts), '']], [1, 2, 3, 4]));
add('"Counted" leaves out the bouts in the next table.');
add('### Bouts that do not count');
add(table(['Reason', 'Full dataset', 'Test set'], [
  ...exclusions.map((e) => [e.label, int(e.full), int(e.test)]),
  ['P-black card', 'not marked', 'not marked'],
], [1, 2]));
add('The data has no marker for a P-black card. The results portal, which supplies every test-set bout, shows no exclusion markers. The older data folds exclusions (codes `E` and `EXC`) into the withdrawal flag without saying which card. So no bout could be left out for this reason.');
if (excludedTest.length) {
  add('Test-set bouts left out:');
  add(table(['Date', 'Competition', 'Weapon', 'Round', 'Fencers', 'Score', 'Reason'],
    excludedTest.map((b) => [b.date, b.competition, b.weapon, b.round || b.stream, `${b.fencer_a} v ${b.fencer_b}`, b.score, b.reason + (b.winner ? `, ${b.winner} won` : '')])));
}
add(check(`The plan says one win on priority is confirmed in the test set. The data flags ${priorityTest}.`));
add('### Difference from the site\'s current method');
add(`\`predictiveAccuracy\` in \`pipeline.js\` leaves out withdrawals and ties and counts a win on priority as a result. The plan leaves out wins on priority too. So the figures here come from this script's own loop over \`winProbability\`, not from \`predictiveAccuracy\`. On the test set:`);
add(table(['', 'Bouts', 'Brier', 'Accuracy', 'Expected accuracy'], SUBSETS.flatMap(([subset], i) => [
  [`${subset}, the plan's rules`, ...headlineCells(headlineRows.find((r) => r.subset === subset && r.set === 'Test set'))],
  [`${subset}, \`predictiveAccuracy\``, ...headlineCells(siteMethodTest[i])],
]), [1, 2, 3, 4]));
add('### Name merges and the sanity check');
add('The site rewrites fencer names on the raw bouts before rating them, from merges kept in its live override store. They are not in the repo, so they are recorded in `analysis/merges.json` and applied here the same way:');
add(table(['Name key', 'Merged into', 'On the site', 'Source'], Object.entries(mergeDoc).map(([k, m]) => [`\`${k}\``, m.merge_into_name, m.on_site ? 'yes' : 'no', m.source])));
add(`Sanity check. With the site's own merges, \`predictiveAccuracy\` on the full dataset scores ${int(siteAll.n)} bouts at ${pct(siteAll.accuracy)}, and the five bands match too. That is what ${METHOD_TAB.where} showed on ${METHOD_TAB.read}: ${int(METHOD_TAB.n)} bouts at ${METHOD_TAB.accuracy}. With no merges the same run scores ${int(csvOnly.n)} bouts at ${pct(csvOnly.accuracy)}.`);
const offSite = Object.entries(mergeDoc).filter(([, m]) => !m.on_site);
if (offSite.length) add(check(`${offSite.length} merge${offSite.length > 1 ? 's are' : ' is'} applied here and not on the site (${offSite.map(([k]) => `\`${k}\``).join(', ')}). Until the site has ${offSite.length > 1 ? 'them' : 'it'}, the Method page will not show exactly these figures.`));
add('### Competitions in the test set');
add(table(['Date', 'Competition', 'Events', 'Pool bouts', 'DE bouts', 'Counted'], competitions.map((c) => [c.date, c.competition, c.events, int(c.pool), int(c.de), int(c.counted)]), [2, 3, 4, 5]));
add('An event is one weapon in one men\'s, women\'s or mixed competition, as the site lists it.');
add('### Competitions with no usable seeding');
if (!seeding.entered) add(`\`analysis/seeds.csv\` has not been entered${REHEARSAL ? ' for these dates' : ' yet'}. Until it is, no competition has usable seeding and section 6 is empty.`);
else if (noSeeding.length === 0) add('None: every test-set event has seeding in `analysis/seeds.csv`.');
else add(`${noSeeding.length} of ${testEvents.length} test-set events have no seeding in \`analysis/seeds.csv\` and are left out of section 6:`, '', noSeeding.map((k) => `- ${k.replace('|', ', ')}`).join('\n'));
add('### Settings used');
add(table(['Setting', 'Value'], [
  ...Object.entries(S).map(([k, v]) => [`\`${k}\``, String(v)]),
  ['Test set', TO ? `competitions dated ${FROM} to ${TO}` : `competitions dated ${FROM} or later`],
  ['Rating used', 'each fencer\'s rating and RD in the bout\'s stream (pool or DE), all age categories together, as they stood before the competition'],
  ['Established bout', `both fencers' RD below \`initialRD\` (${S.initialRD}) before the competition`],
  ['Smallest group reported', `${MIN_GROUP} bouts; a smaller group is merged with its neighbour`],
]));
add('The settings are `DEFAULT_SETTINGS` in `frontend/src/constants.js`, with the upset threshold and multiplier as set there.');
add('### Rating code since the test set began');
if (!ratingCode) add('Git history was not available to this run, so this was not checked.');
else {
  add(`The last commit before ${PLAN_FROM} is ${ratingCode.base}. Since then, \`DEFAULT_SETTINGS\` is ${ratingCode.settingsSame ? 'unchanged' : '**changed**'} and \`frontend/src/engine/glicko2.js\` is ${ratingCode.engineSame ? 'unchanged' : '**changed**'}.`);
  if (ratingCode.since.length) {
    add('Commits since then that touch the settings file, the engine or the pipeline:');
    add(table(['Commit', 'Date', 'File', 'What changed'], ratingCode.since.map((c) => [`\`${c.hash}\``, c.date, `\`${c.file.split('/').pop()}\``, c.note])));
    const rated = ratingCode.since.filter((c) => /rated as a win/.test(c.note));
    const flagged = exclusions.find((e) => e.reason === 'priority');
    if (rated.length) add(check(`\`pipeline.js\` changed how one kind of bout is rated after the test set began (commit ${rated.map((c) => `\`${c.hash}\``).join(', ')}, ${rated[0].date}): a win on priority is rated as a win, not a draw. Bouts in the dataset that carry the flag: ${flagged.full}, of which ${flagged.test} in the test set.`));
  }
}
add('### Commits');
add(table(['What', 'Commit'], [
  ['Analysis code, this run', `\`${commits.code}\``],
  ['Rating code (`constants.js`, `glicko2.js`, `pipeline.js`)', `\`${commits.rating}\``],
  [`Data (${files.map((f) => `\`ingest/${f}\``).join(', ')})`, `\`${commits.data}\``],
  ['`PREREGISTRATION.md`', `\`${commits.plan}\``],
]));

add('## 3. Plan');
add(`[PREREGISTRATION.md](${remote && commits.plan !== 'unknown' ? `${remote}/blob/${commits.plan}/PREREGISTRATION.md` : '../PREREGISTRATION.md'}) at commit \`${commits.plan}\`.`);

add('## 4. Headline');
add('A coin flip scores a Brier of 0.2500 and an accuracy of 50.0%. Expected accuracy is how often the favourite would win if every predicted chance were exactly right.');
add(table(['', 'Bouts', 'Brier', 'Accuracy', 'Expected accuracy'], headlineRows.map((r) => [`${r.set}, ${r.subset.toLowerCase()}`, ...headlineCells(r)]), [1, 2, 3, 4]));
add('The full dataset includes the test set. "As the Method page shows it now" is `predictiveAccuracy` with the site\'s own merges.');
add(check(`Test-set Brier is ${dec(test.brier)} and full-dataset Brier (the plan's rules) is ${dec(full.brier)}: a difference of ${dec(Math.abs(test.brier - full.brier))}.`));
if (levelCalls) add(check(`${levelCalls} counted test-set bout${levelCalls > 1 ? 's have' : ' has'} a predicted chance of exactly 50% (equal ratings). The favourite is then taken as fencer A, as \`predictiveAccuracy\` does.`));
add(SLOT);

add('## 5. Calibration');
add('Test set only. Each bout is counted for its favourite, the fencer with the higher predicted chance. Predicted is the mean predicted chance in the band; observed is how often the favourite won.');
for (const [subset] of SUBSETS) add(`**${subset}**`, '', table(['Confidence band', 'Bouts', 'Predicted', 'Observed'], calibration.filter((r) => r.subset === subset).map(bandCells), [1, 2, 3]));
add(tableLog('Calibration'));
add('![Calibration: observed win rate of the favourite against the predicted rate, by confidence band, for all bouts and for established bouts only](results/calibration.svg)');
add(SLOT);

add('## 6. FeNZ ranking vs FencingStatsNZ rating');
if (!seeding.entered) {
  add(`Not run${REHEARSAL ? ' in a rehearsal' : ' yet'}: \`analysis/seeds.csv\` has not been entered. See Deviations.`);
} else {
  add('Test set only. In each bout the FeNZ-higher fencer is the one with the lower seed number in that event\'s initial seeding, and the FencingStatsNZ-higher fencer is the one with the higher rating before the competition. A disagreement bout is one where those are different fencers.');
  add(table(['', ...SUBSETS.map(([s]) => s)], [
    ['Bouts counted', ...seedingTable.map((r) => int(r.counted))],
    ['Left out: the event has no seeding', ...seedingTable.map((r) => int(r.no_seeding))],
    ['Left out: either fencer unranked or without a seed', ...seedingTable.map((r) => int(r.unranked))],
    ['Left out: both fencers have the same seed', ...seedingTable.map((r) => int(r.equalSeed))],
    ['Both fencers have the same rating', ...seedingTable.map((r) => int(r.equalRating))],
    ['Ranking and rating pick the same fencer', ...seedingTable.map((r) => int(r.agree))],
    ['**Disagreement bouts**', ...seedingTable.map((r) => `**${int(r.disagree)}**`)],
    ['FeNZ-higher fencer won', ...seedingTable.map((r) => `${int(r.fenzHigherWon)} (${pct(r.disagree ? r.fenzHigherWon / r.disagree : null)})`)],
    ['FencingStatsNZ-higher fencer won', ...seedingTable.map((r) => `${int(r.fsnzHigherWon)} (${pct(r.disagree ? r.fsnzHigherWon / r.disagree : null)})`)],
  ], [1, 2]));
  add('Disagreement bouts by stream:');
  add(table(['', 'Stream', 'Disagreement bouts', 'FeNZ-higher won', 'FencingStatsNZ-higher won'], seedingStreams.map((r) => [r.subset, r.stream, int(r.disagree),
    `${int(r.fenzHigherWon)} (${pct(r.disagree ? r.fenzHigherWon / r.disagree : null)})`, `${int(r.fsnzHigherWon)} (${pct(r.disagree ? r.fsnzHigherWon / r.disagree : null)})`]), [2, 3, 4]));
  add(tableLog('Disagreement bouts by stream'));
}
add(SLOT);

add('## 7. Linearity');
add('Test set only. Each bout is counted for its higher-rated fencer, or for fencer A where the two ratings are equal. Predicted is that fencer\'s mean predicted chance in the group; observed is how often they won. A band includes its lower bound.');
add('### By rating gap');
add('The gap is the difference between the two fencers\' ratings before the competition.');
for (const [subset] of SUBSETS) add(`**${subset}**`, '', table(['Rating gap', 'Bouts', 'Predicted', 'Observed'], gap.filter((r) => r.subset === subset).map(bandCells), [1, 2, 3]));
add(tableLog('Rating gap'));
add('![Predicted and observed win rate of the higher-rated fencer by rating gap band, for all bouts and for established bouts only](results/rating_gap.svg)');
add('### By rating level');
add('The level is the mean of the two fencers\' ratings before the competition.');
for (const [subset] of SUBSETS) add(`**${subset}**`, '', table(['Rating level', 'Bouts', 'Predicted', 'Observed'], level.filter((r) => r.subset === subset).map(bandCells), [1, 2, 3]));
add(tableLog('Rating level'));
add('### By rating gap within each rating level');
for (const [subset] of SUBSETS) add(`**${subset}**`, '', table(['Rating level', 'Rating gap', 'Bouts', 'Predicted', 'Observed'], gapInLevel.filter((r) => r.subset === subset).map((r) => [r.level, ...bandCells(r)]), [2, 3, 4]));
add(tableLog('Rating gap within level', true));
add(SLOT);

add('## 8. Splits');
add('Test set only.');
add('### Pool vs DE');
add(table(['', 'Stream', 'Bouts', 'Brier', 'Accuracy', 'Expected accuracy'], byStream.map((r) => [r.subset, r.group, ...headlineCells(r)]), [2, 3, 4, 5]));
add(tableLog('Pool and DE'));
add('### By weapon');
add(table(['', 'Weapon', 'Bouts', 'Brier', 'Accuracy', 'Expected accuracy'], byWeapon.map((r) => [r.subset, r.group, ...headlineCells(r)]), [2, 3, 4, 5]));
add(tableLog('Weapon'));
add(SLOT);

add('## 9. All vs established');
add(`Test set only. An established bout is one where both fencers' RD was below ${S.initialRD} before the competition.`);
add(table(['', 'Bouts', 'Brier', 'Accuracy', 'Expected accuracy'], SUBSETS.map(([subset, pick]) => [subset, ...headlineCells(M.headline(pick(testRows)))]), [1, 2, 3, 4]));
add(SLOT);

add('## 10. Method page figures');
add('The held-out figures for each filter on the Method page: test set only, the plan\'s rules.');
add(table(['Stream', 'Filter', 'Bouts scored', 'Accuracy', 'Expected accuracy', 'Brier'], methodPage.map((r) => [r.stream, r.subset, int(r.n), pct(r.accuracy), pct(r.expectedAccuracy), dec(r.brier)]), [2, 3, 4, 5]));
add('Confidence bands for each filter:');
add(table(['Stream', 'Filter', 'Confidence band', 'Bouts', 'Predicted', 'Observed'], methodBands.map((r) => [r.stream, r.subset, ...bandCells(r)]), [3, 4, 5]));
const pageMerges = mergeLog.filter((m) => m.table.startsWith('Method page bands'));
if (pageMerges.length) add(check(`The Method page shows five bands for every filter. Here ${pageMerges.length} band${pageMerges.length > 1 ? 's' : ''} with fewer than ${MIN_GROUP} test-set bouts ${pageMerges.length > 1 ? 'are' : 'is'} merged with a neighbour (listed in \`results/merge_log.csv\`).`));

add('## 11. Limitations');
add([
  `- International bouts are missing. The old ingest left out competitions the FeNZ API tags \`aus\`, \`int\` or \`fie\` (the default of \`ingest/fenz_ingest.py\`).${intl ? ` NZ fencers' results overseas are in \`ingest/intl_results.json\` as ${int(intl.placings)} placings at ${int(intl.events)} competitions, with no bouts.` : ''}`,
  ...fewPrior.map((f) => `- ${f.subset}: ${int(f.few)} of ${int(f.n)} counted test-set bouts (${pct(f.few / f.n)}) involve a fencer with fewer than ${FEW_PRIOR} prior bouts. ${int(f.none)} involve a fencer with none.`),
].join('\n'));
add('Prior bouts are a fencer\'s rated bouts in the same weapon and the same stream (pool or DE) at earlier competitions in the dataset.');
add(SLOT);

add('## 12. Deviations');
add('### What could not be done as the plan says');
add([
  '1. **Where the FeNZ ranking comes from.** The plan takes it from each competition\'s initial seeding on the FeNZ results portal. The portal shows no seeding. Checked on 14 November 2026: an event\'s Results view lists final rank, name, club and nationality; Pools and Bracket list names and scores; `/rankings` is one current board dated 2026-10-25, after the test-set competitions. The closest source is the initial seeding on FencingTimeLive, which Nolan copies by hand into `analysis/seeds.csv`. `analysis/fetch_seeds.py` writes the sheet he fills in (`analysis/seeds_template.csv`) and fetches no seeds.'
    + (seeding.entered ? '' : ' **The sheet has not been entered yet, so section 6 is empty.**'),
  '2. **Unranked fencers.** The portal does not mark them. The sheet has a `ranked` column for what FencingTimeLive shows.',
  '3. **P-black cards.** The plan leaves them out. The data does not mark them (section 2), so none could be left out.',
  `4. **Loading the data.** The run instructions were to load every CSV in \`ingest/\` through the site's parse and dedupe steps. That alone does not reproduce the Method tab (${pct(csvOnly.accuracy)} against ${METHOD_TAB.accuracy}), because the site also applies name merges from its override store. The run applies the site's merges, which reproduces the tab exactly (section 2).`,
  `5. **One more merge.** Nolan confirmed on 14 November 2026 that Mutian Wang is Tim Wang, before any test-set result was computed. The merge is applied here and is not on the site. Mutian Wang fenced one test-set event.`,
].join('\n'));
add('### Details the plan leaves open, fixed before any test-set result was computed');
add([
  '- **Calibration bands.** The site\'s five, on the favourite\'s predicted chance: 50% to 60%, up to 90% to 100%.',
  '- **Band edges.** A band includes its lower bound: a gap of exactly 50 is in 50 to 100, a level of exactly 1500 is in 1500 to 1700.',
  '- **Equal ratings.** The predicted chance is exactly 50% and the favourite is taken as fencer A, as the site does.',
  `- **Merging a group under ${MIN_GROUP} bouts.** The smallest such group joins its neighbouring band; where it has two, the one with fewer bouts. This repeats until every group has ${MIN_GROUP} bouts. Pool, DE and the weapons have no neighbour, so the smallest joins the next-smallest.`,
  '- **Gap within level.** The level bands are the ones left after merging in the level table.',
  '- **Full dataset.** Shown under the plan\'s rules and as the Method page shows it now.',
  '- **Prior bouts.** Rated bouts in the same weapon and stream at earlier competitions.',
  '- **Disagreement bouts.** Equal ratings are not a disagreement. Equal seeds are left out.',
].join('\n'));
add(`Every merge of a group under ${MIN_GROUP} bouts is listed under its table and in \`results/merge_log.csv\` (${mergeLog.length} in all).`);
if (smallLeft.length) add(check(`${smallLeft.length} group${smallLeft.length > 1 ? 's are' : ' is'} still under ${MIN_GROUP} bouts after merging, because the whole table is: ${smallLeft.map((g) => `${g.table}, ${g.subset.toLowerCase()}, ${g.group} (${g.n} bouts)`).join('; ')}.`));

add('## 13. How to reproduce');
add('From the repo root, with Node 20 or later and no packages to install:');
add('```', 'node --test analysis/metrics.test.mjs    # the metric functions, on hand-made cases', 'node analysis/run.mjs                    # writes analysis/ANALYSIS.md and analysis/results/', '```');
add('The entrant sheet comes from the results portal pages already in `ingest/cache/portal/` (not in the repo). It needs Python 3 with `rapidfuzz` and `requests`, as the portal ingest does:');
add('```', 'python analysis/fetch_seeds.py           # writes analysis/seeds_template.csv; sends no requests', '```');

add('## 14. How AI was used');
add(SLOT);

writeFileSync(resolve(OUT, 'ANALYSIS.md'), out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');

// ---- What ran ---------------------------------------------------------------
console.log(`${REHEARSAL ? 'REHEARSAL' : 'Analysis'}: bouts ${window}`);
console.log(`  full dataset ${int(bouts.length)} bouts, ${int(fullRows.length)} counted; test set ${int(testBouts.length)} bouts, ${int(testRows.length)} counted`);
console.log(`  sanity check: ${int(siteAll.n)} bouts at ${pct(siteAll.accuracy)} with the site's merges, as the Method tab showed`);
console.log(`  seeding: ${seeding.entered ? `${testEvents.length - noSeeding.length} of ${testEvents.length} events seeded` : 'analysis/seeds.csv not entered; section 6 empty'}`);
console.log(`  groups merged under ${MIN_GROUP} bouts: ${mergeLog.length}`);
console.log(`  wrote ${resolve(OUT, 'ANALYSIS.md')} and ${readdirSync(RESULTS).length} files in ${RESULTS}`);
console.log('\nCHECK list:');
checks.forEach((c, i) => console.log(`  [CHECK ${i + 1}] ${c}`));

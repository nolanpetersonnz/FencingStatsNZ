import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Search, Upload, ArrowLeft, Download, AlertCircle, X, ChevronRight, Trash2, Settings as SettingsIcon, Swords, BookOpen, Layers, GitCompare, Award } from 'lucide-react';

/* ============================================================
   FONTS & STYLE  —  editorial almanac aesthetic
   ============================================================ */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Newsreader:opsz,ital,wght@6..72,0,300;6..72,0,400;6..72,0,500;6..72,0,600;6..72,1,400;6..72,1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --paper: #F5F6F8;
  --paper-deep: #FFFFFF;
  --paper-shade: #E8EBF0;
  --ink: #111418;
  --ink-soft: #4A5058;
  --ink-faint: #8A909A;
  --rule: #D5D9DF;
  --rule-soft: #E5E8EC;
  --ox: #1A6BB5;
  --ox-deep: #0F4A85;
  --brass: #4F7CB1;
  --moss: #6A7B8E;
  --green: #1A6BB5;
  --red-light: #4A5058;
  --ink-fade: rgba(17,20,24,0.05);
  --ink-fade-2: rgba(17,20,24,0.10);
}

.fl-root { font-family: 'Newsreader', Georgia, serif; color: var(--ink); background: var(--paper); min-height: 100vh; font-size: 16px; line-height: 1.5; }
.fl-root * { box-sizing: border-box; }
.fl-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; letter-spacing: -0.01em; }
.fl-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.fl-italic { font-style: italic; font-family: 'Newsreader', Georgia, serif; }
.fl-smallcaps { font-family: 'Fraunces', Georgia, serif; text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; font-weight: 500; color: var(--ink-soft); }
.fl-rule { border-top: 1px solid var(--rule); }
.fl-rule-soft { border-top: 1px solid var(--rule-soft); }
.fl-rule-thick { border-top: 3px double var(--ink); }

.fl-link { cursor: pointer; transition: color 120ms ease, background 120ms ease; }
.fl-link:hover { color: var(--ox); }

.fl-tab { padding: 8px 0; margin-right: 28px; cursor: pointer; position: relative; transition: color 120ms ease; }
.fl-tab:hover { color: var(--ox); }
.fl-tab.active { color: var(--ink); }
.fl-tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--ox); }

.fl-pill { padding: 5px 14px; border: 1px solid var(--rule); border-radius: 999px; cursor: pointer; transition: all 120ms ease; background: transparent; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'Fraunces', serif; font-weight: 500; }
.fl-pill:hover { border-color: var(--ink-soft); }
.fl-pill.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.fl-input { font-family: 'Newsreader', serif; font-size: 1rem; background: transparent; border: none; border-bottom: 1px solid var(--rule); padding: 6px 2px; outline: none; color: var(--ink); width: 100%; transition: border-color 120ms ease; }
.fl-input:focus { border-bottom-color: var(--ink); }
.fl-input::placeholder { color: var(--ink-faint); font-style: italic; }

.fl-textarea { font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; background: var(--paper-deep); border: 1px solid var(--rule); padding: 14px; outline: none; color: var(--ink); width: 100%; resize: vertical; min-height: 220px; line-height: 1.5; }
.fl-textarea:focus { border-color: var(--ink-soft); }

.fl-btn { font-family: 'Fraunces', serif; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 600; padding: 11px 22px; cursor: pointer; transition: all 120ms ease; background: var(--ink); color: var(--paper); border: 1px solid var(--ink); }
.fl-btn:hover { background: var(--ox); border-color: var(--ox); }
.fl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fl-btn.ghost { background: transparent; color: var(--ink); }
.fl-btn.ghost:hover { background: var(--ink-fade); color: var(--ink); border-color: var(--ink); }
.fl-btn.danger { background: var(--ox); border-color: var(--ox); }
.fl-btn.danger:hover { background: var(--ox-deep); border-color: var(--ox-deep); }

.fl-row-hover { transition: background-color 100ms ease; }
.fl-row-hover:hover { background: var(--ink-fade); }

.fl-tag { display: inline-block; padding: 2px 8px; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; font-family: 'Fraunces', serif; font-weight: 500; border: 1px solid var(--rule); border-radius: 2px; }
.fl-tag.ox { color: var(--ox); border-color: var(--ox); }
.fl-tag.brass { color: var(--brass); border-color: var(--brass); }
.fl-tag.moss { color: var(--moss); border-color: var(--moss); }
.fl-tag.solid-ink { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.fl-scroll::-webkit-scrollbar { width: 8px; }
.fl-scroll::-webkit-scrollbar-track { background: transparent; }
.fl-scroll::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 4px; }
.fl-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-faint); }

@keyframes fl-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.fl-fade-in { animation: fl-fade-in 240ms ease-out; }

.fl-grain {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(26,22,18,0.04) 1px, transparent 0),
    radial-gradient(circle at 17px 13px, rgba(26,22,18,0.025) 1px, transparent 0);
  background-size: 24px 24px, 31px 31px;
}

.fl-ornament { color: var(--brass); font-family: 'Fraunces', serif; }

@media (max-width: 760px) {
  .fl-hide-mobile { display: none !important; }
  .fl-stack-mobile { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
}
`;

/* ============================================================
   GLICKO-2 ENGINE
   ============================================================ */
const DEFAULT_SETTINGS = {
  initialRating: 1500,
  initialRD: 350,
  initialVolatility: 0.06,
  tau: 0.5,
  upsetThreshold: 75,
  upsetMultiplier: 1.25,
};
const SCALE = 173.7178;

const toG2 = (r, rd) => ({ mu: (r - 1500) / SCALE, phi: rd / SCALE });
const fromG2 = (mu, phi) => ({ rating: mu * SCALE + 1500, rd: phi * SCALE });
const gFn = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const eFn = (mu, mu_j, phi_j) => 1 / (1 + Math.exp(-gFn(phi_j) * (mu - mu_j)));

function newVolatility(sigma, delta, phi, v, tau) {
  const a = Math.log(sigma * sigma);
  const f = (x) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };
  let A = a;
  let B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) { A = B; fA = fB; } else { fA = fA / 2; }
    B = C; fB = fC;
  }
  return Math.exp(A / 2);
}

function updateRating(fencer, opponentBouts, settings) {
  if (opponentBouts.length === 0) {
    const { mu, phi } = toG2(fencer.rating, fencer.rd);
    const phiStar = Math.sqrt(phi * phi + fencer.volatility * fencer.volatility);
    const { rating, rd } = fromG2(mu, phiStar);
    return { rating, rd, volatility: fencer.volatility };
  }
  const { mu, phi } = toG2(fencer.rating, fencer.rd);
  let vInv = 0, deltaSum = 0;
  for (const b of opponentBouts) {
    const { mu: mj, phi: pj } = toG2(b.opponentRating, b.opponentRD);
    const gj = gFn(pj), Ej = eFn(mu, mj, pj);
    vInv += b.weight * gj * gj * Ej * (1 - Ej);
    deltaSum += b.weight * gj * (b.score - Ej);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  const sigma2 = newVolatility(fencer.volatility, delta, phi, v, settings.tau);
  const phiStar = Math.sqrt(phi * phi + sigma2 * sigma2);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  // Re-aggregate with upset multiplier on top
  let amplified = 0;
  for (const b of opponentBouts) {
    const { mu: mj, phi: pj } = toG2(b.opponentRating, b.opponentRD);
    const gj = gFn(pj), Ej = eFn(mu, mj, pj);
    const diff = b.opponentRating - fencer.rating;
    let m = 1;
    if (b.score === 1 && diff > settings.upsetThreshold) m = settings.upsetMultiplier;
    else if (b.score === 0 && diff < -settings.upsetThreshold) m = settings.upsetMultiplier;
    amplified += m * b.weight * gj * (b.score - Ej);
  }
  const muPrime = mu + phiPrime * phiPrime * amplified;
  const { rating, rd } = fromG2(muPrime, phiPrime);
  return { rating, rd, volatility: sigma2 };
}

/* ============================================================
   DATA PIPELINE
   ============================================================ */
const nameKey = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normWeapon = (w) => {
  const x = (w || '').toLowerCase().trim();
  if (x.startsWith('f')) return 'foil';
  if (x.startsWith('s')) return 'sabre';
  return 'epee';
};
const normBoutType = (t) => ((t || '').toLowerCase().trim().startsWith('d') ? 'de' : 'pool');

function parseCSVLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  const lines = text.replace(/\uFEFF/g, '').trim().split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const o = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}

function processBouts(rawBouts, settings) {
  const fencers = {};
  const bouts = [];
  const compMap = {};

  const normGender = (g) => {
    const x = (g || '').toLowerCase().trim();
    if (x.startsWith('w') || x.startsWith('f') || x === 'ladies') return 'W';
    if (x.startsWith('m')) return 'M';
    return '';
  };

  const ensure = (name, club, weapon, gender) => {
    const k = nameKey(name);
    if (!k) return null;
    if (!fencers[k]) fencers[k] = { key: k, name: name.trim(), club: (club || '').trim(), byWeapon: {}, genders: new Set() };
    if (!fencers[k].byWeapon[weapon]) {
      // Each weapon now has independent pool + DE rating streams
      const fresh = () => ({
        rating: settings.initialRating, rd: settings.initialRD, volatility: settings.initialVolatility,
        peak: settings.initialRating, history: [], bouts: 0, wins: 0, losses: 0, ties: 0,
      });
      fencers[k].byWeapon[weapon] = { pool: fresh(), de: fresh() };
    }
    if (club && !fencers[k].club) fencers[k].club = club.trim();
    const g = normGender(gender);
    if (g) fencers[k].genders.add(g);
    return fencers[k];
  };

  // Group bouts into rating periods. A period = one (competition, date, weapon).
  // Within a period, pool and DE streams are processed independently.
  const sorted = [...rawBouts].sort((a, b) => {
    const dCmp = (a.date || '').localeCompare(b.date || '');
    if (dCmp !== 0) return dCmp;
    return (a.competition || '').localeCompare(b.competition || '');
  });
  const periods = {};
  for (const b of sorted) {
    const w = normWeapon(b.weapon);
    const comp = b.competition || 'Unnamed';
    const key = `${b.date}\u241F${comp}\u241F${w}`;
    if (!periods[key]) periods[key] = [];
    periods[key].push({ ...b, _weapon: w, _type: normBoutType(b.bout_type) });
  }

  for (const pkey of Object.keys(periods).sort()) {
    const periodBouts = periods[pkey];
    const [date, , weapon] = pkey.split('\u241F');

    // Two parallel snapshots — pool stream and DE stream
    const snapPool = {};
    const snapDe = {};

    for (const b of periodBouts) {
      const fA = ensure(b.fencer_a, b.club_a, weapon, b.gender);
      const fB = ensure(b.fencer_b, b.club_b, weapon, b.gender);
      if (!fA || !fB) continue;
      const wA = fA.byWeapon[weapon], wB = fB.byWeapon[weapon];
      if (!snapPool[fA.key]) snapPool[fA.key] = { rating: wA.pool.rating, rd: wA.pool.rd, volatility: wA.pool.volatility };
      if (!snapPool[fB.key]) snapPool[fB.key] = { rating: wB.pool.rating, rd: wB.pool.rd, volatility: wB.pool.volatility };
      if (!snapDe[fA.key])   snapDe[fA.key]   = { rating: wA.de.rating,   rd: wA.de.rd,   volatility: wA.de.volatility };
      if (!snapDe[fB.key])   snapDe[fB.key]   = { rating: wB.de.rating,   rd: wB.de.rd,   volatility: wB.de.volatility };
    }

    // Collect bouts per fencer, split by stream
    const perFencerPool = {};
    const perFencerDe = {};
    for (const b of periodBouts) {
      const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
      if (!kA || !kB || kA === kB) continue;
      const sA = parseInt(b.score_a, 10), sB = parseInt(b.score_b, 10);
      if (isNaN(sA) || isNaN(sB)) continue;
      const scoreA = sA > sB ? 1 : sB > sA ? 0 : 0.5;
      const scoreB = 1 - scoreA;
      const isDe = b._type === 'de';
      const snap = isDe ? snapDe : snapPool;
      const per = isDe ? perFencerDe : perFencerPool;
      if (!snap[kA] || !snap[kB]) continue;
      (per[kA] ||= []).push({ opponentRating: snap[kB].rating, opponentRD: snap[kB].rd, score: scoreA, weight: 1 });
      (per[kB] ||= []).push({ opponentRating: snap[kA].rating, opponentRD: snap[kA].rd, score: scoreB, weight: 1 });
    }

    // Run Glicko-2 update on each stream independently
    const applyStream = (perFencer, snap, streamKey) => {
      for (const k in perFencer) {
        const before = snap[k];
        const after = updateRating({ rating: before.rating, rd: before.rd, volatility: before.volatility }, perFencer[k], settings);
        const wep = fencers[k].byWeapon[weapon][streamKey];
        wep.rating = after.rating;
        wep.rd = after.rd;
        wep.volatility = after.volatility;
        wep.peak = Math.max(wep.peak, after.rating);
        for (const ob of perFencer[k]) {
          wep.bouts += 1;
          if (ob.score === 1) wep.wins += 1;
          else if (ob.score === 0) wep.losses += 1;
          else wep.ties += 1;
        }
        wep.history.push({ date, rating: Math.round(after.rating), rd: Math.round(after.rd) });
      }
    };
    applyStream(perFencerPool, snapPool, 'pool');
    applyStream(perFencerDe, snapDe, 'de');

    // Emit per-bout records, attaching the relevant stream's ratings
    for (const b of periodBouts) {
      const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
      if (!kA || !kB || kA === kB) continue;
      const sA = parseInt(b.score_a, 10), sB = parseInt(b.score_b, 10);
      if (isNaN(sA) || isNaN(sB)) continue;
      const isDe = b._type === 'de';
      const snap = isDe ? snapDe : snapPool;
      if (!snap[kA] || !snap[kB]) continue;
      const wepA = fencers[kA].byWeapon[weapon][isDe ? 'de' : 'pool'];
      const wepB = fencers[kB].byWeapon[weapon][isDe ? 'de' : 'pool'];
      bouts.push({
        id: bouts.length,
        date, weapon, type: b._type, deRound: (b.de_round || '').trim(),
        competition: (b.competition || '').trim(),
        keyA: kA, keyB: kB, scoreA: sA, scoreB: sB,
        ratingABefore: snap[kA].rating, ratingBBefore: snap[kB].rating,
        ratingAAfter: wepA.rating, ratingBAfter: wepB.rating,
        deltaA: wepA.rating - snap[kA].rating, deltaB: wepB.rating - snap[kB].rating,
        winnerKey: sA > sB ? kA : sB > sA ? kB : null,
      });

      const compId = `${b.competition || 'Unnamed'}|${weapon}|${date}`;
      if (!compMap[compId]) compMap[compId] = {
        id: compId, name: b.competition || 'Unnamed', date, weapon,
        fencerKeys: new Set(), bouts: [], preRatingsPool: {}, preRatingsDe: {}, genders: new Set(),
      };
      compMap[compId].fencerKeys.add(kA);
      compMap[compId].fencerKeys.add(kB);
      compMap[compId].preRatingsPool[kA] = snapPool[kA].rating;
      compMap[compId].preRatingsPool[kB] = snapPool[kB].rating;
      compMap[compId].preRatingsDe[kA] = snapDe[kA].rating;
      compMap[compId].preRatingsDe[kB] = snapDe[kB].rating;
      compMap[compId].bouts.push(bouts[bouts.length - 1]);
      const bg = normGender(b.gender);
      if (bg) compMap[compId].genders.add(bg);
    }
  }

  const computeStats = (preRatings, fencerKeys) => {
    const ratings = Array.from(fencerKeys).map(k => preRatings[k] || settings.initialRating).sort((a, b) => a - b);
    const median = ratings.length % 2 === 0
      ? (ratings[ratings.length / 2 - 1] + ratings[ratings.length / 2]) / 2
      : ratings[Math.floor(ratings.length / 2)];
    const mean = ratings.reduce((s, x) => s + x, 0) / ratings.length;
    const top = ratings[ratings.length - 1] || 0;
    return { median, mean, top };
  };

  const competitions = Object.values(compMap).map(c => {
    const poolStats = computeStats(c.preRatingsPool, c.fencerKeys);
    const deStats = computeStats(c.preRatingsDe, c.fencerKeys);
    return {
      id: c.id, name: c.name, date: c.date, weapon: c.weapon,
      fencerKeys: Array.from(c.fencerKeys), bouts: c.bouts,
      genders: c.genders,
      // Pool/de specific stats
      poolMedian: poolStats.median, poolMean: poolStats.mean, poolTop: poolStats.top,
      deMedian: deStats.median, deMean: deStats.mean, deTop: deStats.top,
      // Legacy fields kept for back-compat — default to pool stream
      median: poolStats.median, mean: poolStats.mean, top: poolStats.top,
      size: c.fencerKeys.size,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  return { fencers, bouts, competitions };
}

function strengthTier(median) {
  if (median >= 1750) return { label: 'S', color: 'var(--ox)' };
  if (median >= 1650) return { label: 'A', color: 'var(--brass)' };
  if (median >= 1550) return { label: 'B', color: 'var(--moss)' };
  if (median >= 1450) return { label: 'C', color: 'var(--ink-soft)' };
  return { label: 'D', color: 'var(--ink-faint)' };
}

/* ============================================================
   DEMO DATA  (clearly fictional NZ-flavoured fencers)
   ============================================================ */
function makeDemoBouts() {
  // Fictional roster
  const epeeFencers = [
    ['Hamish Carter', 'Auckland Swords'],
    ['Tane Ngata', 'Wellington FC'],
    ['Charlotte Reeves', 'Christchurch Salle'],
    ['Liam O\'Connell', 'Auckland Swords'],
    ['Aroha Williams', 'Wellington FC'],
    ['Daniel Park', 'Auckland Swords'],
    ['Theo Anand', 'Christchurch Salle'],
    ['Sophie Marlow', 'North Shore FC'],
    ['Pita Tahu', 'Hamilton FC'],
    ['Olivia Chen', 'Auckland Swords'],
    ['Marcus Allenby', 'Tauranga FC'],
    ['Ben Whittaker', 'Christchurch Salle'],
  ];
  const foilFencers = [
    ['Aroha Williams', 'Wellington FC'],
    ['Sophie Marlow', 'North Shore FC'],
    ['Emma Fitzgerald', 'Otago FC'],
    ['Hamish Carter', 'Auckland Swords'],
    ['Sam Lange', 'Wellington FC'],
    ['Olivia Chen', 'Auckland Swords'],
    ['Jack Thompson', 'Wellington FC'],
    ['Pita Tahu', 'Hamilton FC'],
  ];

  // Underlying "true skill" (hidden) so demo data feels realistic
  const skill = {
    'Hamish Carter': 1820, 'Tane Ngata': 1740, 'Charlotte Reeves': 1700,
    "Liam O'Connell": 1640, 'Aroha Williams': 1690, 'Daniel Park': 1580,
    'Theo Anand': 1620, 'Sophie Marlow': 1530, 'Pita Tahu': 1490,
    'Olivia Chen': 1450, 'Marcus Allenby': 1410, 'Ben Whittaker': 1370,
    'Emma Fitzgerald': 1670, 'Sam Lange': 1600, 'Jack Thompson': 1520,
  };
  const out = [];
  const rand = mulberry32(20251115);

  function simulateBout(a, b, scoreCap) {
    const sa = skill[a[0]], sb = skill[b[0]];
    const probA = 1 / (1 + Math.pow(10, (sb - sa) / 400));
    let scoreA = 0, scoreB = 0;
    while (scoreA < scoreCap && scoreB < scoreCap) {
      if (rand() < probA) scoreA++; else scoreB++;
    }
    return [scoreA, scoreB];
  }

  function pools(fencers, size, date, comp, weapon) {
    // Round-robin within pools of `size`
    const shuffled = [...fencers].sort(() => rand() - 0.5);
    for (let i = 0; i < shuffled.length; i += size) {
      const pool = shuffled.slice(i, i + size);
      for (let a = 0; a < pool.length; a++) {
        for (let b = a + 1; b < pool.length; b++) {
          const [sa, sb] = simulateBout(pool[a], pool[b], 5);
          out.push({
            date, competition: comp, weapon, bout_type: 'pool',
            fencer_a: pool[a][0], club_a: pool[a][1],
            fencer_b: pool[b][0], club_b: pool[b][1],
            score_a: sa, score_b: sb, de_round: '',
          });
        }
      }
    }
  }

  function bracket(fencers, date, comp, weapon) {
    // Single-elimination, rough seeding by skill
    let alive = [...fencers].sort((a, b) => skill[b[0]] - skill[a[0]]);
    const rounds = ['T16', 'T8', 'QF', 'SF', 'Final'];
    let r = 0;
    while (alive.length > 1) {
      const next = [];
      const round = rounds[Math.max(0, rounds.length - Math.ceil(Math.log2(alive.length)))] || `T${alive.length}`;
      // Pair high vs low
      for (let i = 0; i < alive.length / 2; i++) {
        const a = alive[i], b = alive[alive.length - 1 - i];
        const [sa, sb] = simulateBout(a, b, 15);
        out.push({
          date, competition: comp, weapon, bout_type: 'de',
          fencer_a: a[0], club_a: a[1], fencer_b: b[0], club_b: b[1],
          score_a: sa, score_b: sb, de_round: round,
        });
        next.push(sa > sb ? a : b);
      }
      alive = next;
      r++;
    }
  }

  // 2025 NZ Open – Épée
  pools(epeeFencers, 6, '2025-03-15', 'NZ Open 2025', 'epee');
  bracket(epeeFencers.slice(0, 8), '2025-03-15', 'NZ Open 2025', 'epee');

  // 2025 Wellington Cup – Épée (skill drift up for Tane after winter training)
  skill['Tane Ngata'] = 1780;
  pools(epeeFencers.slice(0, 10), 5, '2025-06-22', 'Wellington Cup 2025', 'epee');
  bracket(epeeFencers.slice(0, 8), '2025-06-22', 'Wellington Cup 2025', 'epee');

  // 2025 NZ Nationals – Foil
  pools(foilFencers, 4, '2025-09-07', 'NZ Nationals 2025', 'foil');
  bracket(foilFencers, '2025-09-07', 'NZ Nationals 2025', 'foil');

  // 2026 NZ Open – Épée (Charlotte improvement, upset story)
  skill['Charlotte Reeves'] = 1790;
  pools(epeeFencers, 6, '2026-03-14', 'NZ Open 2026', 'epee');
  bracket(epeeFencers.slice(0, 8), '2026-03-14', 'NZ Open 2026', 'epee');

  return out;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   STORAGE
   ============================================================ */
const STORAGE_KEY = 'fl-data-v1';
async function loadFromStorage() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return null;
}
async function saveToStorage(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}
async function clearStorage() {
  try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
}

/* ============================================================
   FORMATTERS
   ============================================================ */
const fmtRating = (r) => Math.round(r).toString();
const fmtRD = (rd) => `±${Math.round(rd)}`;
const fmtDelta = (d) => {
  const v = Math.round(d);
  if (v === 0) return '·0';
  return v > 0 ? `+${v}` : `${v}`;
};
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  const mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${parseInt(day,10)} ${mn[parseInt(m,10)-1]} ${y}`;
};
const fmtDateShort = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y) return d;
  return `${day}/${m}/${y.slice(2)}`;
};

/* ============================================================
   CSV TEMPLATE
   ============================================================ */
const CSV_HEADER = 'date,competition,weapon,bout_type,fencer_a,club_a,fencer_b,club_b,score_a,score_b,de_round';
const CSV_TEMPLATE = `${CSV_HEADER}
2025-03-15,NZ Open 2025,epee,pool,Hamish Carter,Auckland Swords,Tane Ngata,Wellington FC,5,3,
2025-03-15,NZ Open 2025,epee,pool,Charlotte Reeves,Christchurch Salle,Daniel Park,Auckland Swords,5,4,
2025-03-15,NZ Open 2025,epee,de,Hamish Carter,Auckland Swords,Theo Anand,Christchurch Salle,15,11,T8
2025-03-15,NZ Open 2025,epee,de,Tane Ngata,Wellington FC,Hamish Carter,Auckland Swords,15,13,Final
`;

/* ============================================================
   COMPONENTS
   ============================================================ */

function Header({ view, setView, weapon, setWeapon, gender, setGender, fencers, onSelectFencer, hasData }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return Object.values(fencers)
      .filter(f => f.name.toLowerCase().includes(q) || (f.club || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, fencers]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div style={{ borderBottom: '3px double var(--ink)', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }} className="fl-stack-mobile">
          <div>
            <div className="fl-smallcaps" style={{ marginBottom: 8 }}>Aotearoa · A registry of bouts &amp; ratings</div>
            <h1 className="fl-display" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.4rem)', fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 0.95, margin: 0 }}>
              Fencing Stats<br/><span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>NZ</span>
            </h1>
            <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 10, fontSize: '1.05rem' }}>
              <span className="fl-ornament">❦</span> Glicko-style ratings drawn from the bouts of New Zealand
            </div>
          </div>
          <div ref={ref} style={{ position: 'relative', minWidth: 280, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} color="var(--ink-soft)" />
              <input
                className="fl-input"
                placeholder={hasData ? 'Search fencers, clubs…' : 'No data yet — see Import'}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                disabled={!hasData}
              />
            </div>
            {open && results.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--paper)', border: '1px solid var(--rule)', marginTop: 8, zIndex: 50, boxShadow: '0 8px 24px rgba(17,20,24,0.10)' }}>
                {results.map(f => (
                  <div
                    key={f.key}
                    className="fl-link fl-row-hover"
                    style={{ padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }}
                    onClick={() => { onSelectFencer(f.key); setSearch(''); setOpen(false); }}
                  >
                    <div className="fl-display" style={{ fontWeight: 600, fontSize: '1rem' }}>{f.name}</div>
                    <div className="fl-italic" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{f.club}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, gap: 24, flexWrap: 'wrap' }}>
          <nav style={{ display: 'flex', alignItems: 'center' }} className="fl-smallcaps">
            <div className={`fl-tab ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>Ledger</div>
            <div className={`fl-tab ${view === 'competitions' ? 'active' : ''}`} onClick={() => setView('competitions')}>Competitions</div>
            <div className={`fl-tab ${view === 'h2h' ? 'active' : ''}`} onClick={() => setView('h2h')}>Head-to-Head</div>
            <div className={`fl-tab ${view === 'import' ? 'active' : ''}`} onClick={() => setView('import')}>Import</div>
            <div className={`fl-tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><SettingsIcon size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /></div>
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['M', 'Mens'], ['W', 'Womens']].map(([g, label]) => (
              <button key={g} className={`fl-pill ${gender === g ? 'active' : ''}`} onClick={() => setGender(g)}>
                {label}
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
            {['foil', 'epee', 'sabre'].map(w => (
              <button key={w} className={`fl-pill ${weapon === w ? 'active' : ''}`} onClick={() => setWeapon(w)}>
                {w === 'epee' ? 'Épée' : w}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onLoadDemo, onGotoImport }) {
  return (
    <div className="fl-fade-in" style={{ maxWidth: 720, margin: '80px auto', padding: '0 32px', textAlign: 'center' }}>
      <div className="fl-ornament" style={{ fontSize: '1.6rem' }}>※ ※ ※</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 600, fontStyle: 'italic', marginTop: 18, marginBottom: 14 }}>
        The ledger awaits its first bouts.
      </h2>
      <p style={{ color: 'var(--ink-soft)', fontSize: '1.1rem', maxWidth: 520, margin: '0 auto 36px' }}>
        Bring in real results from FencingTimeLive (CSV), or load a sample roster of fictional New Zealand fencers to see how the ledger is kept.
      </p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="fl-btn" onClick={onGotoImport}>Import Results</button>
        <button className="fl-btn ghost" onClick={onLoadDemo}>Load Demo Data</button>
      </div>
    </div>
  );
}

function Leaderboard({ fencers, bouts, weapon, gender, onSelectFencer }) {
  const [minBouts, setMinBouts] = useState(1);
  const [club, setClub] = useState('all');
  const [sort, setSort] = useState('pool');  // 'pool' | 'de' | 'bouts' | 'winrate'

  const ranked = useMemo(() => {
    const list = Object.values(fencers)
      .map(f => {
        const w = f.byWeapon[weapon];
        if (!w) return null;
        const totalBouts = w.pool.bouts + w.de.bouts;
        const totalWins = w.pool.wins + w.de.wins;
        const totalLosses = w.pool.losses + w.de.losses;
        return { f, pool: w.pool, de: w.de, totalBouts, totalWins, totalLosses };
      })
      .filter(x => x && (x.totalBouts >= minBouts))
      .filter(x => club === 'all' || x.f.club === club)
      .filter(x => !gender || !x.f.genders || x.f.genders.size === 0 || x.f.genders.has(gender));

    list.sort((a, b) => {
      if (sort === 'pool') return b.pool.rating - a.pool.rating;
      if (sort === 'de') return b.de.rating - a.de.rating;
      if (sort === 'bouts') return b.totalBouts - a.totalBouts;
      if (sort === 'winrate') {
        const wa = a.totalBouts ? a.totalWins / a.totalBouts : 0;
        const wb = b.totalBouts ? b.totalWins / b.totalBouts : 0;
        return wb - wa;
      }
      return 0;
    });
    return list;
  }, [fencers, weapon, gender, minBouts, club, sort]);

  const clubs = useMemo(() => {
    const s = new Set();
    Object.values(fencers).forEach(f => { if (f.club) s.add(f.club); });
    return ['all', ...Array.from(s).sort()];
  }, [fencers]);

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);

  if (ranked.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
        No fencers found in {genderLabel} {weaponLabel} matching these filters.
      </div>
    );
  }

  // Grid: Rank(56) | Fencer(1fr) | Club(180) | Pool(110) | DE(110) | Bouts(70) | W·L(90)
  const gridCols = '56px 1fr 180px 110px 110px 70px 90px';

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 18 }}>
        <div>
          <div className="fl-smallcaps">Standings · {genderLabel} {weaponLabel}</div>
          <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            The {ranked.length} ranked
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="fl-smallcaps" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Min bouts
            <input type="number" min={1} max={50} value={minBouts} onChange={e => setMinBouts(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 50, fontFamily: 'JetBrains Mono', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', padding: '2px 4px', outline: 'none', color: 'var(--ink)', fontSize: '0.9rem' }} />
          </label>
          <label className="fl-smallcaps" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Club
            <select value={club} onChange={e => setClub(e.target.value)}
              style={{ fontFamily: 'Newsreader, serif', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', padding: '2px 4px', outline: 'none', color: 'var(--ink)', fontSize: '0.9rem', textTransform: 'none', letterSpacing: 'normal' }}>
              {clubs.map(c => <option key={c} value={c}>{c === 'all' ? 'All clubs' : c}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <div>Rank</div>
          <div>Fencer</div>
          <div className="fl-hide-mobile">Club</div>
          <div className="fl-link" onClick={() => setSort('pool')} style={{ textAlign: 'right', color: sort === 'pool' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Pool {sort === 'pool' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
          <div className="fl-link" onClick={() => setSort('de')} style={{ textAlign: 'right', color: sort === 'de' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            DE {sort === 'de' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('bouts')} style={{ textAlign: 'right', color: sort === 'bouts' ? 'var(--ink)' : 'var(--ink-soft)' }}>Bouts</div>
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('winrate')} style={{ textAlign: 'right', color: sort === 'winrate' ? 'var(--ink)' : 'var(--ink-soft)' }}>W·L</div>
        </div>

        {ranked.map(({ f, pool, de, totalBouts, totalWins, totalLosses }, i) => (
          <div
            key={f.key}
            onClick={() => onSelectFencer(f.key)}
            className="fl-row-hover fl-link"
            style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--rule-soft)' }}
          >
            <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '1.05rem', fontWeight: 500 }}>
              {(i + 1).toString().padStart(2, '0')}
            </div>
            <div>
              <div className="fl-display" style={{ fontSize: '1.15rem', fontWeight: 600 }}>{f.name}</div>
            </div>
            <div className="fl-italic fl-hide-mobile" style={{ color: 'var(--ink-soft)', fontSize: '0.92rem' }}>{f.club}</div>
            {/* Pool column */}
            <div style={{ textAlign: 'right', opacity: pool.bouts > 0 ? 1 : 0.35 }}>
              <div className="fl-mono" style={{ fontSize: sort === 'pool' ? '1.2rem' : '1.05rem', fontWeight: sort === 'pool' ? 600 : 500 }}>
                {pool.bouts > 0 ? fmtRating(pool.rating) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {pool.bouts > 0 ? `${fmtRD(pool.rd)} · ${pool.bouts}b` : ''}
              </div>
            </div>
            {/* DE column */}
            <div style={{ textAlign: 'right', opacity: de.bouts > 0 ? 1 : 0.35 }}>
              <div className="fl-mono" style={{ fontSize: sort === 'de' ? '1.2rem' : '1.05rem', fontWeight: sort === 'de' ? 600 : 500 }}>
                {de.bouts > 0 ? fmtRating(de.rating) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {de.bouts > 0 ? `${fmtRD(de.rd)} · ${de.bouts}b` : ''}
              </div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{totalBouts}</div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: '0.92rem' }}>
              <span style={{ color: 'var(--green)' }}>{totalWins}</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span style={{ color: 'var(--red-light)' }}>{totalLosses}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FencerProfile({ fencerKey, fencers, bouts, competitions, onBack, onSelectFencer, onSelectComp, weapon: globalWeapon }) {
  const f = fencers[fencerKey];
  const [weapon, setWeapon] = useState(() => {
    if (f && f.byWeapon[globalWeapon]) return globalWeapon;
    return f ? Object.keys(f.byWeapon)[0] : globalWeapon;
  });

  const w = f ? f.byWeapon[weapon] : null;
  const fencerBouts = useMemo(() => {
    if (!f) return [];
    return bouts.filter(b => (b.keyA === fencerKey || b.keyB === fencerKey) && b.weapon === weapon)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [bouts, fencerKey, weapon, f]);

  // Build a unified chart with two lines (pool + de) keyed by date.
  // We merge entries from both streams into a single time-sorted array,
  // carrying the most recent rating forward when one stream had no update
  // on a given date (so the line stays flat rather than disappearing).
  const chartData = useMemo(() => {
    if (!w) return [];
    const allDates = new Set();
    w.pool.history.forEach(h => allDates.add(h.date));
    w.de.history.forEach(h => allDates.add(h.date));
    const dates = Array.from(allDates).sort();
    const poolByDate = Object.fromEntries(w.pool.history.map(h => [h.date, h.rating]));
    const deByDate = Object.fromEntries(w.de.history.map(h => [h.date, h.rating]));
    let lastPool = null, lastDe = null;
    return dates.map((d, i) => {
      if (poolByDate[d] !== undefined) lastPool = poolByDate[d];
      if (deByDate[d] !== undefined) lastDe = deByDate[d];
      return { idx: i + 1, date: d, pool: lastPool, de: lastDe };
    });
  }, [w]);

  if (!f) return <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">Fencer not found.</div>;

  const poolWinRate = w && w.pool.bouts > 0 ? (w.pool.wins / w.pool.bouts * 100).toFixed(0) : '—';
  const deWinRate = w && w.de.bouts > 0 ? (w.de.wins / w.de.bouts * 100).toFixed(0) : '—';
  const totalBouts = w ? w.pool.bouts + w.de.bouts : 0;

  return (
    <div className="fl-fade-in">
      <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={12} /> Back
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="fl-smallcaps">{f.club || 'Unaffiliated'}</div>
        <h2 className="fl-display" style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 700, letterSpacing: '-0.025em', margin: '6px 0 0', lineHeight: 1 }}>
          {f.name}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['foil', 'epee', 'sabre'].map(wp => {
          const has = f.byWeapon[wp];
          if (!has) return null;
          const totalB = has.pool.bouts + has.de.bouts;
          if (totalB === 0) return null;
          // Show whichever rating has more data, fallback to whichever has any
          const primary = has.pool.bouts >= has.de.bouts ? has.pool.rating : has.de.rating;
          return (
            <button key={wp} className={`fl-pill ${weapon === wp ? 'active' : ''}`} onClick={() => setWeapon(wp)}>
              {wp === 'epee' ? 'Épée' : wp} · {fmtRating(primary)}
            </button>
          );
        })}
      </div>

      {!w || totalBouts === 0 ? (
        <div className="fl-italic" style={{ color: 'var(--ink-soft)', padding: '40px 0' }}>
          {f.name} has no {weapon === 'epee' ? 'épée' : weapon} bouts on record.
        </div>
      ) : (
        <>
          {/* Two-stream stats: pool block + DE block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
            {[
              { label: 'Pool', stream: w.pool, winRate: poolWinRate, accent: 'var(--ink)' },
              { label: 'Direct Elimination', stream: w.de, winRate: deWinRate, accent: 'var(--ox)' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '24px 20px', borderRight: i === 0 ? '1px solid var(--rule)' : 'none', opacity: s.stream.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ marginBottom: 10, color: s.accent }}>{s.label}</div>
                <div className="fl-mono" style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1, color: s.accent }}>
                  {s.stream.bouts > 0 ? fmtRating(s.stream.rating) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: 6 }}>
                  {s.stream.bouts > 0 ? `${fmtRD(s.stream.rd)}  ·  peak ${fmtRating(s.stream.peak)}` : 'no bouts'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.92rem', marginTop: 14 }}>
                  <span style={{ color: 'var(--green)' }}>{s.stream.wins}W</span>
                  <span style={{ color: 'var(--ink-faint)' }}> · </span>
                  <span style={{ color: 'var(--red-light)' }}>{s.stream.losses}L</span>
                  <span style={{ color: 'var(--ink-faint)' }}> · </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{s.winRate}%</span>
                  <span style={{ color: 'var(--ink-faint)' }}> across {s.stream.bouts} bouts</span>
                </div>
              </div>
            ))}
          </div>

          {chartData.length >= 2 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div className="fl-smallcaps">Rating progression</div>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem', fontFamily: 'Newsreader, serif' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 2, background: 'var(--ink)' }} /> Pool
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 2, background: 'var(--ox)' }} /> DE
                  </span>
                </div>
              </div>
              <div style={{ height: 240, marginLeft: -10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <ReferenceLine y={1500} stroke="var(--rule)" strokeDasharray="3 3" />
                    <XAxis dataKey="idx" hide />
                    <YAxis tick={{ fill: 'var(--ink-faint)', fontFamily: 'JetBrains Mono', fontSize: 11 }} stroke="var(--rule)" domain={['dataMin - 30', 'dataMax + 30']} />
                    <Tooltip
                      contentStyle={{ background: 'var(--paper)', border: '1px solid var(--ink)', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                      labelFormatter={(v, d) => d[0]?.payload ? fmtDate(d[0].payload.date) : ''}
                    />
                    <Line type="monotone" dataKey="pool" stroke="var(--ink)" strokeWidth={2} dot={{ fill: 'var(--ink)', r: 2 }} activeDot={{ r: 5 }} connectNulls name="Pool" />
                    <Line type="monotone" dataKey="de" stroke="var(--ox)" strokeWidth={2} dot={{ fill: 'var(--ox)', r: 2 }} activeDot={{ r: 5 }} connectNulls name="DE" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Bouts on record · {fencerBouts.length}</div>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {fencerBouts.length === 0 && <div className="fl-italic" style={{ padding: 24, color: 'var(--ink-soft)' }}>No bouts recorded.</div>}
            {(() => {
              // Group bouts by (competition, date). Within each group, compute
              // pool-stream and DE-stream deltas separately. Show whichever
              // streams the fencer participated in for that competition.
              const groups = [];
              const seen = {};
              for (const b of fencerBouts) {
                const gKey = `${b.competition}|${b.date}`;
                if (!seen[gKey]) {
                  seen[gKey] = {
                    key: gKey, competition: b.competition, date: b.date,
                    weapon: b.weapon,
                    poolBefore: null, poolAfter: null,
                    deBefore: null, deAfter: null,
                    bouts: [],
                  };
                  groups.push(seen[gKey]);
                }
                const g = seen[gKey];
                const isA = b.keyA === fencerKey;
                const before = isA ? b.ratingABefore : b.ratingBBefore;
                const after = isA ? b.ratingAAfter : b.ratingBAfter;
                if (b.type === 'de') {
                  if (g.deBefore === null) g.deBefore = before;
                  g.deAfter = after;
                } else {
                  if (g.poolBefore === null) g.poolBefore = before;
                  g.poolAfter = after;
                }
                g.bouts.push(b);
              }
              return groups.map(g => {
                const wins = g.bouts.filter(b => b.winnerKey === fencerKey).length;
                const losses = g.bouts.filter(b => b.winnerKey && b.winnerKey !== fencerKey).length;
                const poolDelta = g.poolBefore !== null ? g.poolAfter - g.poolBefore : null;
                const deDelta = g.deBefore !== null ? g.deAfter - g.deBefore : null;
                return (
                  <div key={g.key}>
                    <div
                      onClick={() => onSelectComp(`${g.competition}|${g.weapon}|${g.date}`)}
                      className="fl-link fl-row-hover"
                      style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 1fr 1fr', alignItems: 'center', padding: '14px 14px 10px', background: 'var(--ink-fade)', borderBottom: '1px solid var(--rule)' }}
                    >
                      <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{fmtDateShort(g.date)}</div>
                      <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{g.competition}</div>
                      <div className="fl-mono" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--green)' }}>{wins}</span>
                        <span style={{ color: 'var(--ink-faint)' }}>·</span>
                        <span style={{ color: 'var(--red-light)' }}>{losses}</span>
                      </div>
                      {/* Pool delta */}
                      <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem', paddingRight: 8 }}>
                        {poolDelta !== null ? (
                          <>
                            <span className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>POOL </span>
                            <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(g.poolBefore)}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> → </span>
                            <span style={{ fontWeight: 600, color: poolDelta > 0 ? 'var(--green)' : poolDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                              {fmtRating(g.poolAfter)} <span style={{ fontWeight: 400 }}>({fmtDelta(poolDelta)})</span>
                            </span>
                          </>
                        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </div>
                      {/* DE delta */}
                      <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                        {deDelta !== null ? (
                          <>
                            <span className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ox)' }}>DE </span>
                            <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(g.deBefore)}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> → </span>
                            <span style={{ fontWeight: 600, color: deDelta > 0 ? 'var(--green)' : deDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                              {fmtRating(g.deAfter)} <span style={{ fontWeight: 400 }}>({fmtDelta(deDelta)})</span>
                            </span>
                          </>
                        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </div>
                    </div>
                    {g.bouts.map(b => {
                      const isA = b.keyA === fencerKey;
                      const myScore = isA ? b.scoreA : b.scoreB;
                      const oppScore = isA ? b.scoreB : b.scoreA;
                      const oppKey = isA ? b.keyB : b.keyA;
                      const opp = fencers[oppKey];
                      const won = b.winnerKey === fencerKey;
                      const oppBefore = isA ? b.ratingBBefore : b.ratingABefore;
                      return (
                        <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 200px', alignItems: 'center', padding: '10px 14px 10px 28px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-row-hover">
                          <div className="fl-smallcaps" style={{ fontSize: '0.62rem', color: b.type === 'de' ? 'var(--ox)' : 'var(--ink-faint)' }}>
                            {b.type === 'de' ? `DE ${b.deRound}` : 'Pool'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span className={`fl-tag ${won ? 'solid-ink' : ''}`}>{won ? 'W' : 'L'}</span>
                            <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>vs.</span>
                            <span className="fl-link fl-display" style={{ fontWeight: 600 }} onClick={(e) => { e.stopPropagation(); onSelectFencer(oppKey); }}>
                              {opp ? opp.name : oppKey}
                            </span>
                            <span className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>({fmtRating(oppBefore)})</span>
                          </div>
                          <div className="fl-mono" style={{ textAlign: 'center', fontSize: '1rem' }}>
                            <span style={{ fontWeight: 600 }}>{myScore}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> – </span>
                            <span>{oppScore}</span>
                          </div>
                          <div></div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}

function Competitions({ competitions, weapon, gender, onSelectComp }) {
  const filtered = competitions.filter(c =>
    c.weapon === weapon
    && (!gender || !c.genders || c.genders.size === 0 || c.genders.has(gender))
  );
  const [sort, setSort] = useState('date');

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'strength') return b.median - a.median;
      if (sort === 'size') return b.size - a.size;
      return b.date.localeCompare(a.date);
    });
  }, [filtered, sort]);

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);

  if (filtered.length === 0) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
      No {genderLabel} {weaponLabel} competitions on record.
    </div>;
  }

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="fl-smallcaps">Field strength · {genderLabel} {weaponLabel}</div>
          <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            {filtered.length} competitions on record
          </h2>
        </div>
        <div className="fl-smallcaps" style={{ display: 'flex', gap: 18 }}>
          <span className="fl-link" style={{ color: sort === 'date' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('date')}>Date</span>
          <span className="fl-link" style={{ color: sort === 'strength' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('strength')}>Strength</span>
          <span className="fl-link" style={{ color: sort === 'size' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('size')}>Field size</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {sorted.map(c => {
          const tier = strengthTier(c.median);
          return (
            <div
              key={c.id}
              onClick={() => onSelectComp(c.id)}
              className="fl-link fl-row-hover"
              style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 110px 110px 80px', alignItems: 'center', padding: '18px 16px', borderBottom: '1px solid var(--rule-soft)' }}
            >
              <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{fmtDate(c.date)}</div>
              <div>
                <div className="fl-display" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{c.name}</div>
                <div className="fl-italic" style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>{c.bouts.length} bouts</div>
              </div>
              <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{c.size} fencers</div>
              <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem' }}>Median</div>
                <div className="fl-mono" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{fmtRating(c.median)}</div>
              </div>
              <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem' }}>Top</div>
                <div className="fl-mono" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{fmtRating(c.top)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="fl-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: tier.color, letterSpacing: '-0.04em' }}>{tier.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompetitionDetail({ compId, competitions, fencers, bouts, onBack, onSelectFencer }) {
  const c = competitions.find(x => x.id === compId);

  // Compute pool & de rating changes per fencer for THIS competition
  const fencerStats = useMemo(() => {
    if (!c) return [];
    return c.fencerKeys.map(k => {
      const f = fencers[k];
      const myBouts = c.bouts.filter(b => b.keyA === k || b.keyB === k);
      const wins = myBouts.filter(b => b.winnerKey === k).length;
      const losses = myBouts.filter(b => b.winnerKey && b.winnerKey !== k).length;
      // Split into pool and de stream pre/post
      const poolBouts = myBouts.filter(b => b.type !== 'de');
      const deBouts = myBouts.filter(b => b.type === 'de');
      const streamRange = (list) => {
        if (list.length === 0) return { before: null, after: null };
        const before = list[0].keyA === k ? list[0].ratingABefore : list[0].ratingBBefore;
        const last = list[list.length - 1];
        const after = last.keyA === k ? last.ratingAAfter : last.ratingBAfter;
        return { before, after };
      };
      const pool = streamRange(poolBouts);
      const de = streamRange(deBouts);
      return {
        f, key: k, wins, losses, bouts: myBouts.length,
        poolBefore: pool.before, poolAfter: pool.after,
        poolDelta: pool.before !== null ? pool.after - pool.before : null,
        deBefore: de.before, deAfter: de.after,
        deDelta: de.before !== null ? de.after - de.before : null,
        // Sort key: prefer DE rating if available, fall back to pool
        sortKey: de.after !== null ? de.after : (pool.after !== null ? pool.after : 0),
      };
    }).sort((a, b) => b.sortKey - a.sortKey);
  }, [c, fencers]);

  if (!c) return <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">Competition not found.</div>;
  const tier = strengthTier(c.poolMedian);

  return (
    <div className="fl-fade-in">
      <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={12} /> Back
      </div>

      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="fl-smallcaps">{fmtDate(c.date)} · {c.weapon === 'epee' ? 'Épée' : c.weapon}</div>
          <h2 className="fl-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 700, margin: '6px 0 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {c.name}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="fl-smallcaps">Strength</div>
            <div className="fl-display" style={{ fontSize: '3.4rem', fontWeight: 800, color: tier.color, letterSpacing: '-0.05em', lineHeight: 1 }}>{tier.label}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
        {[
          { l: 'Field', v: c.size.toString() },
          { l: 'Bouts', v: c.bouts.length.toString() },
          { l: 'Pool median', v: fmtRating(c.poolMedian) },
          { l: 'DE median', v: fmtRating(c.deMedian) },
          { l: 'Top (pool)', v: fmtRating(c.poolTop) },
        ].map((s, i, arr) => (
          <div key={i} style={{ padding: '18px 14px', borderRight: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div className="fl-smallcaps" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="fl-mono" style={{ fontSize: '1.4rem', fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Performance</div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 36 }}>
        {fencerStats.map((s, i) => (
          <div key={s.key} className="fl-link fl-row-hover" onClick={() => onSelectFencer(s.key)}
            style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px 1fr 1fr', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
            <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '0.95rem' }}>{(i + 1).toString().padStart(2, '0')}</div>
            <div>
              <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{s.f?.name || s.key}</div>
              <div className="fl-italic fl-hide-mobile" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{s.f?.club || ''}</div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
              <span style={{ color: 'var(--green)' }}>{s.wins}</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span style={{ color: 'var(--red-light)' }}>{s.losses}</span>
            </div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.82rem', paddingRight: 8 }}>
              {s.poolDelta !== null ? (
                <>
                  <span className="fl-smallcaps" style={{ fontSize: '0.58rem', color: 'var(--ink-faint)' }}>POOL </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(s.poolBefore)}</span>
                  <span style={{ color: 'var(--ink-faint)' }}>→</span>
                  <span style={{ fontWeight: 600, color: s.poolDelta > 0 ? 'var(--green)' : s.poolDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                    {fmtRating(s.poolAfter)} ({fmtDelta(s.poolDelta)})
                  </span>
                </>
              ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            </div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.82rem' }}>
              {s.deDelta !== null ? (
                <>
                  <span className="fl-smallcaps" style={{ fontSize: '0.58rem', color: 'var(--ox)' }}>DE </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(s.deBefore)}</span>
                  <span style={{ color: 'var(--ink-faint)' }}>→</span>
                  <span style={{ fontWeight: 600, color: s.deDelta > 0 ? 'var(--green)' : s.deDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                    {fmtRating(s.deAfter)} ({fmtDelta(s.deDelta)})
                  </span>
                </>
              ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>All bouts</div>
      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {c.bouts.map(b => {
          const fa = fencers[b.keyA], fb = fencers[b.keyB];
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px 1fr', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
              <div className="fl-smallcaps" style={{ fontSize: '0.62rem', color: b.type === 'de' ? 'var(--ox)' : 'var(--ink-faint)' }}>{b.type === 'de' ? `DE ${b.deRound}` : 'Pool'}</div>
              <div className="fl-link fl-display" style={{ fontWeight: b.winnerKey === b.keyA ? 700 : 400, color: b.winnerKey === b.keyA ? 'var(--ink)' : 'var(--ink-soft)', textAlign: 'right', paddingRight: 16 }} onClick={() => onSelectFencer(b.keyA)}>
                {fa?.name || b.keyA}
              </div>
              <div className="fl-mono" style={{ textAlign: 'center', fontWeight: 600 }}>{b.scoreA}–{b.scoreB}</div>
              <div className="fl-link fl-display" style={{ fontWeight: b.winnerKey === b.keyB ? 700 : 400, color: b.winnerKey === b.keyB ? 'var(--ink)' : 'var(--ink-soft)', paddingLeft: 16 }} onClick={() => onSelectFencer(b.keyB)}>
                {fb?.name || b.keyB}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeadToHead({ fencers, bouts, weapon: globalWeapon, gender, onSelectFencer }) {
  const [aKey, setAKey] = useState(null);
  const [bKey, setBKey] = useState(null);
  const [weapon, setWeapon] = useState(globalWeapon);

  const a = aKey && fencers[aKey];
  const b = bKey && fencers[bKey];

  const h2hBouts = useMemo(() => {
    if (!aKey || !bKey) return [];
    return bouts
      .filter(x => x.weapon === weapon && ((x.keyA === aKey && x.keyB === bKey) || (x.keyA === bKey && x.keyB === aKey)))
      .sort((x, y) => y.date.localeCompare(x.date));
  }, [aKey, bKey, weapon, bouts]);

  const aWins = h2hBouts.filter(x => x.winnerKey === aKey).length;
  const bWins = h2hBouts.filter(x => x.winnerKey === bKey).length;

  // Predicted outcome using current ratings — separate predictions per stream
  const prediction = useMemo(() => {
    if (!a || !b || !a.byWeapon[weapon] || !b.byWeapon[weapon]) return null;
    const wA = a.byWeapon[weapon], wB = b.byWeapon[weapon];
    const pred = (sa, sb) => {
      if (sa.bouts === 0 || sb.bouts === 0) return null;
      const { mu: muA, phi: phiA } = toG2(sa.rating, sa.rd);
      const { mu: muB, phi: phiB } = toG2(sb.rating, sb.rd);
      const combinedPhi = Math.sqrt(phiA * phiA + phiB * phiB);
      const probA = 1 / (1 + Math.exp(-gFn(combinedPhi) * (muA - muB)));
      return { probA, probB: 1 - probA };
    };
    return {
      pool: pred(wA.pool, wB.pool),
      de: pred(wA.de, wB.de),
    };
  }, [a, b, weapon]);

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 28 }}>
        <div className="fl-smallcaps">Comparison</div>
        <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          Head-to-<span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>Head</span>
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['foil', 'epee', 'sabre'].map(w => (
          <button key={w} className={`fl-pill ${weapon === w ? 'active' : ''}`} onClick={() => setWeapon(w)}>
            {w === 'epee' ? 'Épée' : w}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 0, alignItems: 'stretch', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 36 }}>
        <FencerPicker fencers={fencers} weapon={weapon} gender={gender} selected={aKey} onSelect={setAKey} placeholder="Select first fencer…" />
        <div style={{ borderLeft: '1px solid var(--rule-soft)', borderRight: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-deep)' }}>
          <span className="fl-display" style={{ fontSize: '1.6rem', fontStyle: 'italic', color: 'var(--ox)' }}>vs.</span>
        </div>
        <FencerPicker fencers={fencers} weapon={weapon} gender={gender} selected={bKey} onSelect={setBKey} placeholder="Select second fencer…" />
      </div>

      {a && b && (
        <>
          {prediction && (prediction.pool || prediction.de) && (
            <div style={{ marginBottom: 36 }}>
              <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Predicted outcome</div>
              {[
                { label: 'Pool', p: prediction.pool, accent: 'var(--ink)' },
                { label: 'Direct Elimination', p: prediction.de, accent: 'var(--ox)' },
              ].map(({ label, p, accent }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div className="fl-smallcaps" style={{ fontSize: '0.65rem', color: accent, marginBottom: 6 }}>{label}</div>
                  {p ? (
                    <div style={{ position: 'relative', height: 44, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.probA * 100}%`, background: accent }} />
                      <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--paper)', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1rem', mixBlendMode: 'difference' }}>
                        {(p.probA * 100).toFixed(1)}%
                      </div>
                      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1rem' }}>
                        {(p.probB * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', padding: '8px 0' }}>
                      Not enough {label.toLowerCase()} bouts on record for both fencers.
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.78rem', color: 'var(--ink-soft)' }} className="fl-italic">
                <span>{a.name}</span>
                <span>{b.name}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 32, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
            <div style={{ padding: '24px', textAlign: 'center', borderRight: '1px solid var(--rule-soft)' }}>
              <div className="fl-smallcaps">Series</div>
              <div className="fl-display" style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8, color: aWins > bWins ? 'var(--ink)' : 'var(--ink-soft)' }}>{aWins}</div>
              <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 4 }}>wins for {a.name}</div>
            </div>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="fl-smallcaps">Series</div>
              <div className="fl-display" style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8, color: bWins > aWins ? 'var(--ink)' : 'var(--ink-soft)' }}>{bWins}</div>
              <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 4 }}>wins for {b.name}</div>
            </div>
          </div>

          <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Bouts between · {h2hBouts.length}</div>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {h2hBouts.length === 0 && <div className="fl-italic" style={{ padding: 24, color: 'var(--ink-soft)' }}>These fencers have no recorded encounters in this weapon.</div>}
            {h2hBouts.map(x => {
              const aIsA = x.keyA === aKey;
              const aScore = aIsA ? x.scoreA : x.scoreB;
              const bScore = aIsA ? x.scoreB : x.scoreA;
              return (
                <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 1fr 80px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-row-hover">
                  <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{fmtDateShort(x.date)}</div>
                  <div className="fl-display" style={{ fontWeight: x.winnerKey === aKey ? 700 : 400, color: x.winnerKey === aKey ? 'var(--ink)' : 'var(--ink-soft)', textAlign: 'right', paddingRight: 14 }}>
                    {a.name}
                  </div>
                  <div className="fl-mono" style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.05rem' }}>{aScore}–{bScore}</div>
                  <div className="fl-display" style={{ fontWeight: x.winnerKey === bKey ? 700 : 400, color: x.winnerKey === bKey ? 'var(--ink)' : 'var(--ink-soft)', paddingLeft: 14 }}>
                    {b.name}
                  </div>
                  <div className="fl-smallcaps" style={{ fontSize: '0.62rem', textAlign: 'right' }}>
                    {x.type === 'de' ? `DE ${x.deRound}` : 'Pool'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FencerPicker({ fencers, weapon, gender, selected, onSelect, placeholder }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const f = selected ? fencers[selected] : null;
  const w = f && f.byWeapon[weapon];

  const results = useMemo(() => {
    const list = Object.values(fencers).filter(x =>
      x.byWeapon[weapon]
      && (!gender || !x.genders || x.genders.size === 0 || x.genders.has(gender))
    );
    if (!q.trim()) return list.slice(0, 10);
    return list.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  }, [fencers, weapon, gender, q]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ padding: '20px 18px', position: 'relative' }}>
      {f ? (
        <div>
          <div className="fl-smallcaps" style={{ marginBottom: 6 }}>{f.club || '—'}</div>
          <div className="fl-display" style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.1 }}>{f.name}</div>
          {w ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
              <div style={{ opacity: w.pool.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ink)' }}>POOL</div>
                <div className="fl-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {w.pool.bouts > 0 ? fmtRating(w.pool.rating) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                  {w.pool.bouts > 0 ? `${w.pool.bouts}b` : ''}
                </div>
              </div>
              <div style={{ opacity: w.de.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ox)' }}>DE</div>
                <div className="fl-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ox)' }}>
                  {w.de.bouts > 0 ? fmtRating(w.de.rating) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                  {w.de.bouts > 0 ? `${w.de.bouts}b` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>No bouts in this weapon.</div>
          )}
          <div className="fl-link fl-smallcaps" style={{ marginTop: 12, color: 'var(--ox)' }} onClick={() => onSelect(null)}>Change</div>
        </div>
      ) : (
        <>
          <input
            className="fl-input"
            placeholder={placeholder}
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 18, right: 18, background: 'var(--paper)', border: '1px solid var(--rule)', marginTop: 6, zIndex: 30, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(17,20,24,0.10)' }} className="fl-scroll">
              {results.length === 0 && <div className="fl-italic" style={{ padding: 14, color: 'var(--ink-soft)' }}>No matches.</div>}
              {results.map(r => {
                const rw = r.byWeapon[weapon];
                const primaryRating = rw.pool.bouts >= rw.de.bouts ? rw.pool.rating : rw.de.rating;
                return (
                  <div key={r.key} className="fl-link fl-row-hover" style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)' }}
                    onClick={() => { onSelect(r.key); setQ(''); setOpen(false); }}>
                    <div className="fl-display" style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{r.club} · {fmtRating(primaryRating)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Import({ onImport, onLoadDemo, hasData, onClear, rawBouts }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  const handleParse = (raw) => {
    setError('');
    setSuccess('');
    try {
      const rows = parseCSV(raw);
      if (rows.length === 0) { setError('No rows parsed. Check that your CSV has a header row.'); return; }
      const required = ['date', 'weapon', 'fencer_a', 'fencer_b', 'score_a', 'score_b'];
      const missing = required.filter(r => !(r in rows[0]));
      if (missing.length) { setError(`Missing required columns: ${missing.join(', ')}`); return; }
      const valid = rows.filter(r => r.date && r.fencer_a && r.fencer_b && r.score_a !== '' && r.score_b !== '');
      if (valid.length === 0) { setError('No rows passed validation.'); return; }
      onImport(valid);
      setSuccess(`Imported ${valid.length} bout${valid.length === 1 ? '' : 's'}.`);
      setText('');
    } catch (e) {
      setError(`Parse error: ${e.message}`);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleParse(ev.target.result);
    reader.readAsText(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fencingstatsnz-template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fl-fade-in" style={{ maxWidth: 920 }}>
      <div className="fl-smallcaps">Data ingest</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
        Bring in <span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>results</span>
      </h2>

      <div style={{ marginTop: 28, padding: '24px', border: '1px solid var(--rule)', background: 'var(--paper-deep)' }}>
        <div className="fl-smallcaps" style={{ marginBottom: 8 }}>The CSV format</div>
        <p style={{ marginTop: 0, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          Each row is a single bout. Pool bouts and DE bouts share one table — distinguish with the <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85em', background: 'var(--paper-shade)', padding: '1px 5px' }}>bout_type</code> column. Weapon names accept <span className="fl-italic">foil</span>, <span className="fl-italic">epee</span> (or épée), <span className="fl-italic">sabre</span>.
        </p>
        <pre className="fl-mono" style={{ background: 'var(--paper)', padding: 12, fontSize: '0.78rem', overflowX: 'auto', border: '1px solid var(--rule-soft)', margin: '12px 0' }}>{CSV_HEADER}</pre>
        <button className="fl-btn ghost" onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Download size={13} /> Download template
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="fl-smallcaps" style={{ marginBottom: 10 }}>Upload a file</div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
        <button className="fl-btn" onClick={() => fileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Upload size={13} /> Choose CSV file
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="fl-smallcaps" style={{ marginBottom: 10 }}>Or paste CSV</div>
        <textarea className="fl-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={CSV_HEADER + '\n2025-…'} />
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="fl-btn" onClick={() => handleParse(text)} disabled={!text.trim()}>Parse &amp; Import</button>
          {!hasData && <button className="fl-btn ghost" onClick={onLoadDemo}>Or load demo data</button>}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 24, padding: 14, background: 'var(--ink-fade)', border: '1px solid var(--ink)', display: 'flex', gap: 10 }}>
          <AlertCircle size={16} color="var(--ink)" />
          <div style={{ color: 'var(--ink)' }}>{error}</div>
        </div>
      )}
      {success && (
        <div style={{ marginTop: 24, padding: 14, background: 'rgba(26,107,181,0.06)', border: '1px solid var(--ox)', color: 'var(--ox-deep)' }}>
          ✓ {success}
        </div>
      )}

      {hasData && (
        <div style={{ marginTop: 36, padding: 20, border: '1px solid var(--rule)' }}>
          <div className="fl-smallcaps" style={{ marginBottom: 8 }}>Current ledger</div>
          <div style={{ marginBottom: 14 }}>{rawBouts.length} bouts on record.</div>
          <button className="fl-btn danger" onClick={onClear} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={13} /> Clear all data
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsView({ settings, setSettings, onRecompute }) {
  const [draft, setDraft] = useState(settings);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const update = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <div className="fl-fade-in" style={{ maxWidth: 720 }}>
      <div className="fl-smallcaps">Tuning</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
        Rating <span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>parameters</span>
      </h2>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
        Adjust the Glicko-2 parameters and the bout-type weights. Saving will recompute every fencer's rating from the bout history.
      </p>

      <div style={{ marginTop: 28, borderTop: '1px solid var(--ink)' }}>
        {[
          { k: 'initialRating', l: 'Initial rating', help: 'Starting rating for unknown fencers (default 1500).' },
          { k: 'initialRD', l: 'Initial RD', help: 'Starting rating deviation. Higher = less certain (default 350).' },
          { k: 'initialVolatility', l: 'Initial volatility (σ)', help: 'How much rating fluctuates over time (default 0.06).', step: 0.01 },
          { k: 'tau', l: 'Volatility constraint (τ)', help: 'Lower = ratings change more smoothly. Default 0.5.', step: 0.1 },
          { k: 'upsetThreshold', l: 'Upset threshold', help: 'Rating gap (in points) for a result to count as an upset (default 75).' },
          { k: 'upsetMultiplier', l: 'Upset multiplier', help: 'Magnitude scaling applied on top of Glicko-2 when an upset occurs (default 1.25).', step: 0.05 },
        ].map((row, i, arr) => (
          <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', alignItems: 'center', padding: '16px 4px', borderBottom: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div>
              <div className="fl-display" style={{ fontWeight: 600 }}>{row.l}</div>
              <div className="fl-italic" style={{ fontSize: '0.86rem', color: 'var(--ink-soft)', marginTop: 2 }}>{row.help}</div>
            </div>
            <input type="number" step={row.step || 1} value={draft[row.k]}
              onChange={e => update(row.k, parseFloat(e.target.value))}
              style={{ fontFamily: 'JetBrains Mono', textAlign: 'right', background: 'var(--paper-deep)', border: '1px solid var(--rule)', padding: '8px 10px', outline: 'none', fontSize: '0.95rem' }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button className="fl-btn" disabled={!dirty} onClick={() => { setSettings(draft); onRecompute(draft); }}>Save &amp; Recompute</button>
        <button className="fl-btn ghost" disabled={!dirty} onClick={() => setDraft(settings)}>Reset</button>
        <button className="fl-btn ghost" onClick={() => { setDraft(DEFAULT_SETTINGS); }}>Defaults</button>
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [rawBouts, setRawBouts] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('leaderboard');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const [weapon, setWeapon] = useState('epee');
  const [gender, setGender] = useState('M');  // 'M' | 'W'
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      const data = await loadFromStorage();
      if (data) {
        if (data.rawBouts) setRawBouts(data.rawBouts);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
      setLoaded(true);
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage({ rawBouts, settings });
  }, [rawBouts, settings, loaded]);

  const { fencers, bouts, competitions } = useMemo(
    () => processBouts(rawBouts, settings),
    [rawBouts, settings]
  );
  const hasData = rawBouts.length > 0;

  const goFencer = (k) => { setSelectedFencer(k); setSelectedComp(null); setView('fencer'); };
  const goComp = (id) => { setSelectedComp(id); setSelectedFencer(null); setView('comp'); };

  const handleImport = (rows) => {
    setRawBouts(prev => [...prev, ...rows]);
    setView('leaderboard');
  };
  const handleLoadDemo = () => { setRawBouts(makeDemoBouts()); setView('leaderboard'); };
  const handleClear = () => {
    if (confirm('Clear all bouts? This cannot be undone.')) {
      setRawBouts([]); clearStorage();
    }
  };

  // Compute "popular" weapon if epee has no data but another does
  useEffect(() => {
    if (!hasData) return;
    if (Object.values(fencers).some(f => f.byWeapon[weapon])) return;
    for (const w of ['epee', 'foil', 'sabre']) {
      if (Object.values(fencers).some(f => f.byWeapon[w])) { setWeapon(w); return; }
    }
  }, [hasData, fencers, weapon]);

  return (
    <div className="fl-root">
      <style>{STYLE}</style>
      <Header
        view={view}
        setView={(v) => { setView(v); setSelectedFencer(null); setSelectedComp(null); }}
        weapon={weapon}
        setWeapon={setWeapon}
        gender={gender}
        setGender={setGender}
        fencers={fencers}
        onSelectFencer={goFencer}
        hasData={hasData}
      />

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 80px' }}>
        {!hasData && view !== 'import' && view !== 'settings' ? (
          <EmptyState onLoadDemo={handleLoadDemo} onGotoImport={() => setView('import')} />
        ) : view === 'leaderboard' ? (
          <Leaderboard fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} onSelectFencer={goFencer} />
        ) : view === 'competitions' ? (
          <Competitions competitions={competitions} weapon={weapon} gender={gender} onSelectComp={goComp} />
        ) : view === 'h2h' ? (
          <HeadToHead fencers={fencers} bouts={bouts} weapon={weapon} gender={gender} onSelectFencer={goFencer} />
        ) : view === 'import' ? (
          <Import onImport={handleImport} onLoadDemo={handleLoadDemo} hasData={hasData} onClear={handleClear} rawBouts={rawBouts} />
        ) : view === 'settings' ? (
          <SettingsView settings={settings} setSettings={setSettings} onRecompute={() => {}} />
        ) : view === 'fencer' && selectedFencer ? (
          <FencerProfile
            fencerKey={selectedFencer}
            fencers={fencers}
            bouts={bouts}
            competitions={competitions}
            weapon={weapon}
            onBack={() => setView('leaderboard')}
            onSelectFencer={goFencer}
            onSelectComp={goComp}
          />
        ) : view === 'comp' && selectedComp ? (
          <CompetitionDetail
            compId={selectedComp}
            competitions={competitions}
            fencers={fencers}
            bouts={bouts}
            onBack={() => setView('competitions')}
            onSelectFencer={goFencer}
          />
        ) : null}

        <footer style={{ marginTop: 80, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
          <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', textAlign: 'center' }}>
            <span className="fl-ornament">❦</span>  A prototype  ·  Glicko-2 with bout-type weighting and an upset multiplier  ·  Data persists locally
          </div>
        </footer>
      </main>
    </div>
  );
}

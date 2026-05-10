import { updateRating } from '../engine/glicko2.js';

export const nameKey = (n) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Canonical club names. Keys are lowercased + whitespace-collapsed variants;
// values are the display name we want everywhere.
const CLUB_ALIASES = {
  'auckland swords club': 'Auckland Swords',
  'claymore swords club': 'Claymore Swords',
  'jyd swords club': 'JYD Swords',
  'piwakawaka fencing club': 'Piwakawaka Fencing',
  'waikato swords club': 'Waikato Swords',
  'hutt valley swords club': 'Hutt Valley Swords',
  'hutt valley fencing club': 'Hutt Valley Swords',
  'the sabre club': 'Sabre Club',
  'mt albert grammar school': 'Mount Albert Grammar School',
  'mount albert grammar school epee club': 'Mount Albert Grammar School',
  'auckland grammar school fencing': 'Auckland Grammar School',
  'agfc': 'Auckland Grammar School',
  'ags': 'Auckland Grammar School',
  'fahs sabres fencing club': 'FAHS Sabre Fencing Club',
  'vuw swords club': 'Victoria University of Wellington Swords Club',
  'epsom girls grammar school fencing': 'Epsom Girls Grammar',
  'epsom girlsgrammar': 'Epsom Girls Grammar',
  // Wellington Fencing Club
  'wel fencing': 'Wellington Fencing Club',
  'wel fencing club': 'Wellington Fencing Club',
  'well fencing club': 'Wellington Fencing Club',
  'wfc': 'Wellington Fencing Club',
  // NZ Academy of Fencing
  'nz academy of fencing': 'New Zealand Academy of Fencing',
  // South Wellington Fencing Club
  'wellington south': 'South Wellington Fencing Club',
  'wellington south fencing club': 'South Wellington Fencing Club',
  // JF Fencing School
  'jf fencing': 'JF Fencing School',
  'j f fencing school': 'JF Fencing School',
  // Pulse Fencing
  'pulse fencing club': 'Pulse Fencing',
  // Typo / formatting normalisations
  'hawkes bay blades': "Hawke's Bay Blades",
  'fencing in nelson tasman': 'Fencing in Nelson-Tasman',
  'invictus fencing club': 'Invictus Fencing',
  'university of canterbury fencing club': 'University of Canterbury Fencing Club',
  // University of Canterbury Fencing Club
  'canterbury uni': 'University of Canterbury Fencing Club',
  // Cashmere High School Fencing Club
  'cashmere high': 'Cashmere High School Fencing Club',
  // Macleans College
  'macleans college fencing club': 'Macleans College',
  // Rangitoto College
  'rangitoto college fencing': 'Rangitoto College',
  'rangitoto college fencing club': 'Rangitoto College',
  // St Kentigern College
  'skc': 'St Kentigern College',
  'saint kentigern college fencing club': 'St Kentigern College',
  // United
  'united fencing club': 'United',
  // Diocesan School
  'diocesan fencing club': 'Diocesan School',
  'diocesan school for girls': 'Diocesan School',
  // Victoria University of Wellington Swords Club
  'vuw': 'Victoria University of Wellington Swords Club',
  'victoria university': 'Victoria University of Wellington Swords Club',
  // Garbage / data-entry errors — strip to empty so they don't appear as clubs
  'alexander lee': '',
  'jacob takuira-mita': '',
  'larry lin': '',
  'peter kell': '',
  'tim (mutian) wang': '',
  'other': '',
  '"': '',
  'university': '',
};

export function canonicalizeClub(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  // `in` check (not ||) so empty-string values map garbage entries to no-club.
  return key in CLUB_ALIASES ? CLUB_ALIASES[key] : trimmed;
}

export const normWeapon = (w) => {
  const x = (w || '').toLowerCase().trim();
  if (x.startsWith('f')) return 'foil';
  if (x.startsWith('s')) return 'sabre';
  return 'epee';
};
export const normBoutType = (t) => ((t || '').toLowerCase().trim().startsWith('d') ? 'de' : 'pool');

// Detect whether dates in a dataset are day-first (D/M/Y, NZ) or month-first (M/D/Y, US).
// Look for any unambiguous example (a part > 12). If both styles are present we default
// to day-first, matching the Python ingest script.
function detectDateFormat(dates) {
  let hasMdy = false, hasDmy = false;
  for (const d of dates) {
    if (!d) continue;
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(d)) continue;
    const parts = d.split(/[\/.\-]/);
    if (parts.length !== 3) continue;
    const a = parseInt(parts[0], 10), b = parseInt(parts[1], 10);
    if (Number.isFinite(a) && a > 12) hasDmy = true;
    if (Number.isFinite(b) && b > 12) hasMdy = true;
  }
  if (hasMdy && !hasDmy) return 'mdy';
  return 'dmy';
}

export function normDate(s, fmt = 'dmy') {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parts = str.split(/[\/.\-]/);
  if (parts.length !== 3) return str;
  let year, month, day;
  if (parts[2].length === 4) {
    year = parts[2];
    if (fmt === 'mdy') { month = parts[0]; day = parts[1]; }
    else { day = parts[0]; month = parts[1]; }
  } else if (parts[0].length === 4) {
    year = parts[0]; month = parts[1]; day = parts[2];
  } else {
    return str;
  }
  if (!/^\d+$/.test(month) || !/^\d+$/.test(day)) return str;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parseCSVLine(line) {
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

export function parseCSV(text) {
  const lines = text.replace(/﻿/g, '').trim().split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const o = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}

export function processBouts(rawBouts, settings) {
  const dateFmt = detectDateFormat(rawBouts.map(b => b.date));
  rawBouts = rawBouts.map(b => b.date ? { ...b, date: normDate(b.date, dateFmt) } : b);

  const fencers = {};
  const bouts = [];
  const compMap = {};

  const normGender = (g) => {
    const x = (g || '').toLowerCase().trim();
    if (x.startsWith('w') || x.startsWith('f') || x === 'ladies') return 'W';
    if (x.startsWith('m')) return 'M';
    return '';
  };

  // Scan anywhere in a string for gender keywords (mirrors Python extract_gender).
  // "women" is checked before "men" because "women" contains "men" as a substring.
  const genderFromText = (text) => {
    const x = (text || '').toLowerCase();
    if (x.includes('women') || x.includes('ladies') || x.includes('female')) return 'W';
    if (x.includes('men') || x.includes('male')) return 'M';
    return '';
  };

  const ensure = (name, club, weapon, gender, competition) => {
    const k = nameKey(name);
    if (!k) return null;
    const canonClub = canonicalizeClub(club);
    if (!fencers[k]) fencers[k] = { key: k, name: name.trim(), club: canonClub, byWeapon: {}, genders: new Set() };
    if (!fencers[k].byWeapon[weapon]) {
      const fresh = () => ({
        rating: settings.initialRating, rd: settings.initialRD, volatility: settings.initialVolatility,
        peak: settings.initialRating, history: [], bouts: 0, wins: 0, losses: 0, ties: 0,
      });
      fencers[k].byWeapon[weapon] = { pool: fresh(), de: fresh() };
    }
    if (canonClub && !fencers[k].club) fencers[k].club = canonClub;
    // Only assign gender once — lock fencer to first gender found so a name
    // collision or data error can't place them in both categories.
    if (fencers[k].genders.size === 0) {
      const g = normGender(gender) || genderFromText(competition);
      if (g) fencers[k].genders.add(g);
    }
    return fencers[k];
  };

  const sorted = [...rawBouts].sort((a, b) => {
    const dCmp = (a.date || '').localeCompare(b.date || '');
    if (dCmp !== 0) return dCmp;
    return (a.competition || '').localeCompare(b.competition || '');
  });
  const periods = {};
  for (const b of sorted) {
    const w = normWeapon(b.weapon);
    const comp = b.competition || 'Unnamed';
    const key = `${b.date}␟${comp}␟${w}`;
    if (!periods[key]) periods[key] = [];
    periods[key].push({ ...b, _weapon: w, _type: normBoutType(b.bout_type) });
  }

  for (const pkey of Object.keys(periods).sort()) {
    const periodBouts = periods[pkey];
    const [date, , weapon] = pkey.split('␟');

    const snapPool = {};
    const snapDe = {};

    for (const b of periodBouts) {
      const fA = ensure(b.fencer_a, b.club_a, weapon, b.gender, b.competition);
      const fB = ensure(b.fencer_b, b.club_b, weapon, b.gender, b.competition);
      if (!fA || !fB) continue;
      const wA = fA.byWeapon[weapon], wB = fB.byWeapon[weapon];
      if (!snapPool[fA.key]) snapPool[fA.key] = { rating: wA.pool.rating, rd: wA.pool.rd, volatility: wA.pool.volatility };
      if (!snapPool[fB.key]) snapPool[fB.key] = { rating: wB.pool.rating, rd: wB.pool.rd, volatility: wB.pool.volatility };
      if (!snapDe[fA.key])   snapDe[fA.key]   = { rating: wA.de.rating,   rd: wA.de.rd,   volatility: wA.de.volatility };
      if (!snapDe[fB.key])   snapDe[fB.key]   = { rating: wB.de.rating,   rd: wB.de.rd,   volatility: wB.de.volatility };
    }

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
      poolMedian: poolStats.median, poolMean: poolStats.mean, poolTop: poolStats.top,
      deMedian: deStats.median, deMean: deStats.mean, deTop: deStats.top,
      median: poolStats.median, mean: poolStats.mean, top: poolStats.top,
      size: c.fencerKeys.size,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  return { fencers, bouts, competitions };
}

export function strengthTier(median) {
  if (median >= 1750) return { label: 'S', color: 'var(--ox)' };
  if (median >= 1650) return { label: 'A', color: 'var(--brass)' };
  if (median >= 1550) return { label: 'B', color: 'var(--moss)' };
  if (median >= 1450) return { label: 'C', color: 'var(--ink-soft)' };
  return { label: 'D', color: 'var(--ink-faint)' };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDemoBouts() {
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
    let alive = [...fencers].sort((a, b) => skill[b[0]] - skill[a[0]]);
    const rounds = ['T16', 'T8', 'QF', 'SF', 'Final'];
    let r = 0;
    while (alive.length > 1) {
      const next = [];
      const round = rounds[Math.max(0, rounds.length - Math.ceil(Math.log2(alive.length)))] || `T${alive.length}`;
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

  pools(epeeFencers, 6, '2025-03-15', 'NZ Open 2025', 'epee');
  bracket(epeeFencers.slice(0, 8), '2025-03-15', 'NZ Open 2025', 'epee');

  skill['Tane Ngata'] = 1780;
  pools(epeeFencers.slice(0, 10), 5, '2025-06-22', 'Wellington Cup 2025', 'epee');
  bracket(epeeFencers.slice(0, 8), '2025-06-22', 'Wellington Cup 2025', 'epee');

  pools(foilFencers, 4, '2025-09-07', 'NZ Nationals 2025', 'foil');
  bracket(foilFencers, '2025-09-07', 'NZ Nationals 2025', 'foil');

  skill['Charlotte Reeves'] = 1790;
  pools(epeeFencers, 6, '2026-03-14', 'NZ Open 2026', 'epee');
  bracket(epeeFencers.slice(0, 8), '2026-03-14', 'NZ Open 2026', 'epee');

  return out;
}

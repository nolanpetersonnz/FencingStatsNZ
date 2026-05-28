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

// Withdrawal / no-result flag set by the ingest on bouts where a fencer has a
// non-standard DE result code (medical, abandon, DNF, exclusion). Such a bout
// is recorded as a loss for the fencer who withdrew and a win for the opponent,
// but moves neither rating. Returns 'a' | 'b' | 'both' | null. The `flag`
// column is optional — bouts without it (older CSVs) parse as normal results.
export function withdrawalSide(b) {
  const f = (b && b.flag != null ? String(b.flag) : '').toLowerCase().trim();
  if (!f) return null;
  if (f === 'wd_a' || f === 'wd:a') return 'a';
  if (f === 'wd_b' || f === 'wd:b') return 'b';
  if (f.startsWith('wd')) return 'both';
  return null;
}

// Age categories for rating streams. Open/Senior is the default bucket.
export const AGE_CATEGORIES = ['cadet', 'junior', 'senior', 'veteran'];

// "Downward-inclusive" stream rule: a bout in category X contributes to its own
// stream and to all younger-category streams within the cadet→senior chain.
// Veteran is isolated (vet bouts only feed the vet stream).
export const STREAMS_FOR_CATEGORY = {
  cadet:    ['cadet'],
  junior:   ['junior', 'cadet'],
  senior:   ['senior', 'junior', 'cadet'],
  veteran:  ['veteran'],
};

// Manual category overrides for competitions the regex mis-classifies.
// Keys are lowercased competition names (post mixed-event rewrite).
export const AGE_OVERRIDES = {
  // 'some weird comp 2024': 'junior',
};

export function parseAgeCategory(comp) {
  const x = (comp || '').toLowerCase().trim();
  if (AGE_OVERRIDES[x]) return AGE_OVERRIDES[x];
  if (/\bvet\w*\b|\bmasters?\b/.test(x)) return 'veteran';
  // Secondary-schools events are age-restricted (NZ school years 9–13). They
  // match no U-band keyword, so without this they fell through to 'senior' and
  // their bouts wrongly fed the senior stream / made fencers native seniors.
  if (/\bsec(ondary)?\.?\s*schools?\b/.test(x)) return 'cadet';
  if (/\bu20\b|\bunder ?20\b|\bjunior\b/.test(x)) return 'junior';
  if (/\bu1[3-7]\b|\bunder ?1[3-7]\b|\bcadet\b|\byouth\b/.test(x)) return 'cadet';
  return 'senior';
}

// Split "Foo - Mens" / "Foo - Womens" into { base: 'Foo', variant }.
export function parseCompVariant(name) {
  if (!name) return { base: '', variant: null };
  const m = /^(.*?)\s*[-–—]\s*(men'?s?|women'?s?|ladies|male|female)\s*$/i.exec(name);
  if (!m) return { base: name.trim(), variant: null };
  const v = m[2].toLowerCase();
  const variant = (v.startsWith('w') || v === 'ladies' || v === 'female') ? 'womens' : 'mens';
  return { base: m[1].trim(), variant };
}

// Order-independent canonical hash of a physical bout. Used to detect rows that
// represent the same match (e.g. a mixed event ingested once as "- Mens" and
// once as "- Womens").
export function boutHash(b, weaponNorm) {
  const a = nameKey(b.fencer_a);
  const c = nameKey(b.fencer_b);
  const sA = (b.score_a ?? '').toString().trim();
  const sB = (b.score_b ?? '').toString().trim();
  const typ = normBoutType(b.bout_type);
  const round = (b.de_round || '').trim().toLowerCase();
  if (a <= c) return `${weaponNorm}|${a}|${c}|${sA}|${sB}|${typ}|${round}`;
  return `${weaponNorm}|${c}|${a}|${sB}|${sA}|${typ}|${round}`;
}

// Identify (date, weapon, baseComp) tuples where both "- Mens" and "- Womens"
// variants exist AND share at least one identical bout — i.e. the scraper
// ingested the same physical event twice.
export function detectMixedEvents(rawBouts) {
  const variants = {};
  for (const b of rawBouts) {
    const weapon = normWeapon(b.weapon);
    const { base, variant } = parseCompVariant(b.competition);
    if (!variant) continue;
    const key = `${b.date}|${weapon}|${base.toLowerCase()}`;
    if (!variants[key]) variants[key] = { mens: new Set(), womens: new Set() };
    variants[key][variant].add(boutHash(b, weapon));
  }
  const mixed = new Set();
  for (const k in variants) {
    const { mens, womens } = variants[k];
    if (mens.size === 0 || womens.size === 0) continue;
    for (const h of mens) {
      if (womens.has(h)) { mixed.add(k); break; }
    }
  }
  return mixed;
}

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

  // Dedupe mixed events. When the same physical event was ingested once as
  // "X - Mens" and once as "X - Womens" with identical bout rows, every match
  // would otherwise be processed twice and Elo gains/losses would double.
  // Strategy: detect such (date, weapon, base) tuples, rewrite both variants
  // to a single canonical name (the base, with no gender suffix), clear the
  // per-row gender label (it's noise from the scraper, not the fencer's actual
  // gender), then drop duplicate rows by canonical bout hash.
  const mixedKeys = detectMixedEvents(rawBouts);
  const seen = new Set();
  const prepped = [];
  for (const b of rawBouts) {
    const weapon = normWeapon(b.weapon);
    const { base, variant } = parseCompVariant(b.competition);
    const mixKey = `${b.date}|${weapon}|${base.toLowerCase()}`;
    const isMixed = variant && mixedKeys.has(mixKey);
    const competition = isMixed ? base : (b.competition || '').trim();
    const gender = isMixed ? '' : (b.gender || '');
    const dedupKey = `${b.date}|${weapon}|${competition.toLowerCase()}|${boutHash(b, weapon)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    prepped.push({ ...b, competition, gender });
  }
  rawBouts = prepped;

  const fencers = {};
  const bouts = [];
  const compMap = {};

  const normGender = (g) => {
    const x = (g || '').toLowerCase().trim();
    if (x.startsWith('w') || x.startsWith('f') || x === 'ladies') return 'W';
    if (x.startsWith('m')) return 'M';
    return '';
  };

  // Scan anywhere in a string for gender keywords. "women" is checked before
  // "men" because "women" contains "men" as a substring.
  const genderFromText = (text) => {
    const x = (text || '').toLowerCase();
    if (x.includes('women') || x.includes('ladies') || x.includes('female')) return 'W';
    if (x.includes('men') || x.includes('male')) return 'M';
    return '';
  };

  const freshStream = () => ({
    rating: settings.initialRating, rd: settings.initialRD, volatility: settings.initialVolatility,
    peak: settings.initialRating, history: [], bouts: 0, wins: 0, losses: 0, ties: 0,
  });

  const ensure = (name, club, weapon) => {
    const k = nameKey(name);
    if (!k) return null;
    const canonClub = canonicalizeClub(club);
    if (!fencers[k]) {
      fencers[k] = {
        key: k, name: name.trim(), club: canonClub,
        byWeapon: {}, genders: new Set(),
        // Categories the fencer has ACTUALLY competed in (by event tag), per
        // weapon. Used for leaderboard membership: e.g. you only appear in the
        // Junior leaderboard if you've fenced a Junior-tagged event. This is
        // distinct from which streams receive Elo updates — Senior bouts feed
        // the Junior rating stream via downward inclusion, but a fencer with
        // only Senior bouts is not a Junior and shouldn't show up there.
        nativeCategories: {},
        // Latest year the fencer competed in each (weapon, category), used to
        // filter out fencers who have aged out — e.g. someone who fenced
        // Junior in 2022 but no Junior bouts since then.
        // Shape: nativeLatestYear[weapon][category] = number (e.g. 2026).
        nativeLatestYear: {},
        // Per-category vote tally — finalized after all bouts processed.
        _genderVotes: { M: 0, W: 0 },
      };
    }
    if (!fencers[k].byWeapon[weapon]) {
      const slot = { pool: freshStream(), de: freshStream(), byAge: {} };
      for (const cat of AGE_CATEGORIES) slot.byAge[cat] = { pool: freshStream(), de: freshStream() };
      fencers[k].byWeapon[weapon] = slot;
    }
    if (canonClub && !fencers[k].club) fencers[k].club = canonClub;
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

  // Pluck the right rating-state object for a given (fencer, weapon, stream)
  // where stream is 'top' (the all-events rating) or one of AGE_CATEGORIES.
  const getStream = (fencer, weapon, ageStream, boutType) => {
    const w = fencer.byWeapon[weapon];
    if (ageStream === 'top') return w[boutType];
    return w.byAge[ageStream][boutType];
  };

  for (const pkey of Object.keys(periods).sort()) {
    const periodBouts = periods[pkey];
    const [date, comp, weapon] = pkey.split('␟');
    const periodCategory = parseAgeCategory(comp);
    const ageStreamsForPeriod = STREAMS_FOR_CATEGORY[periodCategory] || [];

    // Ensure all participants exist for this weapon.
    for (const b of periodBouts) {
      ensure(b.fencer_a, b.club_a, weapon);
      ensure(b.fencer_b, b.club_b, weapon);
    }

    // Run a snapshot+aggregate+apply pass for the top-level stream first
    // (always updated) and for each age-stream this period feeds into.
    const allStreamsToUpdate = ['top', ...ageStreamsForPeriod];
    // Stash top-level snapshots so we can attach pre/post ratings to the
    // public `bouts` records — those reflect the top stream, as before.
    let topSnapPool = null, topSnapDe = null;

    for (const ageStream of allStreamsToUpdate) {
      const snapPool = {};
      const snapDe = {};

      for (const b of periodBouts) {
        const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
        if (!kA || !kB) continue;
        const fA = fencers[kA], fB = fencers[kB];
        if (!fA || !fB) continue;
        const sAPool = getStream(fA, weapon, ageStream, 'pool');
        const sBPool = getStream(fB, weapon, ageStream, 'pool');
        const sADe = getStream(fA, weapon, ageStream, 'de');
        const sBDe = getStream(fB, weapon, ageStream, 'de');
        if (!snapPool[kA]) snapPool[kA] = { rating: sAPool.rating, rd: sAPool.rd, volatility: sAPool.volatility };
        if (!snapPool[kB]) snapPool[kB] = { rating: sBPool.rating, rd: sBPool.rd, volatility: sBPool.volatility };
        if (!snapDe[kA])   snapDe[kA]   = { rating: sADe.rating,   rd: sADe.rd,   volatility: sADe.volatility };
        if (!snapDe[kB])   snapDe[kB]   = { rating: sBDe.rating,   rd: sBDe.rd,   volatility: sBDe.volatility };
      }

      const perFencerPool = {};
      const perFencerDe = {};
      for (const b of periodBouts) {
        const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
        if (!kA || !kB || kA === kB) continue;
        if (withdrawalSide(b)) continue; // no rating contribution
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

      const isTop = ageStream === 'top';
      const applyStream = (perFencer, snap, boutType) => {
        for (const k in perFencer) {
          const before = snap[k];
          const after = updateRating({ rating: before.rating, rd: before.rd, volatility: before.volatility }, perFencer[k], settings);
          const wep = getStream(fencers[k], weapon, ageStream, boutType);
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
          // Only the top-level stream tracks rating-over-time history (used by
          // the fencer profile chart). Per-category streams skip it to keep
          // localStorage payloads small.
          if (isTop) wep.history.push({ date, rating: Math.round(after.rating), rd: Math.round(after.rd) });
        }
      };
      applyStream(perFencerPool, snapPool, 'pool');
      applyStream(perFencerDe, snapDe, 'de');

      // Withdrawals: tally the loss (withdrawer) / win (opponent) on each stream
      // this period feeds, with no rating movement (they were skipped above).
      for (const b of periodBouts) {
        const side = withdrawalSide(b);
        if (!side) continue;
        const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
        if (!kA || !kB || kA === kB) continue;
        if (!fencers[kA] || !fencers[kB]) continue;
        const sA = getStream(fencers[kA], weapon, ageStream, b._type);
        const sB = getStream(fencers[kB], weapon, ageStream, b._type);
        sA.bouts += 1; sB.bouts += 1;
        if (side === 'a') { sA.losses += 1; sB.wins += 1; }
        else if (side === 'b') { sB.losses += 1; sA.wins += 1; }
        else { sA.losses += 1; sB.losses += 1; }
      }

      if (isTop) { topSnapPool = snapPool; topSnapDe = snapDe; }
    }

    // Build public bout records + competition aggregates using top-level snapshots.
    for (const b of periodBouts) {
      const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
      if (!kA || !kB || kA === kB) continue;
      const sA = parseInt(b.score_a, 10), sB = parseInt(b.score_b, 10);
      if (isNaN(sA) || isNaN(sB)) continue;
      const isDe = b._type === 'de';
      const snap = isDe ? topSnapDe : topSnapPool;
      if (!snap || !snap[kA] || !snap[kB]) continue;
      const wepA = fencers[kA].byWeapon[weapon][isDe ? 'de' : 'pool'];
      const wepB = fencers[kB].byWeapon[weapon][isDe ? 'de' : 'pool'];

      // Gender votes: only single-gender event rows contribute. Mixed-event
      // rows had their gender field cleared in the prepass.
      const bg = normGender(b.gender) || genderFromText(b.competition);
      if (bg) {
        fencers[kA]._genderVotes[bg] = (fencers[kA]._genderVotes[bg] || 0) + 1;
        fencers[kB]._genderVotes[bg] = (fencers[kB]._genderVotes[bg] || 0) + 1;
      }

      // Record that these two fencers natively competed in this category for
      // this weapon, regardless of which streams the bout fed via inclusion.
      (fencers[kA].nativeCategories[weapon] ||= new Set()).add(periodCategory);
      (fencers[kB].nativeCategories[weapon] ||= new Set()).add(periodCategory);
      const year = parseInt((date || '').slice(0, 4), 10);
      if (Number.isFinite(year)) {
        const aY = (fencers[kA].nativeLatestYear[weapon] ||= {});
        const bY = (fencers[kB].nativeLatestYear[weapon] ||= {});
        if (!aY[periodCategory] || year > aY[periodCategory]) aY[periodCategory] = year;
        if (!bY[periodCategory] || year > bY[periodCategory]) bY[periodCategory] = year;
      }

      // Withdrawals carry zero rating movement; the opponent is the winner.
      const wd = withdrawalSide(b);
      const ratingAAfter = wd ? snap[kA].rating : wepA.rating;
      const ratingBAfter = wd ? snap[kB].rating : wepB.rating;
      const winnerKey = wd
        ? (wd === 'a' ? kB : wd === 'b' ? kA : null)
        : (sA > sB ? kA : sB > sA ? kB : null);

      bouts.push({
        id: bouts.length,
        date, weapon, type: b._type, deRound: (b.de_round || '').trim(),
        competition: (b.competition || '').trim(),
        ageCategory: periodCategory,
        keyA: kA, keyB: kB, scoreA: sA, scoreB: sB,
        ratingABefore: snap[kA].rating, ratingBBefore: snap[kB].rating,
        ratingAAfter, ratingBAfter,
        deltaA: ratingAAfter - snap[kA].rating, deltaB: ratingBAfter - snap[kB].rating,
        winnerKey,
        ...(wd ? { withdrawal: wd } : {}),
      });

      const compId = `${b.competition || 'Unnamed'}|${weapon}|${date}`;
      if (!compMap[compId]) compMap[compId] = {
        id: compId, name: b.competition || 'Unnamed', date, weapon,
        ageCategory: periodCategory,
        fencerKeys: new Set(), bouts: [], preRatingsPool: {}, preRatingsDe: {}, genders: new Set(),
      };
      compMap[compId].fencerKeys.add(kA);
      compMap[compId].fencerKeys.add(kB);
      compMap[compId].preRatingsPool[kA] = topSnapPool[kA].rating;
      compMap[compId].preRatingsPool[kB] = topSnapPool[kB].rating;
      compMap[compId].preRatingsDe[kA] = topSnapDe[kA].rating;
      compMap[compId].preRatingsDe[kB] = topSnapDe[kB].rating;
      compMap[compId].bouts.push(bouts[bouts.length - 1]);
      if (bg) compMap[compId].genders.add(bg);
    }
  }

  // Finalize fencer.genders by majority vote across all single-gender bouts.
  // Tie or no votes → leave gender unset.
  for (const k in fencers) {
    const v = fencers[k]._genderVotes || { M: 0, W: 0 };
    let g = null;
    if (v.M > v.W) g = 'M';
    else if (v.W > v.M) g = 'W';
    fencers[k].genders = new Set(g ? [g] : []);
    delete fencers[k]._genderVotes;
  }

  // Mixed-event competitions had their row-level gender labels blanked during
  // dedupe, so compMap[c].genders is empty. Reconstruct it from participants'
  // finalized genders so the Competitions page still surfaces mixed events
  // under both Mens and Womens filters.
  for (const id in compMap) {
    const c = compMap[id];
    if (c.genders.size > 0) continue;
    for (const fk of c.fencerKeys) {
      const fg = fencers[fk]?.genders;
      if (fg) for (const g of fg) c.genders.add(g);
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

// Bracket size implied by a DE round label (Final=2, SF=4, QF=8, T16=16, …).
const DE_ROUND_SIZE = { final: 2, sf: 4, qf: 8 };
function deRoundSize(round) {
  const r = (round || '').toString().trim().toLowerCase();
  if (DE_ROUND_SIZE[r]) return DE_ROUND_SIZE[r];
  const m = /^t(\d+)$/.exec(r);
  return m ? parseInt(m[1], 10) : Infinity;
}

function ordinal(n) {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Derive a fencer's placement at one competition from their DE bouts. Official
// placings aren't in the FeNZ data, so this is reconstructed from the bracket:
// the fencer who never lost a DE placed 1st, the fencer who lost the final 2nd,
// and everyone eliminated earlier is *tied* at the top of their round's band —
// fencing runs no classification bouts, so the two losing semi-finalists share
// 3rd, the four quarter-finalists share 5th, and so on (lose the round of N →
// "{N/2+1} tied"). Returns { rank, label }, rank = that place for sorting, or
// null when there were no DE bouts (pool-only).
export function deFinish(myDeBouts, key) {
  if (!myDeBouts || myDeBouts.length === 0) return null;
  const losses = myDeBouts.filter((b) => b.winnerKey && b.winnerKey !== key);
  if (losses.length === 0) return { rank: 1, label: '1' };
  const size = Math.min(...losses.map((b) => deRoundSize(b.deRound)));
  if (!Number.isFinite(size)) return { rank: 9999, label: 'DE' };
  if (size === 2) return { rank: 2, label: '2' };
  const place = Math.floor(size / 2) + 1;
  return { rank: place, label: `${ordinal(place)} tied` };
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

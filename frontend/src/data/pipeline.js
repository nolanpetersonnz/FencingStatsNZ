import { updateRating, winProbability, decayRD } from '../engine/glicko2.js';

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

// Fractional years between two YYYY-MM-DD dates, for the inactivity decay.
// Returns 0 when either date is missing or out of order, so a fencer's first
// appearance never inflates.
function yearsBetween(from, to) {
  if (!from || !to) return 0;
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / (365.25 * 24 * 3600 * 1000);
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
    // Last date this stream got rating-bearing evidence, for the inactivity
    // decay. A withdrawal doesn't reset it — the clock measures how stale our
    // evidence is, and a withdrawal carries none.
    lastDate: null,
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
    // Track the most-recent affiliation: periods are processed in date order,
    // so overwriting with each non-empty club leaves the latest one. Fencers
    // move clubs over time and the displayed club should follow (Brendan).
    if (canonClub) fencers[k].club = canonClub;
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

      // Pre-period snapshot of a stream. The RD is inflated for time idle since
      // the stream last saw evidence (no-op when inactivityDecayC is 0), and the
      // inflated value is what both this fencer's own update and their
      // opponents' updates see — everyone enters the period at the same widened
      // uncertainty.
      const snapState = (s) => ({
        rating: s.rating,
        rd: decayRD(s.rd, yearsBetween(s.lastDate, date), settings.inactivityDecayC, settings.initialRD),
        volatility: s.volatility,
      });

      for (const b of periodBouts) {
        const kA = nameKey(b.fencer_a), kB = nameKey(b.fencer_b);
        if (!kA || !kB) continue;
        const fA = fencers[kA], fB = fencers[kB];
        if (!fA || !fB) continue;
        const sAPool = getStream(fA, weapon, ageStream, 'pool');
        const sBPool = getStream(fB, weapon, ageStream, 'pool');
        const sADe = getStream(fA, weapon, ageStream, 'de');
        const sBDe = getStream(fB, weapon, ageStream, 'de');
        if (!snapPool[kA]) snapPool[kA] = snapState(sAPool);
        if (!snapPool[kB]) snapPool[kB] = snapState(sBPool);
        if (!snapDe[kA])   snapDe[kA]   = snapState(sADe);
        if (!snapDe[kB])   snapDe[kB]   = snapState(sBDe);
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
          wep.lastDate = date;
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
        rdABefore: snap[kA].rd, rdBBefore: snap[kB].rd,
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

// Derive a fencer's placement at one competition from their DE bouts. Official
// placings aren't in the FeNZ data, so this is reconstructed from the bracket:
// 1st (never lost a DE), 2nd (lost the final), then 3rd — fencing awards two
// bronzes and runs no 3rd-place bout, so the losing semi-finalists are "3rd
// tied" with no 4th. Deeper rounds are reported as the round's place band:
// lose the table of 8 → "5–8", of 16 → "9–16", of 32 → "17–32", and so on.
// Returns { rank, label }, rank = the band's top place for sorting, or null
// when there were no DE bouts (pool-only).
export function deFinish(myDeBouts, key) {
  if (!myDeBouts || myDeBouts.length === 0) return null;
  const losses = myDeBouts.filter((b) => b.winnerKey && b.winnerKey !== key);
  if (losses.length === 0) return { rank: 1, label: '1' };
  const size = Math.min(...losses.map((b) => deRoundSize(b.deRound)));
  if (!Number.isFinite(size)) return { rank: 9999, label: 'DE' };
  if (size === 2) return { rank: 2, label: '2' };          // lost the final
  if (size === 4) return { rank: 3, label: '3rd tied' };   // two bronzes, no 4th
  const low = size / 2 + 1;
  return { rank: low, label: `${low}–${size}` };           // 5–8, 9–16, 17–32, …
}

// Difficulty tier of a matchup from a fencer's point of view, keyed on their
// pre-bout win probability (high prob = easy opponent). Colours run blue →
// green → grey → orange → red. The model that drives these is calibrated —
// across the dataset, predicted favourites win at close to the predicted rate.
export function difficultyTier(pWin) {
  if (pWin >= 0.8) return { key: 'easy', label: 'Easy', color: '#2F6FB3' };
  if (pWin >= 0.6) return { key: 'favoured', label: 'Favoured', color: '#3F9D5A' };
  if (pWin >= 0.4) return { key: 'even', label: 'Even', color: '#8A909A' };
  if (pWin >= 0.2) return { key: 'hard', label: 'Hard', color: '#D98324' };
  return { key: 'veryhard', label: 'Very hard', color: '#C0453B' };
}

// Field-overview breakdown for one fencer at one competition: each pool/DE bout
// tagged with its difficulty (pre-bout win probability) and outcome, plus the
// expected pool victories (sum of win probabilities), actual, and the diff.
// `myBouts` is that fencer's bouts at the competition; withdrawals are skipped.
export function fieldOverview(myBouts, key, fencers) {
  const make = (b) => {
    const meA = b.keyA === key;
    const pWin = winProbability(
      meA ? b.ratingABefore : b.ratingBBefore,
      meA ? b.rdABefore : b.rdBBefore,
      meA ? b.ratingBBefore : b.ratingABefore,
      meA ? b.rdBBefore : b.rdABefore,
    );
    const oppKey = meA ? b.keyB : b.keyA;
    return {
      id: b.id, oppKey, oppName: fencers?.[oppKey]?.name || oppKey,
      type: b.type, deRound: b.deRound,
      won: b.winnerKey === key,
      scoreFor: meA ? b.scoreA : b.scoreB,
      scoreAgainst: meA ? b.scoreB : b.scoreA,
      pWin, tier: difficultyTier(pWin),
    };
  };
  const live = myBouts.filter((b) => !b.withdrawal);
  const pool = live.filter((b) => b.type !== 'de').map(make).sort((a, b) => b.pWin - a.pWin);
  const de = live.filter((b) => b.type === 'de').map(make).sort((a, b) => b.pWin - a.pWin);
  const exp = pool.reduce((s, x) => s + x.pWin, 0);
  const act = pool.filter((x) => x.won).length;
  return { pool, de, exp, act, diff: act - exp };
}

// Backtest the win-probability model against every rated result. Each bout's
// prediction uses the ratings as they stood BEFORE that competition (the
// `*Before` fields), so it's out-of-sample at the event level — the model is
// never scored on a result it has already seen. Withdrawals (no result) and
// ties (no favourite to be right or wrong about) are skipped. Options: `stream`
// ('pool' | 'de' | null for both); `establishedOnly` to keep only bouts where
// both fencers were already off their provisional RD (i.e. had history);
// `initialRD`, the RD that still counts as "no history" (caller passes the
// active setting; 200 is only a fallback). Returns the headline numbers and a
// calibration table — predicted favourite-win rate vs the observed rate.
export function predictiveAccuracy(bouts, options = {}) {
  const { stream = null, establishedOnly = false, initialRD = 200 } = options;
  // Bins on the favourite's predicted probability. They span 50–100% because we
  // orient every bout to its predicted favourite (a 30% call for A is a 70% call
  // for B); a calibrated model tracks the diagonal — predicted ≈ observed.
  const edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];
  const bins = edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1], n: 0, favWins: 0, predicted: 0 }));
  const eps = 1e-15;
  let n = 0, correct = 0, brier = 0, logLoss = 0;
  for (const b of bouts) {
    if (b.withdrawal || !b.winnerKey) continue;
    if (stream && b.type !== stream) continue;
    if (establishedOnly && (b.rdABefore >= initialRD || b.rdBBefore >= initialRD)) continue;
    const pA = winProbability(b.ratingABefore, b.rdABefore, b.ratingBBefore, b.rdBBefore);
    const outcomeA = b.winnerKey === b.keyA ? 1 : 0;
    brier += (pA - outcomeA) ** 2;
    const pClamped = Math.min(1 - eps, Math.max(eps, pA));
    logLoss += -(outcomeA * Math.log(pClamped) + (1 - outcomeA) * Math.log(1 - pClamped));
    const pFav = pA >= 0.5 ? pA : 1 - pA;
    const favKey = pA >= 0.5 ? b.keyA : b.keyB;
    const favWon = b.winnerKey === favKey;
    if (favWon) correct++;
    for (const bin of bins) {
      if (pFav >= bin.lo && pFav < bin.hi) { bin.n++; bin.predicted += pFav; if (favWon) bin.favWins++; break; }
    }
    n++;
  }
  return {
    n,
    accuracy: n ? correct / n : null,
    brier: n ? brier / n : null,
    logLoss: n ? logLoss / n : null,
    baselineBrier: 0.25,        // always predicting 50/50
    baselineLogLoss: Math.LN2,  // −ln(0.5), the log-loss of a coin flip
    buckets: bins.map((bin) => ({
      lo: bin.lo, hi: Math.min(bin.hi, 1), n: bin.n,
      predicted: bin.n ? bin.predicted / bin.n : null,
      observed: bin.n ? bin.favWins / bin.n : null,
    })),
  };
}

// Reconstruct a single-elimination bracket from its DE bouts. The FeNZ data
// gives each bout a round label (T32/QF/SF/Final → a bracket size via
// deRoundSize) and a winner, but no seed or line number, so we recover the tree
// by chaining winners: the winner of a size-S bout reappears in the size-(S/2)
// bout one round on, which makes the earlier bout a feeder of the later one.
// Absolute seeding can't be recovered, only who-fed-whom. Each match carries a
// column (round) and a row (vertical slot — its feeder pair's midpoint) so a
// caller can lay it out with connectors, the feeder ids, and the winner's
// pre-bout win probability so the path leaving the match can be coloured by how
// hard that win was. Returns { rounds, champion, cols, rows }, rounds
// earliest-first, or null if there are no usable DE bouts.
export function buildTableau(deBouts, fencers) {
  const live = (deBouts || []).filter((b) => b.type === 'de' && Number.isFinite(deRoundSize(b.deRound)));
  if (live.length === 0) return null;

  const byKey = {}; // size → { fencerKey: the bout they played at that size }
  const sizes = new Set();
  for (const b of live) {
    const size = deRoundSize(b.deRound);
    sizes.add(size);
    (byKey[size] ||= {});
    byKey[size][b.keyA] = b;
    byKey[size][b.keyB] = b;
  }
  const roundSizes = [...sizes].sort((a, b) => b - a); // 16, 8, 4, 2 … earliest → final
  const colOf = (size) => roundSizes.indexOf(size);
  const rootSize = roundSizes[roundSizes.length - 1]; // smallest table = the final
  const rootBouts = live.filter((b) => deRoundSize(b.deRound) === rootSize);

  const name = (k) => fencers?.[k]?.name || k;
  const side = (b, key) => ({
    key, name: name(key),
    score: b.keyA === key ? b.scoreA : b.scoreB,
    won: b.winnerKey === key,
  });
  // Winner's pre-bout win probability — how hard that win was, for path colour.
  const winnerPWin = (b) => {
    if (!b.winnerKey) return null;
    const winA = b.winnerKey === b.keyA;
    return winProbability(
      winA ? b.ratingABefore : b.ratingBBefore,
      winA ? b.rdABefore : b.rdBBefore,
      winA ? b.ratingBBefore : b.ratingABefore,
      winA ? b.rdBBefore : b.rdABefore,
    );
  };

  const nodes = new Map();
  for (const b of live) {
    const size = deRoundSize(b.deRound);
    const childRound = byKey[size * 2] || {};
    nodes.set(b.id, {
      id: b.id, deRound: b.deRound, winnerKey: b.winnerKey, withdrawal: b.withdrawal,
      top: side(b, b.keyA), bottom: side(b, b.keyB), winnerPWin: winnerPWin(b),
      col: colOf(size),
      topChildId: childRound[b.keyA] ? childRound[b.keyA].id : null,
      bottomChildId: childRound[b.keyB] ? childRound[b.keyB].id : null,
      row: 0,
    });
  }

  // Vertical layout: an entry match (no feeders) takes the next free row; any
  // later match sits at the mean of its feeders' rows, so it centres on the pair
  // that led into it. Top feeder before bottom keeps the bracket the right way up.
  let leaf = 0;
  const placed = new Set();
  const assignRow = (id) => {
    const m = nodes.get(id);
    if (!m || placed.has(id)) return m ? m.row : 0;
    placed.add(id);
    const kids = [m.topChildId, m.bottomChildId].filter((c) => c != null && nodes.has(c));
    if (kids.length === 0) { m.row = leaf++; return m.row; }
    const rows = kids.map(assignRow);
    m.row = rows.reduce((s, r) => s + r, 0) / rows.length;
    return m.row;
  };
  for (const rb of rootBouts) assignRow(rb.id);
  for (const b of live) if (!placed.has(b.id)) assignRow(b.id); // unreachable (malformed) bouts

  let maxRow = 0;
  for (const m of nodes.values()) if (m.row > maxRow) maxRow = m.row;

  const labelFor = (size) =>
    size === 2 ? 'Final' : size === 4 ? 'Semis' : size === 8 ? 'Quarters' : `Table of ${size}`;
  const rounds = roundSizes.map((size) => ({
    size, label: labelFor(size),
    matches: live.filter((b) => deRoundSize(b.deRound) === size).map((b) => nodes.get(b.id)).sort((a, b) => a.row - b.row),
  }));

  const finalBout = rootBouts.length === 1 ? rootBouts[0] : null;
  const champion = finalBout && finalBout.winnerKey
    ? { key: finalBout.winnerKey, name: name(finalBout.winnerKey), pWin: winnerPWin(finalBout) }
    : null;
  return { rounds, champion, cols: roundSizes.length, rows: maxRow + 1 };
}

// Difficulty of one fencer's run through the bracket, their "line". Takes the
// WHOLE field's DE bouts for the competition (not just this fencer's), because
// both reads now span their entire path to the title — every opponent
// they would have had to beat to win the event, counting the rounds past where
// they actually went out, not only the bouts they fenced.
//
// Two reads that answer different questions:
//   • avgOpp / peakOpp — the mean and peak opponent rating over the FULL title
//     path: their real opponents up to elimination, then the actual occupant of
//     each later-round slot they would have met had they kept winning. This is
//     the toughness-of-draw figure the Toughest lines table ranks on. A champion
//     or finalist already played their whole line, so for them the full path is
//     just their real run and these numbers are unchanged.
//   • runProbability — sweep odds, the product of their per-bout win probability
//     across that SAME full path, so it is the chance they would have run the
//     whole table from their entry and won the title. A fencer who lost still
//     gets one: the bout they lost, and every round beyond it, counts as a win
//     they'd have needed. The real bouts are priced from their actual pre-bout
//     ratings; the would-be later rounds have no rating recorded for this fencer
//     (they were already out), so those are priced from the rating they carried
//     into their last actual bout — their strength at the round they went out,
//     held fixed for the rounds past it. That carry-forward is an approximation
//     (it neither banks the wins they'd have gained nor re-rates anyone),
//     surfaced here rather than buried.
//
// The full path is traced by chaining winners forward: from the fencer's entry
// bout, the winner of each bout reappears in the next round, a table half the
// size (FeNZ brackets halve cleanly — the same powers-of-two assumption
// buildTableau leans on), and the opponent at each step is whoever else is in
// that bout. Tracing follows the actual winner's slot, so once the fencer is
// knocked out we ride their conqueror's results down to the final — the people
// they would have met next. Each opponent's rating is their pre-bout rating in
// the bout where they held that slot. The walk stops at the final, or wherever
// the data runs out (an incomplete bracket truncates the path, it doesn't
// guess). Returns null for a pool-only fencer.
export function lineDifficulty(deBouts, key, fencers) {
  const live = (deBouts || []).filter((b) => b.type === 'de' && Number.isFinite(deRoundSize(b.deRound)));
  const mine = live.filter((b) => (b.keyA === key || b.keyB === key) && !b.withdrawal);
  if (mine.length === 0) return null;

  // The real run, biggest table first: each bout the fencer actually fenced,
  // with their pre-bout win probability and outcome. This records what happened;
  // the sweep odds below are taken over the full path, not just these bouts.
  const ordered = [...mine].sort((a, b) => deRoundSize(b.deRound) - deRoundSize(a.deRound));
  const steps = ordered.map((b) => {
    const isA = b.keyA === key;
    const pWin = winProbability(
      isA ? b.ratingABefore : b.ratingBBefore,
      isA ? b.rdABefore : b.rdBBefore,
      isA ? b.ratingBBefore : b.ratingABefore,
      isA ? b.rdBBefore : b.rdABefore,
    );
    const oppKey = isA ? b.keyB : b.keyA;
    return {
      id: b.id, deRound: b.deRound, oppKey, oppName: fencers?.[oppKey]?.name || oppKey,
      oppRating: isA ? b.ratingBBefore : b.ratingABefore, pWin, won: b.winnerKey === key,
    };
  });

  // size → { fencerKey: the bout they held at that size }. Built from the whole
  // field so the walk can follow the bracket past this fencer's elimination.
  const bySize = {};
  for (const b of live) {
    const size = deRoundSize(b.deRound);
    (bySize[size] ||= {})[b.keyA] = b;
    bySize[size][b.keyB] = b;
  }

  // Walk from the fencer's entry (their biggest table) down to the final. At
  // each bout the opponent is the other side; the actual winner determines which
  // bout we step into next, so after the fencer loses we trail their conqueror —
  // the line they would have walked had they kept winning. Each step's win
  // probability is priced from the fencer's own pre-bout rating while they are
  // still in the bracket, then from the rating they carried into their last
  // actual bout for the rounds past their exit (see the header note on this).
  const entry = mine.reduce((a, b) => (deRoundSize(b.deRound) > deRoundSize(a.deRound) ? b : a));
  const path = [];
  let prob = 1;
  let carried = null;      // fencer's rating+RD at their last actual bout, frozen past their exit
  let cur = entry;
  let holder = key;        // who occupies our line's slot in `cur` (us, until knocked out)
  const seen = new Set();  // guard against malformed data looping the walk
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const fenced = holder === key; // false once we're tracing the rounds they never reached
    const oppKey = cur.keyA === holder ? cur.keyB : cur.keyA;
    const oppRating = cur.keyA === oppKey ? cur.ratingABefore : cur.ratingBBefore;
    const oppRd = cur.keyA === oppKey ? cur.rdABefore : cur.rdBBefore;
    if (fenced) {
      // The fencer is in this bout, so price it from the rating they carried in;
      // keep the latest, so once they are out it holds their deepest-round strength.
      const isA = cur.keyA === key;
      carried = { rating: isA ? cur.ratingABefore : cur.ratingBBefore, rd: isA ? cur.rdABefore : cur.rdBBefore };
    }
    const pWin = winProbability(carried.rating, carried.rd, oppRating, oppRd);
    prob *= pWin;
    path.push({
      deRound: cur.deRound, size: deRoundSize(cur.deRound),
      oppKey, oppName: fencers?.[oppKey]?.name || oppKey, oppRating, pWin, fenced,
    });
    if (!cur.winnerKey) break; // an unresolved bout ends the line here
    const next = bySize[deRoundSize(cur.deRound) / 2]?.[cur.winnerKey];
    if (!next) break;          // reached the final, or the bracket data stops
    holder = cur.winnerKey;
    cur = next;
  }

  const sum = path.reduce((s, p) => s + p.oppRating, 0);
  const peak = path.reduce((m, p) => Math.max(m, p.oppRating), -Infinity);
  return {
    steps,
    path,                       // the full title path, real opponents then would-be ones
    runProbability: prob,       // sweep odds across the whole path — odds of taking the title from here
    avgOpp: sum / path.length,  // mean opponent rating across the whole title path (the "line average")
    peakOpp: peak,              // the hardest single opponent on that path
  };
}

// Best and worst matchups for a fencer in one weapon. For every opponent met at
// least `minMeetings` times, compare how often they actually won to how often
// the model expected them to (mean pre-bout win probability over the meetings).
// A large positive gap is a best matchup — won more than the ratings predict; a
// large negative gap is a worst matchup, the bogey-opponent / bad-style case a
// single rating can't see. Withdrawals and ties are skipped.
export function matchups(fencerKey, weapon, bouts, fencers, options = {}) {
  // Three meetings is the floor for treating a gap as signal rather than one
  // lucky night; unvalidated, and tunable.
  const { minMeetings = 3 } = options;
  const byOpp = {};
  for (const b of bouts) {
    if (b.weapon !== weapon || b.withdrawal || !b.winnerKey) continue;
    if (b.keyA !== fencerKey && b.keyB !== fencerKey) continue;
    const isA = b.keyA === fencerKey;
    const oppKey = isA ? b.keyB : b.keyA;
    const pWin = winProbability(
      isA ? b.ratingABefore : b.ratingBBefore,
      isA ? b.rdABefore : b.rdBBefore,
      isA ? b.ratingBBefore : b.ratingABefore,
      isA ? b.rdBBefore : b.rdABefore,
    );
    const o = (byOpp[oppKey] ||= { oppKey, meetings: 0, wins: 0, expected: 0 });
    o.meetings += 1;
    o.expected += pWin;
    if (b.winnerKey === fencerKey) o.wins += 1;
  }
  const all = Object.values(byOpp)
    .filter((o) => o.meetings >= minMeetings)
    .map((o) => ({
      oppKey: o.oppKey, oppName: fencers?.[o.oppKey]?.name || o.oppKey,
      meetings: o.meetings, wins: o.wins, losses: o.meetings - o.wins,
      winRate: o.wins / o.meetings,
      expectedRate: o.expected / o.meetings,
      edge: o.wins / o.meetings - o.expected / o.meetings, // actual − expected
    }))
    .sort((a, b) => a.edge - b.edge);
  return {
    worst: all.filter((o) => o.edge < 0).slice(0, 3),         // most under-performed first
    best: all.filter((o) => o.edge > 0).slice(-3).reverse(),  // most over-performed first
    all,
  };
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

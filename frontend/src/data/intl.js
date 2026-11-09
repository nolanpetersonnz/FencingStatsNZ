// International results: the prototype of PANELS.md section 2.
//
// A fencer's result at an event outside NZ, entered by a FeNZ admin from the
// official results page, checked by a reviewer, then scored against FeNZ's
// approved event list and points table. Pure functions, so the admin panel,
// the profile and the tests share one copy, and a server queue can reuse them
// later (the dispute-style queue in PANELS.md 2.3).
//
// PROTOTYPE. The points table and the event list are placeholders. FeNZ sets
// the real ones (PANELS.md 2.1), and nothing here is FeNZ policy.

import { safeHttpUrl } from '../utils/url.js';

export const WEAPONS = ['foil', 'epee', 'sabre'];
export const GENDERS = ['mens', 'womens'];
export const CATEGORIES = ['u17', 'u20', 'senior', 'veteran'];
export const LEVELS = ['national_championship', 'national_circuit', 'fie', 'regional', 'other'];
export const RESIDENCES = ['overseas', 'nz'];

export const LEVEL_LABELS = {
  national_championship: 'National championship',
  national_circuit: 'National circuit',
  fie: 'FIE event',
  regional: 'Regional',
  other: 'Other',
};
export const CATEGORY_LABELS = { u17: 'Cadet (U17)', u20: 'Junior (U20)', senior: 'Senior', veteran: 'Veteran' };

// Placeholder points table and event list. The shape is what the build needs;
// every number and entry is a stand-in until FeNZ decides (PANELS.md 2.1).
export const PLACEHOLDER_POLICY = {
  version: 1,
  // Most points a result can earn, by the level of the list entry it matches.
  max_points: { national_championship: 100, national_circuit: 60 },
  // Share of the most points, by place: the first band whose place covers the
  // result. Past the last band a counted result scores 0.
  placing_shares: [[1, 1], [2, 0.8], [3, 0.65], [8, 0.5], [16, 0.35], [32, 0.2], [64, 0.1]],
  min_field: 32,
  window_months: 12,
  list: [
    { id: 'gbr-champs', country: 'GBR', event: 'National Championships', level: 'national_championship' },
    { id: 'fra-champs', country: 'FRA', event: 'National Championships', level: 'national_championship' },
    { id: 'fra-circuit', country: 'FRA', event: 'National circuit', level: 'national_circuit' },
    { id: 'usa-circuit', country: 'USA', event: 'National circuit', level: 'national_circuit' },
  ],
};

export function initialLog(now) {
  return [{
    version: 1, at: now, author: 'Prototype',
    clause: 'Placeholder values, not FeNZ policy (PANELS.md 2.1)',
    change: 'Starting points table and event list',
  }];
}

// ---- Dates -------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validIsoDate(s) {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// "2026-08-31" plus 6 months is "2027-02-28": the day is clamped to the month.
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// "5th of 40", or "157th" alone where the field size isn't published (the
// FeNZ results portal lists only the podium and the NZ fencers).
export function placingText(rec) {
  return rec.field_size ? `${ordinal(rec.placing)} of ${rec.field_size}` : ordinal(rec.placing);
}

// The category as the event ran it: the site's label, or the portal's own
// words for one the site has no category for (an U15 event, say).
export function categoryText(rec) {
  return CATEGORY_LABELS[rec.category] || rec.age_label || '';
}

// ---- A submitted result (PANELS.md 2.3) --------------------------------------

const text = (v, max) => {
  const s = String(v ?? '').trim();
  return s.length > max ? null : s;
};
const whole = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) ? n : null;
};

// Checks an admin's entry and returns the cleaned fields, or the first error.
// `today` (YYYY-MM-DD) rules out dates in the future.
export function validateResult(input, { today }) {
  const v = {};
  v.fencer = text(input.fencer, 120);
  if (!v.fencer) return { error: 'pick the fencer' };
  v.fencer_name = text(input.fencer_name, 120) || v.fencer;
  if (!WEAPONS.includes(input.weapon)) return { error: 'pick the weapon' };
  if (!GENDERS.includes(input.gender)) return { error: 'pick the gender the event ran as' };
  if (!CATEGORIES.includes(input.category)) return { error: 'pick the age category the event ran as' };
  v.weapon = input.weapon;
  v.gender = input.gender;
  v.category = input.category;
  v.event = text(input.event, 200);
  if (!v.event) return { error: 'event name: 1 to 200 characters' };
  v.organiser = text(input.organiser, 120);
  if (v.organiser === null) return { error: 'organiser: up to 120 characters' };
  v.country = String(input.country ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(v.country)) return { error: 'country: a three-letter code, such as GBR' };
  if (v.country === 'NZL') return { error: 'an NZ event is not an international result' };
  v.city = text(input.city, 80);
  if (v.city === null) return { error: 'city: up to 80 characters' };
  if (!LEVELS.includes(input.level)) return { error: 'pick the level of the event' };
  v.level = input.level;
  v.date = String(input.date ?? '').trim();
  if (!validIsoDate(v.date)) return { error: 'date: YYYY-MM-DD' };
  if (today && v.date > today) return { error: 'the date is in the future' };
  v.results_url = safeHttpUrl(String(input.results_url ?? ''));
  if (!v.results_url) return { error: 'an official results link (http or https) is required' };
  v.placing = whole(input.placing);
  v.field_size = whole(input.field_size);
  if (!v.placing || v.placing < 1) return { error: 'placing: a whole number, 1 or more' };
  if (!v.field_size || v.field_size < 2) return { error: 'field size: a whole number, 2 or more' };
  if (v.placing > v.field_size) return { error: 'the placing is past the field size' };
  if (v.level === 'fie') {
    if (typeof input.made_de !== 'boolean') return { error: 'FIE event: say whether the fencer reached the DE' };
    v.made_de = input.made_de;
  } else {
    v.made_de = null;
  }
  if (!RESIDENCES.includes(input.residence)) return { error: 'pick where the fencer lived at the time' };
  v.residence = input.residence;
  return { value: v };
}

export function newRecord(value, { id, now }) {
  return {
    id, ...value, status: 'pending', created_at: now,
    list_entry: null, reviewer: null, reviewed_at: null, review_note: null,
    counts: null, points: null, reason: null, policy_version: null, expires_on: null,
  };
}

// ---- Scoring, fixed at approval (PANELS.md 2.3: points come from the table
// in force when the result is approved) ---------------------------------------

export function placingShare(placing, shares) {
  for (const [upto, share] of shares) if (placing <= upto) return share;
  return 0;
}

// FeNZ's ranking portal already counts FIE results and its listed Australian
// competitions (PANELS.md section 0), so this panel scores neither: they are
// stored for the cl. 5.1 check and exemption evidence only.
export function scoreResult(rec, policy) {
  const fixed = {
    policy_version: policy.version,
    expires_on: addMonths(rec.date, policy.window_months),
    window_months: policy.window_months,
    min_field: policy.min_field,
  };
  const no = (reason) => ({ ...fixed, counts: false, points: 0, reason });
  if (rec.level === 'fie' || rec.country === 'AUS') return no('fenz_portal');
  const entry = policy.list.find((e) => e.id === rec.list_entry);
  if (!entry || !policy.max_points[entry.level]) return no('not_on_list');
  if (rec.field_size < policy.min_field) return no('small_field');
  const points = Math.round(policy.max_points[entry.level] * placingShare(rec.placing, policy.placing_shares));
  return { ...fixed, counts: true, points, reason: null };
}

const CLEARED = {
  counts: null, points: null, reason: null, policy_version: null,
  expires_on: null, window_months: null, min_field: null,
};

// approve | reject | withdraw | reopen. Returns { value } or { error }.
export function reviewResult(rec, action, { reviewer, note, listEntry, policy, now }) {
  const who = String(reviewer ?? '').trim();
  const why = String(note ?? '').trim().slice(0, 500) || null;
  const stamp = { reviewer: who, reviewed_at: now, review_note: why };
  if (action === 'approve' || action === 'reject') {
    if (rec.status !== 'pending') return { error: `only a pending result can be reviewed (this one is ${rec.status})` };
    if (!who) return { error: 'reviewer name required' };
  }
  if (action === 'approve') {
    const entry = listEntry ? policy.list.find((e) => e.id === listEntry) : null;
    if (listEntry && !entry) return { error: 'that list entry no longer exists' };
    if (entry && entry.country !== rec.country) return { error: 'that list entry is for another country' };
    const scored = scoreResult({ ...rec, list_entry: entry ? entry.id : null }, policy);
    return { value: { ...rec, ...stamp, status: 'approved', list_entry: entry ? entry.id : null, ...scored } };
  }
  if (action === 'reject') {
    if (!why) return { error: 'say why it is rejected' };
    return { value: { ...rec, ...stamp, status: 'rejected', ...CLEARED } };
  }
  if (action === 'withdraw') {
    if (rec.status !== 'pending' && rec.status !== 'approved') return { error: `a ${rec.status} result can't be withdrawn` };
    if (!who) return { error: 'name required' };
    return { value: { ...rec, ...stamp, status: 'withdrawn', ...CLEARED } };
  }
  if (action === 'reopen') {
    if (rec.status !== 'approved' && rec.status !== 'rejected') return { error: `a ${rec.status} result can't be reopened` };
    return { value: { ...rec, status: 'pending', list_entry: null, reviewer: null, reviewed_at: null, review_note: null, ...CLEARED } };
  }
  return { error: 'unknown action' };
}

export function isExpired(rec, today) {
  return Boolean(rec.expires_on) && today > rec.expires_on;
}

// What the profile shows for a result, or null to leave it off: only approved
// results this panel scores (not FIE or Australian ones, which FeNZ's own
// ranking handles).
export function publicStatus(rec, today) {
  if (rec.status !== 'approved' || rec.reason === 'fenz_portal') return null;
  if (rec.counts && !isExpired(rec, today)) return { counts: true, points: rec.points };
  return { counts: false, reason: rec.counts ? 'expired' : rec.reason };
}

// Visitor-facing wording, picked by Nolan on 9 Nov 2026 ("International results").
export const INTL_HEADING = 'International results';
export const INTL_NOTE = 'Placings at events overseas, checked by FeNZ against the official results.';
// The International tab's heading line, picked by Nolan on 9 Nov 2026.
export const INTL_PAGE_NOTE = 'Results at events overseas, checked by FeNZ against the official results, and whether each counts toward the FeNZ ranking.';
// The International tab's line on where its results come from, picked by
// Nolan on 9 Nov 2026. Without the portal file, the prototype line as before.
export const INTL_SOURCE_NOTE = 'FIE and Australian results pulled from FeNZ. Other events are a prototype.';
export const INTL_PROTOTYPE_NOTE = 'Prototype: placeholder points and event list; results stay in this browser.';
export function statusText(status, rec) {
  if (status.counts) return `Counts toward the FeNZ ranking: ${status.points} pts`;
  if (status.reason === 'small_field') return `Not counted: fewer than ${rec.min_field} fencers`;
  if (status.reason === 'expired') return `Not counted: older than ${rec.window_months} months`;
  return "Not counted: event not on FeNZ's list";
}

// A profile's international results for one weapon: the International
// tab's list for that fencer (approved results, FeNZ portal ones included),
// each with the same two answers.
export function profileResults(records, fencer, weapon, today) {
  return fencerResults(records, fencer, today).results.filter(({ rec }) => rec.weapon === weapon);
}

// FeNZ's ranking "recognises listed Australian Competitions, and all FIE
// results" (its ranking portal, The Ranking System, read 9 Nov 2026); the
// listed Australian ones are AFC #1 to #4, the Australian Championships and
// the Australian U20, U17 and U15 Championships. A portal result carries the
// answer from the ingest (fenz_ranking, ingest/portal_intl.py). For one
// entered here: FIE yes; Australian yes for a national championship or
// national circuit event (the Australian Championships, the AFC), else no.
export function inFenzRanking(rec) {
  if (typeof rec.fenz_ranking === 'boolean') return rec.fenz_ranking;
  if (rec.level === 'fie') return true;
  return rec.country === 'AUS' && (rec.level === 'national_championship' || rec.level === 'national_circuit');
}

// The International tab answers two things for each of a fencer's approved
// results: is it an event FeNZ counts, and how many points it earns, or, for
// a result FeNZ's own ranking handles, whether that ranking recognises it.
//   fenz: true for an event on FeNZ's list or an FIE event (FeNZ's own
//         ranking counts every FIE result); null for an Australian one, as
//         FeNZ's ranking counts only the competitions it lists (PANELS.md 0)
//   why:  'listed' | 'fie' | 'australian' | 'not_listed'
//   points: the points, or null where FeNZ's own ranking sets them
//   ranked: where points is null, whether FeNZ's ranking recognises it
//   note: null | 'small_field' | 'expired', when a listed event earns 0
export function eventVerdict(rec, today) {
  if (rec.reason === 'fenz_portal') {
    const ranked = inFenzRanking(rec);
    return rec.level === 'fie'
      ? { fenz: true, why: 'fie', points: null, ranked, note: null }
      : { fenz: null, why: 'australian', points: null, ranked, note: null };
  }
  if (rec.reason === 'not_on_list') return { fenz: false, why: 'not_listed', points: 0, note: null };
  if (rec.reason === 'small_field') return { fenz: true, why: 'listed', points: 0, note: 'small_field' };
  if (isExpired(rec, today)) return { fenz: true, why: 'listed', points: 0, note: 'expired' };
  return { fenz: true, why: 'listed', points: rec.points, note: null };
}

// One fencer's approved results, newest first, each with its verdict, and
// how many more are waiting to be checked.
export function fencerResults(records, fencer, today) {
  const mine = (records || []).filter((r) => r.fencer === fencer);
  return {
    results: mine.filter((r) => r.status === 'approved')
      .sort((a, b) => b.date.localeCompare(a.date) || a.event.localeCompare(b.event) || a.placing - b.placing)
      .map((rec) => ({ rec, verdict: eventVerdict(rec, today) })),
    waiting: mine.filter((r) => r.status === 'pending').length,
  };
}

// ---- Results from FeNZ's results portal ----------------------------------------
// ingest/portal_intl.py writes NZ fencers' placings at the portal's
// International competitions (FIE and Australian events) to
// data/intl_results.json. They are FeNZ's own records: shown as they are,
// never reviewed or scored here, and kept out of the cl. 5.1 check (the
// portal gives no field size, and a selection check on real fencers is
// FeNZ's to run, PANELS.md 2.6).

// Keeps the rows the pages can show, each as an approved FeNZ portal result
// whatever the file says, so no row can pose as one this panel scored.
export function shippedResults(json) {
  const rows = Array.isArray(json?.results) ? json.results : [];
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (!r || typeof r.fencer !== 'string' || !r.fencer.trim()) continue;
    const placing = whole(r.placing);
    if (!WEAPONS.includes(r.weapon) || !validIsoDate(String(r.date ?? '')) || !placing || placing < 1) continue;
    const id = String(r.id || `${r.fencer}|${r.date}|${r.event}|${r.event_label}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const fieldSize = whole(r.field_size);
    out.push({
      id,
      fencer: r.fencer,
      fencer_name: String(r.fencer_name || r.fencer),
      weapon: r.weapon,
      gender: r.gender,
      category: CATEGORIES.includes(r.category) ? r.category : null,
      age_label: String(r.age_label ?? ''),
      event: String(r.event || 'International event'),
      event_label: String(r.event_label ?? ''),
      place: String(r.place ?? ''),
      country: /^[A-Z]{3}$/.test(r.country || '') ? r.country : null,
      level: LEVELS.includes(r.level) ? r.level : 'other',
      date: r.date,
      results_url: safeHttpUrl(String(r.results_url ?? '')) || null,
      placing,
      field_size: fieldSize && fieldSize >= placing ? fieldSize : null,
      made_de: null,
      status: 'approved',
      reason: 'fenz_portal',
      source: 'fenz_portal',
      fenz_ranking: typeof r.fenz_ranking === 'boolean' ? r.fenz_ranking : null,
      counts: null,
      points: null,
    });
  }
  return out;
}

// Admin merges (overrides.merges) fold one site name into another; a portal
// result follows its fencer the same way.
export function applyMerges(records, merges) {
  if (!merges || !Object.keys(merges).length) return records;
  return records.map((r) => {
    const to = merges[r.fencer]?.merge_into;
    return to ? { ...r, fencer: to, fencer_name: merges[r.fencer].merge_into_name || r.fencer_name } : r;
  });
}

// The two answers in words (visitor-facing; wording picked by Nolan, 9 Nov 2026).
// The second answer is "Ranking: Yes" or "No" where FeNZ's own ranking
// handles the result (Nolan, 9 Nov 2026), else the points this panel gives.
export function verdictText(v, rec) {
  const event = v.why === 'listed' ? "Yes, on FeNZ's list"
    : v.why === 'fie' ? "Yes, FIE: in FeNZ's ranking"
    : v.why === 'australian' ? "Australian: FeNZ's ranking decides"
    : "No, not on FeNZ's list";
  if (v.points === null) return { event, ranking: v.ranked ? 'Yes' : 'No' };
  const points = v.note === 'small_field' ? `0 (fewer than ${rec.min_field} fencers)`
    : v.note === 'expired' ? `0 (older than ${rec.window_months} months)`
    : String(v.points);
  return { event, points };
}


// Admin-side label for any status, including the ones the profile leaves off.
export function adminStatusText(rec, today) {
  if (rec.status !== 'approved') return rec.status;
  if (rec.reason === 'fenz_portal') return "FIE or Australian: FeNZ's own ranking handles it";
  return statusText(publicStatus(rec, today), rec);
}

// ---- One event, several fencers (admin) ------------------------------------------
// When several NZ fencers went to the same event, FeNZ enters the event once
// and adds each fencer's placing: one pending result per fencer, sharing an
// event_id, so the queue can show them together and approve them at once.

const ROW_STUB = { fencer: 'stub', placing: 1, made_de: false, residence: 'overseas' };

// event: the shared fields (as validateResult takes them, field size
// included); rows: [{ fencer, fencer_name, placing, made_de, residence }].
// Rows left blank are skipped. Returns { value: [cleaned result, ...] } or
// { error }: the event's own errors first, then each fencer's, by name.
export function validateEventEntry(event, rows, { today }) {
  const shared = validateResult({ ...event, ...ROW_STUB }, { today });
  if (shared.error) return { error: shared.error };
  const filled = (rows || []).filter((r) => String(r.fencer ?? '').trim() || String(r.placing ?? '').trim());
  if (!filled.length) return { error: 'add at least one fencer' };
  const seen = new Set();
  const value = [];
  for (const [i, row] of filled.entries()) {
    const who = row.fencer_name || `fencer ${i + 1}`;
    const out = validateResult({ ...event, ...row }, { today });
    if (out.error) return { error: `${who}: ${out.error}` };
    if (seen.has(out.value.fencer)) return { error: `${who} is listed twice` };
    seen.add(out.value.fencer);
    value.push(out.value);
  }
  return { value };
}

// Approve, reject or withdraw every pending result of one event, with the
// same list entry and note. All or none: the first error changes nothing.
export function reviewEvent(records, eventId, action, opts) {
  let count = 0;
  const next = [];
  for (const r of records || []) {
    if (r.event_id && r.event_id === eventId && r.status === 'pending') {
      const out = reviewResult(r, action, opts);
      if (out.error) return { error: `${r.fencer_name}: ${out.error}` };
      next.push(out.value);
      count += 1;
    } else {
      next.push(r);
    }
  }
  if (!count) return { error: 'nothing waiting for this event' };
  return { value: next, count };
}

// ---- Selection Policy 2026, cl. 5.1 -------------------------------------------
// For Asian, Commonwealth and World Championships, a fencer living in NZ is
// Soft Cap eligible only with one of these from a competition outside NZ in
// the past 24 months, in their age group or above: top 50% at an Australian
// national championship or national circuit event; top 75% at another
// country's; reaching the DE at an FIE event. Approved results only.

export function softCapQualifier(rec) {
  if (rec.status !== 'approved' || rec.country === 'NZL' || rec.source === 'fenz_portal') return null;
  if (rec.level === 'fie') return rec.made_de ? 'fie_de' : null;
  if (rec.level !== 'national_championship' && rec.level !== 'national_circuit') return null;
  const share = rec.placing / rec.field_size;
  if (rec.country === 'AUS') return share <= 0.5 ? 'aus_top_half' : null;
  return share <= 0.75 ? 'top_three_quarters' : null;
}

export const SOFT_CAP_LABELS = {
  aus_top_half: 'cl. 5.1: top 50% at an Australian national event',
  top_three_quarters: "cl. 5.1: top 75% at another country's national event",
  fie_de: 'cl. 5.1: reached the DE at an FIE event',
};

const AGE_RANK = { u17: 0, u20: 1, senior: 2 };

// "In their age group or above". The policy doesn't say how veterans read it;
// here a veteran's own or a senior result counts (an assumption to confirm).
export function coversAgeGroup(resultCategory, fencerCategory) {
  if (fencerCategory === 'veteran') return resultCategory === 'veteran' || resultCategory === 'senior';
  if (resultCategory === 'veteran') return false;
  return AGE_RANK[resultCategory] >= AGE_RANK[fencerCategory];
}

export function meetsSoftCap(records, { fencer, weapon, category, asOf }) {
  const from = addMonths(asOf, -24);
  const by = (records || []).find((r) => r.fencer === fencer && r.weapon === weapon
    && r.date >= from && r.date <= asOf && coversAgeGroup(r.category, category) && softCapQualifier(r));
  return by ? { met: true, by, why: softCapQualifier(by) } : { met: false, by: null, why: null };
}

// ---- Points table and event list changes (PANELS.md 2.4, screen 5) ------------
// Every change makes a new version and a log entry with date, author and the
// policy clause or decision behind it.

export function validatePolicy(p) {
  const nonNeg = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  for (const level of ['national_championship', 'national_circuit']) {
    if (!nonNeg(p.max_points?.[level])) return `most points for ${LEVEL_LABELS[level]}: 0 or more`;
  }
  const bands = p.placing_shares || [];
  if (!bands.length) return 'at least one placing band';
  for (let i = 0; i < bands.length; i++) {
    const [upto, share] = bands[i];
    if (!Number.isInteger(upto) || upto < 1) return 'placing bands: whole places, 1 or more';
    if (!(share >= 0 && share <= 1)) return 'placing bands: shares from 0 to 1';
    if (i > 0 && (upto <= bands[i - 1][0] || share > bands[i - 1][1])) {
      return 'placing bands: places rising, shares not rising';
    }
  }
  if (!Number.isInteger(p.min_field) || p.min_field < 2) return 'minimum field: a whole number, 2 or more';
  if (!Number.isInteger(p.window_months) || p.window_months < 1 || p.window_months > 60) {
    return 'window: 1 to 60 months';
  }
  const ids = new Set();
  for (const e of p.list || []) {
    if (!e.id || ids.has(e.id)) return 'event list: every entry needs its own id';
    ids.add(e.id);
    if (!/^[A-Z]{3}$/.test(e.country || '') || e.country === 'NZL') return 'event list: country as a three-letter code, not NZL';
    if (!String(e.event || '').trim()) return 'event list: every entry needs an event name';
    if (e.level !== 'national_championship' && e.level !== 'national_circuit') {
      return 'event list: level is national championship or national circuit';
    }
  }
  return null;
}

export function changePolicy(policy, log, changes, { author, clause, summary, now }) {
  const who = String(author ?? '').trim();
  const why = String(clause ?? '').trim();
  if (!who) return { error: 'your name is required for the log' };
  if (!why) return { error: 'the policy clause or decision behind the change is required' };
  const next = { ...policy, ...changes, version: policy.version + 1 };
  const bad = validatePolicy(next);
  if (bad) return { error: bad };
  return {
    policy: next,
    log: [{ version: next.version, at: now, author: who, clause: why, change: summary }, ...log],
  };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PLACEHOLDER_POLICY, initialLog, validateResult, newRecord, reviewResult, scoreResult, placingShare,
  publicStatus, statusText, profileResults, adminStatusText, softCapQualifier, coversAgeGroup, meetsSoftCap,
  changePolicy, validatePolicy, addMonths, ordinal, eventVerdict, fencerResults, verdictText,
  placingText, categoryText, shippedResults, applyMerges, validateEventEntry, reviewEvent,
} from '../src/data/intl.js';
import { testIntlState, TEST_FENCERS } from '../src/data/intlTestData.js';
import { makeDemoBouts, nameKey } from '../src/data/pipeline.js';

const TODAY = '2026-11-09';
const NOW = '2026-11-09T09:00:00.000Z';
const P = PLACEHOLDER_POLICY;

const entry = (over = {}) => ({
  fencer: 'hamish carter', fencer_name: 'Hamish Carter', weapon: 'epee', gender: 'mens', category: 'senior',
  event: 'National Championships (test)', organiser: 'Test federation', country: 'gbr', city: 'London',
  level: 'national_championship', date: '2026-06-14', results_url: 'https://example.org/r', placing: '7',
  field_size: '48', residence: 'overseas', ...over,
});
const pending = (over) => newRecord(validateResult(entry(over), { today: TODAY }).value, { id: 'r1', now: NOW });
const approve = (rec, listEntry) => reviewResult(rec, 'approve', { reviewer: 'Rev', listEntry, policy: P, now: NOW });

test('dates: months added with the day clamped, and English ordinals', () => {
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonths('2026-06-14', 12), '2027-06-14');
  assert.equal(addMonths('2026-11-09', -24), '2024-11-09');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
});

test('validateResult cleans an entry and needs the official results link', () => {
  const { value, error } = validateResult(entry(), { today: TODAY });
  assert.equal(error, undefined);
  assert.equal(value.country, 'GBR');
  assert.equal(value.placing, 7);
  assert.equal(value.field_size, 48);
  assert.equal(value.made_de, null);
  const bad = (over) => validateResult(entry(over), { today: TODAY }).error;
  assert.match(bad({ results_url: '' }), /results link/);
  assert.match(bad({ results_url: 'javascript:alert(1)' }), /results link/);
  assert.match(bad({ placing: '50' }), /past the field size/);
  assert.match(bad({ placing: '0' }), /placing/);
  assert.match(bad({ country: 'NZL' }), /NZ event/);
  assert.match(bad({ country: 'UK' }), /three-letter/);
  assert.match(bad({ date: '2026-11-10' }), /future/);
  assert.match(bad({ date: '2026-02-30' }), /YYYY-MM-DD/);
  assert.match(bad({ level: 'fie' }), /reached the DE/);
  assert.equal(validateResult(entry({ level: 'fie', made_de: false }), { today: TODAY }).value.made_de, false);
  assert.match(bad({ residence: '' }), /lived/);
});

test('approval scores from the table in force and records its version', () => {
  const { value } = approve(pending(), 'gbr-champs');
  assert.equal(value.status, 'approved');
  assert.equal(value.reviewer, 'Rev');
  assert.equal(value.counts, true);
  assert.equal(value.points, 50); // 7th: the band up to 8th, half of 100
  assert.equal(value.policy_version, 1);
  assert.equal(value.expires_on, '2027-06-14');
  assert.equal(placingShare(1, P.placing_shares), 1);
  assert.equal(placingShare(65, P.placing_shares), 0);
});

test('a result that is not counted says why', () => {
  assert.equal(approve(pending()).value.reason, 'not_on_list');
  assert.equal(approve(pending({ field_size: '30', placing: '21' }), 'gbr-champs').value.reason, 'small_field');
  assert.equal(approve(pending({ country: 'AUS' })).value.reason, 'fenz_portal');
  assert.equal(approve(pending({ level: 'fie', made_de: true })).value.reason, 'fenz_portal');
  assert.match(approve(pending(), 'fra-champs').error, /another country/);
  assert.match(approve(pending(), 'nope').error, /no longer exists/);
});

test('review states: reject needs a reason; withdraw and reopen', () => {
  const rec = pending();
  assert.match(reviewResult(rec, 'reject', { reviewer: 'Rev', policy: P, now: NOW }).error, /why/);
  assert.match(reviewResult(rec, 'approve', { reviewer: ' ', policy: P, now: NOW }).error, /reviewer/);
  const rejected = reviewResult(rec, 'reject', { reviewer: 'Rev', note: 'Wrong placing', policy: P, now: NOW }).value;
  assert.equal(rejected.status, 'rejected');
  assert.match(approve(rejected).error, /only a pending/);
  const reopened = reviewResult(rejected, 'reopen', { policy: P, now: NOW }).value;
  assert.equal(reopened.status, 'pending');
  assert.equal(reopened.reviewer, null);
  const approved = approve(reopened, 'gbr-champs').value;
  const withdrawn = reviewResult(approved, 'withdraw', { reviewer: 'Rev', policy: P, now: NOW }).value;
  assert.equal(withdrawn.status, 'withdrawn');
  assert.equal(withdrawn.points, null);
  assert.match(reviewResult(withdrawn, 'reopen', { policy: P, now: NOW }).error, /can't be reopened/);
});

test('statusText keeps the admin wording; the profile lists what the International tab does', () => {
  const counted = approve(pending(), 'gbr-champs').value;
  assert.deepEqual(publicStatus(counted, TODAY), { counts: true, points: 50 });
  assert.equal(statusText(publicStatus(counted, TODAY), counted), 'Counts toward the FeNZ ranking: 50 pts');
  const old = approve(pending({ date: '2025-06-14' }), 'gbr-champs').value;
  assert.equal(statusText(publicStatus(old, TODAY), old), 'Not counted: older than 12 months');
  const small = approve(pending({ field_size: '30', placing: '21' }), 'gbr-champs').value;
  assert.equal(statusText(publicStatus(small, TODAY), small), 'Not counted: fewer than 32 fencers');
  const off = approve(pending()).value;
  assert.equal(statusText(publicStatus(off, TODAY), off), "Not counted: event not on FeNZ's list");
  assert.equal(publicStatus(pending(), TODAY), null, 'pending stays off the profile');
  assert.equal(publicStatus(approve(pending({ country: 'AUS' })).value, TODAY), null, 'FeNZ ranks Australian events itself');
  assert.match(adminStatusText(approve(pending({ country: 'AUS' })).value, TODAY), /FeNZ's own ranking/);
  const aus = approve(pending({ country: 'AUS', date: '2026-08-01' })).value;
  const rows = profileResults([counted, old, off, aus, pending()], 'hamish carter', 'epee', TODAY);
  assert.deepEqual(rows.map((x) => x.rec.date), ['2026-08-01', '2026-06-14', '2026-06-14', '2025-06-14']);
  assert.deepEqual(rows[0].verdict, { fenz: null, why: 'australian', points: null, note: null }, 'Australian results show too');
  assert.deepEqual(profileResults([counted], 'hamish carter', 'foil', TODAY), []);
});

test('cl. 5.1: Australian top 50%, elsewhere top 75%, FIE DE, approved and outside NZ only', () => {
  const ok = (over, list) => softCapQualifier(approve(pending(over), list).value);
  assert.equal(ok({ country: 'AUS', placing: '24', field_size: '48' }), 'aus_top_half');
  assert.equal(ok({ country: 'AUS', placing: '25', field_size: '48' }), null);
  assert.equal(ok({ placing: '36', field_size: '48' }), 'top_three_quarters');
  assert.equal(ok({ placing: '37', field_size: '48' }), null);
  assert.equal(ok({ level: 'fie', made_de: true }), 'fie_de');
  assert.equal(ok({ level: 'fie', made_de: false }), null);
  assert.equal(ok({ level: 'regional', placing: '1' }), null);
  assert.equal(softCapQualifier(pending()), null, 'not yet approved');
});

test('cl. 5.1: the past 24 months, in the fencer\'s age group or above', () => {
  assert.equal(coversAgeGroup('senior', 'u20'), true);
  assert.equal(coversAgeGroup('u17', 'u20'), false);
  assert.equal(coversAgeGroup('veteran', 'senior'), false);
  assert.equal(coversAgeGroup('senior', 'veteran'), true);
  const rec = approve(pending({ date: '2024-12-01', category: 'u20' }), 'gbr-champs').value;
  const ask = (over) => meetsSoftCap([rec], { fencer: 'hamish carter', weapon: 'epee', asOf: TODAY, ...over });
  assert.equal(ask({ category: 'u20' }).met, true);
  assert.equal(ask({ category: 'u20' }).why, 'top_three_quarters');
  assert.equal(ask({ category: 'senior' }).met, false, 'a junior result is below a senior event');
  assert.equal(ask({ category: 'u20', asOf: '2027-01-10' }).met, false, 'more than 24 months old');
  assert.equal(ask({ category: 'u20', weapon: 'foil' }).met, false);
});

test('a change to the table or list is a new version with a logged author and clause', () => {
  const log = initialLog(NOW);
  assert.match(changePolicy(P, log, { min_field: 24 }, { author: '', clause: 'x', now: NOW }).error, /name/);
  assert.match(changePolicy(P, log, { min_field: 24 }, { author: 'A', clause: ' ', now: NOW }).error, /clause/);
  const out = changePolicy(P, log, { min_field: 24 }, { author: 'Liam', clause: 'Board decision 1', summary: 'Minimum field 24', now: NOW });
  assert.equal(out.policy.version, 2);
  assert.equal(out.policy.min_field, 24);
  assert.deepEqual(out.log[0], { version: 2, at: NOW, author: 'Liam', clause: 'Board decision 1', change: 'Minimum field 24' });
  assert.equal(out.log.length, 2);
  assert.equal(P.version, 1, 'the old version is left as it was');
  // A result approved under version 1 keeps version 1's points.
  const before = approve(pending(), 'gbr-champs').value;
  assert.equal(scoreResult(before, out.policy).policy_version, 2);
  assert.equal(before.policy_version, 1);
  assert.match(validatePolicy({ ...P, placing_shares: [[1, 1], [8, 0.5], [4, 0.6]] }), /rising/);
  assert.match(validatePolicy({ ...P, list: [...P.list, { id: 'x', country: 'NZL', event: 'Nationals', level: 'national_championship' }] }), /NZL/);
  assert.match(validatePolicy({ ...P, list: [...P.list, P.list[0]] }), /own id/);
  assert.equal(validatePolicy(P), null);
});

test('a fencer\'s results say whether FeNZ counts the event and how many points it earns', () => {
  const st = testIntlState(TODAY);
  const hamish = fencerResults(st.records, 'hamish carter', TODAY);
  assert.deepEqual(hamish.results.map((x) => [x.rec.country, x.verdict]), [
    ['GBR', { fenz: true, why: 'listed', points: 50, note: null }],
    ['FRA', { fenz: true, why: 'listed', points: 0, note: 'small_field' }],
  ], 'newest first');
  assert.equal(hamish.waiting, 1, 'the two-fencer event waiting in the queue');
  const one = (key) => fencerResults(st.records, key, TODAY).results[0];
  assert.deepEqual(one('charlotte reeves').verdict, { fenz: true, why: 'listed', points: 0, note: 'expired' });
  assert.deepEqual(one('aroha williams').verdict, { fenz: false, why: 'not_listed', points: 0, note: null });
  assert.deepEqual(one('sophie marlow').verdict, { fenz: null, why: 'australian', points: null, note: null });
  const tane = fencerResults(st.records, 'tane ngata', TODAY);
  assert.deepEqual([tane.results.length, tane.waiting], [0, 1], 'pending: counted, not shown');
  assert.deepEqual(fencerResults(st.records, "liam o'connell", TODAY).results, [], 'rejected: not shown');
  const fie = approve(pending({ level: 'fie', made_de: true })).value;
  assert.deepEqual(eventVerdict(fie, TODAY), { fenz: true, why: 'fie', points: null, note: null });
  // In words.
  const words = (key) => verdictText(one(key).verdict, one(key).rec);
  assert.deepEqual(verdictText(hamish.results[0].verdict, hamish.results[0].rec), { event: "Yes, on FeNZ's list", points: '50' });
  assert.deepEqual(verdictText(hamish.results[1].verdict, hamish.results[1].rec), { event: "Yes, on FeNZ's list", points: '0 (fewer than 32 fencers)' });
  assert.equal(words('charlotte reeves').points, '0 (older than 12 months)');
  assert.deepEqual(words('aroha williams'), { event: "No, not on FeNZ's list", points: '0' });
  assert.deepEqual(words('sophie marlow'), { event: "Australian: FeNZ's ranking decides", points: "From FeNZ's ranking" });
});


test('the test data uses only the demo fencers, and shows each rule', () => {
  const demo = new Set(makeDemoBouts().flatMap((b) => [nameKey(b.fencer_a), nameKey(b.fencer_b)]));
  const st = testIntlState(TODAY);
  for (const r of st.records) {
    assert.ok(demo.has(r.fencer), `${r.fencer} is a demo fencer`);
    assert.match(r.event, /\(test\)$/);
    assert.ok(r.results_url.startsWith('https://example.org/'));
  }
  assert.deepEqual(TEST_FENCERS.map(nameKey).filter((k) => !demo.has(k)), []);
  const shown = st.records.map((r) => publicStatus(r, TODAY)).filter(Boolean);
  assert.deepEqual(shown.map((s) => (s.counts ? 'counts' : s.reason)).sort(),
    ['counts', 'expired', 'not_on_list', 'small_field']);
  assert.deepEqual(st.records.map((r) => r.status).sort(),
    ['approved', 'approved', 'approved', 'approved', 'approved', 'pending', 'pending', 'pending', 'pending', 'rejected']);
  assert.ok(st.records.some((r) => softCapQualifier(r) === 'aus_top_half'));
  const together = st.records.filter((r) => r.event_id === 'test-event-1');
  assert.deepEqual(together.map((r) => r.fencer_name), ['Hamish Carter', "Liam O'Connell"], 'one event, entered together');
});

// ---- Results from FeNZ's results portal ----------------------------------------

const portalRow = (over = {}) => ({
  id: 'portal:e1:claire cooper', fencer: 'claire cooper', fencer_name: 'Claire Cooper', weapon: 'epee',
  gender: 'womens', category: 'senior', age_label: 'Senior', event: 'Fencing World Championships 2026',
  event_label: 'Epee Women Senior', place: 'Hong Kong', country: 'HKG', level: 'fie', date: '2026-07-22',
  date_end: '2026-07-30', results_url: 'https://results.fencing.org.nz/competitions/c1/events/e1',
  placing: 157, field_size: null, made_de: null, status: 'approved', reason: 'fenz_portal', ...over,
});

test('placings read "5th of 40", or "157th" where the field size is not published', () => {
  assert.equal(placingText({ placing: 5, field_size: 40 }), '5th of 40');
  assert.equal(placingText({ placing: 157, field_size: null }), '157th');
  assert.equal(categoryText({ category: 'u20' }), 'Junior (U20)');
  assert.equal(categoryText({ category: null, age_label: 'U15' }), 'U15', "the portal's words where the site has no category");
});

test('portal results are shown as FeNZ records: never scored here, never a cl. 5.1 qualifier', () => {
  const rows = shippedResults({ results: [
    portalRow(),
    portalRow({ id: 'portal:e2:claire cooper', status: 'pending', reason: null, points: 99, counts: true }),
    portalRow({ id: 'portal:e1:claire cooper' }),                       // same id again
    portalRow({ id: 'x1', weapon: 'lance' }),
    portalRow({ id: 'x2', date: '22/07/2026' }),
    portalRow({ id: 'x3', placing: 0 }),
    portalRow({ id: 'x4', fencer: '' }),
    portalRow({ id: 'x5', results_url: 'javascript:alert(1)', level: 'national_circuit', country: 'AUS' }),
  ] });
  assert.deepEqual(rows.map((r) => r.id), ['portal:e1:claire cooper', 'portal:e2:claire cooper', 'x5']);
  for (const r of rows) {
    assert.deepEqual([r.status, r.reason, r.source, r.points, r.counts], ['approved', 'fenz_portal', 'fenz_portal', null, null]);
  }
  assert.equal(rows[2].results_url, null, 'an unsafe link is dropped');
  assert.deepEqual(eventVerdict(rows[0], TODAY), { fenz: true, why: 'fie', points: null, note: null });
  assert.deepEqual(eventVerdict(rows[2], TODAY), { fenz: null, why: 'australian', points: null, note: null });
  assert.equal(softCapQualifier({ ...rows[0], made_de: true }), null, 'no selection check on real fencers');
  assert.deepEqual(shippedResults(null), []);
  assert.deepEqual(shippedResults({ results: 'nope' }), []);
  // They join the browser's records on the tab, newest first, and follow admin merges.
  const both = fencerResults([...rows, approve(pending({ fencer: 'claire cooper', date: '2026-08-01' })).value], 'claire cooper', TODAY);
  assert.deepEqual(both.results.map((x) => x.rec.date), ['2026-08-01', '2026-07-22', '2026-07-22', '2026-07-22']);
  const merged = applyMerges(rows, { 'claire cooper': { merge_into: 'clare cooper', merge_into_name: 'Clare Cooper' } });
  assert.deepEqual([merged[0].fencer, merged[0].fencer_name], ['clare cooper', 'Clare Cooper']);
  assert.equal(applyMerges(rows, {}), rows);
});

test('the shipped intl_results.json reads cleanly and holds no personal fields', () => {
  const file = new URL('../../ingest/intl_results.json', import.meta.url);
  if (!fs.existsSync(file)) return;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = shippedResults(json);
  assert.equal(rows.length, json.results.length, 'every row is usable');
  assert.equal(new Set(json.results.map((r) => r.id)).size, json.results.length, 'ids are unique');
  const allowed = new Set(Object.keys(portalRow()));
  for (const r of json.results) {
    assert.deepEqual(Object.keys(r).filter((k) => !allowed.has(k)), [], `${r.id}: only the documented fields`);
    assert.equal(r.fencer, nameKey(r.fencer_name), `${r.id}: the key is the site's key for the name`);
    assert.ok(r.results_url.startsWith('https://results.fencing.org.nz/competitions/'), r.id);
    assert.notEqual(r.country, 'NZL');
    assert.ok(r.level === 'fie' || r.country === 'AUS', `${r.id}: FIE or Australian`);
    assert.equal(r.field_size, null);
  }
});

// ---- One event, several fencers ---------------------------------------------------

const ev = {
  weapon: 'epee', gender: 'mens', category: 'senior', event: 'National circuit (test)', organiser: '',
  country: 'FRA', city: 'Lyon', level: 'national_circuit', date: '2026-10-01',
  results_url: 'https://example.org/r', field_size: '64',
};
const row = (fencer, placing, over = {}) => ({ fencer: nameKey(fencer), fencer_name: fencer, placing, residence: 'overseas', ...over });

test('an event entered once gives one result per fencer, the event checked first', () => {
  const ok = validateEventEntry(ev, [row('Hamish Carter', '9'), { fencer: '', placing: '' }, row("Liam O'Connell", '30')], { today: TODAY });
  assert.deepEqual(ok.value.map((v) => [v.fencer_name, v.placing, v.field_size, v.event]),
    [['Hamish Carter', 9, 64, 'National circuit (test)'], ["Liam O'Connell", 30, 64, 'National circuit (test)']], 'blank rows skipped');
  assert.match(validateEventEntry({ ...ev, results_url: '' }, [row('Hamish Carter', 'x')], { today: TODAY }).error, /official results link/, 'the event first');
  assert.match(validateEventEntry(ev, [row('Hamish Carter', '70')], { today: TODAY }).error, /^Hamish Carter: the placing is past the field size/);
  assert.match(validateEventEntry(ev, [row('Hamish Carter', '9'), row('Hamish Carter', '12')], { today: TODAY }).error, /listed twice/);
  assert.match(validateEventEntry(ev, [{ fencer: '', placing: '' }], { today: TODAY }).error, /at least one fencer/);
  assert.match(validateEventEntry({ ...ev, level: 'fie' }, [row('Hamish Carter', '9')], { today: TODAY }).error, /reached the DE/);
});

test('an event\'s waiting results are approved together, all or none', () => {
  const recs = validateEventEntry(ev, [row('Hamish Carter', '9'), row("Liam O'Connell", '30')], { today: TODAY }).value
    .map((v, i) => ({ ...newRecord(v, { id: `e-${i}`, now: NOW }), event_id: 'e' }));
  const other = pending({ fencer: 'theo anand' });
  const policy = { ...P, list: [...P.list, { id: 'fra-circuit-x', country: 'FRA', event: 'National circuit', level: 'national_circuit' }] };
  const out = reviewEvent([...recs, other], 'e', 'approve', { reviewer: 'Rev', listEntry: 'fra-circuit-x', policy, now: NOW });
  assert.equal(out.count, 2);
  assert.deepEqual(out.value.map((r) => [r.status, r.points]), [['approved', 21], ['approved', 12], ['pending', null]]);
  assert.match(reviewEvent([...recs, other], 'e', 'approve', { reviewer: '', policy, now: NOW }).error, /reviewer name/);
  assert.match(reviewEvent(out.value, 'e', 'approve', { reviewer: 'Rev', policy, now: NOW }).error, /nothing waiting/);
  assert.match(reviewEvent(recs, 'e', 'reject', { reviewer: 'Rev', policy, now: NOW }).error, /say why/);
});

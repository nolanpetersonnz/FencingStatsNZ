import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLACEHOLDER_POLICY, initialLog, validateResult, newRecord, reviewResult, scoreResult, placingShare,
  publicStatus, statusText, profileResults, adminStatusText, softCapQualifier, coversAgeGroup, meetsSoftCap,
  changePolicy, validatePolicy, addMonths, ordinal,
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

test('the profile shows approved results this panel scores, with the chosen wording', () => {
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
  const rows = profileResults([counted, old, off, pending()], 'hamish carter', 'epee', TODAY);
  assert.deepEqual(rows.map((x) => x.rec.date), ['2026-06-14', '2026-06-14', '2025-06-14']);
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
    ['approved', 'approved', 'approved', 'approved', 'approved', 'pending', 'pending', 'rejected']);
  assert.ok(st.records.some((r) => softCapQualifier(r) === 'aus_top_half'));
});

// scripts/purge-licence-hashes.mjs (security #8), run against an
// in-memory stand-in for @upstash/redis. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { purge, formatReport } from '../scripts/purge-licence-hashes.mjs';

const fakeHash = (s) => createHash('sha256').update(s).digest('hex');
const H1 = fakeHash('fake-licence-1');
const H2 = fakeHash('fake-licence-2');
const H3 = fakeHash('fake-licence-3');
const ANY_HASH = /[0-9a-f]{64}/i;

// The subset of @upstash/redis the script uses, with its behaviour where it
// matters: get() parses JSON, set() stores strings, and SCAN pages through
// the keyspace (two keys a page, so the cursor loop is exercised) and
// filters each page by MATCH afterwards, so pages can come back empty.
class FakeRedis {
  constructor(entries) {
    this.data = new Map(Object.entries(entries));  // key -> { type, value }
  }
  snapshot() { return JSON.stringify([...this.data].sort()); }
  async scan(cursor, { match = '*' } = {}) {
    const keys = [...this.data.keys()].sort();
    const start = Number(cursor);
    const re = new RegExp(`^${match.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    const page = keys.slice(start, start + 2).filter((k) => re.test(k));
    const next = start + 2 >= keys.length ? '0' : String(start + 2);
    return [next, page];
  }
  async type(key) { return this.data.get(key)?.type ?? 'none'; }
  async get(key) {
    const e = this.data.get(key);
    if (!e) return null;
    try { return JSON.parse(e.value); } catch { return e.value; }
  }
  async set(key, value) {
    this.data.set(key, { type: 'string', value: typeof value === 'string' ? value : JSON.stringify(value) });
    return 'OK';
  }
  async del(...keys) { return keys.filter((k) => this.data.delete(k)).length; }
  async smembers(key) { return [...this.data.get(key).value]; }
  async zrange(key) { return [...this.data.get(key).value]; }
  async lrange(key) { return [...this.data.get(key).value]; }
  async hgetall(key) { return { ...this.data.get(key).value }; }
}

const str = (v) => ({ type: 'string', value: typeof v === 'string' ? v : JSON.stringify(v) });

const EDIT_1 = {
  id: '1717000000000-aaaaaa', kind: 'display_name', fencer_key: 'alice example',
  licence_hash: H1, payload: { display_name: 'Alice Example' }, status: 'applied',
  created_at: '2026-06-01T10:00:00.000Z', applied_at: '2026-06-01T10:00:00.000Z',
};
const EDIT_2 = {
  id: '1717000000001-bbbbbb', kind: 'dispute', fencer_key: 'bob example',
  licence_hash: H2, payload: { bout: { date: '2026-05-01' }, reason: 'wrong score' },
  status: 'pending', created_at: '2026-06-02T10:00:00.000Z', applied_at: null,
  bout_fingerprint: '2026-05-01|foil|test open|alice example|bob example|5|3',
};
const EDIT_3 = {  // already clean, e.g. re-saved by an admin action
  id: '1717000000002-cccccc', kind: 'current_club', fencer_key: 'carol example',
  payload: { current_club: 'Test Club' }, status: 'applied',
  created_at: '2026-06-03T10:00:00.000Z', applied_at: '2026-06-03T10:00:00.000Z',
};

function seed() {
  return new FakeRedis({
    [`edit:${EDIT_1.id}`]: str(EDIT_1),
    [`edit:${EDIT_2.id}`]: str(EDIT_2),
    [`edit:${EDIT_3.id}`]: str(EDIT_3),
    edits: { type: 'zset', value: [EDIT_1.id, EDIT_2.id, EDIT_3.id] },
    overrides: str({ name_overrides: { 'alice example': { value: 'Alice Example', edit_id: EDIT_1.id } }, club_overrides: {} }),
    flagged_bouts: { type: 'set', value: [EDIT_2.bout_fingerprint] },
    club_meta: str({}),
    // 40-hex commit SHAs from the refresh log are not licence hashes.
    refresh_reviewed: { type: 'set', value: ['0123456789abcdef0123456789abcdef01234567'] },
    [`fl_rl_edit:${H1}:4851`]: str('3'),
    'fl_rl_edit:alice example:4851': str('1'),
  });
}

test('dry run reports what it would change and writes nothing', async () => {
  const db = seed();
  const before = db.snapshot();
  const r = await purge(db);
  assert.equal(db.snapshot(), before);
  assert.deepEqual(r.edits, { records: 3, withHash: 2, stripped: 0, unreadable: 0 });
  assert.deepEqual(r.rateLimit, { found: 1, deleted: 0 });
  assert.deepEqual(r.sweep.flagged.sort(), [`edit:${EDIT_1.id}`, `edit:${EDIT_2.id}`, 'fl_rl_edit:<hash>:4851'].sort());
  assert.match(formatReport(r), /^Dry run/);
});

test('--apply strips the hash from every edit record and keeps everything else', async () => {
  const db = seed();
  const r = await purge(db, { apply: true });
  assert.deepEqual(r.edits, { records: 3, withHash: 2, stripped: 2, unreadable: 0 });
  const { licence_hash: _h1, ...clean1 } = EDIT_1;
  const { licence_hash: _h2, ...clean2 } = EDIT_2;
  assert.deepEqual(await db.get(`edit:${EDIT_1.id}`), clean1);
  assert.deepEqual(await db.get(`edit:${EDIT_2.id}`), clean2);
  assert.deepEqual(await db.get(`edit:${EDIT_3.id}`), EDIT_3);
  // Hash-named rate-limit key gone; everything else untouched.
  assert.deepEqual(r.rateLimit, { found: 1, deleted: 1 });
  assert.equal(await db.type(`fl_rl_edit:${H1}:4851`), 'none');
  assert.equal(await db.get('fl_rl_edit:alice example:4851'), 1);
  assert.deepEqual(await db.zrange('edits'), [EDIT_1.id, EDIT_2.id, EDIT_3.id]);
  assert.deepEqual(await db.smembers('flagged_bouts'), [EDIT_2.bout_fingerprint]);
  assert.equal((await db.get('overrides')).name_overrides['alice example'].edit_id, EDIT_1.id);
  // Nothing hash-like left anywhere, and a second run finds nothing to do.
  assert.deepEqual(r.sweep.flagged, []);
  assert.equal(r.sweep.keys, 9);
  const again = await purge(db, { apply: true });
  assert.deepEqual(again.edits, { records: 3, withHash: 0, stripped: 0, unreadable: 0 });
  assert.match(formatReport(again), /no 64-character hex string left/);
});

test('the sweep finds a hash hiding anywhere else, and the report never prints one', async () => {
  const db = seed();
  db.data.set('stray:list', { type: 'list', value: [`note ${H3}`] });
  db.data.set('stray:hash', { type: 'hash', value: { who: H3 } });
  db.data.set(`edit:1717000000003-dddddd`, str({ ...EDIT_3, id: '1717000000003-dddddd', payload: { note: H3 } }));
  const r = await purge(db, { apply: true });
  assert.deepEqual(r.sweep.flagged.sort(), ['edit:1717000000003-dddddd', 'stray:hash', 'stray:list'].sort());
  const text = formatReport(r);
  assert.doesNotMatch(text, ANY_HASH);
  assert.match(text, /stray:list/);
  assert.doesNotMatch(JSON.stringify(r), ANY_HASH);
});

test('edit records that are not JSON strings are counted and left alone', async () => {
  const db = seed();
  db.data.set('edit:broken', { type: 'string', value: 'not json' });
  db.data.set('edit:odd-type', { type: 'hash', value: { a: '1' } });
  const r = await purge(db, { apply: true });
  assert.equal(r.edits.unreadable, 2);
  assert.equal(await db.get('edit:broken'), 'not json');
  assert.match(formatReport(r), /2 edit record\(s\) were not JSON/);
});

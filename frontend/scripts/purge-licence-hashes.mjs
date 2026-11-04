#!/usr/bin/env node
// One-off clean-up (security #8): remove the licence hashes that past
// sign-ins left in Upstash Redis.
//
// Until sign-in was paused on 3 Nov 2026, /api/edit stored the submitter's
// licence hash in every `edit:<id>` record, and the rate limiter kept
// short-lived `fl_rl_edit:<hash>:<window>` keys. The old pepper shipped in
// the public bundle, so those hashes can be turned back into licence
// numbers. This script:
//
//   1. removes the `licence_hash` field from every edit record, keeping
//      every other field, so the admin queue works as before;
//   2. deletes any rate-limit key still named after a hash;
//   3. sweeps every key in the database and reports any 64-character hex
//      string left in a key name or value.
//
// It never prints a hash or the contents of a record, and it only reports
// unless you pass --apply. Run it from frontend/ with the production
// Upstash credentials (KV_REST_API_URL + KV_REST_API_TOKEN, or the
// UPSTASH_REDIS_REST_* pair: the same variables the API functions read):
//
//   vercel env pull .env.production.local --environment=production
//   node --env-file=.env.production.local scripts/purge-licence-hashes.mjs
//   node --env-file=.env.production.local scripts/purge-licence-hashes.mjs --apply
//   rm .env.production.local
//
// Safe to re-run. After --apply it exits 1 if anything hash-like is left.

import { pathToFileURL } from 'node:url';

const HASH = /[0-9a-f]{64}/i;
const RATE_LIMIT_PREFIX = 'fl_rl_edit';

// Key names are printed with any hash replaced, never the hash itself.
export const redact = (s) => String(s).replace(/[0-9a-f]{64}/gi, '<hash>');

async function scanAll(db, match) {
  const keys = new Set();  // SCAN may return a key more than once
  let cursor = '0';
  do {
    const [next, batch] = await db.scan(cursor, { match, count: 500 });
    for (const k of batch) keys.add(k);
    cursor = String(next);
  } while (cursor !== '0');
  return [...keys].sort();
}

// @upstash/redis parses JSON on read; a raw string means it wasn't JSON.
function asRecord(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export async function stripEditRecords(db, { apply = false } = {}) {
  const keys = await scanAll(db, 'edit:*');
  const out = { records: keys.length, withHash: 0, stripped: 0, unreadable: 0 };
  for (const key of keys) {
    const rec = (await db.type(key)) === 'string' ? asRecord(await db.get(key)) : null;
    if (!rec) { out.unreadable++; continue; }
    if (!Object.prototype.hasOwnProperty.call(rec, 'licence_hash')) continue;
    out.withHash++;
    if (!apply) continue;
    const { licence_hash: _drop, ...rest } = rec;
    await db.set(key, JSON.stringify(rest));
    out.stripped++;
  }
  return out;
}

export async function deleteRateLimitKeys(db, { apply = false } = {}) {
  const keys = (await scanAll(db, `${RATE_LIMIT_PREFIX}*`)).filter((k) => HASH.test(k));
  let deleted = 0;
  if (apply) {
    for (let i = 0; i < keys.length; i += 100) deleted += await db.del(...keys.slice(i, i + 100));
  }
  return { found: keys.length, deleted };
}

async function valuesOf(db, key, type) {
  switch (type) {
    case 'string': return [await db.get(key)];
    case 'set': return db.smembers(key);
    case 'zset': return db.zrange(key, 0, -1);
    case 'list': return db.lrange(key, 0, -1);
    case 'hash': return [await db.hgetall(key)];
    default: return null;  // a stream or an unknown type: not inspected
  }
}

export async function sweepForHashes(db) {
  const keys = await scanAll(db, '*');
  const flagged = [];
  const skipped = [];
  for (const key of keys) {
    if (HASH.test(key)) { flagged.push(redact(key)); continue; }
    const type = await db.type(key);
    if (type === 'none') continue;  // expired since the scan
    const values = await valuesOf(db, key, type);
    if (!values) { skipped.push(`${redact(key)} (${type})`); continue; }
    const text = values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n');
    if (HASH.test(text)) flagged.push(redact(key));
  }
  return { keys: keys.length, flagged, skipped };
}

export async function purge(db, { apply = false } = {}) {
  const edits = await stripEditRecords(db, { apply });
  const rateLimit = await deleteRateLimitKeys(db, { apply });
  const sweep = await sweepForHashes(db);
  return { apply, edits, rateLimit, sweep };
}

export function formatReport({ apply, edits, rateLimit, sweep }) {
  const lines = [apply ? 'Applied.' : 'Dry run: nothing written. Re-run with --apply to make these changes.', ''];
  lines.push(
    `Edit records: ${edits.records} found, ${edits.withHash} with a licence hash` +
    (apply ? `, removed from ${edits.stripped}.` : ', would remove it from each.'),
  );
  if (edits.unreadable) lines.push(`  ${edits.unreadable} edit record(s) were not JSON and were left alone.`);
  lines.push(
    `Rate-limit keys named after a hash: ${rateLimit.found}` +
    (apply ? `, deleted ${rateLimit.deleted}.` : rateLimit.found ? ', would delete them.' : '.'),
  );
  if (sweep.flagged.length) {
    lines.push(`Sweep of all ${sweep.keys} keys: ${sweep.flagged.length} still hold a 64-character hex string:`);
    for (const k of sweep.flagged.slice(0, 50)) lines.push(`  ${k}`);
    if (sweep.flagged.length > 50) lines.push(`  ... and ${sweep.flagged.length - 50} more`);
  } else {
    lines.push(`Sweep of all ${sweep.keys} keys: no 64-character hex string left in any key name or value.`);
  }
  for (const k of sweep.skipped) lines.push(`  Not inspected: ${k}`);
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const apply = process.argv.includes('--apply');
  const { redis } = await import('../api/_lib.js');
  let db;
  try {
    db = redis();
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  let report;
  try {
    report = await purge(db, { apply });
  } catch (e) {
    console.error(`Could not finish: ${e.cause?.message || e.message}. Records changed before this point keep their new form; re-running is safe.`);
    process.exit(2);
  }
  console.log(formatReport(report));
  if (apply && report.sweep.flagged.length) process.exit(1);
}

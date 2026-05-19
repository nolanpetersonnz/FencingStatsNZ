// Shared helpers for the /api/* functions. Loaded once per cold-start.
//
// Wire-up: Vercel function reads UPSTASH_REDIS_REST_URL,
// UPSTASH_REDIS_REST_TOKEN, ADMIN_TOKEN from env. See SETUP.md.

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let _redis = null;
export function redis() {
  if (_redis) return _redis;
  // Vercel's marketplace Upstash integration auto-provisions env vars
  // prefixed KV_REST_API_* (legacy Vercel KV naming). Direct Upstash
  // dashboard installs use UPSTASH_REDIS_REST_*. Accept either, plus a
  // custom REDIS_* prefix for anyone renaming.
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Redis env vars missing. Set either KV_REST_API_URL + KV_REST_API_TOKEN ' +
      '(Vercel marketplace default) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.'
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

let _rl = null;
export function rateLimiter() {
  if (_rl) return _rl;
  _rl = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.fixedWindow(20, '1 h'),  // 20 edits / hour / hash
    prefix: 'fl_rl_edit',
  });
  return _rl;
}

// Read the same fencers.json the public site fetches. Tries the
// filesystem first (vercel.json's includeFiles should bundle it under
// public/data/) and falls back to an HTTP fetch from the same origin
// if that fails — covers both cold-start paths and any includeFiles
// quirk where the file ends up at an unexpected location.
let _fencers = null;
export async function fencerInfo(req) {
  if (_fencers) return _fencers;

  const candidates = [
    path.join(process.cwd(), 'public', 'data', 'fencers.json'),
    path.join(process.cwd(), 'frontend', 'public', 'data', 'fencers.json'),
    '/var/task/public/data/fencers.json',
    '/var/task/frontend/public/data/fencers.json',
  ];
  for (const fp of candidates) {
    try {
      const txt = await readFile(fp, 'utf-8');
      _fencers = JSON.parse(txt);
      console.log('fencerInfo loaded', _fencers.length, 'from', fp);
      return _fencers;
    } catch {
      /* try next candidate */
    }
  }

  // Fall back to HTTP. Vercel always serves /data/fencers.json from
  // the static build, so we can self-fetch via the host header.
  try {
    const host = req?.headers?.host;
    const proto = req?.headers?.['x-forwarded-proto'] || 'https';
    if (host) {
      const url = `${proto}://${host}/data/fencers.json`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        _fencers = await res.json();
        console.log('fencerInfo loaded', _fencers.length, 'via HTTP', url);
        return _fencers;
      }
      console.warn('fencerInfo HTTP fetch failed', url, res.status);
    }
  } catch (e) {
    console.warn('fencerInfo HTTP fallback errored', e?.message || e);
  }

  console.warn('fencerInfo: all sources failed; returning empty');
  _fencers = [];
  return _fencers;
}

export function nameKey(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Find the fencer enrichment record by licence hash. Returns null when
// the hash doesn't belong to any known fencer. Pass `req` so the
// loader can self-fetch via HTTP if the bundled file isn't present.
export async function fencerForHash(hash, req) {
  if (!hash || typeof hash !== 'string' || hash.length !== 64) return null;
  const list = await fencerInfo(req);
  for (const f of list) {
    if (f.licence_hashes?.includes(hash)) return f;
  }
  return null;
}

// Stable per-fencer key — first name_key entry, lowercased.
// Matches pipeline.js's nameKey() and the keys produced from bouts.csv.
export function fencerKeyOf(rec) {
  if (!rec || !rec.name_keys?.length) return null;
  return nameKey(rec.name_keys[0]);
}

export function isAdmin(req) {
  const auth = req.headers?.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  const token = m[1].trim();
  return token && token === process.env.ADMIN_TOKEN;
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  // Some runtimes give us a string in req.body; otherwise stream it.
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(buf)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// Bout fingerprint — stable across builds, identifies one bout for the
// purposes of dispute flagging. Must match the client-side hasher in
// frontend/src/data/edits.js.
export function boutFingerprint(b) {
  const a = nameKey(b.fencer_a || b.keyA);
  const c = nameKey(b.fencer_b || b.keyB);
  const sA = String(b.score_a ?? b.scoreA ?? '').trim();
  const sB = String(b.score_b ?? b.scoreB ?? '').trim();
  const date = (b.date || '').trim();
  const comp = (b.competition || '').trim().toLowerCase();
  const w = (b.weapon || '').toLowerCase().trim();
  // Order-independent canonical form.
  const [n1, n2, s1, s2] = a <= c ? [a, c, sA, sB] : [c, a, sB, sA];
  return `${date}|${w}|${comp}|${n1}|${n2}|${s1}|${s2}`;
}

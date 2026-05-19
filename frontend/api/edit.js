// POST /api/edit
//
// Accepts an edit submission from a signed-in fencer. The licence hash
// is verified against fencers.json (bundled into the function image),
// the edit is rate-limited per hash, then persisted to Upstash. Name
// and club edits go live immediately by writing to the `overrides`
// document; merge and dispute edits stay in a `pending` queue for the
// admin to review.

import { redis, rateLimiter, fencerForHash, fencerKeyOf, readJsonBody, boutFingerprint } from './_lib.js';

const LIVE_KINDS = new Set(['display_name', 'current_club']);
const QUEUED_KINDS = new Set(['merge', 'dispute']);

function validatePayload(kind, payload) {
  if (kind === 'display_name') {
    const n = String(payload?.display_name || '').trim();
    if (!n || n.length > 80) return 'name must be 1-80 characters';
    return null;
  }
  if (kind === 'current_club') {
    const c = String(payload?.current_club || '').trim();
    if (c.length > 120) return 'club name must be 1-120 characters';
    return null;  // empty club allowed (= unaffiliated)
  }
  if (kind === 'merge') {
    const tgt = String(payload?.merge_into || '').trim();
    if (!tgt) return 'merge_into target required';
    if (tgt.length > 200) return 'merge target too long';
    return null;
  }
  if (kind === 'dispute') {
    if (!payload?.bout) return 'bout details required';
    const reason = String(payload?.reason || '').trim();
    if (reason.length > 500) return 'reason must be under 500 characters';
    return null;
  }
  return 'unknown kind';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.status(400).json({ error: 'invalid json' });
    return;
  }

  const { licence_hash, kind, payload } = body || {};
  if (!licence_hash || typeof licence_hash !== 'string') {
    res.status(400).json({ error: 'licence_hash required' });
    return;
  }
  if (!LIVE_KINDS.has(kind) && !QUEUED_KINDS.has(kind)) {
    res.status(400).json({ error: 'invalid edit kind' });
    return;
  }
  const validation = validatePayload(kind, payload);
  if (validation) {
    res.status(400).json({ error: validation });
    return;
  }

  const fencer = await fencerForHash(licence_hash);
  if (!fencer) {
    res.status(401).json({ error: 'unknown licence' });
    return;
  }
  const fkey = fencerKeyOf(fencer);
  if (!fkey) {
    res.status(500).json({ error: 'fencer has no canonical key' });
    return;
  }

  // Rate limit by licence hash. Errors here are non-fatal — Upstash
  // outage shouldn't block edits — but we log them.
  try {
    const r = rateLimiter();
    const { success, remaining } = await r.limit(licence_hash);
    if (!success) {
      res.status(429).json({ error: 'rate limit exceeded; try again later' });
      return;
    }
    res.setHeader('X-Edit-Quota-Remaining', String(remaining));
  } catch (e) {
    console.warn('rate-limit-check-failed', e);
  }

  const db = redis();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const status = QUEUED_KINDS.has(kind) ? 'pending' : 'applied';
  const now = new Date().toISOString();

  const record = {
    id,
    kind,
    fencer_key: fkey,
    licence_hash,
    payload,
    status,
    created_at: now,
    applied_at: status === 'applied' ? now : null,
  };

  // For disputes, attach a stable bout fingerprint so the public site
  // can show the badge by matching against bouts. Disputes are queued
  // by status but the fingerprint is flagged immediately — the user
  // wanted disputed bouts visible to all viewers.
  if (kind === 'dispute' && payload?.bout) {
    record.bout_fingerprint = boutFingerprint(payload.bout);
  }

  await db.set(`edit:${id}`, JSON.stringify(record));
  await db.zadd('edits', { score: Date.now(), member: id });

  if (status === 'applied') {
    // Apply live edits to the public overrides doc.
    const cur = (await db.get('overrides')) || {};
    const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
    const next = { name_overrides: {}, club_overrides: {}, ...parsed };
    if (kind === 'display_name') {
      next.name_overrides[fkey] = { value: payload.display_name.trim(), edit_id: id };
    } else if (kind === 'current_club') {
      next.club_overrides[fkey] = { value: payload.current_club.trim(), edit_id: id };
    }
    await db.set('overrides', JSON.stringify(next));
  }

  if (kind === 'dispute' && record.bout_fingerprint) {
    await db.sadd('flagged_bouts', record.bout_fingerprint);
  }

  res.status(200).json({ ok: true, id, status });
}

// Client-side helpers for the /api/edit and /api/overrides endpoints.

import { nameKey } from './pipeline.js';

// Stable bout fingerprint — must match boutFingerprint() in api/_lib.js
// since the server stores fingerprints and the client matches against
// them to render flag badges.
export function boutFingerprint(b) {
  const a = nameKey(b.fencer_a || b.keyA);
  const c = nameKey(b.fencer_b || b.keyB);
  const sA = String(b.score_a ?? b.scoreA ?? '').trim();
  const sB = String(b.score_b ?? b.scoreB ?? '').trim();
  const date = (b.date || '').trim();
  const comp = (b.competition || '').trim().toLowerCase();
  const w = (b.weapon || '').toLowerCase().trim();
  const [n1, n2, s1, s2] = a <= c ? [a, c, sA, sB] : [c, a, sB, sA];
  return `${date}|${w}|${comp}|${n1}|${n2}|${s1}|${s2}`;
}

// `fresh=true` adds a unique query param so Vercel's edge cache and
// the browser cache both miss — used right after an edit submit so the
// author sees their change immediately.
export async function loadOverrides({ fresh = false } = {}) {
  try {
    const url = fresh ? `/api/overrides?t=${Date.now()}` : '/api/overrides';
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitEdit({ licenceHash, fencerKey, kind, payload }) {
  const res = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licence_hash: licenceHash, fencer_key: fencerKey, kind, payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Admin helpers — bearer token lives in localStorage under fl_admin_token.
function adminHeaders() {
  const t = (typeof localStorage !== 'undefined' && localStorage.getItem('fl_admin_token')) || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function adminList() {
  const res = await fetch('/api/admin', { headers: adminHeaders(), cache: 'no-cache' });
  if (!res.ok) throw new Error(`admin list failed: ${res.status}`);
  return await res.json();
}

export async function adminAct(id, action, adminNote) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, admin_note: adminNote || undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Set or clear club-level metadata (website, location, affiliation).
// Pass website/location as empty strings or undefined to clear them.
export async function adminSetClubMeta({ clubName, website, location, affiliated }) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'set_club_meta',
      payload: { club_name: clubName, website, location, affiliated },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Merge two fencer profiles. Bouts attributed to `sourceKey` are
// rewritten to `targetKey` before rating processing, so the two records
// become one. Pass targetKey: '' to undo a previous merge.
export async function adminMergeFencers({ sourceKey, targetKey, targetName }) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'merge_fencers',
      payload: { source_key: sourceKey, target_key: targetKey, target_name: targetName },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Move a fencer to a new club (admin override). Pass clubName: '' to
// clear the override (the fencer falls back to their bout-derived club).
export async function adminAssignFencer({ fencerKey, clubName }) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'assign_fencer',
      payload: { fencer_key: fencerKey, club_name: clubName },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

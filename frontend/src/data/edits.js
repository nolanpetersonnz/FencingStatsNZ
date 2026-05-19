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

export async function loadOverrides() {
  try {
    const res = await fetch('/api/overrides', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitEdit({ licenceHash, kind, payload }) {
  const res = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licence_hash: licenceHash, kind, payload }),
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

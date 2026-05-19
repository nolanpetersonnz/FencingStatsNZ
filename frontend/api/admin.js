// Admin-only. Lists edits and performs actions (approve, reject,
// revert). Gated by Bearer token === ADMIN_TOKEN env var.
//
//   GET  /api/admin               -> list recent edits (latest 200)
//   POST /api/admin               -> body { id, action }
//                                    actions: approve | reject | revert

import { redis, isAdmin, readJsonBody } from './_lib.js';

async function listEdits(db) {
  // Newest first.
  const ids = await db.zrange('edits', 0, 199, { rev: true });
  if (!ids?.length) return [];
  const keys = ids.map((id) => `edit:${id}`);
  const docs = await db.mget(...keys);
  return docs
    .map((d) => (typeof d === 'string' ? JSON.parse(d) : d))
    .filter(Boolean);
}

async function updateOverridesAfterRevert(db, edit) {
  const cur = (await db.get('overrides')) || {};
  const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
  const next = { name_overrides: {}, club_overrides: {}, ...parsed };
  if (edit.kind === 'display_name' && next.name_overrides[edit.fencer_key]?.edit_id === edit.id) {
    delete next.name_overrides[edit.fencer_key];
  }
  if (edit.kind === 'current_club' && next.club_overrides[edit.fencer_key]?.edit_id === edit.id) {
    delete next.club_overrides[edit.fencer_key];
  }
  await db.set('overrides', JSON.stringify(next));
}

async function applyMerge(db, edit) {
  // Persist merges in a separate doc the client can layer on. Doesn't
  // mutate ratings — merge handling on the read path is a follow-up.
  const cur = (await db.get('merges')) || {};
  const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
  parsed[edit.fencer_key] = {
    merge_into: edit.payload?.merge_into || '',
    edit_id: edit.id,
  };
  await db.set('merges', JSON.stringify(parsed));
}

export default async function handler(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const db = redis();

  if (req.method === 'GET') {
    const items = await listEdits(db);
    res.status(200).json({ items });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const { id, action, admin_note } = body || {};
  if (!id || !['approve', 'reject', 'revert'].includes(action)) {
    res.status(400).json({ error: 'id and action required' });
    return;
  }

  const raw = await db.get(`edit:${id}`);
  if (!raw) {
    res.status(404).json({ error: 'edit not found' });
    return;
  }
  const edit = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const now = new Date().toISOString();

  if (action === 'approve') {
    if (edit.status !== 'pending') {
      res.status(400).json({ error: `cannot approve from status ${edit.status}` });
      return;
    }
    edit.status = 'approved';
    edit.applied_at = now;
    if (edit.kind === 'merge') {
      await applyMerge(db, edit);
    }
    // dispute approvals don't need further action — the bout was
    // already flagged on submission; "approve" just clears it from the
    // admin queue.
  } else if (action === 'reject') {
    if (edit.status !== 'pending') {
      res.status(400).json({ error: `cannot reject from status ${edit.status}` });
      return;
    }
    edit.status = 'rejected';
    edit.reviewed_at = now;
    if (edit.kind === 'dispute' && edit.bout_fingerprint) {
      await db.srem('flagged_bouts', edit.bout_fingerprint);
    }
  } else if (action === 'revert') {
    if (edit.status !== 'applied') {
      res.status(400).json({ error: 'only applied edits can be reverted' });
      return;
    }
    edit.status = 'reverted';
    edit.reverted_at = now;
    await updateOverridesAfterRevert(db, edit);
  }

  if (admin_note) edit.admin_note = String(admin_note).slice(0, 500);
  await db.set(`edit:${id}`, JSON.stringify(edit));

  res.status(200).json({ ok: true, edit });
}

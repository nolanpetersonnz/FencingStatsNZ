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
  // Persist merges in a separate doc rather than mutating stored
  // ratings: the client layers this doc onto raw bouts at load time,
  // before rating processing (see mergedRawBouts in App.jsx), so the
  // merge takes effect everywhere without a data rebuild.
  const cur = (await db.get('merges')) || {};
  const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
  parsed[edit.fencer_key] = {
    merge_into: edit.payload?.merge_into || '',
    edit_id: edit.id,
  };
  await db.set('merges', JSON.stringify(parsed));
}

// Admin-direct merge: rewrite all future reads of `source_key` to
// `target_key`. Pass target_key === '' (or omit) to undo a merge.
// `target_name` is stored so the client can render the merged fencer
// under their canonical display name without a lookup. Validation and
// mutation are split out as pure functions so they can be unit tested
// without a Redis connection; the handler is their only production
// caller.
export function validateMergeRequest(payload) {
  const source = String(payload?.source_key || '').trim().toLowerCase();
  const target = String(payload?.target_key || '').trim().toLowerCase();
  const targetName = String(payload?.target_name || '').trim();
  if (!source) return { error: 'source_key required' };
  if (target && source === target) return { error: 'source and target must differ' };
  return { source, target, targetName, error: null };
}

export function applyMergeFencers(parsed, source, target, targetName, editId) {
  if (!target) {
    delete parsed[source];
    return parsed;
  }
  // Reject chains: if target itself is already merged into someone
  // else, point source at the ultimate target instead. The seen set
  // guards against a pre-existing cycle in the doc looping forever.
  let finalTarget = target;
  const seen = new Set([source]);
  while (parsed[finalTarget]?.merge_into && !seen.has(finalTarget)) {
    seen.add(finalTarget);
    finalTarget = parsed[finalTarget].merge_into;
  }
  parsed[source] = {
    merge_into: finalTarget,
    merge_into_name: targetName || null,
    edit_id: editId,
  };
  return parsed;
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
  const { id, action, admin_note, payload } = body || {};

  // Club-meta actions don't operate on a single edit record — they
  // mutate the club_meta_overrides doc directly. Dispatched here so
  // /api/admin stays one endpoint.
  if (action === 'set_club_meta' || action === 'clear_club_meta') {
    const club = String(payload?.club_name || '').trim();
    if (!club) {
      res.status(400).json({ error: 'club_name required' });
      return;
    }
    const cur = (await db.get('club_meta')) || {};
    const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
    if (action === 'set_club_meta') {
      parsed[club] = {
        website: String(payload?.website || '').trim() || null,
        location: String(payload?.location || '').trim() || null,
        affiliated: payload?.affiliated === true ? true : payload?.affiliated === false ? false : null,
        updated_at: new Date().toISOString(),
      };
    } else {
      delete parsed[club];
    }
    await db.set('club_meta', JSON.stringify(parsed));
    res.status(200).json({ ok: true, club_meta: parsed[club] || null });
    return;
  }

  if (action === 'merge_fencers') {
    const v = validateMergeRequest(payload);
    if (v.error) {
      res.status(400).json({ error: v.error });
      return;
    }
    const cur = (await db.get('merges')) || {};
    const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
    applyMergeFencers(parsed, v.source, v.target, v.targetName, `admin-${Date.now()}`);
    await db.set('merges', JSON.stringify(parsed));
    res.status(200).json({ ok: true, merges: parsed });
    return;
  }

  if (action === 'assign_fencer') {
    const fkey = String(payload?.fencer_key || '').trim().toLowerCase();
    const club = String(payload?.club_name ?? '').trim();
    if (!fkey) {
      res.status(400).json({ error: 'fencer_key required' });
      return;
    }
    const cur = (await db.get('overrides')) || {};
    const parsed = typeof cur === 'string' ? JSON.parse(cur) : cur;
    const next = { name_overrides: {}, club_overrides: {}, ...parsed };
    if (club === '') {
      delete next.club_overrides[fkey];
    } else {
      next.club_overrides[fkey] = { value: club, edit_id: `admin-${Date.now()}` };
    }
    await db.set('overrides', JSON.stringify(next));
    res.status(200).json({ ok: true });
    return;
  }

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

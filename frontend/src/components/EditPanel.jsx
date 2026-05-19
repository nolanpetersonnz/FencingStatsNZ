import React, { useState } from 'react';
import { submitEdit } from '../data/edits.js';

// Edit panel shown on a fencer's profile page when they're signed in
// as that fencer. Lets them tweak their display name and current club
// (live, applies immediately) and request to merge a duplicate profile
// (queued for admin review).

// Hoisted out of EditPanel so its identity is stable across renders —
// otherwise React treats it as a new component type on every keystroke
// and remounts the <input>, dropping focus and selection.
function Row({ id, label, hint, openId, setOpen, children }) {
  const isOpen = openId === id;
  return (
    <div style={{ borderTop: '1px solid var(--rule-soft)', padding: '14px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div className="fl-smallcaps" style={{ fontSize: '0.72rem' }}>{label}</div>
          {hint && <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', marginTop: 2 }}>{hint}</div>}
        </div>
        <button
          onClick={() => setOpen(isOpen ? null : id)}
          className="fl-smallcaps"
          style={{ background: 'none', border: '1px solid var(--rule)', padding: '4px 12px', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '0.7rem' }}
        >
          {isOpen ? 'Cancel' : 'Edit'}
        </button>
      </div>
      {isOpen && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export default function EditPanel({ fencer, info, session, onEditApplied }) {
  const [open, setOpen] = useState(null); // 'name' | 'club' | 'merge' | null
  const [name, setName] = useState(fencer?.name || '');
  const [club, setClub] = useState(fencer?.club || '');
  const [mergeInto, setMergeInto] = useState('');
  const [status, setStatus] = useState(null); // {ok, msg} | null
  const [busy, setBusy] = useState(false);

  if (!session?.licenceHash) return null;

  const send = async (kind, payload, msg) => {
    setBusy(true);
    setStatus(null);
    try {
      await submitEdit({
        licenceHash: session.licenceHash,
        fencerKey: fencer?.key,
        kind,
        payload,
      });
      setStatus({ ok: true, msg });
      setOpen(null);
      // Tell App to re-fetch overrides so the change shows up without a
      // hard reload. /api/overrides has a 30 s edge cache so we add a
      // short wait — without it the cached empty response wins.
      if (onEditApplied) setTimeout(onEditApplied, 1200);
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: '0.95rem',
    fontFamily: 'Newsreader, serif',
    background: 'transparent', color: 'var(--ink)',
    border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box',
  };
  const submitBtn = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="fl-smallcaps"
      style={{ background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)', padding: '8px 16px', cursor: busy ? 'wait' : 'pointer', fontSize: '0.72rem' }}
    >
      {busy ? 'Sending...' : label}
    </button>
  );

  return (
    <div style={{ marginBottom: 32, padding: '18px 22px', border: '1px solid var(--rule)', background: 'rgba(26,107,181,0.03)' }}>
      <div className="fl-smallcaps" style={{ fontSize: '0.72rem', color: 'var(--ox)' }}>Edit your profile</div>
      <div className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.88rem', marginTop: 4 }}>
        Name and club updates apply immediately and are logged. Merge and dispute requests wait for admin review.
      </div>

      <Row id="name" label="Display name" hint="The name shown across the site for you." openId={open} setOpen={setOpen}>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <div style={{ marginTop: 10 }}>
          {submitBtn('Save name', () => send('display_name', { display_name: name }, 'Display name updated.'))}
        </div>
      </Row>

      <Row id="club" label="Current club" hint="Overrides the club inferred from your most recent bout." openId={open} setOpen={setOpen}>
        <input style={inputStyle} value={club} onChange={(e) => setClub(e.target.value)} maxLength={120} placeholder="e.g. South Wellington Fencing Club" />
        <div style={{ marginTop: 10 }}>
          {submitBtn('Save club', () => send('current_club', { current_club: club }, 'Club updated.'))}
        </div>
      </Row>

      <Row id="merge" label="Merge a duplicate profile" hint="If another profile on the site is also you, enter its display name. Admin will review and merge." openId={open} setOpen={setOpen}>
        <input style={inputStyle} value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} maxLength={200} placeholder="e.g. Joel Ball-La-Hood (other spelling)" />
        <div style={{ marginTop: 10 }}>
          {submitBtn('Request merge', () => send('merge', { merge_into: mergeInto }, 'Merge request submitted for review.'))}
        </div>
      </Row>

      {status && (
        <div
          className="fl-italic"
          style={{
            marginTop: 14,
            padding: 10,
            border: '1px solid ' + (status.ok ? 'var(--ox)' : 'var(--red-light)'),
            color: status.ok ? 'var(--ox-deep)' : 'var(--red-light)',
            fontSize: '0.9rem',
          }}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}

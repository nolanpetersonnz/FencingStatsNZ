import React, { useEffect, useState, useMemo } from 'react';
import { adminList, adminAct } from '../data/edits.js';

// /#admin — paste the ADMIN_TOKEN once, then review and act on edit
// submissions. Token persists in localStorage. Listing is server-side
// gated; bad tokens 401 and the UI shows the prompt again.

function TokenGate({ onSaved }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: 32, border: '1px solid var(--ink)' }}>
      <div className="fl-smallcaps" style={{ marginBottom: 6 }}>Admin</div>
      <h2 className="fl-display" style={{ fontSize: '1.8rem', margin: '0 0 14px' }}>Sign in</h2>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
        Paste your ADMIN_TOKEN (set in Vercel env). Stored in this browser only.
      </p>
      <input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ADMIN_TOKEN"
        style={{ width: '100%', padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' }}
      />
      <button
        onClick={() => { localStorage.setItem('fl_admin_token', val.trim()); onSaved(); }}
        disabled={!val.trim()}
        className="fl-smallcaps"
        style={{ marginTop: 14, background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)', padding: '8px 18px', cursor: val.trim() ? 'pointer' : 'not-allowed', opacity: val.trim() ? 1 : 0.4, fontSize: '0.72rem' }}
      >
        Save
      </button>
    </div>
  );
}

function fmtPayload(edit) {
  if (!edit?.payload) return '';
  if (edit.kind === 'display_name') return `"${edit.payload.display_name}"`;
  if (edit.kind === 'current_club') return `"${edit.payload.current_club}"`;
  if (edit.kind === 'merge') return `merge into "${edit.payload.merge_into}"`;
  if (edit.kind === 'dispute') {
    const b = edit.payload.bout || {};
    const meta = `${b.date || ''} ${b.competition || ''} ${b.fencer_a || ''} ${b.score_a ?? ''}-${b.score_b ?? ''} ${b.fencer_b || ''}`.trim();
    const reason = edit.payload.reason ? ` — "${edit.payload.reason}"` : '';
    return meta + reason;
  }
  return JSON.stringify(edit.payload);
}

export default function Admin({ onLeave }) {
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('fl_admin_token'));
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending | applied | all
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const refresh = async () => {
    setErr(null);
    try {
      const data = await adminList();
      setItems(data.items || []);
    } catch (e) {
      if (e.message.includes('401')) {
        localStorage.removeItem('fl_admin_token');
        setHasToken(false);
      }
      setErr(e.message);
    }
  };

  useEffect(() => { if (hasToken) refresh(); }, [hasToken]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'pending') return items.filter((i) => i.status === 'pending');
    if (filter === 'applied') return items.filter((i) => i.status === 'applied');
    return items;
  }, [items, filter]);

  if (!hasToken) return <TokenGate onSaved={() => setHasToken(true)} />;

  const act = async (id, action) => {
    setBusy(id);
    try {
      await adminAct(id, action);
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="fl-smallcaps">Admin · Edits queue</div>
          <h2 className="fl-display" style={{ fontSize: '1.8rem', margin: '4px 0 0' }}>{items.length} total · {items.filter((i) => i.status === 'pending').length} pending</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'applied', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`fl-pill ${filter === f ? 'active' : ''}`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => { localStorage.removeItem('fl_admin_token'); setHasToken(false); }}
            className="fl-pill"
            title="Forget token in this browser"
          >
            Sign out
          </button>
          <button onClick={onLeave} className="fl-pill">Back to site</button>
        </div>
      </div>

      {err && (
        <div className="fl-italic" style={{ padding: 10, border: '1px solid var(--red-light)', color: 'var(--red-light)', marginBottom: 16, fontSize: '0.9rem' }}>
          {err}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        {filtered.length === 0 && (
          <div className="fl-italic" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No edits in this view.
          </div>
        )}
        {filtered.map((edit) => {
          const ts = edit.created_at ? new Date(edit.created_at).toLocaleString() : '';
          return (
            <div key={edit.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="fl-smallcaps" style={{ color: edit.status === 'pending' ? 'var(--ox)' : 'var(--ink-soft)' }}>
                  {edit.status}
                </span>
                <span className="fl-smallcaps" style={{ fontSize: '0.7rem' }}>{edit.kind.replace('_', ' ')}</span>
                <span className="fl-display" style={{ fontWeight: 600 }}>{edit.fencer_key}</span>
                <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.8rem' }}>{ts}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.95rem' }}>{fmtPayload(edit)}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {edit.status === 'pending' && (
                  <>
                    <button disabled={busy === edit.id} onClick={() => act(edit.id, 'approve')} className="fl-pill">Approve</button>
                    <button disabled={busy === edit.id} onClick={() => act(edit.id, 'reject')} className="fl-pill">Reject</button>
                  </>
                )}
                {edit.status === 'applied' && (
                  <button disabled={busy === edit.id} onClick={() => act(edit.id, 'revert')} className="fl-pill">Revert</button>
                )}
                {edit.admin_note && (
                  <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Note: {edit.admin_note}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

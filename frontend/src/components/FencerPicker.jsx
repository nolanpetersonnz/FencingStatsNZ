import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fmtConservativeRating } from '../utils/formatters.js';

export default function FencerPicker({ fencers, weapon, gender, selected, onSelect, placeholder, settings }) {
  const k = settings?.displayK ?? 1;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const f = selected ? fencers[selected] : null;
  const w = f && f.byWeapon[weapon];

  const results = useMemo(() => {
    const list = Object.values(fencers).filter(x =>
      x.byWeapon[weapon]
      && (!gender || x.genders?.has(gender))
    );
    if (!q.trim()) return list.slice(0, 10);
    return list.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  }, [fencers, weapon, gender, q]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ padding: '20px 18px', position: 'relative' }}>
      {f ? (
        <div>
          <div className="fl-smallcaps" style={{ marginBottom: 6 }}>{f.club || '—'}</div>
          <div className="fl-display" style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.1 }}>{f.name}</div>
          {w ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
              <div style={{ opacity: w.pool.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ink)' }}>POOL</div>
                <div className="fl-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {w.pool.bouts > 0 ? fmtConservativeRating(w.pool.rating, w.pool.rd, k) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                  {w.pool.bouts > 0 ? `${w.pool.bouts}b` : ''}
                </div>
              </div>
              <div style={{ opacity: w.de.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ox)' }}>DE</div>
                <div className="fl-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--ox)' }}>
                  {w.de.bouts > 0 ? fmtConservativeRating(w.de.rating, w.de.rd, k) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                  {w.de.bouts > 0 ? `${w.de.bouts}b` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>No bouts in this weapon.</div>
          )}
          <div className="fl-link fl-smallcaps" style={{ marginTop: 12, color: 'var(--ox)' }} onClick={() => onSelect(null)}>Change</div>
        </div>
      ) : (
        <>
          <input
            className="fl-input"
            placeholder={placeholder}
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 18, right: 18, background: 'var(--paper)', border: '1px solid var(--rule)', marginTop: 6, zIndex: 30, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(17,20,24,0.10)' }} className="fl-scroll">
              {results.length === 0 && <div className="fl-italic" style={{ padding: 14, color: 'var(--ink-soft)' }}>No matches.</div>}
              {results.map(r => {
                const rw = r.byWeapon[weapon];
                const primaryStream = rw.pool.bouts >= rw.de.bouts ? rw.pool : rw.de;
                return (
                  <div key={r.key} className="fl-link fl-row-hover" style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)' }}
                    onClick={() => { onSelect(r.key); setQ(''); setOpen(false); }}>
                    <div className="fl-display" style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{r.club} · {fmtConservativeRating(primaryStream.rating, primaryStream.rd, k)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

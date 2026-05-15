import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Settings as SettingsIcon } from 'lucide-react';

const AGE_OPTIONS = [
  ['all', 'All ages'],
  ['cadet', 'Cadet'],
  ['junior', 'Junior'],
  ['veteran', 'Veteran'],
];

export default function Header({ view, setView, weapon, setWeapon, gender, setGender, ageCategory, setAgeCategory, fencers, onSelectFencer, hasData }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return Object.values(fencers)
      .filter(f => f.name.toLowerCase().includes(q) || (f.club || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, fencers]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div style={{ borderBottom: '3px double var(--ink)', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }} className="fl-stack-mobile">
          <div>
            <div className="fl-smallcaps" style={{ marginBottom: 8 }}>Aotearoa · A registry of bouts &amp; ratings</div>
            <h1 className="fl-display" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.4rem)', fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 0.95, margin: 0 }}>
              Fencing Stats<br/><span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>NZ</span>
            </h1>
            <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 10, fontSize: '1.05rem' }}>
              <span className="fl-ornament">❦</span> Glicko-style ratings drawn from the bouts of New Zealand
            </div>
          </div>
          <div ref={ref} style={{ position: 'relative', minWidth: 280, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} color="var(--ink-soft)" />
              <input
                className="fl-input"
                placeholder={hasData ? 'Search fencers, clubs…' : 'No data yet — see Import'}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                disabled={!hasData}
              />
            </div>
            {open && results.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--paper)', border: '1px solid var(--rule)', marginTop: 8, zIndex: 50, boxShadow: '0 8px 24px rgba(17,20,24,0.10)' }}>
                {results.map(f => (
                  <div
                    key={f.key}
                    className="fl-link fl-row-hover"
                    style={{ padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }}
                    onClick={() => { onSelectFencer(f.key); setSearch(''); setOpen(false); }}
                  >
                    <div className="fl-display" style={{ fontWeight: 600, fontSize: '1rem' }}>{f.name}</div>
                    <div className="fl-italic" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{f.club}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, gap: 24, flexWrap: 'wrap' }}>
          <nav style={{ display: 'flex', alignItems: 'center' }} className="fl-smallcaps">
            <div className={`fl-tab ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>Ledger</div>
            <div className={`fl-tab ${view === 'competitions' ? 'active' : ''}`} onClick={() => setView('competitions')}>Competitions</div>
            <div className={`fl-tab ${view === 'clubs' ? 'active' : ''}`} onClick={() => setView('clubs')}>Clubs</div>
            <div className={`fl-tab ${view === 'h2h' ? 'active' : ''}`} onClick={() => setView('h2h')}>Head-to-Head</div>
            <div className={`fl-tab ${view === 'import' ? 'active' : ''}`} onClick={() => setView('import')}>Import</div>
            <div className={`fl-tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><SettingsIcon size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /></div>
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['M', 'Mens'], ['W', 'Womens']].map(([g, label]) => (
              <button key={g} className={`fl-pill ${gender === g ? 'active' : ''}`} onClick={() => setGender(g)}>
                {label}
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
            {['foil', 'epee', 'sabre'].map(w => (
              <button key={w} className={`fl-pill ${weapon === w ? 'active' : ''}`} onClick={() => setWeapon(w)}>
                {w === 'epee' ? 'Épée' : w}
              </button>
            ))}
            {setAgeCategory && (
              <>
                <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
                <select
                  value={ageCategory || 'all'}
                  onChange={e => setAgeCategory(e.target.value)}
                  className="fl-pill"
                  style={{ fontFamily: 'inherit', cursor: 'pointer' }}
                  title="Age category — Junior counts senior+junior bouts, Cadet counts cadet+junior+senior, Veteran is isolated"
                >
                  {AGE_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

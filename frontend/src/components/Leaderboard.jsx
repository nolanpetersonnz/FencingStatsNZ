import React, { useState, useMemo } from 'react';
import { fmtRating, fmtRD } from '../utils/formatters.js';

export default function Leaderboard({ fencers, bouts, weapon, gender, onSelectFencer }) {
  const [minBouts, setMinBouts] = useState(1);
  const [club, setClub] = useState('all');
  const [sort, setSort] = useState('pool');

  const ranked = useMemo(() => {
    const list = Object.values(fencers)
      .map(f => {
        const w = f.byWeapon[weapon];
        if (!w) return null;
        const totalBouts = w.pool.bouts + w.de.bouts;
        const totalWins = w.pool.wins + w.de.wins;
        const totalLosses = w.pool.losses + w.de.losses;
        return { f, pool: w.pool, de: w.de, totalBouts, totalWins, totalLosses };
      })
      .filter(x => x && (x.totalBouts >= minBouts))
      .filter(x => club === 'all' || x.f.club === club)
      .filter(x => !gender || !x.f.genders || x.f.genders.size === 0 || x.f.genders.has(gender));

    list.sort((a, b) => {
      if (sort === 'pool') return b.pool.rating - a.pool.rating;
      if (sort === 'de') return b.de.rating - a.de.rating;
      if (sort === 'bouts') return b.totalBouts - a.totalBouts;
      if (sort === 'winrate') {
        const wa = a.totalBouts ? a.totalWins / a.totalBouts : 0;
        const wb = b.totalBouts ? b.totalWins / b.totalBouts : 0;
        return wb - wa;
      }
      return 0;
    });
    return list;
  }, [fencers, weapon, gender, minBouts, club, sort]);

  const clubs = useMemo(() => {
    const s = new Set();
    Object.values(fencers).forEach(f => { if (f.club) s.add(f.club); });
    return ['all', ...Array.from(s).sort()];
  }, [fencers]);

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);

  if (ranked.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
        No fencers found in {genderLabel} {weaponLabel} matching these filters.
      </div>
    );
  }

  const gridCols = '56px 1fr 180px 110px 110px 70px 90px';

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 18 }}>
        <div>
          <div className="fl-smallcaps">Standings · {genderLabel} {weaponLabel}</div>
          <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            The {ranked.length} ranked
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="fl-smallcaps" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Min bouts
            <input type="number" min={1} max={50} value={minBouts} onChange={e => setMinBouts(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 50, fontFamily: 'JetBrains Mono', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', padding: '2px 4px', outline: 'none', color: 'var(--ink)', fontSize: '0.9rem' }} />
          </label>
          <label className="fl-smallcaps" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Club
            <select value={club} onChange={e => setClub(e.target.value)}
              style={{ fontFamily: 'Newsreader, serif', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', padding: '2px 4px', outline: 'none', color: 'var(--ink)', fontSize: '0.9rem', textTransform: 'none', letterSpacing: 'normal' }}>
              {clubs.map(c => <option key={c} value={c}>{c === 'all' ? 'All clubs' : c}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <div>Rank</div>
          <div>Fencer</div>
          <div className="fl-hide-mobile">Club</div>
          <div className="fl-link" onClick={() => setSort('pool')} style={{ textAlign: 'right', color: sort === 'pool' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Pool {sort === 'pool' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
          <div className="fl-link" onClick={() => setSort('de')} style={{ textAlign: 'right', color: sort === 'de' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            DE {sort === 'de' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('bouts')} style={{ textAlign: 'right', color: sort === 'bouts' ? 'var(--ink)' : 'var(--ink-soft)' }}>Bouts</div>
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('winrate')} style={{ textAlign: 'right', color: sort === 'winrate' ? 'var(--ink)' : 'var(--ink-soft)' }}>W·L</div>
        </div>

        {ranked.map(({ f, pool, de, totalBouts, totalWins, totalLosses }, i) => (
          <div
            key={f.key}
            onClick={() => onSelectFencer(f.key)}
            className="fl-row-hover fl-link"
            style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--rule-soft)' }}
          >
            <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '1.05rem', fontWeight: 500 }}>
              {(i + 1).toString().padStart(2, '0')}
            </div>
            <div>
              <div className="fl-display" style={{ fontSize: '1.15rem', fontWeight: 600 }}>{f.name}</div>
            </div>
            <div className="fl-italic fl-hide-mobile" style={{ color: 'var(--ink-soft)', fontSize: '0.92rem' }}>{f.club}</div>
            <div style={{ textAlign: 'right', opacity: pool.bouts > 0 ? 1 : 0.35 }}>
              <div className="fl-mono" style={{ fontSize: sort === 'pool' ? '1.2rem' : '1.05rem', fontWeight: sort === 'pool' ? 600 : 500 }}>
                {pool.bouts > 0 ? fmtRating(pool.rating) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {pool.bouts > 0 ? `${fmtRD(pool.rd)} · ${pool.bouts}b` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', opacity: de.bouts > 0 ? 1 : 0.35 }}>
              <div className="fl-mono" style={{ fontSize: sort === 'de' ? '1.2rem' : '1.05rem', fontWeight: sort === 'de' ? 600 : 500 }}>
                {de.bouts > 0 ? fmtRating(de.rating) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {de.bouts > 0 ? `${fmtRD(de.rd)} · ${de.bouts}b` : ''}
              </div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{totalBouts}</div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: '0.92rem' }}>
              <span style={{ color: 'var(--green)' }}>{totalWins}</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span style={{ color: 'var(--red-light)' }}>{totalLosses}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

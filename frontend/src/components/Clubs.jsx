import React, { useState, useMemo } from 'react';
import { fmtRating } from '../utils/formatters.js';
import { strengthTier } from '../data/pipeline.js';

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

const WEAPON_KEYS = ['foil', 'epee', 'sabre'];
const MIN_RANKED_MEMBERS = 5;

export function aggregateClubs(fencers, gender) {
  const groups = {};
  for (const f of Object.values(fencers)) {
    const club = (f.club || '').trim();
    if (!club) continue;
    const totalBouts = Object.values(f.byWeapon).reduce((s, w) => s + w.pool.bouts + w.de.bouts, 0);
    if (totalBouts < 1) continue;
    if (gender && !f.genders?.has(gender)) continue;
    if (!groups[club]) groups[club] = [];
    groups[club].push(f);
  }
  return Object.entries(groups).map(([name, members]) => {
    const deRatings = [];
    const ratedByWeapon = { foil: 0, epee: 0, sabre: 0 };
    for (const f of members) {
      for (const w of WEAPON_KEYS) {
        const de = f.byWeapon[w]?.de;
        if (de && de.bouts > 0) {
          deRatings.push(de.rating);
          ratedByWeapon[w] += 1;
        }
      }
    }
    return {
      name,
      members,
      memberCount: members.length,
      ratedByWeapon,
      deMedian: median(deRatings),
      deTop: deRatings.length ? Math.max(...deRatings) : null,
    };
  });
}

export default function Clubs({ fencers, gender, onSelectClub }) {
  const [sort, setSort] = useState('de');
  const [dir, setDir] = useState('desc');

  const clubs = useMemo(() => aggregateClubs(fencers, gender), [fencers, gender]);

  const toggleSort = (key) => {
    if (sort === key) setDir(dir === 'desc' ? 'asc' : 'desc');
    else { setSort(key); setDir('desc'); }
  };

  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? -1 : 1;
    const list = [...clubs];
    list.sort((a, b) => {
      if (sort === 'members') {
        const d = (b.memberCount - a.memberCount) * sign;
        if (d !== 0) return d;
        return a.name.localeCompare(b.name);
      }
      // For DE sorts, push under-threshold clubs to the bottom regardless of direction
      const aSmall = a.memberCount < MIN_RANKED_MEMBERS;
      const bSmall = b.memberCount < MIN_RANKED_MEMBERS;
      if (aSmall !== bSmall) return aSmall ? 1 : -1;
      if (sort === 'top') {
        const av = a.deTop ?? -Infinity, bv = b.deTop ?? -Infinity;
        const d = (bv - av) * sign;
        if (d !== 0) return d;
        return a.name.localeCompare(b.name);
      }
      // 'de' (default)
      const av = a.deMedian ?? -Infinity, bv = b.deMedian ?? -Infinity;
      const d = (bv - av) * sign;
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [clubs, sort, dir]);

  const arrow = dir === 'desc' ? '↓' : '↑';
  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';

  if (clubs.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
        No clubs with {genderLabel} fencers on record.
      </div>
    );
  }

  const gridCols = '56px 1fr 110px 110px 110px 80px';

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 20 }}>
        <div className="fl-smallcaps">Clubs · ranked by {genderLabel} DE median (all weapons)</div>
        <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          {clubs.length} clubs on record
        </h2>
      </div>

      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 20, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <div>Rank</div>
          <div>Club</div>
          <div className="fl-link" onClick={() => toggleSort('members')} style={{ textAlign: 'right', color: sort === 'members' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Members {sort === 'members' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </div>
          <div className="fl-link" onClick={() => toggleSort('de')} style={{ textAlign: 'right', color: sort === 'de' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            DE median {sort === 'de' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </div>
          <div className="fl-link fl-hide-mobile" onClick={() => toggleSort('top')} style={{ textAlign: 'right', color: sort === 'top' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            DE top {sort === 'top' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </div>
          <div style={{ textAlign: 'right' }}>Strength</div>
        </div>

        {sorted.map((c, i) => {
          const tier = c.deMedian != null ? strengthTier(c.deMedian) : { label: '—', color: 'var(--ink-faint)' };
          return (
            <div
              key={c.name}
              onClick={() => onSelectClub(c.name)}
              className="fl-link fl-row-hover"
              style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 20, alignItems: 'center', padding: '16px 16px', borderBottom: '1px solid var(--rule-soft)' }}
            >
              <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '1.05rem', fontWeight: 500 }}>
                {(i + 1).toString().padStart(2, '0')}
              </div>
              <div>
                <div className="fl-display" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {c.name}
                  {c.memberCount < MIN_RANKED_MEMBERS && (
                    <span className="fl-italic" style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 10, letterSpacing: 0 }}>
                      under 5 fencers
                    </span>
                  )}
                </div>
                <div className="fl-italic" style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>
                  {c.ratedByWeapon.foil} foil · {c.ratedByWeapon.epee} épée · {c.ratedByWeapon.sabre} sabre
                </div>
              </div>
              <div className="fl-mono" style={{ textAlign: 'right', fontSize: '1.05rem', fontWeight: sort === 'members' ? 600 : 500 }}>
                {c.memberCount}
              </div>
              <div className="fl-mono" style={{ textAlign: 'right', fontSize: sort === 'de' ? '1.2rem' : '1.05rem', fontWeight: sort === 'de' ? 600 : 500, opacity: c.deMedian != null ? 1 : 0.35 }}>
                {c.deMedian != null ? fmtRating(c.deMedian) : '—'}
              </div>
              <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: '1.05rem', opacity: c.deTop != null ? 1 : 0.35 }}>
                {c.deTop != null ? fmtRating(c.deTop) : '—'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="fl-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: tier.color, letterSpacing: '-0.04em' }}>{tier.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { fmtRating, fmtDate } from '../utils/formatters.js';
import { strengthTier } from '../data/pipeline.js';

export default function Competitions({ competitions, weapon, gender, onSelectComp }) {
  const filtered = competitions.filter(c =>
    c.weapon === weapon
    && (!gender || !c.genders || c.genders.size === 0 || c.genders.has(gender))
  );
  const [sort, setSort] = useState('date');

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'strength') return b.median - a.median;
      if (sort === 'size') return b.size - a.size;
      return b.date.localeCompare(a.date);
    });
  }, [filtered, sort]);

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);

  if (filtered.length === 0) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
      No {genderLabel} {weaponLabel} competitions on record.
    </div>;
  }

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="fl-smallcaps">Field strength · {genderLabel} {weaponLabel}</div>
          <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            {filtered.length} competitions on record
          </h2>
        </div>
        <div className="fl-smallcaps" style={{ display: 'flex', gap: 18 }}>
          <span className="fl-link" style={{ color: sort === 'date' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('date')}>Date</span>
          <span className="fl-link" style={{ color: sort === 'strength' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('strength')}>Strength</span>
          <span className="fl-link" style={{ color: sort === 'size' ? 'var(--ink)' : 'var(--ink-soft)' }} onClick={() => setSort('size')}>Field size</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {sorted.map(c => {
          const tier = strengthTier(c.median);
          return (
            <div
              key={c.id}
              onClick={() => onSelectComp(c.id)}
              className="fl-link fl-row-hover"
              style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 110px 110px 80px', alignItems: 'center', padding: '18px 16px', borderBottom: '1px solid var(--rule-soft)' }}
            >
              <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{fmtDate(c.date)}</div>
              <div>
                <div className="fl-display" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{c.name}</div>
                <div className="fl-italic" style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>{c.bouts.length} bouts</div>
              </div>
              <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{c.size} fencers</div>
              <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem' }}>Median</div>
                <div className="fl-mono" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{fmtRating(c.median)}</div>
              </div>
              <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>
                <div className="fl-smallcaps" style={{ fontSize: '0.6rem' }}>Top</div>
                <div className="fl-mono" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{fmtRating(c.top)}</div>
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

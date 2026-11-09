import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { fmtRating, fmtDate } from '../utils/formatters.js';
import { strengthTier } from '../data/pipeline.js';
import { pressable } from '../utils/a11y.js';
import { competitionMatches } from '../utils/search.js';

// `query` lives in App, so a search survives opening a competition and coming
// back (v1.1, I-22).
export default function Competitions({ competitions, weapon, gender, onSelectComp, query = '', onQueryChange }) {
  const onRecord = competitions.filter(c =>
    c.weapon === weapon
    && (!gender || c.genders?.has(gender))
  );
  const searching = query.trim() !== '';
  const filtered = searching ? onRecord.filter((c) => competitionMatches(c, query)) : onRecord;
  const [sort, setSort] = useState('date');
  const [dir, setDir] = useState('desc');

  const toggleSort = (key) => {
    if (sort === key) {
      setDir(dir === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(key);
      setDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort === 'strength') {
        const d = (b.median - a.median) * sign;
        if (d !== 0) return d;
        return b.date.localeCompare(a.date) || a.name.localeCompare(b.name);
      }
      if (sort === 'size') {
        const d = (b.size - a.size) * sign;
        if (d !== 0) return d;
        return b.date.localeCompare(a.date) || a.name.localeCompare(b.name);
      }
      const d = b.date.localeCompare(a.date) * sign;
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, sort, dir]);

  const arrow = dir === 'desc' ? '↓' : '↑';

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);

  if (onRecord.length === 0) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
      No {genderLabel} {weaponLabel} competitions on record.
    </div>;
  }

  const gridCols = '110px 1fr 90px 110px 110px 80px';

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 20 }}>
        <div className="fl-smallcaps">Field strength · {genderLabel} {weaponLabel}</div>
        <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          {searching ? `${filtered.length} of ${onRecord.length} competitions` : `${onRecord.length} competitions on record`}
        </h2>
      </div>

      <div role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 440, marginBottom: 20 }}>
        <Search size={16} color="var(--ink-soft)" aria-hidden="true" />
        <input
          className="fl-input"
          aria-label="Search competitions"
          placeholder="Search competitions, e.g. Nationals 2025"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onQueryChange?.(''); }}
        />
        {searching && (
          <button type="button" className="fl-link fl-smallcaps" onClick={() => onQueryChange?.('')} style={{ whiteSpace: 'nowrap' }}>
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div role="status" className="fl-italic" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-soft)', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
          No {genderLabel} {weaponLabel} competitions match "{query.trim()}".
        </div>
      ) : (
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 20, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <button type="button" className="fl-link" onClick={() => toggleSort('date')} style={{ color: sort === 'date' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Date {sort === 'date' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </button>
          <div>Competition</div>
          <button type="button" className="fl-link fl-hide-mobile" onClick={() => toggleSort('size')} style={{ textAlign: 'right', color: sort === 'size' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Field size {sort === 'size' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </button>
          <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>Median</div>
          <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>Top</div>
          <button type="button" className="fl-link" onClick={() => toggleSort('strength')} style={{ textAlign: 'right', color: sort === 'strength' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Strength {sort === 'strength' && <span style={{ color: 'var(--ox)' }}>{arrow}</span>}
          </button>
        </div>

        {sorted.map(c => {
          const tier = strengthTier(c.median);
          return (
            <div
              key={c.id}
              {...pressable(() => onSelectComp(c.id))}
              className="fl-link fl-row-hover"
              style={{ display: 'grid', gridTemplateColumns: gridCols, columnGap: 20, alignItems: 'center', padding: '18px 16px', borderBottom: '1px solid var(--rule-soft)' }}
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
      )}
    </div>
  );
}

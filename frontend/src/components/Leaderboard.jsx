import React, { useState, useMemo } from 'react';
import { fmtRD, fmtRating, fmtConservativeRating, conservativeRating, fmtInterval } from '../utils/formatters.js';

export default function Leaderboard({ fencers, bouts, weapon, gender, ageCategory, settings, enrichment, onSelectFencer, onSelectClub }) {
  const [minBouts, setMinBouts] = useState(1);
  const [club, setClub] = useState('all');
  const [sort, setSort] = useState('de');
  const k = settings?.displayK ?? 1;
  const age = ageCategory || 'all';

  // For age-category leaderboards, require the fencer to have competed in
  // that category in the dataset's most recent year — keeps aged-out fencers
  // out of the Junior/Cadet rankings.
  const currentYear = useMemo(() => {
    let max = 0;
    for (const b of bouts) {
      const y = parseInt((b.date || '').slice(0, 4), 10);
      if (Number.isFinite(y) && y > max) max = y;
    }
    return max || new Date().getFullYear();
  }, [bouts]);

  const ranked = useMemo(() => {
    const list = Object.values(fencers)
      .map(f => {
        const w = f.byWeapon[weapon];
        if (!w) return null;
        // Pick which rating stream to display: 'all' = the canonical
        // everything-counts rating; otherwise the downward-inclusive
        // per-age-category stream populated in processBouts.
        const streams = age === 'all' ? { pool: w.pool, de: w.de } : w.byAge?.[age];
        if (!streams) return null;
        // Leaderboard membership: when a specific category is selected, only
        // include fencers who have natively competed in that category (an
        // event actually tagged Junior/Cadet/etc.). Without this, every adult
        // who fenced a senior event would slip into the Junior leaderboard via
        // downward inclusion of senior bouts into the junior stream.
        if (age !== 'all') {
          // DOB-based eligibility takes priority when we know the fencer's
          // birth year (from the Fencing Time XML registry). Junior is
          // U20 — born `currentYear - 20` or later (so 2006+ in the 2026
          // season). Cadet is U17 — born `currentYear - 17` or later
          // (2009+ in 2026). Veteran has no DOB cutoff defined in NZ; fall
          // back to event-tag inference for it.
          const dob = enrichment?.[f.key]?.dob_year;
          const native = f.nativeCategories?.[weapon];
          const years = f.nativeLatestYear?.[weapon] || {};

          if (age === 'junior' || age === 'cadet') {
            const cutoff = age === 'junior' ? currentYear - 20 : currentYear - 17;
            if (dob != null) {
              // DOB-based filter alone — being age-eligible is enough.
              // No "fenced this year" gate, since juniors who haven't
              // competed in the current year (Joel Ball-La Hood, Nolan
              // Peterson) are still current juniors by age and deserve
              // a place on the list. The minBouts slider handles the
              // very-stale case.
              if (dob < cutoff) return null;
            } else {
              // Fallback: rely on event tagging for fencers without DOB.
              // Junior view also includes cadet entrants (cadet => junior).
              const eligibleNative = age === 'junior' ? ['junior', 'cadet'] : ['cadet'];
              if (!native || !eligibleNative.some((c) => native.has(c))) return null;
              if (!eligibleNative.some((c) => years[c] === currentYear)) return null;
            }
          } else {
            // Veteran (and any future categories).
            if (!native || !native.has(age)) return null;
            if (years[age] !== currentYear) return null;
          }
        }
        const totalBouts = streams.pool.bouts + streams.de.bouts;
        const totalWins = streams.pool.wins + streams.de.wins;
        const totalLosses = streams.pool.losses + streams.de.losses;
        const poolDisplay = conservativeRating(streams.pool.rating, streams.pool.rd, k);
        const deDisplay = conservativeRating(streams.de.rating, streams.de.rd, k);
        return { f, pool: streams.pool, de: streams.de, poolDisplay, deDisplay, totalBouts, totalWins, totalLosses };
      })
      .filter(x => x && (x.totalBouts >= minBouts))
      .filter(x => club === 'all' || x.f.club === club)
      .filter(x => !gender || x.f.genders?.has(gender));

    list.sort((a, b) => {
      if (sort === 'pool') return b.poolDisplay - a.poolDisplay;
      if (sort === 'de') return b.deDisplay - a.deDisplay;
      if (sort === 'bouts') return b.totalBouts - a.totalBouts;
      if (sort === 'winrate') {
        const wa = a.totalBouts ? a.totalWins / a.totalBouts : 0;
        const wb = b.totalBouts ? b.totalWins / b.totalBouts : 0;
        return wb - wa;
      }
      return 0;
    });
    return list;
  }, [fencers, weapon, gender, age, minBouts, club, sort, k, currentYear, enrichment]);

  const clubs = useMemo(() => {
    const s = new Set();
    Object.values(fencers).forEach(f => { if (f.club) s.add(f.club); });
    return ['all', ...Array.from(s).sort()];
  }, [fencers]);

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);
  const ageLabel = age === 'all' ? '' : age.charAt(0).toUpperCase() + age.slice(1);

  if (ranked.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-soft)' }} className="fl-italic">
        No fencers found in {ageLabel ? `${ageLabel} ` : ''}{genderLabel} {weaponLabel} matching these filters.
      </div>
    );
  }

  const gridCols = '56px 1fr 180px 110px 110px 70px 90px';

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 18 }}>
        <div>
          <div className="fl-smallcaps">Standings · {ageLabel ? `${ageLabel} ` : ''}{genderLabel} {weaponLabel}</div>
          <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            The {ranked.length} ranked
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="fl-smallcaps" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'help' }}
            title="Hide fencers with fewer than this many bouts in the selected weapon. Set it to 1 to see everyone, including less-active fencers. If you have a rating but aren't listed, lower this or check the weapon/gender filters.">
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
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('bouts')} style={{ textAlign: 'right', color: sort === 'bouts' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Bouts {sort === 'bouts' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
          <div className="fl-link fl-hide-mobile" onClick={() => setSort('winrate')} style={{ textAlign: 'right', color: sort === 'winrate' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            W·L {sort === 'winrate' && <span style={{ color: 'var(--ox)' }}>↓</span>}
          </div>
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
            <div className="fl-italic fl-hide-mobile" style={{ color: 'var(--ink-soft)', fontSize: '0.92rem' }}>
              {f.club ? (
                <span
                  className="fl-link"
                  onClick={(e) => { e.stopPropagation(); onSelectClub?.(f.club); }}
                >
                  {f.club}
                </span>
              ) : ''}
            </div>
            <div style={{ textAlign: 'right', opacity: pool.bouts > 0 ? 1 : 0.35 }}
              title={pool.bouts > 0 ? `Likely range ${fmtInterval(pool.rating, pool.rd, k)}  ·  raw ${fmtRating(pool.rating)} ${fmtRD(pool.rd)}` : undefined}>
              <div className="fl-mono" style={{ fontSize: sort === 'pool' ? '1.2rem' : '1.05rem', fontWeight: sort === 'pool' ? 600 : 500 }}>
                {pool.bouts > 0 ? fmtConservativeRating(pool.rating, pool.rd, k) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {pool.bouts > 0 ? `${fmtRD(pool.rd)} · ${pool.bouts}b` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', opacity: de.bouts > 0 ? 1 : 0.35 }}
              title={de.bouts > 0 ? `Likely range ${fmtInterval(de.rating, de.rd, k)}  ·  raw ${fmtRating(de.rating)} ${fmtRD(de.rd)}` : undefined}>
              <div className="fl-mono" style={{ fontSize: sort === 'de' ? '1.2rem' : '1.05rem', fontWeight: sort === 'de' ? 600 : 500 }}>
                {de.bouts > 0 ? fmtConservativeRating(de.rating, de.rd, k) : '—'}
              </div>
              <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                {de.bouts > 0 ? `${fmtRD(de.rd)} · ${de.bouts}b` : ''}
              </div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: sort === 'bouts' ? 'var(--ink)' : 'var(--ink-soft)', fontSize: sort === 'bouts' ? '1.05rem' : '1rem', fontWeight: sort === 'bouts' ? 600 : 400 }}>
              {totalBouts}
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: sort === 'winrate' ? '1rem' : '0.92rem', fontWeight: sort === 'winrate' ? 600 : 400 }}>
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

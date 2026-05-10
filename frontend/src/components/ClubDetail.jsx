import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fmtRating, fmtRD, fmtConservativeRating, conservativeRating } from '../utils/formatters.js';
import { strengthTier } from '../data/pipeline.js';

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

const WEAPONS = [
  { key: 'foil', label: 'Foil' },
  { key: 'epee', label: 'Épée' },
  { key: 'sabre', label: 'Sabre' },
];

export default function ClubDetail({ clubName, fencers, settings, onBack, onSelectFencer }) {
  const k = settings?.displayK ?? 1;

  const members = useMemo(() => {
    return Object.values(fencers).filter(f => {
      if ((f.club || '').trim() !== clubName) return false;
      const totalBouts = Object.values(f.byWeapon).reduce((s, w) => s + w.pool.bouts + w.de.bouts, 0);
      return totalBouts > 0;
    });
  }, [fencers, clubName]);

  const byGender = useMemo(() => {
    const m = members.filter(f => f.genders?.has('M'));
    const w = members.filter(f => f.genders?.has('W'));
    const u = members.filter(f => !f.genders || f.genders.size === 0);
    return { M: m, W: w, U: u };
  }, [members]);

  const weaponStats = useMemo(() => {
    return WEAPONS.map(({ key, label }) => {
      const active = members.filter(f => {
        const bw = f.byWeapon[key];
        return bw && (bw.pool.bouts + bw.de.bouts) > 0;
      });
      const deRatings = active.map(f => f.byWeapon[key].de).filter(d => d.bouts > 0).map(d => d.rating);
      const poolRatings = active.map(f => f.byWeapon[key].pool).filter(p => p.bouts > 0).map(p => p.rating);
      return {
        key, label,
        count: active.length,
        deMedian: median(deRatings),
        deTop: deRatings.length ? Math.max(...deRatings) : null,
        poolMedian: median(poolRatings),
        poolTop: poolRatings.length ? Math.max(...poolRatings) : null,
      };
    });
  }, [members]);

  const genderWeaponStats = useMemo(() => {
    const out = {};
    for (const g of ['M', 'W']) {
      out[g] = WEAPONS.map(({ key, label }) => {
        const active = byGender[g].filter(f => {
          const bw = f.byWeapon[key];
          return bw && (bw.pool.bouts + bw.de.bouts) > 0;
        });
        const deRatings = active.map(f => f.byWeapon[key].de).filter(d => d.bouts > 0).map(d => d.rating);
        return {
          key, label,
          count: active.length,
          deMedian: median(deRatings),
          deTop: deRatings.length ? Math.max(...deRatings) : null,
        };
      });
    }
    return out;
  }, [byGender]);

  const memberRows = useMemo(() => {
    return members.map(f => {
      let bestDe = -Infinity, bestWeapon = null;
      for (const w of ['foil', 'epee', 'sabre']) {
        const bw = f.byWeapon[w];
        if (!bw) continue;
        const eff = conservativeRating(bw.de.rating, bw.de.rd, k);
        if (bw.de.bouts > 0 && eff > bestDe) { bestDe = eff; bestWeapon = w; }
      }
      const totalBouts = Object.values(f.byWeapon).reduce((s, w) => s + w.pool.bouts + w.de.bouts, 0);
      const totalWins = Object.values(f.byWeapon).reduce((s, w) => s + w.pool.wins + w.de.wins, 0);
      const totalLosses = Object.values(f.byWeapon).reduce((s, w) => s + w.pool.losses + w.de.losses, 0);
      const weapons = ['foil', 'epee', 'sabre'].filter(w => f.byWeapon[w] && (f.byWeapon[w].pool.bouts + f.byWeapon[w].de.bouts) > 0);
      return {
        f, bestDe: bestDe === -Infinity ? null : bestDe, bestWeapon,
        totalBouts, totalWins, totalLosses, weapons,
      };
    }).sort((a, b) => (b.bestDe ?? -Infinity) - (a.bestDe ?? -Infinity));
  }, [members, k]);

  if (members.length === 0) {
    return (
      <div className="fl-fade-in">
        <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={12} /> Back
        </div>
        <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">No active fencers found for {clubName}.</div>
      </div>
    );
  }

  const overallDeMedian = median(members.flatMap(f => ['foil', 'epee', 'sabre'].map(w => f.byWeapon[w]?.de).filter(d => d && d.bouts > 0).map(d => d.rating)));
  const tier = overallDeMedian != null ? strengthTier(overallDeMedian) : { label: '—', color: 'var(--ink-faint)' };

  return (
    <div className="fl-fade-in">
      <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={12} /> Back
      </div>

      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="fl-smallcaps">Club</div>
          <h2 className="fl-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 700, margin: '6px 0 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {clubName}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="fl-smallcaps">Strength</div>
            <div className="fl-display" style={{ fontSize: '3.4rem', fontWeight: 800, color: tier.color, letterSpacing: '-0.05em', lineHeight: 1 }}>{tier.label}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
        {[
          { l: 'Members', v: members.length.toString() },
          { l: 'Mens', v: byGender.M.length.toString() },
          { l: 'Womens', v: byGender.W.length.toString() },
          { l: 'Overall DE median', v: overallDeMedian != null ? fmtRating(overallDeMedian) : '—' },
        ].map((s, i, arr) => (
          <div key={i} style={{ padding: '18px 14px', borderRight: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div className="fl-smallcaps" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="fl-mono" style={{ fontSize: '1.4rem', fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>By weapon</div>
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 110px 110px', columnGap: 16, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <div>Weapon</div>
          <div style={{ textAlign: 'right' }}>Fencers</div>
          <div style={{ textAlign: 'right' }}>DE median</div>
          <div style={{ textAlign: 'right' }}>DE top</div>
          <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>Pool median</div>
          <div className="fl-hide-mobile" style={{ textAlign: 'right' }}>Pool top</div>
        </div>
        {weaponStats.map(s => (
          <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px 110px 110px', columnGap: 16, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)', opacity: s.count > 0 ? 1 : 0.4 }}>
            <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{s.label}</div>
            <div className="fl-mono" style={{ textAlign: 'right' }}>{s.count}</div>
            <div className="fl-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{s.deMedian != null ? fmtRating(s.deMedian) : '—'}</div>
            <div className="fl-mono" style={{ textAlign: 'right' }}>{s.deTop != null ? fmtRating(s.deTop) : '—'}</div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right' }}>{s.poolMedian != null ? fmtRating(s.poolMedian) : '—'}</div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right' }}>{s.poolTop != null ? fmtRating(s.poolTop) : '—'}</div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>By gender × weapon</div>
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 110px 110px', columnGap: 16, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule)' }} className="fl-smallcaps">
          <div>Group</div>
          <div>Weapon</div>
          <div style={{ textAlign: 'right' }}>Fencers</div>
          <div style={{ textAlign: 'right' }}>DE median</div>
          <div style={{ textAlign: 'right' }}>DE top</div>
        </div>
        {[['M', 'Mens'], ['W', 'Womens']].flatMap(([g, gLabel]) =>
          genderWeaponStats[g].map((s, i) => (
            <div key={`${g}-${s.key}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 110px 110px', columnGap: 16, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)', opacity: s.count > 0 ? 1 : 0.4 }}>
              <div className="fl-smallcaps" style={{ color: i === 0 ? 'var(--ink)' : 'var(--ink-faint)' }}>{i === 0 ? gLabel : ''}</div>
              <div className="fl-display" style={{ fontWeight: 500 }}>{s.label}</div>
              <div className="fl-mono" style={{ textAlign: 'right' }}>{s.count}</div>
              <div className="fl-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{s.deMedian != null ? fmtRating(s.deMedian) : '—'}</div>
              <div className="fl-mono" style={{ textAlign: 'right' }}>{s.deTop != null ? fmtRating(s.deTop) : '—'}</div>
            </div>
          ))
        )}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Members</div>
      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {memberRows.map(({ f, bestDe, bestWeapon, totalBouts, totalWins, totalLosses, weapons }) => (
          <div
            key={f.key}
            onClick={() => onSelectFencer(f.key)}
            className="fl-link fl-row-hover"
            style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 90px 110px', columnGap: 16, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }}
          >
            <div>
              <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{f.name}</div>
              <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>
                {weapons.map(w => w === 'epee' ? 'Épée' : w.charAt(0).toUpperCase() + w.slice(1)).join(' · ')}
                {f.genders?.size > 0 && <> · {Array.from(f.genders).join('/')}</>}
              </div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
              {bestWeapon ? (bestWeapon === 'epee' ? 'Épée' : bestWeapon) : '—'}
            </div>
            <div className="fl-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
              {bestDe != null ? Math.round(bestDe) : '—'}
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--green)' }}>{totalWins}</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span style={{ color: 'var(--red-light)' }}>{totalLosses}</span>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ textAlign: 'right', color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
              {totalBouts} bouts
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

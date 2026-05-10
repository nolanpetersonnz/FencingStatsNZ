import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fmtRating, fmtDelta, fmtDate } from '../utils/formatters.js';
import { strengthTier } from '../data/pipeline.js';

export default function CompetitionDetail({ compId, competitions, fencers, bouts, onBack, onSelectFencer, onSelectClub }) {
  const c = competitions.find(x => x.id === compId);

  const fencerStats = useMemo(() => {
    if (!c) return [];
    return c.fencerKeys.map(k => {
      const f = fencers[k];
      const myBouts = c.bouts.filter(b => b.keyA === k || b.keyB === k);
      const wins = myBouts.filter(b => b.winnerKey === k).length;
      const losses = myBouts.filter(b => b.winnerKey && b.winnerKey !== k).length;
      const poolBouts = myBouts.filter(b => b.type !== 'de');
      const deBouts = myBouts.filter(b => b.type === 'de');
      const streamRange = (list) => {
        if (list.length === 0) return { before: null, after: null };
        const before = list[0].keyA === k ? list[0].ratingABefore : list[0].ratingBBefore;
        const last = list[list.length - 1];
        const after = last.keyA === k ? last.ratingAAfter : last.ratingBAfter;
        return { before, after };
      };
      const pool = streamRange(poolBouts);
      const de = streamRange(deBouts);
      return {
        f, key: k, wins, losses, bouts: myBouts.length,
        poolBefore: pool.before, poolAfter: pool.after,
        poolDelta: pool.before !== null ? pool.after - pool.before : null,
        deBefore: de.before, deAfter: de.after,
        deDelta: de.before !== null ? de.after - de.before : null,
        sortKey: de.after !== null ? de.after : (pool.after !== null ? pool.after : 0),
      };
    }).sort((a, b) => b.sortKey - a.sortKey);
  }, [c, fencers]);

  if (!c) return <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">Competition not found.</div>;
  const tier = strengthTier(c.poolMedian);

  return (
    <div className="fl-fade-in">
      <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={12} /> Back
      </div>

      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="fl-smallcaps">{fmtDate(c.date)} · {c.weapon === 'epee' ? 'Épée' : c.weapon}</div>
          <h2 className="fl-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 700, margin: '6px 0 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {c.name}
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
          { l: 'Field', v: c.size.toString() },
          { l: 'Bouts', v: c.bouts.length.toString() },
          { l: 'Pool median', v: fmtRating(c.poolMedian) },
          { l: 'DE median', v: fmtRating(c.deMedian) },
          { l: 'Top (pool)', v: fmtRating(c.poolTop) },
        ].map((s, i, arr) => (
          <div key={i} style={{ padding: '18px 14px', borderRight: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div className="fl-smallcaps" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="fl-mono" style={{ fontSize: '1.4rem', fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Performance</div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 36 }}>
        {fencerStats.map((s, i) => (
          <div key={s.key} className="fl-link fl-row-hover" onClick={() => onSelectFencer(s.key)}
            style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px 1fr 1fr', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
            <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '0.95rem' }}>{(i + 1).toString().padStart(2, '0')}</div>
            <div>
              <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{s.f?.name || s.key}</div>
              <div className="fl-italic fl-hide-mobile" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>
                {s.f?.club ? (
                  <span
                    className="fl-link"
                    onClick={(e) => { e.stopPropagation(); onSelectClub?.(s.f.club); }}
                  >
                    {s.f.club}
                  </span>
                ) : ''}
              </div>
            </div>
            <div className="fl-mono fl-hide-mobile" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
              <span style={{ color: 'var(--green)' }}>{s.wins}</span>
              <span style={{ color: 'var(--ink-faint)' }}>·</span>
              <span style={{ color: 'var(--red-light)' }}>{s.losses}</span>
            </div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.82rem', paddingRight: 8 }}>
              {s.poolDelta !== null ? (
                <>
                  <span className="fl-smallcaps" style={{ fontSize: '0.58rem', color: 'var(--ink-faint)' }}>POOL </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(s.poolBefore)}</span>
                  <span style={{ color: 'var(--ink-faint)' }}>→</span>
                  <span style={{ fontWeight: 600, color: s.poolDelta > 0 ? 'var(--green)' : s.poolDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                    {fmtRating(s.poolAfter)} ({fmtDelta(s.poolDelta)})
                  </span>
                </>
              ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            </div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.82rem' }}>
              {s.deDelta !== null ? (
                <>
                  <span className="fl-smallcaps" style={{ fontSize: '0.58rem', color: 'var(--ox)' }}>DE </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(s.deBefore)}</span>
                  <span style={{ color: 'var(--ink-faint)' }}>→</span>
                  <span style={{ fontWeight: 600, color: s.deDelta > 0 ? 'var(--green)' : s.deDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                    {fmtRating(s.deAfter)} ({fmtDelta(s.deDelta)})
                  </span>
                </>
              ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="fl-smallcaps" style={{ marginBottom: 12 }}>All bouts</div>
      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {c.bouts.map(b => {
          const fa = fencers[b.keyA], fb = fencers[b.keyB];
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px 1fr', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
              <div className="fl-smallcaps" style={{ fontSize: '0.62rem', color: b.type === 'de' ? 'var(--ox)' : 'var(--ink-faint)' }}>{b.type === 'de' ? `DE ${b.deRound}` : 'Pool'}</div>
              <div className="fl-link fl-display" style={{ fontWeight: b.winnerKey === b.keyA ? 700 : 400, color: b.winnerKey === b.keyA ? 'var(--ink)' : 'var(--ink-soft)', textAlign: 'right', paddingRight: 16 }} onClick={() => onSelectFencer(b.keyA)}>
                {fa?.name || b.keyA}
              </div>
              <div className="fl-mono" style={{ textAlign: 'center', fontWeight: 600 }}>{b.scoreA}–{b.scoreB}</div>
              <div className="fl-link fl-display" style={{ fontWeight: b.winnerKey === b.keyB ? 700 : 400, color: b.winnerKey === b.keyB ? 'var(--ink)' : 'var(--ink-soft)', paddingLeft: 16 }} onClick={() => onSelectFencer(b.keyB)}>
                {fb?.name || b.keyB}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

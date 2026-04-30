import React, { useState, useMemo } from 'react';
import { toG2, gFn } from '../engine/glicko2.js';
import { fmtRating, fmtDateShort } from '../utils/formatters.js';
import FencerPicker from './FencerPicker.jsx';

export default function HeadToHead({ fencers, bouts, weapon: globalWeapon, gender, onSelectFencer }) {
  const [aKey, setAKey] = useState(null);
  const [bKey, setBKey] = useState(null);
  const [weapon, setWeapon] = useState(globalWeapon);

  const a = aKey && fencers[aKey];
  const b = bKey && fencers[bKey];

  const h2hBouts = useMemo(() => {
    if (!aKey || !bKey) return [];
    return bouts
      .filter(x => x.weapon === weapon && ((x.keyA === aKey && x.keyB === bKey) || (x.keyA === bKey && x.keyB === aKey)))
      .sort((x, y) => y.date.localeCompare(x.date));
  }, [aKey, bKey, weapon, bouts]);

  const aWins = h2hBouts.filter(x => x.winnerKey === aKey).length;
  const bWins = h2hBouts.filter(x => x.winnerKey === bKey).length;

  const prediction = useMemo(() => {
    if (!a || !b || !a.byWeapon[weapon] || !b.byWeapon[weapon]) return null;
    const wA = a.byWeapon[weapon], wB = b.byWeapon[weapon];
    const pred = (sa, sb) => {
      if (sa.bouts === 0 || sb.bouts === 0) return null;
      const { mu: muA, phi: phiA } = toG2(sa.rating, sa.rd);
      const { mu: muB, phi: phiB } = toG2(sb.rating, sb.rd);
      const combinedPhi = Math.sqrt(phiA * phiA + phiB * phiB);
      const probA = 1 / (1 + Math.exp(-gFn(combinedPhi) * (muA - muB)));
      return { probA, probB: 1 - probA };
    };
    return {
      pool: pred(wA.pool, wB.pool),
      de: pred(wA.de, wB.de),
    };
  }, [a, b, weapon]);

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 28 }}>
        <div className="fl-smallcaps">Comparison</div>
        <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          Head-to-<span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>Head</span>
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['foil', 'epee', 'sabre'].map(w => (
          <button key={w} className={`fl-pill ${weapon === w ? 'active' : ''}`} onClick={() => setWeapon(w)}>
            {w === 'epee' ? 'Épée' : w}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 0, alignItems: 'stretch', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 36 }}>
        <FencerPicker fencers={fencers} weapon={weapon} gender={gender} selected={aKey} onSelect={setAKey} placeholder="Select first fencer…" />
        <div style={{ borderLeft: '1px solid var(--rule-soft)', borderRight: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-deep)' }}>
          <span className="fl-display" style={{ fontSize: '1.6rem', fontStyle: 'italic', color: 'var(--ox)' }}>vs.</span>
        </div>
        <FencerPicker fencers={fencers} weapon={weapon} gender={gender} selected={bKey} onSelect={setBKey} placeholder="Select second fencer…" />
      </div>

      {a && b && (
        <>
          {prediction && (prediction.pool || prediction.de) && (
            <div style={{ marginBottom: 36 }}>
              <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Predicted outcome</div>
              {[
                { label: 'Pool', p: prediction.pool, accent: 'var(--ink)' },
                { label: 'Direct Elimination', p: prediction.de, accent: 'var(--ox)' },
              ].map(({ label, p, accent }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div className="fl-smallcaps" style={{ fontSize: '0.65rem', color: accent, marginBottom: 6 }}>{label}</div>
                  {p ? (
                    <div style={{ position: 'relative', height: 44, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.probA * 100}%`, background: accent }} />
                      <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--paper)', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1rem', mixBlendMode: 'difference' }}>
                        {(p.probA * 100).toFixed(1)}%
                      </div>
                      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1rem' }}>
                        {(p.probB * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    <div className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', padding: '8px 0' }}>
                      Not enough {label.toLowerCase()} bouts on record for both fencers.
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.78rem', color: 'var(--ink-soft)' }} className="fl-italic">
                <span>{a.name}</span>
                <span>{b.name}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 32, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
            <div style={{ padding: '24px', textAlign: 'center', borderRight: '1px solid var(--rule-soft)' }}>
              <div className="fl-smallcaps">Series</div>
              <div className="fl-display" style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8, color: aWins > bWins ? 'var(--ink)' : 'var(--ink-soft)' }}>{aWins}</div>
              <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 4 }}>wins for {a.name}</div>
            </div>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="fl-smallcaps">Series</div>
              <div className="fl-display" style={{ fontSize: '3rem', fontWeight: 700, marginTop: 8, color: bWins > aWins ? 'var(--ink)' : 'var(--ink-soft)' }}>{bWins}</div>
              <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 4 }}>wins for {b.name}</div>
            </div>
          </div>

          <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Bouts between · {h2hBouts.length}</div>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {h2hBouts.length === 0 && <div className="fl-italic" style={{ padding: 24, color: 'var(--ink-soft)' }}>These fencers have no recorded encounters in this weapon.</div>}
            {h2hBouts.map(x => {
              const aIsA = x.keyA === aKey;
              const aScore = aIsA ? x.scoreA : x.scoreB;
              const bScore = aIsA ? x.scoreB : x.scoreA;
              return (
                <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 1fr 80px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-row-hover">
                  <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{fmtDateShort(x.date)}</div>
                  <div className="fl-display" style={{ fontWeight: x.winnerKey === aKey ? 700 : 400, color: x.winnerKey === aKey ? 'var(--ink)' : 'var(--ink-soft)', textAlign: 'right', paddingRight: 14 }}>
                    {a.name}
                  </div>
                  <div className="fl-mono" style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.05rem' }}>{aScore}–{bScore}</div>
                  <div className="fl-display" style={{ fontWeight: x.winnerKey === bKey ? 700 : 400, color: x.winnerKey === bKey ? 'var(--ink)' : 'var(--ink-soft)', paddingLeft: 14 }}>
                    {b.name}
                  </div>
                  <div className="fl-smallcaps" style={{ fontSize: '0.62rem', textAlign: 'right' }}>
                    {x.type === 'de' ? `DE ${x.deRound}` : 'Pool'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

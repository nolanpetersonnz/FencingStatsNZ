import React from 'react';

// A row of small V/D boxes, one per bout, coloured by how hard the opponent
// was (pre-bout win probability). Shared by CompetitionDetail and FencerProfile.
// `bouts` is the pool or DE list from pipeline's fieldOverview().
export default function DifficultyStrip({ bouts }) {
  if (!bouts || bouts.length === 0) {
    return <span style={{ color: 'var(--ink-faint)' }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {bouts.map((p) => (
        <span
          key={p.id}
          title={`${p.scoreFor}–${p.scoreAgainst} vs. ${p.oppName} · ${p.tier.label} (${Math.round(p.pWin * 100)}% to win)`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 3, background: p.tier.color,
            color: '#fff', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1,
          }}
        >
          {p.won ? 'V' : 'D'}
        </span>
      ))}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { difficultyTier } from '../data/pipeline.js';
import { fmtSweepOdds } from '../utils/formatters.js';

// Layout geometry. Boxes are a fixed height so the SVG connectors can attach at
// each box's vertical centre; columns are spaced to leave room for the elbows.
const BOX_W = 178;
const BOX_H = 50;
const COL_GAP = 56;
const ROW_H = 66;
const TOP_PAD = 22;
const CHAMP_GAP = 40;
const CHAMP_W = 150;

// The reconstructed bracket, drawn. buildTableau() supplies each match's column,
// row and feeder ids; here we lay the boxes out by those coordinates and draw a
// connector for every feeder→match edge. Each edge is coloured by how hard the
// advancing fencer's win was (the difficulty tier of their pre-bout odds), so a
// path strung together from hard wins reads red. At rest the whole bracket is
// lit; hovering a fencer fades the rest and traces their line. The hardest-line
// ranking lives in the Toughest lines table, not here, so there's no competing
// "hardest" claim on the bracket.
export default function DeTableau({ tableau, onSelectFencer, lineByKey = {} }) {
  const [hover, setHover] = useState(null);

  const { matches, edges, nameByKey } = useMemo(() => {
    if (!tableau || tableau.rounds.length === 0) return { matches: [], edges: [], nameByKey: {} };
    const byId = new Map();
    const names = {};
    for (const r of tableau.rounds) for (const m of r.matches) {
      byId.set(m.id, m);
      names[m.top.key] = m.top.name;
      names[m.bottom.key] = m.bottom.name;
    }
    const es = [];
    for (const m of byId.values()) {
      for (const childId of [m.topChildId, m.bottomChildId]) {
        const c = childId != null ? byId.get(childId) : null;
        if (c) es.push({ child: c, parent: m, advancerKey: c.winnerKey, pWin: c.winnerPWin });
      }
    }
    return { matches: [...byId.values()], edges: es, nameByKey: names };
  }, [tableau]);

  if (!tableau || tableau.rounds.length === 0) return null;

  const highlightKey = hover || null;
  const x = (col) => col * (BOX_W + COL_GAP);
  const yTop = (row) => TOP_PAD + row * ROW_H;
  const yMid = (row) => yTop(row) + BOX_H / 2;
  const lastCol = tableau.cols - 1;
  const champ = tableau.champion;
  const finalMatch = tableau.rounds[tableau.rounds.length - 1]?.matches[0] || null;

  const totalW = tableau.cols * BOX_W + (tableau.cols - 1) * COL_GAP + (champ ? CHAMP_GAP + CHAMP_W : 0);
  const totalH = TOP_PAD + (tableau.rows - 1) * ROW_H + BOX_H + 6;

  const edgeColor = (pWin) => (pWin == null ? '#8A909A' : difficultyTier(pWin).color);
  // No hover: every edge at full strength. Hovering one fencer fades the rest.
  const edgeWidthOpacity = (on) => {
    if (!highlightKey) return { width: 2, opacity: 0.8 };
    return on ? { width: 3.5, opacity: 1 } : { width: 2, opacity: 0.16 };
  };

  const connector = (e, key) => {
    const x1 = x(e.child.col) + BOX_W, y1 = yMid(e.child.row);
    const x2 = x(e.parent.col), y2 = yMid(e.parent.row);
    const midX = (x1 + x2) / 2;
    const st = edgeWidthOpacity(highlightKey && e.advancerKey === highlightKey);
    return <path key={key} d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} fill="none" stroke={edgeColor(e.pWin)} strokeWidth={st.width} strokeOpacity={st.opacity} />;
  };

  const onPath = (e) => highlightKey && e.advancerKey === highlightKey;
  const capName = highlightKey ? (nameByKey[highlightKey] || highlightKey) : null;
  const capLine = highlightKey ? lineByKey[highlightKey] : null;

  // Keyboard focus on a fencer's name mirrors the mouse hover, so tabbing
  // through the bracket traces each line the same way hovering does.
  const Side = ({ s, m }) => {
    const won = m.winnerKey === s.key;
    const isHi = highlightKey && s.key === highlightKey;
    return (
      <div
        onMouseEnter={() => setHover(s.key)}
        onMouseLeave={() => setHover(null)}
        style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 9px', cursor: 'pointer' }}
      >
        <button
          type="button"
          className="fl-link fl-display"
          onClick={() => s.key && onSelectFencer?.(s.key)}
          onFocus={() => setHover(s.key)}
          onBlur={() => setHover(null)}
          style={{ fontWeight: won || isHi ? 700 : 400, color: won ? 'var(--ink)' : 'var(--ink-soft)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isHi ? 'underline' : 'none' }}
        >
          {s.name}
        </button>
        <span className="fl-mono" style={{ fontSize: '0.78rem', fontWeight: won ? 600 : 400, color: won ? 'var(--ink)' : 'var(--ink-faint)' }}>{s.score}</span>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div className="fl-italic" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
          {capLine ? (
            <>
              Tracing <span className="fl-display" style={{ fontWeight: 700 }}>{capName}</span>
              {' · '}line avg {Math.round(capLine.avgOpp)} · sweep odds {fmtSweepOdds(capLine.runProbability)}
            </>
          ) : (
            <span style={{ color: 'var(--ink-faint)' }}>Hover a fencer to trace their line.</span>
          )}
        </div>
        <div className="fl-smallcaps" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.55rem' }}>
          {[['Easy', '#2F6FB3'], ['Favoured', '#3F9D5A'], ['Even', '#8A909A'], ['Hard', '#D98324'], ['Very hard', '#C0453B']].map(([l, col]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 3, background: col, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }} className="fl-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH, minWidth: totalW }}>
          <svg width={totalW} height={totalH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {edges.filter((e) => !onPath(e)).map((e, i) => connector(e, `d${i}`))}
            {champ && finalMatch && (() => {
              const x1 = x(lastCol) + BOX_W, y1 = yMid(finalMatch.row);
              const st = edgeWidthOpacity(highlightKey && champ.key === highlightKey);
              return <path d={`M ${x1} ${y1} H ${x1 + CHAMP_GAP}`} fill="none" stroke={edgeColor(champ.pWin)} strokeWidth={st.width} strokeOpacity={st.opacity} />;
            })()}
            {edges.filter(onPath).map((e, i) => connector(e, `o${i}`))}
          </svg>

          {tableau.rounds.map((round) => (
            <div key={round.size} className="fl-smallcaps" style={{ position: 'absolute', left: x(round.matches[0].col), top: 0, width: BOX_W, fontSize: '0.58rem', textAlign: 'center' }}>
              {round.label}
            </div>
          ))}

          {matches.map((m) => {
            const hi = highlightKey && (m.top.key === highlightKey || m.bottom.key === highlightKey);
            const dim = highlightKey && !hi;
            return (
              <div key={m.id} style={{ position: 'absolute', left: x(m.col), top: yTop(m.row), width: BOX_W, height: BOX_H, display: 'flex', flexDirection: 'column', border: `1px solid ${hi ? 'var(--ink)' : 'var(--rule)'}`, background: 'var(--paper-deep)', opacity: dim ? 0.45 : 1 }}>
                <Side s={m.top} m={m} />
                <div style={{ borderTop: '1px solid var(--rule-soft)' }} />
                <Side s={m.bottom} m={m} />
              </div>
            );
          })}

          {champ && finalMatch && (
            <div
              onMouseEnter={() => setHover(champ.key)}
              onMouseLeave={() => setHover(null)}
              style={{ position: 'absolute', left: x(lastCol) + BOX_W + CHAMP_GAP, top: yTop(finalMatch.row), width: CHAMP_W, height: BOX_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${highlightKey === champ.key ? 'var(--ox)' : 'var(--rule)'}`, background: 'var(--paper-deep)', padding: '0 10px', opacity: highlightKey && highlightKey !== champ.key ? 0.45 : 1 }}
            >
              <div className="fl-smallcaps" style={{ fontSize: '0.5rem', color: 'var(--ox)', marginBottom: 2 }}>Champion</div>
              <button type="button" className="fl-link fl-display" style={{ fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }} onClick={() => onSelectFencer?.(champ.key)} onFocus={() => setHover(champ.key)} onBlur={() => setHover(null)}>{champ.name}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

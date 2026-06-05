import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fmtRating, fmtDelta, fmtDate, fmtSweepOdds } from '../utils/formatters.js';
import { strengthTier, deFinish, fieldOverview, buildTableau, lineDifficulty } from '../data/pipeline.js';
import DifficultyStrip from './DifficultyStrip.jsx';
import DeTableau from './DeTableau.jsx';

export default function CompetitionDetail({ compId, competitions, fencers, bouts, onBack, onSelectFencer, onSelectClub }) {
  const c = competitions.find(x => x.id === compId);

  const fencerStats = useMemo(() => {
    if (!c) return [];
    // The whole field's DE bouts: lineDifficulty traces each fencer's full path
    // to the title, which needs the bracket beyond their own elimination.
    const allDeBouts = c.bouts.filter(b => b.type === 'de');
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
      const poolDelta = pool.before !== null ? pool.after - pool.before : null;
      const deDelta = de.before !== null ? de.after - de.before : null;
      const totalDelta = (poolDelta ?? 0) + (deDelta ?? 0);
      return {
        f, key: k, wins, losses, bouts: myBouts.length,
        poolBefore: pool.before, poolAfter: pool.after, poolDelta,
        deBefore: de.before, deAfter: de.after, deDelta,
        totalDelta, finish: deFinish(deBouts, k),
        field: fieldOverview(myBouts, k, fencers),
        line: lineDifficulty(allDeBouts, k, fencers),
        hasAnyDelta: poolDelta !== null || deDelta !== null,
      };
    });
  }, [c, fencers]);

  // Field overview rows: most-over-expectation pool performance first.
  const fieldRows = useMemo(
    () => [...fencerStats].sort((a, b) => b.field.diff - a.field.diff),
    [fencerStats],
  );

  // The reconstructed DE bracket, and the DE entrants ranked by how strong a
  // gauntlet their line drew them.
  const tableau = useMemo(
    () => (c ? buildTableau(c.bouts.filter((b) => b.type === 'de'), fencers) : null),
    [c, fencers],
  );
  // Hardest line = toughest draw, by the line average: the mean rating across a
  // fencer's whole path to the title — the opponents they fenced plus the ones
  // they would have met past their elimination had they kept winning. Top 3.
  // Sweep odds (their odds of winning that whole path) rides along, not the sort key.
  const hardestLines = useMemo(
    () => fencerStats.filter((s) => s.line).sort((a, b) => b.line.avgOpp - a.line.avgOpp).slice(0, 3),
    [fencerStats],
  );
  // fencerKey → line difficulty, so the tableau can show a fencer's line stats
  // and light their hardest path.
  const lineByKey = useMemo(() => {
    const m = {};
    for (const s of fencerStats) if (s.line) m[s.key] = s.line;
    return m;
  }, [fencerStats]);

  const [sortMode, setSortMode] = useState('results');
  const [tab, setTab] = useState('results');
  const rows = useMemo(() => {
    const list = [...fencerStats];
    if (sortMode === 'results') {
      list.sort((a, b) => {
        const ra = a.finish ? a.finish.rank : Infinity;
        const rb = b.finish ? b.finish.rank : Infinity;
        if (ra !== rb) return ra - rb;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });
    } else {
      list.sort((a, b) => {
        if (a.hasAnyDelta !== b.hasAnyDelta) return a.hasAnyDelta ? -1 : 1;
        return b.totalDelta - a.totalDelta;
      });
    }
    return list;
  }, [fencerStats, sortMode]);

  if (!c) return <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">Competition not found.</div>;
  const tier = strengthTier(c.poolMedian);

  // Pool-only fencers (no DE bouts) placed below everyone who reached the
  // bracket. We can't rank them against each other, but the band is known:
  // (DE entrants + 1) … field size. Shown when the comp actually had a DE.
  const fieldSize = fencerStats.length;
  const deEntrants = fencerStats.filter((s) => s.finish).length;
  const poolOnlyLabel = deEntrants === 0
    ? '—'
    : (deEntrants + 1 >= fieldSize ? `${fieldSize}` : `${deEntrants + 1}–${fieldSize}`);

  // Tableau gets its own sub-tab; fall back to Results if this comp has no DE.
  const activeTab = tab === 'tableau' && !tableau ? 'results' : tab;

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {[['results', 'Results'], ...(tableau ? [['tableau', 'Tableau']] : []), ['bouts', 'Bouts']].map(([v, label]) => (
          <button key={v} className={`fl-pill ${activeTab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{label}</button>
        ))}
      </div>

      {activeTab === 'results' && (
      <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, gap: 16, flexWrap: 'wrap' }}>
        <div className="fl-smallcaps">Performance</div>
        <div className="fl-smallcaps" style={{ display: 'flex', gap: 16 }}>
          <span className="fl-link" onClick={() => setSortMode('elo')} style={{ color: sortMode === 'elo' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Elo change{sortMode === 'elo' && <span style={{ color: 'var(--ox)' }}> ↓</span>}
          </span>
          <span className="fl-link" onClick={() => setSortMode('results')} style={{ color: sortMode === 'results' ? 'var(--ink)' : 'var(--ink-soft)' }}>
            Results{sortMode === 'results' && <span style={{ color: 'var(--ox)' }}> ↓</span>}
          </span>
        </div>
      </div>
      <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 12 }}>
        {sortMode === 'elo'
          ? 'Ordered by total Elo change at this competition (pool + DE), highest first.'
          : 'Ordered by finish — champion first, then by the deepest DE round reached. Placement is reconstructed from the bracket; official placings aren’t in the data.'}
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 36 }}>
        {rows.map((s, i) => (
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
            {sortMode === 'results' ? (
              <div className="fl-mono" style={{ gridColumn: '4 / 6', textAlign: 'right', fontWeight: 600, fontSize: '1rem', color: s.finish?.rank === 1 ? 'var(--ox)' : s.finish ? 'var(--ink)' : 'var(--ink-faint)' }}>
                {s.finish ? s.finish.label : poolOnlyLabel}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, gap: 16, flexWrap: 'wrap' }}>
        <div className="fl-smallcaps">Field overview</div>
        <div className="fl-smallcaps" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.6rem' }}>
          {[['Easy', '#2F6FB3'], ['Favoured', '#3F9D5A'], ['Even', '#8A909A'], ['Hard', '#D98324'], ['Very hard', '#C0453B']].map(([l, col]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: col, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>
      <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 12 }}>
        Each box is a bout, coloured by how hard the opponent was (pre-bout win probability) — <strong>V</strong> won, <strong>D</strong> lost. EXP is expected pool wins from those odds; DIFF is actual minus expected. Hover a box for the score.
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 36 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(96px, 1.1fr) 2.2fr 1.7fr 48px 38px 52px', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-smallcaps">
          <div>#</div><div>Fencer</div><div>Pool</div><div>DE</div>
          <div style={{ textAlign: 'right' }}>Exp</div><div style={{ textAlign: 'right' }}>Act</div><div style={{ textAlign: 'right' }}>Diff</div>
        </div>
        {fieldRows.map((s, i) => (
          <div key={s.key} className="fl-link fl-row-hover" onClick={() => onSelectFencer(s.key)}
            style={{ display: 'grid', gridTemplateColumns: '34px minmax(96px, 1.1fr) 2.2fr 1.7fr 48px 38px 52px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
            <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '0.9rem' }}>{(i + 1).toString().padStart(2, '0')}</div>
            <div className="fl-display" style={{ fontWeight: 600, fontSize: '0.98rem', paddingRight: 8 }}>{s.f?.name || s.key}</div>
            <div><DifficultyStrip bouts={s.field.pool} /></div>
            <div><DifficultyStrip bouts={s.field.de} /></div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>{s.field.exp.toFixed(1)}</div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.9rem' }}>{s.field.act}</div>
            <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: 600, color: s.field.diff > 0.05 ? '#3F9D5A' : s.field.diff < -0.05 ? '#C0453B' : 'var(--ink-soft)' }}>
              {s.field.diff > 0 ? '+' : ''}{s.field.diff.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {activeTab === 'tableau' && tableau && (
        <>
          <div className="fl-smallcaps" style={{ marginBottom: 4 }}>Tableau</div>
          <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
            The direct-elimination bracket, rebuilt by following the winners forward. The data has round labels but no seeds, so the shape is right while the exact line order is inferred. The connecting lines are coloured by how hard each win was, and the winner of each bout is in bold.
          </div>
          <div style={{ marginBottom: 32 }}>
            <DeTableau tableau={tableau} onSelectFencer={onSelectFencer} lineByKey={lineByKey} />
          </div>

          {hardestLines.length > 0 && (
            <>
              <div className="fl-smallcaps" style={{ marginBottom: 4 }}>Toughest lines</div>
              <div className="fl-italic" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 12 }}>
                The hardest lines at this event, ranked by line average — the mean opponent rating across each fencer's whole path to the title, the opponents they fenced plus the ones waiting in the rounds past where they went out, had they kept winning. Sweep odds is a separate read: their chance, from the ratings before each bout, of winning that whole path and taking the title.
              </div>
              <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 36 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 78px 84px 80px', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-smallcaps">
                  <div>#</div><div>Fencer</div>
                  <div style={{ textAlign: 'right' }}>Finish</div>
                  <div style={{ textAlign: 'right' }}>Line avg <span style={{ color: 'var(--ox)' }}>↓</span></div>
                  <div style={{ textAlign: 'right' }}>Sweep odds</div>
                </div>
                {hardestLines.map((s, i) => (
                  <div key={s.key} className="fl-link fl-row-hover" onClick={() => onSelectFencer(s.key)}
                    style={{ display: 'grid', gridTemplateColumns: '34px 1fr 78px 84px 80px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--rule-soft)' }}>
                    <div className="fl-mono" style={{ color: 'var(--ink-faint)', fontSize: '0.9rem' }}>{(i + 1).toString().padStart(2, '0')}</div>
                    <div className="fl-display" style={{ fontWeight: 600, fontSize: '0.98rem', paddingRight: 8 }}>{s.f?.name || s.key}</div>
                    <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem', color: s.finish?.rank === 1 ? 'var(--ox)' : 'var(--ink)' }}>{s.finish ? s.finish.label : '—'}</div>
                    <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem' }} title={`peak opponent ${Math.round(s.line.peakOpp)}`}>{Math.round(s.line.avgOpp)}</div>
                    <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                      {fmtSweepOdds(s.line.runProbability)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'bouts' && (<>
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
      </>)}
    </div>
  );
}

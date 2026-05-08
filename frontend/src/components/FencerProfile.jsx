import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { fmtRating, fmtRD, fmtDelta, fmtDate, fmtDateShort, fmtConservativeRating, conservativeRating } from '../utils/formatters.js';

export default function FencerProfile({ fencerKey, fencers, bouts, competitions, onBack, onSelectFencer, onSelectComp, weapon: globalWeapon, settings }) {
  const f = fencers[fencerKey];
  const [weapon, setWeapon] = useState(() => {
    if (f && f.byWeapon[globalWeapon]) return globalWeapon;
    return f ? Object.keys(f.byWeapon)[0] : globalWeapon;
  });

  const k = settings?.displayK ?? 1;
  const w = f ? f.byWeapon[weapon] : null;
  const peakConservative = (stream) => {
    if (!stream || !stream.history?.length) return null;
    return Math.max(...stream.history.map(h => conservativeRating(h.rating, h.rd, k)));
  };
  const fencerBouts = useMemo(() => {
    if (!f) return [];
    return bouts.filter(b => (b.keyA === fencerKey || b.keyB === fencerKey) && b.weapon === weapon)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [bouts, fencerKey, weapon, f]);

  const chartData = useMemo(() => {
    if (!w) return [];
    const allDates = new Set();
    w.pool.history.forEach(h => allDates.add(h.date));
    w.de.history.forEach(h => allDates.add(h.date));
    const dates = Array.from(allDates).sort();
    const poolByDate = Object.fromEntries(w.pool.history.map(h => [h.date, conservativeRating(h.rating, h.rd, k)]));
    const deByDate = Object.fromEntries(w.de.history.map(h => [h.date, conservativeRating(h.rating, h.rd, k)]));
    let lastPool = null, lastDe = null;
    return dates.map((d, i) => {
      if (poolByDate[d] !== undefined) lastPool = poolByDate[d];
      if (deByDate[d] !== undefined) lastDe = deByDate[d];
      return { idx: i + 1, date: d, pool: lastPool, de: lastDe };
    });
  }, [w, k]);

  if (!f) return <div style={{ padding: 60, textAlign: 'center' }} className="fl-italic">Fencer not found.</div>;

  const poolWinRate = w && w.pool.bouts > 0 ? (w.pool.wins / w.pool.bouts * 100).toFixed(0) : '—';
  const deWinRate = w && w.de.bouts > 0 ? (w.de.wins / w.de.bouts * 100).toFixed(0) : '—';
  const totalBouts = w ? w.pool.bouts + w.de.bouts : 0;

  return (
    <div className="fl-fade-in">
      <div className="fl-link fl-smallcaps" onClick={onBack} style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={12} /> Back
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="fl-smallcaps">{f.club || 'Unaffiliated'}</div>
        <h2 className="fl-display" style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 700, letterSpacing: '-0.025em', margin: '6px 0 0', lineHeight: 1 }}>
          {f.name}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['foil', 'epee', 'sabre'].map(wp => {
          const has = f.byWeapon[wp];
          if (!has) return null;
          const totalB = has.pool.bouts + has.de.bouts;
          if (totalB === 0) return null;
          const primaryStream = has.pool.bouts >= has.de.bouts ? has.pool : has.de;
          return (
            <button key={wp} className={`fl-pill ${weapon === wp ? 'active' : ''}`} onClick={() => setWeapon(wp)}>
              {wp === 'epee' ? 'Épée' : wp} · {fmtConservativeRating(primaryStream.rating, primaryStream.rd, k)}
            </button>
          );
        })}
      </div>

      {!w || totalBouts === 0 ? (
        <div className="fl-italic" style={{ color: 'var(--ink-soft)', padding: '40px 0' }}>
          {f.name} has no {weapon === 'epee' ? 'épée' : weapon} bouts on record.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 32 }}>
            {[
              { label: 'Pool', stream: w.pool, winRate: poolWinRate, accent: 'var(--ink)' },
              { label: 'Direct Elimination', stream: w.de, winRate: deWinRate, accent: 'var(--ox)' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '24px 20px', borderRight: i === 0 ? '1px solid var(--rule)' : 'none', opacity: s.stream.bouts > 0 ? 1 : 0.4 }}>
                <div className="fl-smallcaps" style={{ marginBottom: 10, color: s.accent }}>{s.label}</div>
                <div className="fl-mono" style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1, color: s.accent }}>
                  {s.stream.bouts > 0 ? fmtConservativeRating(s.stream.rating, s.stream.rd, k) : '—'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: 6 }}>
                  {s.stream.bouts > 0
                    ? `${fmtRD(s.stream.rd)}  ·  raw ${fmtRating(s.stream.rating)}  ·  peak ${fmtRating(peakConservative(s.stream) ?? s.stream.peak)}`
                    : 'no bouts'}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.92rem', marginTop: 14 }}>
                  <span style={{ color: 'var(--green)' }}>{s.stream.wins}W</span>
                  <span style={{ color: 'var(--ink-faint)' }}> · </span>
                  <span style={{ color: 'var(--red-light)' }}>{s.stream.losses}L</span>
                  <span style={{ color: 'var(--ink-faint)' }}> · </span>
                  <span style={{ color: 'var(--ink-soft)' }}>{s.winRate}%</span>
                  <span style={{ color: 'var(--ink-faint)' }}> across {s.stream.bouts} bouts</span>
                </div>
              </div>
            ))}
          </div>

          {chartData.length >= 2 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div className="fl-smallcaps">Rating progression</div>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem', fontFamily: 'Newsreader, serif' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 2, background: 'var(--ink)' }} /> Pool
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 2, background: 'var(--ox)' }} /> DE
                  </span>
                </div>
              </div>
              <div style={{ height: 240, marginLeft: -10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <ReferenceLine y={1500} stroke="var(--rule)" strokeDasharray="3 3" />
                    <XAxis dataKey="idx" hide />
                    <YAxis tick={{ fill: 'var(--ink-faint)', fontFamily: 'JetBrains Mono', fontSize: 11 }} stroke="var(--rule)" domain={['dataMin - 30', 'dataMax + 30']} />
                    <Tooltip
                      contentStyle={{ background: 'var(--paper)', border: '1px solid var(--ink)', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                      labelFormatter={(v, d) => d[0]?.payload ? fmtDate(d[0].payload.date) : ''}
                    />
                    <Line type="monotone" dataKey="pool" stroke="var(--ink)" strokeWidth={2} dot={{ fill: 'var(--ink)', r: 2 }} activeDot={{ r: 5 }} connectNulls name="Pool" />
                    <Line type="monotone" dataKey="de" stroke="var(--ox)" strokeWidth={2} dot={{ fill: 'var(--ox)', r: 2 }} activeDot={{ r: 5 }} connectNulls name="DE" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="fl-smallcaps" style={{ marginBottom: 12 }}>Bouts on record · {fencerBouts.length}</div>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {fencerBouts.length === 0 && <div className="fl-italic" style={{ padding: 24, color: 'var(--ink-soft)' }}>No bouts recorded.</div>}
            {(() => {
              const groups = [];
              const seen = {};
              for (const b of fencerBouts) {
                const gKey = `${b.competition}|${b.date}`;
                if (!seen[gKey]) {
                  seen[gKey] = {
                    key: gKey, competition: b.competition, date: b.date,
                    weapon: b.weapon,
                    poolBefore: null, poolAfter: null,
                    deBefore: null, deAfter: null,
                    bouts: [],
                  };
                  groups.push(seen[gKey]);
                }
                const g = seen[gKey];
                const isA = b.keyA === fencerKey;
                const before = isA ? b.ratingABefore : b.ratingBBefore;
                const after = isA ? b.ratingAAfter : b.ratingBAfter;
                if (b.type === 'de') {
                  if (g.deBefore === null) g.deBefore = before;
                  g.deAfter = after;
                } else {
                  if (g.poolBefore === null) g.poolBefore = before;
                  g.poolAfter = after;
                }
                g.bouts.push(b);
              }
              return groups.map(g => {
                const wins = g.bouts.filter(b => b.winnerKey === fencerKey).length;
                const losses = g.bouts.filter(b => b.winnerKey && b.winnerKey !== fencerKey).length;
                const poolDelta = g.poolBefore !== null ? g.poolAfter - g.poolBefore : null;
                const deDelta = g.deBefore !== null ? g.deAfter - g.deBefore : null;
                return (
                  <div key={g.key}>
                    <div
                      onClick={() => onSelectComp(`${g.competition}|${g.weapon}|${g.date}`)}
                      className="fl-link fl-row-hover"
                      style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 1fr 1fr', alignItems: 'center', padding: '14px 14px 10px', background: 'var(--ink-fade)', borderBottom: '1px solid var(--rule)' }}
                    >
                      <div className="fl-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{fmtDateShort(g.date)}</div>
                      <div className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{g.competition}</div>
                      <div className="fl-mono" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--green)' }}>{wins}</span>
                        <span style={{ color: 'var(--ink-faint)' }}>·</span>
                        <span style={{ color: 'var(--red-light)' }}>{losses}</span>
                      </div>
                      <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem', paddingRight: 8 }}>
                        {poolDelta !== null ? (
                          <>
                            <span className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>POOL </span>
                            <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(g.poolBefore)}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> → </span>
                            <span style={{ fontWeight: 600, color: poolDelta > 0 ? 'var(--green)' : poolDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                              {fmtRating(g.poolAfter)} <span style={{ fontWeight: 400 }}>({fmtDelta(poolDelta)})</span>
                            </span>
                          </>
                        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </div>
                      <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                        {deDelta !== null ? (
                          <>
                            <span className="fl-smallcaps" style={{ fontSize: '0.6rem', color: 'var(--ox)' }}>DE </span>
                            <span style={{ color: 'var(--ink-soft)' }}>{fmtRating(g.deBefore)}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> → </span>
                            <span style={{ fontWeight: 600, color: deDelta > 0 ? 'var(--green)' : deDelta < 0 ? 'var(--red-light)' : 'var(--ink)' }}>
                              {fmtRating(g.deAfter)} <span style={{ fontWeight: 400 }}>({fmtDelta(deDelta)})</span>
                            </span>
                          </>
                        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                      </div>
                    </div>
                    {g.bouts.map(b => {
                      const isA = b.keyA === fencerKey;
                      const myScore = isA ? b.scoreA : b.scoreB;
                      const oppScore = isA ? b.scoreB : b.scoreA;
                      const oppKey = isA ? b.keyB : b.keyA;
                      const opp = fencers[oppKey];
                      const won = b.winnerKey === fencerKey;
                      const oppBefore = isA ? b.ratingBBefore : b.ratingABefore;
                      return (
                        <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 200px', alignItems: 'center', padding: '10px 14px 10px 28px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-row-hover">
                          <div className="fl-smallcaps" style={{ fontSize: '0.62rem', color: b.type === 'de' ? 'var(--ox)' : 'var(--ink-faint)' }}>
                            {b.type === 'de' ? `DE ${b.deRound}` : 'Pool'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span className={`fl-tag ${won ? 'solid-ink' : ''}`}>{won ? 'W' : 'L'}</span>
                            <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>vs.</span>
                            <span className="fl-link fl-display" style={{ fontWeight: 600 }} onClick={(e) => { e.stopPropagation(); onSelectFencer(oppKey); }}>
                              {opp ? opp.name : oppKey}
                            </span>
                            <span className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>({fmtRating(oppBefore)})</span>
                          </div>
                          <div className="fl-mono" style={{ textAlign: 'center', fontSize: '1rem' }}>
                            <span style={{ fontWeight: 600 }}>{myScore}</span>
                            <span style={{ color: 'var(--ink-faint)' }}> – </span>
                            <span>{oppScore}</span>
                          </div>
                          <div></div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import { predictiveAccuracy } from '../data/pipeline.js';

const pct = (v, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`);

// Does the rating model actually predict? Every rated bout is scored against the
// ratings as they stood before that competition (out-of-sample at the event
// level), so this is a backtest, not a fit. Numbers come straight from
// predictiveAccuracy(); this component is just the presentation.
export default function AccuracyDashboard({ bouts, settings }) {
  const [stream, setStream] = useState('all');     // all | pool | de
  const [establishedOnly, setEstablishedOnly] = useState(false);

  const data = useMemo(
    () => predictiveAccuracy(bouts, {
      stream: stream === 'all' ? null : stream,
      establishedOnly,
      initialRD: settings?.initialRD ?? 200,
    }),
    [bouts, stream, establishedOnly, settings],
  );

  const points = data.buckets
    .filter((b) => b.n > 0)
    .map((b) => ({ predicted: b.predicted, observed: b.observed, n: b.n, lo: b.lo, hi: b.hi }));

  const metrics = [
    { l: 'Bouts scored', v: data.n.toLocaleString(), sub: 'matching the filters' },
    { l: 'Accuracy', v: pct(data.accuracy, 1), sub: 'favourite wins' },
    { l: 'Brier', v: data.brier?.toFixed(3) ?? '—', sub: `vs ${data.baselineBrier.toFixed(2)} coin-flip` },
    { l: 'Log-loss', v: data.logLoss?.toFixed(3) ?? '—', sub: `vs ${data.baselineLogLoss.toFixed(2)} coin-flip` },
  ];

  return (
    <div>
      <div className="fl-italic" style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: '0.95rem' }}>
        Every bout is predicted from the two fencers' ratings <em>before</em> that competition, then compared with what actually happened. Because the model never sees the result it is being graded on, these numbers show how it does on bouts it has not already learned from.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {[['all', 'Both streams'], ['pool', 'Pool'], ['de', 'DE']].map(([v, label]) => (
          <button key={v} className={`fl-pill ${stream === v ? 'active' : ''}`} onClick={() => setStream(v)}>{label}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
        <button
          className={`fl-pill ${establishedOnly ? 'active' : ''}`}
          onClick={() => setEstablishedOnly((x) => !x)}
          title="Keep only bouts where both fencers already had some rating history, meaning their RD had dropped below the starting value. A brand-new fencer is hard to predict; the model does better once it has seen someone fence."
        >
          Established only
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 36 }}>
        {metrics.map((m, i, arr) => (
          <div key={m.l} style={{ padding: '18px 16px', borderRight: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div className="fl-smallcaps" style={{ marginBottom: 6 }}>{m.l}</div>
            <div className="fl-mono" style={{ fontSize: '1.7rem', fontWeight: 600, lineHeight: 1 }}>{m.v}</div>
            <div className="fl-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {data.n === 0 ? (
        <div className="fl-italic" style={{ color: 'var(--ink-soft)', padding: '24px 0' }}>No bouts match this filter.</div>
      ) : (
        <>
          <div className="fl-smallcaps" style={{ marginBottom: 4 }}>Calibration</div>
          <div className="fl-italic" style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: 16 }}>
            Each dot is a band of predictions. Left to right is how confident the model was; up and down is how often that call was right. A well-calibrated model sits on the dashed line, so when it says 70% the favourite wins about 70% of the time.
          </div>
          <div style={{ height: 320, marginLeft: -8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 8 }}>
                <ReferenceLine
                  segment={[{ x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
                  stroke="var(--ink-faint)" strokeDasharray="4 4" ifOverflow="extendDomain"
                />
                <XAxis
                  type="number" dataKey="predicted" domain={[0.5, 1]} ticks={[0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                  tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--ink-faint)', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  stroke="var(--rule)"
                  label={{ value: 'Model said', position: 'bottom', offset: 12, fill: 'var(--ink-soft)', fontFamily: 'Fraunces', fontSize: 12 }}
                />
                <YAxis
                  type="number" dataKey="observed" domain={[0.4, 1]} ticks={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                  tickFormatter={(v) => pct(v)} tick={{ fill: 'var(--ink-faint)', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  stroke="var(--rule)"
                  label={{ value: 'Actually won', angle: -90, position: 'insideLeft', offset: 18, fill: 'var(--ink-soft)', fontFamily: 'Fraunces', fontSize: 12 }}
                />
                <ZAxis type="number" dataKey="n" range={[40, 420]} />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: 'var(--paper)', border: '1px solid var(--ink)', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                  formatter={(value, name) => {
                    if (name === 'predicted') return [pct(value, 1), 'model said'];
                    if (name === 'observed') return [pct(value, 1), 'actually won'];
                    return [value, 'bouts']; // the ZAxis n — a count, not a percentage
                  }}
                  labelFormatter={() => ''}
                />
                <Scatter data={points} fill="var(--ox)" fillOpacity={0.75} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={{ borderTop: '1px solid var(--ink)', marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px', padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }} className="fl-smallcaps">
              <div>Confidence band</div>
              <div style={{ textAlign: 'right' }}>Bouts</div>
              <div style={{ textAlign: 'right' }}>Predicted</div>
              <div style={{ textAlign: 'right' }}>Observed</div>
            </div>
            {data.buckets.map((b) => (
              <div key={b.lo} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px', padding: '11px 14px', borderBottom: '1px solid var(--rule-soft)', opacity: b.n > 0 ? 1 : 0.4 }}>
                <div className="fl-mono" style={{ fontSize: '0.88rem' }}>{pct(b.lo)}–{pct(b.hi)}</div>
                <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.88rem', color: 'var(--ink-soft)' }}>{b.n}</div>
                <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.88rem', color: 'var(--ink-soft)' }}>{pct(b.predicted, 1)}</div>
                <div className="fl-mono" style={{ textAlign: 'right', fontSize: '0.88rem', fontWeight: 600 }}>{pct(b.observed, 1)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

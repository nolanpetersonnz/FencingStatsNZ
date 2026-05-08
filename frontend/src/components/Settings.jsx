import React, { useState } from 'react';
import { DEFAULT_SETTINGS } from '../constants.js';

export default function Settings({ settings, setSettings, onRecompute }) {
  const [draft, setDraft] = useState(settings);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const update = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <div className="fl-fade-in" style={{ maxWidth: 720 }}>
      <div className="fl-smallcaps">Tuning</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
        Rating <span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>parameters</span>
      </h2>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
        Adjust the rating parameters and bout-type weights. Saving will recompute every fencer's rating from the bout history.
      </p>

      <div style={{ marginTop: 28, borderTop: '1px solid var(--ink)' }}>
        {[
          { k: 'initialRating', l: 'Initial rating', help: 'Starting rating for unknown fencers (default 1500).' },
          { k: 'initialRD', l: 'Initial RD', help: 'Starting rating deviation. Lower = new fencers settle faster, but imported veterans also have less headroom (default 200).' },
          { k: 'initialVolatility', l: 'Initial volatility (σ)', help: 'How much rating fluctuates over time (default 0.06).', step: 0.01 },
          { k: 'tau', l: 'Volatility constraint (τ)', help: 'Lower = ratings change more smoothly. Default 0.5.', step: 0.1 },
          { k: 'upsetThreshold', l: 'Upset threshold', help: 'Rating gap (in points) for a result to count as an upset (default 75).' },
          { k: 'upsetMultiplier', l: 'Upset multiplier', help: 'Magnitude scaling applied when an upset occurs (default 1.25).', step: 0.05 },
          { k: 'displayK', l: 'Conservative display k', help: 'Displayed rating = rating − k × RD. Higher k punishes uncertainty more. Set to 0 to show raw rating (default 1).', step: 0.1 },
        ].map((row, i, arr) => (
          <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', alignItems: 'center', padding: '16px 4px', borderBottom: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none' }}>
            <div>
              <div className="fl-display" style={{ fontWeight: 600 }}>{row.l}</div>
              <div className="fl-italic" style={{ fontSize: '0.86rem', color: 'var(--ink-soft)', marginTop: 2 }}>{row.help}</div>
            </div>
            <input type="number" step={row.step || 1} value={draft[row.k]}
              onChange={e => update(row.k, parseFloat(e.target.value))}
              style={{ fontFamily: 'JetBrains Mono', textAlign: 'right', background: 'var(--paper-deep)', border: '1px solid var(--rule)', padding: '8px 10px', outline: 'none', fontSize: '0.95rem' }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button className="fl-btn" disabled={!dirty} onClick={() => { setSettings(draft); onRecompute(draft); }}>Save &amp; Recompute</button>
        <button className="fl-btn ghost" disabled={!dirty} onClick={() => setDraft(settings)}>Reset</button>
        <button className="fl-btn ghost" onClick={() => { setDraft(DEFAULT_SETTINGS); }}>Defaults</button>
      </div>
    </div>
  );
}

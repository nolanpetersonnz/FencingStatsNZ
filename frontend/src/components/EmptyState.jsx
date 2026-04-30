import React from 'react';

export default function EmptyState({ onLoadDemo, onGotoImport }) {
  return (
    <div className="fl-fade-in" style={{ maxWidth: 720, margin: '80px auto', padding: '0 32px', textAlign: 'center' }}>
      <div className="fl-ornament" style={{ fontSize: '1.6rem' }}>※ ※ ※</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 600, fontStyle: 'italic', marginTop: 18, marginBottom: 14 }}>
        The ledger awaits its first bouts.
      </h2>
      <p style={{ color: 'var(--ink-soft)', fontSize: '1.1rem', maxWidth: 520, margin: '0 auto 36px' }}>
        Bring in real results from FencingTimeLive (CSV), or load a sample roster of fictional New Zealand fencers to see how the ledger is kept.
      </p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="fl-btn" onClick={onGotoImport}>Import Results</button>
        <button className="fl-btn ghost" onClick={onLoadDemo}>Load Demo Data</button>
      </div>
    </div>
  );
}

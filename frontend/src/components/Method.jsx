import React, { useState } from 'react';
import AccuracyDashboard from './AccuracyDashboard.jsx';
import Faq from './Faq.jsx';

// The "Method" tab: the two explanatory surfaces (how good the model is, and
// the plain-language FAQ) behind a small sub-nav so they share one nav slot.
export default function Method({ bouts, settings }) {
  const [panel, setPanel] = useState('faq');

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 24 }}>
        <div className="fl-smallcaps">Behind the numbers</div>
        <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          {panel === 'faq' ? 'Frequently asked questions' : 'How accurate is the model?'}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[['faq', 'FAQ'], ['accuracy', 'Predictive accuracy']].map(([v, label]) => (
          <button key={v} className={`fl-pill ${panel === v ? 'active' : ''}`} onClick={() => setPanel(v)}>{label}</button>
        ))}
      </div>

      {panel === 'accuracy' ? <AccuracyDashboard bouts={bouts} settings={settings} /> : <Faq />}
    </div>
  );
}

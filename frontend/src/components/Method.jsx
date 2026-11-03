import React, { useRef, useState } from 'react';
import AccuracyDashboard from './AccuracyDashboard.jsx';
import Faq from './Faq.jsx';

// [value, tab label, page heading]
const PANELS = [
  ['accuracy', 'Predictive accuracy', 'How accurate is the model?'],
  ['faq', 'FAQ', 'Frequently asked questions'],
];

// The "Method" tab: the two explanatory surfaces (how good the model is, and
// the plain-language FAQ) behind a sub-nav so they share one nav slot.
// v1.1 #4 (I-04, I-05): it opens on the accuracy report, which six of the
// first seven study participants had to find behind the FAQ, and the switch
// is a full-width tab bar instead of two small pills.
export default function Method({ bouts, settings }) {
  const [panel, setPanel] = useState('accuracy');
  const tabRefs = useRef({});
  const heading = PANELS.find(([v]) => v === panel)[2];

  // Tabs pattern: Left/Right (and Home/End) move between tabs.
  const onTabKeyDown = (e) => {
    const i = PANELS.findIndex(([v]) => v === panel);
    const last = PANELS.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const v = PANELS[next][0];
    setPanel(v);
    tabRefs.current[v]?.focus();
  };

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 20 }}>
        <div className="fl-smallcaps">Behind the numbers</div>
        <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          {heading}
        </h2>
      </div>

      <div
        role="tablist"
        aria-label="Behind the numbers"
        className="fl-smallcaps"
        style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--rule)', marginBottom: 28, fontSize: '0.8rem' }}
      >
        {PANELS.map(([v, label]) => (
          <button
            key={v}
            ref={(el) => { tabRefs.current[v] = el; }}
            type="button"
            role="tab"
            id={`method-tab-${v}`}
            aria-selected={panel === v}
            aria-controls="method-panel"
            tabIndex={panel === v ? 0 : -1}
            className={`fl-tab ${panel === v ? 'active' : ''}`}
            onClick={() => setPanel(v)}
            onKeyDown={onTabKeyDown}
            style={{ padding: '10px 0', marginRight: 32 }}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="method-panel" aria-labelledby={`method-tab-${panel}`}>
        {panel === 'accuracy' ? <AccuracyDashboard bouts={bouts} settings={settings} /> : <Faq />}
      </div>
    </div>
  );
}

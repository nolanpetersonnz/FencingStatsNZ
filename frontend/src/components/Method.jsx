import React from 'react';
import AccuracyDashboard from './AccuracyDashboard.jsx';

// The "Method" tab: how good the model is. v1.1 #4 (I-04, I-05): six of the
// first seven study participants landed on the FAQ here and had to find the
// accuracy report, so the FAQ is now its own tab and Method opens straight on
// the report.
export default function Method({ bouts, settings }) {
  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 28 }}>
        <div className="fl-smallcaps">Behind the numbers</div>
        <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          How accurate is the model?
        </h2>
      </div>
      <AccuracyDashboard bouts={bouts} settings={settings} />
    </div>
  );
}

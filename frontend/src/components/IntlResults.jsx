import React, { useMemo } from 'react';
import { INTL_HEADING, INTL_NOTE, profileResults, statusText, ordinal } from '../data/intl.js';
import { loadIntl, todayIso } from '../data/intlStore.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';

// International results on a profile (PANELS.md 2.4, screen 3): each approved
// result, marked as counting toward the FeNZ ranking or not, with the reason.
// The prototype keeps results in this browser (data/intlStore.js), so for
// anyone without test data this renders nothing.
export default function IntlResults({ fencerKey, weapon }) {
  const rows = useMemo(() => {
    const st = loadIntl();
    return st ? profileResults(st.records, fencerKey, weapon, todayIso()) : [];
  }, [fencerKey, weapon]);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="fl-smallcaps" style={{ marginBottom: 4 }}>{INTL_HEADING}</div>
      <div className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 12 }}>{INTL_NOTE}</div>
      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {rows.map(({ rec, status }) => {
          const href = safeHttpUrl(rec.results_url);
          return (
            <div key={rec.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 16px', alignItems: 'baseline' }}>
              <div style={{ minWidth: 0 }}>
                <span className="fl-display" style={{ fontWeight: 600 }}>
                  {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">{rec.event}</a> : rec.event}
                </span>
                <span className="fl-mono" style={{ fontSize: '0.76rem', color: 'var(--ink-soft)', marginLeft: 10, whiteSpace: 'nowrap' }}>
                  {rec.country} · {fmtDate(rec.date)}
                </span>
              </div>
              <div className="fl-mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{ordinal(rec.placing)} of {rec.field_size}</div>
              <div className="fl-italic" style={{ gridColumn: '1 / -1', fontSize: '0.88rem', color: status.counts ? 'var(--ink)' : 'var(--ink-soft)' }}>
                {statusText(status, rec)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

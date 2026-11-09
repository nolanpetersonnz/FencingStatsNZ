import React, { useMemo } from 'react';
import { INTL_HEADING, INTL_NOTE, profileResults, verdictText, placingText, categoryText } from '../data/intl.js';
import { loadIntl, todayIso } from '../data/intlStore.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';

// International results on a profile (PANELS.md 2.4, screen 3): the list the
// International tab shows for this fencer, for the weapon in view. Results
// from FeNZ's results portal (`shipped`), plus approved ones the prototype
// keeps in this browser (data/intlStore.js), each with the tab's answers:
// "Ranking: Yes" or "No" where FeNZ's ranking handles it, else is the event on
// FeNZ's list, and the points. Renders nothing when there are none.
export default function IntlResults({ fencerKey, weapon, shipped = [] }) {
  const rows = useMemo(() => {
    const st = loadIntl();
    return profileResults([...shipped, ...(st?.records || [])], fencerKey, weapon, todayIso());
  }, [fencerKey, weapon, shipped]);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="fl-smallcaps" style={{ marginBottom: 4 }}>{INTL_HEADING}</div>
      <div className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 12 }}>{INTL_NOTE}</div>
      <div style={{ borderTop: '1px solid var(--ink)' }}>
        {rows.map(({ rec, verdict }) => {
          const href = safeHttpUrl(rec.results_url);
          const said = verdictText(verdict, rec);
          const meta = [rec.place || rec.country, fmtDate(rec.date), categoryText(rec)].filter(Boolean).join(' · ');
          return (
            <div key={rec.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 16px', alignItems: 'baseline' }}>
              <div style={{ minWidth: 0 }}>
                <span className="fl-display" style={{ fontWeight: 600 }}>
                  {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">{rec.event}</a> : rec.event}
                </span>
                <span className="fl-mono" style={{ fontSize: '0.76rem', color: 'var(--ink-soft)', marginLeft: 10 }}>{meta}</span>
              </div>
              <div className="fl-mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{placingText(rec)}</div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '4px 24px', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                {said.ranking ? (
                  <span>
                    <span className="fl-smallcaps" style={{ fontSize: '0.6rem', marginRight: 6 }}>Ranking</span>
                    <span className="fl-mono" style={{ fontWeight: said.ranking === 'Yes' ? 600 : 400 }}>{said.ranking}</span>
                  </span>
                ) : (
                  <>
                    <span>
                      <span className="fl-smallcaps" style={{ fontSize: '0.6rem', marginRight: 6 }}>FeNZ event</span>
                      <span style={{ color: verdict.fenz ? 'var(--ink)' : 'var(--ink-soft)' }}>{said.event}</span>
                    </span>
                    <span>
                      <span className="fl-smallcaps" style={{ fontSize: '0.6rem', marginRight: 6 }}>Points</span>
                      <span className="fl-mono" style={{ fontWeight: verdict.points ? 600 : 400 }}>{said.points}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

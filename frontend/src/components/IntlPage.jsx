import React, { useState } from 'react';
import {
  INTL_HEADING, INTL_PAGE_NOTE, LEVEL_LABELS, PLACEHOLDER_POLICY, initialLog,
  publicResults, waitingCount, describePlaces, statusText, ordinal,
} from '../data/intl.js';
import { loadIntl, saveIntl, clearIntl, todayIso } from '../data/intlStore.js';
import { testIntlState } from '../data/intlTestData.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';
import { AddResult } from './IntlPanel.jsx';

// The International tab: the public side of the international results
// prototype (PANELS.md 2.4: what counts, a fencer's submission, the results).
// Review, and the points table and event list, stay with FeNZ in /#admin.
// Records live in this browser only (data/intlStore.js).

const fresh = () => ({ records: [], policy: PLACEHOLDER_POLICY, log: initialLog(new Date().toISOString()) });
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : s);

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h3 className="fl-smallcaps" style={{ margin: '0 0 12px' }}>{title}</h3>
      {children}
    </section>
  );
}

export default function IntlPage({ fencers = {}, weapon, gender, onSelectFencer, onLoadDemo }) {
  const [state, setState] = useState(() => loadIntl() || fresh());
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const today = todayIso();
  const p = state.policy;

  const persist = (next) => { setState(next); saveIntl(next); };
  const tryIt = () => { persist(testIntlState(today)); onLoadDemo?.(); setNote(null); setError(null); };
  const removeTest = () => { clearIntl(); setState(fresh()); setNote(null); setError(null); };

  const genderLabel = gender === 'W' ? 'Womens' : 'Mens';
  const weaponLabel = weapon === 'epee' ? 'Épée' : weapon.charAt(0).toUpperCase() + weapon.slice(1);
  const rows = publicResults(state.records, { weapon, gender, today });
  const waiting = waitingCount(state.records, { weapon, gender });
  const muted = { color: 'var(--ink-soft)', fontSize: '0.92rem' };

  return (
    <div className="fl-fade-in">
      <div style={{ marginBottom: 28 }}>
        <div className="fl-smallcaps">{genderLabel} {weaponLabel}</div>
        <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
          {INTL_HEADING}
        </h2>
        <p className="fl-italic" style={{ ...muted, fontSize: '1rem', margin: '8px 0 0', maxWidth: 720 }}>{INTL_PAGE_NOTE}</p>
        <div style={{ marginTop: 14, padding: '10px 12px', border: '1px solid var(--rule)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', maxWidth: 720 }}>
          <span className="fl-italic" style={{ ...muted, flex: '1 1 320px' }}>
            Prototype: placeholder points and event list; results stay in this browser.
            {state.test_data ? ' Sample results loaded.' : ''}
          </span>
          {state.test_data
            ? <button type="button" className="fl-pill" onClick={removeTest}>Remove them</button>
            : <button type="button" className="fl-pill" onClick={tryIt} title="Uses the site's demo fencers in this tab until you reload">Try it with sample results</button>}
        </div>
      </div>

      <Section title="What counts">
        <p style={{ ...muted, margin: '0 0 12px', maxWidth: 720 }}>
          Results from events on FeNZ's list count if the field is big enough. FIE and Australian events already
          count through FeNZ's own ranking.
        </p>
        <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', marginBottom: 12, maxWidth: 720 }}>
          <div className="fl-smallcaps" style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.5fr) minmax(0, 1fr)', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--rule)', fontSize: '0.62rem' }}>
            <span>Country</span><span>Event</span><span>Level</span>
          </div>
          {p.list.length === 0 && <div className="fl-italic" style={{ ...muted, padding: '12px 0' }}>No events on the list yet.</div>}
          {p.list.map((e) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.5fr) minmax(0, 1fr)', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--rule-soft)', alignItems: 'baseline' }}>
              <span className="fl-mono" style={{ fontSize: '0.85rem' }}>{e.country}</span>
              <span className="fl-display" style={{ fontWeight: 600 }}>{e.event}</span>
              <span className="fl-italic" style={muted}>{LEVEL_LABELS[e.level]}</span>
            </div>
          ))}
        </div>
        <p style={{ ...muted, margin: 0, maxWidth: 720 }}>
          Most points: {p.max_points.national_championship} at a national championship, {p.max_points.national_circuit} at a
          national circuit event. Share of those by place: {describePlaces(p.placing_shares).join(', ')}. Fields under {p.min_field} fencers
          don't count, and a result counts for {p.window_months} months after the event. Points table v{p.version}.
        </p>
      </Section>

      <Section title="Submit a result">
        <AddResult
          key={state.records.length}
          fencers={fencers}
          today={today}
          defaults={{ weapon, gender: gender === 'W' ? 'womens' : 'mens' }}
          intro="Copy each field from the official results page. Sign-in is paused, so pick the fencer."
          submitLabel="Send to FeNZ"
          fail={(msg) => { setNote(null); setError(sentence(msg)); }}
          onAdd={(rec) => {
            persist({ ...state, records: [rec, ...state.records] });
            setError(null);
            setNote('Sent. FeNZ will check it before it appears.');
          }}
        />
        {(note || error) && (
          <div role="status" className="fl-italic" style={{ marginTop: 12, padding: 10, border: `1px solid ${error ? 'var(--red-light)' : 'var(--rule)'}`, color: error ? 'var(--red-light)' : 'var(--ink)', fontSize: '0.92rem', maxWidth: 720 }}>
            {error || note}
          </div>
        )}
      </Section>

      <Section title="Results">
        <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', maxWidth: 720 }}>
          {rows.length === 0 && (
            <div className="fl-italic" style={{ ...muted, padding: '20px 0' }}>No {genderLabel} {weaponLabel} results yet.</div>
          )}
          {rows.map(({ rec, status }) => {
            const href = safeHttpUrl(rec.results_url);
            const known = Boolean(fencers[rec.fencer]);
            return (
              <div key={rec.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 16px', alignItems: 'baseline' }}>
                <div style={{ minWidth: 0 }}>
                  {known
                    ? <button type="button" className="fl-link fl-display" style={{ fontWeight: 600 }} onClick={() => onSelectFencer?.(rec.fencer)}>{rec.fencer_name}</button>
                    : <span className="fl-display" style={{ fontWeight: 600 }}>{rec.fencer_name}</span>}
                </div>
                <div className="fl-mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{ordinal(rec.placing)} of {rec.field_size}</div>
                <div style={{ gridColumn: '1 / -1', fontSize: '0.92rem' }}>
                  {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">{rec.event}</a> : rec.event}
                  <span className="fl-mono" style={{ fontSize: '0.76rem', color: 'var(--ink-soft)', marginLeft: 10, whiteSpace: 'nowrap' }}>{rec.country} · {fmtDate(rec.date)}</span>
                </div>
                <div className="fl-italic" style={{ gridColumn: '1 / -1', fontSize: '0.88rem', color: status.counts ? 'var(--ink)' : 'var(--ink-soft)' }}>
                  {statusText(status, rec)}
                </div>
              </div>
            );
          })}
        </div>
        {waiting > 0 && (
          <p className="fl-italic" style={{ ...muted, margin: '10px 0 0' }}>{waiting} waiting to be checked.</p>
        )}
      </Section>
    </div>
  );
}

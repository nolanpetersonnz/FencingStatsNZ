import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  INTL_HEADING, INTL_PAGE_NOTE, INTL_SOURCE_NOTE, INTL_PROTOTYPE_NOTE, PLACEHOLDER_POLICY, initialLog,
  fencerResults, verdictText, placingText, categoryText,
} from '../data/intl.js';
import { loadIntl, saveIntl, clearIntl, todayIso } from '../data/intlStore.js';
import { testIntlState } from '../data/intlTestData.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';
import { pressable } from '../utils/a11y.js';

// The International tab (prototype of PANELS.md section 2), built as Nolan
// asked on 9 Nov: search a fencer, see their international results, each
// marked whether FeNZ counts the event and how many points it earns, then
// submit an event, which stays behind FeNZ's admin sign-in. Review, the
// points table and the event list stay with FeNZ in /#admin.
//
// Two sources: `shipped`, NZ fencers' placings at the FeNZ results portal's
// International competitions (FIE and Australian events, from
// data/intl_results.json), and the prototype's own records, kept in this
// browser only (data/intlStore.js).

const fresh = () => ({ records: [], policy: PLACEHOLDER_POLICY, log: initialLog(new Date().toISOString()) });
const WEAPON_LABEL = { foil: 'Foil', epee: 'Épée', sabre: 'Sabre' };

// The submit step stays behind the admin sign-in, as before: it opens
// /#admin, International, with the form ready for this fencer.
function submitFor(key) {
  try {
    sessionStorage.setItem('fl_admin_return', 'intl');
    sessionStorage.setItem('fl_intl_submit_for', key);
  } catch { /* the admin page opens on its first section instead */ }
  window.location.hash = 'admin';
}

export default function IntlPage({ fencers = {}, shipped = [], picked, onPick, onSelectFencer, onLoadDemo }) {
  const [state, setState] = useState(() => loadIntl() || fresh());
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = todayIso();

  // Close the suggestions on a click elsewhere, as the header search does.
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const persist = (next) => { setState(next); saveIntl(next); };
  const tryIt = () => { persist(testIntlState(today)); onLoadDemo?.(); };
  const removeTest = () => { clearIntl(); setState(fresh()); onPick?.(null); };

  const records = useMemo(() => [...shipped, ...state.records], [shipped, state.records]);
  // Fencers on the site, plus anyone with an international result but no
  // NZ bouts yet (an overseas-based fencer, say).
  const people = useMemo(() => {
    const m = new Map(Object.values(fencers).map((f) => [f.key, { key: f.key, name: f.name, club: f.club || '' }]));
    for (const r of records) if (!m.has(r.fencer)) m.set(r.fencer, { key: r.fencer, name: r.fencer_name, club: '' });
    return [...m.values()];
  }, [fencers, records]);
  // Suggestions as in the header search: the name or club contains what's
  // typed, eight at most; anyone with an international result comes first.
  const hasResults = useMemo(
    () => new Set(records.filter((r) => r.status === 'approved').map((r) => r.fencer)),
    [records],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((f) => f.name.toLowerCase().includes(q) || f.club.toLowerCase().includes(q))
      .sort((a, b) => (hasResults.has(b.key) - hasResults.has(a.key)) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [people, query, hasResults]);

  const person = picked ? (people.find((f) => f.key === picked) || { key: picked, name: picked, club: '' }) : null;
  const mine = picked ? fencerResults(records, picked, today) : null;
  const pick = (key) => { onPick?.(key); setQuery(''); setOpen(false); };
  const muted = { color: 'var(--ink-soft)', fontSize: '0.92rem' };

  return (
    <div className="fl-fade-in" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 className="fl-display" style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{INTL_HEADING}</h2>
        <p className="fl-italic" style={{ ...muted, fontSize: '1rem', margin: '8px 0 0' }}>{INTL_PAGE_NOTE}</p>
        <div style={{ marginTop: 14, padding: '10px 12px', border: '1px solid var(--rule)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="fl-italic" style={{ ...muted, flex: '1 1 320px' }}>
            {shipped.length ? INTL_SOURCE_NOTE : INTL_PROTOTYPE_NOTE}
            {state.test_data ? ' Sample results loaded.' : ''}
          </span>
          {state.test_data
            ? <button type="button" className="fl-pill" onClick={removeTest}>Remove them</button>
            : <button type="button" className="fl-pill" onClick={tryIt} title="Uses the site's demo fencers in this tab until you reload">Try it with sample results</button>}
        </div>
      </div>

      {/* 1. Search fencer: type a name, suggestions drop down, as in the header */}
      <div ref={ref} role="search" style={{ position: 'relative', maxWidth: 440, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} color="var(--ink-soft)" aria-hidden="true" />
          <input
            className="fl-input"
            aria-label="Search fencers"
            placeholder="Search fencers…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && matches.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--paper)', border: '1px solid var(--rule)', marginTop: 8, zIndex: 50, boxShadow: '0 8px 24px rgba(17,20,24,0.10)' }}>
            {matches.map((f) => (
              <div
                key={f.key}
                className="fl-link fl-row-hover"
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--rule-soft)' }}
                {...pressable(() => pick(f.key))}
              >
                <div className="fl-display" style={{ fontWeight: 600, fontSize: '1rem' }}>{f.name}</div>
                {f.club && <div className="fl-italic" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{f.club}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {person && (
        <>
          {/* 2. Their international results */}
          <div style={{ marginBottom: 12 }}>
            <div className="fl-smallcaps">International results</div>
            <h3 className="fl-display" style={{ fontSize: '1.6rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
              {fencers[person.key]
                ? <button type="button" className="fl-link" onClick={() => onSelectFencer?.(person.key)}>{person.name}</button>
                : person.name}
            </h3>
            {person.club && <div className="fl-italic" style={muted}>{person.club}</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
            {mine.results.length === 0 && (
              <div className="fl-italic" style={{ ...muted, padding: '20px 0' }}>No international results for {person.name} yet.</div>
            )}
            {mine.results.map(({ rec, verdict }) => {
              const href = safeHttpUrl(rec.results_url);
              const said = verdictText(verdict, rec);
              return (
                <div key={rec.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule-soft)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 16px', alignItems: 'baseline' }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="fl-display" style={{ fontWeight: 600 }}>
                      {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">{rec.event}</a> : rec.event}
                    </span>
                  </div>
                  <div className="fl-mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{placingText(rec)}</div>
                  <div className="fl-mono" style={{ gridColumn: '1 / -1', fontSize: '0.76rem', color: 'var(--ink-soft)' }}>
                    {[rec.place || rec.country, fmtDate(rec.date), WEAPON_LABEL[rec.weapon], categoryText(rec)].filter(Boolean).join(' · ')}
                  </div>
                  {/* 3. Does it count: "Ranking: Yes" or "No" where FeNZ's ranking
                      handles it (FIE, Australian), else FeNZ's list and the points */}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '4px 24px', flexWrap: 'wrap', marginTop: 4, fontSize: '0.9rem' }}>
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
          {mine.waiting > 0 && (
            <p className="fl-italic" style={{ ...muted, margin: '10px 0 0' }}>
              {mine.results.length > 0 ? `${mine.waiting} more waiting to be checked.` : `${mine.waiting} waiting to be checked.`}
            </p>
          )}

          {/* 4. Submit event: behind FeNZ's sign-in */}
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="fl-pill" onClick={() => submitFor(person.key)}>Submit an event for {person.name}</button>
            <span className="fl-italic" style={muted}>FeNZ sign-in needed while fencer sign-in is paused.</span>
          </div>
        </>
      )}
    </div>
  );
}

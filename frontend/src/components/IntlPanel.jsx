import React, { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES, CATEGORY_LABELS, GENDERS, LEVELS, LEVEL_LABELS, RESIDENCES, WEAPONS,
  PLACEHOLDER_POLICY, initialLog, validateEventEntry, newRecord, reviewResult, reviewEvent, changePolicy,
  adminStatusText, softCapQualifier, SOFT_CAP_LABELS, ordinal,
} from '../data/intl.js';
import { nameKey } from '../data/pipeline.js';
import { loadIntl, saveIntl, clearIntl, todayIso } from '../data/intlStore.js';
import { testIntlState } from '../data/intlTestData.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';

// /#admin, International: the prototype of the international results panel
// (PANELS.md section 2). Entering results (an event once, then each fencer
// who went), the review queue, the points table and the event list. Records
// stay in this browser (data/intlStore.js), and the table and list are
// placeholders until FeNZ sets them. Results from FeNZ's results portal
// (data/intl_results.json) never come through here: they are FeNZ's own.

const WEAPON_LABEL = { foil: 'Foil', epee: 'Épée', sabre: 'Sabre' };
const GENDER_LABEL = { mens: 'Men', womens: 'Women' };
const input = { width: '100%', padding: '8px 10px', fontSize: '0.95rem', fontFamily: 'Newsreader, serif', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: '0.72rem', marginBottom: 4 };
const box = { borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' };
const tag = { fontSize: '0.66rem', padding: '2px 6px', border: '1px solid var(--rule)', color: 'var(--ink-soft)' };
const soft = { color: 'var(--ink-soft)' };

const fresh = () => ({ records: [], policy: PLACEHOLDER_POLICY, log: initialLog(new Date().toISOString()) });
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function IntlPanel({ fencers = {}, onLoadDemo, setErr }) {
  const [state, setState] = useState(() => loadIntl() || fresh());
  // The International tab's "Submit an event for <fencer>" lands here with
  // the form ready for that fencer. Read once; cleared after mount.
  const [submitFor] = useState(() => {
    try { return sessionStorage.getItem('fl_intl_submit_for'); } catch { return null; }
  });
  useEffect(() => {
    try { sessionStorage.removeItem('fl_intl_submit_for'); } catch { /* storage blocked */ }
  }, []);
  const [tab, setTab] = useState(submitFor ? 'add' : 'queue'); // queue | add | table | list | log
  const [who, setWho] = useState('');       // reviewer or author, for the log
  const [clause, setClause] = useState(''); // policy clause behind a table or list change
  const [note, setNote] = useState(null);   // transient confirmation line
  const [confirmClear, setConfirmClear] = useState(false);
  const today = todayIso();

  const persist = (next, message) => {
    setState(next);
    if (!saveIntl(next)) setErr?.('This browser would not store the records (private mode?). They last until the page reloads.');
    setNote(message || null);
  };
  const fail = (msg) => { setNote(null); setErr?.(msg); };

  const loadTest = () => {
    persist(testIntlState(today));
    try { sessionStorage.setItem('fl_admin_return', 'intl'); } catch { /* stays on Edits */ }
    onLoadDemo?.(); // leaves the admin page for a moment, which remounts this panel
  };
  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearIntl();
    setState(fresh());
    setConfirmClear(false);
    setNote('Cleared the records, table and list in this browser.');
  };
  const added = (recs) => {
    persist({ ...state, records: [...recs, ...state.records] }, recs.length === 1
      ? `Added ${recs[0].fencer_name}'s result to the review queue.`
      : `Added ${plural(recs.length, 'result')} from ${recs[0].event} to the review queue, kept together.`);
    setTab('queue');
  };

  const sections = [['queue', 'Review queue'], ['add', 'Add an event'], ['table', 'Points table'], ['list', 'Event list'], ['log', 'Change log']];

  return (
    <div>
      <p className="fl-italic" style={{ ...soft, fontSize: '0.9rem', marginBottom: 6 }}>
        FeNZ's side of the international results prototype (PANELS.md section 2): entering results (an event once,
        then every fencer who went, from email or a fencer's "Submit an event" on the International tab), the review
        queue, the points table and the event list. Records stay in this browser and are never sent anywhere; the
        table and list are placeholders until FeNZ sets them, and only made-up results belong here. FIE and
        Australian results from FeNZ's results portal show on the International tab without coming through here.
      </p>
      <p className="fl-italic" style={{ ...soft, fontSize: '0.9rem', marginBottom: 14 }}>
        Points table v{state.policy.version}. {plural(state.records.length, 'result')} stored.
        {state.test_data && ' Test results on the demo fencers: open Hamish Carter, Charlotte Reeves or Aroha Williams to see them on a profile.'}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {sections.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setNote(null); }} className={`fl-pill ${tab === k ? 'active' : ''}`}>{l}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
        <button onClick={loadTest} className="fl-pill" title="Replaces the bouts in this tab with the demo data, and the stored results with made-up ones">
          Load demo fencers and test results
        </button>
        <button onClick={clearAll} className="fl-pill" onBlur={() => setConfirmClear(false)}>
          {confirmClear ? 'Click again to clear' : 'Clear all'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, maxWidth: 760 }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="fl-smallcaps" style={label} htmlFor="intl-who">Your name, for the log</label>
          <input id="intl-who" value={who} onChange={(e) => setWho(e.target.value)} style={input} />
        </div>
        {(tab === 'table' || tab === 'list') && (
          <div style={{ flex: '2 1 320px' }}>
            <label className="fl-smallcaps" style={label} htmlFor="intl-clause">Policy clause or decision behind the change</label>
            <input id="intl-clause" value={clause} onChange={(e) => setClause(e.target.value)} placeholder="e.g. Board decision, 20 Nov 2026" style={input} />
          </div>
        )}
      </div>

      {note && (
        <div className="fl-italic" role="status" style={{ padding: 10, border: '1px solid var(--rule)', marginBottom: 16, fontSize: '0.9rem' }}>{note}</div>
      )}

      {tab === 'queue' && <Queue state={state} who={who} today={today} persist={persist} fail={fail} />}
      {tab === 'add' && <AddEvent fencers={fencers} today={today} defaults={submitFor ? { fencer: submitFor } : {}} onAdd={added} fail={fail} />}
      {tab === 'table' && <PointsTable state={state} who={who} clause={clause} persist={persist} fail={fail} />}
      {tab === 'list' && <EventList state={state} who={who} clause={clause} persist={persist} fail={fail} />}
      {tab === 'log' && <ChangeLog log={state.log} />}
    </div>
  );
}

// ---- Review queue (PANELS.md 2.4, screen 2) ------------------------------------
// Results entered together as one event sit under one heading, with one set
// of actions for the fencers still waiting; each keeps its own actions too.

function Queue({ state, who, today, persist, fail }) {
  const [filter, setFilter] = useState('pending');
  const [draft, setDraft] = useState({}); // record id, or "event:<event_id>" -> { note, listEntry }
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, withdrawn: 0 };
    for (const r of state.records) c[r.status] += 1;
    return c;
  }, [state.records]);
  const shown = state.records.filter((r) => filter === 'all' || r.status === filter);
  const groups = new Map();
  for (const r of shown) {
    const k = r.event_id ? `event:${r.event_id}` : r.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const nowIso = () => new Date().toISOString();
  const edit = (k) => (patch) => setDraft((m) => ({ ...m, [k]: { ...(m[k] || {}), ...patch } }));
  const opts = (k) => ({ reviewer: who, note: draft[k]?.note, listEntry: draft[k]?.listEntry, policy: state.policy, now: nowIso() });

  const act = (rec, action) => {
    const out = reviewResult(rec, action, opts(rec.id));
    if (out.error) { fail(out.error); return; }
    persist({ ...state, records: state.records.map((r) => (r.id === rec.id ? out.value : r)) },
      `${rec.fencer_name}: ${out.value.status === 'pending' ? 'back in the queue' : out.value.status}.`);
    setDraft((m) => ({ ...m, [rec.id]: {} }));
  };
  const actEvent = (k, first, action) => {
    const out = reviewEvent(state.records, first.event_id, action, opts(k));
    if (out.error) { fail(out.error); return; }
    const done = { approve: 'approved', reject: 'rejected', withdraw: 'withdrawn' }[action];
    persist({ ...state, records: out.value }, `${first.event}: ${plural(out.count, 'result')} ${done}.`);
    setDraft((m) => ({ ...m, [k]: {} }));
  };
  const entriesFor = (r) => state.policy.list.filter((e) => e.country === r.country);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['pending', 'approved', 'rejected', 'withdrawn', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`fl-pill ${filter === f ? 'active' : ''}`}>
            {f}{f === 'all' ? '' : ` · ${counts[f]}`}
          </button>
        ))}
      </div>
      <div style={box}>
        {shown.length === 0 && (
          <div className="fl-italic" style={{ padding: 32, textAlign: 'center', ...soft }}>No results in this view.</div>
        )}
        {[...groups.entries()].map(([k, recs]) => (recs.length > 1 ? (
          <EventGroup key={k} recs={recs} draft={draft[k] || {}} onDraft={edit(k)} entries={entriesFor(recs[0])}
            onAct={(action) => actEvent(k, recs[0], action)}>
            {recs.map((r) => (
              <ResultRow key={r.id} r={r} compact today={today} draft={draft[r.id] || {}} onDraft={edit(r.id)}
                entries={entriesFor(r)} onAct={(action) => act(r, action)} />
            ))}
          </EventGroup>
        ) : (
          <ResultRow key={k} r={recs[0]} today={today} draft={draft[k] || {}} onDraft={edit(k)}
            entries={entriesFor(recs[0])} onAct={(action) => act(recs[0], action)} />
        )))}
      </div>
    </div>
  );
}

const eventLine = (r) => `${r.event} · ${r.country}${r.city ? `, ${r.city}` : ''} · ${fmtDate(r.date)} · ${LEVEL_LABELS[r.level]}${r.organiser ? ` · ${r.organiser}` : ''}`;
const asRan = (r) => `${WEAPON_LABEL[r.weapon]} · ${GENDER_LABEL[r.gender]} · ${CATEGORY_LABELS[r.category]}`;

// The list entry and note a review takes, then the buttons.
function ReviewControls({ draft, onDraft, entries, children }) {
  return (
    <>
      <select aria-label="Event list entry" value={draft.listEntry || ''} onChange={(e) => onDraft({ listEntry: e.target.value })} style={{ ...input, maxWidth: 260 }}>
        <option value="">Not on the event list</option>
        {entries.map((e) => <option key={e.id} value={e.id}>{e.country}: {e.event} ({LEVEL_LABELS[e.level]})</option>)}
      </select>
      <input aria-label="Review note" placeholder="Note (needed to reject)" value={draft.note || ''} onChange={(e) => onDraft({ note: e.target.value })} style={{ ...input, maxWidth: 280 }} />
      {children}
    </>
  );
}

function EventGroup({ recs, draft, onDraft, entries, onAct, children }) {
  const first = recs[0];
  const href = safeHttpUrl(first.results_url);
  const waiting = recs.filter((r) => r.status === 'pending').length;
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="fl-smallcaps" style={{ color: waiting ? 'var(--ox)' : 'var(--ink-soft)' }}>event · {plural(recs.length, 'fencer')}</span>
        <span className="fl-display" style={{ fontWeight: 600 }}>{first.event}</span>
        <span className="fl-italic" style={{ ...soft, fontSize: '0.9rem' }}>{asRan(first)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: '0.95rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span>{eventLine(first).slice(first.event.length + 3)}</span>
        <span className="fl-mono">field of {first.field_size}</span>
        {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">Official results</a> : <span>no valid link</span>}
      </div>
      {waiting > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <ReviewControls draft={draft} onDraft={onDraft} entries={entries}>
            <button onClick={() => onAct('approve')} className="fl-pill">{waiting > 1 ? `Approve all ${waiting}` : 'Approve'}</button>
            <button onClick={() => onAct('reject')} className="fl-pill">{waiting > 1 ? 'Reject all' : 'Reject'}</button>
            <button onClick={() => onAct('withdraw')} className="fl-pill">{waiting > 1 ? 'Withdraw all' : 'Withdraw'}</button>
          </ReviewControls>
        </div>
      )}
      <div style={{ marginTop: 10, marginLeft: 16, borderTop: '1px solid var(--rule-soft)' }}>{children}</div>
    </div>
  );
}

function ResultRow({ r, compact = false, today, draft, onDraft, entries, onAct }) {
  const href = safeHttpUrl(r.results_url);
  const q = softCapQualifier(r);
  return (
    <div style={{ padding: compact ? '10px 0' : '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="fl-smallcaps" style={{ color: r.status === 'pending' ? 'var(--ox)' : 'var(--ink-soft)' }}>{r.status}</span>
        <span className="fl-display" style={{ fontWeight: 600 }}>{r.fencer_name}</span>
        <span className="fl-italic" style={{ ...soft, fontSize: '0.9rem' }}>
          {compact ? '' : `${asRan(r)} · `}lives {r.residence === 'nz' ? 'in NZ' : 'overseas'}
        </span>
      </div>
      {!compact && <div style={{ marginTop: 6, fontSize: '0.95rem' }}>{eventLine(r)}</div>}
      <div style={{ marginTop: 4, fontSize: '0.95rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="fl-mono">{ordinal(r.placing)} of {r.field_size}</span>
        {r.level === 'fie' && <span className="fl-italic">{r.made_de ? 'reached the DE' : 'out in the pools'}</span>}
        {!compact && (href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">Official results</a> : <span>no valid link</span>)}
        {q && <span className="fl-smallcaps" style={tag}>{SOFT_CAP_LABELS[q]}</span>}
      </div>
      {r.status !== 'pending' && (
        <div className="fl-italic" style={{ marginTop: 6, fontSize: '0.88rem', ...soft }}>
          {r.status === 'approved' && <>{adminStatusText(r, today)} · table v{r.policy_version} · </>}
          {r.reviewer ? `${r.reviewer}, ${fmtDate((r.reviewed_at || '').slice(0, 10))}` : ''}
          {r.review_note ? ` · "${r.review_note}"` : ''}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {r.status === 'pending' && (
          <ReviewControls draft={draft} onDraft={onDraft} entries={entries}>
            <button onClick={() => onAct('approve')} className="fl-pill">Approve</button>
            <button onClick={() => onAct('reject')} className="fl-pill">Reject</button>
            <button onClick={() => onAct('withdraw')} className="fl-pill">Withdraw</button>
          </ReviewControls>
        )}
        {(r.status === 'approved' || r.status === 'rejected') && (
          <button onClick={() => onAct('reopen')} className="fl-pill" title="Back to the queue, to review again under the current table">Reopen</button>
        )}
        {r.status === 'approved' && <button onClick={() => onAct('withdraw')} className="fl-pill">Withdraw</button>}
      </div>
    </div>
  );
}

// ---- Entering results (PANELS.md 2.4, screen 1), behind FeNZ's sign-in while
// fencer sign-in is paused: the event once, as on the official results page,
// then every NZ fencer who went, each with their own placing. One pending
// result per fencer, sharing an event_id, so the queue keeps them together.
// A single result is an event with one fencer. ------------------------------

const blankEvent = {
  weapon: 'epee', gender: 'mens', category: 'senior', event: '', organiser: '', country: '', city: '',
  level: 'national_championship', date: '', results_url: '', field_size: '',
};
const blankRow = (name = '') => ({ id: newId(), name, placing: '', made_de: '', residence: 'overseas' });

export function AddEvent({ fencers, today, onAdd, fail, defaults = {} }) {
  const people = useMemo(() => Object.values(fencers)
    .map((f) => ({ key: f.key, name: f.name, club: f.club || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [fencers]);
  // A typed name finds its fencer by the name shown (which an admin edit can
  // change) or by the site key.
  const find = useMemo(() => {
    const m = new Map();
    for (const f of people) { m.set(f.key, f); m.set(nameKey(f.name), f); }
    return (typed) => m.get(nameKey(typed)) || null;
  }, [people]);
  const [ev, setEv] = useState(blankEvent);
  const [rows, setRows] = useState(() => [blankRow(fencers[defaults.fencer]?.name || '')]);
  const setE = (k) => (e) => setEv((f) => ({ ...f, [k]: e.target.value }));
  const setR = (id, k) => (e) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: e.target.value } : r)));
  const filled = rows.filter((r) => r.name.trim() || r.placing.trim());

  const submit = () => {
    const mapped = [];
    for (const r of filled) {
      const f = find(r.name);
      if (!f) { fail(`${r.name.trim() || 'A fencer row'}: pick a fencer from the suggestions (a name on the site)`); return; }
      mapped.push({
        fencer: f.key, fencer_name: f.name, placing: r.placing, residence: r.residence,
        made_de: r.made_de === 'yes' ? true : r.made_de === 'no' ? false : undefined,
      });
    }
    const out = validateEventEntry(ev, mapped, { today });
    if (out.error) { fail(out.error); return; }
    const eventId = newId();
    const now = new Date().toISOString();
    onAdd(out.value.map((v, i) => ({ ...newRecord(v, { id: `${eventId}-${i + 1}`, now }), event_id: eventId })));
    setEv(blankEvent);
    setRows([blankRow()]);
  };

  const field = (k, l, el, flex = '1 1 200px') => (
    <div style={{ flex }}>
      <label className="fl-smallcaps" style={label} htmlFor={`intl-${k}`}>{l}</label>
      {el}
    </div>
  );
  const select = (k, values, labels) => (
    <select id={`intl-${k}`} value={ev[k]} onChange={setE(k)} style={input}>
      {values.map((v) => <option key={v} value={v}>{labels[v] || v}</option>)}
    </select>
  );
  const heading = (text) => <div className="fl-smallcaps" style={{ margin: '4px 0 10px', borderBottom: '1px solid var(--rule)', paddingBottom: 4 }}>{text}</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <p className="fl-italic" style={{ ...soft, fontSize: '0.9rem', marginBottom: 14 }}>
        From the official results page, or a fencer's email while sign-in is paused. Enter the event once, then add
        every NZ fencer who went with their placing: each becomes a result in the review queue, kept together there
        so they can be approved at once.
      </p>
      {heading('The event')}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('weapon', 'Weapon', select('weapon', WEAPONS, WEAPON_LABEL))}
        {field('gender', 'Event ran as', select('gender', GENDERS, GENDER_LABEL))}
        {field('category', 'Category', select('category', CATEGORIES, CATEGORY_LABELS))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('event', 'Event name', <input id="intl-event" value={ev.event} onChange={setE('event')} style={input} />)}
        {field('organiser', 'Organiser', <input id="intl-organiser" value={ev.organiser} onChange={setE('organiser')} style={input} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('country', 'Country (three letters)', <input id="intl-country" value={ev.country} onChange={setE('country')} placeholder="GBR" style={input} />)}
        {field('city', 'City', <input id="intl-city" value={ev.city} onChange={setE('city')} style={input} />)}
        {field('level', 'Level', select('level', LEVELS, LEVEL_LABELS))}
        {field('date', 'Date', <input id="intl-date" type="date" max={today} value={ev.date} onChange={setE('date')} style={input} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {field('results_url', 'Official results link', <input id="intl-results_url" value={ev.results_url} onChange={setE('results_url')} placeholder="https://" style={input} />, '3 1 300px')}
        {field('field_size', 'Field size', <input id="intl-field_size" inputMode="numeric" value={ev.field_size} onChange={setE('field_size')} style={input} />, '1 1 120px')}
      </div>

      {heading(`Fencers · ${filled.length}`)}
      <datalist id="intl-fencer-names">
        {people.map((f) => <option key={f.key} value={f.name}>{f.club}</option>)}
      </datalist>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          {field(`r-${r.id}-name`, `Fencer ${i + 1}`, (
            <input id={`intl-r-${r.id}-name`} list="intl-fencer-names" autoComplete="off" placeholder="Type a name" value={r.name} onChange={setR(r.id, 'name')} style={input} />
          ), '3 1 220px')}
          {field(`r-${r.id}-placing`, 'Placing', (
            <input id={`intl-r-${r.id}-placing`} inputMode="numeric" value={r.placing} onChange={setR(r.id, 'placing')} style={input} />
          ), '1 1 80px')}
          {ev.level === 'fie' && field(`r-${r.id}-made_de`, 'Reached the DE?', (
            <select id={`intl-r-${r.id}-made_de`} value={r.made_de} onChange={setR(r.id, 'made_de')} style={input}>
              <option value="">Pick one</option>
              <option value="yes">Yes</option>
              <option value="no">No, out in the pools</option>
            </select>
          ), '1 1 150px')}
          {field(`r-${r.id}-residence`, 'Lived at the time', (
            <select id={`intl-r-${r.id}-residence`} value={r.residence} onChange={setR(r.id, 'residence')} style={input}>
              {RESIDENCES.map((v) => <option key={v} value={v}>{v === 'nz' ? 'In NZ' : 'Overseas'}</option>)}
            </select>
          ), '1 1 130px')}
          {rows.length > 1 && (
            <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="fl-pill" aria-label={`Remove fencer ${i + 1}`}>Remove</button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <button onClick={() => setRows((rs) => [...rs, blankRow()])} className="fl-pill">Add another fencer</button>
        <button onClick={submit} className="fl-pill">
          {filled.length > 1 ? `Add ${filled.length} results to the review queue` : 'Add to the review queue'}
        </button>
      </div>
    </div>
  );
}

// ---- Points table and event list (PANELS.md 2.4, screen 5) -----------------------

const bandsText = (bands) => bands.map(([p, s]) => `${p}:${s}`).join(', ');
function parseBands(text) {
  return text.split(',').map((x) => x.trim()).filter(Boolean).map((pair) => {
    const [p, s] = pair.split(':').map((y) => y.trim());
    return [Number(p), Number(s)];
  });
}

function PointsTable({ state, who, clause, persist, fail }) {
  const p = state.policy;
  const [form, setForm] = useState(() => ({
    champ: String(p.max_points.national_championship), circuit: String(p.max_points.national_circuit),
    bands: bandsText(p.placing_shares), min_field: String(p.min_field), window: String(p.window_months),
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => {
    const changes = {
      max_points: { national_championship: Number(form.champ), national_circuit: Number(form.circuit) },
      placing_shares: parseBands(form.bands),
      min_field: Number(form.min_field),
      window_months: Number(form.window),
    };
    const out = changePolicy(p, state.log, changes, {
      author: who, clause, summary: `Points table: championship ${form.champ}, circuit ${form.circuit}, bands ${form.bands}, minimum field ${form.min_field}, window ${form.window} months`,
      now: new Date().toISOString(),
    });
    if (out.error) { fail(out.error); return; }
    persist({ ...state, policy: out.policy, log: out.log }, `Saved as table v${out.policy.version}. Results already approved keep the points they were given; reopen one to score it again.`);
  };
  const row = (k, l, help) => (
    <div style={{ marginBottom: 12 }}>
      <label className="fl-smallcaps" style={label} htmlFor={`intl-t-${k}`}>{l}</label>
      <input id={`intl-t-${k}`} value={form[k]} onChange={set(k)} style={{ ...input, maxWidth: 420 }} />
      {help && <div className="fl-italic" style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginTop: 4 }}>{help}</div>}
    </div>
  );
  return (
    <div style={{ maxWidth: 760 }}>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
        Placeholder values (PANELS.md 2.1 lists the decisions FeNZ has to make). Saving makes v{p.version + 1} and logs who and why.
      </p>
      {row('champ', 'Most points: national championship')}
      {row('circuit', 'Most points: national circuit')}
      {row('bands', 'Share of the most points, by place', 'Place:share pairs. "8:0.5" means 4th to 8th earn half, after the bands before it. Past the last band a counted result earns 0.')}
      {row('min_field', 'Minimum field size')}
      {row('window', 'Window, in months', 'A counted result stops counting this many months after the event.')}
      <button onClick={save} className="fl-pill">Save as v{p.version + 1}</button>
    </div>
  );
}

function EventList({ state, who, clause, persist, fail }) {
  const p = state.policy;
  const [form, setForm] = useState({ country: '', event: '', level: 'national_championship' });
  const change = (list, summary) => {
    const out = changePolicy(p, state.log, { list }, { author: who, clause, summary, now: new Date().toISOString() });
    if (out.error) { fail(out.error); return false; }
    persist({ ...state, policy: out.policy, log: out.log }, `Saved as v${out.policy.version}: ${summary}.`);
    return true;
  };
  const add = () => {
    const country = form.country.trim().toUpperCase();
    const entry = { id: `${country.toLowerCase()}-${newId()}`, country, event: form.event.trim(), level: form.level };
    if (change([...p.list, entry], `added ${country}, ${entry.event}`)) setForm({ country: '', event: '', level: 'national_championship' });
  };
  return (
    <div style={{ maxWidth: 760 }}>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
        Events whose results count toward the ranking (option B in PANELS.md 2.1). Placeholder entries until FeNZ sets the list.
      </p>
      <div style={{ ...box, marginBottom: 16 }}>
        {p.list.length === 0 && <div className="fl-italic" style={{ padding: 20, color: 'var(--ink-soft)' }}>No events on the list.</div>}
        {p.list.map((e) => (
          <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="fl-mono" style={{ fontSize: '0.88rem' }}>{e.country}</span>
            <span className="fl-display" style={{ fontWeight: 600 }}>{e.event}</span>
            <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>{LEVEL_LABELS[e.level]}</span>
            <button onClick={() => change(p.list.filter((x) => x.id !== e.id), `removed ${e.country}, ${e.event}`)} className="fl-pill" style={{ marginLeft: 'auto' }}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input aria-label="Country" placeholder="GBR" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} style={{ ...input, maxWidth: 90 }} />
        <input aria-label="Event" placeholder="Event name" value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} style={{ ...input, maxWidth: 280 }} />
        <select aria-label="Level" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} style={{ ...input, maxWidth: 220 }}>
          <option value="national_championship">{LEVEL_LABELS.national_championship}</option>
          <option value="national_circuit">{LEVEL_LABELS.national_circuit}</option>
        </select>
        <button onClick={add} className="fl-pill">Add to the list</button>
      </div>
    </div>
  );
}

function ChangeLog({ log }) {
  return (
    <div style={box}>
      {log.map((e) => (
        <div key={`${e.version}-${e.at}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="fl-mono" style={{ fontSize: '0.88rem' }}>v{e.version}</span>
            <span className="fl-display" style={{ fontWeight: 600 }}>{e.author}</span>
            <span className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{fmtDate((e.at || '').slice(0, 10))}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: '0.92rem' }}>{e.change}</div>
          <div className="fl-italic" style={{ marginTop: 2, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{e.clause}</div>
        </div>
      ))}
    </div>
  );
}

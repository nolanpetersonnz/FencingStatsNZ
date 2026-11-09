import React, { useMemo, useState } from 'react';
import {
  CATEGORIES, CATEGORY_LABELS, GENDERS, LEVELS, LEVEL_LABELS, RESIDENCES, WEAPONS,
  PLACEHOLDER_POLICY, initialLog, validateResult, newRecord, reviewResult, changePolicy,
  adminStatusText, softCapQualifier, SOFT_CAP_LABELS, ordinal,
} from '../data/intl.js';
import { loadIntl, saveIntl, clearIntl, todayIso } from '../data/intlStore.js';
import { testIntlState } from '../data/intlTestData.js';
import { fmtDate } from '../utils/formatters.js';
import { safeHttpUrl } from '../utils/url.js';

// /#admin, International: the prototype of the international results panel
// (PANELS.md section 2). Admin entry, the review queue, the points table and
// the event list. Records stay in this browser (data/intlStore.js), and the
// table and list are placeholders until FeNZ sets them.

const WEAPON_LABEL = { foil: 'Foil', epee: 'Épée', sabre: 'Sabre' };
const GENDER_LABEL = { mens: 'Men', womens: 'Women' };
const input = { width: '100%', padding: '8px 10px', fontSize: '0.95rem', fontFamily: 'Newsreader, serif', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: '0.72rem', marginBottom: 4 };
const box = { borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' };
const tag = { fontSize: '0.66rem', padding: '2px 6px', border: '1px solid var(--rule)', color: 'var(--ink-soft)' };

const fresh = () => ({ records: [], policy: PLACEHOLDER_POLICY, log: initialLog(new Date().toISOString()) });
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function IntlPanel({ fencers = {}, onLoadDemo, setErr }) {
  const [state, setState] = useState(() => loadIntl() || fresh());
  const [tab, setTab] = useState('queue'); // queue | add | table | list | log
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

  const sections = [['queue', 'Review queue'], ['add', 'Add a result'], ['table', 'Points table'], ['list', 'Event list'], ['log', 'Change log']];

  return (
    <div>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 6 }}>
        Prototype of the international results panel (PANELS.md section 2). Records stay in this browser and
        are never sent anywhere. The points table and event list are placeholders until FeNZ sets them, and only
        made-up results belong here.
      </p>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
        Points table v{state.policy.version}. {state.records.length} result{state.records.length === 1 ? '' : 's'} stored.
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
      {tab === 'add' && <AddResult fencers={fencers} today={today} onAdd={(rec) => { persist({ ...state, records: [rec, ...state.records] }, `Added ${rec.fencer_name}'s result to the review queue.`); setTab('queue'); }} fail={fail} />}
      {tab === 'table' && <PointsTable state={state} who={who} clause={clause} persist={persist} fail={fail} />}
      {tab === 'list' && <EventList state={state} who={who} clause={clause} persist={persist} fail={fail} />}
      {tab === 'log' && <ChangeLog log={state.log} />}
    </div>
  );
}

// ---- Review queue (PANELS.md 2.4, screen 2) ------------------------------------

function Queue({ state, who, today, persist, fail }) {
  const [filter, setFilter] = useState('pending');
  const [draft, setDraft] = useState({}); // id -> { note, listEntry }
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, withdrawn: 0 };
    for (const r of state.records) c[r.status] += 1;
    return c;
  }, [state.records]);
  const shown = state.records.filter((r) => filter === 'all' || r.status === filter);
  const nowIso = () => new Date().toISOString();

  const act = (rec, action) => {
    const d = draft[rec.id] || {};
    const out = reviewResult(rec, action, { reviewer: who, note: d.note, listEntry: d.listEntry, policy: state.policy, now: nowIso() });
    if (out.error) { fail(out.error); return; }
    persist({ ...state, records: state.records.map((r) => (r.id === rec.id ? out.value : r)) },
      `${rec.fencer_name}: ${out.value.status === 'pending' ? 'back in the queue' : out.value.status}.`);
    setDraft((m) => ({ ...m, [rec.id]: {} }));
  };

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
          <div className="fl-italic" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No results in this view.</div>
        )}
        {shown.map((r) => {
          const href = safeHttpUrl(r.results_url);
          const q = softCapQualifier(r);
          const d = draft[r.id] || {};
          const entries = state.policy.list.filter((e) => e.country === r.country);
          return (
            <div key={r.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="fl-smallcaps" style={{ color: r.status === 'pending' ? 'var(--ox)' : 'var(--ink-soft)' }}>{r.status}</span>
                <span className="fl-display" style={{ fontWeight: 600 }}>{r.fencer_name}</span>
                <span className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
                  {WEAPON_LABEL[r.weapon]} · {GENDER_LABEL[r.gender]} · {CATEGORY_LABELS[r.category]} · lives {r.residence === 'nz' ? 'in NZ' : 'overseas'}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.95rem' }}>
                {r.event} · {r.country}{r.city ? `, ${r.city}` : ''} · {fmtDate(r.date)} · {LEVEL_LABELS[r.level]}{r.organiser ? ` · ${r.organiser}` : ''}
              </div>
              <div style={{ marginTop: 4, fontSize: '0.95rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span className="fl-mono">{ordinal(r.placing)} of {r.field_size}</span>
                {r.level === 'fie' && <span className="fl-italic">{r.made_de ? 'reached the DE' : 'out in the pools'}</span>}
                {href ? <a className="fl-link" href={href} target="_blank" rel="noopener noreferrer">Official results</a> : <span>no valid link</span>}
                {q && <span className="fl-smallcaps" style={tag}>{SOFT_CAP_LABELS[q]}</span>}
              </div>
              {r.status !== 'pending' && (
                <div className="fl-italic" style={{ marginTop: 6, fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
                  {r.status === 'approved' && <>{adminStatusText(r, today)} · table v{r.policy_version} · </>}
                  {r.reviewer ? `${r.reviewer}, ${fmtDate((r.reviewed_at || '').slice(0, 10))}` : ''}
                  {r.review_note ? ` · "${r.review_note}"` : ''}
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {r.status === 'pending' && (
                  <>
                    <select aria-label="Event list entry" value={d.listEntry || ''} onChange={(e) => setDraft((m) => ({ ...m, [r.id]: { ...d, listEntry: e.target.value } }))} style={{ ...input, maxWidth: 260 }}>
                      <option value="">Not on the event list</option>
                      {entries.map((e) => <option key={e.id} value={e.id}>{e.country}: {e.event} ({LEVEL_LABELS[e.level]})</option>)}
                    </select>
                    <input aria-label="Review note" placeholder="Note (needed to reject)" value={d.note || ''} onChange={(e) => setDraft((m) => ({ ...m, [r.id]: { ...d, note: e.target.value } }))} style={{ ...input, maxWidth: 280 }} />
                    <button onClick={() => act(r, 'approve')} className="fl-pill">Approve</button>
                    <button onClick={() => act(r, 'reject')} className="fl-pill">Reject</button>
                    <button onClick={() => act(r, 'withdraw')} className="fl-pill">Withdraw</button>
                  </>
                )}
                {(r.status === 'approved' || r.status === 'rejected') && (
                  <button onClick={() => act(r, 'reopen')} className="fl-pill" title="Back to the queue, to review again under the current table">Reopen</button>
                )}
                {r.status === 'approved' && <button onClick={() => act(r, 'withdraw')} className="fl-pill">Withdraw</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Admin entry (PANELS.md 2.4, screen 1, entered by an admin while sign-in is paused) ----

const blank = {
  fencer: '', weapon: 'epee', gender: 'mens', category: 'senior', event: '', organiser: '', country: '', city: '',
  level: 'national_championship', date: '', results_url: '', placing: '', field_size: '', made_de: '', residence: 'overseas',
};

function AddResult({ fencers, today, onAdd, fail }) {
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('');
  const list = useMemo(() => Object.values(fencers)
    .map((f) => ({ key: f.key, name: f.name, club: f.club || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [fencers]);
  const options = filter.trim() ? list.filter((f) => f.name.toLowerCase().includes(filter.trim().toLowerCase())) : list;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    const picked = list.find((f) => f.key === form.fencer);
    const made = form.made_de === 'yes' ? true : form.made_de === 'no' ? false : undefined;
    const out = validateResult({ ...form, fencer_name: picked?.name, made_de: made }, { today });
    if (out.error) { fail(out.error); return; }
    onAdd(newRecord(out.value, { id: newId(), now: new Date().toISOString() }));
    setForm(blank);
  };

  const field = (k, l, el) => (
    <div style={{ flex: '1 1 200px' }}>
      <label className="fl-smallcaps" style={label} htmlFor={`intl-${k}`}>{l}</label>
      {el}
    </div>
  );
  const select = (k, values, labels) => (
    <select id={`intl-${k}`} value={form[k]} onChange={set(k)} style={input}>
      {values.map((v) => <option key={v} value={v}>{labels[v] || v}</option>)}
    </select>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
        From a fencer's email or form, while sign-in is paused. Every field as published on the official results page.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('find', 'Find fencer', <input id="intl-find" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type part of a name" style={input} />)}
        {field('fencer', 'Fencer', (
          <select id="intl-fencer" value={form.fencer} onChange={set('fencer')} style={input}>
            <option value="">Pick a fencer</option>
            {options.map((f) => <option key={f.key} value={f.key}>{f.name}{f.club ? ` · ${f.club}` : ''}</option>)}
          </select>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('weapon', 'Weapon', select('weapon', WEAPONS, WEAPON_LABEL))}
        {field('gender', 'Event ran as', select('gender', GENDERS, GENDER_LABEL))}
        {field('category', 'Category', select('category', CATEGORIES, CATEGORY_LABELS))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('event', 'Event name', <input id="intl-event" value={form.event} onChange={set('event')} style={input} />)}
        {field('organiser', 'Organiser', <input id="intl-organiser" value={form.organiser} onChange={set('organiser')} style={input} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('country', 'Country (three letters)', <input id="intl-country" value={form.country} onChange={set('country')} placeholder="GBR" style={input} />)}
        {field('city', 'City', <input id="intl-city" value={form.city} onChange={set('city')} style={input} />)}
        {field('level', 'Level', select('level', LEVELS, LEVEL_LABELS))}
        {field('date', 'Date', <input id="intl-date" type="date" max={today} value={form.date} onChange={set('date')} style={input} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {field('results_url', 'Official results link', <input id="intl-results_url" value={form.results_url} onChange={set('results_url')} placeholder="https://" style={input} />)}
        {field('placing', 'Placing', <input id="intl-placing" inputMode="numeric" value={form.placing} onChange={set('placing')} style={input} />)}
        {field('field_size', 'Field size', <input id="intl-field_size" inputMode="numeric" value={form.field_size} onChange={set('field_size')} style={input} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {form.level === 'fie' && field('made_de', 'Reached the DE?', select('made_de', ['', 'yes', 'no'], { '': 'Pick one', yes: 'Yes', no: 'No, out in the pools' }))}
        {field('residence', 'Lived at the time', select('residence', RESIDENCES, { overseas: 'Overseas', nz: 'In NZ' }))}
      </div>
      <button onClick={submit} className="fl-pill">Add to the review queue</button>
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

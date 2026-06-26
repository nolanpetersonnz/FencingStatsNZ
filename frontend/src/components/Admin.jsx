import React, { useEffect, useState, useMemo } from 'react';
import { adminList, adminAct, adminSetClubMeta, adminAssignFencer, adminMergeFencers,
  adminRefreshStatus, adminRefreshData, adminRefreshRevert, adminRefreshAccept } from '../data/edits.js';
import Import from './Import.jsx';
import Settings from './Settings.jsx';

// /#admin — paste the ADMIN_TOKEN once, then review and act on edit
// submissions. Token persists in localStorage. Listing is server-side
// gated; bad tokens 401 and the UI shows the prompt again.

function TokenGate({ onSaved }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: 32, border: '1px solid var(--ink)' }}>
      <div className="fl-smallcaps" style={{ marginBottom: 6 }}>Admin</div>
      <h2 className="fl-display" style={{ fontSize: '1.8rem', margin: '0 0 14px' }}>Sign in</h2>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
        Paste your ADMIN_TOKEN (set in Vercel env). Stored in this browser only.
      </p>
      <input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ADMIN_TOKEN"
        style={{ width: '100%', padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' }}
      />
      <button
        onClick={() => { localStorage.setItem('fl_admin_token', val.trim()); onSaved(); }}
        disabled={!val.trim()}
        className="fl-smallcaps"
        style={{ marginTop: 14, background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)', padding: '8px 18px', cursor: val.trim() ? 'pointer' : 'not-allowed', opacity: val.trim() ? 1 : 0.4, fontSize: '0.72rem' }}
      >
        Save
      </button>
    </div>
  );
}

function fmtPayload(edit) {
  if (!edit?.payload) return '';
  if (edit.kind === 'display_name') return `"${edit.payload.display_name}"`;
  if (edit.kind === 'current_club') return `"${edit.payload.current_club}"`;
  if (edit.kind === 'merge') return `merge into "${edit.payload.merge_into}"`;
  if (edit.kind === 'dispute') {
    const b = edit.payload.bout || {};
    const meta = `${b.date || ''} ${b.competition || ''} ${b.fencer_a || ''} ${b.score_a ?? ''}-${b.score_b ?? ''} ${b.fencer_b || ''}`.trim();
    const reason = edit.payload.reason ? ` — "${edit.payload.reason}"` : '';
    return meta + reason;
  }
  return JSON.stringify(edit.payload);
}

export default function Admin({
  onLeave, fencers = {}, overrides = {}, onChange,
  settings, setSettings, rawBouts, hasData,
  onImport, onLoadDemo, onClear,
}) {
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('fl_admin_token'));
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending | applied | all
  const [section, setSection] = useState('edits'); // edits | clubs | merges | import | refresh | tuning
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const refresh = async () => {
    setErr(null);
    try {
      const data = await adminList();
      setItems(data.items || []);
    } catch (e) {
      if (e.message.includes('401')) {
        localStorage.removeItem('fl_admin_token');
        setHasToken(false);
      }
      setErr(e.message);
    }
  };

  useEffect(() => { if (hasToken) refresh(); }, [hasToken]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'pending') return items.filter((i) => i.status === 'pending');
    if (filter === 'applied') return items.filter((i) => i.status === 'applied');
    return items;
  }, [items, filter]);

  if (!hasToken) return <TokenGate onSaved={() => setHasToken(true)} />;

  const act = async (id, action) => {
    setBusy(id);
    try {
      await adminAct(id, action);
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fl-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="fl-smallcaps">Admin</div>
          <h2 className="fl-display" style={{ fontSize: '1.8rem', margin: '4px 0 0' }}>
            {section === 'edits'
              ? `${items.length} edits · ${items.filter((i) => i.status === 'pending').length} pending`
              : section === 'clubs' ? 'Clubs'
              : section === 'merges' ? 'Profile merges'
              : section === 'import' ? 'Data ingest'
              : section === 'refresh' ? 'Refresh from FeNZ'
              : section === 'tuning' ? 'Tuning'
              : ''}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setSection('edits')} className={`fl-pill ${section === 'edits' ? 'active' : ''}`}>Edits</button>
          <button onClick={() => setSection('clubs')} className={`fl-pill ${section === 'clubs' ? 'active' : ''}`}>Clubs</button>
          <button onClick={() => setSection('merges')} className={`fl-pill ${section === 'merges' ? 'active' : ''}`}>Merges</button>
          <button onClick={() => setSection('import')} className={`fl-pill ${section === 'import' ? 'active' : ''}`}>Import</button>
          <button onClick={() => setSection('refresh')} className={`fl-pill ${section === 'refresh' ? 'active' : ''}`}>Refresh</button>
          <button onClick={() => setSection('tuning')} className={`fl-pill ${section === 'tuning' ? 'active' : ''}`}>Tuning</button>
          <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 4px' }} />
          {section === 'edits' && ['pending', 'applied', 'all'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`fl-pill ${filter === f ? 'active' : ''}`}>{f}</button>
          ))}
          <button
            onClick={() => { localStorage.removeItem('fl_admin_token'); setHasToken(false); }}
            className="fl-pill"
            title="Forget token in this browser"
          >
            Sign out
          </button>
          <button onClick={onLeave} className="fl-pill">Back to site</button>
        </div>
      </div>

      {err && (
        <div className="fl-italic" style={{ padding: 10, border: '1px solid var(--red-light)', color: 'var(--red-light)', marginBottom: 16, fontSize: '0.9rem' }}>
          {err}
        </div>
      )}

      {section === 'clubs' && (
        <ClubsPanel fencers={fencers} overrides={overrides} onChange={onChange} setErr={setErr} />
      )}

      {section === 'merges' && (
        <MergesPanel fencers={fencers} overrides={overrides} onChange={onChange} setErr={setErr} />
      )}

      {section === 'import' && (
        <Import
          onImport={onImport}
          onLoadDemo={onLoadDemo}
          hasData={hasData}
          onClear={onClear}
          rawBouts={rawBouts}
        />
      )}

      {section === 'refresh' && (
        <RefreshPanel setErr={setErr} />
      )}

      {section === 'tuning' && (
        <Settings settings={settings} setSettings={setSettings} onRecompute={() => {}} />
      )}

      {section === 'edits' && (
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        {filtered.length === 0 && (
          <div className="fl-italic" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No edits in this view.
          </div>
        )}
        {filtered.map((edit) => {
          const ts = edit.created_at ? new Date(edit.created_at).toLocaleString() : '';
          return (
            <div key={edit.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="fl-smallcaps" style={{ color: edit.status === 'pending' ? 'var(--ox)' : 'var(--ink-soft)' }}>
                  {edit.status}
                </span>
                <span className="fl-smallcaps" style={{ fontSize: '0.7rem' }}>{edit.kind.replace('_', ' ')}</span>
                <span className="fl-display" style={{ fontWeight: 600 }}>{edit.fencer_key}</span>
                <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.8rem' }}>{ts}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.95rem' }}>{fmtPayload(edit)}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {edit.status === 'pending' && (
                  <>
                    <button disabled={busy === edit.id} onClick={() => act(edit.id, 'approve')} className="fl-pill">Approve</button>
                    <button disabled={busy === edit.id} onClick={() => act(edit.id, 'reject')} className="fl-pill">Reject</button>
                  </>
                )}
                {edit.status === 'applied' && (
                  <button disabled={busy === edit.id} onClick={() => act(edit.id, 'revert')} className="fl-pill">Revert</button>
                )}
                {edit.admin_note && (
                  <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Note: {edit.admin_note}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function ClubsPanel({ fencers, overrides, onChange, setErr }) {
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null); // club name or null
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ website: '', location: '', affiliated: '' });
  const [assignOpen, setAssignOpen] = useState(null);
  const [assignTo, setAssignTo] = useState('');

  // Collect all known club names from current fencers + any in club_meta
  // that may have zero members. Sorted alphabetically.
  const clubList = useMemo(() => {
    const counts = {};
    for (const f of Object.values(fencers)) {
      const c = (f.club || '').trim();
      if (!c) continue;
      counts[c] = (counts[c] || 0) + 1;
    }
    for (const c in (overrides.club_meta || {})) {
      if (!(c in counts)) counts[c] = 0;
    }
    return Object.entries(counts)
      .map(([name, n]) => ({ name, count: n, meta: overrides.club_meta?.[name] || null }))
      .filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fencers, overrides, filter]);

  // Fencers indexed for the assign-to-club dropdown.
  const fencersList = useMemo(() => Object.values(fencers)
    .map(f => ({ key: f.key, name: f.name, club: f.club || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [fencers]);

  const startEdit = (club) => {
    setEditing(club.name);
    setForm({
      website: club.meta?.website || '',
      location: club.meta?.location || '',
      affiliated: club.meta?.affiliated === true ? 'yes' : club.meta?.affiliated === false ? 'no' : '',
    });
  };

  const saveMeta = async () => {
    setBusy(true);
    try {
      await adminSetClubMeta({
        clubName: editing,
        website: form.website,
        location: form.location,
        affiliated: form.affiliated === 'yes' ? true : form.affiliated === 'no' ? false : null,
      });
      setEditing(null);
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const clearMeta = async (club) => {
    if (!confirm(`Clear all metadata for ${club}?`)) return;
    setBusy(true);
    try {
      await adminSetClubMeta({ clubName: club, website: '', location: '', affiliated: null });
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reassign = async (fencerKey, clubName) => {
    setBusy(true);
    try {
      await adminAssignFencer({ fencerKey, clubName });
      setAssignOpen(null);
      setAssignTo('');
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const input = { width: '100%', padding: '8px 10px', fontSize: '0.95rem', fontFamily: 'Newsreader, serif', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      <input
        placeholder="Filter clubs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ ...input, marginBottom: 16, maxWidth: 380 }}
      />

      <div className="fl-smallcaps" style={{ fontSize: '0.72rem', marginBottom: 8 }}>
        Reassign a fencer
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24, padding: '12px 14px', border: '1px solid var(--rule)' }}>
        <select
          value={assignOpen || ''}
          onChange={(e) => { setAssignOpen(e.target.value); setAssignTo(fencersList.find(x => x.key === e.target.value)?.club || ''); }}
          style={{ ...input, maxWidth: 260 }}
        >
          <option value="">— pick a fencer —</option>
          {fencersList.map(f => (
            <option key={f.key} value={f.key}>{f.name}{f.club ? ` · ${f.club}` : ''}</option>
          ))}
        </select>
        {assignOpen && (
          <>
            <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>to</span>
            <input
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              placeholder="club name (blank = clear override)"
              style={{ ...input, maxWidth: 260 }}
            />
            <button onClick={() => reassign(assignOpen, assignTo)} disabled={busy} className="fl-pill">Apply</button>
            <button onClick={() => { setAssignOpen(null); setAssignTo(''); }} className="fl-pill">Cancel</button>
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        {clubList.length === 0 && (
          <div className="fl-italic" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>No clubs match.</div>
        )}
        {clubList.map((c) => {
          const isEditing = editing === c.name;
          return (
            <div key={c.name} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule-soft)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="fl-display" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{c.name}</span>
                <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
                  {c.count} member{c.count === 1 ? '' : 's'}
                </span>
                {c.meta?.location && <span className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>· {c.meta.location}</span>}
                {c.meta?.website && <span className="fl-mono" style={{ color: 'var(--ox)', fontSize: '0.82rem' }}>· {c.meta.website.replace(/^https?:\/\//, '')}</span>}
                {c.meta?.affiliated === true && <span className="fl-smallcaps" style={{ fontSize: '0.62rem', padding: '1px 6px', border: '1px solid var(--ox)', color: 'var(--ox)' }}>affiliated</span>}
                {c.meta?.affiliated === false && <span className="fl-smallcaps" style={{ fontSize: '0.62rem', padding: '1px 6px', border: '1px solid var(--ink-faint)', color: 'var(--ink-faint)' }}>not affiliated</span>}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                <button onClick={() => isEditing ? setEditing(null) : startEdit(c)} className="fl-pill">{isEditing ? 'Cancel' : 'Edit'}</button>
                {c.meta && <button onClick={() => clearMeta(c.name)} disabled={busy} className="fl-pill">Clear</button>}
              </div>
              {isEditing && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <input style={input} placeholder="Website (https://...)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  <input style={input} placeholder="Location (e.g. Wellington)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                  <select style={input} value={form.affiliated} onChange={(e) => setForm({ ...form, affiliated: e.target.value })}>
                    <option value="">FNZ affiliation: unknown</option>
                    <option value="yes">Affiliated</option>
                    <option value="no">Not affiliated</option>
                  </select>
                  <button onClick={saveMeta} disabled={busy} className="fl-pill">{busy ? 'Saving...' : 'Save'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MergesPanel({ fencers, overrides, onChange, setErr }) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const merges = overrides.merges || {};
  const fencersList = useMemo(() => Object.values(fencers)
    .map(f => ({ key: f.key, name: f.name, club: f.club || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [fencers]);

  const filteredFencers = useMemo(() => {
    if (!filter.trim()) return fencersList;
    const q = filter.toLowerCase();
    return fencersList.filter(f => f.name.toLowerCase().includes(q) || f.club.toLowerCase().includes(q));
  }, [fencersList, filter]);

  const mergeRows = useMemo(() => {
    return Object.entries(merges)
      .map(([src, info]) => ({
        source: src,
        target: info?.merge_into || '',
        target_name: info?.merge_into_name || info?.merge_into || '',
      }))
      .sort((a, b) => a.source.localeCompare(b.source));
  }, [merges]);

  const submit = async () => {
    if (!source || !target) return;
    if (source === target) {
      setErr('Source and target must differ.');
      return;
    }
    const tgt = fencersList.find(f => f.key === target);
    if (!confirm(`Merge "${fencersList.find(f => f.key === source)?.name || source}" into "${tgt?.name || target}"?\n\nAll bouts from the source profile will be attributed to the target. This can be undone.`)) return;
    setBusy(true);
    try {
      await adminMergeFencers({ sourceKey: source, targetKey: target, targetName: tgt?.name || '' });
      setSource(''); setTarget(''); setFilter('');
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const unmerge = async (sourceKey) => {
    if (!confirm(`Unmerge "${sourceKey}"? The profile will be restored as a separate fencer on the next data load.`)) return;
    setBusy(true);
    try {
      await adminMergeFencers({ sourceKey, targetKey: '', targetName: '' });
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const input = { width: '100%', padding: '8px 10px', fontSize: '0.95rem', fontFamily: 'Newsreader, serif', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--rule)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
        Pick two profiles that belong to the same person. Bouts from the
        source are attributed to the target so the two records collapse
        into one rating history.
      </p>

      <input
        placeholder="Filter fencers by name or club..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ ...input, marginBottom: 12, maxWidth: 380 }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24, padding: '12px 14px', border: '1px solid var(--rule)' }}>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{ ...input, maxWidth: 260 }}>
          <option value="">— source profile —</option>
          {filteredFencers.map(f => (
            <option key={f.key} value={f.key}>{f.name}{f.club ? ` · ${f.club}` : ''}</option>
          ))}
        </select>
        <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>into</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...input, maxWidth: 260 }}>
          <option value="">— target profile —</option>
          {filteredFencers.filter(f => f.key !== source).map(f => (
            <option key={f.key} value={f.key}>{f.name}{f.club ? ` · ${f.club}` : ''}</option>
          ))}
        </select>
        <button onClick={submit} disabled={busy || !source || !target} className="fl-pill">
          {busy ? 'Merging...' : 'Merge'}
        </button>
        {(source || target) && (
          <button onClick={() => { setSource(''); setTarget(''); }} className="fl-pill">Clear</button>
        )}
      </div>

      <div className="fl-smallcaps" style={{ fontSize: '0.72rem', marginBottom: 8 }}>
        Active merges ({mergeRows.length})
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        {mergeRows.length === 0 && (
          <div className="fl-italic" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No merges yet.
          </div>
        )}
        {mergeRows.map((m) => (
          <div key={m.source} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule-soft)', display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="fl-mono" style={{ fontSize: '0.88rem' }}>{m.source}</span>
            <span className="fl-italic" style={{ color: 'var(--ink-soft)' }}>→</span>
            <span className="fl-display" style={{ fontWeight: 600 }}>{m.target_name}</span>
            <button onClick={() => unmerge(m.source)} disabled={busy} className="fl-pill" style={{ marginLeft: 'auto' }}>
              Unmerge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// "Refresh from FeNZ" — fire the ingest pipeline (GitHub Actions), watch the
// run, and review the resulting data commits. The data is committed to git by
// the workflow and auto-deploys; this panel is the trigger plus a rollback
// lever, not a pre-publish gate.
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : '');

function RefreshPanel({ setErr }) {
  const [state, setState] = useState(null);  // GET /api/refresh payload
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);   // a POST in flight
  const [note, setNote] = useState('');      // transient status line

  const load = async () => {
    try {
      setState(await adminRefreshStatus());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Poll only while a run is in flight, so the admin sees it land without a
  // manual reload. 12s keeps well under the GitHub API rate limit and is
  // plenty responsive for a pipeline measured in minutes.
  useEffect(() => {
    if (!state?.running) return;
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [state?.running]);

  const triggerRefresh = async () => {
    setBusy(true); setNote(''); setErr(null);
    try {
      await adminRefreshData();
      setNote('Refresh started. It runs in GitHub Actions and lands in a few minutes.');
      await load();
    } catch (e) {
      if (e.status === 409) setNote('A refresh is already running.');
      else setErr(e.message + (e.detail ? ` (${e.detail})` : ''));
    } finally {
      setBusy(false);
    }
  };

  const revert = async (entry) => {
    if (!confirm(`Roll back this change?\n\n${entry.subject}\n\nThis restores the previous bouts.csv and redeploys. You can run a fresh refresh afterwards.`)) return;
    setBusy(true); setErr(null); setNote('');
    try {
      await adminRefreshRevert(entry.sha);
      setNote('Rollback started. The previous results will be restored in a few minutes.');
      await load();
    } catch (e) {
      setErr(e.message + (e.detail ? ` (${e.detail})` : ''));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (entry) => {
    setBusy(true); setErr(null);
    try {
      await adminRefreshAccept(entry.sha);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="fl-italic" style={{ padding: 24, color: 'var(--ink-soft)' }}>Loading refresh status...</div>;
  }

  if (state && state.configured === false) {
    return (
      <div className="fl-fade-in" style={{ maxWidth: 720 }}>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          The refresh pipeline isn't wired up yet. Set <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85em', background: 'var(--paper-shade)', padding: '1px 5px' }}>GH_DISPATCH_TOKEN</code> (a fine-grained GitHub token for{' '}
          <span className="fl-mono">{state.repo}</span> with Contents read/write and Actions read) in your Vercel
          environment variables, then reload. See SETUP.md, Phase 5.
        </p>
      </div>
    );
  }

  const running = !!state?.running;
  const lastRun = state?.latest_run || null;
  const entries = state?.entries || [];

  return (
    <div className="fl-fade-in" style={{ maxWidth: 920 }}>
      <p style={{ marginTop: 0, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 680 }}>
        Pull the latest results from the FeNZ API. This regenerates the dataset in GitHub Actions,
        validates it against the test suite, and commits it, which redeploys the live site in a few
        minutes. Each run is logged below; you can roll one back if it looks wrong.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '18px 0 6px' }}>
        <button className="fl-btn" onClick={triggerRefresh} disabled={busy || running}>
          {running ? 'Refresh running...' : 'Refresh from FeNZ'}
        </button>
        <button className="fl-pill" onClick={load} disabled={busy}>Reload status</button>
        {running && lastRun?.html_url && (
          <a href={lastRun.html_url} target="_blank" rel="noreferrer" className="fl-pill" style={{ textDecoration: 'none' }}>
            View run ↗
          </a>
        )}
        {!running && lastRun && (
          <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
            Last run: {lastRun.conclusion || lastRun.status}{lastRun.created_at ? ` · ${fmtWhen(lastRun.created_at)}` : ''}
            {lastRun.html_url && <> · <a href={lastRun.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-soft)' }}>log ↗</a></>}
          </span>
        )}
      </div>

      {note && (
        <div className="fl-italic" style={{ color: 'var(--ox-deep)', fontSize: '0.9rem', marginBottom: 8 }}>{note}</div>
      )}
      {state?.error && (
        <div className="fl-italic" style={{ color: 'var(--red-light)', fontSize: '0.85rem', marginBottom: 8 }}>
          Could not read the log: {state.error}
        </div>
      )}

      <div className="fl-smallcaps" style={{ fontSize: '0.72rem', margin: '22px 0 8px' }}>
        Recent data changes ({entries.length})
      </div>
      <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
        {entries.length === 0 && (
          <div className="fl-italic" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No data commits found yet.
          </div>
        )}
        {entries.map((e) => (
          <RefreshRow key={e.sha} entry={e} busy={busy} onAccept={accept} onRevert={revert} />
        ))}
      </div>
    </div>
  );
}

function RefreshRow({ entry, busy, onAccept, onRevert }) {
  const [open, setOpen] = useState(false);
  const kindColor = entry.kind === 'revert' ? 'var(--red-light)'
    : entry.kind === 'refresh' ? 'var(--ox)' : 'var(--ink-soft)';
  const needsReview = entry.kind === 'refresh' && !entry.reviewed;
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--rule-soft)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="fl-smallcaps" style={{ fontSize: '0.7rem', color: kindColor }}>{entry.kind}</span>
        {needsReview && (
          <span className="fl-smallcaps" style={{ fontSize: '0.62rem', padding: '1px 6px', border: '1px solid var(--ox)', color: 'var(--ox)' }}>needs review</span>
        )}
        {entry.kind === 'refresh' && entry.reviewed && (
          <span className="fl-smallcaps" style={{ fontSize: '0.62rem', color: 'var(--moss)' }}>reviewed</span>
        )}
        <span style={{ fontWeight: 600 }}>{entry.subject}</span>
        <span className="fl-mono" style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>{entry.short}</span>
        <span className="fl-italic" style={{ color: 'var(--ink-faint)', fontSize: '0.8rem' }}>{fmtWhen(entry.date)}</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {entry.body && (
          <button onClick={() => setOpen((o) => !o)} className="fl-pill">{open ? 'Hide' : 'Details'}</button>
        )}
        {needsReview && (
          <button disabled={busy} onClick={() => onAccept(entry)} className="fl-pill">Accept</button>
        )}
        <button disabled={busy} onClick={() => onRevert(entry)} className="fl-pill">
          {entry.kind === 'revert' ? 'Roll back' : 'Revert'}
        </button>
        {entry.html_url && (
          <a href={entry.html_url} target="_blank" rel="noreferrer" className="fl-pill" style={{ textDecoration: 'none' }}>Commit ↗</a>
        )}
      </div>
      {open && entry.body && (
        <pre className="fl-mono" style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: 'var(--ink-soft)', background: 'var(--paper-deep)', padding: 12, border: '1px solid var(--rule-soft)', overflowX: 'auto' }}>{entry.body}</pre>
      )}
    </div>
  );
}

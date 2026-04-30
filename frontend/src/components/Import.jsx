import React, { useState, useRef } from 'react';
import { Download, Upload, AlertCircle, Trash2 } from 'lucide-react';
import { parseCSV } from '../data/pipeline.js';
import { CSV_HEADER, CSV_TEMPLATE } from '../constants.js';

export default function Import({ onImport, onLoadDemo, hasData, onClear, rawBouts }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  const handleParse = (raw) => {
    setError('');
    setSuccess('');
    try {
      const rows = parseCSV(raw);
      if (rows.length === 0) { setError('No rows parsed. Check that your CSV has a header row.'); return; }
      const required = ['date', 'weapon', 'fencer_a', 'fencer_b', 'score_a', 'score_b'];
      const missing = required.filter(r => !(r in rows[0]));
      if (missing.length) { setError(`Missing required columns: ${missing.join(', ')}`); return; }
      const valid = rows.filter(r => r.date && r.fencer_a && r.fencer_b && r.score_a !== '' && r.score_b !== '');
      if (valid.length === 0) { setError('No rows passed validation.'); return; }
      onImport(valid);
      setSuccess(`Imported ${valid.length} bout${valid.length === 1 ? '' : 's'}.`);
      setText('');
    } catch (e) {
      setError(`Parse error: ${e.message}`);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleParse(ev.target.result);
    reader.readAsText(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fencingstatsnz-template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fl-fade-in" style={{ maxWidth: 920 }}>
      <div className="fl-smallcaps">Data ingest</div>
      <h2 className="fl-display" style={{ fontSize: '2.4rem', fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
        Bring in <span style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--ox)' }}>results</span>
      </h2>

      <div style={{ marginTop: 28, padding: '24px', border: '1px solid var(--rule)', background: 'var(--paper-deep)' }}>
        <div className="fl-smallcaps" style={{ marginBottom: 8 }}>The CSV format</div>
        <p style={{ marginTop: 0, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          Each row is a single bout. Pool bouts and DE bouts share one table — distinguish with the <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85em', background: 'var(--paper-shade)', padding: '1px 5px' }}>bout_type</code> column. Weapon names accept <span className="fl-italic">foil</span>, <span className="fl-italic">epee</span> (or épée), <span className="fl-italic">sabre</span>.
        </p>
        <pre className="fl-mono" style={{ background: 'var(--paper)', padding: 12, fontSize: '0.78rem', overflowX: 'auto', border: '1px solid var(--rule-soft)', margin: '12px 0' }}>{CSV_HEADER}</pre>
        <button className="fl-btn ghost" onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Download size={13} /> Download template
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="fl-smallcaps" style={{ marginBottom: 10 }}>Upload a file</div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
        <button className="fl-btn" onClick={() => fileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Upload size={13} /> Choose CSV file
        </button>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="fl-smallcaps" style={{ marginBottom: 10 }}>Or paste CSV</div>
        <textarea className="fl-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={CSV_HEADER + '\n2025-…'} />
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="fl-btn" onClick={() => handleParse(text)} disabled={!text.trim()}>Parse &amp; Import</button>
          {!hasData && <button className="fl-btn ghost" onClick={onLoadDemo}>Or load demo data</button>}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 24, padding: 14, background: 'var(--ink-fade)', border: '1px solid var(--ink)', display: 'flex', gap: 10 }}>
          <AlertCircle size={16} color="var(--ink)" />
          <div style={{ color: 'var(--ink)' }}>{error}</div>
        </div>
      )}
      {success && (
        <div style={{ marginTop: 24, padding: 14, background: 'rgba(26,107,181,0.06)', border: '1px solid var(--ox)', color: 'var(--ox-deep)' }}>
          ✓ {success}
        </div>
      )}

      {hasData && (
        <div style={{ marginTop: 36, padding: 20, border: '1px solid var(--rule)' }}>
          <div className="fl-smallcaps" style={{ marginBottom: 8 }}>Current ledger</div>
          <div style={{ marginBottom: 14 }}>{rawBouts.length} bouts on record.</div>
          <button className="fl-btn danger" onClick={onClear} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={13} /> Clear all data
          </button>
        </div>
      )}
    </div>
  );
}

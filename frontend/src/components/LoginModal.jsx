import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { hashLicence, findFencerByLicenceHash } from '../data/fencerInfo.js';

// LoginModal — minimal "sign in by licence number" flow.
//
// We hash the entered licence client-side (SHA-256, peppered) and search
// the bundled fencers.json for a matching hash. No round trip, no
// account creation — the licence number IS the credential, the same way
// it identifies you on FeNZ entry forms.
//
// In Phase 3 this is purely cosmetic: once we know who you are we mark
// "your" profile with a "You" badge. Phase 4 will use the same session
// to gate edit submissions to the API.
export default function LoginModal({ onClose, onLogin, fencerInfo }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | error
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    const cleaned = value.trim();
    if (!cleaned) return;
    setStatus('checking');
    setError('');
    try {
      const hash = await hashLicence(cleaned);
      const match = findFencerByLicenceHash(fencerInfo, hash);
      if (match) {
        onLogin(hash, match);
        onClose();
      } else {
        setStatus('error');
        setError("That licence number isn't in our records. Double-check the number, or it may belong to a fencer who hasn't competed in any of the ingested events.");
      }
    } catch (err) {
      setStatus('error');
      setError('Something went wrong hashing the licence. Try again?');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,20,24,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--paper)', border: '1px solid var(--ink)',
          maxWidth: 460, width: '100%', padding: '28px 32px',
          boxShadow: '0 20px 60px rgba(17,20,24,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="fl-smallcaps" style={{ marginBottom: 4 }}>Sign in</div>
            <h3 className="fl-display" style={{ fontSize: '1.7rem', fontWeight: 700, margin: 0 }}>
              By licence number
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', padding: 4 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="fl-italic" style={{ color: 'var(--ink-soft)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 18 }}>
          Enter the FNZ or FIE licence number on your fencer card. Numeric
          codes (e.g. <span className="fl-mono">20391</span>) and SP-prefixed
          codes (e.g. <span className="fl-mono">SP7893420</span>) are both
          accepted. We hash it locally and compare against the registry;
          your number is never transmitted in plain text.
        </p>

        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (status === 'error') setStatus('idle'); }}
            placeholder="e.g. 20391 or SP7893420"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '12px 14px', fontSize: '1.05rem',
              fontFamily: 'JetBrains Mono, monospace',
              background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--rule)',
              borderColor: status === 'error' ? 'var(--red-light, #c44)' : 'var(--rule)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {status === 'error' && (
            <div className="fl-italic" style={{ color: 'var(--red-light, #c44)', fontSize: '0.88rem', marginTop: 10 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
            <button
              type="button"
              onClick={onClose}
              className="fl-smallcaps"
              style={{
                background: 'none', border: '1px solid var(--rule)',
                padding: '9px 18px', cursor: 'pointer', color: 'var(--ink-soft)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'checking' || !value.trim()}
              className="fl-smallcaps"
              style={{
                background: 'var(--ink)', color: 'var(--paper)',
                border: '1px solid var(--ink)', padding: '9px 22px',
                cursor: status === 'checking' || !value.trim() ? 'wait' : 'pointer',
                opacity: !value.trim() ? 0.5 : 1,
              }}
            >
              {status === 'checking' ? 'Checking…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

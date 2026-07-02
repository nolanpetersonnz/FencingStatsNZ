const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Newsreader:opsz,ital,wght@6..72,0,300;6..72,0,400;6..72,0,500;6..72,0,600;6..72,1,400;6..72,1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --paper: #F5F6F8;
  --paper-deep: #FFFFFF;
  --paper-shade: #E8EBF0;
  --ink: #111418;
  --ink-soft: #4A5058;
  --ink-faint: #8A909A;
  --rule: #D5D9DF;
  --rule-soft: #E5E8EC;
  --ox: #1A6BB5;
  --ox-deep: #0F4A85;
  --brass: #4F7CB1;
  --moss: #6A7B8E;
  --green: #1A6BB5;
  --red-light: #4A5058;
  --ink-fade: rgba(17,20,24,0.05);
  --ink-fade-2: rgba(17,20,24,0.10);
}

.fl-root { font-family: 'Newsreader', Georgia, serif; color: var(--ink); background: var(--paper); min-height: 100vh; font-size: 16px; line-height: 1.5; }
.fl-root * { box-sizing: border-box; }
.fl-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; letter-spacing: -0.01em; }
.fl-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.fl-italic { font-style: italic; font-family: 'Newsreader', Georgia, serif; }
.fl-smallcaps { font-family: 'Fraunces', Georgia, serif; text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; font-weight: 500; color: var(--ink-soft); }
.fl-rule { border-top: 1px solid var(--rule); }
.fl-rule-soft { border-top: 1px solid var(--rule-soft); }
.fl-rule-thick { border-top: 3px double var(--ink); }

.fl-link { cursor: pointer; transition: color 120ms ease, background 120ms ease; }
.fl-link:hover { color: var(--ox); }

/* Reset so inline navigation can be a real <button> (keyboard-focusable,
   screen-reader actionable) without changing how the text renders. */
button.fl-link, button.fl-tab { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; text-align: inherit; }
button.fl-tab { padding: 8px 0; margin-right: 28px; }

/* One visible keyboard-focus treatment for every interactive element. */
.fl-link:focus-visible, .fl-tab:focus-visible, .fl-pill:focus-visible,
.fl-btn:focus-visible, .fl-input:focus-visible, [role="button"]:focus-visible {
  outline: 2px solid var(--ox); outline-offset: 2px;
}

.fl-tab { padding: 8px 0; margin-right: 28px; cursor: pointer; position: relative; transition: color 120ms ease; }
.fl-tab:hover { color: var(--ox); }
.fl-tab.active { color: var(--ink); }
.fl-tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--ox); }

.fl-pill { padding: 5px 14px; border: 1px solid var(--rule); border-radius: 999px; cursor: pointer; transition: all 120ms ease; background: transparent; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'Fraunces', serif; font-weight: 500; }
.fl-pill:hover { border-color: var(--ink-soft); }
.fl-pill.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.fl-input { font-family: 'Newsreader', serif; font-size: 1rem; background: transparent; border: none; border-bottom: 1px solid var(--rule); padding: 6px 2px; outline: none; color: var(--ink); width: 100%; transition: border-color 120ms ease; }
.fl-input:focus { border-bottom-color: var(--ink); }
.fl-input::placeholder { color: var(--ink-faint); font-style: italic; }

.fl-textarea { font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; background: var(--paper-deep); border: 1px solid var(--rule); padding: 14px; outline: none; color: var(--ink); width: 100%; resize: vertical; min-height: 220px; line-height: 1.5; }
.fl-textarea:focus { border-color: var(--ink-soft); }

.fl-btn { font-family: 'Fraunces', serif; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 600; padding: 11px 22px; cursor: pointer; transition: all 120ms ease; background: var(--ink); color: var(--paper); border: 1px solid var(--ink); }
.fl-btn:hover { background: var(--ox); border-color: var(--ox); }
.fl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fl-btn.ghost { background: transparent; color: var(--ink); }
.fl-btn.ghost:hover { background: var(--ink-fade); color: var(--ink); border-color: var(--ink); }
.fl-btn.danger { background: var(--ox); border-color: var(--ox); }
.fl-btn.danger:hover { background: var(--ox-deep); border-color: var(--ox-deep); }

.fl-row-hover { transition: background-color 100ms ease; }
.fl-row-hover:hover { background: var(--ink-fade); }

.fl-tag { display: inline-block; padding: 2px 8px; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; font-family: 'Fraunces', serif; font-weight: 500; border: 1px solid var(--rule); border-radius: 2px; }
.fl-tag.ox { color: var(--ox); border-color: var(--ox); }
.fl-tag.brass { color: var(--brass); border-color: var(--brass); }
.fl-tag.moss { color: var(--moss); border-color: var(--moss); }
.fl-tag.solid-ink { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.fl-scroll::-webkit-scrollbar { width: 8px; }
.fl-scroll::-webkit-scrollbar-track { background: transparent; }
.fl-scroll::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 4px; }
.fl-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-faint); }

@keyframes fl-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.fl-fade-in { animation: fl-fade-in 240ms ease-out; }

.fl-grain {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(26,22,18,0.04) 1px, transparent 0),
    radial-gradient(circle at 17px 13px, rgba(26,22,18,0.025) 1px, transparent 0);
  background-size: 24px 24px, 31px 31px;
}

.fl-ornament { color: var(--brass); font-family: 'Fraunces', serif; }

@media (max-width: 760px) {
  .fl-hide-mobile { display: none !important; }
  .fl-stack-mobile { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
}
`;

export default STYLE;

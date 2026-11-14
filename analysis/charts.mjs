// The two SVG charts of the accuracy analysis, drawn as plain strings: no
// dependencies. Each chart is two panels on one shared scale, all bouts beside
// established bouts only. The same numbers are in the tables of ANALYSIS.md and
// in analysis/results/*.csv; a mark's exact values show on hover when the SVG
// file is opened on its own.
//
// Colours are the first two categorical slots of the dataviz reference palette
// (blue for observed, orange for predicted), checked with its validator in
// light and dark mode. The two series also differ in marker shape.

const W = 760, H = 426;
const LEFT = 52, RIGHT = 22, TOP = 120, BOTTOM = 56, GAP = 62;
const PW = (W - LEFT - RIGHT - GAP) / 2;
const PH = H - TOP - BOTTOM;

const STYLE = `
  svg { --surface: #fcfcfb; --ink: #0b0b0b; --ink2: #52514e; --muted: #898781; --grid: #e1e0d9; --axis: #c3c2b7; --s1: #2a78d6; --s2: #eb6834; }
  @media (prefers-color-scheme: dark) {
    svg { --surface: #1a1a19; --ink: #f0efec; --ink2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835; --s1: #3987e5; --s2: #d95926; }
  }
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .surface { fill: var(--surface); }
  .title { fill: var(--ink); font-size: 15px; font-weight: 600; }
  .subtitle { fill: var(--ink2); font-size: 12px; }
  .panel { fill: var(--ink); font-size: 12.5px; font-weight: 600; }
  .legend, .axis-title { fill: var(--ink2); font-size: 12px; }
  .tick { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .base { stroke: var(--axis); stroke-width: 1; }
  .ref { stroke: var(--muted); stroke-width: 1; }
  .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .s1 { stroke: var(--s1); } .s2 { stroke: var(--s2); }
  .dot { stroke: var(--surface); stroke-width: 2; }
  .f1 { fill: var(--s1); } .f2 { fill: var(--s2); }
`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const f = (v) => String(Number(v.toFixed(2)));
const panelX = (i) => LEFT + i * (PW + GAP);

// The lowest win rate on the vertical scale: 40%, or lower if a point needs it.
function floorOf(values) {
  const low = Math.min(0.4, ...values);
  return Math.floor(low * 10 + 1e-9) / 10;
}
const yOf = (v, yMin) => TOP + PH * (1 - (v - yMin) / (1 - yMin));

const circle = (x, y) => `<circle class="dot f1" cx="${f(x)}" cy="${f(y)}" r="5"/>`;
const diamond = (x, y) => `<path class="dot f2" d="M${f(x)} ${f(y - 6)}L${f(x + 6)} ${f(y)}L${f(x)} ${f(y + 6)}L${f(x - 6)} ${f(y)}Z"/>`;
const path = (cls, pts) => (pts.length > 1 ? `<path class="line ${cls}" d="${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')}"/>` : '');
const withTitle = (title, mark) => `<g><title>${esc(title)}</title>${mark}</g>`;

function yAxis(px, yMin) {
  const out = [];
  for (let t = Math.round(yMin * 10); t <= 10; t++) {
    const v = t / 10, y = yOf(v, yMin);
    out.push(`<line class="${t === Math.round(yMin * 10) ? 'base' : 'grid'}" x1="${f(px)}" x2="${f(px + PW)}" y1="${f(y)}" y2="${f(y)}"/>`);
    out.push(`<text class="tick" x="${f(px - 8)}" y="${f(y + 4)}" text-anchor="end">${pct(v)}</text>`);
  }
  return out.join('\n');
}

function shell({ title, subtitle, legend, desc, body }) {
  let lx = 16;
  const items = legend.map(({ glyph, label, width }) => {
    const item = `<g transform="translate(${lx} 70)">${glyph}<text class="legend" x="30" y="4">${esc(label)}</text></g>`;
    lx += width;
    return item;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`,
    `<title id="t">${esc(title)}</title>`,
    `<desc id="d">${esc(desc)}</desc>`,
    `<style>${STYLE}</style>`,
    `<rect class="surface" width="${W}" height="${H}"/>`,
    `<text class="title" x="16" y="26">${esc(title)}</text>`,
    `<text class="subtitle" x="16" y="46">${esc(subtitle)}</text>`,
    ...items,
    body,
    '</svg>',
    '',
  ].join('\n');
}

const KEY_OBSERVED = '<line class="line s1" x1="0" x2="22" y1="0" y2="0"/><circle class="dot f1" cx="11" cy="0" r="5"/>';
const KEY_PREDICTED = '<line class="line s2" x1="0" x2="22" y1="0" y2="0"/><path class="dot f2" d="M11 -6L17 0L11 6L5 0Z"/>';
const KEY_REFERENCE = '<line class="ref" x1="0" x2="22" y1="0" y2="0"/>';

// Calibration against the diagonal. panels: [{ title, points: [{ label,
// predicted, observed, n }] }], the points in band order.
export function calibrationChart({ title, subtitle, panels }) {
  const yMin = floorOf(panels.flatMap((p) => p.points.map((pt) => pt.observed)));
  const body = panels.map((panel, i) => {
    const px = panelX(i);
    const xOf = (v) => px + PW * (v - 0.5) / 0.5;
    const out = [`<text class="panel" x="${f(px)}" y="${TOP - 14}">${esc(panel.title)}</text>`, yAxis(px, yMin)];
    for (let t = 5; t <= 10; t++) out.push(`<text class="tick" x="${f(xOf(t / 10))}" y="${TOP + PH + 17}" text-anchor="middle">${pct(t / 10)}</text>`);
    out.push(`<text class="axis-title" x="${f(px + PW / 2)}" y="${TOP + PH + 42}" text-anchor="middle">Predicted win rate of the favourite</text>`);
    out.push(`<line class="ref" x1="${f(xOf(0.5))}" y1="${f(yOf(0.5, yMin))}" x2="${f(xOf(1))}" y2="${f(yOf(1, yMin))}"/>`);
    const pts = panel.points.map((pt) => [xOf(pt.predicted), yOf(pt.observed, yMin)]);
    out.push(path('s1', pts));
    panel.points.forEach((pt, k) => out.push(withTitle(
      `${pt.label}: predicted ${pct(pt.predicted, 1)}, observed ${pct(pt.observed, 1)}, ${pt.n} bouts`, circle(...pts[k]))));
    return out.join('\n');
  }).join('\n');
  return shell({
    title, subtitle, body,
    desc: 'Two panels, all bouts and established bouts only. In each, one point per confidence band: the predicted win rate of the favourite across, the observed win rate up, with the line where the two are equal.',
    legend: [
      { glyph: KEY_OBSERVED, label: 'Observed win rate of the favourite, by confidence band', width: 356 },
      { glyph: KEY_REFERENCE, label: 'Predicted = observed', width: 170 },
    ],
  });
}

// Observed against predicted by rating gap. panels: [{ title, points:
// [{ label, tick, predicted, observed, n }] }], the points in band order.
export function gapChart({ title, subtitle, panels }) {
  const yMin = floorOf(panels.flatMap((p) => p.points.flatMap((pt) => [pt.observed, pt.predicted])));
  const body = panels.map((panel, i) => {
    const px = panelX(i);
    const k = panel.points.length;
    const xOf = (j) => px + PW * (j + 0.5) / k;
    const out = [`<text class="panel" x="${f(px)}" y="${TOP - 14}">${esc(panel.title)}</text>`, yAxis(px, yMin)];
    panel.points.forEach((pt, j) => out.push(`<text class="tick" x="${f(xOf(j))}" y="${TOP + PH + 17}" text-anchor="middle">${esc(pt.tick)}</text>`));
    out.push(`<text class="axis-title" x="${f(px + PW / 2)}" y="${TOP + PH + 42}" text-anchor="middle">Rating gap before the competition</text>`);
    const predicted = panel.points.map((pt, j) => [xOf(j), yOf(pt.predicted, yMin)]);
    const observed = panel.points.map((pt, j) => [xOf(j), yOf(pt.observed, yMin)]);
    out.push(path('s2', predicted), path('s1', observed));
    panel.points.forEach((pt, j) => {
      const text = `Gap ${pt.label}: predicted ${pct(pt.predicted, 1)}, observed ${pct(pt.observed, 1)}, ${pt.n} bouts`;
      out.push(withTitle(text, diamond(...predicted[j])), withTitle(text, circle(...observed[j])));
    });
    return out.join('\n');
  }).join('\n');
  return shell({
    title, subtitle, body,
    desc: 'Two panels, all bouts and established bouts only. In each, for every rating gap band, the predicted and the observed win rate of the higher-rated fencer.',
    legend: [
      { glyph: KEY_OBSERVED, label: 'Observed', width: 110 },
      { glyph: KEY_PREDICTED, label: 'Predicted', width: 110 },
    ],
  });
}

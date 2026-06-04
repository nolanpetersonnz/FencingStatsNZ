export const fmtRating = (r) => Math.round(r).toString();
export const fmtRD = (rd) => `±${Math.round(rd)}`;
export const conservativeRating = (rating, rd, k = 1) => rating - k * rd;
export const fmtConservativeRating = (rating, rd, k = 1) =>
  Math.round(conservativeRating(rating, rd, k)).toString();
// Plausible range for a rating, ±k RD. We reuse displayK as the half-width on
// purpose: the lower bound is then exactly the conservative number shown as the
// headline rating, so the two readings agree instead of implying two different
// uncertainties. k=1 is roughly a one-sigma (~68%) band; widen k for a stricter
// interval.
export const ratingInterval = (rating, rd, k = 1) => [rating - k * rd, rating + k * rd];
export const fmtInterval = (rating, rd, k = 1) => {
  const [lo, hi] = ratingInterval(rating, rd, k);
  return `${Math.round(lo)}–${Math.round(hi)}`;
};
// Sweep odds as a percent, for the tableau. Sweeping a whole draw can be very
// unlikely, so floor near-zero values at "<0.1%" rather than show a misleading
// "0.0%", and give one decimal under 10%.
export const fmtSweepOdds = (p) => {
  if (p == null) return '—';
  if (p > 0 && p < 0.001) return '<0.1%';
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
};
export const fmtDelta = (d) => {
  const v = Math.round(d);
  if (v === 0) return '·0';
  return v > 0 ? `+${v}` : `${v}`;
};
export const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  const mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${parseInt(day,10)} ${mn[parseInt(m,10)-1]} ${y}`;
};
export const fmtDateShort = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y) return d;
  return `${day}/${m}/${y.slice(2)}`;
};

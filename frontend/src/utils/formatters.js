export const fmtRating = (r) => Math.round(r).toString();
export const fmtRD = (rd) => `±${Math.round(rd)}`;
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

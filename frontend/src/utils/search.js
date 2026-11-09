// Competition search (v1.1, I-22). In the user study, a search for a
// competition in the header box (fencers and clubs only) came back with
// fencers whose names merely contained the letters. This one reads the
// competition's name and year and nothing else, and every word typed has to
// match: a word of the name that starts with it, or for a number, a whole
// word of the name or the competition's year. A plural "s" is dropped on both
// sides, so "Nationals" finds "National Championship", and accents and case
// are ignored.

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const isNumber = (w) => /^\d+$/.test(w);

export function competitionMatches(comp, query) {
  const wanted = words(query).map(stem);
  if (wanted.length === 0) return true;
  const name = words(comp?.name).map(stem);
  const year = String(comp?.date ?? '').slice(0, 4);
  return wanted.every((w) => (isNumber(w)
    ? w === year || name.includes(w)
    : name.some((n) => n.startsWith(w))));
}

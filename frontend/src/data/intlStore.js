// Storage for the international results prototype (PANELS.md 2.5). Records
// live in this browser only and are never sent anywhere, so the prototype
// can't touch live data. A server queue replaces this once FeNZ and the
// portal's maintainer agree who holds international points (PANELS.md 0).

const KEY = 'fl_intl_prototype';

export function loadIntl() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private mode, blocked storage or a bad value: no records
  }
}

export function saveIntl(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearIntl() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored, or storage blocked */
  }
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

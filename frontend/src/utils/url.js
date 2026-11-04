// A club website comes from the admin panel (stored in Upstash, served by
// /api/overrides), so it is checked again before it becomes an href. Only
// http(s) links pass; anything else, such as a javascript: URL, gives null
// and renders as no link. A bare domain ("club.nz") is read as https.
// Keep in step with normaliseWebsite in api/admin.js (parity test in
// test/api.test.js).
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  let url;
  try {
    url = new URL(s);
  } catch {
    try {
      url = new URL(`https://${s}`);
    } catch {
      return null;
    }
    if (!url.hostname.includes('.')) return null;
  }
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
}

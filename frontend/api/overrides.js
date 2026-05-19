// GET /api/overrides
//
// Public — returns the data layered on top of fencers.json at app load:
// applied name/club overrides and currently-flagged bout fingerprints.
// The client merges this into its in-memory fencers map and the bout
// list. Cached for 30 s at the edge so a single tab refresh doesn't
// hammer Upstash.

import { redis } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

  try {
    const db = redis();
    const [overridesRaw, flagged, clubMetaRaw] = await Promise.all([
      db.get('overrides'),
      db.smembers('flagged_bouts'),
      db.get('club_meta'),
    ]);
    const overrides = overridesRaw
      ? (typeof overridesRaw === 'string' ? JSON.parse(overridesRaw) : overridesRaw)
      : { name_overrides: {}, club_overrides: {} };
    const clubMeta = clubMetaRaw
      ? (typeof clubMetaRaw === 'string' ? JSON.parse(clubMetaRaw) : clubMetaRaw)
      : {};
    res.status(200).json({
      name_overrides: overrides.name_overrides || {},
      club_overrides: overrides.club_overrides || {},
      flagged_bouts: Array.isArray(flagged) ? flagged : [],
      club_meta: clubMeta,
    });
  } catch (e) {
    console.warn('overrides-fetch-failed', e);
    res.status(200).json({ name_overrides: {}, club_overrides: {}, flagged_bouts: [], club_meta: {} });
  }
}

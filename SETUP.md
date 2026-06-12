# Phase 4 setup - fencer profile edits

The login + edit features run on Vercel Functions backed by Upstash Redis. Reading the public site doesn't touch the backend; the API only matters when a signed-in fencer submits an edit or you visit `/#admin`.

## 1. Provision Upstash Redis

1. In Vercel, open your `fencingstatsnz` project.
2. Go to **Storage → Marketplace Database Providers → Upstash**.
3. Add a Redis database (free tier is fine, 10k commands/day). Pick the region closest to your Vercel deploy region.
4. When prompted, **connect the database to the project**. Vercel auto-populates env vars with a `KV_*` prefix:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - (plus `KV_REST_API_READ_ONLY_TOKEN` and `KV_URL` which we don't use)

The code in `frontend/api/_lib.js` reads both naming conventions (`KV_REST_API_*` and `UPSTASH_REDIS_REST_*`), so the defaults Vercel provides work out of the box, no renaming required. If you install Upstash directly (not via Vercel marketplace), use the `UPSTASH_REDIS_REST_*` names instead.

## 2. Set the admin token

Generate a long random string (use `openssl rand -hex 32` or a password manager).

In Vercel: **Settings → Environment Variables**:
- Key: `ADMIN_TOKEN`
- Value: the random string
- Environments: Production + Preview + Development

This is the bearer token you'll paste once into `/#admin` to manage the edit queue.

## 3. Local dev

`.env` and `frontend/.env` already hold `VITE_LICENCE_PEPPER`. For local API testing, add Upstash + admin vars to a gitignored `.env.local` in `frontend/`. You can pull the production values down with `vercel env pull frontend/.env.local` once the Upstash integration is connected, or paste manually:

```
KV_REST_API_URL=https://....upstash.io
KV_REST_API_TOKEN=...
ADMIN_TOKEN=...
```

Then run `vercel dev` (install the Vercel CLI first) to test functions locally. Plain `npm run dev` works for everything except `/api/*`.

## 4. Deploy

After redeploying, the site automatically tries `GET /api/overrides` at load time. If Upstash isn't connected, the call returns an empty doc and the site behaves as before.

## What edits do what

| Kind | Trigger | Where it goes | Visible immediately? |
|---|---|---|---|
| Display name | Own profile → Edit panel | `overrides.name_overrides[key]` | Yes |
| Current club | Own profile → Edit panel | `overrides.club_overrides[key]` | Yes |
| Merge duplicates | Own profile → Edit panel | Admin queue | After approval |
| Dispute bout | "Dispute" button on your own bout row | Admin queue + `flagged_bouts` set | Badge appears immediately |

Live edits (name/club) are revertible from the admin page. Reverting clears the override and the bout-derived value reappears.

## Admin page

Visit `https://<yoursite>/#admin`. First load asks for the token; it persists in localStorage. Filter by `pending` / `applied` / `all`. Approve, reject, or revert from the row.

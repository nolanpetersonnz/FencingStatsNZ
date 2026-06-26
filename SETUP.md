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

---

# Phase 5 setup - refresh results from FeNZ

The **Refresh** tab in `/#admin` adds a "Refresh from FeNZ" button that re-runs the Python ingest, regenerates `ingest/bouts.csv`, and commits it to `main`, which redeploys the live site. The work happens in the `refresh-data` GitHub Actions workflow (already in the repo); the button only triggers it and reads back the result. Reading the public site never touches any of this.

This is optional. With no token configured, the Refresh tab simply explains that it isn't wired up, and you can keep updating the dataset by hand (`python ingest/fenz_ingest.py ... ` then commit, as in the README).

## 1. Create a GitHub token

Generate a fine-grained personal access token (GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**):

- **Repository access:** only this repository (`nolanpetersonnz/FencingStatsNZ`).
- **Permissions:**
  - **Contents: Read and write** (lets the button trigger the workflow via `repository_dispatch`, and read the data commit log).
  - **Actions: Read-only** (lets the panel show whether a run is in progress).
  - Metadata: Read-only (added automatically).

The workflow's own push back to `main` uses the built-in `GITHUB_TOKEN`, so the token above is only for the trigger and the status reads.

## 2. Set the env vars

In Vercel: **Settings → Environment Variables**:

- Key: `GH_DISPATCH_TOKEN`, Value: the token from step 1. Environments: Production (add Preview/Development if you test there).
- Optional: `GH_REPO` = `owner/name`. Defaults to `nolanpetersonnz/FencingStatsNZ`; set it only if you fork or rename.

Redeploy so the function picks up the new env.

## 3. Use it

Open `/#admin` → **Refresh**:

- **Refresh from FeNZ** kicks off a run. It pulls the latest competitions, regenerates the dataset, runs the test suite, and commits. The new data is live a few minutes later, after the commit redeploys. The panel polls and shows the run status while it works.
- **Recent data changes** lists the commits to `ingest/bouts.csv` (the audit log is just git history). Each refresh shows what changed (bout delta and the new competitions).
  - **Accept** acknowledges a refresh (clears its "needs review" marker). Bookkeeping only.
  - **Revert** rolls a change back: it restores the `bouts.csv` from before that commit and redeploys. Use it on the most recent refresh if something looks wrong.

You can also run the workflow by hand from the repository's **Actions → refresh-data → Run workflow**, with optional `scan_from` / `scan_to` overrides.

## What the refresh actions do

| Action | Trigger | Effect | Live when? |
|---|---|---|---|
| Refresh | Refresh tab button | Regenerates `bouts.csv` from the FeNZ API, commits to `main` | After redeploy (minutes) |
| Accept | Per-row in the log | Marks that refresh reviewed (Upstash `refresh_reviewed` set) | Immediately |
| Revert | Per-row in the log | Restores the pre-refresh `bouts.csv`, commits to `main` | After redeploy (minutes) |

## Safety and the scan window

A full rebuild reads competitions in a cmpId range (`--scan SCAN_FROM SCAN_TO`, default `1100`..`100000`, filtered to `--since 2024-01-01`), set in the workflow's `env:` block. The scan auto-stops about 30 blank ids past the newest competition, so the high ceiling is free.

Two guards keep a bad run from shipping:

- **Shrink-guard:** if the regenerated file lost more than 10% of its rows (a scan range set too high silently drops early competitions), the workflow aborts before overwriting. If you see `new file has N rows vs M committed`, lower `SCAN_FROM`.
- **Tests:** `npm test` runs against the regenerated dataset before the commit, so a malformed `bouts.csv` fails the run instead of deploying.

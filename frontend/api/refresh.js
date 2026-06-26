// Admin-only. Drives the "Refresh from FeNZ" data pipeline and serves the
// refresh log. Gated by Bearer token === ADMIN_TOKEN (same as /api/admin).
//
//   GET  /api/refresh            -> { configured, repo, running, latest_run, entries }
//   POST /api/refresh  body { action: 'refresh' }          -> fire a refresh run
//   POST /api/refresh  body { action: 'revert', sha }       -> roll back a refresh
//   POST /api/refresh  body { action: 'accept', sha }       -> mark a refresh reviewed
//
// The actual work runs in the refresh-data GitHub Actions workflow; this
// endpoint only triggers it (via repository_dispatch) and reads back state.
// The data itself is committed to git by the workflow, so the "log" is just
// the recent commit history of ingest/bouts.csv — nothing to trust beyond git.
//
// Env: GH_DISPATCH_TOKEN (fine-grained PAT, this repo: Contents read+write,
// Actions read, Metadata read), GH_REPO (owner/name; defaults to the canonical
// repo). See SETUP.md Phase 5.

import { isAdmin, readJsonBody, redis } from './_lib.js';

const GH_API = 'https://api.github.com';
const WORKFLOW_FILE = 'refresh-data.yml';
// Upstash set of commit shas an admin has acknowledged ("Accept"). Kept tiny
// and out of band from the data itself, which lives in git.
const REVIEWED_KEY = 'refresh_reviewed';
// A bare git sha, short or full. Validated before it ever reaches the workflow.
const SHA_RE = /^[0-9a-f]{7,40}$/i;

const repoSlug = () => process.env.GH_REPO || 'nolanpetersonnz/FencingStatsNZ';
const ghToken = () => process.env.GH_DISPATCH_TOKEN || '';

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub rejects API calls without a User-Agent.
    'User-Agent': 'fencingstatsnz-refresh',
  };
}

function ghFetch(path, token, init = {}) {
  return fetch(`${GH_API}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init.headers || {}) },
  });
}

// repository_dispatch — kicks the workflow. Returns the raw response (204 = ok).
function dispatch(token, eventType, clientPayload) {
  return ghFetch(`/repos/${repoSlug()}/dispatches`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload || {} }),
  });
}

async function latestRuns(token, perPage = 5) {
  const res = await ghFetch(
    `/repos/${repoSlug()}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${perPage}`,
    token,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
}

// Commits that touched the dataset, newest first — the audit trail the admin
// reviews. Includes manual maintainer commits too, tagged by kind below.
async function recentDataCommits(token, perPage = 15) {
  const res = await ghFetch(
    `/repos/${repoSlug()}/commits?path=ingest/bouts.csv&per_page=${perPage}`,
    token,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function reviewedSet() {
  // A missing/down Upstash shouldn't blank the whole log — degrade to "none
  // reviewed" rather than throwing.
  try {
    const members = await redis().smembers(REVIEWED_KEY);
    return new Set(Array.isArray(members) ? members : []);
  } catch {
    return new Set();
  }
}

function classify(subject) {
  if (/^data: revert/i.test(subject)) return 'revert';
  if (/^data: refresh/i.test(subject)) return 'refresh';
  return 'manual';
}

async function buildLog(token) {
  const [runs, commits, reviewed] = await Promise.all([
    latestRuns(token),
    recentDataCommits(token),
    reviewedSet(),
  ]);
  // The workflow is single-concurrency, so the newest run's status is the
  // pipeline's status. "running" means a refresh is mid-flight.
  const top = runs[0] || null;
  const running = !!top && top.status !== 'completed';
  const latest_run = top
    ? { status: top.status, conclusion: top.conclusion, html_url: top.html_url, created_at: top.created_at }
    : null;

  const entries = commits.map((c) => {
    const message = c.commit?.message || '';
    const nl = message.indexOf('\n');
    const subject = nl === -1 ? message : message.slice(0, nl);
    const body = nl === -1 ? '' : message.slice(nl).trim();
    return {
      sha: c.sha,
      short: (c.sha || '').slice(0, 7),
      date: c.commit?.author?.date || c.commit?.committer?.date || null,
      subject,
      body,
      html_url: c.html_url,
      kind: classify(subject),
      reviewed: reviewed.has(c.sha),
    };
  });

  return { configured: true, repo: repoSlug(), running, latest_run, entries };
}

export default async function handler(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const token = ghToken();

  if (req.method === 'GET') {
    if (!token) {
      res.status(200).json({ configured: false, repo: repoSlug() });
      return;
    }
    try {
      res.status(200).json(await buildLog(token));
    } catch (e) {
      // Surface the failure but keep the shape the UI expects.
      res.status(200).json({
        configured: true, repo: repoSlug(), running: false,
        latest_run: null, entries: [], error: String(e?.message || e),
      });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const action = String(body?.action || '');

  // Acknowledge a shipped refresh. Pure bookkeeping — doesn't touch the data.
  if (action === 'accept') {
    const sha = String(body?.sha || '');
    if (!SHA_RE.test(sha)) { res.status(400).json({ error: 'valid sha required' }); return; }
    try {
      await redis().sadd(REVIEWED_KEY, sha);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(503).json({ error: 'reviewed-store unavailable: ' + (e?.message || e) });
    }
    return;
  }

  // refresh and revert both fire a dispatch, which needs the GitHub token.
  if (!token) {
    res.status(503).json({ error: 'GH_DISPATCH_TOKEN not set - see SETUP.md Phase 5' });
    return;
  }

  if (action === 'refresh') {
    // Don't stack a second run on one already in flight.
    try {
      const runs = await latestRuns(token, 1);
      if (runs.length && runs[0].status !== 'completed') {
        res.status(409).json({ error: 'a refresh is already running', run_url: runs[0].html_url });
        return;
      }
    } catch {
      // If the status check itself fails, let the dispatch attempt proceed.
    }
    const r = await dispatch(token, 'refresh-data', {});
    if (r.status === 204) { res.status(202).json({ ok: true }); return; }
    const detail = await r.text().catch(() => '');
    res.status(502).json({ error: `dispatch failed (${r.status})`, detail: detail.slice(0, 300) });
    return;
  }

  if (action === 'revert') {
    const sha = String(body?.sha || '');
    if (!SHA_RE.test(sha)) { res.status(400).json({ error: 'valid sha required' }); return; }
    const r = await dispatch(token, 'revert-data', { sha });
    if (r.status === 204) { res.status(202).json({ ok: true }); return; }
    const detail = await r.text().catch(() => '');
    res.status(502).json({ error: `dispatch failed (${r.status})`, detail: detail.slice(0, 300) });
    return;
  }

  res.status(400).json({ error: 'unknown action' });
}

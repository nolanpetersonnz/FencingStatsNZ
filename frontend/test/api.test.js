// Tests for the API/auth layer: frontend/api/*.js plus the client-side
// helpers that must stay byte-identical with it (bout fingerprints,
// licence normalisation and hashing). No network and no Redis: only the
// pure helpers and the handler paths that return before touching either.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Scrub every env var the API layer reads before importing anything, so
// a developer's real Upstash credentials or admin token can never leak
// into (or be mutated by) a test run.
for (const k of [
  'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'REDIS_REST_URL', 'REDIS_REST_TOKEN',
  'ADMIN_TOKEN', 'GH_DISPATCH_TOKEN', 'GH_REPO',
]) delete process.env[k];

import { boutFingerprint as serverFingerprint, nameKey as serverNameKey, isAdmin } from '../api/_lib.js';
import { boutFingerprint as clientFingerprint } from '../src/data/edits.js';
import { nameKey as pipelineNameKey } from '../src/data/pipeline.js';
import { normaliseLicence, hashLicence } from '../src/data/fencerInfo.js';
import editHandler, { validatePayload, resolveFencerKey } from '../api/edit.js';
import adminHandler, { validateMergeRequest, applyMergeFencers } from '../api/admin.js';
import overridesHandler from '../api/overrides.js';
import refreshHandler from '../api/refresh.js';

// Minimal stand-in for Vercel's res object; records what the handler did.
function mockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

// ---------------------------------------------------------------------------
// boutFingerprint parity: api/_lib.js and src/data/edits.js each carry a
// copy (the server can't import Vite-flavoured client code). The server
// stores fingerprints in Redis and the client matches against them to
// render dispute badges, so any divergence silently breaks flagging.
// ---------------------------------------------------------------------------

const baseBout = {
  fencer_a: 'Alice Smith', fencer_b: 'Bob Jones',
  score_a: 15, score_b: 9,
  date: '2024-05-01', competition: 'NZ Open', weapon: 'Epee',
};

const fingerprintVectors = [
  ['basic bout', baseBout],
  ['alternate field names (keyA/scoreA shape)', {
    keyA: 'alice smith', keyB: 'bob jones', scoreA: '15', scoreB: '9',
    date: '2024-05-01', competition: 'NZ Open', weapon: 'Epee',
  }],
  ['reversed fencer order', {
    fencer_a: 'Bob Jones', fencer_b: 'Alice Smith', score_a: 9, score_b: 15,
    date: '2024-05-01', competition: 'NZ Open', weapon: 'Epee',
  }],
  ['odd whitespace and casing', {
    fencer_a: '  ALICE   smith ', fencer_b: 'bob  JONES', score_a: ' 15 ', score_b: '9',
    date: ' 2024-05-01 ', competition: '  NZ OPEN ', weapon: ' EPEE ',
  }],
  ['all fields missing', {}],
  ['missing scores', { fencer_a: 'A', fencer_b: 'B', date: '2024-01-01' }],
  ['null score_a falls through to scoreA', {
    fencer_a: 'A', fencer_b: 'B', score_a: null, scoreA: 7, score_b: 3,
    date: '2024-01-01', competition: 'X', weapon: 'foil',
  }],
  ['zero score survives (?? not ||)', {
    fencer_a: 'A', fencer_b: 'B', score_a: 0, score_b: 5,
    date: '2024-01-01', competition: 'X', weapon: 'foil',
  }],
];

for (const [name, bout] of fingerprintVectors) {
  test(`boutFingerprint parity: ${name}`, () => {
    assert.equal(serverFingerprint(bout), clientFingerprint(bout));
  });
}

// Pin the exact wire format. Fingerprints already persisted in Redis
// must keep matching after a redeploy, so changing this string is a
// data migration, not a refactor.
test('boutFingerprint canonical format is stable', () => {
  assert.equal(
    serverFingerprint(baseBout),
    '2024-05-01|epee|nz open|alice smith|bob jones|15|9',
  );
});

test('boutFingerprint is order-independent in both implementations', () => {
  const swapped = {
    ...baseBout,
    fencer_a: baseBout.fencer_b, fencer_b: baseBout.fencer_a,
    score_a: baseBout.score_b, score_b: baseBout.score_a,
  };
  assert.equal(serverFingerprint(swapped), serverFingerprint(baseBout));
  assert.equal(clientFingerprint(swapped), clientFingerprint(baseBout));
});

test('boutFingerprint collapses whitespace/casing variants to one fingerprint', () => {
  // The dispute flag only renders if the fingerprint of a re-parsed
  // bout matches the stored one, so cosmetic variance must not matter.
  assert.equal(serverFingerprint(fingerprintVectors[3][1]), serverFingerprint(baseBout));
});

test('nameKey parity between api/_lib.js and src/data/pipeline.js', () => {
  // The fingerprint depends on nameKey, which is also duplicated
  // server-side. Divergence here would break parity indirectly.
  for (const s of ['  Joel   Ball-La Hood ', 'ALICE smith', '', null, ' A\tB ']) {
    assert.equal(serverNameKey(s), pipelineNameKey(s));
  }
});

// ---------------------------------------------------------------------------
// Licence normalisation: golden vectors mirroring normalise_licence() in
// ingest/fencerinfo_ingest.py (lines 109-115, regexes at lines 106-107).
// Python can't run inside this suite, so these expected values are derived
// from that source by hand. If the Python normaliser changes, these vectors
// must be re-derived or login hashes stop matching the shipped registry.
// ---------------------------------------------------------------------------

const licenceVectors = [
  // [input, expected]
  ['FNZ #20499', '20499'],        // documented cruft case
  ['fnz#20499', '20499'],         // prefix regex is case-insensitive
  ['FENZ 20499', '20499'],        // FE?NZ matches both FNZ and FENZ
  ['FNZ #FNZ #20499', '20499'],   // (prefix)+ strips repeated cruft
  ["20377'", '20377'],            // documented trailing-quote case
  ['  20499  ', '20499'],
  ['sp7893420', 'SP7893420'],     // SP-prefixed licences upper-cased
  [' sp7893420 ', 'SP7893420'],
  ["SP7893420''", 'SP7893420'],
  ['FNZ #', ''],                  // cruft-only input normalises to empty
  ['', ''],
  [null, ''],
];

for (const [input, expected] of licenceVectors) {
  test(`normaliseLicence(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normaliseLicence(input), expected);
  });
}

// ---------------------------------------------------------------------------
// Licence hash formula: sha256(`${pepper}|${normalised}`), UTF-8, lowercase
// hex. Must match hash_licence() in ingest/fencerinfo_ingest.py (line 118).
// Under Node import.meta.env is absent (it's Vite-only), so the app module's
// pepper is '', which lets us pin the app function against the formula. The
// non-empty-pepper golden below pins the formula itself for the Python side.
// ---------------------------------------------------------------------------

// The same formula the ingest script implements, expressed with node:crypto.
function hashWithPepper(pepper, licence) {
  return createHash('sha256')
    .update(`${pepper}|${normaliseLicence(licence)}`, 'utf8')
    .digest('hex');
}

test('hashLicence implements sha256(pepper + "|" + normalised licence)', async () => {
  // Golden vector: sha256('|20499') with the empty pepper Node sees.
  // Pins separator, pepper-first order, normalisation-before-hash,
  // UTF-8 encoding and lowercase hex all at once.
  const golden = 'd6b53e0cef9b24d49b7e427e0d5320d187e2d4cf59ff0f5cfbf65c34571e8196';
  assert.equal(await hashLicence('FNZ #20499'), golden);
  assert.equal(hashWithPepper('', 'FNZ #20499'), golden);
});

test('licence hash golden vector for a non-empty pepper', () => {
  // Python's hash_licence('sp7893420', 'test-pepper') must produce this
  // exact hex. The app function can't be exercised with a custom pepper
  // because Vite bakes VITE_LICENCE_PEPPER in at build time, so this
  // golden guards the formula both sides implement.
  assert.equal(
    hashWithPepper('test-pepper', 'sp7893420'),
    '2c03f5a615a34e5dd5c545b6038f88ff40e9dc8786a0fb43fd83c4759e2166db',
  );
});

// ---------------------------------------------------------------------------
// isAdmin: the only gate on /api/admin and /api/refresh. The critical
// property is failing closed when ADMIN_TOKEN is unset or empty, since a
// misconfigured deploy must not hand out admin rights.
// ---------------------------------------------------------------------------

async function withAdminToken(value, fn) {
  const prev = process.env.ADMIN_TOKEN;
  if (value === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = value;
  // Await inside the try so the env restore can't race an async body.
  try { return await fn(); } finally {
    if (prev === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = prev;
  }
}

const bearer = (t) => ({ headers: { authorization: `Bearer ${t}` } });

test('isAdmin accepts the correct bearer token', async () => {
  await withAdminToken('s3cret-token', () => {
    assert.ok(isAdmin(bearer('s3cret-token')));
  });
});

test('isAdmin tolerates whitespace around the token', async () => {
  await withAdminToken('s3cret-token', () => {
    assert.ok(isAdmin({ headers: { authorization: 'Bearer   s3cret-token  ' } }));
  });
});

test('isAdmin rejects a wrong token', async () => {
  await withAdminToken('s3cret-token', () => {
    assert.ok(!isAdmin(bearer('wrong')));
  });
});

test('isAdmin rejects a missing or malformed Authorization header', async () => {
  await withAdminToken('s3cret-token', () => {
    assert.ok(!isAdmin({ headers: {} }));
    assert.ok(!isAdmin({}));
    assert.ok(!isAdmin({ headers: { authorization: 's3cret-token' } }));
    assert.ok(!isAdmin({ headers: { authorization: 'Basic s3cret-token' } }));
  });
});

test('isAdmin fails closed when ADMIN_TOKEN is unset', async () => {
  await withAdminToken(undefined, () => {
    assert.ok(!isAdmin(bearer('anything')));
    // Guard the classic footgun: a literal "undefined" token must not
    // compare equal to the missing env var.
    assert.ok(!isAdmin(bearer('undefined')));
  });
});

test('isAdmin fails closed when ADMIN_TOKEN is the empty string', async () => {
  await withAdminToken('', () => {
    assert.ok(!isAdmin(bearer('x')));
    // "Bearer " with nothing after it must not match an empty token.
    assert.ok(!isAdmin({ headers: { authorization: 'Bearer ' } }));
  });
});

// ---------------------------------------------------------------------------
// edit.js validation
// ---------------------------------------------------------------------------

test('validatePayload: display_name limits', () => {
  assert.equal(validatePayload('display_name', { display_name: 'Alice Smith' }), null);
  assert.equal(validatePayload('display_name', { display_name: 'x'.repeat(80) }), null);
  assert.ok(validatePayload('display_name', { display_name: '' }));
  assert.ok(validatePayload('display_name', { display_name: '   ' }));
  assert.ok(validatePayload('display_name', { display_name: 'x'.repeat(81) }));
  assert.ok(validatePayload('display_name', {}));
});

test('validatePayload: current_club limits (empty means unaffiliated)', () => {
  assert.equal(validatePayload('current_club', { current_club: 'Salle Auckland' }), null);
  assert.equal(validatePayload('current_club', { current_club: '' }), null);
  assert.equal(validatePayload('current_club', { current_club: 'x'.repeat(120) }), null);
  assert.ok(validatePayload('current_club', { current_club: 'x'.repeat(121) }));
});

test('validatePayload: merge requires a target within length limit', () => {
  assert.equal(validatePayload('merge', { merge_into: 'bob jones' }), null);
  assert.equal(validatePayload('merge', { merge_into: 'x'.repeat(200) }), null);
  assert.ok(validatePayload('merge', {}));
  assert.ok(validatePayload('merge', { merge_into: '  ' }));
  assert.ok(validatePayload('merge', { merge_into: 'x'.repeat(201) }));
});

test('validatePayload: dispute requires a bout and a bounded reason', () => {
  assert.equal(validatePayload('dispute', { bout: baseBout, reason: 'wrong score' }), null);
  assert.equal(validatePayload('dispute', { bout: baseBout }), null);
  assert.equal(validatePayload('dispute', { bout: baseBout, reason: 'x'.repeat(500) }), null);
  assert.ok(validatePayload('dispute', { reason: 'no bout attached' }));
  assert.ok(validatePayload('dispute', { bout: baseBout, reason: 'x'.repeat(501) }));
});

test('validatePayload: unknown kinds are rejected', () => {
  assert.equal(validatePayload('delete_everything', {}), 'unknown kind');
});

test('resolveFencerKey accepts the requested key only if it is a known alias', () => {
  const fencer = { name_keys: ['Jane Doe', 'J Doe'] };
  // Alias match is normalised, so cosmetic variance is fine.
  assert.equal(resolveFencerKey(fencer, '  JANE   Doe '), 'jane doe');
  assert.equal(resolveFencerKey(fencer, 'j doe'), 'j doe');
  // A key that isn't one of this fencer's aliases would let a signed-in
  // person edit someone else's profile; it must fall back to their own
  // canonical key instead.
  assert.equal(resolveFencerKey(fencer, 'someone else'), 'jane doe');
  assert.equal(resolveFencerKey(fencer, undefined), 'jane doe');
  assert.equal(resolveFencerKey(fencer, 42), 'jane doe');
});

test('resolveFencerKey returns null for a record with no name keys', () => {
  assert.equal(resolveFencerKey({ name_keys: [] }, 'jane doe'), null);
  assert.equal(resolveFencerKey({}, 'jane doe'), null);
});

// ---------------------------------------------------------------------------
// admin.js merge logic
// ---------------------------------------------------------------------------

test('validateMergeRequest normalises keys and rejects self-merges', () => {
  const ok = validateMergeRequest({ source_key: '  Alice Smith ', target_key: 'BOB JONES', target_name: ' Bob Jones ' });
  assert.equal(ok.error, null);
  assert.equal(ok.source, 'alice smith');
  assert.equal(ok.target, 'bob jones');
  assert.equal(ok.targetName, 'Bob Jones');
  // Self-merge caught even when the two spellings differ cosmetically.
  assert.ok(validateMergeRequest({ source_key: 'alice', target_key: ' ALICE ' }).error);
  assert.ok(validateMergeRequest({ target_key: 'bob' }).error);
});

test('validateMergeRequest allows an empty target (unmerge)', () => {
  const v = validateMergeRequest({ source_key: 'alice' });
  assert.equal(v.error, null);
  assert.equal(v.target, '');
});

test('applyMergeFencers: plain merge stores target, name and edit id', () => {
  const doc = applyMergeFencers({}, 'alice', 'bob', 'Bob Jones', 'admin-1');
  assert.deepEqual(doc.alice, { merge_into: 'bob', merge_into_name: 'Bob Jones', edit_id: 'admin-1' });
});

test('applyMergeFencers: chains collapse to the ultimate target', () => {
  // B is already merged into C; merging A into B must point A straight
  // at C so reads never have to walk chains.
  const doc = { bob: { merge_into: 'carol', merge_into_name: null, edit_id: 'admin-0' } };
  applyMergeFencers(doc, 'alice', 'bob', '', 'admin-1');
  assert.equal(doc.alice.merge_into, 'carol');
  // The existing B -> C entry is untouched.
  assert.equal(doc.bob.merge_into, 'carol');
});

test('applyMergeFencers: empty target deletes the merge (unmerge)', () => {
  const doc = { alice: { merge_into: 'bob', merge_into_name: null, edit_id: 'admin-0' } };
  applyMergeFencers(doc, 'alice', '', '', 'admin-1');
  assert.ok(!('alice' in doc));
});

test('applyMergeFencers: a pre-existing cycle in the doc terminates', () => {
  // A corrupt doc with a b <-> c loop must not hang the walk; the seen
  // set stops it once a key repeats. Landing anywhere in the loop is
  // acceptable, we only guarantee termination.
  const doc = {
    bob: { merge_into: 'carol', merge_into_name: null, edit_id: 'x' },
    carol: { merge_into: 'bob', merge_into_name: null, edit_id: 'x' },
  };
  applyMergeFencers(doc, 'alice', 'bob', '', 'admin-1');
  assert.ok(['bob', 'carol'].includes(doc.alice.merge_into));
});

test('applyMergeFencers: empty target name is stored as null', () => {
  const doc = applyMergeFencers({}, 'alice', 'bob', '', 'admin-1');
  assert.equal(doc.alice.merge_into_name, null);
});

// ---------------------------------------------------------------------------
// Handler-level gates. Only the paths that return before any Redis or
// network call are exercised; the storage layer itself would need infra
// mocking that this suite deliberately avoids.
// ---------------------------------------------------------------------------

test('GET /api/overrides fails open to an empty doc when Redis is unconfigured', async () => {
  // With no Redis env vars, redis() throws inside the try block and the
  // endpoint degrades to the empty shape so the public site still loads.
  const res = mockRes();
  await overridesHandler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    name_overrides: {}, club_overrides: {}, flagged_bouts: [], club_meta: {}, merges: {},
  });
});

test('non-GET /api/overrides is rejected', async () => {
  const res = mockRes();
  await overridesHandler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
});

test('POST /api/edit rejects non-POST, missing hash, bad kind, bad payload', async () => {
  let res = mockRes();
  await editHandler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);

  res = mockRes();
  await editHandler({ method: 'POST', body: { kind: 'display_name', payload: { display_name: 'A' } } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /licence_hash/);

  res = mockRes();
  await editHandler({ method: 'POST', body: { licence_hash: 'deadbeef', kind: 'nope', payload: {} } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /invalid edit kind/);

  res = mockRes();
  await editHandler({ method: 'POST', body: { licence_hash: 'deadbeef', kind: 'display_name', payload: { display_name: '' } } }, res);
  assert.equal(res.statusCode, 400);
});

test('POST /api/edit rejects a hash that matches no fencer with 401', async () => {
  // A hash that isn't 64 chars short-circuits in fencerForHash before
  // any file or Redis access, so this exercises the auth path cleanly.
  const res = mockRes();
  await editHandler({
    method: 'POST',
    body: { licence_hash: 'deadbeef', kind: 'display_name', payload: { display_name: 'A' } },
  }, res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /unknown licence/);
});

test('/api/refresh is closed to non-admins', async () => {
  await withAdminToken(undefined, async () => {
    const res = mockRes();
    await refreshHandler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

test('GET /api/refresh reports unconfigured when GH_DISPATCH_TOKEN is missing', async () => {
  await withAdminToken('t0ken', async () => {
    const res = mockRes();
    await refreshHandler({ method: 'GET', ...bearer('t0ken') }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.configured, false);
  });
});

test('POST /api/refresh validates shas before doing anything', async () => {
  await withAdminToken('t0ken', async () => {
    // accept: sha checked before the reviewed-store is touched.
    let res = mockRes();
    await refreshHandler({ method: 'POST', ...bearer('t0ken'), body: { action: 'accept', sha: 'not-a-sha' } }, res);
    assert.equal(res.statusCode, 400);

    // revert: sha checked before any dispatch to GitHub.
    const prevGh = process.env.GH_DISPATCH_TOKEN;
    process.env.GH_DISPATCH_TOKEN = 'fake-gh-token';
    try {
      res = mockRes();
      await refreshHandler({ method: 'POST', ...bearer('t0ken'), body: { action: 'revert', sha: 'zzzz' } }, res);
      assert.equal(res.statusCode, 400);
    } finally {
      if (prevGh === undefined) delete process.env.GH_DISPATCH_TOKEN;
      else process.env.GH_DISPATCH_TOKEN = prevGh;
    }

    // refresh/revert without a GH token fail with a setup hint, not a 500.
    res = mockRes();
    await refreshHandler({ method: 'POST', ...bearer('t0ken'), body: { action: 'refresh' } }, res);
    assert.equal(res.statusCode, 503);
  });
});

test('/api/admin is closed to non-admins', async () => {
  await withAdminToken(undefined, async () => {
    const res = mockRes();
    await adminHandler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 401);
  });
});

// Runs last on purpose: it constructs the module-level Redis client with
// fake credentials (no request is issued on this 400 path), and _lib.js
// caches that client for the life of the process. Any earlier test that
// relies on redis() throwing would break if this ran first.
test('POST /api/admin merge_fencers wires validation into the response', async () => {
  process.env.KV_REST_API_URL = 'https://fake.upstash.example';
  process.env.KV_REST_API_TOKEN = 'fake-token';
  await withAdminToken('t0ken', async () => {
    const res = mockRes();
    await adminHandler({
      method: 'POST', ...bearer('t0ken'),
      body: { action: 'merge_fencers', payload: { source_key: 'alice', target_key: 'ALICE' } },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /must differ/);
  });
});

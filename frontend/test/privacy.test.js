// Privacy guards for what ships to every visitor: the public registry
// (ingest/fencers.json, served as /data/fencers.json) and the client source
// that Vite bundles. These fail loudly if a regenerated registry or a code
// change starts publishing licence data again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const registryText = readFileSync(resolve(__dirname, '../../ingest/fencers.json'), 'utf8');
const registry = JSON.parse(registryText);

test('the public registry carries no licence hashes', () => {
  const withHashes = registry.filter((r) => 'licence_hashes' in r || 'licence_hash' in r);
  assert.equal(withHashes.length, 0);
  // Belt and braces: nothing in the file looks like a SHA-256 digest.
  assert.doesNotMatch(registryText, /[0-9a-f]{64}/i);
});

test('has_licence is only ever a true flag', () => {
  for (const r of registry) {
    if ('has_licence' in r) assert.equal(r.has_licence, true, r.display_name);
  }
});

test('no published birth year for anyone possibly under 18', () => {
  // Born in or after (this year - 18) may be under 18; only the year is known,
  // so the whole year counts. Checked against the calendar year, so a file
  // built in an earlier year can only pass more easily as time goes on.
  const cutoff = new Date().getFullYear() - 18;
  const exposed = registry.filter((r) => r.dob_year != null && r.dob_year >= cutoff);
  assert.deepEqual(exposed.map((r) => r.display_name), []);
});

test('withheld birth years carry well-formed eligibility flags', () => {
  const withheld = registry.filter((r) => r.dob_withheld);
  assert.ok(withheld.length > 0);
  for (const r of withheld) {
    assert.equal(r.dob_year, null, r.display_name);
    const e = r.age_eligibility;
    assert.ok(e && Number.isInteger(e.season), r.display_name);
    assert.equal(typeof e.junior, 'boolean', r.display_name);
    assert.equal(typeof e.cadet, 'boolean', r.display_name);
    if (e.cadet) assert.equal(e.junior, true, `${r.display_name}: Cadet implies Junior`);
    if ('dob_implausible' in r) assert.equal(r.dob_implausible, true, r.display_name);
  }
});

function clientSources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return clientSources(p);
    return /\.(js|jsx|mjs)$/.test(e.name) ? [p] : [];
  });
}

test('client code reads no licence pepper or custom build-time env', () => {
  // Vite inlines every import.meta.env.VITE_* value the client references
  // into the public bundle, so the client must not reference any. Vite's
  // own non-secret flags (MODE, DEV, PROD, BASE_URL, SSR) are fine.
  const files = clientSources(resolve(__dirname, '../src'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /LICENCE_PEPPER/, file);
    assert.doesNotMatch(src, /import\.meta\.env(?!\.(MODE|DEV|PROD|BASE_URL|SSR)\b)/, file);
  }
});

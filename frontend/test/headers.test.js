// Security headers (security #6). vercel.json sends them on every
// response. These tests pin the properties that matter, so a later edit
// can't quietly weaken them, and check the page has nothing the strict
// script policy would block.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8'));
const catchAll = (config.headers || []).find((rule) => rule.source === '/(.*)');
const header = (name) =>
  catchAll?.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

function directives(policy) {
  return Object.fromEntries(
    policy.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...values] = d.split(/\s+/);
      return [name, values];
    }),
  );
}

test('every response carries the security headers', () => {
  assert.ok(catchAll, 'vercel.json needs a catch-all "/(.*)" headers rule');
  assert.equal(header('X-Content-Type-Options'), 'nosniff');
  assert.equal(header('X-Frame-Options'), 'DENY');
  assert.equal(header('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.ok(header('Permissions-Policy'));
});

test('the content security policy blocks injected scripts, plugins and framing', () => {
  const csp = directives(header('Content-Security-Policy') || '');
  assert.deepEqual(csp['default-src'], ["'self'"]);
  // No inline or eval'd script and no third-party script host.
  assert.deepEqual(csp['script-src'], ["'self'"]);
  // The admin token can only ever be sent back to this site.
  assert.deepEqual(csp['connect-src'], ["'self'"]);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'self'"]);
  assert.deepEqual(csp['form-action'], ["'self'"]);
});

test('the page has no inline script for the policy to block', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0);
  for (const [, attrs, body] of scripts) {
    assert.match(attrs, /\bsrc=/, 'every script loads from a file');
    assert.equal(body.trim(), '');
  }
});

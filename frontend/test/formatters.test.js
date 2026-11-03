import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDateLong } from '../src/utils/formatters.js';

test('fmtDateLong writes the header date in full, day first', () => {
  assert.equal(fmtDateLong('2026-07-19'), '19 July 2026');
  assert.equal(fmtDateLong('2025-01-05'), '5 January 2025');
  assert.equal(fmtDateLong('2024-12-31'), '31 December 2024');
  assert.equal(fmtDateLong(''), '');
  assert.equal(fmtDateLong(null), '');
  assert.equal(fmtDateLong('2026-13-01'), '2026-13-01'); // malformed: shown as is
});

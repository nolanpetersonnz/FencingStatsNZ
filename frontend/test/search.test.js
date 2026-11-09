import { test } from 'node:test';
import assert from 'node:assert/strict';
import { competitionMatches } from '../src/utils/search.js';

const comp = (name, date = '2025-10-26') => ({ name, date });
const names = (list, q) => list.filter((c) => competitionMatches(c, q)).map((c) => c.name);

const LIST = [
  comp('NZ National Championship 2024 - Mens', '2024-10-26'),
  comp('NZ National Championship Vets 2025 - Mens', '2025-10-27'),
  comp('Oceania and NZ National Open 2025 - Mens', '2025-10-26'),
  comp('National Junior Championships 2025 - Mens', '2025-04-13'),
  comp('North Island Championship 2025 - Mens', '2025-05-31'),
  comp('Northern Junior (U20) Championships - Mens', '2025-02-17'),
  comp('Central Under 15 Championships 2025 - Mens', '2025-03-08'),
  comp('McLeavey Memorial 2026 - Mens', '2026-07-19'),
];

test('an empty search keeps every competition', () => {
  assert.equal(names(LIST, '').length, LIST.length);
  assert.equal(names(LIST, '   ').length, LIST.length);
});

test('every word must start a word of the name; a plural s and case do not matter', () => {
  assert.deepEqual(names(LIST, 'Nationals 2025'), [
    'NZ National Championship Vets 2025 - Mens',
    'Oceania and NZ National Open 2025 - Mens',
    'National Junior Championships 2025 - Mens',
  ]);
  assert.deepEqual(names(LIST, 'nat champs vets'), ['NZ National Championship Vets 2025 - Mens']);
  assert.deepEqual(names(LIST, 'OCEANIA'), ['Oceania and NZ National Open 2025 - Mens']);
  assert.deepEqual(names(LIST, 'nationals 2023'), []);
  assert.deepEqual(names(LIST, 'ational'), [], 'the middle of a word is no match');
});

test('a number is a whole word of the name or the year, never part of one', () => {
  assert.deepEqual(names(LIST, '2026'), ['McLeavey Memorial 2026 - Mens']);
  assert.deepEqual(names(LIST, 'under 20'), [], '20 is not a word of "Under 15 ... 2025"');
  assert.deepEqual(names(LIST, 'under 15'), ['Central Under 15 Championships 2025 - Mens']);
  assert.deepEqual(names(LIST, 'u20'), ['Northern Junior (U20) Championships - Mens']);
  // No year in the name: the date supplies it.
  assert.deepEqual(names(LIST, 'northern 2025'), ['Northern Junior (U20) Championships - Mens']);
});

test('accents are ignored, and only the name and year are read', () => {
  assert.equal(competitionMatches(comp('Coupe de Québec 2025'), 'quebec'), true);
  assert.equal(competitionMatches({ name: 'North Open 2025', date: '2025-09-14', club: 'Auckland Swords' }, 'auckland'), false);
  assert.equal(competitionMatches({}, 'north'), false);
});

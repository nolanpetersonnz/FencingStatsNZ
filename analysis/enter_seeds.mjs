#!/usr/bin/env node
// analysis/enter_seeds.mjs: turns the seeding copied from FencingTimeLive into
// analysis/seeds.csv, the sheet analysis/run.mjs reads.
//
//   node analysis/enter_seeds.mjs
//
// analysis/seeds_ftl.csv is the transcription: one row per line of each
// "Seeding for Round 1" screenshot in analysis/images/, with the name and the
// Rank exactly as FencingTimeLive shows them (Rank blank where it shows none).
// analysis/seeds_template.csv is the entrant sheet from fetch_seeds.py, with
// each name as the site spells it.
//
// FencingTimeLive writes "SURNAME Given (Nickname)" and the site writes
// "Given Surname", sometimes with other given names. A name is matched to an
// entrant of the same event by surname and at least one given name. Nothing is
// guessed past that: a name with no match, or with two, is listed and left
// out. Every match that is not letter for letter the same name is listed too,
// so it can be checked by eye.
//
// What was matched, what was not and what to check by eye is printed and saved
// as analysis/seeds_report.txt.
//
// seeds.csv has the template's columns filled in, plus the rank:
//   seed     the seed number on FencingTimeLive
//   ranked   y if FencingTimeLive shows a Rank for the fencer, n if it shows none
//   rank     that Rank

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../frontend/src/data/pipeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// Events that ran no pools of their own: their fencers were seeded once, in
// another event of the same competition. Central Open 2026 foil ran one mixed
// pool, then a men's and a women's DE.
const SAME_SEEDING = {
  'Central Open Championship 2026 - Mens|foil': 'Central Open Championship 2026 Mixed|foil',
  'Central Open Championship 2026 - Womens|foil': 'Central Open Championship 2026 Mixed|foil',
};

const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s) => plain(s).toLowerCase().split(/[^a-z]+/).filter(Boolean);
const squash = (s) => words(s).join('');

// "LI Shawn YuChen (Shawn)" -> surname LI, given names Shawn, YuChen and the
// nickname Shawn. The surname is the run of words in capitals at the start.
function parseFtl(name) {
  const nick = [...name.matchAll(/\(([^)]*)\)/g)].flatMap((m) => words(m[1]));
  const parts = name.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/);
  let i = 0;
  while (i < parts.length && parts[i] === parts[i].toUpperCase() && /[A-Z]/.test(parts[i])) i++;
  const surname = parts.slice(0, i).join(' ');
  const given = parts.slice(i).join(' ');
  return { surname, given, givenWords: [...new Set([...words(given), ...nick])] };
}

// How well a FencingTimeLive name fits a site name: -1 if the surname differs,
// otherwise the number of given names they share (a name that starts another,
// as Sera starts Seraphine, counts).
function fit(ftl, siteName) {
  const site = words(siteName), sur = words(ftl.surname);
  const tail = site.slice(site.length - sur.length).join(' ') === sur.join(' ');
  if (!tail && !squash(siteName).endsWith(squash(ftl.surname))) return -1;
  const siteGiven = tail ? site.slice(0, site.length - sur.length) : site;
  return ftl.givenWords.filter((g) => siteGiven.some((h) => g === h || (g.length > 2 && h.startsWith(g)) || (h.length > 2 && g.startsWith(h)))).length;
}

const key = (r) => `${r.competition}|${r.weapon}`;
const sheet = parseCSV(readFileSync(resolve(HERE, 'seeds_template.csv'), 'utf8'));
const ftlRows = parseCSV(readFileSync(resolve(HERE, 'seeds_ftl.csv'), 'utf8'));
const events = [...new Set(sheet.map(key))];
const entered = new Map();   // event -> Map(site name -> { seed, rank })
const report = [];
let problems = 0;

for (const ev of [...new Set(ftlRows.map(key))]) {
  const entrants = sheet.filter((r) => key(r) === ev).map((r) => r.fencer);
  if (entrants.length === 0) { report.push(`${ev}: not an event in seeds_template.csv`); problems++; continue; }
  const rows = ftlRows.filter((r) => key(r) === ev);
  const taken = new Map();
  const lines = [];
  for (const r of rows) {
    const ftl = parseFtl(r.name);
    const scored = entrants.map((name) => ({ name, score: fit(ftl, name) })).filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
    const best = scored.length && (scored.length === 1 || scored[0].score > scored[1].score) ? scored[0].name : null;
    if (!best) {
      const sameSurname = entrants.filter((name) => fit(ftl, name) >= 0);
      lines.push(`  not matched: seed ${r.seed} ${r.name}${sameSurname.length ? ` (same surname on the sheet: ${sameSurname.join(', ')})` : ' (no entrant with that surname: did not fence?)'}`);
      continue;
    }
    if (taken.has(best)) { lines.push(`  PROBLEM: ${r.name} and ${taken.get(best).ftl} both match ${best}`); problems++; continue; }
    taken.set(best, { seed: r.seed, rank: r.rank, ftl: r.name });
    if (squash(`${ftl.given} ${ftl.surname}`) !== squash(best)) lines.push(`  check: ${r.name} -> ${best}`);
  }
  const seeds = rows.map((r) => Number(r.seed));
  const twice = [...new Set(seeds.filter((s, i) => seeds.indexOf(s) !== i))];
  if (twice.length) { lines.push(`  PROBLEM: seed ${twice.join(', ')} is transcribed more than once`); problems++; }
  const gaps = Array.from({ length: Math.max(...seeds) }, (_, i) => i + 1).filter((s) => !seeds.includes(s));
  if (gaps.length) lines.push(`  seed ${gaps.join(', ')} is not on the screenshot`);
  for (const name of entrants) if (!taken.has(name)) lines.push(`  no seed: ${name} is on the sheet and not on the screenshot`);
  const ranked = [...taken.values()].filter((v) => v.rank).length;
  report.push(`${ev}: ${rows.length} seeded, ${taken.size} of ${entrants.length} entrants matched, ${ranked} with a Rank${ranked === 0 ? ' (FencingTimeLive shows no Rank for anyone)' : ''}`, ...lines);
  entered.set(ev, taken);
}

for (const [ev, from] of Object.entries(SAME_SEEDING)) {
  if (entered.has(ev) || !entered.has(from)) continue;
  const taken = new Map(sheet.filter((r) => key(r) === ev && entered.get(from).has(r.fencer)).map((r) => [r.fencer, entered.get(from).get(r.fencer)]));
  entered.set(ev, taken);
  report.push(`${ev}: no pools of its own; ${taken.size} of ${sheet.filter((r) => key(r) === ev).length} entrants take their seed from ${from}`);
}

const none = events.filter((ev) => !entered.has(ev));
const cols = ['competition', 'event', 'weapon', 'gender', 'fencer', 'seed', 'ranked', 'rank'];
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const out = sheet.map((r) => {
  const got = entered.get(key(r))?.get(r.fencer);
  return { ...r, seed: got ? got.seed : '', ranked: got ? (got.rank ? 'y' : 'n') : '', rank: got ? got.rank : '' };
});
writeFileSync(resolve(HERE, 'seeds.csv'), [cols.join(','), ...out.map((r) => cols.map((c) => cell(String(r[c] ?? ''))).join(','))].join('\n') + '\n');

report.push('', `${entered.size} of ${events.length} events have seeds; ${out.filter((r) => r.seed).length} of ${out.length} entrant rows seeded, ${out.filter((r) => r.ranked === 'y').length} of them with a Rank.`);
if (none.length) report.push(`No seeding entered yet for ${none.length} events:`, ...none.map((ev) => `  ${ev}`));
writeFileSync(resolve(HERE, 'seeds_report.txt'), report.join('\n') + '\n');
console.log(report.join('\n'));
if (problems) { console.error(`\n${problems} problem(s) above need fixing in seeds_ftl.csv.`); process.exit(1); }

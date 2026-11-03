// Rewrites test/fixtures/enrichment-canonical.json: for every name key, the
// index (in ingest/fencers.json) of the registry record buildEnrichmentIndex
// picks for it. enrichment.test.js compares against this snapshot so a change
// to the selection logic or the registry can't silently re-point a name at a
// different person. Run it only after deliberately regenerating the registry:
//   node scripts/snapshot-enrichment.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEnrichmentIndex } from '../src/data/fencerInfo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(__dirname, '..', '..', 'ingest', 'fencers.json');
const outPath = path.resolve(__dirname, '..', 'test', 'fixtures', 'enrichment-canonical.json');

const info = JSON.parse(readFileSync(registryPath, 'utf8'));
const idx = buildEnrichmentIndex(info);
const lines = Object.keys(idx).sort().map((key) => `${JSON.stringify(key)}:${info.indexOf(idx[key])}`);
writeFileSync(outPath, `{\n${lines.join(',\n')}\n}\n`);
console.log(`snapshot-enrichment: ${lines.length} name keys -> ${path.relative(process.cwd(), outPath)}`);

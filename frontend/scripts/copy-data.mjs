// Copies ingest/*.csv into frontend/public/data/ so the deployed site can
// fetch them at runtime. Runs automatically before dev / build via the
// chained npm scripts in package.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ingestDir = path.resolve(__dirname, '..', '..', 'ingest');
const outDir = path.resolve(__dirname, '..', 'public', 'data');

fs.mkdirSync(outDir, { recursive: true });

const csvs = fs.existsSync(ingestDir)
  ? fs.readdirSync(ingestDir).filter(f => f.toLowerCase().endsWith('.csv'))
  : [];

for (const f of csvs) {
  fs.copyFileSync(path.join(ingestDir, f), path.join(outDir, f));
}

// fencers.json is the privacy-scrubbed registry from the Fencing Time
// XML ingest (handedness, DOB year for adults, official FNZ ranking, a
// has_licence flag; no licence numbers or hashes). Copied if present; site falls back to
// bout-derived fencers when missing.
const fencerJson = path.join(ingestDir, 'fencers.json');
const hasFencerJson = fs.existsSync(fencerJson);
if (hasFencerJson) {
  fs.copyFileSync(fencerJson, path.join(outDir, 'fencers.json'));
}

// intl_results.json: NZ fencers' placings at the FeNZ results portal's
// International competitions (ingest/portal_intl.py). JSON, not CSV, so the
// manifest below never offers it as bouts. Removed from public/data/ when the
// ingest file is gone, so a stale copy can't linger.
const intlJson = path.join(ingestDir, 'intl_results.json');
const hasIntlJson = fs.existsSync(intlJson);
if (hasIntlJson) {
  fs.copyFileSync(intlJson, path.join(outDir, 'intl_results.json'));
} else {
  fs.rmSync(path.join(outDir, 'intl_results.json'), { force: true });
}

const manifest = csvs.map(f => `data/${f}`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`copy-data: ${csvs.length} CSV(s)${hasFencerJson ? ' + fencers.json' : ''}${hasIntlJson ? ' + intl_results.json' : ''} copied → public/data/`);

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

const manifest = csvs.map(f => `data/${f}`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`copy-data: ${csvs.length} CSV(s) copied → public/data/`);

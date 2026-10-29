// docs/ must be exactly what tools/build_site.py produces: no hand-edited generated page, no forgotten rebuild.
import fs from 'node:fs';
import path from 'node:path';
import { DOCS, buildSite, tempDir } from '../lib.mjs';

const out = buildSite(tempDir('jk-sync-'));
const pages = dir => fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const built = pages(out), committed = pages(DOCS);
let problems = 0;
const fail = m => { problems++; console.log('  FAIL:', m); };

for (const f of built.filter(f => !committed.includes(f))) fail(`docs/${f} is produced by the generator but missing from docs/`);
for (const f of committed.filter(f => !built.includes(f))) fail(`docs/${f} is not produced by the generator (hand-written or left over)`);
for (const f of built.filter(f => committed.includes(f))) {
  const a = fs.readFileSync(path.join(DOCS, f), 'utf-8').split('\n');
  const b = fs.readFileSync(path.join(out, f), 'utf-8').split('\n');
  if (a.length === b.length && a.every((l, i) => l === b[i])) continue;
  const i = a.findIndex((l, k) => l !== b[k]);
  fail(`docs/${f} differs from the generator's output (first difference at line ${i + 1}). Run: python3 tools/build_site.py`);
}
console.log(`${built.length} generated pages compared, ${problems} problems`);
process.exit(problems ? 1 : 0);

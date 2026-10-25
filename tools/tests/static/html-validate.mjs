// HTML validity and structure of the generated pages (html-validate with tools/tests/htmlvalidate.json).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { DOCS, HERE } from '../lib.mjs';

const require = createRequire(import.meta.url);
const bin = path.join(path.dirname(require.resolve('html-validate/package.json')), 'bin', 'html-validate.mjs');
const pages = fs.readdirSync(DOCS).filter(f => f.endsWith('.html')).sort().map(f => path.join(DOCS, f));
const r = spawnSync(process.execPath, [bin, '--config', path.join(HERE, 'htmlvalidate.json'), ...pages], { encoding: 'utf-8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
console.log(`${pages.length} pages validated, ${r.status === 0 ? 'no problems' : 'problems found'}`);
process.exit(r.status === 0 ? 0 : 1);

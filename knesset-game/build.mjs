// Inlines src/ into a single self-contained index.html (works from file://, no server needed).
// Usage: node build.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const read = (p) => readFileSync(join(src, p), 'utf8');
const jsFiles = readdirSync(join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => `/* ---- ${f} ---- */\n${read('js/' + f)}`).join('\n');
const css = read('css/style.css');

// Baked portraits: src/assets/portraits/<id>.<face>.webp -> PORTRAIT_DATA = { id: { face: 'data:image/webp;base64,...' } } (see tools/portrait-bake)
const portDir = join(src, 'assets', 'portraits');
const portraits = {};
if (existsSync(portDir)) {
  for (const f of readdirSync(portDir).sort()) {
    const m = /^([a-z0-9]+)\.([a-z_]+)\.webp$/.exec(f);
    if (!m) continue;
    (portraits[m[1]] || (portraits[m[1]] = {}))[m[2]] = 'data:image/webp;base64,' + readFileSync(join(portDir, f)).toString('base64');
  }
}
const layoutFile = join(portDir, 'layout.json');
const portData = `const PORTRAIT_DATA = ${JSON.stringify(portraits)};\nconst PORTRAIT_LAYOUT = ${existsSync(layoutFile) ? JSON.stringify(JSON.parse(readFileSync(layoutFile, 'utf8'))) : '{}'};`;

// Sprite parts of the drawn (2D) fighters: src/assets/parts/<id>.<part>.webp + meta.json -> PARTS_DATA = { id: { part: dataURL } }, PARTS_META (see tools/body-bake)
const partsDir = join(src, 'assets', 'parts');
const parts = {};
if (existsSync(partsDir)) {
  for (const f of readdirSync(partsDir).sort()) {
    const m = /^([a-z0-9]+)\.([a-z]+)\.webp$/.exec(f);
    if (!m) continue;
    (parts[m[1]] || (parts[m[1]] = {}))[m[2]] = 'data:image/webp;base64,' + readFileSync(join(partsDir, f)).toString('base64');
  }
}
const partsMeta = join(partsDir, 'meta.json');
const partsData = `const PARTS_DATA = ${JSON.stringify(parts)};\nconst PARTS_META = ${existsSync(partsMeta) ? JSON.stringify(JSON.parse(readFileSync(partsMeta, 'utf8'))) : '{}'};`;

// The whole game lives in one IIFE so files can share top-level names without leaking globals.
const bundle = `(function(){\n'use strict';\n${portData}\n${partsData}\n${js}\n})();`;

const html = read('index.template.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));

const out = process.argv[2] || join(root, 'index.html');      // optional: node build.mjs /path/to/copy.html
writeFileSync(out, html);
console.log(`built ${out.endsWith('index.html') ? 'index.html' : out}  (${(html.length / 1024).toFixed(0)} KB, ${jsFiles.length} js files, ${Object.keys(portraits).length} baked portraits, ${Object.keys(parts).length} sets of body parts)`);

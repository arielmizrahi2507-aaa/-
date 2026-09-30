// Inlines src/ into a single self-contained index.html (works from file://, no server needed).
// Usage: node build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const read = (p) => readFileSync(join(src, p), 'utf8');
const jsFiles = readdirSync(join(src, 'js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => `/* ---- ${f} ---- */\n${read('js/' + f)}`).join('\n');
const css = read('css/style.css');

// The whole game lives in one IIFE so files can share top-level names without leaking globals.
const bundle = `(function(){\n'use strict';\n${js}\n})();`;

const html = read('index.template.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));

const out = process.argv[2] || join(root, 'index.html');      // optional: node build.mjs /path/to/copy.html
writeFileSync(out, html);
console.log(`built ${out.endsWith('index.html') ? 'index.html' : out}  (${(html.length / 1024).toFixed(0)} KB, ${jsFiles.length} js files)`);

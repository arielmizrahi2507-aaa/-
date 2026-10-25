// Shared helpers for the suites in tools/tests: paths, the browser, a small static server and test builds of the site.
// Every suite also runs on its own (node tools/tests/site/menu-test.mjs). The runner (run-all.mjs) only adds one thing:
// it starts a single server for docs/ and passes its address in SITE_URL, so the site is served once for all suites.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DOCS = path.join(ROOT, 'docs');
export const PREVIEW_DIR = path.join(ROOT, 'build', 'preview');
export const AXE = path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js');
// PYTHON wins; then tools/tests/.venv (python3 -m venv tools/tests/.venv, then pip install -r tools/tests/requirements.txt); then python3
const venvPython = ['bin/python', 'Scripts/python.exe'].map(p => path.join(HERE, '.venv', p)).find(p => fs.existsSync(p));
export const PYTHON = process.env.PYTHON || venvPython || 'python3';
export const TEST_EMAIL = 'info@example.org';

// ---- browser -------------------------------------------------------------------------------------------------------
// CHROMIUM_PATH wins; then the cloud sandbox's preinstalled build; otherwise Playwright's own download
// (npx playwright-core install chromium).
export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const preinstalled = '/opt/pw-browsers/chromium';
  return fs.existsSync(preinstalled) ? preinstalled : undefined;
}

export async function launch(args = []) {
  // Chromium refuses to start as root (containers, CI) without --no-sandbox; the suites only open this site and local files
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  try {
    return await chromium.launch({ executablePath: chromiumPath(), args: [...(asRoot ? ['--no-sandbox'] : []), ...args] });
  } catch (e) {
    console.error('Could not start Chromium: ' + String(e.message).split('\n')[0]);
    console.error('Set CHROMIUM_PATH to a Chrome/Chromium executable, or run: npx playwright-core install chromium');
    process.exit(2);
  }
}

// ---- static server -------------------------------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// serves a folder on 127.0.0.1 and a free port; resolves to { url, close }
export function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end('bad request'); return; }
    let file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('forbidden'); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch { /* 404 below */ }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}/`,
      close: () => new Promise(r => { server.close(r); server.closeAllConnections?.(); }),
    }));
  });
}

// ---- builds of the site --------------------------------------------------------------------------------------------
const tempDirs = [];
process.on('exit', () => { for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true }); });

export function tempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}

// runs tools/build_site.py into outDir; email '' builds the site without a club address, a value sets it, undefined keeps the committed setting
export function buildSite(outDir, email) {
  fs.cpSync(DOCS, outDir, { recursive: true });
  const env = { ...process.env, JK_OUT: outDir };
  if (email !== undefined) env.JK_EMAIL = email;
  else delete env.JK_EMAIL;   // the committed configuration, whatever the caller's environment holds
  const r = spawnSync(PYTHON, [path.join(ROOT, 'tools', 'build_site.py')], { env, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error('tools/build_site.py failed:\n' + (r.stderr || r.stdout));
  return outDir;
}

// the address of the site to test. No argument: docs/ as committed (or SITE_URL when the runner already serves it).
// With { email }: a fresh test build with that club address ('' = none), served on its own port.
export async function siteUrl({ email } = {}) {
  if (email === undefined) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/?$/, '/');
    return (await serve(DOCS)).url;
  }
  return (await serve(buildSite(tempDir('jk-site-'), email))).url;
}

// ---- single-file preview -------------------------------------------------------------------------------------------
export function previewFile(which) {   // 'inner' = the site itself, 'site' = the wrapped file that is sent to the user
  return path.join(PREVIEW_DIR, which === 'inner' ? 'judokan-eilat-inner.html' : 'judokan-eilat-site.html');
}

// builds the preview first (the runner has done that already when PREVIEW_BUILT=1), so a suite never tests a stale file
export function previewHtml(which) {
  if (process.env.PREVIEW_BUILT !== '1') {
    const r = spawnSync(PYTHON, [path.join(ROOT, 'tools', 'make_preview.py')], { encoding: 'utf-8' });
    if (r.status !== 0) { console.error('tools/make_preview.py failed:\n' + (r.stderr || r.stdout)); process.exit(2); }
  }
  return fs.readFileSync(previewFile(which), 'utf-8');
}

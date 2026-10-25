#!/usr/bin/env node
// Runs every automated check of the site and exits non-zero when any of them fails.
//
//   node tools/tests/run-all.mjs                  everything
//   node tools/tests/run-all.mjs --quick          the fast subset (static checks and one pass of each behaviour suite)
//   node tools/tests/run-all.mjs --only csp,forms suites whose name contains one of the words
//   node tools/tests/run-all.mjs --skip axe       leave out suites whose name contains one of the words
//   node tools/tests/run-all.mjs --group preview  one group: static, site or preview
//   node tools/tests/run-all.mjs --strict         a skipped suite counts as a failure (use this to claim "everything passes")
//   node tools/tests/run-all.mjs --jobs N         N suites at the same time (default: one fewer than the CPU count, at most 3; --jobs 1 runs them one by one)
//   node tools/tests/run-all.mjs --verbose        stream each suite's output while it runs
//   node tools/tests/run-all.mjs --list           print the suites and stop
//
// Every suite is its own process and decides by its exit code: 0 passed, 77 skipped (a tool is missing), anything else failed.
// The full output of each one is kept in build/test-logs/<name>.log (ignored by git).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

let lib;
try {
  lib = await import('./lib.mjs');
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('The test dependencies are not installed.\nRun once:  cd tools/tests && npm ci');
    process.exit(2);
  }
  throw e;
}
const { HERE, ROOT, DOCS, PYTHON, launch, serve } = lib;

// name, group, script, arguments, part of --quick
const SUITES = [
  { name: 'docs-in-sync', group: 'static', file: 'static/docs-in-sync.mjs', quick: true },
  { name: 'html-validate', group: 'static', file: 'static/html-validate.mjs', quick: true },
  { name: 'link-check', group: 'static', file: 'static/link-check.py', quick: true },
  { name: 'sec-scan', group: 'static', file: 'static/sec-scan.py', quick: true },
  { name: 'cjk-scan', group: 'static', file: 'static/cjk-scan.py', quick: true },
  { name: 'contrast-tokens', group: 'static', file: 'static/contrast-tokens.py', quick: true },

  { name: 'csp', group: 'site', file: 'site/csp-test.mjs', quick: true },
  { name: 'menu', group: 'site', file: 'site/menu-test.mjs', quick: true },
  { name: 'forms', group: 'site', file: 'site/forms-test.mjs', quick: true },
  { name: 'forms-no-script', group: 'site', file: 'site/nojs-form-test.mjs', quick: true },
  { name: 'carousel', group: 'site', file: 'site/carousel-test.mjs' },
  { name: 'keyboard', group: 'site', file: 'site/kbd-all.mjs' },
  { name: 'reflow', group: 'site', file: 'site/reflow-test.mjs' },
  { name: 'mobile-390', group: 'site', file: 'site/mobile-all.mjs', args: ['on', '390'], quick: true },
  { name: 'mobile-390-no-script', group: 'site', file: 'site/mobile-all.mjs', args: ['off', '390'] },
  { name: 'mobile-320', group: 'site', file: 'site/mobile-all.mjs', args: ['on', '320'] },
  { name: 'axe-all', group: 'site', file: 'site/axe-all.mjs' },
  { name: 'axe-no-script', group: 'site', file: 'site/axe-nojs.mjs' },

  { name: 'preview-bundle', group: 'preview', file: 'preview/bundle-test.mjs', quick: true },
  { name: 'preview-sandbox', group: 'preview', file: 'preview/sandbox-test.mjs', quick: true },
  { name: 'preview-nav-flow', group: 'preview', file: 'preview/nav-flow-test.mjs' },
  { name: 'preview-typing', group: 'preview', file: 'preview/typing-test.mjs' },
  { name: 'preview-no-script', group: 'preview', file: 'preview/nojs-preview-test.mjs' },
];

// ---- options -------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const value = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const words = n => (value(n) || '').split(',').map(s => s.trim()).filter(Boolean);
const known = ['quick', 'only', 'skip', 'group', 'strict', 'jobs', 'timeout', 'verbose', 'list', 'help'];
const unknown = argv.filter(a => a.startsWith('--') && !known.includes(a.slice(2)));
if (unknown.length || flag('help')) {
  console.log(`usage: node tools/tests/run-all.mjs [--quick] [--only a,b] [--skip a,b] [--group static|site|preview] [--strict] [--jobs N] [--timeout SECONDS] [--verbose] [--list]${unknown.length ? '\nunknown option: ' + unknown.join(' ') : ''}`);
  process.exit(unknown.length ? 2 : 0);
}
let selected = SUITES.filter(s => !flag('quick') || s.quick);
if (words('only').length) selected = selected.filter(s => words('only').some(w => s.name.includes(w)));
if (words('skip').length) selected = selected.filter(s => !words('skip').some(w => s.name.includes(w)));
if (value('group')) selected = selected.filter(s => s.group === value('group'));
if (flag('list')) {
  for (const s of SUITES) console.log(`${s.name.padEnd(22)} ${s.group.padEnd(8)} ${s.quick ? 'quick' : ''}`);
  process.exit(0);
}
if (!selected.length) { console.error('No suite matches these options (see --list).'); process.exit(2); }
const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
const jobs = Math.max(1, Number(value('jobs')) || Math.min(3, Math.max(1, cores - 1)));
const timeoutMs = (Number(value('timeout')) || 900) * 1000;
const verbose = flag('verbose');
const strict = flag('strict');

// ---- preparation ---------------------------------------------------------------------------------------------------
const logDir = path.join(ROOT, 'build', 'test-logs');
fs.rmSync(logDir, { recursive: true, force: true });
fs.mkdirSync(logDir, { recursive: true });

const needsBrowser = selected.some(s => s.group !== 'static');
const env = { ...process.env };
if (needsBrowser) {
  const probe = await launch();   // one clear message here instead of a failure in every suite
  await probe.close();
}
let server = null;
if (needsBrowser) {
  server = await serve(DOCS);
  env.SITE_URL = server.url;
}
let previewError = '';
if (selected.some(s => s.group === 'preview')) {
  const r = spawnSync(PYTHON, [path.join(ROOT, 'tools', 'make_preview.py')], { encoding: 'utf-8', env });
  if (r.status !== 0) previewError = (r.stderr || r.stdout || 'tools/make_preview.py failed').trim();
  else env.PREVIEW_BUILT = '1';
}

console.log(`Judokan Eilat site checks: ${selected.length} suites, node ${process.version}, ${jobs > 1 ? jobs + ' at a time' : 'one at a time'}${strict ? ', strict' : ''}`);
console.log(`site served from ${server ? server.url : '(not needed)'}  logs: ${path.relative(ROOT, logDir)}/\n`);

// ---- running -------------------------------------------------------------------------------------------------------
const SUMMARY_LINE = /(\d+ (axe )?(checks|runs)|problems|findings|MISSING|SKIPPED)/i;
const seconds = ms => (ms / 1000).toFixed(1) + 's';

function runSuite(s) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const finish = (status, output, note = '') => {
      const lines = output.split('\n').map(l => l.trimEnd()).filter(Boolean);
      const detail = note || [...lines].reverse().find(l => SUMMARY_LINE.test(l)) || lines[lines.length - 1] || '';
      fs.writeFileSync(path.join(logDir, s.name + '.log'), output);
      resolve({ ...s, status, ms: Date.now() - t0, detail: detail.slice(0, 90), output });
    };
    if (s.group === 'preview' && previewError) return finish('fail', previewError, 'tools/make_preview.py failed');
    const isPy = s.file.endsWith('.py');
    // own process group: a timeout or Ctrl-C then takes the browser it started down with it
    const child = spawn(isPy ? PYTHON : process.execPath, [path.join(HERE, s.file), ...(s.args || [])], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    running.add(child);
    let output = '';
    const take = chunk => { output += chunk; if (verbose) process.stdout.write(chunk); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = setTimeout(() => { killGroup(child); output += `\nTIMEOUT after ${seconds(timeoutMs)}\n`; }, timeoutMs);
    child.on('error', e => { clearTimeout(timer); running.delete(child); finish('fail', output + String(e)); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      running.delete(child);
      if (signal) return finish('fail', output, `killed (${signal})`);
      finish(code === 0 ? 'pass' : code === 77 ? 'skip' : 'fail', output);
    });
  });
}

const running = new Set();
const killGroup = child => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } };
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const c of running) killGroup(c); process.exit(130); });

const results = [];
const started = Date.now();
const queue = [...selected];
async function worker() {
  for (let s = queue.shift(); s; s = queue.shift()) {
    const r = await runSuite(s);
    results.push(r);
    const tag = { pass: ' PASS', fail: ' FAIL', skip: ' SKIP' }[r.status];
    console.log(`${tag}  ${r.name.padEnd(22)} ${seconds(r.ms).padStart(7)}  ${r.detail}`);
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, selected.length) }, worker));
if (server) await server.close();

// ---- report --------------------------------------------------------------------------------------------------------
const count = st => results.filter(r => r.status === st).length;
const failed = results.filter(r => r.status === 'fail');
const skipped = results.filter(r => r.status === 'skip');
for (const r of failed) {
  const lines = r.output.split('\n').map(l => l.trimEnd());
  const bad = lines.filter(l => /FAIL|\[(critical|serious|moderate|minor)\]|MISSING|WARNING|Error|TIMEOUT|problems/i.test(l));
  const shown = (bad.length ? bad : lines.filter(Boolean).slice(-25)).slice(0, 40);
  console.log(`\n--- ${r.name} (${path.relative(ROOT, path.join(logDir, r.name + '.log'))})`);
  for (const l of shown) console.log('  ' + l.slice(0, 220));
  if (bad.length > shown.length) console.log(`  ... ${bad.length - shown.length} more lines in the log`);
}
for (const r of skipped) console.log(`\nSKIPPED ${r.name}: ${r.detail}`);
const bad = failed.length + (strict ? skipped.length : 0);
console.log(`\n${count('pass')} passed, ${failed.length} failed, ${skipped.length} skipped${strict && skipped.length ? ' (strict: counted as failures)' : ''} in ${seconds(Date.now() - started)}`);
process.exit(bad ? 1 : 0);

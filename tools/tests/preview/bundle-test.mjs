// The single-file preview opened straight from disk: self-contained (no network, no console errors), fonts loaded,
// and the pages inside it can be reached.
import { launch, previewFile, previewHtml } from '../lib.mjs';
previewHtml('inner');   // builds the preview
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
const ext = []; const errs = [];
p.on('request', r => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('data:')) ext.push(u); });
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + previewFile('inner'), { waitUntil: 'load' });
await p.waitForTimeout(1200);
ok((await p.title()).length > 3, 'the page has a title');
const fonts = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family); });
ok(fonts.some(f => /Heebo/i.test(f)), 'the Hebrew font is loaded (' + fonts.join(', ') + ')');
await p.click('footer a[href="#view-accessibility"]');
await p.waitForTimeout(300);
ok(await p.evaluate(() => getComputedStyle(document.getElementById('view-accessibility')).display !== 'none' && getComputedStyle(document.getElementById('main')).display === 'none'), 'the footer link opens the accessibility page and hides the home page');
ok((await p.evaluate(() => document.querySelector('#view-accessibility h1').textContent)).trim().length > 3, 'the accessibility page has its heading');
await p.click('#view-accessibility a.back');
await p.waitForTimeout(300);
ok(await p.evaluate(() => getComputedStyle(document.getElementById('main')).display !== 'none'), 'the back link returns to the home page');
await p.click('.side-nav a[href="#schedule"]');
await p.waitForTimeout(500);
ok(await p.evaluate(() => { const r = document.getElementById('schedule').getBoundingClientRect(); return r.top < 400 && r.bottom > 0; }), 'a menu item scrolls to its section');
ok(ext.length === 0, 'no request leaves the file: ' + ext.join(', '));
ok(errs.length === 0, 'no console or page errors: ' + errs.join(' | '));
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

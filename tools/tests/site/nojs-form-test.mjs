// The plain card that visitors get when scripts do not run: one box with a ready message, sent to WhatsApp by a GET form.
// Scripts are simulated as blocked (main.js aborted, "js" class removed); the page's Content-Security-Policy stays in force.
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const sizes = [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]];
for (const [sn, opts] of sizes) for (const [pg, prefix] of [['index.html', 'jf'], ['contact.html', 'cf']]) {
  console.log(`\n== no scripts, ${sn}, ${pg}`);
  const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
  await ctx.route('**/assets/js/main.js', r => r.abort());
  const hits = [];
  await ctx.route('https://wa.me/**', r => { hits.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }); });
  const p = await ctx.newPage();
  const csp = [];
  await p.exposeBinding('__cspHit', (_s, m) => csp.push(m));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspHit(e.violatedDirective + ' ' + e.blockedURI)));
  await p.goto(BASE + pg, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.documentElement.classList.remove('js'));
  const sel = `#${prefix}-nojs`;
  const vis = await p.evaluate(([sel, prefix]) => {
    const card = document.querySelector(sel); const full = document.getElementById(prefix === 'jf' ? 'join-form' : 'contact-form');
    return { card: getComputedStyle(card).display !== 'none', full: getComputedStyle(full).display !== 'none', area: document.getElementById(prefix + '-nojs-text').value };
  }, [sel, prefix]);
  ok(vis.card && !vis.full, 'the plain card is shown and the full form is hidden');
  ok(vis.area.startsWith('שלום, אשמח לקבל פרטים') && vis.area.includes('שם:') && vis.area.includes('טלפון:'), 'the box holds the ready message to complete');

  await p.locator(sel).scrollIntoViewIfNeeded();
  const tap = async s => (opts.hasTouch ? p.tap(s) : p.click(s));
  // without the consent box ticked the browser must refuse to send
  await tap(`${sel} button[type=submit]`); await p.waitForTimeout(500);
  ok(hits.length === 0, 'nothing is sent while the consent box is not ticked');
  // fill the details into the box and send
  await p.locator(`#${prefix}-nojs-text`).fill('שלום, אשמח לקבל פרטים על הרשמה לג\'ודוקאן אילת.\n\nשם: דוד כהן\nטלפון: 050-1234567\nגיל המתאמן או המתאמנת: 8 & "שאלה" #1');
  await tap(`#${prefix}-nojs-consent`);
  const popupP = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await tap(`${sel} button[type=submit]`);
  const popup = await popupP; await p.waitForTimeout(500);
  ok(!!popup, 'a new tab opens for WhatsApp');
  const url = hits[hits.length - 1] || '';
  ok(/^https:\/\/wa\.me\/972505788781\?text=/.test(url), 'the new tab goes to wa.me with the club number (' + url.slice(0, 50) + ')');
  const text = decodeURIComponent((url.split('?text=')[1] || '').replace(/\+/g, ' '));
  ok(text.includes('שם: דוד כהן') && text.includes('טלפון: 050-1234567') && text.includes('8 & "שאלה" #1'), 'the typed details travel in the text');
  ok(!/consent/i.test(url), 'the checkbox is not part of the address');
  ok(csp.length === 0, 'no policy violation while sending: ' + csp.join(' | '));
  if (popup) await popup.close();
  await ctx.close();
}
// the other side: with scripts running the visitor sees the full form only, never the plain card as well
console.log('\n== scripts running');
for (const [pg, prefix] of [['index.html', 'jf'], ['contact.html', 'cf']]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + pg, { waitUntil: 'networkidle' });
  const vis = await p.evaluate(prefix => ({
    js: document.documentElement.classList.contains('js'),
    card: getComputedStyle(document.getElementById(prefix + '-nojs')).display !== 'none',
    full: getComputedStyle(document.getElementById(prefix === 'jf' ? 'join-form' : 'contact-form')).display !== 'none',
  }), prefix);
  ok(vis.js && vis.full && !vis.card, `${pg}: with scripts the full form is shown and the plain card is hidden (${JSON.stringify(vis)})`);
  await ctx.close();
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

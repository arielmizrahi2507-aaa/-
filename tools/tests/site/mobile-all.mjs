import { devices } from 'playwright-core';
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
// usage: mobile-all.mjs [on|off] [width]   (scripts on or off, viewport width; default: on 390)
const JS = (process.argv[2] || 'on') === 'on';
const WIDTH = Number(process.argv[3] || 390);
const pages = ['index.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

const ctx = await b.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent, javaScriptEnabled: JS });
const stubbed = [];
await ctx.route(/^https:\/\/(wa\.me|waze\.com|www\.google\.com|www\.yomyom\.net|judoinside\.com|www\.ijf\.org|www\.ija\.org\.il|eilat\.city)\//, r => { stubbed.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }); });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
console.log(`JS ${JS ? 'on' : 'OFF'} @${WIDTH}px`);

// synchronous page functions only (no promises), so they also work with scripts disabled
const hitScan = () => {
  const sel = 'a[href], button, summary, input, select, textarea, [tabindex="0"]';
  const els = [...document.querySelectorAll(sel)].filter(e => !e.closest('[hidden]'));
  const out = { total: 0, covered: [], small: [], offscreen: [] };
  for (const e of els) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !(e.offsetWidth || e.offsetHeight)) continue;
    if (e.closest('.sr-only') || /\bskip\b/.test(String(e.className))) continue;
    if (e.closest('details:not([open])') && !e.closest('summary')) continue;
    const label = (e.getAttribute('aria-label') || e.textContent || e.name || e.id || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const id = e.tagName.toLowerCase() + ':' + label;
    out.total++;
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) out.small.push(id + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if ((r.right > innerWidth + 1 || r.left < -1) && !e.closest('[data-hs]')) out.offscreen.push(id);
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    if (top && !(e === top || e.contains(top) || top.contains(e))) out.covered.push(id + ' <-- ' + top.tagName.toLowerCase() + '.' + String(top.className).slice(0, 24));
  }
  out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  return out;
};

for (const pg of pages) {
  await p.goto(BASE + pg, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  const r = await p.evaluate(hitScan);
  console.log(` ${pg}: interactive=${r.total} covered=${r.covered.length} small=${r.small.length} offscreen=${r.offscreen.length} horizontal-scroll=${r.hscroll}`);
  ok(r.covered.length === 0, `${pg} covered: ${r.covered.join(' | ')}`);
  ok(r.small.length === 0, `${pg} targets <24px: ${r.small.join(' | ')}`);
  ok(r.offscreen.length === 0, `${pg} offscreen: ${r.offscreen.join(' | ')}`);
  ok(!r.hscroll, `${pg} has horizontal scroll`);
}

// every in-page link on the home page: tap it and verify the target ends up visible below the sticky header
await p.goto(BASE + 'index.html', { waitUntil: 'load' });
const anchors = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]:not(.skip)')].map(a => a.getAttribute('href')).filter(h => h.length > 1))]);
console.log(' in-page links:', anchors.join(' '));
for (const h of anchors) {
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await p.evaluate(() => window.scrollTo(0, 0));
  // open the menu first when links live inside it (JS on)
  const link = p.locator(`a[href="${h}"]:not(.skip)`).first();
  let visible = await link.isVisible();
  if (!visible && JS) { await p.tap('.menu-btn'); await p.waitForTimeout(150); visible = await link.isVisible(); }
  if (!visible) { ok(false, `link ${h} is not reachable`); continue; }
  await link.tap();
  await p.waitForTimeout(1300);
  const st = await p.evaluate(h => {
    const t = document.getElementById(h.slice(1));
    const hdr = document.querySelector('.side');
    const hb = hdr ? hdr.getBoundingClientRect().bottom : 0;
    const tr = t ? t.getBoundingClientRect() : null;
    return { exists: !!t, top: tr ? Math.round(tr.top) : null, headerBottom: Math.round(hb), scrollY: Math.round(scrollY), hash: location.hash, menuOpen: !!document.querySelector('.side.open') };
  }, h);
  ok(st.exists, `target ${h} exists`);
  ok(st.top !== null && st.top >= st.headerBottom - 2 && st.top < 420, `${h}: target top=${st.top}, header bottom=${st.headerBottom}`);
  ok(st.hash === h || !JS, `${h}: address updated (${st.hash})`);
  ok(!st.menuOpen, `${h}: menu closes after choosing`);
}

// skip links: reachable with the keyboard and they move focus to their target
for (const pg of ['index.html', 'privacy.html']) {
  await p.goto(BASE + pg, { waitUntil: 'load' });
  const skips = await p.evaluate(() => [...document.querySelectorAll('a.skip')].map(a => a.getAttribute('href')));
  for (const h of skips) {
    await p.goto(BASE + pg, { waitUntil: 'load' });
    await p.focus(`a.skip[href="${h}"]`);
    const shown = await p.evaluate(h => { const r = document.querySelector(`a.skip[href="${h}"]`).getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.width > 20; }, h);
    ok(shown, `${pg} skip link ${h} becomes visible when focused`);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(700);
    const foc = await p.evaluate(h => { const t = document.getElementById(h.slice(1)); return { exists: !!t, focused: document.activeElement === t, top: t ? Math.round(t.getBoundingClientRect().top) : null }; }, h);
    ok(foc.exists && foc.top !== null && foc.top < 400, `${pg} skip ${h}: target in view (top=${foc.top})`);
    if (JS) ok(foc.focused, `${pg} skip ${h}: target receives focus`);
  }
}

// external / app links in the contact details of the red band: href is right and the tap opens it
await p.goto(BASE + 'index.html', { waitUntil: 'load' });
const ext = await p.evaluate(() => [...document.querySelectorAll('a[target=_blank]')].map(a => ({ href: a.href, rel: a.rel })));
for (const e of ext) ok(/noopener/.test(e.rel) && /noreferrer/.test(e.rel), `external link without noopener noreferrer: ${e.href}`);
const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]')].map(a => a.getAttribute('href')));
ok(links.every(h => /^tel:\+972505788781$/.test(h) || /^mailto:/.test(h)), 'tel/mailto hrefs: ' + links.join(', '));
if (JS) {
  for (const sel of ['.contact-info a[href*="wa.me"]', '.contact-info a[href*="waze.com"]', '.contact-info a[href*="google.com/maps"]']) {
    const before = stubbed.length;
    const pagePromise = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
    await p.locator(sel).first().tap();
    const np = await pagePromise;
    await p.waitForTimeout(300);
    ok(!!np && stubbed.length > before, `${sel} opens a new tab (${stubbed.slice(before).join(', ').slice(0, 90)})`);
    if (np) await np.close();
  }
}

// to-top
await p.goto(BASE + 'index.html', { waitUntil: 'load' });
if (JS) {
  await p.evaluate(() => window.scrollTo(0, 3000));
  await p.waitForTimeout(500);
  const vis = await p.evaluate(() => !document.querySelector('.to-top').hidden);
  ok(vis, 'to-top appears after scrolling');
  await p.locator('.to-top').tap();
  await p.waitForTimeout(1300);
  const y = await p.evaluate(() => Math.round(scrollY));
  ok(y === 0, `to-top returns to the top (scrollY=${y})`);
}
ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

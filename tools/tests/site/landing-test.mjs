// Where a visitor ends up when a page opens: the section of a link lands under the header (also on a slow phone and when the fonts arrive late), a reload
// keeps the place, and with scripts the browser's own scrolling is instant (the script animates the clicks).
// The same checks run on the site as committed (no side-scrolling strips) and on a build with the strips pinned to the page scroll, whose strips lengthen the page
// after the browser has given the visitor a place:
//   node tools/tests/site/landing-test.mjs [off|swipe|pinned]
import { launch, siteUrl } from '../lib.mjs';
const MODE = process.argv[2] || 'off';
const BASE = await siteUrl({ sideScroll: MODE });
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const near = (a, bb, tol) => Math.abs(a - bb) <= tol;
console.log(`side scrolling: ${MODE}`);

const frames = (p, n = 3) => p.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const goY = async (p, y) => { await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await frames(p); };
// Waits until a reading stops changing (the fonts are in, the strips are measured) and returns it. It polls instead of guessing a delay,
// because how long the start of a page takes depends on the machine and on how late the fonts arrive; after `timeout` it fails the check that it did not settle.
const settled = async (p, read, { quiet = 600, timeout = 12000, what = 'the page' } = {}) => {
  const t0 = Date.now();
  let last = await read(), since = Date.now();
  while (Date.now() - t0 < timeout) {
    await p.waitForTimeout(100);
    const v = await read();
    const loaded = await p.evaluate(() => document.readyState === 'complete' && (!document.fonts || document.fonts.status === 'loaded')).catch(() => false);
    if (JSON.stringify(v) !== JSON.stringify(last)) { last = v; since = Date.now(); }
    else if (loaded && Date.now() - since >= quiet) return v;
  }
  ok(false, `${what} did not settle within ${timeout / 1000}s (last reading ${JSON.stringify(last)})`);   // never let a page that keeps changing pass or fail by luck
  return last;
};
// everything that changes while the page measures itself: the height of the page and the numbers of every strip (there are none without strips)
const layoutSignature = () => document.documentElement.scrollHeight + '|' + [...document.querySelectorAll('.hs')].map(h => ['--hs-d', '--hs-g', '--hs-stage'].map(k => h.style.getPropertyValue(k)).join(',')).join(';');
const newPhone = () => b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const idTop = (p, id) => p.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().top), id);

// ---------- a fresh load of a link, also on a phone four times slower ----------
for (const h of ['join', 'way']) {
  let worst = 0;
  for (let k = 0; k < 2; k++) {
    const ctx = await newPhone();
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(BASE + 'index.html#' + h, { waitUntil: 'load' });   // a new page every time, so what the script does happens after the load starts
    const top = await settled(p, () => idTop(p, h), { what: `the landing on #${h} on a slow phone` });   // however long a slow phone takes, it has to end up in the right place
    worst = Math.max(worst, Math.abs(top - 120));
    await ctx.close();
  }
  ok(worst <= 3, `a link to #${h} opened on a phone four times slower lands under the header (off by ${worst}px at worst)`);
}

// ---------- a reload ----------
{
  const ctx = await newPhone();
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await settled(p, () => p.evaluate(layoutSignature), { quiet: 400, what: 'the page after it was opened' });
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === 'auto', 'with scripts the browser scrolls instantly by itself (it restores the place of a reloaded page and goes to a link on load); the script animates the clicks');
  await goY(p, await p.evaluate(() => document.getElementById('faq').getBoundingClientRect().top + scrollY - 200));
  const t0 = await idTop(p, 'faq');
  await p.reload({ waitUntil: 'load' });
  const t1 = await settled(p, () => idTop(p, 'faq'), { what: 'the place after the reload' });
  ok(near(t1, t0, 3), `reloading the page keeps the visitor at the same place (${t0}px then ${t1}px)`);
  await ctx.close();
}

// ---------- late fonts: the text is laid out in a fallback font first, so the place the browser gave the visitor has to be put right once the fonts are in ----------
// (a reload restores the offset that was saved with the final text, a link is scrolled to in the fallback text; Chrome's scroll anchoring then keeps the displaced view)
for (const delay of [0, 150, 450, 1200]) {
  const lateFonts = ctx => ctx.route('**/*.woff2', async r => { await new Promise(res => setTimeout(res, delay)); r.continue().catch(() => {}); });
  {
    const ctx = await newPhone();
    const p = await ctx.newPage();
    await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    await settled(p, () => p.evaluate(layoutSignature), { quiet: 400, what: 'the page before the reload' });
    await goY(p, await p.evaluate(() => document.getElementById('faq').getBoundingClientRect().top + scrollY - 200));
    const t0 = await idTop(p, 'faq');
    await lateFonts(ctx);
    await p.reload({ waitUntil: 'load' });
    const t1 = await settled(p, () => idTop(p, 'faq'), { what: `the place after the reload (fonts ${delay}ms late)` });
    ok(near(t1, t0, 3), `fonts ${delay}ms late: a reload keeps the visitor at the same place (${t0}px then ${t1}px)`);
    await ctx.close();
  }
  for (const h of ['join', 'way']) {
    const ctx = await newPhone();
    const p = await ctx.newPage();
    await lateFonts(ctx);
    await p.goto(BASE + 'index.html#' + h, { waitUntil: 'load' });
    const top = await settled(p, () => idTop(p, h), { what: `the landing on #${h} (fonts ${delay}ms late)` });
    ok(near(top, 120, 3), `fonts ${delay}ms late: a link to #${h} lands under the header (${top}px, expected 120px)`);
    await ctx.close();
  }
  // a browser without scroll anchoring (Safari) does not keep the section where it was when the fonts move the text: the script aligns it once more
  for (const h of ['join', 'way']) {
    const ctx = await newPhone();
    const p = await ctx.newPage();
    await ctx.route('**/assets/css/style.css', async r => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()) + '\nhtml{overflow-anchor:none}' }); });
    await lateFonts(ctx);
    await p.goto(BASE + 'index.html#' + h, { waitUntil: 'load' });
    ok(await p.evaluate(() => getComputedStyle(document.documentElement).overflowAnchor) === 'none', 'the page runs without scroll anchoring for this check');
    const top = await settled(p, () => idTop(p, h), { what: `the landing on #${h} (fonts ${delay}ms late, no scroll anchoring)` });
    ok(near(top, 120, 3), `fonts ${delay}ms late, no scroll anchoring: a link to #${h} lands under the header (${top}px, expected 120px)`);
    await ctx.close();
  }
}

console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

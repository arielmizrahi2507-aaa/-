// The side-scrolling strips are cancelled (the owner, 2026-11-04): the cards of every group stay in the normal vertical flow, on a phone and on a wide screen.
// Nothing moves sideways, nothing pins to the page scroll, the page scrolls one pixel per pixel of the wheel, and the pages carry none of the parts that belong to the strips.
// (The strips are still in the generator behind SIDE_SCROLL and are tested on builds that have them: carousel-test.mjs, pinned-scroll-test.mjs, landing-test.mjs.)
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const near = (a, bb, tol) => Math.abs(a - bb) <= tol;

// the nine groups of cards that used to be strips: [selector, name, may sit in several columns on a phone]
const GROUPS = [
  ['.cards4', 'the four pillars'], ['.programs', 'the programs'], ['.champs', 'the champions'], ['.steps', 'the steps'], ['.gloss', 'the glossary'],
  ['.days', 'the days', true], ['.principles', 'the principles'], ['.values', 'the values'], ['.timeline', 'the timeline'],
];
const ALL = GROUPS.map(g => g[0]).join(',');
const cardsOf = sel => (sel === '.gloss' ? '.gloss dl > div' : sel + ' > *');

// the cards of one group: where they are, whether the group scrolls, what it carries
const measure = (p, sel) => p.evaluate(([sel, cards]) => {
  const t = document.querySelector(sel);
  if (!t) return null;
  const items = [...document.querySelectorAll(cards)];
  const rs = items.map(c => c.getBoundingClientRect());
  const cs = getComputedStyle(t);
  return {
    n: items.length, ovx: cs.overflowX, snap: cs.scrollSnapType, tab: t.getAttribute('tabindex'), role: t.getAttribute('role'), roledesc: t.getAttribute('aria-roledescription'),
    scrolls: t.scrollWidth - t.clientWidth, left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)), vw: document.documentElement.clientWidth,
    cols: new Set(rs.map(r => Math.round(r.left))).size, stacked: rs.length > 1 && rs[rs.length - 1].top >= rs[0].bottom - 2,
    firstTop: rs[0].top, lastTop: rs[rs.length - 1].top, sameRow: rs.length > 1 && Math.abs(rs[rs.length - 1].top - rs[0].top) <= 2,
  };
}, [sel, cardsOf(sel)]);
const parts = p => p.evaluate(() => ({
  htmlClass: document.documentElement.className,
  marked: document.querySelectorAll('[data-hs],[data-hs-pin]').length,
  built: document.querySelectorAll('.hs,.hs-stage,.hs-probe,.hs-pin,.hs-tight,.hs-drag').length,
  vars: [...document.querySelectorAll('*')].filter(e => /--hs-/.test(e.getAttribute('style') || '')).length,
  tabStops: [...document.querySelectorAll('main [tabindex]:not(.table-wrap)')].filter(e => e.getAttribute('tabindex') !== '-1').length,   // the schedule table's own wrapper is a region a keyboard can reach, not a strip
  table: (t => t ? t.scrollWidth - t.clientWidth : 0)(document.querySelector('.table-wrap')),
  sideways: document.documentElement.scrollWidth - innerWidth,
}));
const lookup = p => p.evaluate(() => ({ x: Math.round(scrollX), y: Math.round(scrollY), tracks: [...document.querySelectorAll('.cards4,.programs,.champs,.steps,.gloss,.gloss dl,.days,.principles,.values,.timeline')].map(t => Math.round(t.scrollLeft)).join(',') }));
const toMiddle = (p, sel) => p.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
const centre = async (p, sel) => { const box = await p.locator(sel).first().boundingBox(); return { cx: Math.round(box.x + box.width / 2), cy: Math.round(Math.max(60, Math.min(box.y + box.height / 2, p.viewportSize().height - 60))) }; };
const settle = async p => { await p.evaluate(() => document.fonts && document.fonts.ready); await p.waitForTimeout(350); };

// ---------- the pages carry no part of the strips, at three widths ----------
for (const [w, h, mobile] of [[390, 844, true], [820, 1000, false], [1440, 900, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await settle(p);
  const pt = await parts(p);
  const tag = `${w}px`;
  ok(!/has-strips|a11y-stack/.test(pt.htmlClass), `${tag}: the page is not marked as having strips (class "${pt.htmlClass}")`);
  ok(pt.marked === 0, `${tag}: no group carries a strip marker (${pt.marked})`);
  ok(pt.built === 0, `${tag}: the script built no strip wrapper, stage or probe (${pt.built})`);
  ok(pt.vars === 0, `${tag}: no element carries the strips' size variables (${pt.vars})`);
  ok(pt.tabStops === 0, `${tag}: no scroller is a tab stop in the main text (${pt.tabStops})`);
  ok(pt.sideways <= 0, `${tag}: the page does not scroll sideways (${pt.sideways}px wider than the screen)`);
  ok(pt.table <= 1, `${tag}: the schedule table fits its place, it does not scroll sideways either (${pt.table}px)`);
  for (const [sel, name, multi] of GROUPS) {
    const m = await measure(p, sel);
    if (!m) { ok(false, `${tag}: ${name} (${sel}) is on the page`); continue; }
    ok(m.n >= 2, `${tag}: ${name} still has its cards (${m.n})`);
    ok(m.ovx !== 'auto' && m.ovx !== 'scroll' && m.snap === 'none' && m.scrolls <= 1, `${tag}: ${name} is not a scroller (overflow-x ${m.ovx}, snap ${m.snap}, ${m.scrolls}px of hidden width)`);
    ok(m.tab === null && m.roledesc === null && m.role !== 'region', `${tag}: ${name} is not a focusable region (tabindex ${m.tab}, role ${m.role})`);
    ok(m.left >= -1 && m.right <= m.vw + 1, `${tag}: all of ${name} sits inside the screen (${Math.round(m.left)} to ${Math.round(m.right)} of ${m.vw})`);
    if (w < 600 && !multi) ok(m.stacked && m.cols === 1, `${tag}: ${name} flows down the page, one card under another (${m.cols} columns)`);
    if (w >= 1200 && ['.cards4', '.programs', '.champs'].includes(sel)) ok(m.sameRow && m.cols === 4, `1440px keeps the grid of ${name} (${m.cols} columns, same row: ${m.sameRow})`);
    if (w >= 1200 && ['.days', '.timeline'].includes(sel)) ok(m.sameRow && m.cols === 3, `1440px keeps the grid of ${name} (${m.cols} columns, same row: ${m.sameRow})`);
  }
  ok(errs.length === 0, `${tag}: no script or console errors (${errs.slice(0, 2).join(' | ')})`);
  await ctx.close();
}

// ---------- a finger moving sideways over any group moves nothing ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await settle(p);
  const cdp = await ctx.newCDPSession(p);
  // short and away from the edges: a long sweep over a page that cannot scroll sideways is the browser's own "back" gesture, which the page does not control
  const swipe = async (cy, x0, x1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: cy }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 12, y: cy }] }); await p.waitForTimeout(14); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(350);
  };
  for (const [sel, name] of GROUPS) {
    await toMiddle(p, sel); await p.waitForTimeout(150);
    const { cy } = await centre(p, sel);
    const before = await lookup(p);
    await swipe(cy, 150, 235);    // to the right
    await swipe(cy, 235, 150);    // to the left
    const after = await lookup(p);
    ok(p.url().endsWith('index.html') && after.x === 0 && after.tracks === before.tracks && near(after.y, before.y, 2), `a finger moving sideways over ${name} moves nothing (page ${before.x},${before.y} → ${after.x},${after.y}; groups ${before.tracks} → ${after.tracks}; ${p.url().split('/').pop()})`);
    if (!p.url().endsWith('index.html')) break;
  }
  await ctx.close();
}

// ---------- a mouse or a touchpad (the owner's narrow app panel): sideways does nothing, down is one pixel per pixel ----------
{
  const ctx = await b.newContext({ viewport: { width: 341, height: 591 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await settle(p);
  for (const [sel, name] of GROUPS) {
    await toMiddle(p, sel); await p.waitForTimeout(150);
    const { cx, cy } = await centre(p, sel);
    await p.mouse.move(cx, cy);
    const before = await lookup(p);
    await p.mouse.wheel(260, 0); await p.waitForTimeout(120);        // a touchpad that drifts sideways
    await p.mouse.wheel(-260, 0); await p.waitForTimeout(120);
    await p.mouse.down();                                            // a mouse drag over the cards
    await p.mouse.move(cx - 150, cy, { steps: 8 }); await p.mouse.move(cx + 120, cy, { steps: 8 });
    await p.mouse.up(); await p.waitForTimeout(200);
    const after = await lookup(p);
    ok(after.x === 0 && after.tracks === before.tracks && near(after.y, before.y, 2), `a sideways wheel or a drag over ${name} moves nothing (page ${before.x},${before.y} → ${after.x},${after.y}; groups ${before.tracks} → ${after.tracks})`);
    ok(await p.evaluate(() => !document.querySelector('.hs-drag')) && await p.evaluate(sel => getComputedStyle(document.querySelector(sel)).cursor !== 'grab' && getComputedStyle(document.querySelector(sel)).cursor !== 'grabbing', sel), `${name}: the pointer does not turn into a hand`);
    const y0 = (await lookup(p)).y;
    for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 80); await p.waitForTimeout(60); }
    await p.waitForTimeout(400);
    const dy = (await lookup(p)).y - y0;
    ok(near(dy, 480, 2), `the page scrolls exactly as the wheel turns over ${name} (${dy}px for 480)`);
  }
  // the keyboard: the arrows do not move anything sideways either (and Tab lands on links and buttons only)
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await p.locator('#programs').scrollIntoViewIfNeeded();
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('End'); await p.keyboard.press('Home');
  ok((await lookup(p)).x === 0, 'the arrow keys move nothing sideways');
  const stops = new Set();
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await p.locator('body').click({ position: { x: 5, y: 5 } });
  for (let k = 0; k < 60; k++) { await p.keyboard.press('Tab'); stops.add(await p.evaluate(() => { const e = document.activeElement; return e ? (e.matches('.table-wrap') ? 'the schedule table' : e.tagName.toLowerCase()) : ''; })); }   // the table's own region is the one scroller a keyboard may reach
  ok([...stops].every(t => ['a', 'button', 'input', 'textarea', 'select', 'summary', 'body', 'the schedule table'].includes(t)), `Tab lands on links, buttons, fields and the schedule table only (${[...stops].join(', ')})`);
  await ctx.close();
}

// ---------- the accessibility menu and statement do not talk about strips ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // a visitor who switched the old option "בלי גלילה לצד" on, when the strips still existed, has that choice stored in the browser
  await ctx.addInitScript(() => { try { localStorage.setItem('jk-a11y', JSON.stringify({ fs: 1.2, stack: 1, contrast: 1 })); } catch (e) { /* no storage */ } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await settle(p);
  await p.locator('.a11y-toggle').click();
  const labels = await p.locator('.a11y-panel .a11y-opt').allInnerTexts();
  ok(labels.length === 9 && !labels.some(t => /גלילה לצד/.test(t)), `the accessibility menu has its nine buttons and none for side scrolling (${labels.length}: ${labels.join(' | ')})`);
  const cls = await p.evaluate(() => document.documentElement.className);
  ok(/a11y-contrast/.test(cls) && !/a11y-stack/.test(cls), `an old stored "no side scrolling" choice is ignored and the other stored choices still apply (class "${cls}")`);
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs').trim()) === '1.2', 'the stored text size still applies');
  ok(errs.length === 0, `no script errors with the old stored choice (${errs.join(' | ')})`);
  await p.goto(BASE + 'accessibility.html', { waitUntil: 'load' });
  const text = await p.evaluate(() => document.querySelector('main').innerText);
  ok(!/גלילה לצד|הצידה|החלקה|גרירה/.test(text), 'the accessibility statement says nothing about side scrolling');
  ok(/מקלדת/.test(text) && /5568/.test(text), 'the accessibility statement is intact (keyboard, ת"י 5568)');
  await ctx.close();
}

// ---------- the stylesheet ties every strip layout to a page that has strips ----------
{
  const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } });
  const p = await ctx.newPage();
  const css = await (await p.request.get(BASE + 'assets/css/style.css')).text();
  const gated = css.split('}').filter(r => r.includes('a11y-stack'));
  ok(gated.length >= 10 && gated.every(r => r.includes('has-strips')), `the strips' layout rules (the ones that restyle the groups of cards) all apply only to a page marked has-strips (${gated.length} rules, ${gated.filter(r => !r.includes('has-strips')).length} without the mark)`);
  const sheet = await (await p.request.get(BASE + 'index.html')).text();
  ok(!/a11y-stack/.test(sheet.replace(/<script>[\s\S]*?<\/script>/, '')), 'the page markup has no strip option');
  const init = (sheet.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  ok(init.includes("'nomotion'") && !init.includes("'stack'"), "the inline script that restores stored choices does not know the old option 'stack'");
  await ctx.close();
}

console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

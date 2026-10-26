// The side-scrolling strips (narrow screens): moved by the finger, the mouse or the keyboard, with no arrows, dots or counters.
// Every card must be reachable, a swipe stops on a card, a drag never follows a link, and wide screens keep their grids.
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const read = (p, i) => p.evaluate(i => {
  const t = document.querySelectorAll('[data-hs]')[i];
  const max = t.scrollWidth - t.clientWidth;
  const items = t.classList.contains('gloss') ? [...t.querySelectorAll('dl > div')] : [...t.children];
  const tr = t.getBoundingClientRect();
  // a card counts as seen when most of it is on screen (or most of the strip is that one wide card)
  const seen = items.map(c => { const r = c.getBoundingClientRect(); const vis = Math.max(0, Math.min(r.right, tr.right) - Math.max(r.left, tr.left)); return vis >= Math.min(0.6 * r.width, 0.6 * t.clientWidth); });
  return { label: t.getAttribute('data-hs'), pos: Math.abs(Math.round(t.scrollLeft)), max: Math.round(max), tab: t.getAttribute('tabindex'), role: t.getAttribute('role'), aria: t.getAttribute('aria-label'), items: items.length, seen };
}, i);
const edgeOffset = (p, i) => p.evaluate(i => { const t = document.querySelectorAll('[data-hs]')[i]; const tr = t.getBoundingClientRect(); const ps = parseFloat(getComputedStyle(t).paddingInlineStart) || 0; return Math.min(...[...t.children].map(c => Math.abs((tr.right - ps) - c.getBoundingClientRect().right))); }, i);

// ---------- phone: nothing to press, every card reachable by the finger, keyboard ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const n = await p.evaluate(() => document.querySelectorAll('[data-hs]').length);
  ok(n === 9, `nine carousels found (${n})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page itself does not scroll sideways');
  ok(await p.evaluate(() => !document.querySelector('.hs-ctl, .hs-btn, .hs-dots, .hs-count, [class*="hs-prev"], [class*="hs-next"]')), 'no arrows, dots or counters: the cards are moved by the finger or the mouse');
  const cdp = await ctx.newCDPSession(p);
  async function swipe(i) {   // a finger moving right shows the next card in RTL
    await p.evaluate(i => document.querySelectorAll('[data-hs]')[i].scrollIntoView({ block: 'center' }), i);
    await p.waitForTimeout(120);
    const box = await p.locator('[data-hs]').nth(i).boundingBox();
    const cx = Math.round(box.x + box.width / 2), cy = Math.round(Math.max(60, Math.min(box.y + box.height / 2, 780)));
    const x0 = cx - 90, x1 = cx + 130;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: cy }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 12, y: cy }] }); await p.waitForTimeout(14); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(550);
  }
  for (let i = 0; i < n; i++) {
    const s0 = await read(p, i);
    const tag = `[${s0.label}]`;
    ok(s0.tab === '0' && !!s0.aria && !!s0.role, `${tag} a focusable scroller with a name (${JSON.stringify({ t: s0.tab, r: s0.role })})`);
    ok(s0.pos === 0 && s0.seen[0], `${tag} starts at the first card (${s0.pos})`);
    // the finger: swipe until the end; every card must come into view on the way
    const visited = new Set();
    let guard = 0, s = s0;
    for (;;) {
      s.seen.forEach((v, k) => { if (v) visited.add(k); });
      if (s.pos >= s.max - 3 || guard++ > s.items + 2) break;
      await swipe(i);
      s = await read(p, i);
    }
    ok(visited.size === s0.items, `${tag} every card can be reached with the finger (${visited.size} of ${s0.items})`);
    ok(s.pos >= s.max - 3, `${tag} swiping reaches the end (${s.pos} of ${s.max})`);
    // keyboard on the scroller (RTL: ArrowLeft = next)
    await p.locator('[data-hs]').nth(i).focus();
    await p.keyboard.press('Home'); await p.waitForTimeout(350);
    ok((await read(p, i)).pos <= 3, `${tag} Home jumps to the first card`);
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
    ok((await read(p, i)).pos > 0, `${tag} ArrowLeft moves forward`);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
    ok((await read(p, i)).pos <= 3, `${tag} ArrowRight moves back`);
    await p.keyboard.press('End'); await p.waitForTimeout(350);
    const sE = await read(p, i);
    ok(sE.pos >= sE.max - 3, `${tag} End jumps to the last card`);
  }
  // one swipe moves one card and stops on a card edge (the programs strip)
  const idx = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].findIndex(t => t.classList.contains('programs')));
  await p.locator('[data-hs]').nth(idx).focus(); await p.keyboard.press('Home'); await p.waitForTimeout(400);
  const item = await p.evaluate(i => { const t = document.querySelectorAll('[data-hs]')[i]; const a = t.children[0].getBoundingClientRect(), c = t.children[1].getBoundingClientRect(); return Math.round(Math.abs(c.left - a.left)); }, idx);
  await swipe(idx);
  const sw = await read(p, idx);
  ok(sw.pos > 40, `a touch swipe scrolls the carousel (${sw.pos}px)`);
  ok(sw.pos <= item * 1.2, `a single swipe does not skip past the next card (${sw.pos}px, card step ${item}px)`);
  ok((await edgeOffset(p, idx)) <= 3 || sw.pos >= sw.max - 3, `a swipe stops on a card edge (offset ${Math.round(await edgeOffset(p, idx))}px)`);
  ok(errs.length === 0, 'no script errors: ' + errs.join(' | '));
  await ctx.close();
}

// ---------- mouse drag on a narrow desktop window, and no click after a drag ----------
{
  const ctx = await b.newContext({ viewport: { width: 800, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const idx = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].findIndex(t => t.classList.contains('champs')));
  const t = p.locator('[data-hs]').nth(idx);
  await t.scrollIntoViewIfNeeded();
  let popup = null; ctx.on('page', pg => { popup = pg; });
  // no card contains a link, so add one to prove that a drag that starts on a link never follows it
  await p.evaluate(i => { const a = document.createElement('a'); a.id = 'probe-link'; a.href = 'https://example.test/x'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'probe link text'; document.querySelectorAll('[data-hs]')[i].children[0].appendChild(a); }, idx);
  await ctx.route('https://example.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const link = p.locator('#probe-link');
  await link.scrollIntoViewIfNeeded();
  const lb = await link.boundingBox();
  await p.mouse.move(lb.x + 20, lb.y + 8);
  await p.mouse.down();
  await p.mouse.move(lb.x + 120, lb.y + 8, { steps: 6 });
  await p.mouse.move(lb.x + 260, lb.y + 8, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  const s = await read(p, idx);
  ok(s.pos > 40, `mouse drag scrolls the carousel (${s.pos}px)`);
  ok(!popup, 'dragging that started on a link did not open it');
  ok((await edgeOffset(p, idx)) <= 3 || s.pos >= s.max - 3, `after the drag it snaps to a card (offset ${Math.round(await edgeOffset(p, idx))}px)`);
  await ctx.close();
}

// ---------- option "בלי גלילה לצד" ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.tap('.a11y-toggle'); await p.waitForTimeout(150);
  await p.tap('text=בלי גלילה לצד'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => ({ sw: t.scrollWidth - t.clientWidth, tab: t.getAttribute('tabindex'), disp: getComputedStyle(t).display })));
  ok(st.every(x => x.sw <= 1 && x.tab === null), 'stacked view: nothing scrolls sideways and there are no extra tab stops');
  ok(await p.evaluate(() => document.documentElement.classList.contains('a11y-stack') && document.querySelector('.a11y-opt[aria-pressed="true"]').textContent.includes('בלי גלילה')), 'the option is marked as pressed');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.classList.contains('a11y-stack')), 'the choice is remembered');
  await p.tap('.a11y-toggle'); await p.waitForTimeout(150);
  await p.tap('text=בלי גלילה לצד'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].every(t => t.getAttribute('tabindex') === '0')), 'turning it off brings the carousels back');
  await ctx.close();
}

// ---------- desktop: unchanged grids ----------
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => ({ ox: getComputedStyle(t).overflowX, tab: t.getAttribute('tabindex'), sw: t.scrollWidth - t.clientWidth })));
  ok(st.every(x => x.ox !== 'auto' && x.tab === null && x.sw <= 1), 'desktop keeps the grids: no scroller and no extra tab stops');
  await ctx.close();
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

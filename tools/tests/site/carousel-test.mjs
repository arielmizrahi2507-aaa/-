import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const read = (p, i) => p.evaluate(i => {
  const t = document.querySelectorAll('[data-hs]')[i];
  const w = t.parentNode;
  const ctl = w.querySelector('.hs-ctl');
  const max = t.scrollWidth - t.clientWidth;
  return { label: t.getAttribute('data-hs'), pos: Math.abs(Math.round(t.scrollLeft)), max: Math.round(max), tab: t.getAttribute('tabindex'), role: t.getAttribute('role'), aria: t.getAttribute('aria-label'),
    ctlHidden: ctl.hidden, dots: ctl.querySelector('.hs-count') ? 'count' : ctl.querySelectorAll('.hs-dots i').length, counter: ctl.querySelector('.hs-count') ? ctl.querySelector('.hs-count').textContent : '', on: ctl.querySelector('.hs-count') ? parseInt(ctl.querySelector('.hs-count').textContent) - 1 : [...ctl.querySelectorAll('.hs-dots i')].findIndex(d => d.classList.contains('on')),
    prevDis: ctl.querySelector('.hs-prev').getAttribute('aria-disabled'), nextDis: ctl.querySelector('.hs-next').getAttribute('aria-disabled'),
    items: t.classList.contains('gloss') ? t.querySelectorAll('dl > div').length : t.children.length };
}, i);

// ---------- phone: buttons, dots, keyboard, touch swipe ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const n = await p.evaluate(() => document.querySelectorAll('[data-hs]').length);
  ok(n === 9, `nine carousels found (${n})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page itself does not scroll sideways');
  for (let i = 0; i < n; i++) {
    const s0 = await read(p, i);
    const tag = `[${s0.label}]`;
    ok(s0.tab === '0' && !!s0.aria && !!s0.role && !s0.ctlHidden, `${tag} focusable scroller with name and controls (${JSON.stringify({ t: s0.tab, r: s0.role, h: s0.ctlHidden })})`);
    ok(s0.items > 6 ? (s0.dots === 'count' && s0.counter === '1 מתוך ' + s0.items) : s0.dots === s0.items, `${tag} progress indicator matches the items (${s0.dots}/${s0.items} ${s0.counter})`);
    ok(s0.pos === 0 && s0.prevDis === 'true' && s0.nextDis === 'false' && s0.on === 0, `${tag} starts at the first item (${JSON.stringify({ pos: s0.pos, p: s0.prevDis, n: s0.nextDis, on: s0.on })})`);
    const ctl = p.locator('[data-hs]').nth(i).locator('xpath=..').locator('.hs-ctl');
    await ctl.scrollIntoViewIfNeeded();
    // next until the end
    let guard = 0, last = -1;
    while ((await read(p, i)).nextDis !== 'true' && guard++ < 12) { await ctl.locator('.hs-next').tap(); await p.waitForTimeout(220); }
    const sEnd = await read(p, i);
    ok(sEnd.nextDis === 'true' && sEnd.pos >= sEnd.max - 3 && sEnd.on === sEnd.items - 1 && sEnd.prevDis === 'false', `${tag} next reaches the last item (${JSON.stringify({ pos: sEnd.pos, max: sEnd.max, on: sEnd.on, steps: guard })})`);
    // prev back to start
    guard = 0;
    while ((await read(p, i)).prevDis !== 'true' && guard++ < 12) { await ctl.locator('.hs-prev').tap(); await p.waitForTimeout(220); }
    const sBack = await read(p, i);
    ok(sBack.pos <= 3 && sBack.on === 0, `${tag} prev returns to the start (${sBack.pos})`);
    // keyboard on the scroller (RTL: ArrowLeft = next)
    await p.locator('[data-hs]').nth(i).focus();
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
    const sK = await read(p, i);
    ok(sK.pos > 0, `${tag} ArrowLeft moves forward (${sK.pos})`);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
    ok((await read(p, i)).pos <= 3, `${tag} ArrowRight moves back`);
    await p.keyboard.press('End'); await p.waitForTimeout(300);
    const sE2 = await read(p, i);
    ok(sE2.pos >= sE2.max - 3, `${tag} End jumps to the last item`);
    await p.keyboard.press('Home'); await p.waitForTimeout(300);
    ok((await read(p, i)).pos <= 3, `${tag} Home jumps to the first item`);
  }
  // real touch swipe on the programs carousel (finger drags to the right = next in RTL)
  const idx = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].findIndex(t => t.classList.contains('programs')));
  await p.evaluate(i => document.querySelectorAll('[data-hs]')[i].scrollIntoView({ block: 'center' }), idx);
  await p.waitForTimeout(300);
  const box = await p.locator('[data-hs]').nth(idx).boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(Math.min(box.y + box.height / 2, 800));
  async function swipe(x0, x1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: cy }] });
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 14, y: cy }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(800);
  }
  const align = () => p.evaluate(i => { const t = document.querySelectorAll('[data-hs]')[i]; const tr = t.getBoundingClientRect(); const ps = parseFloat(getComputedStyle(t).paddingInlineStart); return Math.min(...[...t.children].map(c => Math.abs((tr.right - ps) - c.getBoundingClientRect().right))); }, idx);
  const item = await p.evaluate(i => { const t = document.querySelectorAll('[data-hs]')[i]; const a = t.children[0].getBoundingClientRect(), b = t.children[1].getBoundingClientRect(); return Math.round(Math.abs(b.left - a.left)); }, idx);
  await swipe(cx - 90, cx + 130); // a finger moving right shows the next card in RTL
  const sw = await read(p, idx);
  ok(sw.pos > 40, `a touch swipe scrolls the carousel (${sw.pos}px)`);
  ok(sw.pos <= item * 1.2, `a single swipe does not skip past the next card (${sw.pos}px, card step ${item}px)`);
  ok((await align()) <= 3 || sw.pos >= sw.max - 3, `swipe snaps to a card edge (offset ${Math.round(await align())}px)`);
  await swipe(cx + 130, cx - 90); // and back
  ok((await read(p, idx)).pos <= 3, 'swiping the other way returns to the first card');
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
  const box = await t.boundingBox();
  const y = box.y + 80;
  let popup = null; ctx.on('page', pg => { popup = pg; });
  // drag from the link area to the right (RTL: next)
  // no card contains a link any more, so add one to prove that a drag that starts on a link never follows it
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
  const aligned = await p.evaluate(i => { const tt = document.querySelectorAll('[data-hs]')[i]; const tr = tt.getBoundingClientRect(); const ps = parseFloat(getComputedStyle(tt).paddingInlineStart); return Math.min(...[...tt.children].map(c => Math.abs((tr.right - ps) - c.getBoundingClientRect().right))); }, idx);
  ok(aligned <= 3 || s.pos >= s.max - 3, `after the drag it snaps to a card (offset ${Math.round(aligned)}px)`);
  await ctx.close();
}

// ---------- option "בלי גלילה לצד" ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.tap('.a11y-toggle'); await p.waitForTimeout(150);
  await p.tap('text=בלי גלילה לצד'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => ({ sw: t.scrollWidth - t.clientWidth, tab: t.getAttribute('tabindex'), ctl: !t.parentNode.querySelector('.hs-ctl').hidden, disp: getComputedStyle(t).display })));
  ok(st.every(x => x.sw <= 1 && x.tab === null && !x.ctl), 'stacked view: nothing scrolls sideways, no controls, no extra tab stops');
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
  const st = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => ({ ox: getComputedStyle(t).overflowX, tab: t.getAttribute('tabindex'), ctl: !t.parentNode.querySelector('.hs-ctl').hidden, sw: t.scrollWidth - t.clientWidth })));
  ok(st.every(x => x.ox !== 'auto' && x.tab === null && !x.ctl && x.sw <= 1), 'desktop keeps the grids: no scroller, no controls, no extra tab stops');
  await ctx.close();
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

// Page scroll moves the side-scrolling strips (narrow screens, scripts on, motion allowed): the strip stays put under the header,
// the cards slide sideways one pixel for every pixel of page scroll, and after the last card the page goes on as usual.
// Also: swipe, keys and "reveal this card" keep the page position in step; the options and screens that must not do this don't;
// nothing is ever cut off by the header or the bottom bar; wide screens and print are unchanged.
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const near = (a, bb, tol) => Math.abs(a - bb) <= tol;

const frames = (p, n = 3) => p.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const goY = async (p, y) => { await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await frames(p); };
const summary = p => p.evaluate(() => ({
  pins: document.querySelectorAll('.hs.hs-pin').length,
  strips: document.querySelectorAll('[data-hs]').length,
  docH: document.documentElement.scrollHeight,
  sideways: document.documentElement.scrollWidth > innerWidth,
}));
// how far the stage of each pinned strip is from the free screen (between the header and the bottom bar)
const freeFit = () => {
  const side = document.querySelector('.side'), bar = document.querySelector('.mbar');
  const free = (bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight) - side.getBoundingClientRect().bottom;
  return [...document.querySelectorAll('.hs.hs-pin')].map(h => Math.abs(h.querySelector('.hs-stage').getBoundingClientRect().height - free));
};
// one strip: where its box is in the document, how far its cards travel, where the stage sticks
const geom = (p, i) => p.evaluate(i => {
  const hs = document.querySelectorAll('.hs')[i], t = hs.querySelector('[data-hs]');
  const pinTop = parseFloat(hs.style.getPropertyValue('--hs-top'));
  const bar = document.querySelector('.mbar');
  const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().height : 0;
  return { label: t.getAttribute('data-hs'), pinned: hs.classList.contains('hs-pin'), top: hs.getBoundingClientRect().top + scrollY, h: hs.getBoundingClientRect().height, d: t.scrollWidth - t.clientWidth, th: t.offsetHeight, tight: hs.classList.contains('hs-tight'), pinTop, barH, n: (t.classList.contains('gloss') ? t.querySelectorAll('dl > div') : t.children).length };
}, i);
const live = (p, i) => p.evaluate(i => {
  const hs = document.querySelectorAll('.hs')[i], t = hs.querySelector('[data-hs]'), st = hs.querySelector('.hs-stage');
  const tr = t.getBoundingClientRect(), hr = hs.getBoundingClientRect(), sr = st.getBoundingClientRect();
  const cards = t.classList.contains('gloss') ? [...t.querySelectorAll('dl > div')] : [...t.children];
  const seen = cards.map(c => { const r = c.getBoundingClientRect(); const vis = Math.max(0, Math.min(r.right, tr.right) - Math.max(r.left, tr.left)); return vis >= Math.min(0.6 * r.width, 0.6 * t.clientWidth); });
  const side = document.querySelector('.side'), bar = document.querySelector('.mbar');
  const headerBottom = side.getBoundingClientRect().bottom;                                                   // measured here, not taken from the script's own numbers
  const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight;
  return { y: scrollY, left: Math.abs(t.scrollLeft), hsTop: hr.top, hsBottom: hr.bottom, stageTop: sr.top, stageBottom: sr.bottom, trackTop: tr.top, trackBottom: tr.bottom, headerBottom, barTop, seen };
}, i);

async function open(opts, size = { width: 390, height: 844 }, mobile = size.width < 900) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, ...opts });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}

// ---------- baseline: how tall the page and the strips are without the pinning ----------
const baselines = {};
async function baseline(size) {
  const key = size.width + 'x' + size.height;
  if (baselines[key]) return baselines[key];
  const { ctx, p } = await open({ reducedMotion: 'reduce' }, size);
  const s = await summary(p);
  const base = {
    docH: s.docH,
    trackTop: await p.evaluate(() => document.querySelector('[data-hs]').getBoundingClientRect().top + scrollY),
    th: await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => t.offsetHeight)),
  };
  if (!Object.keys(baselines).length) {
    ok(s.pins === 0, `reduced motion: no strip is pinned (${s.pins})`);
    ok(await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].every(t => t.getAttribute('tabindex') === '0')), 'reduced motion: the strips still swipe (focusable scrollers)');
    ok(await p.evaluate(() => [...document.querySelectorAll('.hs')].every(h => Math.abs(h.getBoundingClientRect().height - h.querySelector('[data-hs]').getBoundingClientRect().height) < 2)), 'reduced motion: the strips take only their own height');
    ok(await p.evaluate(() => document.querySelectorAll('.hs-tight').length === 0), 'reduced motion: no card is tightened');
  }
  await ctx.close();
  return (baselines[key] = base);
}
const baseH = (await baseline({ width: 390, height: 844 })).docH;

// ---------- phone: page scroll moves every strip (a tall screen, and a short one where the tall strips need tighter cards) ----------
async function phoneRun(size, name, expectTight) {
  const base = await baseline(size);
  const { ctx, p, errs } = await open({}, size);
  const s = await summary(p);
  ok(s.pins === 9 && s.strips === 9, `${name}: all nine strips are pinned (${s.pins} of ${s.strips})`);
  ok(!s.sideways, `${name}: the page itself does not scroll sideways`);
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs-pin [data-hs]')].every(t => getComputedStyle(t).overflowX === 'auto')), `${name}: on a touch screen a pinned strip can still be swiped sideways`);
  const g = [];
  for (let i = 0; i < s.strips; i++) g.push(await geom(p, i));
  const tightNow = g.filter(x => x.tight).length;
  ok(expectTight ? tightNow >= 3 : tightNow === 0, `${name}: ${expectTight ? 'the tall strips are tightened to fit' : 'no card is tightened when everything fits'} (${tightNow} tightened)`);
  if (tightNow) {
    ok(await p.evaluate(() => [...document.querySelectorAll('.hs-tight')].every(h => [...h.querySelectorAll('p')].every(el => getComputedStyle(el).fontSize === '16px' || getComputedStyle(el).fontSize === '17px'))), `${name}: tightened cards keep the size of the text`);
  }
  const travel = g.reduce((a, x, i) => a + x.d + (x.th - base.th[i]), 0);
  ok(near(s.docH - base.docH, travel, 12), `${name}: the page is longer by exactly the way the cards travel (${s.docH - base.docH}px, expected ${travel}px)`);
  const trackTop = await p.evaluate(() => document.querySelector('[data-hs]').getBoundingClientRect().top + scrollY);
  ok(near(trackTop, base.trackTop, 2), `${name}: before it is pinned the first strip sits exactly where it sits without pinning (${Math.round(trackTop)}px, otherwise ${Math.round(base.trackTop)}px)`);
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs-stage')].every(st => getComputedStyle(st).pointerEvents === 'none' && getComputedStyle(st.querySelector('[data-hs]')).pointerEvents === 'auto')), `${name}: the stage never takes a tap or a click, only the cards do`);
  // the stage's empty room overlaps the text above and below the strip: a link there must still be reachable
  await p.evaluate(() => document.querySelector('.sched-note a').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await frames(p);
  ok(await p.evaluate(() => { const a = document.querySelector('.sched-note a'); const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return a === e || a.contains(e); }), `${name}: a link that sits under the empty room of a strip can be tapped`);

  for (let i = 0; i < g.length; i++) {
    const x = g[i], tag = `[${name}: ${x.label}]`;
    const start = x.top - x.pinTop;           // page scroll at which the stage reaches the header
    await goY(p, Math.max(0, start - 300));
    let s0 = await live(p, i);
    ok(s0.left <= 1, `${tag} before it is reached the strip is at its first card (${s0.left})`);
    ok(s0.stageTop > s0.headerBottom + 100, `${tag} before it is reached it scrolls up with the page (stage ${Math.round(s0.stageTop)}, header ${Math.round(s0.headerBottom)})`);
    ok(near(x.pinTop, s0.headerBottom, 1.5), `${tag} the strip sticks right under the header (${x.pinTop}px, header ends at ${Math.round(s0.headerBottom)}px)`);
    const visited = new Set();
    let bad = 0, still = 0, outside = 0, short = 0, steps = 0;
    const step = Math.max(40, Math.round(x.d / 24));
    for (let y = start; y <= start + x.d + step; y += step) {
      const yy = Math.min(y, start + x.d);
      await goY(p, yy);
      const s1 = await live(p, i);
      steps++;
      if (!near(s1.left, Math.min(x.d, Math.max(0, s1.y - start)), 2.5)) bad++;
      if (!near(s1.stageTop, s1.headerBottom, 1.5)) still++;
      if (s1.trackTop < s1.headerBottom - 1 || s1.trackBottom > s1.barTop + 1) outside++;
      if (!near(s1.stageBottom, s1.barTop, 2.5)) short++;
      s1.seen.forEach((v, k) => { if (v) visited.add(k); });
      if (yy >= start + x.d) break;
    }
    ok(bad === 0, `${tag} the cards move 1:1 with the page scroll (${bad} of ${steps} positions off)`);
    ok(still === 0, `${tag} the strip stays under the header while the cards move (${still} of ${steps} positions off)`);
    ok(outside === 0, `${tag} the strip is never hidden by the header or the bottom bar (${outside} positions)`);
    ok(short === 0, `${tag} while it is pinned the strip owns the whole free screen, so nothing else shows (${short} positions)`);
    ok(visited.size === x.n, `${tag} every card comes by with plain scrolling (${visited.size} of ${x.n})`);
    await goY(p, start + x.d + 300);
    const s2 = await live(p, i);
    ok(near(s2.left, x.d, 1.5), `${tag} after the last card the strip is at its end (${s2.left} of ${x.d})`);
    ok(s2.stageTop < s2.headerBottom - 100, `${tag} after the last card the strip goes up with the page (stage ${Math.round(s2.stageTop)})`);
    await goY(p, Math.max(0, start - 100));
    ok((await live(p, i)).left <= 1, `${tag} scrolling back up brings the strip back to its first card`);
  }

  // a jump to the end and back leaves every strip at the right end, also those far away
  await goY(p, 1e6);
  const ends = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => Math.abs(t.scrollLeft) >= t.scrollWidth - t.clientWidth - 1.5));
  ok(ends.every(Boolean), `${name}: jumping to the bottom of the page leaves every strip at its last card (${ends.filter(Boolean).length} of ${ends.length})`);
  await goY(p, 0);
  const starts = await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].map(t => Math.abs(t.scrollLeft) <= 1.5));
  ok(starts.every(Boolean), `${name}: jumping back to the top leaves every strip at its first card (${starts.filter(Boolean).length} of ${starts.length})`);
  ok(errs.length === 0, `${name}: no script errors: ` + errs.join(' | '));
  await ctx.close();
}
await phoneRun({ width: 390, height: 844 }, '390x844', false);
await phoneRun({ width: 390, height: 560 }, '390x560', true);

// ---------- a real finger, the keys, and "reveal this card" ----------
{
  const { ctx, p } = await open({});
  const cdp = await ctx.newCDPSession(p);
  const drag = async (x0, y0, x1, y1, steps = 14) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let k = 1; k <= steps; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / steps, y: y0 + (y1 - y0) * k / steps }] }); await p.waitForTimeout(14); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const idx = 1;   // the programs strip
  const x = await geom(p, idx);
  const start = x.top - x.pinTop;
  const consistent = async m => { const s = await live(p, idx); ok(near(s.left, Math.min(x.d, Math.max(0, s.y - start)), 3), `${m}: the page and the cards agree (left ${Math.round(s.left)}, page ${Math.round(s.y - start)})`); return s; };

  await goY(p, start + 100);
  const a = await live(p, idx);
  await drag(200, 700, 200, 300, 16);                         // finger up = page down
  await p.waitForTimeout(1200);
  const a2 = await consistent('a finger on the page');
  ok(a2.left - a.left > 300 && a2.y > a.y + 300, `a finger on the page moves the cards with it (${Math.round(a2.left - a.left)}px of ${Math.round(a2.y - a.y)}px)`);
  await drag(200, 300, 200, 600, 12);                         // finger down = page up
  await p.waitForTimeout(1200);
  const a3 = await consistent('a finger back down');
  ok(a3.left < a2.left - 150, 'a finger back down brings the cards back');

  const box = await p.locator('.hs').nth(idx).locator('[data-hs]').boundingBox();
  const before = await live(p, idx);
  await drag(box.x + 120, box.y + box.height / 2, box.x + 330, box.y + box.height / 2, 14);   // sideways swipe on the strip
  await p.waitForTimeout(1500);
  const after = await consistent('a sideways swipe on the strip');
  ok(after.left > before.left + 100, `a sideways swipe still moves the cards (${Math.round(before.left)} to ${Math.round(after.left)})`);
  await drag(200, 700, 200, 600, 8);                          // then ordinary scrolling goes on from there
  await p.waitForTimeout(1000);
  const after2 = await consistent('scrolling after a sideways swipe');
  ok(after2.left >= after.left, 'scrolling after a sideways swipe goes on from where the cards are, not from where they were');

  const track = p.locator('.hs').nth(idx).locator('[data-hs]');
  await goY(p, start + 100);
  await track.focus();
  const k0 = await live(p, idx);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  const k1 = await consistent('ArrowLeft');
  ok(k1.left > k0.left + 100, 'ArrowLeft moves to the next card and the page follows');
  await p.keyboard.press('End'); await p.waitForTimeout(1200);
  const k2 = await consistent('End');
  ok(near(k2.left, x.d, 2), 'End shows the last card');
  await p.keyboard.press('Home'); await p.waitForTimeout(1200);
  const k3 = await consistent('Home');
  ok(k3.left <= 2, 'Home shows the first card');

  await p.evaluate(i => document.querySelectorAll('[data-hs]')[i].children[3].scrollIntoView({ inline: 'center', block: 'nearest' }), idx);   // what find-in-page and screen readers do
  await p.waitForTimeout(900);
  const r = await consistent('revealing the last card');
  ok(r.left > x.d - 330, `revealing a card that is off to the side brings the page to it (${Math.round(r.left)} of ${x.d})`);
  await ctx.close();
}

// ---------- the wheel of a narrow desktop window ----------
{
  const { ctx, p } = await open({}, { width: 800, height: 900 });
  const s = await summary(p);
  ok(s.pins >= 5, `a 800x900 window pins the strips that scroll (${s.pins})`);
  const idx = await p.evaluate(() => [...document.querySelectorAll('.hs')].findIndex(h => h.classList.contains('hs-pin') && h.querySelector('.programs')));
  const x = await geom(p, idx);
  const start = x.top - x.pinTop;
  await goY(p, start + 50);
  await p.mouse.move(400, 500);
  const a = await live(p, idx);
  await p.mouse.wheel(0, 300); await p.waitForTimeout(700);
  const a2 = await live(p, idx);
  ok(near(a2.left - a.left, a2.y - a.y, 3) && a2.y - a.y > 200, `a mouse wheel turn moves the cards with the page (${Math.round(a2.left - a.left)}px of ${Math.round(a2.y - a.y)}px)`);
  await ctx.close();
}

// ---------- the Claude desktop app: a narrow panel, a mouse or a touchpad, a visible scrollbar, no touch screen ----------
{
  const { ctx, p } = await open({}, { width: 341, height: 591 }, false);
  const s = await summary(p);
  ok(s.pins === 9, `a 341x591 panel pins all nine strips (${s.pins})`);
  ok(await p.evaluate(() => matchMedia('(pointer:fine)').matches && !matchMedia('(pointer:coarse)').matches), 'the panel has a mouse or touchpad and no touch screen');
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs-pin [data-hs]')].every(t => getComputedStyle(t).overflowX === 'hidden')), 'with a mouse or touchpad a pinned strip takes no sideways scrolling of its own, the page scroll moves it');
  const idx = await p.evaluate(() => [...document.querySelectorAll('.hs')].findIndex(h => h.querySelector('.gloss')));
  const x = await geom(p, idx);
  await goY(p, x.top - x.pinTop + 50);
  const box = await p.locator('.hs').nth(idx).locator('[data-hs]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);   // the pointer rests on the strip
  const a = await live(p, idx);
  for (let k = 0; k < 4; k++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(60); }      // a mouse wheel
  for (let k = 0; k < 6; k++) { await p.mouse.wheel(4, 100); await p.waitForTimeout(60); }      // a touchpad: always a little sideways drift
  await p.waitForTimeout(700);
  const a2 = await live(p, idx);
  ok(near(a2.y - a.y, 1000, 6), `a touchpad that drifts sideways over a strip still scrolls the page (${Math.round(a2.y - a.y)} of 1000px)`);
  ok(near(a2.left - a.left, a2.y - a.y, 4), `the cards follow the page scroll of a touchpad (${Math.round(a2.left - a.left)}px of ${Math.round(a2.y - a.y)}px)`);
  // dragging the strip with the mouse still works and the page follows
  const d0 = await live(p, idx);
  await p.mouse.move(box.x + 250, box.y + box.height / 2);
  await p.mouse.down(); await p.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(700);
  const d1 = await live(p, idx);
  ok(Math.abs(d1.left - d0.left) > 80 && near(d1.left, Math.min(x.d, Math.max(0, d1.y - (x.top - x.pinTop))), 3), `dragging a pinned strip with the mouse moves the cards and the page follows (${Math.round(d0.left)} to ${Math.round(d1.left)})`);
  await ctx.close();
}

// ---------- the window is resized in height: the stage follows ----------
{
  const { ctx, p } = await open({}, { width: 341, height: 591 }, false);
  await p.setViewportSize({ width: 341, height: 520 }); await p.waitForTimeout(800);
  const fit = await p.evaluate(freeFit);
  ok(fit.length >= 6 && fit.every(d => d <= 2.5), `after the window got lower the pinned strips fill the new free screen (${fit.length} pinned, largest difference ${Math.round(Math.max(...fit))}px)`);
  let hidden = 0;
  const n = await p.evaluate(() => document.querySelectorAll('.hs').length);
  for (let i = 0; i < n; i++) {
    const x = await geom(p, i);
    if (!x.pinned) continue;
    await goY(p, x.top - x.pinTop + Math.round(x.d / 2));
    const l = await live(p, i);
    if (l.trackTop < l.headerBottom - 1 || l.trackBottom > l.barTop + 1) hidden++;
  }
  ok(hidden === 0, `after the window got lower no pinned strip is hidden by the header or the bottom bar (${hidden})`);
  await ctx.close();
}

// ---------- a frame as tall as the page does not scroll by itself: nothing to pin ----------
{
  const { ctx, p } = await open({}, { width: 390, height: 900 });
  ok((await summary(p)).pins === 9, 'a 390x900 window pins the strips');
  await p.setViewportSize({ width: 390, height: 24000 }); await p.waitForTimeout(900);
  const s = await summary(p);
  ok(s.pins === 0 && s.docH <= 24100, `a frame that grew to the height of the page pins nothing and leaves no blank scroll space (${s.pins} pinned, page ${s.docH}px)`);
  await ctx.close();
}

// ---------- where it must not happen ----------
{
  const { ctx, p } = await open({});
  await p.tap('.a11y-toggle'); await p.waitForTimeout(150);
  const opt = t => p.locator('.a11y-opt', { hasText: t });
  await opt('עצירת אנימציות').tap(); await p.waitForTimeout(500);
  let s = await summary(p);
  ok(s.pins === 0 && near(s.docH, baseH, 4), `"עצירת אנימציות" turns the pinning off (${s.pins} pinned, page ${s.docH}px)`);
  await opt('עצירת אנימציות').tap(); await p.waitForTimeout(500);
  s = await summary(p);
  ok(s.pins === 9, `turning "עצירת אנימציות" off brings the pinning back (${s.pins})`);
  await opt('בלי גלילה לצד').tap(); await p.waitForTimeout(500);
  s = await summary(p);
  ok(s.pins === 0, `"בלי גלילה לצד" leaves nothing pinned (${s.pins})`);
  await opt('בלי גלילה לצד').tap(); await p.waitForTimeout(500);
  ok((await summary(p)).pins === 9, 'turning "בלי גלילה לצד" off brings the pinning back');
  for (let i = 0; i < 4; i++) { await opt('הגדלת טקסט').tap(); await p.waitForTimeout(200); }
  await p.waitForTimeout(500);
  s = await summary(p);
  ok(s.pins < 9 && s.pins >= 3, `with text enlarged to 140% the strips that no longer fit are left alone (${s.pins} of 9 pinned)`);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].every(t => t.getAttribute('tabindex') === '0')), 'enlarged text: every strip still scrolls sideways by itself');
  // whatever is pinned fits between the header and the bottom bar
  const gs = []; for (let i = 0; i < 9; i++) gs.push(await geom(p, i));
  let hidden = 0;
  for (let i = 0; i < 9; i++) {
    if (!gs[i].pinned) continue;
    await goY(p, gs[i].top - gs[i].pinTop + Math.round(gs[i].d / 2));
    const l = await live(p, i);
    if (l.trackTop < l.headerBottom - 1 || l.trackBottom > l.barTop + 1) hidden++;
  }
  ok(hidden === 0, `with enlarged text no pinned strip is hidden by the header or the bottom bar (${hidden})`);
  await ctx.close();
}
{
  const { ctx, p } = await open({}, { width: 844, height: 390 });
  const s = await summary(p);
  ok(s.pins < s.strips, `a phone on its side pins only the strips that fit (${s.pins} of ${s.strips})`);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].filter(t => !t.closest('.hs-pin') && t.scrollWidth - t.clientWidth > 4).every(t => t.getAttribute('tabindex') === '0')), 'a phone on its side: the strips that do not fit still swipe');
  let hidden = 0;
  const n = await p.evaluate(() => document.querySelectorAll('.hs').length);
  for (let i = 0; i < n; i++) {
    const x = await geom(p, i);
    if (!x.pinned) continue;
    await goY(p, x.top - x.pinTop + Math.round(x.d / 2));
    const l = await live(p, i);
    if (l.trackTop < l.headerBottom - 1 || l.trackBottom > l.barTop + 1) hidden++;
  }
  ok(hidden === 0, `a phone on its side: no pinned strip is hidden by the header (${hidden})`);
  await ctx.close();
}
{
  // turning the phone and resizing the window changes the mode without breaking the page
  const { ctx, p } = await open({});
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(700);
  let s = await summary(p);
  ok(s.pins === 0 && !s.sideways, `widening the window to 1200px removes the pinning (${s.pins})`);
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs')].every(h => getComputedStyle(h).display !== 'none' && h.style.getPropertyValue('--hs-d') === '')), 'widening the window clears the pinning values');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(700);
  s = await summary(p);
  ok(s.pins === 9 && near(s.docH, baseH + (await p.evaluate(() => [...document.querySelectorAll('[data-hs]')].reduce((a, t) => a + t.scrollWidth - t.clientWidth, 0))), 12), `narrowing it again brings the pinning back (${s.pins})`);
  await ctx.close();
}
{
  // the header is not measured while the phone menu covers the page, so closing the menu measures again
  const { ctx, p } = await open({});
  await p.tap('.menu-btn'); await p.waitForTimeout(200);
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(700);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const s = await summary(p);
  ok(s.pins > 0 && s.pins < s.strips, `turning the phone while the menu is open: after closing it the strips are measured for the new size (${s.pins} of ${s.strips} pinned)`);
  const fit = await p.evaluate(freeFit);
  ok(fit.length > 0 && fit.every(d => d <= 2.5), `turning the phone while the menu is open: the pinned strips fill the new free screen, not the old one (largest difference ${Math.round(Math.max(...fit))}px)`);
  await ctx.close();
}
{
  const { ctx, p } = await open({}, { width: 1440, height: 900 });
  const s = await summary(p);
  ok(s.pins === 0, 'a wide screen pins nothing');
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs-stage')].every(h => getComputedStyle(h).display === 'contents')), 'a wide screen: the stage is not a box, so the grids are laid out as before');
  await ctx.close();
}

// ---------- landing on a section: a fresh load of a link (also on a slow phone), a reload, and the options ----------
{
  for (const h of ['join', 'way']) {
    let worst = 0;
    for (let k = 0; k < 2; k++) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await p.goto(BASE + 'index.html#' + h, { waitUntil: 'load' });   // a new page every time, so the pinning really happens after the load starts
      await p.waitForTimeout(1500);
      worst = Math.max(worst, Math.abs(await p.evaluate(h => Math.round(document.getElementById(h).getBoundingClientRect().top), h) - 120));
      await ctx.close();
    }
    ok(worst <= 3, `a link to #${h} opened on a phone four times slower lands under the header (off by ${worst}px at worst)`);
  }
  const { ctx, p } = await open({});
  const topOf = id => p.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
  await goY(p, await p.evaluate(() => document.getElementById('faq').getBoundingClientRect().top + scrollY - 200));
  const t0 = await topOf('faq');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  ok(near(await topOf('faq'), t0, 3), `reloading the page keeps the visitor at the same place (${t0}px then ${await topOf('faq')}px)`);
  await p.tap('.a11y-toggle'); await p.waitForTimeout(150);
  await p.locator('.a11y-opt', { hasText: 'עצירת אנימציות' }).tap(); await p.waitForTimeout(700);
  ok(near(await topOf('faq'), t0, 3), `turning the pinning off in the accessibility menu keeps the visitor at the same place (${t0}px then ${await topOf('faq')}px)`);
  await p.locator('.a11y-opt', { hasText: 'עצירת אנימציות' }).tap(); await p.waitForTimeout(700);
  ok(near(await topOf('faq'), t0, 3), `turning it on again keeps the visitor at the same place too (${await topOf('faq')}px)`);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('.hs')].every(h => getComputedStyle(h.querySelector('.hs-stage')).position === 'static' && Math.abs(h.getBoundingClientRect().height - h.querySelector('[data-hs]').getBoundingClientRect().height) < 2)), 'print: no empty pinning space between the cards');
  await ctx.close();
}

console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

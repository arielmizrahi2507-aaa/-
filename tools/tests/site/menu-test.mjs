import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const configs = [
  ['portrait 390x844', { width: 390, height: 844 }, 1],
  ['small 320x568', { width: 320, height: 568 }, 1],
  ['landscape 667x375', { width: 667, height: 375 }, 1],
  ['small + text 140%', { width: 320, height: 568 }, 1.4],
  ['landscape + text 140%', { width: 667, height: 375 }, 1.4],
];
for (const [name, vp, fs] of configs) {
  for (const pg of ['index.html', 'privacy.html', 'terms.html']) {
    const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(BASE + pg, { waitUntil: 'load' });
    if (fs !== 1) await p.evaluate(f => document.documentElement.style.setProperty('--fs', f), fs);
    await p.tap('.menu-btn');
    await p.waitForTimeout(250);
    const info = await p.evaluate(() => {
      const side = document.querySelector('.side');
      const nav = document.querySelector('.side-nav');
      const links = [...nav.querySelectorAll('a')];
      const sr = side.getBoundingClientRect();
      const cs = getComputedStyle(side);
      return { expanded: document.querySelector('.menu-btn').getAttribute('aria-expanded'), sideH: Math.round(sr.height), vh: innerHeight, overflowY: cs.overflowY, scrollable: side.scrollHeight > side.clientHeight + 1, n: links.length,
        lastBottom: Math.round(links[links.length - 1].getBoundingClientRect().bottom), hs: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    ok(info.expanded === 'true', `${name} ${pg}: menu opens`);
    ok(info.sideH <= info.vh + 1, `${name} ${pg}: open menu fits the viewport (${info.sideH} <= ${info.vh})`);
    ok(!info.hs, `${name} ${pg}: no horizontal scroll`);
    // every link reachable: scroll inside the menu to the last link and tap it
    const last = p.locator('.side-nav a').last();
    await last.scrollIntoViewIfNeeded();
    const vis = await last.evaluate(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
    ok(vis, `${name} ${pg}: last menu link can be scrolled into view (overflowY=${info.overflowY}, scrollable=${info.scrollable})`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    const closed = await p.evaluate(() => ({ exp: document.querySelector('.menu-btn').getAttribute('aria-expanded'), focused: document.activeElement === document.querySelector('.menu-btn') }));
    ok(closed.exp === 'false' && closed.focused, `${name} ${pg}: Escape closes and returns focus (${JSON.stringify(closed)})`);
    await ctx.close();
  }
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

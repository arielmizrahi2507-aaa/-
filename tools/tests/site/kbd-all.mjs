import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const pages = ['index.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['mobile-large-text', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }]]) {
  for (const pg of pages) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(BASE + pg, { waitUntil: 'load' });
    if (name === 'mobile-large-text') await p.evaluate(() => document.documentElement.style.setProperty('--fs', '1.4'));
    const seen = new Set(), noRing = [], obscured = [], order = [];
    let stops = 0, cycled = false;
    await p.evaluate(() => document.body.focus());
    for (let i = 0; i < 260; i++) {
      await p.keyboard.press('Tab');
      await p.waitForTimeout(12);
      const info = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { body: true };
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== 'none');
        const label = (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        const tag = el.tagName.toLowerCase();
        const key = tag + ':' + label + ':' + Math.round(r.left) + ':' + Math.round(window.scrollY + r.top);
        // is the focused element fully/partly reachable: test the 4 inner quarter points and the centre
        const pts = [[.5, .5], [.2, .5], [.8, .5], [.5, .2], [.5, .8]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
        const inView = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
        const hit = inView.filter(([x, y]) => { const t = document.elementFromPoint(x, y); return t && (t === el || el.contains(t) || t.contains(el)); });
        return { key, tag, label, ring: !!ring, vis: !!(r.width || r.height), visible: inView.length > 0, clear: hit.length >= 1, skip: /\bskip\b/.test(String(el.className)) };
      });
      if (info.body) { if (stops > 5) { cycled = true; break; } continue; }
      if (seen.has(info.key) && stops > 5) { cycled = true; break; }
      seen.add(info.key); stops++;
      order.push(info.tag + ':' + info.label);
      if (!info.ring) noRing.push(info.tag + ':' + info.label);
      if (!info.vis || !info.visible || !info.clear) obscured.push(info.tag + ':' + info.label + (info.visible ? ' (covered)' : ' (outside viewport)'));
    }
    console.log(`${name} ${pg}: stops=${stops} cycled=${cycled}`);
    ok(stops >= 8, `${pg}: too few focus stops (${stops})`);
    ok(noRing.length === 0, `${name} ${pg}: no visible focus indicator on: ${noRing.join(' | ')}`);
    ok(obscured.length === 0, `${name} ${pg}: focused item hidden/covered: ${obscured.join(' | ')}`);
    await ctx.close();
  }
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

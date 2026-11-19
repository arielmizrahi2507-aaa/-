// The content is the same on a wide screen and on a phone. Every block of text shown on the wide screen is also on the page
// at tablet and phone width (the side-scrolling strips keep all their cards in the page), and nothing is added there.
// One known difference: a decorative vertical Japanese motto in the hero (hidden from screen readers) that only wide screens have room for.
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
const DECORATIVE_WIDE_ONLY = new Set(['礼に始まり礼に終わる']);
const pages = ['index.html', 'accessibility.html', 'privacy.html', 'terms.html'];

async function shownTexts(width, height, mobile, page, scripts) {
  const ctx = await b.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  if (!scripts) await ctx.route('**/assets/js/main.js', r => r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + page, { waitUntil: 'load' });
  if (!scripts) await p.evaluate(() => document.documentElement.classList.remove('js'));
  await p.waitForTimeout(350);
  const texts = await p.evaluate(() => {
    const out = new Set();
    for (const root of document.querySelectorAll('main, footer')) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        const el = n.parentElement;
        if (el.closest('script,style,svg,[hidden]')) continue;
        let hidden = false;
        for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } }
        if (hidden) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        if ([...r.getClientRects()].some(q => q.width > 0 && q.height > 0)) out.add(t);
      }
    }
    return [...out];
  });
  await ctx.close();
  return new Set(texts);
}

const sizes = [['tablet 820px', 820, 1000, false], ['phone 390px', 390, 844, true]];
for (const scripts of [true, false]) {
  for (const pg of pages) {
    const wide = await shownTexts(1440, 900, false, pg, scripts);
    ok(wide.size > 20, `${pg}: the wide screen shows its text (${wide.size} blocks)`);
    for (const [name, w, h, mobile] of sizes) {
      const narrow = await shownTexts(w, h, mobile, pg, scripts);
      const missing = [...wide].filter(t => !narrow.has(t) && !DECORATIVE_WIDE_ONLY.has(t));
      const extra = [...narrow].filter(t => !wide.has(t));
      ok(missing.length === 0, `${pg}${scripts ? '' : ' (no scripts)'}, ${name}: shown on the wide screen but missing here: ${missing.slice(0, 4).map(t => '"' + t.slice(0, 40) + '"').join(', ')}`);
      ok(extra.length === 0, `${pg}${scripts ? '' : ' (no scripts)'}, ${name}: shown here but not on the wide screen: ${extra.slice(0, 4).map(t => '"' + t.slice(0, 40) + '"').join(', ')}`);
    }
  }
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

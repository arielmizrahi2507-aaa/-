import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const pages = ['index.html', 'contact.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

const spacingCss = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}';
const scan = () => {
  const clipped = [];
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (e.closest('.sr-only') || e.closest('svg') || e.closest('.sprite') || e.classList.contains('a11y-label') || e.closest('.table-wrap')) continue;
    if (e.classList.contains('content')) continue;
    const clipY = /(hidden|clip)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0;
    const clipX = /(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0;
    if ((clipY || clipX) && e.textContent.trim()) clipped.push(e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30) + ' ' + e.scrollWidth + 'x' + e.scrollHeight + ' in ' + e.clientWidth + 'x' + e.clientHeight);
  }
  const cr = document.querySelector('.content').getBoundingClientRect();
  for (const e of document.querySelectorAll('.content *')) {
    const s2 = getComputedStyle(e);
    if (s2.display === 'none' || s2.visibility === 'hidden' || e.closest('svg') || e.closest('.table-wrap') || e.closest('[data-hs]') || e.closest('.sr-only') || e.closest('[aria-hidden="true"]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > cr.right + 1 || r.left < cr.left - 1)) clipped.push('beyond-content ' + e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 24) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  const hdr = document.querySelector('.side');
  const sticky = hdr && getComputedStyle(hdr).position === 'sticky' && hdr.getBoundingClientRect().width >= innerWidth * 0.9 ? hdr.getBoundingClientRect().height : 0;
  return { clipped, hscroll: document.documentElement.scrollWidth > innerWidth + 1, headerRatio: sticky / innerHeight };
};

const scenarios = [
  ['text spacing (1.4.12) desktop', { viewport: { width: 1440, height: 900 } }, spacingCss],
  ['text spacing (1.4.12) mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, spacingCss],
  ['text 200% desktop', { viewport: { width: 1280, height: 800 } }, 'html{font-size:200%!important}'],
  ['text 200% mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'html{font-size:200%!important}'],
  ['text 200% landscape phone', { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true }, 'html{font-size:200%!important}'],
  ['400% zoom equivalent (320px wide)', { viewport: { width: 320, height: 256 } }, ''],
  ['landscape phone 667x375', { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true }, ''],
];
for (const [name, opts, css] of scenarios) {
  for (const pg of pages) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce', bypassCSP: true });
    const p = await ctx.newPage();
    await p.goto(BASE + pg, { waitUntil: 'load' });
    if (css) await p.addStyleTag({ content: css });
    await p.waitForTimeout(150);
    const r = await p.evaluate(scan);
    ok(!r.hscroll, `${name} ${pg}: horizontal scrolling appears`);
    ok(r.clipped.length === 0, `${name} ${pg}: clipped text: ${r.clipped.slice(0, 4).join(' | ')}`);
    ok(r.headerRatio < 0.45, `${name} ${pg}: sticky header takes ${(r.headerRatio * 100).toFixed(0)}% of the viewport height`);
    await ctx.close();
  }
  console.log(`done: ${name}`);
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

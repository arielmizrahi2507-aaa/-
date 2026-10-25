// axe on the state a visitor gets when scripts do not run: main.js is blocked and the "js" class is removed
import { AXE, launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const pages = ['index.html', 'contact.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const sizes = [['desktop', 1440, 900], ['mobile', 390, 844], ['narrow', 320, 640]];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const b = await launch();
let runs = 0, bad = 0;
for (const [sn, w, h] of sizes) for (const pg of pages) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', bypassCSP: true, ...(sn !== 'desktop' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route('**/assets/js/main.js', r => r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + pg, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.documentElement.classList.remove('js'));
  await p.waitForTimeout(250);
  await p.addScriptTag({ path: AXE });
  const res = await p.evaluate(async tags => await axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  runs++;
  const menu = await p.evaluate(() => { const a = [...document.querySelectorAll('.side-nav a')]; return { vis: a.filter(x => x.getBoundingClientRect().height > 0).length, pos: getComputedStyle(document.querySelector('.side')).position, overflowX: document.documentElement.scrollWidth > innerWidth + 1 }; });
  const msg = `${pg} ${sn}: violations=${res.violations.length} menu-items-visible=${menu.vis} header=${menu.pos} h-scroll=${menu.overflowX}`;
  console.log(msg);
  if (menu.vis !== 8 || menu.overflowX || (sn !== 'desktop' && menu.pos !== 'static')) { bad++; console.log('  FAIL: menu/scroll state'); }
  for (const v of res.violations) { bad++; console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`); for (const n of v.nodes.slice(0, 3)) console.log('     ->', n.target.join(' ')); }
  await ctx.close();
}
console.log(`\n${runs} runs, ${bad} problems`);
await b.close();
process.exit(bad ? 1 : 0);

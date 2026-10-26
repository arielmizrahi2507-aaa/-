import { AXE, launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const pages = ['index.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const sizes = [['desktop', 1440, 900], ['mobile', 390, 844], ['narrow', 320, 640]];
const modes = ['', 'a11y-contrast', 'a11y-links', 'a11y-gray', 'a11y-font a11y-spacing', 'a11y-stack'];
const b = await launch();
let total = 0, runs = 0;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function audit(p, label) {
  await p.addScriptTag({ path: AXE });
  const res = await p.evaluate(async tags => await axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  runs++;
  if (res.violations.length) {
    for (const v of res.violations) {
      total++;
      console.log(`  [${label}] [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 3)) console.log('     ->', n.target.join(' '), '|', (n.failureSummary || '').split('\n').slice(0, 3).join(' ').replace(/\s+/g, ' ').slice(0, 220));
    }
  }
  const inc = res.incomplete.filter(v => !['color-contrast'].includes(v.id) || true);
  return { v: res.violations.length, inc };
}

for (const [sizeName, w, h] of sizes) {
  const mobile = sizeName !== 'desktop';
  for (const pg of pages) {
    for (const mode of modes) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', bypassCSP: true, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      const p = await ctx.newPage();
      await p.goto(BASE + pg, { waitUntil: 'networkidle' });
      if (mode) await p.evaluate(m => m.split(' ').forEach(c => document.documentElement.classList.add(c)), mode);
      await p.waitForTimeout(300);
      const label = `${pg} ${sizeName} ${mode || 'default'}`;
      const r = await audit(p, label);
      if (!mode) {
        const incs = r.inc.map(v => `${v.id}(${v.nodes.length})`).join(', ');
        console.log(`${label}: violations=${r.v}${incs ? '  needs-review: ' + incs : ''}`);
      }
      await ctx.close();
    }
  }
}

// interactive states
async function states(sizeName, w, h) {
  const mobile = sizeName !== 'desktop';
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', bypassCSP: true, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }));
  const p = await ctx.newPage();
  // the form in the red band: invalid then result
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.locator('#join-form').scrollIntoViewIfNeeded();
  await p.click('#join-form button[data-channel=wa]'); await p.waitForTimeout(200);
  await audit(p, `join form ${sizeName} invalid-state`);
  await p.fill('#jf-name', 'דוד כהן'); await p.fill('#jf-phone', '0501234567'); await p.fill('#jf-age', '8'); await p.check('#jf-consent');
  await p.click('#join-form button[data-channel=wa]'); await p.waitForTimeout(300);
  await audit(p, `join form ${sizeName} result-state`);
  // a11y panel open
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.click('.a11y-toggle'); await p.waitForTimeout(200);
  await audit(p, `home ${sizeName} a11y-panel-open`);
  if (mobile) {
    await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    await p.tap('.menu-btn'); await p.waitForTimeout(250);
    await audit(p, `home ${sizeName} menu-open`);
    await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelectorAll('.hs-next').forEach(b => { b.click(); b.click(); }));
    await p.waitForTimeout(500);
    await audit(p, `home ${sizeName} carousels-moved`);
    await p.evaluate(() => document.documentElement.classList.add('a11y-contrast'));
    await p.waitForTimeout(200);
    await audit(p, `home ${sizeName} carousels-moved-contrast`);
  }
  await ctx.close();
}
for (const [n, w, h] of sizes) await states(n, w, h);
console.log(`\n${runs} axe runs, ${total} violations`);
await b.close();
process.exit(total ? 1 : 0);

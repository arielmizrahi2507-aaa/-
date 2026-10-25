import { launch, previewHtml } from '../lib.mjs';
const bundle = previewHtml('inner');
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

for (const [name, opts, sandbox] of [
  ['desktop, sandbox=allow-scripts', { viewport: { width: 1440, height: 900 } }, 'allow-scripts'],
  ['mobile, sandbox=allow-scripts', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'allow-scripts'],
  ['mobile, sandbox=allow-scripts allow-popups allow-same-origin', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'allow-scripts allow-popups allow-same-origin'],
]) {
  console.log('\n== ' + name);
  const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
  await ctx.route('http://wrapper.test/wrapper.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><iframe id="v" src="http://wrapper.test/bundle.html" sandbox="${sandbox}" style="border:0;width:100vw;height:100vh"></iframe></body>` }));
  await ctx.route('http://wrapper.test/bundle.html', r => r.fulfill({ contentType: 'text/html', body: bundle }));
  await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/Blocked opening|Unsafe attempt|sandboxed|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await p.goto('http://wrapper.test/wrapper.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  const f = p.frames().find(x => x !== p.mainFrame());
  const touch = !!opts.hasTouch;
  const tap = async sel => { const l = f.locator(sel).first(); return touch ? l.tap() : l.click(); };
  ok(await f.evaluate(() => document.documentElement.classList.contains('js') && !!document.querySelector('.a11y-toggle')), 'scripts run inside the sandbox');

  // anchor navigation (menu first on a phone)
  if (touch) { await tap('.menu-btn'); await p.waitForTimeout(200); }
  await tap('.side-nav a[href="#schedule"]');
  await p.waitForTimeout(900);
  const sched = await f.evaluate(() => { const r = document.getElementById('schedule').getBoundingClientRect(); const h = document.querySelector('.side').getBoundingClientRect(); return { top: Math.round(r.top), hb: Math.round(h.bottom), vh: innerHeight }; });
  ok(sched.top >= (touch ? sched.hb - 2 : -2) && sched.top < sched.vh * 0.6, `#schedule scrolled into view (top=${sched.top}, header=${sched.hb})`);
  if (touch) ok(await f.evaluate(() => !document.querySelector('.side.open')), 'menu closes after choosing');

  // carousels inside the sandboxed viewer (phone): the next button scrolls the programs strip
  if (touch) {
    await f.locator('#programs .hs-ctl').scrollIntoViewIfNeeded();
    await tap('#programs .hs-next');
    await p.waitForTimeout(500);
    const moved = await f.evaluate(() => Math.abs(Math.round(document.querySelector('#programs [data-hs]').scrollLeft)));
    ok(moved > 40, `carousel button works inside the sandbox (${moved}px)`);
  }

  // contact view via footer link
  await f.locator('.foot-links a[href="#view-contact"]').scrollIntoViewIfNeeded();
  await tap('.foot-links a[href="#view-contact"]');
  await p.waitForTimeout(500);
  ok(await f.evaluate(() => getComputedStyle(document.getElementById('view-contact')).display !== 'none' && getComputedStyle(document.getElementById('main')).display === 'none'), 'contact page opens inside the bundle');

  // form: empty -> asterisks, valid -> result panel
  await tap('#contact-form button[data-channel=wa]');
  await p.waitForTimeout(200);
  const stars = await f.evaluate(() => [...document.querySelectorAll('#contact-form .field.invalid .req')].filter(s => !s.hidden).length);
  ok(stars === 4, `four red asterisks after an empty submit (${stars})`);
  await f.fill('#cf-name', 'דוד כהן'); await f.fill('#cf-phone', '050-1234567'); await f.fill('#cf-age', '8'); await f.check('#cf-consent');
  await tap('#contact-form button[data-channel=wa]');
  await p.waitForTimeout(400);
  ok(await f.evaluate(() => !document.getElementById('cf-result').hidden && document.getElementById('cf-text').value.includes('דוד כהן')), 'result panel with the ready message is shown even when popups are blocked');
  await tap('#cf-result [data-copy-from]');
  await p.waitForTimeout(400);
  const label = (await f.textContent('#cf-result [data-copy-from]')).trim();
  ok(label === 'הועתק' || label === 'לא הועתק', `copy gives clear feedback (${label})`);
  ok(await f.evaluate(() => document.querySelector('#cf-result a.js-open-wa').getAttribute('href').startsWith('https://wa.me/972505788781?text=')), 'WhatsApp link is present and correct');
  ok(errs.length === 0, 'no script errors: ' + errs.join(' | ').slice(0, 300));
  await ctx.close();
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

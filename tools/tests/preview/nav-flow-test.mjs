import { launch, previewHtml, siteUrl } from '../lib.mjs';
const bundle = previewHtml('inner');
const SITE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

const viewports = [
  ['phone 390x844', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['small phone 360x600', { viewport: { width: 360, height: 600 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['app panel 700x900', { viewport: { width: 700, height: 900 } }],
];
for (const [vname, opts] of viewports) {
  for (const sandbox of ['allow-scripts', 'allow-scripts allow-same-origin']) {
    console.log(`\n== preview, ${vname}, sandbox="${sandbox}"`);
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
    await ctx.route('http://wrapper.test/wrapper.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><iframe src="http://wrapper.test/bundle.html" sandbox="${sandbox}" style="border:0;width:100vw;height:100vh"></iframe></body>` }));
    await ctx.route('http://wrapper.test/bundle.html', r => r.fulfill({ contentType: 'text/html', body: bundle }));
    const p = await ctx.newPage();
    await p.goto('http://wrapper.test/wrapper.html', { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const f = p.frames().find(x => x !== p.mainFrame());
    const touch = !!opts.hasTouch;
    const tap = async sel => { const l = f.locator(sel).first(); return touch ? l.tap() : l.click(); };
    const narrow = await f.evaluate(() => matchMedia('(max-width: 900px)').matches);
    const openMenu = async () => { if (narrow) { await tap('.menu-btn'); await p.waitForTimeout(200); } };
    const view = async () => f.evaluate(() => ({
      menuOpen: document.querySelector('.side').classList.contains('open'),
      home: getComputedStyle(document.getElementById('main')).display !== 'none',
      contact: getComputedStyle(document.getElementById('view-contact')).display !== 'none',
      sideH: Math.round(document.querySelector('.side').getBoundingClientRect().height), vh: innerHeight,
    }));
    const formReachable = async () => f.evaluate(() => {
      const el = document.getElementById('cf-name'); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === el;
    });

    // 1) menu -> "צור קשר"
    await openMenu(); await tap('.side-nav a[href="#view-contact"]'); await p.waitForTimeout(400);
    let v = await view();
    ok(v.contact && !v.home, 'menu item opens the contact page');
    ok(!v.menuOpen, `the menu closes after choosing it (open=${v.menuOpen})`);
    ok(v.sideH < 130 || !narrow, `the header is not covering the screen (${v.sideH}px of ${v.vh}px)`);
    ok(await formReachable(), 'the name field is reachable (nothing covers it)');
    await tap('#cf-name'); await p.keyboard.type('דוד כהן');

    // 2) same item again: the page stays and the typed text stays
    await openMenu(); await tap('.side-nav a[href="#view-contact"]'); await p.waitForTimeout(400);
    v = await view();
    ok(v.contact && !v.menuOpen, 'choosing "צור קשר" again keeps the page and closes the menu');
    ok((await f.locator('#cf-name').inputValue()) === 'דוד כהן', 'typed text is still there');

    // 3) from the contact page, menu -> a section of the home page
    await openMenu(); await tap('.side-nav a[href="#programs"]'); await p.waitForTimeout(900);
    v = await view();
    ok(v.home && !v.contact, 'a menu section opens the home page from the contact page');
    ok(!v.menuOpen, 'the menu closes after choosing a section');
    const prog = await f.evaluate(() => { const r = document.getElementById('programs').getBoundingClientRect(); const h = document.querySelector('.side').getBoundingClientRect(); return { top: Math.round(r.top), hb: Math.round(h.bottom), vh: innerHeight }; });
    ok(prog.top < prog.vh * 0.7 && prog.top >= (narrow ? prog.hb - 4 : -4), `#programs is in view below the header (top=${prog.top}, header bottom=${prog.hb})`);

    // 4) the red button at the bottom of the menu
    await openMenu(); await tap('.side-cta'); await p.waitForTimeout(400);
    v = await view();
    ok(v.contact && !v.menuOpen, 'the menu button "צרו קשר" opens the contact page and closes the menu');
    await ctx.close();
  }
}

// the real site (several pages): the same item while already on the contact page must not reload it
console.log('\n== real site, phone');
{
  const ctx = await b.newContext({ ...viewports[0][1], reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(SITE + 'index.html', { waitUntil: 'networkidle' });
  await p.locator('.menu-btn').tap(); await p.waitForTimeout(200);
  await Promise.all([p.waitForURL(/contact\.html$/), p.locator('.side-nav a[href="contact.html"]').tap()]);
  await p.waitForLoadState('networkidle');
  ok(/contact\.html$/.test(p.url()), 'menu item opens contact.html (' + p.url() + ')');
  ok(await p.evaluate(() => !document.querySelector('.side').classList.contains('open')), 'menu is closed on the new page');
  await p.locator('#cf-name').tap(); await p.keyboard.type('דוד כהן');
  await p.evaluate(() => { window.__marker = 42; });
  await p.locator('.menu-btn').tap(); await p.waitForTimeout(200);
  await p.locator('.side-nav a[href="contact.html"]').tap(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => window.__marker === 42), 'the page was not reloaded');
  ok((await p.locator('#cf-name').inputValue()) === 'דוד כהן', 'typed text survived');
  ok(await p.evaluate(() => !document.querySelector('.side').classList.contains('open')), 'menu closed');
  await ctx.close();
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

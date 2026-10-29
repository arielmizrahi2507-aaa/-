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
      privacy: getComputedStyle(document.getElementById('view-privacy')).display !== 'none',
      sideH: Math.round(document.querySelector('.side').getBoundingClientRect().height), vh: innerHeight,
    }));
    const place = async id => f.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); const h = document.querySelector('.side').getBoundingClientRect(); return { top: Math.round(r.top), hb: Math.round(h.bottom), vh: innerHeight }; }, id);
    const nameReachable = async () => f.evaluate(() => {
      const el = document.getElementById('jf-name'); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === el;
    });
    const joinInView = async what => { const j = await place('join'); ok(j.top < j.vh * 0.7 && j.top >= (narrow ? j.hb - 4 : -4), `${what}: the red band is in view below the header (top=${j.top}, header bottom=${j.hb})`); };

    // 1) menu -> "צור קשר": the red band of the home page
    await openMenu(); await tap('.side-nav a[href="#join"]'); await p.waitForTimeout(900);
    let v = await view();
    ok(v.home, 'menu item "צור קשר" keeps the home page');
    ok(!v.menuOpen, `the menu closes after choosing it (open=${v.menuOpen})`);
    ok(v.sideH < 130 || !narrow, `the header is not covering the screen (${v.sideH}px of ${v.vh}px)`);
    await joinInView('menu item');
    ok(await nameReachable(), 'the name field is reachable (nothing covers it)');
    await tap('#jf-name'); await p.keyboard.type('דוד כהן');

    // 2) same item again: the typed text stays
    await openMenu(); await tap('.side-nav a[href="#join"]'); await p.waitForTimeout(700);
    v = await view();
    ok(v.home && !v.menuOpen, 'choosing "צור קשר" again keeps the page and closes the menu');
    ok((await f.locator('#jf-name').inputValue()) === 'דוד כהן', 'typed text is still there');

    // 3) a legal page from the footer, then the menu -> a section of the home page
    await tap('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(500);
    v = await view();
    ok(v.privacy && !v.home, 'the footer link opens the privacy page');
    await openMenu(); await tap('.side-nav a[href="#programs"]'); await p.waitForTimeout(900);
    v = await view();
    ok(v.home && !v.privacy, 'a menu section opens the home page from the privacy page');
    ok(!v.menuOpen, 'the menu closes after choosing a section');
    const prog = await place('programs');
    ok(prog.top < prog.vh * 0.7 && prog.top >= (narrow ? prog.hb - 4 : -4), `#programs is in view below the header (top=${prog.top}, header bottom=${prog.hb})`);

    // 4) from a legal page, menu -> "צור קשר": the home page comes back at the red band
    await tap('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(500);
    await openMenu(); await tap('.side-nav a[href="#join"]'); await p.waitForTimeout(900);
    v = await view();
    ok(v.home && !v.privacy && !v.menuOpen, 'menu "צור קשר" from a legal page opens the home page and closes the menu');
    await joinInView('from the privacy page');

    // 5) the red button at the bottom of the menu
    await tap('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(500);
    await openMenu(); await tap('.side-cta'); await p.waitForTimeout(900);
    v = await view();
    ok(v.home && !v.menuOpen, 'the menu button "צרו קשר" opens the home page and closes the menu');
    await joinInView('menu button');

    // 6) the statement link in the accessibility panel (the script builds it) opens the statement inside the page, and what was typed stays
    await f.evaluate(() => { window.__marker = 7; });
    ok((await f.locator('#jf-name').inputValue()) === 'דוד כהן', 'the form still holds what was typed before the panel is opened');
    await tap('.a11y-toggle'); await p.waitForTimeout(300);
    ok(await f.evaluate(() => !document.getElementById('a11y-panel').hidden), 'the accessibility panel opens');
    await tap('.a11y-foot a').catch(() => {}); await p.waitForTimeout(700);
    const acc = await f.evaluate(() => ({
      marker: window.__marker, statement: getComputedStyle(document.getElementById('view-accessibility')).display !== 'none',
      home: getComputedStyle(document.getElementById('main')).display !== 'none', panelOpen: !document.getElementById('a11y-panel').hidden,
      name: document.getElementById('jf-name').value,
    })).catch(() => null);
    ok(!!acc && acc.statement && !acc.home, 'the statement link in the accessibility panel opens the statement (inside the page, not another page)');
    ok(!!acc && acc.marker === 7, 'the statement link in the accessibility panel does not replace the page');
    ok(!!acc && !acc.panelOpen, 'the accessibility panel closes after choosing the statement');
    ok(!!acc && acc.name === 'דוד כהן', 'what was typed in the form is still there after opening the statement');
    await openMenu(); await tap('.side-nav a[href="#join"]').catch(() => {}); await p.waitForTimeout(900);
    ok((await f.locator('#jf-name').inputValue().catch(() => '')) === 'דוד כהן', 'and still there after coming back to the home page');
    await ctx.close();
  }
}

// the real site (several pages): the item "צור קשר" scrolls to the red band without reloading, from the home page and from the other pages
console.log('\n== real site, phone');
{
  const ctx = await b.newContext({ ...viewports[0][1], reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const joinPlace = () => p.evaluate(() => { const r = document.getElementById('join').getBoundingClientRect(); const h = document.querySelector('.side').getBoundingClientRect(); return { top: Math.round(r.top), hb: Math.round(h.bottom), vh: innerHeight }; });
  await p.goto(SITE + 'index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => { window.__marker = 42; });
  await p.locator('.menu-btn').tap(); await p.waitForTimeout(200);
  await p.locator('.side-nav a[href="#join"]').tap(); await p.waitForTimeout(1000);
  ok(/index\.html#join$/.test(p.url()), 'the address shows the red band (' + p.url() + ')');
  ok(await p.evaluate(() => !document.querySelector('.side').classList.contains('open')), 'menu is closed');
  let j = await joinPlace();
  ok(j.top >= j.hb - 4 && j.top < j.vh * 0.7, `the red band is in view below the header (top=${j.top}, header bottom=${j.hb})`);
  await p.locator('#jf-name').tap(); await p.keyboard.type('דוד כהן');
  await p.locator('.menu-btn').tap(); await p.waitForTimeout(200);
  await p.locator('.side-nav a[href="#join"]').tap(); await p.waitForTimeout(700);
  ok(await p.evaluate(() => window.__marker === 42), 'the page was not reloaded');
  ok((await p.locator('#jf-name').inputValue()) === 'דוד כהן', 'typed text survived');
  ok(await p.evaluate(() => !document.querySelector('.side').classList.contains('open')), 'menu closed');
  // from another page of the site
  await p.goto(SITE + 'privacy.html', { waitUntil: 'networkidle' });
  await p.locator('.menu-btn').tap(); await p.waitForTimeout(200);
  await Promise.all([p.waitForURL(/index\.html#join$/), p.locator('.side-nav a[href="index.html#join"]').tap()]);
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(900);
  j = await joinPlace();
  ok(j.top >= j.hb - 4 && j.top < j.vh * 0.7, `from the privacy page the red band is in view below the header (top=${j.top}, header bottom=${j.hb})`);
  await ctx.close();
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

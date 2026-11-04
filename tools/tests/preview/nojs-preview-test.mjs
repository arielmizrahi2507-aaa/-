import { NAV_ITEMS, launch, previewHtml } from '../lib.mjs';
const bundle = previewHtml('site');
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

const viewports = [
  ['desktop 1440x900', { viewport: { width: 1440, height: 900 } }],
  ['app panel 700x900', { viewport: { width: 700, height: 900 } }],
  ['phone 390x844', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
// how a viewer might embed the file: by URL or by srcdoc; with no permission at all (no scripts) or with scripts only
const embeds = [
  ['url', 'http://wrapper.test/bundle.html', ''],
  ['url', 'http://wrapper.test/bundle.html', 'allow-scripts'],
  ['srcdoc', null, ''],
  ['srcdoc', null, 'allow-scripts'],
];

for (const [vname, opts] of viewports) {
  for (const [ename, src, sbx] of embeds) {
    const scripts = sbx.includes('allow-scripts');
    console.log(`\n== ${scripts ? 'scripts' : 'NO scripts'}, ${vname}, embed=${ename}, sandbox="${sbx}"`);
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
    await ctx.route('http://wrapper.test/wrapper.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><iframe id="v" sandbox="${sbx}" style="border:0;width:100vw;height:100vh" ${src ? `src="${src}"` : ''}></iframe></body>` }));
    await ctx.route('http://wrapper.test/bundle.html', r => r.fulfill({ contentType: 'text/html', body: bundle }));
    const p = await ctx.newPage();
    await p.goto('http://wrapper.test/wrapper.html', { waitUntil: 'load' });
    if (!src) await p.evaluate(h => { document.getElementById('v').srcdoc = h; }, bundle);
    const f = await (async () => { for (let i = 0; i < 80; i++) { for (const fr of p.frames()) { if (fr === p.mainFrame()) continue; try { if (await fr.evaluate(() => !!document.querySelector('.preview-banner') && document.readyState === 'complete')) return fr; } catch (e) { /* not ready yet */ } } await p.waitForTimeout(250); } throw new Error('embedded page did not load'); })();
    await p.waitForTimeout(500);
    const touch = !!opts.hasTouch;
    const click = async sel => { const l = f.locator(sel).first(); await l.scrollIntoViewIfNeeded(); return touch ? l.tap() : l.click(); };
    const narrow = await f.evaluate(() => matchMedia('(max-width: 900px)').matches);
    const openMenu = async () => { if (scripts && narrow) { await click('button.menu-btn'); await p.waitForTimeout(250); } };
    const stillMine = async () => f.evaluate(() => !!document.querySelector('.preview-banner'));
    const state = () => f.evaluate(() => {
      const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
      return { js: document.documentElement.classList.contains('js'), banner: getComputedStyle(document.querySelector('.preview-banner')).display !== 'none', menuOpen: document.querySelector('.side').classList.contains('open'),
        home: shown('main'), privacy: shown('view-privacy'), terms: shown('view-terms'), access: shown('view-accessibility') };
    });
    let s = await state();
    ok(s.js === scripts, `scripts ${scripts ? 'run' : 'are blocked'} in this embed`);
    ok(s.banner === !scripts, `the "no JavaScript" banner is ${scripts ? 'hidden' : 'shown'}`);
    ok(s.home && !s.privacy, 'home page shown first');

    // the menu: always the vertical numbered list; on a phone it is visible without scripts, behind the button with scripts
    await openMenu();
    const nav = await f.evaluate(() => { const a = [...document.querySelectorAll('.side-nav a')]; return { n: a.length, vis: a.filter(x => x.getBoundingClientRect().height > 0).length, num: a.filter(x => getComputedStyle(x.querySelector('.num')).display !== 'none').length, kj: a.filter(x => getComputedStyle(x.querySelector('.kj')).display !== 'none').length, vertical: getComputedStyle(document.querySelector('.side-nav')).flexDirection }; });
    ok(nav.n === NAV_ITEMS && nav.vis === NAV_ITEMS, `all ${NAV_ITEMS} menu items are visible (${nav.vis})`);
    ok(nav.num === NAV_ITEMS && nav.kj === NAV_ITEMS, 'every item shows its number and its Japanese character');
    ok(nav.vertical === 'column', 'the menu is a vertical list (' + nav.vertical + ')');

    // "צור קשר" from the menu: the red band of the home page, with the contact details and the form
    const joinInView = async what => { const r = await f.evaluate(() => { const j = document.getElementById('join').getBoundingClientRect(); return { top: Math.round(j.top), bottom: Math.round(j.bottom), vh: innerHeight }; }); ok(r.top < r.vh * 0.85 && r.bottom > 120, `${what}: the red band is on screen (top=${r.top}, bottom=${r.bottom}, screen=${r.vh})`); };
    await click('.side-nav a[href="#join"]'); await p.waitForTimeout(900);
    ok(await stillMine(), 'the embedded page was not replaced by another page');
    s = await state();
    ok(s.home, 'menu item "צור קשר" keeps the home page');
    ok(!s.menuOpen, 'the phone menu is closed afterwards');
    await joinInView('menu item');
    const details = await f.evaluate(() => ({ rows: document.querySelectorAll('#join .contact-info .ci-row').length, shown: [...document.querySelectorAll('#join .contact-info .ci-row')].filter(r => r.getBoundingClientRect().height > 0).length, links: [...document.querySelectorAll('#join .contact-info a[href^="tel:"], #join .contact-info a[href*="wa.me"], #join .contact-info a[href*="waze.com"], #join .contact-info a[href*="google.com/maps"]')].length }));
    ok(details.rows >= 4 && details.shown === details.rows && details.links >= 4, `the contact details are in the red band (${details.shown}/${details.rows} rows, ${details.links} links)`);
    if (!scripts) {
      // without scripts the plain card: one box holding the ready message
      const plain = await f.evaluate(() => { const el = document.getElementById('jf-nojs-text'); const r = el.getBoundingClientRect(); return { visible: r.height > 0, full: getComputedStyle(document.getElementById('join-form')).display !== 'none' }; });
      ok(plain.visible && !plain.full, 'the plain details box is visible (and the full form is hidden)');
      await click('#jf-nojs-text'); await p.keyboard.type(' דוד כהן', { delay: 10 });
      ok((await f.locator('#jf-nojs-text').inputValue()).includes('דוד כהן'), 'typing into the details box works without scripts');
    } else {
      const form = await f.evaluate(() => { const el = document.getElementById('jf-name'); const r = el.getBoundingClientRect(); return { visible: r.height > 0 }; });
      ok(form.visible, 'the form fields are visible');
      await click('#jf-name'); await p.keyboard.type('דוד כהן', { delay: 10 });
      ok((await f.locator('#jf-name').inputValue()) === 'דוד כהן', 'typing into the name field works');
      await click('#jf-phone'); await p.keyboard.type('0501234567');
      await click('#jf-age'); await p.keyboard.type('8');
      await click('#jf-consent');
      await click('#join-form button[data-channel=wa]'); await p.waitForTimeout(400);
      ok(await f.evaluate(() => { const r = document.querySelector('#join-form .result'); return r && !r.hidden; }), 'the send button shows the ready message');
    }

    // legal pages from the footer and the way back
    await click('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(300);
    s = await state(); ok(s.privacy && !s.home, 'footer link opens the privacy page');
    await click('.foot-links a[href="#view-terms"]'); await p.waitForTimeout(300);
    s = await state(); ok(s.terms && !s.privacy, 'footer link opens the terms page');
    await click('.foot-links a[href="#view-accessibility"]'); await p.waitForTimeout(300);
    s = await state(); ok(s.access && !s.terms, 'footer link opens the accessibility page');
    await click('#view-accessibility a[href="#top"]'); await p.waitForTimeout(500);
    s = await state(); ok(s.home && !s.access, 'the back link returns to the home page');
    ok(await stillMine(), 'still the same embedded page');

    // from a legal page: "צור קשר" and a section of the home page bring the home page back
    await click('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(300);
    await openMenu(); await click('.side-nav a[href="#join"]'); await p.waitForTimeout(900);
    ok(await stillMine(), 'a menu link does not replace the embedded page');
    s = await state(); ok(s.home && !s.privacy, 'menu "צור קשר" brings the home page back from a legal page');
    await joinInView('from the privacy page');
    await click('.foot-links a[href="#view-privacy"]'); await p.waitForTimeout(300);
    await openMenu(); await click('.side-nav a[href="#programs"]'); await p.waitForTimeout(900);
    s = await state(); ok(s.home && !s.privacy, 'a menu section brings the home page back');
    const prog = await f.evaluate(() => { const r = document.getElementById('programs').getBoundingClientRect(); return { top: Math.round(r.top), vh: innerHeight }; });
    ok(prog.top >= -4 && prog.top < prog.vh * 0.8, `#programs is in view (top=${prog.top})`);

    // the hero button leads to the red band
    await click('.hero a[href="#join"]'); await p.waitForTimeout(900);
    s = await state(); ok(s.home, 'the hero button keeps the home page');
    await joinInView('hero button');
    await ctx.close();
  }
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

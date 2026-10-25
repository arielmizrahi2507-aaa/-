import { launch, previewHtml, siteUrl } from '../lib.mjs';
const bundle = previewHtml('inner');
const SITE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } else console.log('  ok:', m); };
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function typeInto(page, frame, sel, text, label) {
  const loc = frame.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  await loc.tap();
  await page.waitForTimeout(150);
  const active = await frame.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
  ok(active === sel.slice(1), `${label}: tapping focuses the field (active=${active})`);
  await page.keyboard.type(text, { delay: 15 });
  const v = await frame.locator(sel).inputValue();
  ok(v === text, `${label}: typed text arrives ("${v}")`);
  const still = await frame.evaluate(() => document.activeElement && document.activeElement.id);
  ok(still === sel.slice(1), `${label}: focus stays in the field while typing (active=${still})`);
}

async function enterCheck(page, frame, label) {
  // a one-word name followed by the keyboard's Next key must not light up the whole form or trap the focus
  await frame.locator('#cf-name').scrollIntoViewIfNeeded();
  await frame.locator('#cf-name').tap();
  await page.keyboard.type('דוד', { delay: 15 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const st = await frame.evaluate(() => ({ active: document.activeElement && document.activeElement.id, invalid: document.querySelectorAll('.field.invalid').length }));
  ok(st.active === 'cf-phone', label + ': Next moves from the name to the phone field (active=' + st.active + ')');
  ok(st.invalid === 0, label + ': Next does not mark any field as invalid (' + st.invalid + ')');
  await frame.locator('#cf-name').fill('');
}

async function runForm(page, frame, label) {
  await enterCheck(page, frame, label);
  await typeInto(page, frame, '#cf-name', 'דוד כהן', label + ' name');
  await typeInto(page, frame, '#cf-phone', '0501234567', label + ' phone');
  await typeInto(page, frame, '#cf-age', '8', label + ' age');
  await frame.locator('#cf-message').scrollIntoViewIfNeeded();
  await frame.locator('#cf-message').tap();
  await page.keyboard.type('שלום, רוצה לשמוע על החוגים', { delay: 10 });
  ok((await frame.locator('#cf-message').inputValue()).startsWith('שלום'), label + ' message textarea accepts text');
  await frame.locator('#cf-consent').scrollIntoViewIfNeeded();
  await frame.locator('#cf-consent').tap();
  ok(await frame.locator('#cf-consent').isChecked(), label + ' consent box checks by tapping the box');
  await frame.locator('#contact-form button[data-channel=wa]').scrollIntoViewIfNeeded();
  await frame.locator('#contact-form button[data-channel=wa]').tap();
  await page.waitForTimeout(400);
  const shown = await frame.evaluate(() => { const r = document.querySelector('#contact-form .result'); return r && !r.hidden; });
  ok(shown, label + ' send button shows the ready message');
}

// 1) the site itself, phone
{
  console.log('\n== site, phone, real typing');
  const ctx = await b.newContext({ ...mobile, reducedMotion: 'reduce' });
  await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(SITE + 'contact.html', { waitUntil: 'networkidle' });
  await runForm(p, p, 'site');
  ok(errs.length === 0, 'no script errors ' + errs.join(' | '));
  await ctx.close();
}

// 2) the single-file preview inside sandboxed iframes, phone
for (const sandbox of ['allow-scripts', 'allow-scripts allow-same-origin', 'allow-scripts allow-popups allow-same-origin allow-forms']) {
  console.log('\n== preview in iframe sandbox="' + sandbox + '", phone, real typing');
  const ctx = await b.newContext({ ...mobile, reducedMotion: 'reduce' });
  await ctx.route('http://wrapper.test/wrapper.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><iframe id="v" src="http://wrapper.test/bundle.html" sandbox="${sandbox}" style="border:0;width:100vw;height:100vh"></iframe></body>` }));
  await ctx.route('http://wrapper.test/bundle.html', r => r.fulfill({ contentType: 'text/html', body: bundle }));
  await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://wrapper.test/wrapper.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.locator('.menu-btn').tap();
  await p.waitForTimeout(200);
  await f.locator('.side-nav a[href="#view-contact"]').tap();
  await p.waitForTimeout(500);
  ok(await f.evaluate(() => getComputedStyle(document.getElementById('view-contact')).display !== 'none'), 'contact view opens from the menu');
  await runForm(p, f, 'preview');
  ok(errs.length === 0, 'no script errors ' + errs.join(' | '));
  await ctx.close();
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

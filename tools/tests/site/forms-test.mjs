import { devices } from 'playwright-core';
import { launch, siteUrl, TEST_EMAIL } from '../lib.mjs';
// Two test builds of the site: without a club e-mail address (the e-mail option opens a draft with no recipient) and with one.
// usage: forms-test.mjs [plain|mail]   (default: both)
const VARIANTS = process.argv[2] ? [process.argv[2]] : ['plain', 'mail'];
let BASE = '', EMAIL_ON = false;
const b = await launch();
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL:', msg); } };

async function state(p, prefix, key) {
  return p.evaluate(([prefix, key]) => {
    const input = document.getElementById(prefix + '-' + key);
    const field = input.closest('.field');
    const star = field.querySelector('.req');
    const err = field.querySelector('.err');
    return { invalid: field.classList.contains('invalid'), ariaInvalid: input.getAttribute('aria-invalid'),
      starVisible: !!star && !star.hidden && getComputedStyle(star).display !== 'none',
      starColor: star ? getComputedStyle(star).color : '', err: err.textContent.trim(), errVisible: getComputedStyle(err).display !== 'none' };
  }, [prefix, key]);
}

async function run(label, ctxOpts, page, formId, prefix, fieldsReq, fieldsOpt) {
  console.log(`\n== ${label} ${page}`);
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const waHits = [];
  await ctx.route('https://wa.me/**', route => { waHits.push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/wa\.me|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.goto(BASE + page, { waitUntil: 'networkidle' });
  const tap = async sel => (ctxOpts.hasTouch ? p.tap(sel) : p.click(sel));
  const submitSel = `#${formId} button[data-channel=wa]`;

  // 1) everything empty -> asterisk on each required field only
  await p.locator(`#${formId}`).scrollIntoViewIfNeeded();
  await tap(submitSel);
  await p.waitForTimeout(150);
  for (const k of fieldsReq) {
    const s = await state(p, prefix, k);
    ok(s.invalid && s.ariaInvalid === 'true' && s.starVisible && s.errVisible && s.err.length > 3, `${prefix}-${k}: empty must show red asterisk + message (${JSON.stringify(s)})`);
    ok(/rgb\(196, 34, 27\)/.test(s.starColor), `${prefix}-${k}: asterisk colour is the accessible red (${s.starColor})`);
  }
  for (const k of fieldsOpt) {
    const s = await state(p, prefix, k);
    ok(!s.invalid && !s.starVisible, `${prefix}-${k}: optional empty field must stay unmarked`);
  }
  const first = await p.evaluate(([prefix, key]) => document.activeElement && document.activeElement.id === prefix + '-' + key, [prefix, fieldsReq[0]]);
  ok(first, 'focus moves to the first invalid field');
  const noBoxes = await p.evaluate(formId => !document.querySelector('#' + formId + ' .req-legend, #' + formId + ' .err-summary'), formId);
  ok(noBoxes, 'no big legend/summary box inside the form');
  const resHidden = await p.evaluate(id => document.getElementById(id).hidden, prefix + '-result');
  ok(resHidden, 'result panel stays hidden while invalid');

  // 1b) Enter (the phone keyboard's "Next") moves to the next field: it neither validates nor sends
  await p.fill(`#${prefix}-name`, 'דוד');
  await p.focus(`#${prefix}-name`);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(120);
  const nextId = await p.evaluate(() => document.activeElement && document.activeElement.id);
  ok(nextId === `${prefix}-phone`, `Enter moves focus to the next field (active=${nextId})`);
  ok(await p.evaluate(id => document.getElementById(id).hidden, prefix + '-result'), 'Enter does not send');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(80);
  const nextId2 = await p.evaluate(() => document.activeElement && document.activeElement.id);
  ok(nextId2 !== `${prefix}-phone` && nextId2 !== 'BODY', `Enter in the next field keeps moving on (active=${nextId2})`);

  // 2) incomplete values
  const cases = {
    name: [['דוד', 'bad'], ['ד כהן', 'bad'], ['דוד כהן', 'ok'], ['  דוד   כהן ', 'ok']],
    phone: [['050', 'bad'], ['050-12345', 'bad'], ['0501234567', 'ok'], ['050-123-4567', 'ok'], ['+972 50 123 4567', 'ok'], ['+972 (0)50-1234567', 'ok'], ['03-5551234', 'ok'], ['0111111111', 'bad'], ['+1 415 555 2671', 'ok'], ['+12', 'bad'], ['abc', 'bad']],
    age: [['3', 'bad'], ['abc', 'bad'], ['8', 'ok'], ['4', 'ok'], ['100', 'bad'], ['45', 'ok']],
    email: [['abc', 'bad'], ['abc@', 'bad'], ['a@b', 'bad'], ['a@b.co', 'ok'], ['', 'ok']],
  };
  for (const [k, list] of Object.entries(cases)) {
    if (!(fieldsReq.includes(k) || fieldsOpt.includes(k))) continue;
    for (const [val, exp] of list) {
      await p.fill(`#${prefix}-${k}`, val);
      await tap(submitSel);
      await p.waitForTimeout(60);
      const s = await state(p, prefix, k);
      const isBad = s.invalid && s.starVisible && s.errVisible;
      ok((exp === 'bad') === isBad, `${prefix}-${k}="${val}" expected ${exp}, got ${isBad ? 'marked' : 'clean'} ${s.err}`);
    }
  }

  // 2b) everything valid except the privacy consent box -> the box is marked, nothing is sent
  {
    await p.fill(`#${prefix}-name`, 'דוד כהן');
    await p.fill(`#${prefix}-phone`, '050-1234567');
    await p.fill(`#${prefix}-age`, '8');
    await p.uncheck(`#${prefix}-consent`);
    const popups = []; const onPage = pg => popups.push(pg); ctx.on('page', onPage);
    await tap(submitSel);
    await p.waitForTimeout(250);
    ctx.off('page', onPage);
    const cs = await p.evaluate(() => { const f = document.getElementById('jf-consent').closest('.field'); const star = f.querySelector('.req'); const err = f.querySelector('.err'); return { invalid: f.classList.contains('invalid'), aria: document.getElementById('jf-consent').getAttribute('aria-invalid'), star: !star.hidden, err: err.textContent.trim(), focused: document.activeElement.id, resultHidden: document.getElementById('jf-result').hidden }; });
    ok(cs.invalid && cs.aria === 'true' && cs.star && cs.err.includes('מדיניות הפרטיות'), `unchecked consent is marked with an asterisk and a message (${JSON.stringify(cs)})`);
    ok(cs.focused === 'jf-consent', 'focus goes to the consent box');
    ok(cs.resultHidden && popups.length === 0, 'nothing is opened or prepared without consent');
    const link = await p.evaluate(() => { const a = document.querySelector('#jf-consent').closest('.check-row').querySelector('a'); return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }; });
    ok(link.href === 'privacy.html' && link.target === null, `the privacy link opens in the same tab (${JSON.stringify(link)})`);
    await p.check(`#${prefix}-consent`);
    await p.waitForTimeout(100);
    const cleared = await p.evaluate(() => !document.getElementById('jf-consent').closest('.field').classList.contains('invalid'));
    ok(cleared, 'ticking the box clears the error at once');
    await p.fill(`#${prefix}-name`, '');
  }

  // 3) valid submission -> new tab to wa.me, same page stays
  await p.fill(`#${prefix}-name`, 'דוד כהן');
  await p.fill(`#${prefix}-phone`, '050-1234567');
  if (fieldsReq.includes('age')) await p.fill(`#${prefix}-age`, '8');
  await p.check(`#${prefix}-consent`);
  if (fieldsOpt.includes('email')) await p.fill(`#${prefix}-email`, '');
  if (fieldsOpt.includes('message')) await p.fill(`#${prefix}-message`, 'שלום\nיש שאלה & "ציטוט" #1 + עוד?');
  const urlBefore = p.url();
  const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await tap(submitSel);
  const popup = await popupP;
  ok(!!popup, 'a new tab is opened for WhatsApp');
  await p.waitForTimeout(300);
  const popupUrl = waHits[waHits.length - 1] || '';
  ok(/^https:\/\/wa\.me\/972505788781\?text=/.test(popupUrl), `new tab goes to wa.me (${popupUrl.slice(0, 60)})`);
  await p.waitForTimeout(250);
  ok(p.url() === urlBefore, `original page was not navigated away (${p.url()})`);
  const r = await p.evaluate(prefix => {
    const res = document.getElementById(prefix + '-result');
    const ta = document.getElementById(prefix + '-text');
    const wa = res.querySelector('.js-open-wa');
    return { hidden: res.hidden, text: ta.value, href: wa.getAttribute('href'), focused: document.activeElement === res };
  }, prefix);
  ok(!r.hidden && r.focused, 'result panel visible + focused');
  ok(r.text.includes('שם: דוד כהן') && r.text.includes('טלפון: 050-1234567'), 'message contains name and phone');
  if (fieldsReq.includes('age')) ok(r.text.includes('גיל המתאמן או המתאמנת: 8'), 'message contains age');
  ok(decodeURIComponent(r.href.split('?text=')[1]) === r.text, 'wa.me link carries exactly the message text');
  ok(r.href.startsWith('https://wa.me/972505788781?text='), 'wa.me link has international number format');
  ok(!/[\n ]/.test(r.href), 'wa.me link is fully URL-encoded');
  if (fieldsOpt.includes('message')) ok(r.text.includes('"ציטוט" #1 + עוד?') && decodeURIComponent(r.href.split('?text=')[1]).includes('& "ציטוט" #1 + עוד?'), 'special characters survive encoding');
  if (popup) await popup.close();

  // 4) copy button
  const copyBtn = `#${prefix}-result [data-copy-from]`;
  const beforeLabel = (await p.textContent(copyBtn)).trim();
  await tap(copyBtn);
  await p.waitForTimeout(250);
  const during = (await p.textContent(copyBtn)).trim();
  ok(during === 'הועתק', `copy button confirms (${during})`);
  await tap(copyBtn); // second click while busy must not break the label
  await p.waitForTimeout(2100);
  const afterLabel = (await p.textContent(copyBtn)).trim();
  ok(afterLabel === beforeLabel, `copy button label restored (${afterLabel} vs ${beforeLabel})`);
  const hasIcon = await p.evaluate(sel => !!document.querySelector(sel + ' svg'), copyBtn);
  ok(hasIcon, 'copy button icon restored');
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  ok(clip === r.text, 'clipboard holds the message');

  // 5) mail channel: always offered; the recipient is only filled when a club address is configured
  if (fieldsReq.includes('age')) {
    const expectTo = EMAIL_ON ? TEST_EMAIL : '';
    const mailBtn = await p.$(`#${formId} button[data-channel=mail]`);
    ok(!!mailBtn, 'the e-mail send button exists');
    const mailHref = await p.getAttribute(`#${prefix}-result .js-open-mail`, 'href');
    ok(mailHref !== null && mailHref.startsWith('mailto:' + expectTo + '?subject='), `mailto link starts with the right recipient (${(mailHref || '').slice(0, 60)})`);
    await p.fill(`#${prefix}-name`, 'דוד כהן');
    await tap(`#${formId} button[data-channel=mail]`);
    await p.waitForTimeout(300);
    const mh = await p.getAttribute(`#${prefix}-result .js-open-mail`, 'href');
    const body = decodeURIComponent(mh.split('&body=')[1] || '');
    ok(body.includes('שם: דוד כהן') && body.includes('\r\n'), 'mailto body carries the message with CRLF line breaks');
    ok(decodeURIComponent(mh.split('?subject=')[1].split('&body=')[0]) === "פנייה מהאתר: הרשמה לג'ודוקאן אילת", 'mailto subject');
    ok(!/@/.test(await p.evaluate(() => document.body.innerText)) || EMAIL_ON, 'no e-mail address is shown on the page');
    const resVisible = await p.evaluate(id => !document.getElementById(id).hidden, prefix + '-result');
    ok(resVisible, 'result panel is shown after choosing e-mail');
  }

  ok(errors.length === 0, 'no console/page errors: ' + errors.join(' | '));
  await ctx.close();
}

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent };
for (const variant of VARIANTS) {
  console.log(`\n##### build ${variant === 'mail' ? 'with' : 'without'} a club e-mail address`);
  EMAIL_ON = variant === 'mail';
  BASE = await siteUrl({ email: EMAIL_ON ? TEST_EMAIL : '' });
  // the one form of the site, in the red band of the home page: name, phone and age are required; e-mail and message are optional
  await run('desktop', desktop, 'index.html', 'join-form', 'jf', ['name', 'phone', 'age'], ['email', 'message']);
  await run('mobile', mobile, 'index.html', 'join-form', 'jf', ['name', 'phone', 'age'], ['email', 'message']);
}
console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

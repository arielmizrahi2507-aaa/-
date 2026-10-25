import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const origin = new URL(BASE).origin;
const pages = ['index.html', 'contact.html', 'accessibility.html', 'privacy.html', 'terms.html'];
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  for (const pg of pages) {
    const ctx = await b.newContext({ ...opts }); // no bypassCSP on purpose
    await ctx.route('https://wa.me/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    await ctx.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' | ' + e.blockedURI + ' | ' + (e.sample || '')));
    });
    const p = await ctx.newPage();
    const reqs = [], errs = [], bad = [];
    p.on('request', r => reqs.push(r.url()));
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(BASE + pg, { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      js: document.documentElement.classList.contains('js'),
      widget: !!document.querySelector('.a11y-toggle'),
      csp: window.__csp,
      fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight),
      meta: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
    }));
    ok(st.csp.length === 0, `${name} ${pg}: CSP violations: ${st.csp.join(' ;; ')}`);
    ok(errs.length === 0, `${name} ${pg}: console issues: ${errs.join(' | ').slice(0, 300)}`);
    ok(bad.length === 0, `${name} ${pg}: bad responses: ${bad.join(', ')}`);
    ok(reqs.every(u => u.startsWith(origin + '/')), `${name} ${pg}: third-party requests: ${reqs.filter(u => !u.startsWith(origin + '/')).join(', ')}`);
    ok(st.js && st.widget, `${name} ${pg}: inline hash script and main.js both ran (js=${st.js}, widget=${st.widget})`);
    ok(st.fontsLoaded.some(f => /Heebo/i.test(f)), `${name} ${pg}: Heebo loaded (${st.fontsLoaded.join(', ')})`);
    if (pg === 'index.html') ok(st.fontsLoaded.some(f => /Shippori/i.test(f)), `${name} ${pg}: Japanese font loaded`);

    // the policy must actually block injected code
    const probe = await p.evaluate(() => {
      const out = {};
      const s = document.createElement('script'); s.textContent = 'window.__injected = 1'; document.head.appendChild(s);
      out.inlineScript = window.__injected === 1;
      const d = document.createElement('div'); d.id = 'probe'; d.setAttribute('style', 'color: rgb(1, 2, 3)'); document.body.appendChild(d);
      out.styleAttr = getComputedStyle(d).color === 'rgb(1, 2, 3)';
      const img = new Image(); img.src = 'https://example.com/x.png'; out.imgTried = true;
      // a form may only post to WhatsApp: a form aimed at another host is reported and blocked
      const f = document.createElement('form'); f.action = 'https://example.com/steal'; f.method = 'post'; f.target = '_blank'; document.body.appendChild(f);
      window.__formBlocked = false;
      document.addEventListener('securitypolicyviolation', e => { if (e.violatedDirective === 'form-action') window.__formBlocked = true; });
      try { f.submit(); } catch (e) {}
      return out;
    });
    ok(!probe.inlineScript && !probe.styleAttr, `${name} ${pg}: injected inline script and style attribute are blocked (${JSON.stringify(probe)})`);
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => window.__formBlocked === true), `${name} ${pg}: a form aimed at another host is blocked by form-action`);
    const csp2 = await p.evaluate(() => window.__csp.length);
    ok(csp2 >= 2, `${name} ${pg}: probes were reported as violations (${csp2})`);
    await ctx.close();
  }
}
// eval / new Function must be blocked for a real same-origin script: serve a probe in place of main.js
{
  const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.route('**/assets/js/main.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: `
    window.__r = {};
    try { eval('1+1'); window.__r.eval = 'allowed'; } catch (e) { window.__r.eval = 'blocked'; }
    try { new Function('return 1')(); window.__r.fn = 'allowed'; } catch (e) { window.__r.fn = 'blocked'; }
    try { setTimeout('window.__r.str = 1', 0); } catch (e) {}
  ` }));
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => window.__r);
  ok(r.eval === 'blocked' && r.fn === 'blocked' && r.str === undefined, `eval/new Function/string timers are blocked for site scripts (${JSON.stringify(r)})`);
  await ctx.close();
}
console.log(`${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

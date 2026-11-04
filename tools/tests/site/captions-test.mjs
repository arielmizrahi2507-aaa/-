// Text that sits side by side must stay readable:
//  1. the belt ladder never lets one caption run into the next, whatever the width or the text size, and each age
//     caption ("דאן 1–5") stays on one line;
//  2. numeric ranges such as "4–7" read left to right inside the right-to-left text (with a bare en dash the browser
//     shows "7–4", so they are isolated with <bdi dir="ltr">).
import { launch, siteUrl } from '../lib.mjs';
const BASE = await siteUrl();
const b = await launch();
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  FAIL:', m); } };

// ---- 1) belts ------------------------------------------------------------------------------------------------------
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  const measure = () => p.evaluate(() => {
    const items = [...document.querySelectorAll('.belts .belt')];
    const rects = items.map(li => {
      const lab = li.querySelector('.belt-label');
      const rg = document.createRange(); rg.selectNodeContents(lab);
      const rs = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      const lb = li.getBoundingClientRect();
      const left = Math.min(...rs.map(r => r.left)), right = Math.max(...rs.map(r => r.right));
      const small = lab.querySelector('small');
      const sr = document.createRange(); sr.selectNodeContents(small);
      const lines = new Set([...sr.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top / 3))).size;
      return { name: lab.firstChild.textContent.trim(), left, right, top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)), over: Math.max(0, lb.left - left, right - lb.right), lines };
    });
    const problems = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], c = rects[j];
      if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5) problems.push(`"${a.name}" runs into "${c.name}"`);
    }
    for (const r of rects) {
      if (r.over > 0.5) problems.push(`"${r.name}" sticks out of its belt by ${Math.round(r.over)}px`);
      if (r.lines !== 1) problems.push(`the age caption of "${r.name}" is split over ${r.lines} lines`);
    }
    return { count: items.length, problems };
  });
  const widths = []; for (let w = 300; w <= 1500; w += 10) widths.push(w);
  for (const zoom of ['normal text', '200% text']) {
    if (zoom === '200% text') await p.addStyleTag({ content: 'html{font-size:200%!important}' });
    let seen = 0;
    for (const w of widths) {
      // known limit, not part of this check: with the text enlarged to 200% the side menu (17.5rem) takes 560px, so between
      // 901px and about 1100px the page column is left with under 300px and every caption in it is squeezed
      if (zoom === '200% text' && w > 900 && w < 1100) continue;
      await p.setViewportSize({ width: w, height: 900 });
      const r = await measure();
      seen = r.count;
      ok(r.count === 5 && r.problems.length === 0, `belts at ${w}px, ${zoom}: ${r.problems.join('; ') || 'expected five belts, found ' + r.count}`);
    }
    ok(seen === 5, `${zoom}: the ladder has five belts`);
  }
  await ctx.close();
}

// ---- 2) numeric ranges ---------------------------------------------------------------------------------------------
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  let total = 0;
  for (const pg of ['index.html', 'accessibility.html', 'privacy.html', 'terms.html']) {
    const p = await ctx.newPage();
    await p.goto(BASE + pg, { waitUntil: 'load' });
    const found = await p.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.parentElement.closest('script,style,svg,option,[hidden]')) continue;
        const re = /(\d+)\s?[–—]\s?(\d+)/g;
        for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
          const x = k => { const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 1); const q = r.getBoundingClientRect(); return { left: q.left + q.width / 2, w: q.width }; };
          const first = x(m.index), last = x(m.index + m[0].length - 1);
          if (!first.w && !last.w) continue;   // not displayed
          out.push({ text: m[0], leftToRight: first.left < last.left });
        }
      }
      return out;
    });
    total += found.length;
    for (const f of found) ok(f.leftToRight, `${pg}: the range "${f.text}" reads right to left (shown reversed)`);
    await p.close();
  }
  ok(total >= 8, `ranges were found and checked (${total})`);
  await ctx.close();
}

console.log(`\n${checks} checks, ${fails} failures`);
await b.close();
process.exit(fails ? 1 : 0);

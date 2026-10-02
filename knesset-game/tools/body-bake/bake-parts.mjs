// Bakes the sprite parts of the drawn (2D) fighters from the 3D model: node bake-parts.mjs <index.html> <out dir> [id1,id2,...]
// For every fighter: torso (jacket + neck, upright), upper arm, forearm + fist, thigh, shin, shoe - each straight and hanging down, lit by the 3D shader,
// written as <id>.<part>.png and meta.json (where the joint sits in the picture, pixels per rig unit). Then: python3 pack.py <out dir> <assets dir>.
// Needs Playwright and a Chromium with WebGL2 (a software one is fine): PW_MODULES=/path/to/node_modules, CHROME=/path/to/chrome
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire((process.env.PW_MODULES || '/opt/node22/lib/node_modules') + '/');
const { chromium } = require('playwright');
const [html, outDir, idList] = process.argv.slice(2);
if (!html || !outDir) { console.error('usage: node bake-parts.mjs <index.html> <out dir> [ids]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const PARTS = (process.env.PARTS || 'torso,uarm,farm,thigh,shin,shoe').split(',');      // PARTS=torso bakes only some of them (the rest of meta.json is kept)
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 900, height: 700 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + path.resolve(html) + '?debug'); await page.waitForTimeout(800);
// the realistic faces give the skin colour of the neck and the hands: wait until they are all in
await page.waitForFunction(() => window.KS && KS.Baked && KS.Baked.count() >= 21 && KS.ROSTER.every((d) => d.look.robot || KS.Baked.ready3d(d.id)), null, { timeout: 60000 });
const ids = idList ? idList.split(',') : await page.evaluate(() => KS.ROSTER.filter((d) => !d.look.robot).map((d) => d.id));
const meta = fs.existsSync(path.join(outDir, 'meta.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8')) : {};
for (const id of ids) {
  const r = await page.evaluate(({ id, PARTS }) => {
    const look = KS.ROSTER_BY_ID[id].look, out = {};
    for (const part of PARTS) {
      const g = KS.F3D.bakePart(look, part, 3);
      if (!g) return null;
      out[part] = { png: g.canvas.toDataURL('image/png'), ax: g.ax, ay: g.ay, k: g.k, w: g.canvas.width, h: g.canvas.height };
    }
    return out;
  }, { id, PARTS });
  if (!r) { console.error('could not bake', id); continue; }
  meta[id] = meta[id] || {};
  for (const part of PARTS) {
    fs.writeFileSync(path.join(outDir, id + '.' + part + '.png'), Buffer.from(r[part].png.split(',')[1], 'base64'));
    meta[id][part] = { ax: +r[part].ax.toFixed(2), ay: +r[part].ay.toFixed(2), k: r[part].k, w: r[part].w, h: r[part].h };
  }
  console.log('baked', id);
}
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta));
console.log(errs.join('|') || 'no page errors');
await b.close();

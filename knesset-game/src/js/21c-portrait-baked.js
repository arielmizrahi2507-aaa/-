// ===== Baked front portraits =====
// The realistic faces are rendered offline (tools/portrait-bake) and embedded by build.mjs as PORTRAIT_DATA = { id: { base, angry_shout, ... } } (WebP data URLs).
// drawPortrait() uses them for the front view; the drawn faces in 21b-portrait-front.js stay as the fallback (a browser that cannot show WebP, a fighter without a baked face).
const Baked = (() => {
  const data = (typeof PORTRAIT_DATA !== 'undefined' && PORTRAIT_DATA) || {};
  const imgs = {};                        // id -> key -> HTMLImageElement
  const mipOf = new WeakMap();
  const KEYS = ['base', 'angry_shout', 'angry_grin', 'hurt_shout', 'hurt_sad', 'ko_sad'];
  // The images are 5 inter-eye distances (units) wide; the eye line is 2.1 units from the top. The circle shows SPAN units across and the eye line sits EYE_Y radii above its centre.
  const SPAN = 4.1, EYE_Y = 0.02;

  function keyFor(eyes, mouth) {
    if (eyes === 'angry') return mouth === 'shout' ? 'angry_shout' : 'angry_grin';
    if (eyes === 'ko') return 'ko_sad';
    if (eyes === 'hurt') return mouth === 'shout' ? 'hurt_shout' : 'hurt_sad';
    return 'base';
  }

  // a copy of the image that is not much bigger than it will be drawn (a 512 px face squeezed into a 70 px HUD badge would shimmer)
  function sized(im, px) {
    if (im.width <= px * 1.5) return im;
    let list = mipOf.get(im);
    if (!list) { list = [im]; mipOf.set(im, list); }
    let lvl = 0;
    while (list[lvl].width > px * 1.5 && list[lvl].width > 64) {
      if (!list[lvl + 1]) {
        const w = Math.max(32, list[lvl].width >> 1);
        const c = document.createElement('canvas'); c.width = c.height = w;
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(list[lvl], 0, 0, w, w);
        list[lvl + 1] = c;
      }
      lvl++;
    }
    return list[lvl];
  }

  const jobs = {};                         // 'id|face' -> Promise, so that asking twice does not decode twice
  function load(keys) {
    const all = [];
    for (const id of Object.keys(data)) {
      for (const k of keys) {
        const url = data[id] && data[id][k];
        if (!url) continue;
        const jk = id + '|' + k;
        if (!jobs[jk]) {
          jobs[jk] = new Promise((res) => {
            const im = new Image();
            im.onload = () => { (imgs[id] || (imgs[id] = {}))[k] = im; res(); };
            im.onerror = () => res();                        // no WebP, or a damaged image: that face stays drawn
            im.src = url;
          });
        }
        all.push(jobs[jk]);
      }
    }
    return Promise.all(all);
  }

  return {
    has(id) { return !!(imgs[id] && imgs[id].base); },
    count() { return Object.keys(imgs).length; },
    loadBase() { return load(['base']); },
    // the expressions are not needed before a fight (and a slow device may still be decoding the plain faces); when everything is in, cached portraits made earlier are dropped
    loadRest() { return load(KEYS).then(() => { PORT_CACHE.clear(); portCache.clear(); }); },
    paint(ctx, id, eyes, mouth, cx, cy, r, opt) {
      const m = imgs[id];
      if (!m || !m.base) return false;
      const im = m[keyFor(eyes, mouth)] || m.base;
      const unit = 2 * r * (opt.zoom || 1) / SPAN;                               // canvas px per inter-eye distance
      const t = ctx.getTransform ? ctx.getTransform() : null;
      const sc = t ? Math.max(1, Math.hypot(t.a, t.b)) : 1;
      const src = sized(im, 5 * unit * sc);
      ctx.save();
      ctx.translate(cx, cy - r * EYE_Y);
      if (opt.flip) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, -2.5 * unit, -2.1 * unit, 5 * unit, 5 * unit);
      ctx.restore();
      return true;
    },
  };
})();

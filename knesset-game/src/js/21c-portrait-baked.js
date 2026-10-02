// ===== Baked front portraits =====
// The realistic faces are rendered offline (tools/portrait-bake) and embedded by build.mjs as PORTRAIT_DATA = { id: { base, angry_shout, ... } } (WebP data URLs).
// drawPortrait() uses them for the front view; the drawn faces in 21b-portrait-front.js stay as the fallback (a browser that cannot show WebP, a fighter without a baked face).
// The face of a 3D head is a picture flattened onto it from the front: lateral +-20 head units, from the height FACE_YT down FACE_YH units (tools/portrait-bake/facetex.py)
const FACE_YT = 18.5, FACE_YH = 47.0;
const Baked = (() => {
  const data = (typeof PORTRAIT_DATA !== 'undefined' && PORTRAIT_DATA) || {};
  const imgs = {};                        // id -> key -> HTMLImageElement
  const mipOf = new WeakMap();
  const KEYS = ['base', 'angry_shout', 'angry_grin', 'hurt_shout', 'hurt_sad', 'ko_sad'];
  // The 3D heads wear a face texture of their own (the face without hair accessories, flattened onto the head from the front): one per state of the face
  const KEYS3 = ['t_rest', 't_blink', 't_angry', 't_shout', 't_hurt', 't_ko', 't_happy', 't_relief'];
  const RELIEF_RANGE = 10.6;                 // head units that a relief value of +-127 stands for (tools/portrait-bake/facetex.py)
  const rfs = {}, skins = {};
  const LAYOUT = (typeof PORTRAIT_LAYOUT !== 'undefined' && PORTRAIT_LAYOUT) || {};      // where the features of each face sit (eye distances below the eye line)
  // The images are 5 inter-eye distances (units) wide; the eye line is 2.1 units from the top. The circle shows SPAN units across and the eye line sits EYE_Y radii above its centre.
  const SPAN = 4.1, EYE_Y = 0.02;

  function keyFor(eyes, mouth) {
    if (eyes === 'angry') return mouth === 'shout' ? 'angry_shout' : 'angry_grin';
    if (eyes === 'ko') return 'ko_sad';
    if (eyes === 'hurt') return mouth === 'shout' ? 'hurt_shout' : 'hurt_sad';
    return 'base';
  }

  // which of the 3D face textures a pose asks for (eyes and mouth as the pose system names them)
  function state3(eyes, mouth) {
    if (eyes === 'ko') return 't_ko';
    if (eyes === 'hurt') return 't_hurt';
    if (eyes === 'happy' || mouth === 'grin') return 't_happy';
    if (mouth === 'shout' || mouth === 'open') return 't_shout';
    if (eyes === 'angry') return 't_angry';
    if (eyes === 'blink' || eyes === 'squint' || mouth === 'o') return 't_blink';
    return 't_rest';
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

  // the drawn (2D) fights show the same realistic face as a head without the shoulders: cut under the chin and faded into the neck; kept at half size (the head is ~50 px across)
  const headOf = new WeakMap();
  function fightKey(eyes, mouth) {
    if (eyes === 'ko') return 'ko_sad';
    if (eyes === 'hurt') return mouth === 'shout' || mouth === 'open' ? 'hurt_shout' : 'hurt_sad';
    if (eyes === 'angry') return mouth === 'grin' || mouth === 'closed' ? 'angry_grin' : 'angry_shout';
    if (mouth === 'shout' || mouth === 'open') return 'angry_shout';
    return 'base';
  }

  return {
    has(id) { return !!(imgs[id] && imgs[id].base); },
    count() { return Object.keys(imgs).length; },
    loadBase() { return load(['base', 't_rest', 't_relief']); },
    // the expressions are not needed before a fight (and a slow device may still be decoding the plain faces); when everything is in, cached portraits made earlier are dropped
    loadRest() { return load(KEYS.concat(KEYS3)).then(() => { PORT_CACHE.clear(); portCache.clear(); if (F3D.invalidateFaces) F3D.invalidateFaces(); }); },
    // the shape of the face (nose, brows, sockets, lips, cheeks, chin) of the 3D head: (z, y) in head units -> height above the smooth skull in head units
    relief(id) {
      if (rfs[id]) return rfs[id];
      const m = imgs[id];
      if (!m || !m.t_relief) return null;
      const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(m.t_relief, 0, 0, n, n);
      const d = x.getImageData(0, 0, n, n).data, H = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) H[i] = (d[i * 4] - 128) / 127 * RELIEF_RANGE;
      return (rfs[id] = (z, y) => {
        const fx = ((20 - z) / 40) * n - 0.5, fy = ((FACE_YT - y) / FACE_YH) * n - 0.5;
        if (fx < -1 || fy < -1 || fx > n || fy > n) return 0;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const g = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : H[j * n + i];
        return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      });
    },
    ready3d(id) { const m = imgs[id]; return !!(m && m.t_rest && m.t_relief); },
    // the colour of the cheeks of the realistic face (what the skin of the neck, hands and ears has to match), '#rrggbb'
    skin3d(id) {
      if (skins[id]) return skins[id];
      const m = imgs[id];
      if (!m || !m.t_rest) return null;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(m.t_rest, 0, 0, 256, 256);
      let r = 0, g = 0, b = 0, n = 0;
      const row0 = Math.round((FACE_YT - (EYE3 - 0.85 * K3)) / FACE_YH * 256), row1 = Math.round((FACE_YT - (EYE3 - 0.40 * K3)) / FACE_YH * 256);
      for (const sg of [-1, 1]) {
        const c0 = Math.round((20 + sg * 0.85 * K3) / 40 * 256), c1 = Math.round((20 + sg * 0.5 * K3) / 40 * 256);
        const d = x.getImageData(Math.min(c0, c1), row0, Math.abs(c1 - c0), row1 - row0).data;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
      const h = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      return (skins[id] = '#' + h(r) + h(g) + h(b));
    },
    layout(id) { return (data[id] && data[id].t_rest && LAYOUT[id]) || null; },
    face3d(id, eyes, mouth) { const m = imgs[id]; return (m && (m[state3(eyes, mouth)] || m.t_rest)) || null; },
    // { c: canvas, U: canvas px per eye distance, ex: x of the middle of the eyes, ey: y of the eye line } or null when this fighter has no baked face yet
    head2d(id, eyes, mouth, look) {
      const m = imgs[id];
      if (!m || !m.base) return null;
      const im = m[fightKey(eyes, mouth)] || m.base;
      let h = headOf.get(im);
      if (h) return h;
      const lay = LAYOUT[id], chin = lay ? lay.chin : 2.45, U0 = im.width / 5, sc = im.width > 300 ? 0.5 : 1, U = U0 * sc;      // the big faces are halved (the fight shows them smaller), the small hurt ones are not
      const bl = look && look.beard ? Math.max(0, look.beard.len || 0) : 0, longHair = look && look.hair && look.hair.len > 0;
      const keep = bl > 0.5 || longHair;                              // a long beard or long hair goes on below the chin: keep the picture to its lower edge, fade only the last bit
      const e0 = (2.1 + chin + bl * 0.376) * U0;                      // the chin (or the end of a short beard)
      const f0 = e0 - 0.28 * U0;                                      // the head fades out into the neck of the body from here
      const hh = keep ? im.height : Math.min(im.height, Math.ceil(e0 + 0.1 * U0));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(hh * sc);
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, im.width, hh, 0, 0, c.width, c.height);
      // under the chin the picture shows the neck, the collar and the shoulders: keep the head (the jaw and the chin as a rounded shape), a long beard or long hair
      const yJaw = (2.1 + (lay ? lay.jaw_y : 1.7)) * U, yChin = (2.1 + chin) * U, jh = (lay ? lay.jaw_half : 1.25) * U * 1.12, cx = c.width / 2, yTop = yJaw - 0.05 * U;
      x.save(); x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000';
      x.beginPath();
      if (longHair || bl > 0.5) {                                                    // a straight cut, wide enough for the beard or the hair
        const half = (longHair ? 2.1 : 1.35) * U;
        x.rect(0, 0, c.width, yTop); x.rect(cx - half, yTop, 2 * half, c.height - yTop);
      } else {
        const nw = Math.min(U, Math.max(0.55 * U, 0.62 * jh)), yE = yChin - 0.1 * U, pts = [], n = 10;     // down the jaw to the chin (as wide as the chin of this face), round under it
        for (let i = 0; i <= n; i++) { const t = i / n, e = t * t * (3 - 2 * t); pts.push([jh + (nw - jh) * e, yJaw + (yE - yJaw) * t]); }
        x.moveTo(0, 0); x.lineTo(c.width, 0); x.lineTo(c.width, yTop); x.lineTo(cx + jh, yTop);
        for (const q of pts) x.lineTo(cx + q[0], q[1]);
        x.ellipse(cx, yE, nw, 0.2 * U, 0, 0, Math.PI, false);
        for (let i = pts.length - 1; i >= 0; i--) x.lineTo(cx - pts[i][0], pts[i][1]);
        x.lineTo(cx - jh, yTop); x.lineTo(0, yTop);
      }
      x.closePath(); x.fill();
      x.restore();
      const g = x.createLinearGradient(0, keep ? c.height - 0.3 * U : f0 * sc, 0, c.height);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      h = { c, U, ex: c.width / 2, ey: 2.1 * U };
      headOf.set(im, h);
      return h;
    },
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

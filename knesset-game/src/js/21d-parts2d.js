// ===== Drawn (2D) fighters made of sprite parts =====
// Without WebGL2 (or in the power-saving mode that turns the 3D figures off) the fighters are drawn on the 2D canvas. Their bodies are put together from pictures of the
// parts of the 3D model - the jacket, the arms, the legs, the shoes - baked offline with the 3D shader (tools/body-bake), along the same skeleton the 3D figure uses
// (skeleton3D), and the realistic portrait is the head. A fighter without baked parts (the boss, the minions) keeps the cartoon body.
const Parts = (() => {
  const data = (typeof PARTS_DATA !== 'undefined' && PARTS_DATA) || {}, meta = (typeof PARTS_META !== 'undefined' && PARTS_META) || {};
  const NAMES = ['torso', 'uarm', 'farm', 'thigh', 'shin', 'shoe'];
  const imgs = {};                         // id -> part -> { img, far }
  const jobs = {};
  const scratch = {};                      // one canvas per part for the hit flash / ghost tint

  function darker(im) {                    // the far arm and leg are a little in the shade
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(8,6,20,.3)'; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function load(ids) {
    const all = [];
    for (const id of ids || Object.keys(data)) {
      const d = data[id];
      if (!d) continue;
      for (const n of NAMES) {
        const jk = id + '|' + n;
        if (!jobs[jk] && d[n]) {
          jobs[jk] = new Promise((res) => {
            const im = new Image();
            im.onload = () => { (imgs[id] || (imgs[id] = {}))[n] = { img: im, far: darker(im) }; res(); };
            im.onerror = () => res();                       // no WebP: the cartoon body stays
            im.src = d[n];
          });
        }
        if (jobs[jk]) all.push(jobs[jk]);
      }
    }
    return Promise.all(all);
  }
  const ready = (id) => { const m = imgs[id]; return !!(m && meta[id] && NAMES.every((n) => m[n])); };

  // Draws the body and the head of f in the current (rig) transform of drawFighter. Returns { x, y } of the front fist, or null when the parts are not there.
  function draw(ctx, f, p, look, flash, tint) {
    const id = f.def.id;
    if (!ready(id)) return null;
    const M = meta[id], P = imgs[id], S = skeleton3D(f, p, look);
    const fx = (name, far) => {            // the picture of a part: as it is, or with the hit flash / the ghost tint on a scratch copy
      const src = far ? P[name].far : P[name].img;
      if (!(flash > 0 || tint)) return src;
      const c = scratch[name] || (scratch[name] = document.createElement('canvas'));
      if (c.width !== src.width || c.height !== src.height) { c.width = src.width; c.height = src.height; }
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0);
      x.globalCompositeOperation = tint ? 'source-in' : 'source-atop';
      x.fillStyle = tint || 'rgba(255,255,255,' + Math.min(1, flash) + ')'; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-over';
      return c;
    };
    const X = (q) => q[0], Y = (q) => -q[1];           // model space (y up) -> the rig (y down)
    // a part that hangs down from its anchor, turned and stretched so that it runs from joint A to joint B
    const seg = (name, far, a, b, nominal) => {
      const m = M[name], ax = X(a), ay = Y(a), dx = X(b) - ax, dy = Y(b) - ay, len = Math.hypot(dx, dy) || 1, k = 1 / m.k;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(-dx, dy)); ctx.scale(1, len / nominal);
      ctx.drawImage(fx(name, far), -m.ax * k, -m.ay * k, m.w * k, m.h * k);
      ctx.restore();
    };
    const arm = (ar) => { const far = !ar.near; seg('uarm', far, ar.sh, ar.el, ARM_L); seg('farm', far, ar.el, ar.wr, ARM_L); };
    const leg = (lg) => {
      const far = !lg.near, m = M.shoe, k = 1 / m.k;
      seg('thigh', far, lg.hp, lg.kn, LEG_L); seg('shin', far, lg.kn, lg.an, LEG_L);
      ctx.save(); ctx.translate(X(lg.an), Y(lg.an)); ctx.rotate(-lg.ang); ctx.drawImage(fx('shoe', far), -m.ax * k, -m.ay * k, m.w * k, m.h * k); ctx.restore();
    };
    // a leg that swings up and forward (a kick) passes in front of the jacket, a leg that stands is under its hem
    const nl = S.legN, thighUp = (Y(nl.kn) - Y(nl.hp)) < 6 || Math.abs(X(nl.kn) - X(nl.hp)) > 0.85 * Math.abs(Y(nl.kn) - Y(nl.hp));
    arm(S.armF);
    leg(S.legF);
    if (!thighUp) leg(S.legN);
    {
      const m = M.torso, k = 1 / m.k;
      ctx.save(); ctx.translate(X(S.O), Y(S.O)); ctx.rotate(p.lean);
      ctx.drawImage(fx('torso', false), -m.ax * k, -m.ay * k, m.w * k, m.h * k);
      ctx.restore();
    }
    if (thighUp) leg(S.legN);
    // the head: the realistic portrait of this person, or the drawn head until the picture is in
    ctx.save();
    ctx.translate(X(S.hc), Y(S.hc)); ctx.rotate(p.headRot); ctx.scale(HEAD_K, HEAD_K);
    if (!drawBakedHead(ctx, f, look, p, flash, tint, HEAD2D_EYE_Y)) drawHead(ctx, f, look, p, tint ? () => tint : flash > 0 ? (c) => flashMix(c, flash) : (c) => c);
    ctx.restore();
    arm(S.armN);
    const fist = S.armN.fist;
    if (p.finger && !tint) {                   // a pointing finger
      const d = S.armN.dir, skin = geo(look).pal.skin;
      ctx.lineCap = 'round'; ctx.lineWidth = 3.4; ctx.strokeStyle = flash > 0 ? flashMix(skin, flash) : skin;
      ctx.beginPath(); ctx.moveTo(X(fist) + d[0] * 3, Y(fist) - d[1] * 3); ctx.lineTo(X(fist) + d[0] * 13.5, Y(fist) - d[1] * 13.5); ctx.stroke();
    }
    return { x: X(fist), y: Y(fist), hc: [X(S.hc), Y(S.hc)] };
  }

  return { has: ready, load, draw };
})();

// ===== Front-facing caricature portraits =====
// People recognise a face from the front, so the portraits (select screen, VS splash, HUD, results) are drawn from the front, symmetrically, from the
// same per-person numbers (30-looks.js) as the side view. The fighters themselves stay in profile. Units: the head is about 41 wide, the centre is
// the middle of the face, y grows downwards, the portrait circle has a radius of 33 units.

const FRONT_GEO = new WeakMap();
const fMir = (p) => [-p[0], p[1]];
const fSup = (v, n) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);          // superellipse helper

// Hair seen from the front. top / side: how far the hair stands off the skull; drop: where the sideburn ends; hc: hairline height at the centre;
// edge: how far the hairline curves down at the temples; sw: the hair is swept to one side (fringe lower on the right); peak: a widow's peak.
const HAIR_F = {
  crop:    { top: 3.2, side: 2.2, drop: -1,  hc: -21.4, edge: 15.5, sw: 0,    peak: 0.4 },
  buzz:    { top: 1.5, side: 1.3, drop: -4,  hc: -22.2, edge: 15,   sw: 0,    peak: 0,   buzz: 1 },
  curly:   { top: 4.8, side: 3.4, drop: 0,   hc: -21.2, edge: 15.5, sw: 0,    peak: 0,   curl: 1 },
  comb:    { top: 4.4, side: 2.8, drop: 2,   hc: -22.4, edge: 16.5, sw: 0.7,  peak: 0 },
  swoop:   { top: 5.4, side: 2.8, drop: -2,  hc: -23,   edge: 17,   sw: 0,    peak: 1.6 },
  part:    { top: 4.0, side: 2.6, drop: 0,   hc: -22.2, edge: 16,   sw: 0.9,  peak: 0 },
  thin:    { top: 2.0, side: 1.6, drop: -4,  hc: -24.6, edge: 14,   sw: 0.3,  peak: 0,   thin: 1 },
  wavy:    { top: 4.0, side: 3.6, drop: 2,   hc: -13.4, edge: 8,    sw: 0,    peak: 0,   long: 1 },
  layered: { top: 6.4, side: 5.0, drop: 2,   hc: -19,   edge: 12,   sw: -1.4, peak: 0,   long: 1, flare: 1 },
  spiky:   { top: 5.2, side: 2.4, drop: -1,  hc: -21.4, edge: 15.5, sw: 0,    peak: 0.5, spike: 1 },
  bob:     { top: 4.6, side: 4.4, drop: 2,   hc: -16.5, edge: 9,    sw: -1.0, peak: 0,   long: 1 },
};

// y of a polyline (points run from left to right) at x
function fYat(seq, x) {
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i], b = seq[i + 1];
    if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) { const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
  }
  return seq[seq.length - 1][1];
}

function frontGeo(look) {
  let g = FRONT_GEO.get(look);
  if (g) return g;
  const base = geo(look), pal = base.pal, G = faceK;
  const fw = Math.max(0.84, Math.min(1.24, G(look.fw, 'fw'))), chk = G(look.cheek, 'cheek'), chn = G(look.chin, 'chin'), jk = G(look.jaw, 'jaw'), fore = G(look.fore, 'fore');
  const ln = (look.len || 1) - 1, jl = (look.jowl || 0) * FACE_GAIN;
  const Ly = (y) => y + ln * 9 * sstep(6, 17, y);
  const lowW = (jk - 1) * 3.0 + jl * 0.8;
  // ---- the face outline (right half from the crown down to the chin, then mirrored)
  const R = [
    [0, -28.6 - (fore - 1) * 1.5], [9.2, -27.4 - (fore - 1) * 1.3], [16, -21.8 - (fore - 1) * 0.9], [19.4, -13], [20.2 + (chk - 1) * 1.3, -3.6],
    [19.6 + (chk - 1) * 2.6, 5.2], [17.4 + lowW, Ly(13.2) + jl * 1.2], [12.8 + lowW * 1.05, Ly(19.8) + jl * 1.9], [6.6 + (chn - 1) * 2.7, Ly(23.8) + (chn - 1) * 1.1 + jl * 1.5], [0, Ly(25.4) + (chn - 1) * 1.9 + jl * 1.1],
  ].map(([x, y]) => [x * fw, y]);
  const face = spline(R.concat(R.slice(1, -1).reverse().map(fMir)), true);
  // ---- the nose and mouth heights follow the length of the nose and of the lower face
  const nq = Math.max(0.75, Math.min(1.65, (G(look.nose, 'nose') + G(look.noseL, 'noseL')) / 2));
  const nwq = Math.max(0.75, Math.min(1.5, (G(look.nose, 'nose') + G(look.noseW, 'noseW')) / 2));
  const noseY = 3.9 + (nq - 1) * 3.4 + (look.noseT || 0) * 0.9;
  const mouthY = noseY + 7.2 + ln * 3.2;
  // short strokes for the texture of beards and stubble
  const tex = new Path2D();
  const ext = (look.beard && look.beard.len ? look.beard.len * 7 : 0), wide = 42 + ((look.beard && look.beard.flare) || 0) * 9;
  for (let i = 0, a = 4242, cnt = 230 + ext * 12; i < cnt; i++) {
    const rn = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const x = (rn() - 0.5) * wide, y = -4 + rn() * (36 + ext), an = Math.PI / 2 + (rn() - 0.5) * 1.1, l = 0.9 + rn() * 1.3;
    tex.moveTo(x, y); tex.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l);
  }
  g = { face, R, fw, chinY: R[R.length - 1][1], pal, noseY, mouthY, nwq, nq, tex, hair: null };
  // ---- hair
  const style = look.hair && look.hair.style;
  const hs0 = style && HAIR_F[style];
  // per-person tweaks of the hair shape: dt (higher / flatter on top), ds (wider at the sides), dd (sideburns longer), dh (hairline lower), de (hairline curves down more at the temples), dw (swept more to the right)
  const hs = hs0 && Object.assign({}, hs0, { top: hs0.top + (look.hair.dt || 0), side: hs0.side + (look.hair.ds || 0), drop: hs0.drop + (look.hair.dd || 0), hc: hs0.hc + (look.hair.dh || 0), edge: hs0.edge + (look.hair.de || 0), sw: hs0.sw + (look.hair.dw || 0) });
  if (hs) {
    const hl = look.hair.hl || 0, vol = look.hair.vol || 1, vk = 1 + (vol - 1) * 0.2;
    const W0 = 20.6 * fw, Rx = W0 + hs.side * vk, Ry = 22.6 + (fore - 1) * 1.3 + hs.top * vk, n = hs.curl ? 2.6 : 2.3;
    const outer = [];
    const np = hs.spike ? 44 : 16;
    for (let i = 0; i <= np; i++) {
      const th = (i / np) * Math.PI, bump = hs.curl ? 1 + 0.045 * Math.sin(th * 13) : hs.spike ? 1 + (i % 2 ? 0.075 + 0.05 * Math.sin(i * 2.3) : -0.02) * Math.pow(Math.sin(th), 0.7) : 1 + 0.02 * Math.sin(th * 3.7 + 1.1);
      outer.push([fSup(Math.cos(th), n) * Rx * bump, -6 - Math.pow(Math.sin(th), 2 / n) * Ry * bump]);       // right equator -> crown -> left equator
    }
    const side = hs.drop;
    const outerSeq = [[Rx * 0.985, side]].concat(outer, [[-Rx * 0.985, side]]);
    const hc = hs.hc - hl * 26, rec = hl * 34 + (hs.thin ? 5 : 0);
    const hair = [];                                                                                         // the hairline from the left sideburn to the right one
    for (let i = 0; i <= 22; i++) {
      const x = -19.2 * fw + (i / 22) * 38.4 * fw, u = Math.abs(x) / (19.6 * fw);
      let y = hc + (hs.edge + rec * 0.5) * Math.pow(u, 2.6 + hl * 2.4);
      y -= rec * 0.35 * Math.exp(-Math.pow((u - 0.62) / 0.2, 2));                                            // receding temples
      y += hs.sw * Math.max(-1, Math.min(1, x / 12)) * 4.2;                                                  // swept fringe
      y -= hs.peak * Math.exp(-Math.pow(x / 4.5, 2));                                                        // widow's peak
      if (!hs.buzz) y += 0.55 * Math.sin(x * 1.45 + 0.6) * (1 - u * 0.5);                                    // not a ruler-straight edge
      hair.push([x, Math.max(y, -29 - (fore - 1))]);
    }
    const cap = new Path2D(), sil = new Path2D(), hln = new Path2D(), ticks = new Path2D();
    const edge = (path, first) => { if (hs.spike) { outerSeq.forEach((q, k) => { if (k === 0 && first) path.moveTo(q[0], q[1]); else path.lineTo(q[0], q[1]); }); } else addSpline(path, outerSeq, first); };
    edge(cap, true); cap.lineTo(hair[0][0], hair[0][1]); addSpline(cap, hair, false); cap.closePath();
    sil.moveTo(hair[hair.length - 1][0], hair[hair.length - 1][1]); sil.lineTo(outerSeq[0][0], outerSeq[0][1]); edge(sil, false); sil.lineTo(hair[0][0], hair[0][1]);
    addSpline(hln, hair, true);
    if (!hs.buzz && !hs.curl) {                                                                              // short hairs on the forehead edge, so it does not look like a cap
      for (let i = 1; i < hair.length - 1; i += 1) {
        const [x, y] = hair[i], d = (i % 2 ? 1 : -1) * 0.6;
        ticks.moveTo(x, y - 0.6); ticks.quadraticCurveTo(x + d, y + 0.5, x + d * 1.8, y + 1.9 + (i % 3) * 0.35);
      }
    }
    const st = new Path2D();
    if (!hs.buzz && !hs.curl) {                                                                              // strands from the hairline up and back
      for (let i = 0, cnt = 8; i < cnt; i++) {
        const u = -0.86 + (i / (cnt - 1)) * 1.72, x0 = u * 17 * fw, y0 = fYat(hair, x0) - 0.6;
        const x1 = u * Rx * 0.96 + hs.sw * -2.2, y1 = -6 - Math.pow(Math.max(0.02, 1 - Math.pow(Math.min(0.97, Math.abs(x1) / Rx), n)), 1 / n) * Ry * 0.92;
        st.moveTo(x0, y0); st.quadraticCurveTo((x0 + x1) / 2 + (hs.sw ? 2.8 * Math.sign(hs.sw) : 0), (y0 + y1) / 2 + 1.2, x1, y1 + 1.2);
      }
    }
    if (hs.curl) {
      for (let i = 0; i < 11; i++) { const th = 0.18 + (i / 10) * (Math.PI - 0.36), r = 0.82 + (i % 2) * 0.1, x = fSup(Math.cos(th), n) * Rx * r, y = -6 - Math.pow(Math.sin(th), 2 / n) * Ry * r; st.moveTo(x - 1.5, y + 1); st.arc(x, y + 0.2, 1.6, Math.PI, Math.PI * 2.1); }
    }
    g.hair = { cap, sil, hln, ticks, strands: st, hs, back: null, lockR: null, lockL: null };
    if (hs.long) {                                                                                           // a mass behind the head and two locks in front of the shoulders
      const flare = hs.flare ? 1 : 0, len = ((look.hair.len || 40) - 6) * 0.78, bot = Math.min(46, 8 + len), wide = 24.2 * fw + hs.side * 0.6 + flare * 2.6;
      const bp = [[0, -30.5 - hs.top * 0.3], [11, -29], [wide * 0.78, -22], [wide, -10], [wide + 1.2, 6], [wide + 0.4 + flare * 2.2, bot * 0.55], [wide - 0.5 + flare * 4.2, bot], [wide * 0.45, bot + 2.2], [0, bot + 1.5]];
      g.hair.back = spline(bp.concat(bp.slice(1, -1).reverse().map(fMir)), true);
      const lw = 6.2 + flare * 1.6, lx = 17.2 * fw + 3.2;
      const lp = [[lx - 1.6, -4], [lx + lw * 0.7, 2], [lx + lw + 0.8 + flare * 1.2, bot * 0.5], [lx + lw + 1 + flare * 3.2, bot - 1], [lx + 0.6, bot + 1.6], [lx - 3.4, bot * 0.52], [lx - 3.2, 8]];
      g.hair.lockR = spline(lp, true); g.hair.lockL = spline(lp.map(fMir), true);
    }
  } else if (style === 'sides') {                                                                            // bald crown, hair only above and behind the ears
    const k = fw, sp = [[18.6 * k, -15], [22.6 * k, -12.6], [25.2 * k, -5.6], [25.2 * k, 3.4], [23.4 * k, 9.4], [20.6 * k, 4.2], [19.8 * k, -4.4]];
    const strands = new Path2D();
    for (const sg of [1, -1]) for (const [a, b] of [[-8, 1], [-4, 3], [0, 4.6]]) { strands.moveTo(sg * 21 * k, a); strands.quadraticCurveTo(sg * 23.2 * k, (a + b) / 2, sg * 22.4 * k, b + 2); }
    g.hair = { sidesR: spline(sp, true), sidesL: spline(sp.map(fMir), true), strands, hs: { sides: 1 }, cap: null };
  }
  FRONT_GEO.set(look, g);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// the bust: neck, jacket, shirt, tie
// ---------------------------------------------------------------------------------------------------------------
function frontBust(ctx, look, g, C) {
  const pal = g.pal, nk = faceK(look.neck, 'neck'), sh = look.shoulders || 0, ww = look.w || 1;
  const nh = 8.3 * nk * (0.92 + 0.08 * ww), top = g.chinY - 6, bot = g.chinY + 16;
  const sx = (31 + sh * 5) * (0.9 + 0.1 * ww);                       // half width of the jacket at the shoulders
  ctx.beginPath();
  ctx.moveTo(-nh - 1, bot - 6);
  ctx.bezierCurveTo(-sx * 0.55, bot - 5, -sx - 7, bot - 2, -sx - 12, 62); ctx.lineTo(sx + 12, 62);
  ctx.bezierCurveTo(sx + 7, bot - 2, sx * 0.55, bot - 5, nh + 1, bot - 6); ctx.closePath();
  const tg = ctx.createLinearGradient(-sx - 12, 0, sx + 12, 0); tg.addColorStop(0, C(pal.suitD)); tg.addColorStop(0.5, C(pal.suit)); tg.addColorStop(1, C(pal.suitD));
  ctx.fillStyle = tg; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
  // the neck, shadowed under the chin
  ctx.beginPath(); ctx.moveTo(-nh, top); ctx.lineTo(-nh - 0.6, bot - 4); ctx.lineTo(nh + 0.6, bot - 4); ctx.lineTo(nh, top); ctx.closePath();
  const ng = ctx.createLinearGradient(0, top, 0, bot); ng.addColorStop(0, C(pal.skinDD)); ng.addColorStop(0.35, C(pal.skinD)); ng.addColorStop(1, C(pal.skin));
  ctx.fillStyle = ng; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  // the shirt: a V under the neck
  const vy = bot + 17 + (look.open ? 3 : 0);
  ctx.beginPath(); ctx.moveTo(-nh - 1.4, bot - 5.5); ctx.lineTo(nh + 1.4, bot - 5.5); ctx.lineTo(0, vy + 4); ctx.closePath();
  ctx.fillStyle = C(pal.shirt); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
  if (look.open) {
    ctx.beginPath(); ctx.moveTo(-nh + 0.5, bot - 5); ctx.lineTo(nh - 0.5, bot - 5); ctx.lineTo(0, vy - 5); ctx.closePath(); ctx.fillStyle = C(pal.skinD); ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke();
  }
  ctx.fillStyle = C(pal.suitL); ctx.lineWidth = 1.3;                    // lapels
  ctx.beginPath(); ctx.moveTo(-nh - 1.6, bot - 6); ctx.lineTo(-sx * 0.78, bot + 7.5); ctx.lineTo(-11.5, vy + 12); ctx.lineTo(0, vy + 4); ctx.lineTo(-5, bot + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(nh + 1.6, bot - 6); ctx.lineTo(sx * 0.78, bot + 7.5); ctx.lineTo(11.5, vy + 12); ctx.lineTo(0, vy + 4); ctx.lineTo(5, bot + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!look.open && look.tie) {
    ctx.fillStyle = C(pal.tie);
    ctx.beginPath(); ctx.moveTo(-3.2, bot - 3); ctx.lineTo(3.2, bot - 3); ctx.lineTo(4.4, bot + 1.6); ctx.lineTo(-4.4, bot + 1.6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.6, bot + 1.6); ctx.lineTo(3.6, bot + 1.6); ctx.lineTo(5.8, vy + 8); ctx.lineTo(0, vy + 14); ctx.lineTo(-5.8, vy + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (look.pin) { ctx.beginPath(); ctx.arc(sx * 0.62, bot + 14, 2.5, 0, TAU); ctx.fillStyle = C(look.pin); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
}

// ---------------------------------------------------------------------------------------------------------------
// the parts of the face
// ---------------------------------------------------------------------------------------------------------------
function frontEyes(ctx, look, p, C, ey, ex, eK) {
  for (const sg of [1, -1]) {
    ctx.save(); ctx.translate(sg * ex, ey); ctx.scale(sg, 1);
    drawEye(ctx, 0, 0, 1.14 * eK, p.eyes, look, C, -0.3, false);
    ctx.restore();
  }
}

function frontBrows(ctx, look, g, p, C, ey, ex, eK) {
  const pal = g.pal, e = p.eyes, bw = look.brow || 2.5, arch = look.browArch || 0, tilt = look.browTilt || 0, bl = look.browLen || 1;
  const ang = e === 'angry' ? 1 : e === 'hurt' ? -1 : e === 'squint' ? 0.5 : e === 'happy' ? -0.15 : 0;
  const rdg = faceK(look.ridge, 'ridge');
  const yb = ey - 5.6 - (eK - 1) * 1.4 - (rdg - 1) * 0.5;
  const shape = (x0, y0, cx, cy, x1, y1, w0, w1) => {
    const up = [], dn = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1, hw = (w0 + (w1 - w0) * t * t) / 2;
      up.push([x - dy / l * hw, y + dx / l * hw]); dn.push([x + dy / l * hw, y - dx / l * hw]);
    }
    ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
    for (const q of up) ctx.lineTo(q[0], q[1]);
    for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
    ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.5; ctx.stroke();
  };
  ctx.fillStyle = C(pal.brow); ctx.strokeStyle = C(pal.brow); ctx.lineJoin = 'round';
  const hurt = e === 'hurt' ? -1.4 : 0;
  for (const sg of [1, -1]) {
    ctx.save(); ctx.scale(sg, 1);
    const xi = ex - 6.2 * eK + 0.6, xo = (ex + 6.4 * eK) * Math.min(1.12, bl);
    shape(xi, yb + 1.8 + ang * 1.9 + tilt * 1.2 + hurt, (xi + xo) / 2, yb - 1.4 - arch * 1.9 - (ang < 0 ? 1.3 : 0) + ang * 0.2, xo, yb + 1.9 - ang * 0.4 - tilt * 1.0 - hurt * 0.5, bw * 1.18, bw * 0.55);
    ctx.restore();
  }
}

function frontNose(ctx, look, g, ey) {
  const ny = g.noseY, nw = 0.4 + g.nwq * 0.95, br = look.bridge || 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(88,40,30,.22)'; ctx.lineWidth = 0.9;                                  // the sides of the bridge
  for (const sg of [1, -1]) { ctx.beginPath(); ctx.moveTo(sg * 3.3, ey + 0.5); ctx.quadraticCurveTo(sg * (2.4 + nw * 0.7), (ey + ny) / 2, sg * (2.6 + nw * 1.9), ny - 1.3); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0.3, ey + 1.5); ctx.lineTo(0.3, ny - 1.4); ctx.stroke();
  if (br > 0.05) { ctx.strokeStyle = `rgba(88,40,30,${0.16 + br * 0.5})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(2.6, ey + 3); ctx.quadraticCurveTo(3.2 + br * 1.2, ey + 6, 3, ny - 2.4); ctx.stroke(); }
  ctx.fillStyle = 'rgba(88,40,30,.17)'; ctx.beginPath(); ctx.ellipse(0, ny + 2.7, 2.4 + nw * 1.6, 1.15, 0, 0, TAU); ctx.fill();    // shadow under the tip
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.ellipse(-0.2, ny - 1.1, 1.9 + nw * 0.9, 1.6, 0, 0, TAU); ctx.fill();   // shine on the tip
  ctx.strokeStyle = 'rgba(70,26,20,.48)'; ctx.lineWidth = 0.9;
  for (const sg of [1, -1]) {                                                                    // the wings of the nose
    ctx.beginPath(); ctx.moveTo(sg * 1.5, ny + 0.2); ctx.bezierCurveTo(sg * (2.2 + nw), ny - 1.7, sg * (3.9 + nw * 1.6), ny - 0.9, sg * (3.9 + nw * 1.5), ny + 1.2);
    ctx.bezierCurveTo(sg * (3.8 + nw * 1.4), ny + 2.4, sg * (2.4 + nw * 0.8), ny + 2.9, sg * 1.5, ny + 2.1); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,12,8,.6)';
  for (const sg of [1, -1]) { ctx.beginPath(); ctx.ellipse(sg * (1.9 + nw * 0.34), ny + 1.7, 0.9 + nw * 0.22, 0.58, sg * 0.35, 0, TAU); ctx.fill(); }
}

function frontMouth(ctx, look, g, p, C) {
  const pal = g.pal, my = g.mouthY, female = !!look.female, m = p.mouth;
  const lk = 0.7 + 0.3 * faceK(look.lips, 'lips'), mw = 7 * (look.mouthW || 1) * (0.92 + 0.08 * faceK(look.lips, 'lips'));
  const lip = pal.lip, dark = '#3d1019';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const upper = (lift) => {
    ctx.beginPath(); ctx.moveTo(-mw, my - lift);
    ctx.quadraticCurveTo(-mw * 0.5, my - 1.9 * lk - lift * 0.4, -mw * 0.13, my - 1.7 * lk); ctx.quadraticCurveTo(0, my - 0.8 * lk, mw * 0.13, my - 1.7 * lk);
    ctx.quadraticCurveTo(mw * 0.5, my - 1.9 * lk - lift * 0.4, mw, my - lift); ctx.quadraticCurveTo(0, my + 0.35, -mw, my - lift); ctx.closePath();
  };
  const lower = (lift) => {
    ctx.beginPath(); ctx.moveTo(-mw * 0.9, my + 0.1 - lift * 0.6);
    ctx.quadraticCurveTo(0, my + 3.9 * lk, mw * 0.9, my + 0.1 - lift * 0.6); ctx.quadraticCurveTo(0, my + 0.55, -mw * 0.9, my + 0.1 - lift * 0.6); ctx.closePath();
  };
  const shut = (lift) => {
    ctx.fillStyle = lip; ctx.globalAlpha = female ? 0.92 : 0.55 + 0.1 * (lk - 1);
    lower(lift); ctx.fill(); upper(lift); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(38,12,14,.85)'; ctx.lineWidth = 0.95;
    ctx.beginPath(); ctx.moveTo(-mw, my - lift); ctx.quadraticCurveTo(0, my + 0.8 + lift * 0.1, mw, my - lift); ctx.stroke();
    if (female) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-0.6, my + 1.7 * lk, 1.8, 0.55, 0, 0, TAU); ctx.fill(); }
  };
  const mood = look.mood || 0;
  if (m === 'closed') shut(mood * 1.5);
  else if (m === 'smile') shut(1.3 + mood * 1.0);
  else if (m === 'sad') shut(-1.4 + mood * 0.3);
  else if (m === 'o') {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, my + 1.4, 2.7, 3.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = lip; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (m === 'grin') {
    ctx.beginPath(); ctx.moveTo(-mw * 1.05, my - 1.8); ctx.quadraticCurveTo(0, my + 7.5, mw * 1.05, my - 1.8); ctx.quadraticCurveTo(0, my - 0.4, -mw * 1.05, my - 1.8); ctx.closePath();
    ctx.fillStyle = dark; ctx.fill(); ctx.save(); ctx.clip();
    ctx.fillStyle = C('#f6f2ea'); ctx.fillRect(-mw * 1.1, my - 2.2, mw * 2.2, 2.6);
    ctx.fillStyle = '#c85a6c'; ctx.beginPath(); ctx.ellipse(0, my + 5.2, 3.6, 1.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-mw * 1.05, my - 1.8); ctx.quadraticCurveTo(0, my + 7.5, mw * 1.05, my - 1.8); ctx.quadraticCurveTo(0, my - 0.4, -mw * 1.05, my - 1.8); ctx.stroke();
  } else {                                                                                       // open / shout
    const big = m === 'shout' ? 1 : 0.7, wd = mw * (m === 'shout' ? 1.0 : 0.92);
    ctx.beginPath(); ctx.moveTo(-wd, my - 1.2); ctx.quadraticCurveTo(0, my - 2.4, wd, my - 1.2); ctx.quadraticCurveTo(wd * 0.9, my + 8.4 * big, 0, my + 9 * big); ctx.quadraticCurveTo(-wd * 0.9, my + 8.4 * big, -wd, my - 1.2); ctx.closePath();
    ctx.fillStyle = dark; ctx.fill(); ctx.save(); ctx.clip();
    ctx.fillStyle = C('#f6f2ea'); ctx.fillRect(-wd, my - 2.4, wd * 2, 3.3);
    ctx.fillStyle = '#c85a6c'; ctx.beginPath(); ctx.ellipse(0, my + 7.6 * big, 4, 2.4 * big + 0.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lip; ctx.lineWidth = 1.3; ctx.stroke();
  }
}

function frontStache(ctx, look, g, C) {
  const my = g.mouthY, sw = look.stacheW || 1, col = look.stache || (look.beard && look.beard.color);
  if (!col) return;
  ctx.beginPath(); ctx.moveTo(0, my - 3.2);
  ctx.bezierCurveTo(2.2 * sw, my - 4.8, 6.4 * sw, my - 4.3, 8.4 * sw, my - 2.2); ctx.bezierCurveTo(9.6 * sw, my - 0.8, 9.2 * sw, my + 0.9, 8.2 * sw, my + 1.3);
  ctx.bezierCurveTo(6.6 * sw, my - 0.4, 3.2 * sw, my - 0.2, 0, my - 1.7); ctx.bezierCurveTo(-3.2 * sw, my - 0.2, -6.6 * sw, my - 0.4, -8.2 * sw, my + 1.3);
  ctx.bezierCurveTo(-9.2 * sw, my + 0.9, -9.6 * sw, my - 0.8, -8.4 * sw, my - 2.2); ctx.bezierCurveTo(-6.4 * sw, my - 4.3, -2.2 * sw, my - 4.8, 0, my - 3.2); ctx.closePath();
  ctx.fillStyle = C(col); ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = INK; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
}

function frontBeard(ctx, look, g, C) {
  const R = g.R, fw = g.fw, my = g.mouthY, pal = g.pal, bd = look.beard;
  const bl = ((bd && bd.len) || 0) * 7, fl = (bd && bd.flare) || 0, cy = g.chinY;
  let right, upper;
  if (bd && bd.style === 'goatee') {                                    // a moustache joined to a chin patch
    right = [[11, my - 1.6], [11.6, my + 3.4], [9.8, cy - 3.8], [5.6, cy - 0.2 + bl * 0.3], [0, cy + 1.4 + bl * 0.55]];
    upper = [[-11, my - 1.6], [-6.4, my - 3.8], [0, my - 4.4], [6.4, my - 3.8], [11, my - 1.6]];
  } else {
    const src = R.slice(4), n0 = src.length;
    const out = src.map(([x, y], i) => [x + 0.55 + fl * 4.2 * Math.sin(Math.PI * (i + 0.5) / (n0 + 0.3)), y + 0.5]);
    const last = out.length - 1;
    out[last][0] = 0; out[last][1] += (bd ? 2.6 : 0) + bl * 0.55; if (last > 0) out[last - 1][1] += bl * 0.22;
    right = [[19.2 * fw, -7.5]].concat(out);
    upper = bd
      ? [[-17.6 * fw, -2.2], [-14.4 * fw, 3.4], [-10.8, my - 2.6], [-5.6, my - 4.2], [0, my - 4.6], [5.6, my - 4.2], [10.8, my - 2.6], [14.4 * fw, 3.4], [17.6 * fw, -2.2]]
      : [[-18.2 * fw, 3.2], [-9, my - 5.2], [0, my - 4.6], [9, my - 5.2], [18.2 * fw, 3.2]];
  }
  const full = right.concat(right.slice(1, -1).reverse().map(fMir));
  const shape = new Path2D();
  addSpline(shape, full, true); shape.lineTo(upper[0][0], upper[0][1]); addSpline(shape, upper, false); shape.closePath();
  if (bd) {
    const fg = ctx.createLinearGradient(0, my - 6, 0, cy + bl * 0.7 + 3);                      // cheeks in one colour, the chin can be greyer
    fg.addColorStop(0, C(bd.color)); fg.addColorStop(0.5, C(bd.color)); fg.addColorStop(1, C(bd.chin || bd.color));
    ctx.fillStyle = fg; ctx.fill(shape);
    ctx.save(); ctx.clip(shape);
    const bg = ctx.createLinearGradient(0, 0, 0, 34 + bl); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = bg; ctx.fillRect(-34, -4, 68, 70 + bl);
    ctx.lineWidth = bd.mix ? 0.7 : 0.55; ctx.strokeStyle = bd.mix ? rgba(bd.mix, 0.38) : 'rgba(255,255,255,.2)'; ctx.stroke(g.tex);
    ctx.translate(0.6, 0.7); ctx.lineWidth = 0.55; ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(g.tex);
    ctx.restore();
    const outl = new Path2D(); addSpline(outl, full, true);
    ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.globalAlpha = 0.8; ctx.stroke(outl); ctx.globalAlpha = 1;
    if (bd.style !== 'goatee') {                                                                // a trimmed patch around the mouth, so the lips are visible in the beard
      ctx.beginPath(); ctx.ellipse(0, my + 0.9, 8.6 * (look.mouthW || 1), 4.4, 0, 0, TAU); ctx.fillStyle = C(pal.skinD); ctx.fill();
    }
  } else {
    const st = look.stubble, hc = HEX.test(pal.hair) ? pal.hair : '#333333';
    ctx.save(); ctx.clip(g.face); ctx.clip(shape);
    ctx.fillStyle = rgba(hc, 0.07 + 0.11 * st); ctx.fillRect(-30, -10, 60, 60);
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(hc, 0.28 + 0.34 * st); ctx.stroke(g.tex);
    ctx.restore();
  }
}

function frontGlasses(ctx, look, ey, ex, eK, fw) {
  const gl = look.glasses, col = gl.color || '#222';
  const w = 9.8 * eK + 4.6, h = (gl.shape === 'round' ? 10 : 8.6) * (0.85 + 0.15 * eK);
  const lw = gl.lw || 1.25;
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round';
  for (const sg of [1, -1]) {
    const cx = sg * ex;
    ctx.beginPath();
    if (gl.shape === 'round') ctx.ellipse(cx, ey - 0.2, w / 2, h / 2, 0, 0, TAU); else { const r = 2.2; if (ctx.roundRect) ctx.roundRect(cx - w / 2, ey - 0.2 - h / 2, w, h, r); else ctx.rect(cx - w / 2, ey - 0.2 - h / 2, w, h); }
    ctx.fillStyle = 'rgba(190,225,255,.17)'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(cx - w * 0.28, ey - 0.2 - h * 0.28); ctx.lineTo(cx - w * 0.06, ey - 0.2 - h * 0.34); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(sg * (ex + w / 2), ey - 2.2); ctx.lineTo(sg * (20.6 * fw + 0.6), ey - 1.4); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-ex + w / 2, ey - 2.2); ctx.quadraticCurveTo(0, ey - 4, ex - w / 2, ey - 2.2); ctx.stroke();
}

function frontAgeLines(ctx, look, g, ey, ex) {
  const age = look.age || 0, bags = look.bags || 0, nw = g.nwq, my = g.mouthY, ny = g.noseY, fw = g.fw;
  const a = Math.max(age, 0.12);
  ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(70,30,25,${0.14 + 0.36 * a})`; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const sg of [1, -1]) {
    ctx.moveTo(sg * (3.6 + nw * 1.4), ny + 0.4); ctx.quadraticCurveTo(sg * (8.4 + nw), my - 3.5, sg * (8.8 + (look.mouthW || 1) * 3.4), my + 1.4);                  // nasolabial fold
    ctx.moveTo(sg * (ex + 5.6), ey - 0.8); ctx.lineTo(sg * (ex + 9), ey - 2.6); ctx.moveTo(sg * (ex + 5.8), ey + 0.6); ctx.lineTo(sg * (ex + 9.4), ey + 0.6);   // crow's feet
  }
  ctx.stroke();
  if (age > 0.3 || bags > 0.2) {
    ctx.strokeStyle = `rgba(70,30,25,${0.1 + 0.34 * Math.max(age, bags)})`;
    ctx.beginPath(); for (const sg of [1, -1]) { ctx.moveTo(sg * (ex - 4.6), ey + 4.1); ctx.quadraticCurveTo(sg * ex, ey + 5.9, sg * (ex + 4.8), ey + 3.9); } ctx.stroke();
  }
  if (age > 0.4) {
    ctx.strokeStyle = `rgba(70,30,25,${0.12 + 0.3 * age})`;
    ctx.beginPath(); ctx.moveTo(-9 * fw, -19.6); ctx.quadraticCurveTo(0, -21, 9 * fw, -19.6); ctx.moveTo(-8 * fw, -16.8); ctx.quadraticCurveTo(0, -18, 8 * fw, -16.8);
    ctx.moveTo(-1.6, ey - 8); ctx.lineTo(-1.2, ey - 11.2); ctx.moveTo(1.6, ey - 8); ctx.lineTo(1.2, ey - 11.2); ctx.stroke();                                      // forehead and frown lines
  }
  if (age > 0.55) {
    ctx.strokeStyle = `rgba(70,30,25,${0.1 + 0.26 * age})`;
    ctx.beginPath(); for (const sg of [1, -1]) { ctx.moveTo(sg * (9.6 + (look.mouthW || 1) * 3), my + 2.6); ctx.quadraticCurveTo(sg * 11.4, my + 7, sg * 9.2, g.chinY - 6.5); } ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the whole head
// ---------------------------------------------------------------------------------------------------------------
function drawFrontHead(ctx, look, p, C) {
  const g = frontGeo(look), pal = g.pal, fw = g.fw, H = g.hair, hs = H && H.hs;
  const eK = Math.min(1.34, faceK(look.eyeSize, 'eye')), ey = -5.2, ex = (9.2 + (eK - 1) * 3.6) * (look.eyeGap || 1) * (0.9 + 0.1 * fw);
  if (look.hat) { ctx.translate(0, 7); ctx.scale(0.86, 0.86); }              // the hat has to fit the circle
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (H && H.back) { ctx.fillStyle = C(pal.hairD); ctx.fill(H.back); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(H.back); }       // long hair behind
  frontBust(ctx, look, g, C);
  if (H && H.lockR) {
    for (const lk of [H.lockR, H.lockL]) {
      const lg = ctx.createLinearGradient(0, 0, 0, 44); lg.addColorStop(0, C(pal.hair)); lg.addColorStop(1, C(pal.hairD));
      ctx.fillStyle = lg; ctx.fill(lk); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(lk);
    }
  }

  // hair above and behind the ears (a bald crown): drawn first, so the ears stay in front of it
  if (H && H.sidesR) {
    for (const sp of [H.sidesR, H.sidesL]) { ctx.fillStyle = C(pal.hair); ctx.fill(sp); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke(sp); }
    ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(HEX.test(pal.hairL) ? pal.hairL : '#ffffff', 0.5); ctx.stroke(H.strands);
  }

  // ears (and the earring)
  const eEar = faceK(look.ear, 'ear'), eOut = (look.earOut || 0) * 2.2;
  for (const sg of [1, -1]) {
    ctx.save(); ctx.translate(sg * (20.4 * fw + 1.0 + eOut), 1.8); ctx.rotate(sg * (0.12 + eOut * 0.05));
    ctx.beginPath(); ctx.ellipse(0, 0, 2.7 * eEar, 5.3 * eEar, 0, 0, TAU); ctx.fillStyle = C(pal.skin); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sg * -0.1, 0.2, 1.1, 3 * eEar, 0, 0, TAU); ctx.fillStyle = C(pal.skinDD); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
    if (look.earring) { ctx.beginPath(); ctx.arc(0, 5.3 * eEar + 1.6, 1.6, 0, TAU); ctx.fillStyle = C(look.earring); ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  }

  // the face
  const gr = ctx.createRadialGradient(-4, -9, 3, 0, 0, 38);
  gr.addColorStop(0, C(pal.skinL)); gr.addColorStop(0.55, C(pal.skin)); gr.addColorStop(1, C(pal.skinD));
  ctx.fillStyle = gr; ctx.fill(g.face);
  ctx.save(); ctx.clip(g.face);
  let sg2 = ctx.createLinearGradient(-21 * fw, 0, 21 * fw, 0);
  sg2.addColorStop(0, 'rgba(50,20,15,.30)'); sg2.addColorStop(0.2, 'rgba(50,20,15,0)'); sg2.addColorStop(0.8, 'rgba(50,20,15,0)'); sg2.addColorStop(1, 'rgba(50,20,15,.30)');
  ctx.fillStyle = sg2; ctx.fillRect(-24, -34, 48, 64);
  sg2 = ctx.createLinearGradient(0, g.noseY, 0, g.chinY); sg2.addColorStop(0, 'rgba(90,35,25,0)'); sg2.addColorStop(1, 'rgba(90,35,25,.26)');
  ctx.fillStyle = sg2; ctx.fillRect(-24, g.noseY, 48, 40);
  const rdg = faceK(look.ridge, 'ridge');
  ctx.fillStyle = `rgba(80,30,20,${0.12 + 0.05 * (rdg - 1)})`; ctx.beginPath(); ctx.ellipse(0, ey - 3.6, 17 * fw, 3.2 + 0.7 * (rdg - 1), 0, 0, TAU); ctx.fill();      // the brow ridge
  ctx.fillStyle = look.female ? 'rgba(235,110,110,.2)' : 'rgba(232,120,110,.14)';
  for (const sg of [1, -1]) { ctx.beginPath(); ctx.ellipse(sg * 12.2 * fw, 6.4, 5.4, 3.6, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.ellipse(-3, -17, 8, 3.4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(g.face);

  frontAgeLines(ctx, look, g, ey, ex);
  if (look.beard || look.stubble) frontBeard(ctx, look, g, C);
  frontNose(ctx, look, g, ey);
  frontMouth(ctx, look, g, p, C);
  if (look.stache || look.beard) frontStache(ctx, look, g, C);
  frontEyes(ctx, look, p, C, ey, ex, eK);
  frontBrows(ctx, look, g, p, C, ey, ex, eK);
  if (look.glasses) frontGlasses(ctx, look, ey, ex, eK, fw);

  // hair on top
  if (H && H.cap) {
    const hg = ctx.createLinearGradient(-16, -32, 12, -8); hg.addColorStop(0, C(pal.hairL)); hg.addColorStop(0.45, C(pal.hair)); hg.addColorStop(1, C(pal.hairD));
    ctx.save();
    if (hs.buzz || hs.thin) ctx.globalAlpha = hs.buzz ? 0.82 : 0.9;
    ctx.fillStyle = hg; ctx.fill(H.cap);
    ctx.globalAlpha = 1;
    ctx.lineWidth = hs.buzz ? 0.9 : 1.4; ctx.strokeStyle = INK; ctx.stroke(H.sil);
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(30,14,8,.5)'; ctx.stroke(H.hln);
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(HEX.test(pal.hairD) ? pal.hairD : '#333333', 0.75); ctx.stroke(H.ticks);
    ctx.lineWidth = look.hair.mix ? 0.9 : 0.7; ctx.strokeStyle = look.hair.mix ? rgba(look.hair.mix, 0.45) : rgba(HEX.test(pal.hairL) ? pal.hairL : '#ffffff', hs.long ? 0.3 : 0.42); ctx.stroke(H.strands);
    ctx.restore();
  }
  if (look.hair && (look.hair.style === 'none' || look.hair.style === 'sides')) {                                          // a bald crown shines
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-4, -22.6, 9, 3, -0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(8, -19.6, 4, 1.6, 0.2, 0, TAU); ctx.fill();
  }

  // kippah
  if (look.kippah) {
    const kc = look.kippah, big = (kc.knit ? 1.12 : 1.18) * (kc.s || 1);
    ctx.save(); ctx.translate(2.2, -25); ctx.rotate(-0.08);
    ctx.beginPath(); ctx.ellipse(0, 0, 9 * big, (kc.knit ? 4.5 : 3.7), 0, 0, TAU); ctx.fillStyle = C(kc.color); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
    if (kc.knit) {
      ctx.strokeStyle = C(kc.knit); ctx.lineWidth = 0.95;
      ctx.beginPath(); ctx.ellipse(0, 0, 6.8 * big, 2.9 * big, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 3.6 * big, 1.5 * big, 0, 0, TAU); ctx.stroke();
    } else { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.ellipse(-2, -1.4, 5.2, 1.4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // black brimmed hat
  if (look.hat) {
    const hc = look.hat.color || '#121118';
    ctx.save(); ctx.translate(0, -21);
    ctx.beginPath(); ctx.ellipse(0, 0.6, 30, 6.6, 0, 0, TAU);
    const bg = ctx.createLinearGradient(0, -6, 0, 7); bg.addColorStop(0, C(lighten(hc, 0.16))); bg.addColorStop(1, C(darken(hc, 0.1)));
    ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-17.6, 0.2); ctx.bezierCurveTo(-18.8, -13, -14.5, -20.6, -4, -20.9); ctx.quadraticCurveTo(0, -17.8, 4, -20.9); ctx.bezierCurveTo(14.5, -20.6, 18.8, -13, 17.6, 0.2); ctx.closePath();
    const cg = ctx.createLinearGradient(-18, -20, 18, 0); cg.addColorStop(0, C(lighten(hc, 0.22))); cg.addColorStop(0.5, C(hc)); cg.addColorStop(1, C(darken(hc, 0.2)));
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C(lighten(hc, 0.3)); ctx.globalAlpha = 0.3; ctx.fillRect(-17.6, -6.4, 35.2, 3.4); ctx.globalAlpha = 1;      // the band
    ctx.restore();
  }
}

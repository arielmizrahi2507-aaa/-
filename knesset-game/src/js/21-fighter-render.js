// ===== Fighter renderer: adult proportions, shaded clothes and limbs, a detailed 3/4-view face =====
// Poses come from 20-fighter-draw.js (joints in "rig" units, feet at the origin, +x forward, -y up). The rig is painted
// BODY_S times larger; the head is drawn in its own units (about 44 tall) and scaled by HEAD_K.

const INK = '#0e0d11';          // outline ink
const BODY_S = 1.1;             // on-screen scale of the rig
const HEAD_K = 0.9;             // head drawing units -> rig units
const LIGHT = [0.5, -0.85];     // key light: from the front and above

// ---------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------
// Catmull-Rom spline through points, appended to a Path2D
function addSpline(path, pts, first) {
  const n = pts.length;
  if (first) path.moveTo(pts[0][0], pts[0][1]); else path.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
function spline(pts, closed) {
  const p = new Path2D(), n = pts.length;
  if (!closed) { addSpline(p, pts, true); return p; }
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  p.closePath();
  return p;
}
function toRGBA(c) {
  if (c[0] === '#') { const v = rgb(c); return [v[0], v[1], v[2], 1]; }
  const m = c.match(/[\d.]+/g);
  return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
}
function flashMix(c, t) {
  const a = toRGBA(c);
  return `rgba(${Math.round(a[0] + (255 - a[0]) * t)},${Math.round(a[1] + (255 - a[1]) * t)},${Math.round(a[2] + (255 - a[2]) * t)},${a[3]})`;
}
const HEX = /^#[0-9a-f]{3,6}$/i;
const tone = (c, t) => (t >= 0 ? lighten(c, t) : darken(c, -t));

// A tapered limb through 2-3 points with a cylinder-ish shading. `pts` and `ws` (widths) have the same length.
function tube(ctx, pts, ws, col, ink, o = {}) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const h = ws[i] / 2;
    L.push([pts[i][0] - dy * h, pts[i][1] + dx * h]); R.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
  }
  const e = pts[n - 1], s0 = pts[0], he = ws[n - 1] / 2, hs = ws[0] / 2;
  const aE = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]), aS = Math.atan2(R[0][1] - s0[1], R[0][0] - s0[0]);
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  ctx.arc(e[0], e[1], he, aE, aE - Math.PI, true);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.arc(s0[0], s0[1], hs, aS, aS - Math.PI, true);
  ctx.closePath();
  if (n > 2) { ctx.moveTo(pts[1][0] + ws[1] / 2, pts[1][1]); ctx.arc(pts[1][0], pts[1][1], ws[1] / 2, 0, TAU, true); }
  ctx.lineWidth = o.ow || 1.7; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = col; ctx.fill();
  if (o.flat) return;
  ctx.save(); ctx.clip();
  const w = ws[0];
  // shadow side, then a soft highlight on the lit side
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((q, i) => { const x = q[0] - LIGHT[0] * w * 0.3, y = q[1] - LIGHT[1] * w * 0.3; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.lineWidth = w * 0.5; ctx.strokeStyle = 'rgba(8,4,24,.24)'; ctx.stroke();
  if (!o.noHl) {
    ctx.beginPath(); pts.forEach((q, i) => { const x = q[0] + LIGHT[0] * w * 0.2, y = q[1] + LIGHT[1] * w * 0.2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.lineWidth = w * 0.26; ctx.strokeStyle = 'rgba(255,255,255,.17)'; ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// per-person geometry (cached): head outline, hair, beard, colour palette
// ---------------------------------------------------------------------------------------------------------------
const HAIR_DEF = {
  swoop: {   // full, brushed back, receding temples
    outer: [[15.5, -12.5], [15, -17.5], [10, -23.8], [2, -26.4], [-8, -25.4], [-15.5, -19.6], [-19.6, -10.5], [-20.2, -1], [-18.5, 7], [-14.5, 11.5]],
    line: [[-11.5, 9], [-11.2, 2.5], [-11.6, -3], [-9, -9.5], [-3.5, -13.4], [3, -15], [9, -15], [13.4, -13.4]],
    strands: ['M 12 -14.5 Q 5 -23 -7 -23.6', 'M 8.5 -15 Q 0 -21 -12 -20', 'M 3 -15 Q -5 -19 -15 -15.5', 'M -4 -12.5 Q -10 -17 -17.6 -10', 'M 11 -18 Q 6 -24 -3 -25.8'],
  },
  crop: {    // short, tight
    outer: [[15.4, -12], [14.8, -16.8], [9.4, -22.6], [1.6, -24.4], [-8, -23.4], [-15, -18.4], [-18.8, -9.5], [-19.2, -1], [-17.6, 6.5], [-14, 10.5]],
    line: [[-11, 8.5], [-10.6, 2], [-11, -3.5], [-8, -9.5], [-2, -13.4], [4, -15.4], [10, -15.6], [14.4, -14]],
    strands: ['M 12 -15 Q 5 -21 -6 -22', 'M 6 -15.6 Q -1 -20 -11 -19', 'M -4 -13 Q -10 -16 -16 -11'],
  },
  part: {    // side parting with a lifted front
    outer: [[16.2, -10.5], [15.8, -17.6], [10.6, -24], [2.6, -26.2], [-7, -25.2], [-14.6, -19.6], [-19, -10.5], [-19.6, -1], [-18, 6.5], [-14.5, 10.8]],
    line: [[-11, 8.6], [-10.8, 2], [-11, -3], [-7.8, -9.4], [-1.5, -13.4], [5, -15.4], [10.6, -16.6], [15, -14.4]],
    strands: ['M 13 -16 Q 6 -22.5 -5 -23.5', 'M 9 -16.4 Q 1 -21 -10 -20.2', 'M 4 -15 Q -4 -18 -14 -15'],
    part: 'M 9 -25.8 Q 8.4 -20 10 -16.6',
  },
  sides: {   // bald crown, hair only at the back and above the ears
    outer: [[-8.6, -21.6], [-13, -19.8], [-17.6, -15], [-19.8, -8], [-20.2, -1], [-18.6, 7], [-14.6, 11.6]],
    line: [[-11.2, 8], [-11, 1], [-10.4, -6], [-9.6, -13.4]],
    strands: ['M -10 -18 Q -16 -12 -17 -3', 'M -11.5 -8 Q -14 0 -14.5 6'],
  },
  wavy: {    // long hair with a swept fringe
    outer: [[17, -10], [16, -17.4], [9.4, -24.4], [0, -27], [-10, -24.6], [-17.4, -16.4], [-20.6, -4], [-19.6, 8], [-15, 12]],
    line: [[-11.4, 9], [-11.6, 0.6], [-9.2, -8], [-3, -14.2], [4, -17.4], [10.4, -16.6], [15.4, -13.4]],
    strands: ['M 14 -15 Q 6 -23.5 -6 -24.5', 'M 9 -16.8 Q 0 -22 -12 -21', 'M 4 -17 Q -6 -20 -16 -15', 'M -6 -14 Q -14 -12 -18 -3'],
    back: [[-9, -22], [-21, -19], [-27, -5], [-27.6, 12], [-24.6, 27], [-19, 35], [-12, 34], [-8.6, 23], [-8, 10]],
  },
  layered: { // shoulder-length, full and lifted at the crown, a long fringe swept forward, the ends flicked out
    outer: [[17.2, -10.5], [16.8, -18.2], [10.4, -26.4], [0, -29], [-11.4, -26.4], [-19.4, -17.6], [-23.4, -4], [-22.8, 10], [-17.6, 14.4]],
    line: [[-11.4, 9], [-11.8, 0.6], [-9.4, -8.6], [-3, -14.6], [4.4, -16.4], [11.4, -14.4], [16.2, -10.6]],
    strands: ['M 15.4 -12.5 Q 6.5 -24.5 -7 -26.2', 'M 10.6 -13.4 Q 0.5 -22.4 -13.5 -22', 'M 5 -14.6 Q -6 -20 -18 -16', 'M -7 -13.4 Q -16.5 -10.5 -20.6 1'],
    back: [[-9, -23.5], [-23.5, -21], [-31.5, -6], [-32.6, 11], [-31.4, 22], [-35.4, 32.4], [-27.4, 34.4], [-18.6, 31], [-10.4, 24], [-8, 10]],
  },
  buzz: {    // cropped very close to the skull
    outer: [[15, -12], [14.6, -16.2], [9, -21.9], [1.6, -23.4], [-8, -22.4], [-14.4, -17.6], [-18.5, -9.5], [-18.9, -1], [-17.4, 6.4], [-13.9, 10.3]],
    line: [[-11, 8.5], [-10.6, 2], [-10.8, -3.5], [-8, -9.8], [-2, -13.8], [4, -15.6], [10, -15.8], [14.4, -14]],
    strands: ['M 11 -15.5 Q 5 -20.5 -5 -21.3', 'M -4 -13.5 Q -10 -16 -15.6 -11'],
  },
  comb: {    // medium length, combed straight back and down over the ear
    outer: [[15.5, -12.5], [15, -18], [9.6, -24.2], [1, -26.6], [-9, -25.6], [-17, -19.6], [-21.6, -9.5], [-22.2, 0], [-20.5, 9], [-16, 13.5]],
    line: [[-12, 10.5], [-11.6, 3], [-11.6, -3], [-9, -9.8], [-3.5, -13.6], [3, -15.2], [9, -15.4], [13.6, -13.8]],
    strands: ['M 12 -15 Q 4 -24 -8 -24', 'M 8 -15.6 Q -2 -22 -14 -20', 'M 2 -15 Q -6 -19 -18 -14', 'M -6 -12.5 Q -14 -14 -20 -6'],
  },
  thin: {    // thin on top, the hairline far back
    outer: [[14.6, -12], [13.8, -16.8], [8.6, -21.6], [1.2, -23.2], [-7.4, -22.4], [-13.8, -17.6], [-18, -9.5], [-18.6, -1], [-17, 6.4], [-13.6, 10.4]],
    line: [[-11, 8.4], [-10.8, 2], [-11.2, -3], [-8.8, -8.6], [-3.4, -11.6], [1.8, -13.2], [6.2, -13.4], [9.4, -12.4]],
    strands: ['M 6 -14 Q 0 -19 -8 -20', 'M -4 -12 Q -10 -15 -15 -10'],
  },
  curly: {   // short, dense curls: a bumpy outline
    outer: [[16, -12], [15.8, -17], [12.6, -22.6], [8, -24.8], [3.2, -25.4], [-2, -26.4], [-7, -25.6], [-12, -23.4], [-16, -19.6], [-19.4, -14.6], [-20.6, -8], [-20.4, -1], [-19, 6], [-14.8, 10.4]],
    line: [[-11, 8.5], [-10.6, 2], [-11, -3.5], [-8, -9.5], [-2, -13.4], [4, -15.4], [10, -15.6], [14.4, -14]],
    strands: ['M 11 -19 q 1.8 -2.2 3.6 0', 'M 6 -21.5 q 1.8 -2.2 3.6 0', 'M 0 -22.5 q 1.8 -2.2 3.6 0', 'M -6 -21.5 q 1.8 -2.2 3.6 0', 'M -12 -18 q 1.8 -2.2 3.6 0', 'M -15 -11 q 1.8 -2.2 3.6 0'],
  },
  bob: {     // chin-length hair with a swept fringe
    outer: [[17, -10], [16, -17.4], [9.4, -24.4], [0, -27], [-10, -24.6], [-17.4, -16.4], [-20.6, -4], [-19.6, 8], [-15, 12]],
    line: [[-11.4, 9], [-11.6, 0.6], [-9.2, -8], [-3, -14.2], [4, -17.4], [10.4, -16.6], [15.4, -13.4]],
    strands: ['M 14 -15 Q 6 -23.5 -6 -24.5', 'M 9 -16.8 Q 0 -22 -12 -21', 'M 4 -17 Q -6 -20 -16 -15', 'M -6 -14 Q -14 -12 -18 -3'],
    back: [[-9, -22], [-21, -19], [-26.4, -5], [-26.6, 7], [-24, 16], [-18, 19.4], [-11.6, 17.6], [-8.6, 10]],
  },
  none: null,
};
HAIR_DEF.spiky = HAIR_DEF.crop;           // the drawn profile has no spikes; the front portrait does

const GEO = new WeakMap();
function geo(look) {
  let g = GEO.get(look);
  if (g) return g;
  const G = faceK;
  const nk = G(look.nose, 'nose'), jk = G(look.jaw, 'jaw');
  const fw = Math.max(0.84, Math.min(1.24, G(look.fw, 'fw'))), chk = G(look.cheek, 'cheek'), chn = G(look.chin, 'chin'), fore = G(look.fore, 'fore'), rdg = G(look.ridge, 'ridge'), lp = G(look.lips, 'lips'), jl = (look.jowl || 0) * FACE_GAIN, nl = G(look.noseL, 'noseL'), nw = G(look.noseW, 'noseW');
  const ln = (look.len || 1) - 1, br = look.bridge || 0, td = look.noseT || 0;         // ln: a longer (or shorter) lower face; br: bump on the nose; td: drooping tip
  const nq = Math.max(0.75, Math.min(1.65, (nk + nl) / 2)), nwq = Math.max(0.75, Math.min(1.5, (nk + nw) / 2));      // nose length / width
  const tipX = 19.6 + 3.3 * nq, tipY = 5.2 + 1.5 * (nq - 1) + td * 1.5;
  const J = (x) => (x < 6 ? x * jk : x);
  const bk = 1 + (fw - 1) * 0.55;                       // head depth follows the head width
  const Ly = (y) => y + ln * 9 * sstep(6, 17, y);       // the lower face is longer (or shorter)
  const face = spline([
    [-9 * bk, Ly(15.5)], [-14.6 * bk, Ly(10)], [-18 * bk, 2], [-18.7 * bk, -6], [-16.2 * bk, -14.5], [-9 * bk, -20.6 - (fore - 1) * 1.6], [0, -22.6 - (fore - 1) * 2.6], [8.6, -20.8 - (fore - 1) * 2.4], [14.2 + (fore - 1) * 1.1, -16 - (fore - 1) * 1.4], [16.4 + (fore - 1) * 1.2, -10], [16.7 + (fore - 1) * 1.0, -5.6],
    [16.2 + (rdg - 1) * 1.3, -2.8], [18.2 + br * 1.1, 0.4 - br * 0.3], [20.6 + br * 0.5, 3.4 + td * 0.3], [tipX, tipY], [tipX - 0.5, tipY + 1.9 * nwq], [tipX - 3.4, tipY + 3.1 * nwq + td * 0.4],
    [19 + (lp - 1) * 1.0, 9.5], [19.6 + (lp - 1) * 1.2, 11.2], [18.8 + (lp - 1) * 0.7, 12.5], [19.2 + (chn - 1) * 1.6, Ly(13.9) + (chn - 1) * 0.5], [17.7 + (chn - 1) * 2.0, Ly(15.9) + (chn - 1) * 1.0], [17.5 + (chn - 1) * 1.8, Ly(18.3) + (chn - 1) * 1.4 + jl * 0.6], [14.4, Ly(21) + (chn - 1) * 0.8 + jl * 1.6 + (chk - 1) * 0.8], [J(7), Ly(21.7) + jl * 1.8 + (chk - 1) * 0.8], [J(0), Ly(19.7) + jl * 1.2], [J(-5), Ly(17.6) + jl * 0.8],
  ], true);
  const beardZone = spline([[-8, 1.5], [-2, 4.6], [4.5, 7], [9.6, 9.2], [12, 11.4], [11.6, 14], [14, 15.5], [17.2, 15.8], [19.2, 15.3], [19.8, 17.6 + ln * 4 + (chn - 1) * 0.6], [17.8, 21.6 + ln * 9 + (chn - 1) * 1.2], [13, 23.8 + ln * 9 + (chn - 1) * 1.2], [6.5, 24.4 + ln * 9 + (chn - 1) * 1.2], [0, 22.4 + ln * 8], [-5.4, 17.8 + ln * 5], [-9.2, 10]], true);
  const goatee = spline([[9.6, 13.4], [14, 14.2], [17.4, 14.4], [19.4, 14.4], [19.8, 17.6 + ln * 4 + (chn - 1) * 0.6], [17.8, 21.6 + ln * 9 + (chn - 1) * 1.2], [13, 23.8 + ln * 9 + (chn - 1) * 1.2], [6.5, 24.4 + ln * 9 + (chn - 1) * 1.2], [2.4, 22.4 + ln * 8], [2.6, 17]], true);   // a chin patch only
  const stache = spline([[10.6, 10.4], [15, 9.2], [19.6, 9.7], [20, 11.2], [17, 12.2], [13.4, 12]], true);
  const tex = new Path2D();
  for (let i = 0, a = 12345; i < 120; i++) {
    const rn = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const x = -9 + rn() * 29, y = 1 + rn() * 24, an = 1.0 + (rn() - 0.5) * 0.9, ln = 1.2 + rn() * 1.5;
    tex.moveTo(x, y); tex.lineTo(x + Math.cos(an) * ln, y + Math.sin(an) * ln);
  }
  let hd = look.hair && HAIR_DEF[look.hair.style];
  let hair = null;
  if (hd) {
    const hl = look.hair.hl || 0, vol = look.hair.vol || 1;
    if (hl > 0.02 || Math.abs(vol - 1) > 0.05) {          // hl: the hairline moves back and up; vol: the hair is fuller (or flatter)
      const vk = 1 + (vol - 1) * 0.16;
      hd = Object.assign({}, hd, {
        outer: hd.outer.map(([x, y]) => [-2 + (x + 2) * vk, -8 + (y + 8) * vk]),
        line: hd.line.map(([x, y]) => { const t = sstep(-5, 10, x); return [x - hl * 16 * t, y - hl * 30 * t]; }),
      });
    }
    const band = new Path2D(); addSpline(band, hd.outer, true); addSpline(band, hd.line, false); band.closePath();
    hair = { band, strands: hd.strands.map((s) => new Path2D(s)), part: hd.part ? new Path2D(hd.part) : null, back: hd.back ? spline(hd.back, true) : null };
  }
  const sk = look.skin, hc = look.hair ? look.hair.color : '#333';
  const pal = {
    skin: sk, skinL: lighten(sk, 0.2), skinD: darken(sk, 0.13), skinDD: darken(sk, 0.32),
    suit: look.suit, suitL: lighten(look.suit, 0.13), suitD: darken(look.suit, 0.2), suitDD: darken(look.suit, 0.4),
    pants: look.pants || look.suit, pantsD: darken(look.pants || look.suit, 0.2), pantsL: lighten(look.pants || look.suit, 0.1),
    shirt: look.shirt || '#ffffff', shirtD: darken(look.shirt || '#ffffff', 0.14),
    tie: look.tie, tieD: look.tie ? darken(look.tie, 0.3) : null,
    hair: hc, hairL: lighten(hc, 0.28), hairD: darken(hc, 0.32),
    brow: look.browColor || darken(hc, 0.28),
    shoe: look.shoes || '#1d1b27', shoeD: darken(look.shoes || '#1d1b27', 0.35),
    lip: look.lip || (look.female ? '#b8425c' : mix(sk, '#9a4a48', 0.5)),
  };
  g = { face, beardZone: look.beard && look.beard.style === 'goatee' ? goatee : beardZone, stache, tex, hair, pal, tipX, tipY };
  GEO.set(look, g);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// the head (origin = head centre, face towards +x)
// ---------------------------------------------------------------------------------------------------------------
function drawEye(ctx, x, y, s, kind, look, C, lookX, far) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const female = !!look.female;
  const closed = kind === 'blink' || kind === 'happy' || kind === 'hurt' || kind === 'ko';
  if (closed) {
    ctx.lineWidth = kind === 'hurt' ? 1.5 : 1.1; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    ctx.beginPath();
    if (kind === 'happy') { ctx.moveTo(-4.3, 0.9); ctx.quadraticCurveTo(0, -2.7, 4.3, 0.9); }
    else if (kind === 'hurt') { ctx.moveTo(-4.4, -0.5); ctx.quadraticCurveTo(0, 2.6, 4.4, -0.6); ctx.moveTo(-2.4, 1.2); ctx.lineTo(-3.6, 2.3); ctx.moveTo(1, 1.7); ctx.lineTo(0.8, 3); }
    else if (kind === 'ko') { ctx.moveTo(-4.3, -0.5); ctx.quadraticCurveTo(0, 1.8, 4.3, -0.5); }
    else { ctx.moveTo(-4.3, 0.2); ctx.quadraticCurveTo(0, 1.4, 4.3, 0.2); }
    ctx.stroke();
    ctx.restore();
    return;
  }
  const squash = kind === 'squint' ? 0.5 : kind === 'angry' ? 0.82 : 1;
  ctx.scale(1, squash);
  ctx.beginPath(); ctx.moveTo(-4.4, 0.3); ctx.bezierCurveTo(-2.9, -3.1, 2.7, -3.3, 4.4, -0.4); ctx.bezierCurveTo(3, 2.2, -2.3, 2.3, -4.4, 0.3); ctx.closePath();
  ctx.fillStyle = C('#f4f1ec'); ctx.fill();
  ctx.save(); ctx.clip();
  const ix = clamp(lookX, -1, 1.3) * 1.5 + 0.4;
  ctx.fillStyle = C(look.iris || '#4a3626'); ctx.beginPath(); ctx.arc(ix, -0.2, 2.35, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0b0710'; ctx.beginPath(); ctx.arc(ix + 0.15, -0.2, 1.15, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(ix + 0.9, -1, 0.65, 0, TAU); ctx.fill();
  // eyelid shadow
  const lg = ctx.createLinearGradient(0, -3.3, 0, 1.5); lg.addColorStop(0, 'rgba(60,20,15,.42)'); lg.addColorStop(0.5, 'rgba(60,20,15,0)');
  ctx.fillStyle = lg; ctx.fillRect(-5, -4, 10, 6);
  ctx.restore();
  ctx.scale(1, 1 / squash);
  if (kind === 'angry') { // heavy upper lid slanting down towards the nose
    ctx.fillStyle = C(look.skin); ctx.beginPath(); ctx.moveTo(-5.2, -4.4); ctx.lineTo(5.2, -4.4); ctx.lineTo(5.2, -0.9); ctx.lineTo(-5.2, -2.6); ctx.closePath(); ctx.fill();
  }
  if (look.lid > 0.05) {  // a heavy, drooping upper lid (look.lid 0..1) that covers part of the eye
    const ly = -2.6 + look.lid * 2.7;
    ctx.fillStyle = C(look.skin); ctx.beginPath(); ctx.moveTo(-5.4, -5); ctx.lineTo(5.4, -5); ctx.lineTo(5.4, -0.4); ctx.quadraticCurveTo(0.6, ly * 1.35 + 0.3, -5.4, -1.4 + look.lid * 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,24,18,.45)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-5.2, -2.9 + look.lid * 0.3); ctx.quadraticCurveTo(0, ly * 1.35 - 1.4, 5.3, -2.0); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = female ? 1.5 : 1.15;
  ctx.beginPath(); ctx.moveTo(-4.8, 0.5); ctx.bezierCurveTo(-3, -3.4 * squash - 0.2, 2.9, -3.6 * squash - 0.2, 4.8, -0.5);
  if (kind === 'angry') { ctx.moveTo(-5, -2.4); ctx.lineTo(5, -0.9); }
  ctx.stroke();
  if (female && !far) { ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-4.4, 0); ctx.lineTo(-6, -1.6); ctx.moveTo(-3.4, -1.7); ctx.lineTo(-4.6, -3.4); ctx.moveTo(4.6, -0.6); ctx.lineTo(6, -2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(70,30,25,.28)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-3.6, 1.7); ctx.quadraticCurveTo(0, 3, 3.8, 1.4); ctx.stroke();
  ctx.restore();
}

function drawMouth(ctx, m, g, C, look) {
  const pal = g.pal, lip = pal.lip, female = !!look.female;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dark = '#3d1019';
  const lk = 0.7 + 0.3 * faceK(look.lips, 'lips'), mw = look.mouthW || 1;              // thicker or thinner lips, wider or narrower mouth
  const lipsShut = () => {
    ctx.fillStyle = lip; ctx.globalAlpha = female ? 0.9 : 0.5 + 0.12 * (lk - 1);
    ctx.beginPath(); ctx.ellipse(15.8, 14.1, 3.7 * mw, 1.55 * lk, 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15.9, 11.5, 3.6 * mw, 1.1 * lk, -0.04, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  };
  ctx.strokeStyle = 'rgba(38,12,14,.85)'; ctx.lineWidth = 0.95;
  if (m === 'closed') { lipsShut(); ctx.beginPath(); ctx.moveTo(11.4, 12.3); ctx.quadraticCurveTo(15.5, 13.3, 19.3, 12.5); ctx.stroke(); }
  else if (m === 'smile') { lipsShut(); ctx.beginPath(); ctx.moveTo(10.7, 11.2); ctx.quadraticCurveTo(15.6, 15, 19.4, 12.4); ctx.stroke(); }
  else if (m === 'sad') { lipsShut(); ctx.beginPath(); ctx.moveTo(11.2, 13.8); ctx.quadraticCurveTo(15.5, 11.2, 19.2, 13); ctx.stroke(); }
  else if (m === 'o') {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(17.2, 13.1, 2.3, 3.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = lip; ctx.lineWidth = 1.3; ctx.stroke();
  } else if (m === 'grin') {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(10.6, 11.2); ctx.quadraticCurveTo(15.2, 16.6, 19.6, 12); ctx.quadraticCurveTo(15, 12.8, 10.6, 11.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C('#f6f2ea'); ctx.beginPath(); ctx.moveTo(11.3, 11.5); ctx.quadraticCurveTo(15.2, 13.3, 19.3, 12.2); ctx.lineTo(19.1, 13.8); ctx.quadraticCurveTo(15.2, 14.6, 11.8, 12.9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10.6, 11.2); ctx.quadraticCurveTo(15.2, 16.6, 19.6, 12); ctx.stroke();
  } else { // open / shout
    const big = m === 'shout' ? 1 : 0.72;
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(11, 10.8); ctx.quadraticCurveTo(15, 11.7, 19.5, 11.4);
    ctx.quadraticCurveTo(19.2, 12 + 7 * big, 14.4, 11.6 + 6.8 * big); ctx.quadraticCurveTo(10.4, 11 + 5.8 * big, 11, 10.8); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = C('#f6f2ea'); ctx.beginPath(); ctx.moveTo(10.5, 10.4); ctx.quadraticCurveTo(15.5, 12.2, 20, 11.6); ctx.lineTo(20, 13.4); ctx.quadraticCurveTo(15.5, 14.2, 11, 12.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c85a6c'; ctx.beginPath(); ctx.ellipse(15.2, 11.9 + 6.2 * big, 3.4, 1.9 * big + 0.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lip; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(11, 10.8); ctx.quadraticCurveTo(15, 11.7, 19.5, 11.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(19.5, 11.6); ctx.quadraticCurveTo(19.2, 12 + 7 * big, 14.4, 11.6 + 6.8 * big); ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, f, look, p, C, o = {}) {
  const g = geo(look), pal = g.pal, hs = (look.head || 1) * 1.14;                   // a caricature's head is big: the face stays readable on a phone
  const age = look.age || 0;
  ctx.save();
  if (hs !== 1) ctx.scale(hs, hs);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // long hair behind the head
  if (g.hair && g.hair.back) {
    ctx.fillStyle = C(pal.hairD); ctx.fill(g.hair.back);
    ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke(g.hair.back);
  }
  // face
  const gr = ctx.createRadialGradient(9, -6, 3, 3, 1, 34);
  gr.addColorStop(0, C(pal.skinL)); gr.addColorStop(0.5, C(pal.skin)); gr.addColorStop(1, C(pal.skinD));
  ctx.fillStyle = gr; ctx.fill(g.face);
  ctx.save(); ctx.clip(g.face);
  let sg = ctx.createLinearGradient(0, 4, 0, 22); sg.addColorStop(0, 'rgba(90,35,25,0)'); sg.addColorStop(1, 'rgba(90,35,25,.3)');
  ctx.fillStyle = sg; ctx.fillRect(-20, 4, 44, 20);
  sg = ctx.createLinearGradient(-19, 0, -3, 0); sg.addColorStop(0, 'rgba(50,20,15,.3)'); sg.addColorStop(1, 'rgba(50,20,15,0)');
  ctx.fillStyle = sg; ctx.fillRect(-20, -24, 18, 48);
  ctx.fillStyle = 'rgba(80,30,20,.16)'; ctx.beginPath(); ctx.ellipse(9.5, -6.4, 8.6, 2.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(232,120,110,.16)'; ctx.beginPath(); ctx.ellipse(9.4, 6.6, 5.4, 3.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.ellipse(11.5, -13.5, 5, 3, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(g.face);
  // ear
  const eK = faceK(look.ear, 'ear');
  ctx.beginPath(); ctx.ellipse(-5.4, 3.6, 2.9 * eK, 4.7 * eK, 0.14, 0, TAU);
  ctx.fillStyle = C(pal.skin); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6.2, 1); ctx.quadraticCurveTo(-3.6, 2.6, -5, 6.4); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(80,30,22,.5)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-5.2, 3.9, 1.2, 2.4, 0.14, 0, TAU); ctx.fillStyle = C(pal.skinDD); ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;

  // nose
  const tx = g.tipX, ty = g.tipY;
  ctx.strokeStyle = 'rgba(80,30,22,.4)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(tx - 5.2, ty - 2.2); ctx.quadraticCurveTo(tx - 6.6, ty + 1.6, tx - 3.8, ty + 3.2); ctx.stroke();
  ctx.fillStyle = 'rgba(46,14,10,.6)'; ctx.beginPath(); ctx.ellipse(tx - 3.5, ty + 2.2, 1.6, 0.85, 0.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(17.4, -2.2); ctx.lineTo(tx - 1.6, ty - 1.4); ctx.stroke();

  // stubble / beard / moustache (under the mouth and eyes)
  if (look.beard) {
    const bc = look.beard.color;
    ctx.fillStyle = C(bc); ctx.fill(g.beardZone);
    ctx.save(); ctx.clip(g.beardZone);
    const bgd = ctx.createLinearGradient(0, 2, 0, 24); bgd.addColorStop(0, 'rgba(0,0,0,0)'); bgd.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = bgd; ctx.fillRect(-12, 0, 36, 26);
    ctx.lineWidth = 0.55; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke(g.tex);
    ctx.translate(0.6, 0.7); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(g.tex);
    ctx.restore();
    ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.globalAlpha = 0.7; ctx.stroke(g.beardZone); ctx.globalAlpha = 1;
  } else if (look.stubble) {
    ctx.save(); ctx.clip(g.face); ctx.clip(g.beardZone);
    const st = look.stubble, hc = pal.hair.length === 7 ? pal.hair : '#333333';
    ctx.fillStyle = rgba(hc, 0.07 + 0.1 * st); ctx.fillRect(-12, 0, 36, 26);
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(hc, 0.3 + 0.35 * st); ctx.stroke(g.tex);
    ctx.restore();
  }

  // eyes + brows
  const e = p.eyes;
  const lx = clamp(f.lookDir || 0, -1, 1) * 0.6 + 0.6;
  const eS = faceK(look.eyeSize, 'eye');
  drawEye(ctx, 14.9, -3.7, 0.66 * eS, e, look, C, lx, true);
  drawEye(ctx, 8.4, -3.6, eS, e, look, C, lx, false);
  const bw = look.brow || 2.5;
  const bcol = C(pal.brow);
  const ang = e === 'angry' ? 1 : e === 'hurt' ? -1 : e === 'squint' ? 0.5 : e === 'happy' ? -0.15 : 0;
  const arch = look.browArch || 0, tilt = look.browTilt || 0, bl = look.browLen || 1;     // arch: higher in the middle; tilt > 0: the inner end sits lower (stern)
  // a brow is a filled tapered shape: thick at the inner end, thinning towards the tail (quadratic curve p0 -> p1 through c)
  const browShape = (x0, y0, cx, cy, x1, y1, w0, w1) => {
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
  ctx.fillStyle = bcol; ctx.strokeStyle = bcol; ctx.lineJoin = 'round';
  const hurt = e === 'hurt' ? -2 : 0;
  browShape(2.8, -8.8 - ang * -1.4 + tilt * 1.1, 8.4, -11.4 - arch * 1.8 - (ang < 0 ? 1.2 : 0) + ang * 0.6, 14 * bl, -8.2 + ang * 2.6 - tilt * 0.9 + hurt, bw * 1.05, bw * 0.5);
  browShape(15.2, -8.6 + ang * 1.8 - tilt * 0.6 + hurt, 16.4, -8.4 + ang * 1.6 + hurt, 17.6, -8 + ang * 1.4 - tilt * 0.5 + hurt, bw * 0.75, bw * 0.45);

  // age lines
  if (age > 0.05) {
    ctx.strokeStyle = `rgba(70,30,25,${0.16 + 0.34 * age})`; ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(14.1, 5.4); ctx.quadraticCurveTo(11.6, 9, 12.8, 12.6);          // nasolabial fold
    ctx.moveTo(4.6, -0.2); ctx.quadraticCurveTo(8.4, 1.8, 12.4, -0.1);         // eye bag
    ctx.moveTo(3.7, -4.7); ctx.lineTo(1, -6); ctx.moveTo(3.5, -3.6); ctx.lineTo(0.6, -3.6); // crow's feet
    if (age > 0.4) { ctx.moveTo(2.4, -14.2); ctx.quadraticCurveTo(8, -15.4, 13, -14.4); ctx.moveTo(3.4, -12.2); ctx.quadraticCurveTo(8.4, -13.2, 13.4, -12.4); }
    if (age > 0.55) { ctx.moveTo(-1, 14.5); ctx.quadraticCurveTo(5, 18.2, 10.6, 17); }
    ctx.stroke();
  }

  // moustache, mouth
  drawMouth(ctx, p.mouth, g, C, look);
  if (look.stache || (look.beard && look.beard.stache !== false)) { ctx.fillStyle = C(look.stache || look.beard.color); ctx.fill(g.stache); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.globalAlpha = 0.7; ctx.stroke(g.stache); ctx.globalAlpha = 1; }

  // hair on top
  if (g.hair) {
    const h = g.hair;
    const hg = ctx.createLinearGradient(-16, -26, 10, -8); hg.addColorStop(0, C(pal.hairL)); hg.addColorStop(0.45, C(pal.hair)); hg.addColorStop(1, C(pal.hairD));
    ctx.fillStyle = hg; ctx.fill(h.band);
    ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke(h.band);
    ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(HEX.test(pal.hairL) ? pal.hairL : '#ffffff', 0.5);
    for (const s of h.strands) ctx.stroke(s);
    if (h.part) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke(h.part); }
  } else if (look.hair && look.hair.style === 'none') {
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(1, -19.6, 8, 2.4, -0.05, 0, TAU); ctx.fill();
  }
  if (look.hair && look.hair.style === 'sides') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(3, -19.4, 9, 2.6, -0.08, 0, TAU); ctx.fill(); }

  // kippah
  if (look.kippah) {
    const kc = look.kippah;
    ctx.save(); ctx.translate(-4.6, -19.4); ctx.rotate(-0.16);
    ctx.beginPath(); ctx.ellipse(0, 0, 8.6, 3.7, 0, 0, TAU); ctx.fillStyle = C(kc.color); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
    if (kc.knit) {
      ctx.strokeStyle = C(kc.knit); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(0, 0, 6.4, 2.6, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 1.4, 0, 0, TAU); ctx.stroke();
    } else { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.ellipse(-2, -1.4, 5, 1.4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // black brimmed hat
  if (look.hat) {
    const hc = look.hat.color || '#121118';
    ctx.save(); ctx.translate(0, -18.6); ctx.rotate(-0.05);
    ctx.beginPath(); ctx.ellipse(-0.6, 0.6, 25.5, 5.4, 0, 0, TAU);
    const bg = ctx.createLinearGradient(0, -5, 0, 6); bg.addColorStop(0, C(lighten(hc, 0.16))); bg.addColorStop(1, C(darken(hc, 0.1)));
    ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15.4, 0.6); ctx.bezierCurveTo(-16.6, -12.5, -12.6, -20.2, -3, -20.6); ctx.bezierCurveTo(6.4, -21, 13, -15.6, 14, 0.6); ctx.closePath();
    const cg = ctx.createLinearGradient(-16, -20, 14, 0); cg.addColorStop(0, C(lighten(hc, 0.22))); cg.addColorStop(0.5, C(hc)); cg.addColorStop(1, C(darken(hc, 0.2)));
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = C(lighten(hc, 0.3)); ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(-14.6, -5.6); ctx.quadraticCurveTo(-1, -3.4, 13.6, -6); ctx.lineTo(13.8, -2.6); ctx.quadraticCurveTo(-1, -0.2, -15, -2.4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(-8, -20.6, -2, -20.4); ctx.lineWidth = 1.2; ctx.strokeStyle = C(lighten(hc, 0.5)); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // glasses
  if (look.glasses) {
    const gl = look.glasses, col = C(gl.color || '#222');
    ctx.lineWidth = 1.15; ctx.strokeStyle = col;
    const lens = (cx, cy, w, h) => {
      ctx.beginPath();
      if (gl.shape === 'round') ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU); else { const r = 1.8; ctx.roundRect ? ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r) : ctx.rect(cx - w / 2, cy - h / 2, w, h); }
      ctx.fillStyle = 'rgba(190,225,255,.17)'; ctx.fill(); ctx.stroke();
    };
    lens(15.3, -3.6, 5.6, 7.4);
    lens(8.4, -3.5, 10.2, 8.4);
    ctx.beginPath(); ctx.moveTo(13.5, -4.4); ctx.lineTo(12.6, -4.4); ctx.moveTo(3.3, -4.2); ctx.lineTo(-5.4, -2.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(5.2, -6.2); ctx.lineTo(8.4, -6.8); ctx.stroke();
  }
  if (look.earring) { ctx.beginPath(); ctx.arc(-6.5, 9.6, 1.6, 0, TAU); ctx.fillStyle = C(look.earring); ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// robot boss (the electoral threshold: a walking ballot box)
// ---------------------------------------------------------------------------------------------------------------
function drawRobotHead(ctx, f, look, p, C) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(-8, -44); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, -47, 5, 0, TAU); ctx.fillStyle = C('#ff4f6a'); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, C('#dfe4ef')); g.addColorStop(1, C('#8d97ab'));
  rr(ctx, -30, -28, 60, 56, 13); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, -23, -16, 50, 23, 7); ctx.fillStyle = C('#12163a'); ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
  const e = p.eyes, col = e === 'hurt' || e === 'ko' ? '#ff5a7a' : e === 'happy' ? '#7dff9a' : '#6ff0ff';
  ctx.strokeStyle = C(col); ctx.fillStyle = C(col); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (const ex of [-9, 14]) {
    if (e === 'ko') { ctx.beginPath(); ctx.moveTo(ex - 4.5, -12); ctx.lineTo(ex + 4.5, -3); ctx.moveTo(ex + 4.5, -12); ctx.lineTo(ex - 4.5, -3); ctx.stroke(); }
    else if (e === 'happy') { ctx.beginPath(); ctx.arc(ex, -4, 5.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (e === 'angry') { ctx.beginPath(); ctx.moveTo(ex - 5.5, -11 + (ex < 0 ? 0 : 3.5)); ctx.lineTo(ex + 5.5, -6 - (ex < 0 ? 0 : 3.5)); ctx.lineTo(ex + 5.5, -2); ctx.lineTo(ex - 5.5, -2); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(ex, -6.5, 4.5, e === 'squint' ? 2.2 : 5.4, 0, 0, TAU); ctx.fill(); }
  }
  const open = p.mouth === 'shout' || p.mouth === 'open' || p.mouth === 'o' ? 7 : 3;
  rr(ctx, -14, 13, 40, open + 2, 3); ctx.fillStyle = C('#0e0d11'); ctx.fill();
  ctx.fillStyle = C('#fff'); ctx.fillRect(-9, 14, 29, 1.8);
  ctx.fillStyle = C('#5b6478');
  for (const [rx, ry] of [[-25, -23], [25, -23], [-25, 22], [25, 22]]) { ctx.beginPath(); ctx.arc(rx, ry, 2.2, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawRobotTorso(ctx, look, C, ink, tint, tw, torsoLen, face = 1) {
  const top = -torsoLen - 8, h = torsoLen + 22, w = tw * 0.95;
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, C(darken(look.suit, 0.2))); g.addColorStop(0.5, C(lighten(look.suit, 0.14))); g.addColorStop(1, C(darken(look.suit, 0.25)));
  rr(ctx, -w, top, w * 2, h, 9); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = ink; ctx.stroke();
  rr(ctx, -w - 3, top - 6, w * 2 + 6, 13, 5); ctx.fillStyle = C('#eef2fb'); ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke();
  rr(ctx, -w * 0.5, top - 2, w, 4.5, 2.2); ctx.fillStyle = C('#0e0d11'); ctx.fill();
  if (!tint) {
    ctx.save(); ctx.translate(4, top - 4); ctx.rotate(-0.12); ctx.fillStyle = '#fff'; ctx.fillRect(-7, -10, 14, 11); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.strokeRect(-7, -10, 14, 11); ctx.restore();
    ctx.save(); ctx.scale(face, 1);     // the label must read correctly when the fighter faces left
    T(ctx, '3.25%', 0, top + h * 0.5 + 2, { size: 16, font: 'disp', fill: '#fff', stroke: OUT, lw: 5 });
    ctx.restore();
    ctx.fillStyle = C('#ffd23d'); ctx.fillRect(-w + 5, top + h - 11, w * 2 - 10, 4.5);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// full body
// ---------------------------------------------------------------------------------------------------------------
function drawShoe(ctx, x, y, ang, col, colD, ink, tint, back) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-7.4, -6.6); ctx.lineTo(1.6, -8.4); ctx.bezierCurveTo(7.4, -8, 11.4, -4.2, 16.6, -1.8); ctx.bezierCurveTo(21.4, 0.2, 22, 3.6, 19.2, 5.4);
  ctx.lineTo(-6.4, 5.8); ctx.bezierCurveTo(-8.8, 5.2, -8.8, -3.4, -7.4, -6.6); ctx.closePath();
  ctx.lineWidth = 1.7; ctx.strokeStyle = ink; ctx.stroke();
  const sg = ctx.createLinearGradient(0, -8, 0, 6); sg.addColorStop(0, col); sg.addColorStop(1, colD);
  ctx.fillStyle = sg; ctx.fill();
  if (!tint) {
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(10.5, -3.6, 5.6, 1.5, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = back ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.16)'; ctx.fillRect(-7.6, 3.6, 27, 1.9);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-8.2, 4.6, 8.6, 1.5);
  }
  ctx.restore();
}

function drawFist(ctx, x, y, ux, uy, skin, ink, tint, back) {
  const ang = Math.atan2(uy, ux);
  ctx.save(); ctx.translate(x + ux * 4.5, y + uy * 4.5); ctx.rotate(ang);
  rr(ctx, -5.6, -5.4, 11.6, 10.6, 3.6);
  ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = skin; ctx.fill();
  if (!tint) {
    ctx.strokeStyle = 'rgba(80,30,22,.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(1.4, -4.6); ctx.lineTo(1.4, 4.4); ctx.moveTo(-1.8, -3.8); ctx.lineTo(-1.8, 3.6); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-1, -4.4, 3.4, 1.6, 0, 0, TAU); ctx.strokeStyle = 'rgba(80,30,22,.45)'; ctx.stroke();   // thumb
    ctx.fillStyle = back ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.16)'; ctx.fillRect(-4.6, -4.8, 9, 2.4);
  }
  ctx.restore();
}

function drawFighter(ctx, f, opt = {}) {
  if (!opt.tint && F3D.active() && F3D.draw(ctx, f, opt)) return;      // real 3D model (WebGL); falls through to the cartoon renderer otherwise
  const def = f.def, look = def.look;
  const g = geo(look), pal = g.pal;
  const p = f.pose || poseOf(f);
  const flash = opt.flash || 0;
  const tint = opt.tint || null;
  const C = tint ? () => tint : flash > 0 ? (c) => flashMix(c, flash) : (c) => c;
  const s = look.h || 1;
  const bw = look.w || 1;
  const ink = tint || INK;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.face, 1);
  if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
  const gs = s * BODY_S * (f.scale || 1);      // f.scale: giants mutator and the secret boss
  ctx.scale(gs, gs);
  if (p.rot) { ctx.translate(p.rotX, p.rotY); ctx.rotate(p.rot); ctx.translate(-p.rotX, -p.rotY); }
  ctx.scale(p.sx, p.sy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const hipX = p.hx, hipY = p.hy, torsoLen = 50;
  const cl = Math.cos(p.lean), sl = Math.sin(p.lean);
  const shX = hipX + sl * torsoLen, shY = hipY - cl * torsoLen;
  const headCX = shX + 2 + p.headX, headCY = shY - 30 + p.headY;
  const toW = (x, y) => [hipX + x * cl - y * sl, hipY + x * sl + y * cl];
  const skin = pal.skin;

  const drawArm = (target, back) => {
    const [sx, sy] = toW(back ? -9 : 10, -43);
    const r = ik(sx, sy, target[0], target[1], 30, 30, 1);
    tube(ctx, [[sx, sy], [r.jx, r.jy], [r.ex, r.ey]], [13.4, 11.4, 9.6], C(back ? pal.suitD : pal.suit), ink, { noHl: back });
    const cl2 = Math.hypot(r.ex - r.jx, r.ey - r.jy) || 1, ux = (r.ex - r.jx) / cl2, uy = (r.ey - r.jy) / cl2;
    if (!tint) {   // shirt cuff
      tube(ctx, [[r.ex - ux * 8, r.ey - uy * 8], [r.ex - ux * 2.5, r.ey - uy * 2.5]], [10.6, 10.2], C(back ? pal.shirtD : pal.shirt), ink, { flat: true, ow: 1.3 });
    }
    drawFist(ctx, r.ex, r.ey, ux, uy, C(back ? pal.skinD : skin), ink, tint, back);
    if (p.finger && !back) {
      ctx.lineWidth = 6.6; ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(r.ex + ux * 6, r.ey + uy * 6); ctx.lineTo(r.ex + ux * 21, r.ey + uy * 21); ctx.stroke();
      ctx.lineWidth = 3.6; ctx.strokeStyle = C(skin); ctx.stroke();
    }
    r.hx = r.ex + ux * 4.5; r.hy = r.ey + uy * 4.5;
    return r;
  };
  const drawLeg = (target, back) => {
    const sx = hipX + (back ? -7 : 7), sy = hipY + 3;
    const r = ik(sx, sy, target[0], target[1], 38, 38, -1);
    tube(ctx, [[sx, sy], [r.jx, r.jy], [r.ex, r.ey]], [17.4, 14.2, 10.8], C(back ? pal.pantsD : pal.pants), ink, { noHl: back });
    if (!tint) {   // trouser crease + turn-up
      const dx = r.ex - r.jx, dy = r.ey - r.jy, d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.jx, r.jy); ctx.lineTo(r.ex - dx / d * 3, r.ey - dy / d * 3); ctx.stroke();
      tube(ctx, [[r.ex - dx / d * 9, r.ey - dy / d * 9], [r.ex - dx / d * 2, r.ey - dy / d * 2]], [11.6, 11.2], C(back ? darken(pal.pants, 0.36) : pal.pantsD), ink, { flat: true, ow: 1.2 });
    }
    const fa = Math.atan2(r.ey - r.jy, r.ex - r.jx) - Math.PI / 2;
    drawShoe(ctx, r.ex + 1, r.ey + 1, fa * 0.8, C(pal.shoe), C(pal.shoeD), ink, tint, back);
  };

  // aura glow
  if (p.glow && !tint) {
    ctx.save(); ctx.translate(hipX, hipY - 40); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 130, p.glow, 0.55 + Math.sin(f.clock * 0.3) * 0.15); ctx.restore();
  }

  // ---- back layer
  drawArm(p.handB, true);
  drawLeg(p.footB, true);

  // ---- torso (jacket)
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(p.lean);
  if (look.robot) drawRobotTorso(ctx, look, C, ink, tint, 27 * bw, torsoLen, f.face);
  else {
    const belly = look.belly || 0, shoulders = look.shoulders || 0;                        // build: a belly, broad (or narrow) shoulders
    const sw = 23 * bw * (1 + shoulders * 0.16), cw = 22 * bw * (1 + shoulders * 0.08 + belly * 0.05), ww = 18 * bw * (1 + belly * 0.12), hw = 19.5 * bw * (1 + belly * 0.06);
    const torso = new Path2D();
    addSpline(torso, [[-hw, 6], [-ww - 1, -12], [-cw - 1, -30], [-sw, -44], [-sw + 5, -49.6], [-10, -52.6], [-3, -53.6], [7, -53.4], [12, -52.2], [sw - 3, -49], [sw + 1, -43], [cw + 1.6 + belly * 3, -33], [ww + 2 + belly * 7, -13], [hw + 1 + belly * 4, 6]], true);
    torso.closePath();
    const tg = ctx.createLinearGradient(-sw, 0, sw, 0);
    tg.addColorStop(0, C(pal.suitD)); tg.addColorStop(0.4, C(pal.suit)); tg.addColorStop(0.8, C(pal.suitL)); tg.addColorStop(1, C(pal.suit));
    ctx.fillStyle = tg; ctx.fill(torso);
    ctx.lineWidth = 1.8; ctx.strokeStyle = ink; ctx.stroke(torso);
    if (!tint) {
      ctx.save(); ctx.clip(torso);
      const vg = ctx.createLinearGradient(0, -53, 0, 7); vg.addColorStop(0, 'rgba(255,255,255,.1)'); vg.addColorStop(0.5, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(0,0,0,.26)');
      ctx.fillStyle = vg; ctx.fillRect(-40, -56, 80, 66);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.1;   // fabric folds
      ctx.beginPath(); ctx.moveTo(-ww + 4, -16); ctx.quadraticCurveTo(-2, -12, ww - 3, -15); ctx.moveTo(-12, -30); ctx.quadraticCurveTo(-6, -22, -8, -14); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();

  // ---- neck (world space, from the shoulders up to the chin)
  if (!look.robot) {
    const nx = shX + 1, ny = shY - 1, hx = headCX - 1 + Math.sin(p.headRot) * 6, hy = headCY + 14;
    ctx.beginPath(); ctx.moveTo(nx - 8.5, ny + 1); ctx.lineTo(hx - 6.6, hy); ctx.lineTo(hx + 7.4, hy); ctx.lineTo(nx + 9, ny + 1); ctx.closePath();
    const ng = ctx.createLinearGradient(nx - 8, 0, nx + 9, 0); ng.addColorStop(0, C(pal.skinD)); ng.addColorStop(0.6, C(skin)); ng.addColorStop(1, C(pal.skinD));
    ctx.fillStyle = ng; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
    if (!tint) { ctx.fillStyle = 'rgba(60,20,15,.3)'; ctx.beginPath(); ctx.ellipse(hx + 0.5, hy + 1.2, 8, 3.4, 0, 0, TAU); ctx.fill(); }
  }

  // ---- shirt, tie, lapels (over the neck base)
  if (!look.robot && !tint) {
    ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(p.lean);
    const open = !!look.open;
    ctx.lineWidth = 1.3; ctx.strokeStyle = ink;
    // shirt V
    ctx.beginPath(); ctx.moveTo(-3.6, -53.4); ctx.lineTo(9.6, -53.2); ctx.lineTo(5.6, -25.5); ctx.closePath();
    ctx.fillStyle = C(pal.shirt); ctx.fill(); ctx.stroke();
    if (open) { ctx.beginPath(); ctx.moveTo(-1, -53.4); ctx.lineTo(8, -53.3); ctx.lineTo(4.6, -41); ctx.closePath(); ctx.fillStyle = C(pal.skin); ctx.fill(); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; }
    // collar wings
    ctx.fillStyle = C(pal.shirt);
    ctx.beginPath(); ctx.moveTo(-3.6, -53.4); ctx.lineTo(0.4, -49); ctx.lineTo(-5.8, -47.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9.6, -53.2); ctx.lineTo(6.6, -48.6); ctx.lineTo(12.6, -47.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // tie
    if (look.tie && !open) {
      ctx.beginPath(); ctx.moveTo(3.4, -49); ctx.lineTo(8.2, -49); ctx.lineTo(9, -31); ctx.lineTo(5.9, -25.2); ctx.lineTo(2.6, -31); ctx.closePath();
      const tg2 = ctx.createLinearGradient(2, 0, 9, 0); tg2.addColorStop(0, C(pal.tieD)); tg2.addColorStop(0.5, C(pal.tie)); tg2.addColorStop(1, C(pal.tieD));
      ctx.fillStyle = tg2; ctx.fill(); ctx.stroke();
      rr(ctx, 2.6, -53, 6.4, 5.2, 1.8); ctx.fillStyle = C(pal.tie); ctx.fill(); ctx.stroke();
    }
    // lapels
    ctx.fillStyle = C(pal.suitL); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-3.6, -53.4); ctx.lineTo(-10, -45.6); ctx.lineTo(-1.6, -31); ctx.lineTo(5.6, -25.5); ctx.lineTo(0.2, -34); ctx.lineTo(-1.4, -47.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9.6, -53.2); ctx.lineTo(16.6, -45.6); ctx.lineTo(12.4, -31); ctx.lineTo(5.6, -25.5); ctx.lineTo(9.6, -34); ctx.lineTo(10.6, -47.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // centre line, buttons, pocket square, pin
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(5.6, -25.5); ctx.lineTo(6.2, 6); ctx.stroke();
    ctx.fillStyle = C(pal.suitDD);
    for (const by of [-19, -9]) { ctx.beginPath(); ctx.arc(7.6, by, 1.5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.moveTo(14.4, -33.6); ctx.lineTo(20, -34.4); ctx.stroke();
    ctx.fillStyle = C(look.tie || '#ffffff'); ctx.beginPath(); ctx.moveTo(14.8, -34); ctx.lineTo(17, -37.4); ctx.lineTo(19.4, -34.6); ctx.closePath(); ctx.fill();
    if (look.pin) { ctx.beginPath(); ctx.arc(14, -41.4, 2.2, 0, TAU); ctx.fillStyle = C(look.pin); ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke(); }
    ctx.restore();
  }

  drawLeg(p.footF, false);

  // ---- head
  ctx.save();
  ctx.translate(headCX, headCY);
  ctx.rotate(p.headRot);
  ctx.scale(HEAD_K, HEAD_K);
  if (look.robot) drawRobotHead(ctx, f, look, p, C); else drawHead(ctx, f, look, p, C);
  ctx.restore();

  // ---- front arm (+ prop)
  const armR = drawArm(p.handF, false);
  if (p.prop && !tint) drawProp(ctx, p.prop, armR.hx, armR.hy, p.propAng);

  // dizzy stars
  if (p.dizzy && !tint) {
    for (let i = 0; i < 3; i++) {
      const a = f.clock * 0.12 + (i * TAU) / 3;
      const sx = headCX + Math.cos(a) * 24, sy = headCY - 30 + Math.sin(a) * 6;
      star(ctx, sx, sy, 5, 5.5, 2.4, a); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// round portrait of a fighter's head + shoulders (HUD, select cards, VS screen)
// ---------------------------------------------------------------------------------------------------------------
const PORT_CACHE = new Map();
function drawBust(ctx, look, C) {
  const g = geo(look), pal = g.pal;
  // neck
  ctx.beginPath(); ctx.moveTo(-9, 12); ctx.lineTo(-8.5, 26); ctx.lineTo(12, 26); ctx.lineTo(9, 12); ctx.closePath();
  ctx.fillStyle = C(pal.skinD); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  // jacket
  ctx.beginPath(); ctx.moveTo(-9, 22); ctx.bezierCurveTo(-24, 24, -42, 28, -48, 60); ctx.lineTo(52, 60); ctx.bezierCurveTo(46, 28, 28, 24, 12, 22); ctx.closePath();
  const tg = ctx.createLinearGradient(-48, 0, 52, 0); tg.addColorStop(0, C(pal.suitD)); tg.addColorStop(0.5, C(pal.suit)); tg.addColorStop(1, C(pal.suitD));
  ctx.fillStyle = tg; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
  // shirt + tie + lapels
  ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(12, 22); ctx.lineTo(1.6, 54); ctx.closePath(); ctx.fillStyle = C(pal.shirt); ctx.fill(); ctx.lineWidth = 1.3; ctx.stroke();
  if (look.open) { ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(9, 22); ctx.lineTo(1.6, 40); ctx.closePath(); ctx.fillStyle = C(pal.skin); ctx.fill(); }
  else if (look.tie) {
    ctx.beginPath(); ctx.moveTo(-1.4, 25); ctx.lineTo(4.8, 25); ctx.lineTo(6.8, 42); ctx.lineTo(1.6, 54); ctx.lineTo(-3.4, 42); ctx.closePath(); ctx.fillStyle = C(pal.tie); ctx.fill(); ctx.stroke();
    rr(ctx, -2.4, 21.6, 8, 5.4, 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = C(pal.suitL);
  ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(-22, 33); ctx.lineTo(-10, 50); ctx.lineTo(1.6, 54); ctx.lineTo(-6, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(25, 33); ctx.lineTo(13, 50); ctx.lineTo(1.6, 54); ctx.lineTo(9, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (look.pin) { ctx.beginPath(); ctx.arc(21, 40, 2.6, 0, TAU); ctx.fillStyle = C(look.pin); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
}

function drawPortrait(ctx, def, cx, cy, r, opt = {}) {
  const t = ctx.getTransform ? ctx.getTransform() : null;
  const sc = t ? Math.max(1, Math.hypot(t.a, t.b)) : 1;
  if (opt.cache) {
    const key = [def.id, Math.round(r * sc), opt.eyes, opt.mouth, opt.flip ? 1 : 0, opt.zoom || 1, opt.bg, opt.ring, opt.lw, opt.flat ? 'f' : '3', opt.view || 'front'].join('|');
    let c = PORT_CACHE.get(key);
    if (!c) {
      const pad = Math.ceil((opt.lw || 4) / 2 + 2), size = Math.ceil((r + pad) * 2 * sc);
      c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'); x.scale(sc, sc);
      drawPortrait(x, def, r + pad, r + pad, r, Object.assign({}, opt, { cache: false }));
      c._pad = pad;
      if (PORT_CACHE.size > 80) PORT_CACHE.clear();
      PORT_CACHE.set(key, c);
    }
    ctx.drawImage(c, cx - r - c._pad, cy - r - c._pad, (r + c._pad) * 2, (r + c._pad) * 2);
    return;
  }
  const look = def.look;
  const dummy = { def, x: 0, y: 0, face: 1, st: opt.st || 'idle', t: 0, clock: opt.clock || 0, mv: null, mt: 0, vy: 0, grounded: true, walkPh: 0, moveDir: 0, hurtPct: 1, lookDir: 0.4 };
  const p = newPose();
  p.eyes = opt.eyes || 'open'; p.mouth = opt.mouth || 'smile';
  dummy.pose = p;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (opt.bg) {
    const bg = ctx.createRadialGradient(cx, cy - r * 0.4, r * 0.1, cx, cy, r * 1.15);
    bg.addColorStop(0, flashMix(opt.bg, 0.16)); bg.addColorStop(1, opt.bg);
    ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const k = r / 33 * (opt.zoom || 1);
  ctx.translate(cx, cy + 0.6 * k);
  ctx.scale(k * (opt.flip ? -1 : 1), k);
  ctx.translate(-2, 0);
  const C = (c) => c;
  // portraits are the drawn caricatures (clear, and every face is built from the person's own numbers); the 3D bust is only used on request
  const bust3 = !look.robot && opt.bust3d && F3D.active() ? F3D.bust(def, p.eyes, p.mouth, r * sc * (opt.zoom || 1) * 2) : null;
  if (bust3) {
    ctx.restore(); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    if (opt.bg) {
      const bg = ctx.createRadialGradient(cx, cy - r * 0.4, r * 0.1, cx, cy, r * 1.15);
      bg.addColorStop(0, flashMix(opt.bg, 0.16)); bg.addColorStop(1, opt.bg);
      ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const z = 1.02 * (opt.zoom || 1);
    ctx.translate(cx, cy + r * 0.02); ctx.scale(opt.flip ? -z : z, z);
    ctx.drawImage(bust3, -r, -r, r * 2, r * 2);
  } else if (look.robot) {
    ctx.translate(0, 6); ctx.scale(0.62, 0.62); drawRobotHead(ctx, dummy, look, p, C);
  } else if (opt.view === 'side') {
    drawBust(ctx, look, C);
    drawHead(ctx, dummy, look, p, C);
  } else {
    ctx.translate(2, 5); ctx.scale(0.9, 0.9);       // the side view is shifted to the left; the front view is centred and a little smaller so that the hair fits (see 21b-portrait-front.js)
    drawFrontHead(ctx, look, p, C);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.lineWidth = opt.lw || 4; ctx.strokeStyle = opt.ring || OUT; ctx.stroke();
  ctx.restore();
}

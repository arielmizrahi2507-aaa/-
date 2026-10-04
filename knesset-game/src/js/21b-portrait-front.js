// ===== Front-facing caricature portraits =====
// People recognise a face from the front, so the portraits (select screen, VS splash, HUD, results) are drawn from the front, symmetrically, from the
// same per-person numbers (30-looks.js) as the side view. The fighters themselves stay in profile. Units: the head is about 41 wide, the centre is
// the middle of the face, y grows downwards, the portrait circle has a radius of 33 units.

const FRONT_GEO = new WeakMap();
const fMir = (p) => [-p[0], p[1]];
const fSup = (v, n) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);          // superellipse helper
// colours (hex in, hex out): t > 0 lightens, t < 0 darkens
const HX = (c, t) => { const A = rgb(c), T = t >= 0 ? 255 : 0, k = Math.abs(t); return '#' + A.map((v) => Math.round(v + (T - v) * k).toString(16).padStart(2, '0')).join(''); };
const HMIX = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const fRng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const fSeed = (look) => { let h = 2166136261; const s = look.skin + (look.hair ? look.hair.color + look.hair.style : '') + (look.suit || '') + (look.fw || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// a soft-edged blob of colour (a radial gradient from the colour to nothing): the way light and shadow are painted on the face
function softBlob(ctx, x, y, rx, ry, col, a, rot) {
  if (a <= 0.003) return;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
}
function facePalette(look) {
  const sk = look.skin, hc = look.hair ? look.hair.color : '#333333';
  return {
    sk, skL: HX(sk, 0.16), skLL: HX(sk, 0.32), skD: HX(sk, -0.12), skDD: HX(sk, -0.3), line: HX(sk, -0.64), flush: HMIX(sk, '#d4453f', 0.55),
    hc, hL: HX(hc, rgb(hc)[0] + rgb(hc)[1] + rgb(hc)[2] < 200 ? 0.17 : 0.3), hLL: HX(hc, rgb(hc)[0] + rgb(hc)[1] + rgb(hc)[2] < 200 ? 0.3 : 0.55), hD: HX(hc, -0.32), hDD: HX(hc, -0.56), mix: look.hair && look.hair.mix ? look.hair.mix : null,
    brow: look.browColor || HX(hc, -0.28), lip: look.lip || (look.female ? '#b8425c' : HMIX(sk, '#9a4a48', 0.5)), iris: look.iris || '#4a3626',
    suit: look.suit, suitL: HX(look.suit, 0.15), suitD: HX(look.suit, -0.24), suitDD: HX(look.suit, -0.44), shirt: look.shirt || '#ffffff', shirtD: HX(look.shirt || '#ffffff', -0.15),
  };
}

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
  const fw = Math.max(0.8, Math.min(1.36, G(look.fw, 'fw'))), chk = G(look.cheek, 'cheek'), chn = G(look.chin, 'chin'), jk = G(look.jaw, 'jaw'), fore = G(look.fore, 'fore');
  const ln = (look.len || 1) - 1, jl = (look.jowl || 0) * FACE_GAIN;
  const Ly = (y) => y + ln * 9 * sstep(6, 17, y);
  const lowW = (jk - 1) * 3.0 + jl * 0.8;
  // ---- the face outline (right half from the crown down to the chin, then mirrored)
  const tmp = look.temple || 1, jsq = look.jawSq || 0, cpt = look.chinPt || 0;        // temple width, a square jaw, a pointed chin
  const R = [
    [0, -28.6 - (fore - 1) * 1.5], [9.2, -27.4 - (fore - 1) * 1.3], [16 + (tmp - 1) * 1.6, -21.8 - (fore - 1) * 0.9], [19.4 + (tmp - 1) * 2, -13], [20.2 + (chk - 1) * 1.3, -3.6],
    [19.6 + (chk - 1) * 2.6, 5.2], [17.4 + lowW + jsq * 1.8, Ly(13.2) + jl * 1.2 + jsq * 0.8], [12.8 + lowW * 1.05 + jsq * 2.6, Ly(19.8) + jl * 1.9 + jsq * 1.1],
    [6.6 + (chn - 1) * 2.7 + jsq * 1.4 - cpt * 3.4, Ly(23.8) + (chn - 1) * 1.1 + jl * 1.5 + jsq * 0.6 + cpt * 1.2], [0, Ly(25.4) + (chn - 1) * 1.9 + jl * 1.1 + cpt * 1.8],
  ].map(([x, y]) => [x * fw, y]);
  if (look.hair && (look.hair.style === 'none' || look.hair.style === 'sides' || look.bald)) {                    // a bald head: the skull is a dome above the forehead, not a flat top
    const dome = look.bald === undefined ? 1 : look.bald;
    [[-5.4, 0], [-5, 0.6], [-3.8, 0.9], [-1.6, 0.8]].forEach(([dy, dx], i) => { R[i][1] += dy * dome; R[i][0] += dx * dome; });
  }
  if (look.faceAdj) look.faceAdj.forEach((d, i) => { if (R[i] && d) { R[i][0] += d[0]; R[i][1] += d[1]; } });        // hand-made corrections of the outline (right half, 10 points, crown to chin)
  const face = spline(R.concat(R.slice(1, -1).reverse().map(fMir)), true);
  // ---- the nose and mouth heights follow the length of the nose and of the lower face
  const nq = Math.max(0.75, Math.min(1.9, (G(look.nose, 'nose') + G(look.noseL, 'noseL')) / 2));
  const nwq = Math.max(0.75, Math.min(1.7, (G(look.nose, 'nose') + G(look.noseW, 'noseW')) / 2));
  const noseY = 3.9 + (nq - 1) * 3.4 + (look.noseT || 0) * 0.9;
  const mouthY = noseY + 8.4 + ln * 3.2 + (look.mouthDy || 0);
  g = { face, R, fw, chinY: R[R.length - 1][1], pal, P: facePalette(look), noseY, mouthY, nwq, nq, hair: null, bstr: null };
  // ---- hair
  const style = look.hair && look.hair.style;
  const hs0 = style && HAIR_F[style];
  // per-person tweaks of the hair shape: dt (higher / flatter on top), ds (wider at the sides), dd (sideburns longer), dh (hairline lower), de (hairline curves down more at the temples), dw (swept more to the right)
  const hs = hs0 && Object.assign({}, hs0, { top: hs0.top + (look.hair.dt || 0), side: hs0.side + (look.hair.ds || 0), drop: hs0.drop + (look.hair.dd || 0), hc: hs0.hc + (look.hair.dh || 0), edge: hs0.edge + (look.hair.de || 0), sw: hs0.sw + (look.hair.dw || 0) });
  if (hs) {
    const hl = look.hair.hl || 0, vol = look.hair.vol || 1, vk = 1 + (vol - 1) * 0.2;
    const W0 = 20.6 * fw, Ry = 22.6 + (fore - 1) * 1.3 + hs.top * vk, n = hs.curl ? 2.6 : 2.3;
    let Rx = W0 + hs.side * vk;
    const outer = [];
    const np = hs.spike ? 44 : 16;
    for (let i = 0; i <= np; i++) {
      const th = (i / np) * Math.PI, bump = hs.curl ? 1 + 0.045 * Math.sin(th * 13) : hs.spike ? 1 + (i % 2 ? 0.075 + 0.05 * Math.sin(i * 2.3) : -0.02) * Math.pow(Math.sin(th), 0.7) : 1 + 0.02 * Math.sin(th * 3.7 + 1.1);
      outer.push([fSup(Math.cos(th), n) * Rx * bump, -6 - Math.pow(Math.sin(th), 2 / n) * Ry * bump]);       // right equator -> crown -> left equator
    }
    const D = look.hair.dome;                                                                                // a hand-drawn outline of the hair: the right half, from the side over the top to the crown (x = 0)
    let sx0 = Rx * 0.985;
    if (D) { outer.length = 0; D.concat(D.slice(0, -1).reverse().map(fMir)).forEach((q) => outer.push(q)); Rx = Math.max.apply(null, D.map((q) => q[0])); sx0 = D[0][0]; }
    const side = hs.drop;
    const outerSeq = [[sx0, side]].concat(outer, [[-sx0, side]]);
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
    if (look.hair.line) {                                                                                    // a hand-drawn hairline: the right half from the centre to the sideburn (and optionally lineL for the left half)
      const L = look.hair.line, LL = look.hair.lineL ? look.hair.lineL : L.map(fMir);
      hair.length = 0; LL.slice(1).reverse().concat(L).forEach((q) => hair.push(q));
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
    // the strands: dark, light and "mix" (grey) ones, flowing from the hairline up and back over the skull
    const rnd = fRng(fSeed(look)), S = { d: new Path2D(), l: new Path2D(), m: new Path2D() };
    const domeAt = D ? ((x) => fYat(outer, Math.max(-Rx * 0.995, Math.min(Rx * 0.995, x)))) : ((x) => { const u = Math.max(-0.995, Math.min(0.995, x / Rx)); return -6 - Math.pow(Math.max(0.0001, 1 - Math.pow(Math.abs(u), n)), 1 / n) * Ry; });
    const strand = (path, x0, y0, x1, y1, bend) => { path.moveTo(x0, y0); path.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2 - Math.abs(bend) * 0.25, x1, y1); };
    if (hs.buzz) {                                                                                           // a stipple: the skin shows through
      for (let i = 0; i < 560; i++) {
        const x = (rnd() * 2 - 1) * Rx * 0.98, top = domeAt(x), bot = fYat(hair, Math.max(-19 * fw, Math.min(19 * fw, x)));
        const y = top + rnd() * Math.max(1, bot - top + 2), t = i % 3 === 0 ? S.l : i % 3 === 1 ? S.d : S.m;
        t.moveTo(x, y); t.lineTo(x + 0.3, y + 0.55);
      }
    } else if (hs.curl) {
      for (let i = 0; i < 70; i++) {
        const x = (rnd() * 2 - 1) * Rx * 0.92, top = domeAt(x), bot = fYat(hair, Math.max(-19 * fw, Math.min(19 * fw, x))), y = top + 1.4 + rnd() * Math.max(0.5, bot - top - 1.6), r = 0.9 + rnd() * 0.9;
        const t = i % 3 === 0 ? S.l : i % 3 === 1 ? S.d : S.m; t.moveTo(x - r, y); t.arc(x, y, r, Math.PI, Math.PI * 2 + 0.5);
      }
    } else if (hs.spike) {                                                                                   // strands that fan out into the spikes
      const tips = outerSeq.filter((q, k) => k > 1 && k < outerSeq.length - 2 && k % 2 === 0);
      tips.forEach((q, k) => {
        for (let j = 0; j < 4; j++) {
          const x0 = q[0] * (0.42 + rnd() * 0.3), y0 = Math.min(fYat(hair, Math.max(-19 * fw, Math.min(19 * fw, q[0] * 0.55))) - 0.5, q[1] + 8) + rnd() * 2;
          const t = (k + j) % 3 === 0 ? S.l : (k + j) % 3 === 1 ? S.d : S.m; strand(t, x0, y0, q[0] * (0.97 - rnd() * 0.06), q[1] + 0.9 + rnd(), (rnd() - 0.5) * 2.4);
        }
      });
    } else {
      const N = 96;
      for (let i = 0; i < N; i++) {
        const u = (i + rnd() * 0.9) / N, x0 = (-18.6 + u * 37.2) * fw, y0 = fYat(hair, x0) + 0.2 + rnd() * 0.9;
        let x1 = x0 * (1 + 0.1 * rnd()) + (rnd() - 0.5) * 3 - hs.sw * 1.6;
        x1 = Math.max(-Rx * 0.97, Math.min(Rx * 0.97, x1));
        const y1 = domeAt(x1) + 0.7 + rnd() * 2.4, bend = (rnd() - 0.5) * 4 + (hs.sw ? 2.2 * Math.sign(hs.sw) : 0) + (x0 > 0 ? 0.7 : -0.7), k = i % 4;
        strand(k === 0 ? S.l : k === 1 ? S.d : S.m, x0, y0, x1, y1, bend);
      }
    }
    const st = S;
    g.topY = Math.min(R[0][1], outer.reduce((m, q) => Math.min(m, q[1]), 0));
    g.hair = { cap, sil, hln, ticks, S: st, hs, hairPts: hair, back: null, lockR: null, lockL: null, V: null };
    if (hs.long) {                                                                                           // a mass behind the head and two locks in front of the shoulders
      const flare = hs.flare ? 1 : 0, len = ((look.hair.len || 40) - 6) * 0.78, bot = Math.min(46, 8 + len), wide = 24.2 * fw + hs.side * 0.6 + flare * 2.6;
      const bp = [[0, -30.5 - hs.top * 0.3], [11, -29], [wide * 0.78, -22], [wide, -10], [wide + 1.2, 6], [wide + 0.4 + flare * 2.2, bot * 0.55], [wide - 0.5 + flare * 4.2, bot], [wide * 0.45, bot + 2.2], [0, bot + 1.5]];
      g.hair.back = spline(bp.concat(bp.slice(1, -1).reverse().map(fMir)), true);
      const lw = 6.2 + flare * 1.6, lx = 17.2 * fw + 3.2;
      const lp = [[lx - 1.6, -4], [lx + lw * 0.7, 2], [lx + lw + 0.8 + flare * 1.2, bot * 0.5], [lx + lw + 1 + flare * 3.2, bot - 1], [lx + 0.6, bot + 1.6], [lx - 3.4, bot * 0.52], [lx - 3.2, 8]];
      g.hair.lockR = spline(lp, true); g.hair.lockL = spline(lp.map(fMir), true);
      const V = { d: new Path2D(), l: new Path2D(), m: new Path2D() }, rv = fRng(fSeed(look) ^ 0x51ed270b);
      for (let i = 0; i < 120; i++) {
        const x = (rv() * 2 - 1) * (wide + 3), y0 = -26 + rv() * 22, sway = (rv() - 0.5) * 3.2 * (look.hair.wave || 1), len = 14 + rv() * (bot + 6), t = i % 3 === 0 ? V.l : i % 3 === 1 ? V.d : V.m;
        t.moveTo(x, y0); t.bezierCurveTo(x + sway, y0 + len * 0.35, x - sway, y0 + len * 0.7, x + sway * 0.6, y0 + len);
      }
      g.hair.V = V;
    }
  } else if (style === 'sides') {                                                                            // bald crown, hair only above and behind the ears
    const k = fw, up = look.hair.up || 0, sp = [[18.6 * k, -15 + up], [22.6 * k, -12.6 + up * 0.8], [25.2 * k, -5.6 + up * 0.2], [25.2 * k, 3.4], [23.4 * k, 9.4], [20.6 * k, 4.2], [19.8 * k, -4.4]];
    const rs = fRng(fSeed(look) ^ 0x2545f491), S = { d: new Path2D(), l: new Path2D(), m: new Path2D() };
    for (const sg of [1, -1]) for (let i = 0; i < 26; i++) {
      const x = sg * (19.6 + rs() * 5.4) * k, y0 = -16 + up + rs() * (14 - up), len = 4 + rs() * 7, t = i % 3 === 0 ? S.l : i % 3 === 1 ? S.d : S.m;
      t.moveTo(x, y0); t.quadraticCurveTo(x + sg * (rs() - 0.2) * 1.6, y0 + len * 0.5, x + sg * 0.6, y0 + len);
    }
    g.hair = { sidesR: spline(sp, true), sidesL: spline(sp.map(fMir), true), S, hs: { sides: 1 }, cap: null };
  }
  if (look.beard || look.stubble) {                                                                          // beard hair: curved strands that lean in towards the chin, and stubble dots
    const rb = fRng(fSeed(look) ^ 0x9e3779b9), B = { d: new Path2D(), l: new Path2D(), m: new Path2D(), dots: new Path2D() };
    const ext2 = look.beard && look.beard.len ? look.beard.len * 7 : 0, flr = (look.beard && look.beard.flare) || 0, nS = look.beard ? 640 + ext2 * 45 : 0;
    for (let i = 0; i < nS; i++) {
      const x = (rb() * 2 - 1) * (21 * fw + flr * 5), y = -4 + rb() * (32 + ext2), side = x >= 0 ? 1 : -1;
      if (rb() > 0.3 + 0.7 * sstep(-2, 9, y)) continue;
      const lean = -side * (0.12 + 0.42 * Math.min(1, Math.max(0, (y - 4) / 22))) * Math.min(1, Math.abs(x) / 14), len = 2.4 + rb() * 3.4, ang = Math.PI / 2 + lean + (rb() - 0.5) * 0.5;
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len, cx = x + Math.cos(ang + 0.25 * side) * len * 0.5, cy = y + Math.sin(ang + 0.25 * side) * len * 0.5, k = i % 5;
      const t = k === 0 ? B.l : k <= 2 ? B.d : B.m; t.moveTo(x, y); t.quadraticCurveTo(cx, cy, x1, y1);
    }
    for (let i = 0; i < 2600; i++) { const x = (rb() * 2 - 1) * 22 * fw, y = -4 + rb() * 32, pr = 0.1 + 0.9 * sstep(0, 11, y) * (1 - 0.55 * sstep(0.55, 1, Math.abs(x) / (21 * fw))); if (rb() < pr) B.dots.rect(x, y, 0.36, 0.36); }
    g.bstr = B;
  }
  if (g.topY === undefined) g.topY = R[0][1];
  FRONT_GEO.set(look, g);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// painting: the face is painted with soft light and shadow (no flat cartoon fills), from the same numbers as the geometry
// ---------------------------------------------------------------------------------------------------------------
let SKIN_NOISE = null;
function skinNoise() {            // a grainy grey square (made once); laid over the skin at a low strength it gives pores
  if (SKIN_NOISE) return SKIN_NOISE;
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const x = c.getContext('2d'), id = x.createImageData(192, 192); let a = 20240929;
  for (let i = 0; i < id.data.length; i += 4) { a = (a * 1103515245 + 12345) & 0x7fffffff; const v = 64 + ((a >> 7) & 127); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0);
  SKIN_NOISE = c; return c;
}
const bez3 = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };

// ---- the bust: neck, jacket, shirt, tie ------------------------------------------------------------------------
function frontBust(ctx, look, g) {
  const P = g.P, nk = faceK(look.neck, 'neck'), sh = look.shoulders || 0, ww = look.w || 1;
  const nh = 8.3 * nk * (0.92 + 0.08 * ww), top = g.chinY - 6, bot = g.chinY + 7.5;
  const sx = (31 + sh * 5) * (0.9 + 0.1 * ww);
  const edge = HX(look.suit, -0.62);
  // the jacket
  const body = new Path2D();
  body.moveTo(-nh - 1, bot - 6); body.bezierCurveTo(-sx * 0.55, bot - 5, -sx - 7, bot - 2, -sx - 12, 62); body.lineTo(sx + 12, 62);
  body.bezierCurveTo(sx + 7, bot - 2, sx * 0.55, bot - 5, nh + 1, bot - 6); body.closePath();
  const tg = ctx.createLinearGradient(-sx - 12, 0, sx + 12, 0); tg.addColorStop(0, P.suitD); tg.addColorStop(0.32, P.suit); tg.addColorStop(0.62, P.suit); tg.addColorStop(1, P.suitDD);
  ctx.fillStyle = tg; ctx.fill(body);
  ctx.save(); ctx.clip(body);
  softBlob(ctx, -sx * 0.55, bot + 7, 16, 8, P.suitL, 0.5);                                   // light on the near shoulder
  const vg = ctx.createLinearGradient(0, bot - 6, 0, 62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = vg; ctx.fillRect(-60, bot - 6, 120, 70);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16; ctx.drawImage(skinNoise(), -50, bot - 8, 100, 80); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';      // the weave of the cloth
  ctx.restore();
  ctx.lineWidth = 1.3; ctx.strokeStyle = edge; ctx.stroke(body);
  // the neck, in the shadow of the jaw
  const neck = new Path2D(); neck.moveTo(-nh, top); neck.lineTo(-nh - 0.6, bot - 4); neck.lineTo(nh + 0.6, bot - 4); neck.lineTo(nh, top); neck.closePath();
  const ng = ctx.createLinearGradient(0, top, 0, bot); ng.addColorStop(0, P.skDD); ng.addColorStop(0.3, P.skD); ng.addColorStop(1, P.sk);
  ctx.fillStyle = ng; ctx.fill(neck);
  const nsg = ctx.createLinearGradient(-nh, 0, nh, 0); nsg.addColorStop(0, 'rgba(60,25,18,.12)'); nsg.addColorStop(0.35, 'rgba(60,25,18,0)'); nsg.addColorStop(1, 'rgba(60,25,18,.3)');
  ctx.fillStyle = nsg; ctx.fill(neck);
  if (nk > 1.3) { ctx.strokeStyle = rgba(P.line, 0.18); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-nh * 0.55, top + 2); ctx.quadraticCurveTo(-nh * 0.3, bot - 10, -nh * 0.1, bot - 4); ctx.moveTo(nh * 0.55, top + 2); ctx.quadraticCurveTo(nh * 0.3, bot - 10, nh * 0.1, bot - 4); ctx.stroke(); }     // thick neck: the muscles
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(P.line, 0.85); ctx.stroke(neck);
  // the shirt: a V under the neck
  const vy = bot + 17 + (look.open ? 3 : 0);
  const sv = new Path2D(); sv.moveTo(-nh - 1.4, bot - 5.5); sv.lineTo(nh + 1.4, bot - 5.5); sv.lineTo(0, vy + 4); sv.closePath();
  const sg = ctx.createLinearGradient(-nh, 0, nh, 0); sg.addColorStop(0, P.shirtD); sg.addColorStop(0.4, P.shirt); sg.addColorStop(1, P.shirtD); ctx.fillStyle = sg; ctx.fill(sv);
  ctx.lineWidth = 0.9; ctx.strokeStyle = rgba(HX(P.shirt, -0.55), 0.8); ctx.stroke(sv);
  if (look.open) {
    const vv = new Path2D(); vv.moveTo(-nh + 0.5, bot - 5); vv.lineTo(nh - 0.5, bot - 5); vv.lineTo(0, vy - 5); vv.closePath();
    const og = ctx.createLinearGradient(0, bot - 5, 0, vy - 5); og.addColorStop(0, P.skDD); og.addColorStop(1, P.skD); ctx.fillStyle = og; ctx.fill(vv); ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(P.line, 0.8); ctx.stroke(vv);
  }
  // the lapels
  for (const s of [-1, 1]) {
    const lp = new Path2D(); lp.moveTo(s * (nh + 1.6), bot - 6); lp.lineTo(s * sx * 0.78, bot + 7.5); lp.lineTo(s * 11.5, vy + 12); lp.lineTo(0, vy + 4); lp.lineTo(s * 5, bot + 5); lp.closePath();
    const lg = ctx.createLinearGradient(s * 4, bot, s * sx * 0.78, bot + 12); lg.addColorStop(0, P.suitL); lg.addColorStop(1, P.suit); ctx.fillStyle = lg; ctx.fill(lp);
    ctx.lineWidth = 1; ctx.strokeStyle = edge; ctx.stroke(lp);
  }
  if (!look.open && look.tie) {
    const knot = new Path2D(); knot.moveTo(-3.2, bot - 3); knot.lineTo(3.2, bot - 3); knot.lineTo(4.4, bot + 1.6); knot.lineTo(-4.4, bot + 1.6); knot.closePath();
    const blade = new Path2D(); blade.moveTo(-3.6, bot + 1.6); blade.lineTo(3.6, bot + 1.6); blade.lineTo(5.8, vy + 8); blade.lineTo(0, vy + 14); blade.lineTo(-5.8, vy + 8); blade.closePath();
    const tgr = ctx.createLinearGradient(-5, 0, 5, 0); tgr.addColorStop(0, HX(look.tie, -0.25)); tgr.addColorStop(0.35, HX(look.tie, 0.12)); tgr.addColorStop(1, HX(look.tie, -0.32));
    ctx.fillStyle = tgr; ctx.fill(blade); ctx.fill(knot);
    ctx.lineWidth = 0.9; ctx.strokeStyle = HX(look.tie, -0.62); ctx.stroke(blade); ctx.stroke(knot);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-1, bot + 2.4); ctx.lineTo(-1.6, vy + 8); ctx.stroke();
  }
  if (look.pin) { const px = sx * 0.62, py = bot + 14; softBlob(ctx, px, py + 0.8, 4, 3, '#000000', 0.25); ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU); ctx.fillStyle = look.pin; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = HX(look.pin, -0.6); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 0.7, py - 0.8, 0.7, 0, TAU); ctx.fill(); }
}

// ---- eyes --------------------------------------------------------------------------------------------------------
function frontEyes(ctx, look, g, p, ey, ex, eK) {
  const P = g.P, st = p.eyes, female = !!look.female;
  const ew = look.eyeW || 1, eh = look.eyeH || 1, tilt = look.eyeTilt || 0, lid = look.lid || 0, bags = look.bags || 0;
  const lash = 'rgba(24,13,11,.96)';
  for (const sg of [1, -1]) {
    ctx.save(); ctx.translate(sg * ex, ey + 0.2); ctx.scale(sg, 1); ctx.rotate(-tilt);
    const hw = 4.9 * eK * ew;
    if (st === 'blink' || st === 'happy' || st === 'hurt' || st === 'ko') {                                // closed eyes
      ctx.lineCap = 'round'; ctx.strokeStyle = lash; ctx.lineWidth = st === 'hurt' ? 1.5 : 1.25; ctx.beginPath();
      if (st === 'happy') { ctx.moveTo(-hw * 0.95, 0.9); ctx.quadraticCurveTo(0, -2.9, hw * 0.95, 0.9); }
      else if (st === 'hurt') { ctx.moveTo(-hw * 0.95, -0.5); ctx.quadraticCurveTo(0, 2.6, hw * 0.95, -0.6); ctx.moveTo(-2.4, 1.2); ctx.lineTo(-3.6, 2.3); ctx.moveTo(1, 1.7); ctx.lineTo(0.8, 3); }
      else if (st === 'ko') { ctx.moveTo(-hw * 0.95, -0.5); ctx.quadraticCurveTo(0, 1.8, hw * 0.95, -0.5); }
      else { ctx.moveTo(-hw * 0.95, 0.2); ctx.quadraticCurveTo(0, 1.5, hw * 0.95, 0.2); }
      ctx.stroke();
      softBlob(ctx, 0, -1.4, hw, 1.4, P.skDD, 0.2);
      ctx.restore(); continue;
    }
    const sq = st === 'squint' ? 0.5 : st === 'angry' ? 0.78 : 1;
    const hh = 2.0 * eK * eh * Math.max(0.4, 1 - lid * 0.36) * sq;
    const up = (t) => [bez3(-hw, -hw * 0.55, hw * 0.45, hw, t), bez3(0.35, -hh * 1.55 - 0.1, -hh * 1.5, -0.15, t)];
    const eye = new Path2D();
    eye.moveTo(-hw, 0.35); eye.bezierCurveTo(-hw * 0.55, -hh * 1.55 - 0.1, hw * 0.45, -hh * 1.5, hw, -0.15); eye.bezierCurveTo(hw * 0.5, hh * 1.1 + 0.1, -hw * 0.45, hh * 1.25, -hw, 0.35);
    const upper = new Path2D(); upper.moveTo(-hw, 0.35); upper.bezierCurveTo(-hw * 0.55, -hh * 1.55 - 0.1, hw * 0.45, -hh * 1.5, hw, -0.15);
    // the white of the eye, shaded under the lid
    const sc = ctx.createLinearGradient(0, -hh * 1.3, 0, hh); sc.addColorStop(0, '#c9c0b6'); sc.addColorStop(0.4, '#f1ede6'); sc.addColorStop(1, '#e4ddd3');
    ctx.fillStyle = sc; ctx.fill(eye);
    ctx.save(); ctx.clip(eye);
    const ir = Math.min(hh * 1.05, hw * 0.4), ix = (look.gaze || 0) * hw * 0.18, iy = -hh * 0.08 - Math.max(0, 0.6 - lid) * 0.1;
    const ig = ctx.createRadialGradient(ix - ir * 0.2, iy - ir * 0.2, ir * 0.12, ix, iy, ir);
    ig.addColorStop(0, HX(P.iris, 0.4)); ig.addColorStop(0.55, P.iris); ig.addColorStop(0.92, HX(P.iris, -0.45)); ig.addColorStop(1, HX(P.iris, -0.7));
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(8,5,6,.55)'; ctx.lineWidth = 0.45; ctx.stroke();
    ctx.fillStyle = '#080506'; ctx.beginPath(); ctx.arc(ix, iy, ir * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.ellipse(ix - ir * 0.36, iy - ir * 0.42, ir * 0.24, ir * 0.2, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(ix + ir * 0.4, iy + ir * 0.45, ir * 0.12, 0, TAU); ctx.fill();
    const lg = ctx.createLinearGradient(0, -hh * 1.4, 0, hh * 0.4); lg.addColorStop(0, 'rgba(40,16,12,.62)'); lg.addColorStop(0.55, 'rgba(40,16,12,0)'); ctx.fillStyle = lg; ctx.fillRect(-hw - 1, -hh * 1.6, hw * 2 + 2, hh * 2.2);   // the shadow of the upper lid
    ctx.restore();
    if (st === 'angry') { ctx.fillStyle = look.skin; ctx.beginPath(); ctx.moveTo(-hw * 1.3, -hh * 2.6); ctx.lineTo(hw * 1.3, -hh * 2.6); ctx.lineTo(hw * 1.3, -hh * 1.0); ctx.lineTo(-hw * 1.3, -hh * 0.05); ctx.closePath(); ctx.fill(); }
    // the lash line (heavier on the outer half), the crease, the lower lid, bags
    ctx.lineCap = 'round'; ctx.strokeStyle = lash; ctx.lineWidth = female ? 1.25 : 1.0; ctx.stroke(upper);
    ctx.save(); ctx.beginPath(); ctx.rect(0, -10, 12, 20); ctx.clip(); ctx.lineWidth = female ? 1.9 : 1.5; ctx.stroke(upper); ctx.restore();
    if (female) { ctx.lineWidth = 0.7; ctx.beginPath(); for (let k = 0; k < 7; k++) { const t = 0.4 + k * 0.1, [x, y] = up(t); ctx.moveTo(x, y); ctx.lineTo(x + 0.55 + t * 0.4, y - 1.0 - t * 0.5); } ctx.stroke(); }
    ctx.strokeStyle = 'rgba(70,30,22,.34)'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(-hw * 0.9, -hh * 1.45 - 0.2 - lid * 0.2); ctx.quadraticCurveTo(0, -hh * 2.35 - lid * 0.5, hw * 1.04, -hh * 1.2 - 0.1); ctx.stroke();          // the crease above the lid
    if (lid > 0.35) softBlob(ctx, 0, -hh * 1.9, hw * 1.0, 1.5, P.skDD, 0.14 + 0.2 * lid);                                         // a heavy lid: a fold of shadow
    ctx.strokeStyle = 'rgba(80,35,30,.3)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-hw * 0.6, hh * 0.95); ctx.quadraticCurveTo(0, hh * 1.2, hw * 0.8, hh * 0.55); ctx.stroke();
    ctx.fillStyle = 'rgba(214,120,112,.55)'; ctx.beginPath(); ctx.ellipse(-hw + 0.45, 0.5, 0.55, 0.4, 0, 0, TAU); ctx.fill();
    softBlob(ctx, 0, hh * 1.3 + 1.4, hw * 0.95, 1.5 + bags * 0.9, '#6a3036', 0.1 + 0.26 * bags);
    if (bags > 0.45) { ctx.strokeStyle = rgba(P.line, 0.16 + 0.2 * bags); ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(-hw * 0.8, hh * 1.6 + 1.6); ctx.quadraticCurveTo(0, hh * 1.9 + 2.2, hw * 0.9, hh * 1.4 + 1.2); ctx.stroke(); }
    ctx.restore();
  }
}

// ---- brows: many hairs, not a flat shape -------------------------------------------------------------------------
function frontBrows(ctx, look, g, p, ey, ex, eK) {
  const P = g.P, e = p.eyes, bw = look.brow || 2.5, arch = look.browArch || 0, tilt = look.browTilt || 0, bl = look.browLen || 1;
  const ang = e === 'angry' ? 1 : e === 'hurt' ? -1 : e === 'squint' ? 0.5 : e === 'happy' ? -0.15 : 0;
  const rdg = faceK(look.ridge, 'ridge'), yb = ey - 6.8 - (eK - 1) * 1.4 - (rdg - 1) * 0.5 + (look.browY || 0), hurt = e === 'hurt' ? -1.4 : 0;
  const rn = fRng(fSeed(look) ^ 0x7f4a7c15);
  for (const sg of [1, -1]) {
    ctx.save(); ctx.scale(sg, 1);
    const xi = ex - 6.2 * eK + 0.6, xo = (ex + 6.4 * eK) * Math.min(1.12, bl);
    const x0 = xi, y0 = yb + 1.8 + ang * 1.9 + tilt * 1.2 + hurt, cx = (xi + xo) / 2, cy = yb - 1.4 - arch * 1.9 - (ang < 0 ? 1.3 : 0) + ang * 0.2, x1 = xo, y1 = yb + 1.9 - ang * 0.4 - tilt * 1.0 - hurt * 0.5, w0 = bw * 1.18, w1 = bw * 0.55;
    const pt = (t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1, 2 * u * (cx - x0) + 2 * t * (x1 - cx), 2 * u * (cy - y0) + 2 * t * (y1 - cy)]; };
    // a soft base, then the hairs lying along the brow
    const up = [], dn = [], up2 = [], dn2 = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, [x, y, dx, dy] = pt(t), l = Math.hypot(dx, dy) || 1, hw = (w0 + (w1 - w0) * t * t) / 2; up.push([x - dy / l * hw, y + dx / l * hw]); dn.push([x + dy / l * hw, y - dx / l * hw]); up2.push([x - dy / l * hw * 1.35, y + dx / l * hw * 1.35]); dn2.push([x + dy / l * hw * 1.35, y - dx / l * hw * 1.35]); }
    const poly = (A, B2) => { ctx.beginPath(); ctx.moveTo(A[0][0], A[0][1]); for (const q of A) ctx.lineTo(q[0], q[1]); for (let i = B2.length - 1; i >= 0; i--) ctx.lineTo(B2[i][0], B2[i][1]); ctx.closePath(); };
    poly(up2, dn2); ctx.fillStyle = rgba(P.brow, 0.2); ctx.fill();
    poly(up, dn); ctx.fillStyle = rgba(P.brow, 0.78); ctx.fill();
    const hairs = 12 + Math.round(bw * 3.4);
    for (let i = 0; i < hairs; i++) {
      const t = (i + rn() * 0.8) / hairs, [x, y, dx, dy] = pt(Math.min(1, t)), l = Math.hypot(dx, dy) || 1, tx = dx / l, ty = dy / l, nx = -ty, ny = tx, hw = (w0 + (w1 - w0) * t * t) / 2;
      const off = (rn() * 2 - 1) * hw * 0.85, lx = x + nx * off, ly = y + ny * off, len = hw * 0.9 + 0.7 + rn() * 0.5;
      ctx.strokeStyle = rgba(rn() < 0.5 ? HX(P.brow, 0.3) : HX(P.brow, -0.3), 0.62); ctx.lineWidth = 0.42 + bw * 0.03;
      ctx.beginPath(); ctx.moveTo(lx - tx * len * 0.5 + nx * 0.3, ly - ty * len * 0.5 + ny * 0.3); ctx.lineTo(lx + tx * len * 0.5 - nx * 0.25, ly + ty * len * 0.5 - ny * 0.25); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---- nose ----------------------------------------------------------------------------------------------------------
function frontNose(ctx, look, g, ey) {
  const ny = g.noseY, nq = g.nq, nwq = g.nwq, br = look.bridge || 0, ruddy = look.ruddy || 0, nt = look.noseT || 0;
  const aw = 4.4 + 2.4 * (nwq - 1), tr = 2.1 + 1.1 * (nwq - 1) + 0.5 * (nq - 1);          // half width at the wings, radius of the tip
  const big = Math.max(0, Math.min(1, ((nq - 1) + (nwq - 1)) / 1.2));                       // 0 = a small nose, 1 = a big one: the planes of the nose get darker and clearer
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dark = '#5c2a22', mid = (ey + ny) / 2, len = Math.max(3, (ny - ey) / 2 + 1.2);
  // the plane of the nose on the side away from the light, from the corner of the eye to the wing
  const pl = new Path2D(); pl.moveTo(1.5, ey + 1.2); pl.bezierCurveTo(2.5 + big * 0.7, mid - 1, aw * 0.78, ny - 3.2, aw * 0.98, ny + 1.1); pl.lineTo(aw * 0.5, ny + 1.8); pl.bezierCurveTo(tr * 0.9, ny - 1.4, tr * 0.7, mid + 2, 1.1, ey + 3); pl.closePath();
  const pg = ctx.createLinearGradient(0, ey, 0, ny + 1.5); pg.addColorStop(0, rgba(dark, 0.02)); pg.addColorStop(0.55, rgba(dark, 0.1 + 0.12 * big)); pg.addColorStop(1, rgba(dark, 0.2 + 0.2 * big));
  ctx.fillStyle = pg; ctx.fill(pl);
  const pl2 = new Path2D(); pl2.moveTo(-1.5, ey + 2); pl2.bezierCurveTo(-2.4 - big * 0.5, mid, -aw * 0.7, ny - 3, -aw * 0.95, ny + 0.8); pl2.lineTo(-aw * 0.55, ny + 1.4); pl2.bezierCurveTo(-tr * 0.9, ny - 1.4, -tr * 0.8, mid + 2, -1.2, ey + 3.4); pl2.closePath();
  ctx.fillStyle = rgba(dark, 0.05 + 0.07 * big); ctx.fill(pl2);
  softBlob(ctx, -0.5, mid + 0.4, 1.3 + 0.5 * (nwq - 1), len * 0.9, '#ffffff', 0.2 + 0.06 * br + 0.06 * big);                                          // the light on the ridge
  if (br > 0.05) { ctx.strokeStyle = rgba(dark, 0.14 + br * 0.45); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(2.6, ey + 3); ctx.quadraticCurveTo(3.2 + br * 1.2, ey + 6, 3, ny - 2.4); ctx.stroke(); }
  if (big > 0.3) { ctx.strokeStyle = rgba(dark, 0.18 + 0.2 * big); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(1.7, ey + 2); ctx.bezierCurveTo(2.5 + big * 0.7, mid - 1, aw * 0.74, ny - 3.2, aw * 0.9, ny + 0.8); ctx.stroke(); }   // the edge of the nose
  if (ruddy > 0) softBlob(ctx, 0, ny + 0.2, aw + 0.6, 3.4, '#d4453f', 0.08 + ruddy * 0.28);
  softBlob(ctx, -0.3, ny - 0.9 + nt * 0.5, tr * 1.3, tr * 1.15, '#ffffff', 0.26 + 0.06 * big);                                                         // the ball of the tip
  for (const sg of [1, -1]) {
    softBlob(ctx, sg * (aw - 0.5), ny + 0.9, 1.9 + 0.6 * (nwq - 1), 2.4, dark, (sg > 0 ? 0.28 : 0.16) + 0.08 * big);                                  // the wings
    ctx.strokeStyle = rgba(dark, 0.45 + 0.2 * big); ctx.lineWidth = 0.8 + 0.2 * big;
    ctx.beginPath(); ctx.moveTo(sg * tr * 0.95, ny - 1.5); ctx.bezierCurveTo(sg * (aw - 0.2), ny - 1.3, sg * (aw + 0.6), ny + 0.1, sg * (aw - 0.4), ny + 1.8); ctx.stroke();      // the crease around the wing
    ctx.fillStyle = 'rgba(25,6,5,.62)'; ctx.beginPath(); ctx.ellipse(sg * tr * 0.82, ny + 1.9, 0.8 + 0.25 * (nwq - 1), 0.45 + 0.1 * big, sg * 0.4, 0, TAU); ctx.fill();   // the nostril
  }
  softBlob(ctx, 0, ny + 2.7 + nt * 0.4, aw + 0.6, 1.9 + 0.4 * big, dark, 0.3 + 0.1 * big);                                                              // the shadow under the nose
  if (nt > 0.2) { ctx.strokeStyle = rgba(dark, 0.3 + 0.2 * nt); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-tr * 0.9, ny + 2.4); ctx.quadraticCurveTo(0, ny + 3.9, tr * 0.9, ny + 2.4); ctx.stroke(); }   // a drooping tip
}

// ---- mouth ---------------------------------------------------------------------------------------------------------
function frontMouth(ctx, look, g, p) {
  const P = g.P, my = g.mouthY, female = !!look.female;
  let m = p.mouth; if (m === 'smile' && look.teeth) m = 'grin';
  const lk = 0.7 + 0.3 * faceK(look.lips, 'lips'), mw = 7 * (look.mouthW || 1) * (0.92 + 0.08 * faceK(look.lips, 'lips'));
  const lipU = HX(P.lip, -0.14), lipL = HX(P.lip, 0.05), dark = '#35090f', mood = look.mood || 0;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (look.smirk) { ctx.translate(0, my); ctx.rotate(look.smirk * 0.09); ctx.translate(0, -my); }
  const upper = (lift) => { const q = new Path2D(); q.moveTo(-mw, my - lift); q.quadraticCurveTo(-mw * 0.5, my - 1.9 * lk - lift * 0.4, -mw * 0.13, my - 1.7 * lk); q.quadraticCurveTo(0, my - 0.8 * lk, mw * 0.13, my - 1.7 * lk); q.quadraticCurveTo(mw * 0.5, my - 1.9 * lk - lift * 0.4, mw, my - lift); q.quadraticCurveTo(0, my + 0.35, -mw, my - lift); q.closePath(); return q; };
  const lower = (lift) => { const q = new Path2D(); q.moveTo(-mw * 0.9, my + 0.1 - lift * 0.6); q.quadraticCurveTo(0, my + 3.9 * lk, mw * 0.9, my + 0.1 - lift * 0.6); q.quadraticCurveTo(0, my + 0.55, -mw * 0.9, my + 0.1 - lift * 0.6); q.closePath(); return q; };
  const shut = (lift) => {
    softBlob(ctx, 0, my + 3.4 * lk + 1.4, mw * 0.8, 1.6, '#3a1612', 0.2);                              // the shadow under the lower lip
    const lo = lower(lift), up = upper(lift);
    const lg = ctx.createLinearGradient(0, my, 0, my + 3.4 * lk); lg.addColorStop(0, HX(P.lip, -0.05)); lg.addColorStop(0.6, lipL); lg.addColorStop(1, HX(P.lip, -0.05));
    ctx.globalAlpha = female ? 0.96 : 0.62 + 0.1 * (lk - 1); ctx.fillStyle = lg; ctx.fill(lo);
    ctx.fillStyle = lipU; ctx.fill(up); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.beginPath(); ctx.ellipse(-0.5, my + 1.7 * lk, 1.9 * lk, 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(38,10,12,.9)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-mw, my - lift); ctx.quadraticCurveTo(0, my + 0.8 + lift * 0.1, mw, my - lift); ctx.stroke();
    softBlob(ctx, -mw, my - lift, 1.6, 1.4, '#3a1612', 0.3); softBlob(ctx, mw, my - lift, 1.6, 1.4, '#3a1612', 0.3);               // the corners
  };
  if (m === 'closed') shut(mood * 1.5);
  else if (m === 'smile') shut(1.3 + mood * 1.0);
  else if (m === 'sad') shut(-1.4 + mood * 0.3);
  else if (m === 'o') {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, my + 1.4, 2.7, 3.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = lipU; ctx.lineWidth = 1.6; ctx.stroke();
  } else if (m === 'grin') {
    const gr = new Path2D(); gr.moveTo(-mw * 1.08, my - 1.9); gr.quadraticCurveTo(0, my + 7.8, mw * 1.08, my - 1.9); gr.quadraticCurveTo(0, my - 0.4, -mw * 1.08, my - 1.9); gr.closePath();
    ctx.fillStyle = dark; ctx.fill(gr); ctx.save(); ctx.clip(gr);
    const tg = ctx.createLinearGradient(0, my - 2.4, 0, my + 1.8); tg.addColorStop(0, '#fbf8f1'); tg.addColorStop(1, '#d9d1c5'); ctx.fillStyle = tg; ctx.fillRect(-mw * 1.2, my - 2.4, mw * 2.4, 3.4);
    ctx.strokeStyle = 'rgba(120,100,90,.5)'; ctx.lineWidth = 0.35; ctx.beginPath(); for (let k = -3; k <= 3; k++) { ctx.moveTo(k * mw * 0.26, my - 2.4); ctx.lineTo(k * mw * 0.26, my + 1); } ctx.stroke();
    ctx.fillStyle = '#c25566'; ctx.beginPath(); ctx.ellipse(0, my + 5.4, 3.8, 1.8, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lipU; ctx.lineWidth = 1.2; ctx.stroke(gr);
    ctx.strokeStyle = rgba(P.line, 0.3); ctx.lineWidth = 0.7; ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(s * (mw * 1.12), my - 2.2); ctx.quadraticCurveTo(s * (mw * 1.3), my - 1.2, s * (mw * 1.18), my + 0.4); } ctx.stroke();
  } else {
    const big = m === 'shout' ? 1 : 0.7, wd = mw * (m === 'shout' ? 1.0 : 0.92);
    const op = new Path2D(); op.moveTo(-wd, my - 1.2); op.quadraticCurveTo(0, my - 2.4, wd, my - 1.2); op.quadraticCurveTo(wd * 0.9, my + 8.4 * big, 0, my + 9 * big); op.quadraticCurveTo(-wd * 0.9, my + 8.4 * big, -wd, my - 1.2); op.closePath();
    ctx.fillStyle = dark; ctx.fill(op); ctx.save(); ctx.clip(op);
    const tg = ctx.createLinearGradient(0, my - 2.4, 0, my + 1.2); tg.addColorStop(0, '#fbf8f1'); tg.addColorStop(1, '#d9d1c5'); ctx.fillStyle = tg; ctx.fillRect(-wd, my - 2.4, wd * 2, 3.3);
    ctx.fillStyle = '#c25566'; ctx.beginPath(); ctx.ellipse(0, my + 7.6 * big, 4, 2.4 * big + 0.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lipU; ctx.lineWidth = 1.4; ctx.stroke(op);
  }
  ctx.restore();
}

// ---- moustache and beard -----------------------------------------------------------------------------------------------
function frontStache(ctx, look, g) {
  const P = g.P, my = g.mouthY, sw = look.stacheW || 1, sh = look.stacheH || 1, col = look.stache || (look.beard && look.beard.color);
  if (!col) return;
  const Y = (k) => my + k * sh;
  const q = new Path2D(); q.moveTo(0, Y(-3.2));
  q.bezierCurveTo(2.2 * sw, Y(-4.8), 6.4 * sw, Y(-4.3), 8.4 * sw, Y(-2.2)); q.bezierCurveTo(9.6 * sw, Y(-0.8), 9.2 * sw, Y(0.9), 8.2 * sw, Y(1.3));
  q.bezierCurveTo(6.6 * sw, Y(-0.4), 3.2 * sw, Y(-0.2), 0, Y(-1.7)); q.bezierCurveTo(-3.2 * sw, Y(-0.2), -6.6 * sw, Y(-0.4), -8.2 * sw, Y(1.3));
  q.bezierCurveTo(-9.2 * sw, Y(0.9), -9.6 * sw, Y(-0.8), -8.4 * sw, Y(-2.2)); q.bezierCurveTo(-6.4 * sw, Y(-4.3), -2.2 * sw, Y(-4.8), 0, Y(-3.2)); q.closePath();
  softBlob(ctx, 0, Y(1.6), 8.5 * sw, 1.6, '#000000', 0.12);
  ctx.fillStyle = col; ctx.fill(q);
  ctx.save(); ctx.clip(q);
  const rn = fRng(fSeed(look) ^ 0x1b873593);
  for (let i = 0; i < 90; i++) {
    const x = (rn() * 2 - 1) * 9 * sw, y = Y(-4.6 + rn() * 5.6), s = x >= 0 ? 1 : -1;
    ctx.strokeStyle = rgba(rn() < 0.5 ? HX(col, 0.3) : HX(col, -0.4), 0.55); ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x + s * 1.1, y + 1.5 * sh); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(HX(col, -0.6), 0.7); ctx.stroke(q);
}

function frontBeard(ctx, look, g) {
  const R = g.R, fw = g.fw, my = g.mouthY, P = g.P, bd = look.beard, B = g.bstr;
  const bl = ((bd && bd.len) || 0) * 7, fl = (bd && bd.flare) || 0, cy = g.chinY;
  let right, upper;
  if (bd && bd.style === 'goatee') {
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
    const fg = ctx.createLinearGradient(0, my - 6, 0, cy + bl * 0.7 + 3);
    fg.addColorStop(0, rgba(bd.color, 0.5)); fg.addColorStop(0.25, bd.color); fg.addColorStop(0.45, bd.color); fg.addColorStop(0.88, bd.chin || bd.color);
    ctx.fillStyle = fg; ctx.fill(shape);
    ctx.save(); ctx.clip(shape);
    const bg = ctx.createLinearGradient(0, 0, 0, 34 + bl); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = bg; ctx.fillRect(-34, -4, 68, 70 + bl);
    const mixc = bd.mix || HX(bd.color, 0.4);
    ctx.lineWidth = 0.55; ctx.lineCap = 'round';
    const y0g = my - 6, y1g = cy + bl * 0.7 + 3, vg = (a, b) => { const q = ctx.createLinearGradient(0, y0g, 0, y1g); q.addColorStop(0, a); q.addColorStop(0.3, a); q.addColorStop(0.9, b); return q; };   // the strands change from the colour of the cheeks to the colour of the chin
    ctx.strokeStyle = vg(rgba(HX(bd.color, -0.5), 0.55), rgba(HX(bd.chin || bd.color, -0.42), 0.5)); ctx.stroke(B.d);
    ctx.strokeStyle = vg(rgba(mixc, bd.chin ? 0.2 : 0.5), rgba(mixc, 0.55)); ctx.lineWidth = 0.6; ctx.stroke(B.m);
    ctx.strokeStyle = vg(rgba(HX(bd.color, 0.3), 0.3), rgba(HX(bd.chin || bd.color, 0.38), 0.5)); ctx.lineWidth = 0.5; ctx.stroke(B.l);
    softBlob(ctx, -9 * fw, 8, 7, 9, '#ffffff', 0.06);
    ctx.restore();
    const outl = new Path2D(); addSpline(outl, full, true);
    ctx.lineWidth = 0.9; ctx.strokeStyle = rgba(HX(bd.color, -0.62), 0.8); ctx.stroke(outl);
    if (bd.style !== 'goatee') {                                                                           // a trimmed patch around the mouth, so that the lips show in the beard
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, my + 0.9, 8.6 * (look.mouthW || 1), 4.4, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = P.skD; ctx.fillRect(-12, my - 6, 24, 14); ctx.restore();
      softBlob(ctx, 0, my + 0.9, 9.4 * (look.mouthW || 1), 4.8, P.skD, 0.5);
    }
  } else {
    const st = look.stubble, hc = P.hc;
    ctx.save(); ctx.clip(g.face);
    softBlob(ctx, 0, 16, 22 * fw, 14, hc, 0.08 + 0.3 * st);                                               // the shadow of the beard under the skin
    softBlob(ctx, 0, my - 3.4, 8.6 * (look.mouthW || 1), 2.4, hc, 0.06 + 0.26 * st);                        // above the lip
    ctx.fillStyle = rgba(HX(hc, -0.1), 0.2 + 0.45 * st); ctx.fill(B.dots);
    ctx.restore();
  }
}

function frontGlasses(ctx, look, g, ey, ex, eK, fw) {
  const gl = look.glasses, col = gl.color || '#222', lw = gl.lw || 1.25;
  const w = 9.8 * eK + 4.6, h = (gl.shape === 'round' ? 10 : 8.6) * (0.85 + 0.15 * eK);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const sg of [1, -1]) {
    const cx = sg * ex, lens = new Path2D();
    if (gl.shape === 'round') lens.ellipse(cx, ey - 0.2, w / 2, h / 2, 0, 0, TAU); else { const r = 2.2; if (lens.roundRect) lens.roundRect(cx - w / 2, ey - 0.2 - h / 2, w, h, r); else lens.rect(cx - w / 2, ey - 0.2 - h / 2, w, h); }
    ctx.save(); ctx.translate(0, 0.9); ctx.strokeStyle = 'rgba(40,18,12,.2)'; ctx.lineWidth = lw + 1.2; ctx.stroke(lens); ctx.restore();                // the shadow of the frame on the skin
    const lg = ctx.createLinearGradient(cx - w / 2, ey - h / 2, cx + w / 2, ey + h / 2); lg.addColorStop(0, 'rgba(210,235,255,.26)'); lg.addColorStop(0.5, 'rgba(190,220,245,.08)'); lg.addColorStop(1, 'rgba(210,235,255,.18)');
    ctx.fillStyle = lg; ctx.fill(lens);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(lens);
    if (lw > 1.6) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = lw * 0.25; ctx.stroke(lens); }
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - w * 0.28, ey - 0.2 - h * 0.26); ctx.lineTo(cx - w * 0.06, ey - 0.2 - h * 0.34); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(sg * (ex + w / 2), ey - 2.2); ctx.lineTo(sg * (20.6 * fw + 0.6), ey - 1.4); ctx.stroke();
  }
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-ex + w / 2, ey - 2.2); ctx.quadraticCurveTo(0, ey - 4, ex - w / 2, ey - 2.2); ctx.stroke();
}

function frontAgeLines(ctx, look, g, ey, ex) {
  const P = g.P, age = look.age || 0, bags = look.bags || 0, nw = g.nwq, my = g.mouthY, ny = g.noseY, fw = g.fw, a = Math.max(age, 0.12);
  const line = (draw, alpha, w) => { ctx.strokeStyle = rgba(P.line, alpha * 0.22); ctx.lineWidth = w * 1.9; ctx.beginPath(); draw(); ctx.stroke(); ctx.strokeStyle = rgba(P.line, alpha * 0.62); ctx.lineWidth = w * 0.8; ctx.beginPath(); draw(); ctx.stroke(); };
  ctx.lineCap = 'round';
  line(() => { for (const sg of [1, -1]) { ctx.moveTo(sg * (3.6 + nw * 1.4), ny + 0.4); ctx.quadraticCurveTo(sg * (8.4 + nw), my - 3.5, sg * (8.8 + (look.mouthW || 1) * 3.4), my + 1.4); } }, 0.18 + 0.36 * a, 0.7);       // the folds beside the nose
  line(() => { for (const sg of [1, -1]) { ctx.moveTo(sg * (ex + 5.6), ey - 0.8); ctx.lineTo(sg * (ex + 9), ey - 2.6); ctx.moveTo(sg * (ex + 5.8), ey + 0.6); ctx.lineTo(sg * (ex + 9.4), ey + 0.6); if (age > 0.5) { ctx.moveTo(sg * (ex + 5.4), ey + 2); ctx.lineTo(sg * (ex + 8.8), ey + 3.4); } } }, 0.14 + 0.36 * a, 0.6);   // crow's feet
  if (age > 0.4) line(() => { ctx.moveTo(-9 * fw, -19.6); ctx.quadraticCurveTo(0, -21, 9 * fw, -19.6); ctx.moveTo(-8 * fw, -16.8); ctx.quadraticCurveTo(0, -18, 8 * fw, -16.8); if (age > 0.65) { ctx.moveTo(-7 * fw, -14.2); ctx.quadraticCurveTo(0, -15.2, 7 * fw, -14.2); } ctx.moveTo(-1.6, ey - 8); ctx.lineTo(-1.2, ey - 11.2); ctx.moveTo(1.6, ey - 8); ctx.lineTo(1.2, ey - 11.2); }, 0.12 + 0.3 * age, 0.65);   // forehead and frown lines
  if (age > 0.55) line(() => { for (const sg of [1, -1]) { ctx.moveTo(sg * (9.6 + (look.mouthW || 1) * 3), my + 2.6); ctx.quadraticCurveTo(sg * 11.4, my + 7, sg * 9.2, g.chinY - 6.5); } }, 0.1 + 0.26 * age, 0.65);                  // the lines from the mouth to the chin
  if ((look.jowl || 0) > 0.35) line(() => { for (const sg of [1, -1]) { ctx.moveTo(sg * (12.2 * fw), my + 3); ctx.quadraticCurveTo(sg * (9 * fw), g.chinY - 2, sg * 3.2, g.chinY - 0.6); } }, 0.12 + 0.3 * look.jowl, 0.7);   // jowls
  if ((look.jowl || 0) > 0.6) line(() => { ctx.moveTo(-8 * fw, g.chinY - 1.6); ctx.quadraticCurveTo(0, g.chinY + 0.8, 8 * fw, g.chinY - 1.6); }, 0.12 + 0.2 * look.jowl, 0.6);                   // a double chin
}

// ---- hair ------------------------------------------------------------------------------------------------------------
function paintHairFill(ctx, look, g, region, S, alpha) {
  const P = g.P, hc = P.hc;
  ctx.save(); ctx.clip(region);
  const hg = ctx.createLinearGradient(-18, -34, 14, -4); hg.addColorStop(0, P.hL); hg.addColorStop(0.45, hc); hg.addColorStop(1, P.hD);
  ctx.globalAlpha = alpha; ctx.fillStyle = hg; ctx.fillRect(-40, -40, 80, 70); ctx.globalAlpha = 1;
  const mixc = P.mix || P.hLL;
  ctx.lineCap = 'round'; ctx.lineWidth = 0.55;
  ctx.strokeStyle = rgba(P.hDD, 0.5); ctx.stroke(S.d);
  ctx.strokeStyle = rgba(P.mix || P.hL, 0.55); ctx.stroke(S.m);
  ctx.strokeStyle = rgba(P.hLL, 0.45); ctx.lineWidth = 0.5; ctx.stroke(S.l);
  softBlob(ctx, -7, -24, 14, 6, '#ffffff', rgb(hc)[0] + rgb(hc)[1] + rgb(hc)[2] > 420 ? 0.22 : 0.13, -0.2);                      // the sheen
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// the whole head
// ---------------------------------------------------------------------------------------------------------------
function drawFrontHead(ctx, look, p, C) {
  const g = frontGeo(look), P = g.P, fw = g.fw, H = g.hair, hs = H && H.hs;
  const eK = Math.min(1.34, faceK(look.eyeSize, 'eye')), ey = -5.2, ex = (9.2 + (eK - 1) * 3.6) * (look.eyeGap || 1) * (0.9 + 0.1 * fw);
  if (look.hat) { ctx.translate(0, 7); ctx.scale(0.86, 0.86); }              // the hat has to fit the circle
  const fit = Math.min(1, 29.5 / (g.chinY + 1.5), 35 / (20.6 * fw + 7));   // a long or a wide face is drawn smaller, so that the chin and the ears are not cut by the ring
  if (fit < 1) { ctx.translate(0, -30); ctx.scale(fit, fit); ctx.translate(0, 30); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hairLine = HX(P.hc, -0.58);

  // ---- long hair behind the head, and the locks in front of the shoulders
  if (H && H.back) {
    const bg = ctx.createLinearGradient(0, -30, 0, 40); bg.addColorStop(0, P.hc); bg.addColorStop(1, P.hD);
    ctx.fillStyle = bg; ctx.fill(H.back);
    ctx.save(); ctx.clip(H.back); ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(P.hDD, 0.5); ctx.stroke(H.V.d); ctx.strokeStyle = rgba(P.hL, 0.4); ctx.stroke(H.V.l); ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(hairLine, 0.9); ctx.stroke(H.back);
  }
  frontBust(ctx, look, g);
  if (H && H.lockR) {
    for (const lk of [H.lockR, H.lockL]) {
      const lg = ctx.createLinearGradient(0, 0, 0, 44); lg.addColorStop(0, P.hc); lg.addColorStop(1, P.hD);
      ctx.fillStyle = lg; ctx.fill(lk);
      ctx.save(); ctx.clip(lk); ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(P.hDD, 0.5); ctx.stroke(H.V.d); ctx.strokeStyle = rgba(P.hL, 0.45); ctx.stroke(H.V.l); ctx.restore();
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(hairLine, 0.9); ctx.stroke(lk);
    }
  }
  // hair above and behind the ears (a bald crown): drawn first, so the ears stay in front of it
  if (H && H.sidesR) {
    for (const sp of [H.sidesR, H.sidesL]) { paintHairFill(ctx, look, g, sp, H.S, 1); ctx.lineWidth = 1; ctx.strokeStyle = rgba(hairLine, 0.9); ctx.stroke(sp); }
  }

  // ---- ears (and the earring)
  const eEar = faceK(look.ear, 'ear'), eOut = (look.earOut || 0) * 2.2;
  for (const sg of [1, -1]) {
    ctx.save(); ctx.translate(sg * (20.4 * fw + 1.0 + eOut), 1.8); ctx.rotate(sg * (0.12 + eOut * 0.05));
    const eg = ctx.createLinearGradient(-3 * sg, 0, 3 * sg, 0); eg.addColorStop(0, P.skD); eg.addColorStop(1, P.sk);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.7 * eEar, 5.3 * eEar, 0, 0, TAU); ctx.fillStyle = eg; ctx.fill(); ctx.lineWidth = 0.95; ctx.strokeStyle = rgba(P.line, 0.9); ctx.stroke();
    ctx.strokeStyle = rgba(P.skDD, 0.55); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(sg * -0.35, 0.2, 1.3 * eEar, 3.5 * eEar, 0, -1.2, 2.6); ctx.stroke();
    ctx.fillStyle = rgba(P.skDD, 0.4); ctx.beginPath(); ctx.ellipse(sg * -0.1, 0.5, 0.8, 2.2 * eEar, 0, 0, TAU); ctx.fill();
    if (look.hoop) { ctx.beginPath(); ctx.arc(0.2 * sg, 5.3 * eEar + 5.2, 4.1, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = HX(look.hoop, -0.5); ctx.stroke(); ctx.lineWidth = 0.8; ctx.strokeStyle = look.hoop; ctx.stroke(); }
    if (look.earring) { ctx.beginPath(); ctx.arc(0, 5.3 * eEar + 1.6, 1.6, 0, TAU); ctx.fillStyle = look.earring; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = HX(look.earring, -0.6); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-0.5, 5.3 * eEar + 1.1, 0.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---- the face: skin, light and shadow
  const chk = faceK(look.cheek, 'cheek'), rdg = faceK(look.ridge, 'ridge'), ruddy = look.ruddy || 0, my = g.mouthY;
  const gr = ctx.createRadialGradient(-4, -9, 3, 0, 2, 40);
  gr.addColorStop(0, P.skL); gr.addColorStop(0.5, P.sk); gr.addColorStop(1, P.skD);
  ctx.fillStyle = gr; ctx.fill(g.face);
  ctx.save(); ctx.clip(g.face);
  const sg2 = ctx.createLinearGradient(-21 * fw, 0, 21 * fw, 0);                                           // the light comes from the left
  sg2.addColorStop(0, 'rgba(50,20,15,.12)'); sg2.addColorStop(0.18, 'rgba(50,20,15,0)'); sg2.addColorStop(0.7, 'rgba(50,20,15,0)'); sg2.addColorStop(1, 'rgba(50,20,15,.34)');
  ctx.fillStyle = sg2; ctx.fillRect(-46, -40, 92, 80);
  const sg3 = ctx.createLinearGradient(0, g.noseY, 0, g.chinY); sg3.addColorStop(0, 'rgba(90,35,25,0)'); sg3.addColorStop(1, 'rgba(90,35,25,.26)'); ctx.fillStyle = sg3; ctx.fillRect(-46, g.noseY, 92, 50);
  softBlob(ctx, -2, -19, 12, 5.5, '#ffffff', 0.15);                                                         // the forehead
  softBlob(ctx, -11.5 * fw, 1.5, 5.5, 4, '#ffffff', 0.1);                                                  // the cheekbone in the light
  for (const sg of [1, -1]) {
    softBlob(ctx, sg * ex, ey + 0.4, 8.4 * eK, 4.8, '#5a2a24', 0.1 + 0.13 * (rdg - 1) + 0.12 * (look.lid || 0) + 0.12 * (look.bags || 0));      // the eye sockets
    softBlob(ctx, sg * 12.4 * fw, 6.4, 6.4, 4.6, P.flush, (look.female ? 0.22 : 0.14) + ruddy * 0.26);                                          // the cheeks
    if (chk < 0.95) softBlob(ctx, sg * 13.4 * fw, 9.5, 4, 7, '#5a2a22', (1 - chk) * 0.3);                                                       // hollow cheeks
    softBlob(ctx, sg * 17.5 * fw, -10, 3.6, 6.5, '#5a2a22', 0.08);                                                                              // the temples
  }
  softBlob(ctx, 0, my + 6.2, 6.2, 2.4, '#3a1612', 0.12);                                                    // under the mouth
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.17; ctx.drawImage(skinNoise(), -40, -36, 80, 76); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';   // pores
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(P.line, 0.9); ctx.stroke(g.face);

  frontAgeLines(ctx, look, g, ey, ex);
  if (look.beard || look.stubble) frontBeard(ctx, look, g);
  frontNose(ctx, look, g, ey);
  frontMouth(ctx, look, g, p);
  if (look.stache || look.beard) frontStache(ctx, look, g);
  frontEyes(ctx, look, g, p, ey, ex, eK);
  frontBrows(ctx, look, g, p, ey, ex, eK);
  if (look.glasses) frontGlasses(ctx, look, g, ey, ex, eK, fw);

  // ---- hair on top
  if (H && H.cap) {
    ctx.save(); ctx.translate(0, 0.9); ctx.strokeStyle = 'rgba(40,16,10,.2)'; ctx.lineWidth = 3.4; ctx.stroke(H.hln); ctx.restore();           // the shadow of the hair on the forehead
    paintHairFill(ctx, look, g, H.cap, H.S, hs.buzz ? 0.5 : hs.thin ? 0.9 : 1);
    ctx.save(); ctx.clip(H.cap); ctx.strokeStyle = 'rgba(15,6,3,.28)'; ctx.lineWidth = 3.2; ctx.stroke(H.hln); ctx.restore();                  // the roots, darker at the hairline
    ctx.lineWidth = hs.buzz ? 0.8 : 1.1; ctx.strokeStyle = rgba(hairLine, 0.92); ctx.stroke(H.sil);
    ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(hairLine, 0.35); ctx.stroke(H.hln);
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(P.hD, 0.75); ctx.stroke(H.ticks);
    if (look.hair.part !== undefined) {                                                                                   // the parting: a dark line from the hairline up over the head
      const px = look.hair.part, py = fYat(g.hair.hairPts, px);
      ctx.save(); ctx.clip(H.cap); ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(P.hDD, 0.7); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(px, py + 0.6); ctx.quadraticCurveTo(px - 0.6, (py + g.topY) / 2, px + 1.6, g.topY + 3); ctx.stroke();
      ctx.strokeStyle = rgba(P.hLL, 0.4); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(px + 0.9, py + 0.4); ctx.quadraticCurveTo(px + 0.3, (py + g.topY) / 2, px + 2.5, g.topY + 3); ctx.stroke();
      ctx.restore();
    }
  }
  if (look.hair && (look.hair.style === 'none' || look.hair.style === 'sides')) {                      // a bald crown shines
    softBlob(ctx, -4, -22.6, 11, 4, '#ffffff', 0.26, -0.08);
    softBlob(ctx, 8, -19.6, 5, 2, '#ffffff', 0.16, 0.2);
  }

  // ---- kippah: a cap on the top of the head, seen from the front (the upper edge follows the head, the rim dips towards the forehead)
  if (look.kippah) {
    const kc = look.kippah, sz = kc.s || 1, w = (kc.knit ? 10.6 : 9.2) * sz, kx = 1.4 + (kc.x || 0), apex = g.topY - 0.5 + (kc.y || 0), hgt = (kc.knit ? 8.2 : 7.2) * (0.8 + 0.2 * sz), yb = apex + hgt;
    const cap = new Path2D();
    cap.moveTo(kx - w, yb - 0.4); cap.bezierCurveTo(kx - w, apex + hgt * 0.15, kx - w * 0.55, apex, kx, apex); cap.bezierCurveTo(kx + w * 0.55, apex, kx + w, apex + hgt * 0.15, kx + w, yb - 0.4);
    cap.quadraticCurveTo(kx, yb + 3.2, kx - w, yb - 0.4); cap.closePath();
    softBlob(ctx, kx, yb + 1.2, w * 0.95, 2.2, '#000000', 0.24);
    const kg = ctx.createRadialGradient(kx - w * 0.25, apex + 2, 1, kx, apex + hgt * 0.5, w * 1.05); kg.addColorStop(0, HX(kc.color, 0.3)); kg.addColorStop(0.55, kc.color); kg.addColorStop(1, HX(kc.color, -0.32));
    ctx.fillStyle = kg; ctx.fill(cap);
    ctx.save(); ctx.clip(cap);
    if (kc.knit) {                                                                                         // a knitted kippah: rings of a pattern and the stitches
      ctx.strokeStyle = kc.knit; ctx.lineWidth = 0.9;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(kx, apex + hgt * 0.62, w * (0.26 * k), hgt * (0.15 + 0.15 * k), 0, Math.PI, TAU); ctx.stroke(); }
      ctx.strokeStyle = rgba(HX(kc.color, -0.5), 0.35); ctx.lineWidth = 0.4; ctx.beginPath();
      for (let k = -6; k <= 6; k++) { ctx.moveTo(kx + k * 0.8, apex + hgt * 0.4); ctx.lineTo(kx + k * w * 0.16, yb + 2); }
      ctx.stroke();
    } else { softBlob(ctx, kx - w * 0.3, apex + 2.2, w * 0.5, 1.6, '#ffffff', 0.22); }
    softBlob(ctx, kx, apex + hgt * 0.5, w * 1.2, hgt * 0.7, '#ffffff', 0.08);
    ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = HX(kc.color, -0.62); ctx.stroke(cap);
  }

  // ---- black brimmed hat
  if (look.hat) {
    const hc = look.hat.color || '#121118';
    ctx.save(); ctx.translate(0, -21);
    const brim = new Path2D(); brim.ellipse(0, 0.6, 30, 6.6, 0, 0, TAU);
    const bg = ctx.createLinearGradient(0, -6, 0, 7); bg.addColorStop(0, HX(hc, 0.16)); bg.addColorStop(1, HX(hc, -0.1)); ctx.fillStyle = bg; ctx.fill(brim); ctx.lineWidth = 1.2; ctx.strokeStyle = HX(hc, -0.6); ctx.stroke(brim);
    const crown = new Path2D(); crown.moveTo(-17.6, 0.2); crown.bezierCurveTo(-18.8, -13, -14.5, -20.6, -4, -20.9); crown.quadraticCurveTo(0, -17.8, 4, -20.9); crown.bezierCurveTo(14.5, -20.6, 18.8, -13, 17.6, 0.2); crown.closePath();
    const cg = ctx.createLinearGradient(-18, -20, 18, 0); cg.addColorStop(0, HX(hc, 0.22)); cg.addColorStop(0.5, hc); cg.addColorStop(1, HX(hc, -0.2)); ctx.fillStyle = cg; ctx.fill(crown); ctx.lineWidth = 1.2; ctx.stroke(crown);
    ctx.fillStyle = HX(hc, 0.3); ctx.globalAlpha = 0.3; ctx.fillRect(-17.6, -6.4, 35.2, 3.4); ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ===== 3D fighters, part 4: the head. A displaced ellipsoid with a nose, ears, hair / beard shells, kippah, hat and glasses. =====
// Head space: x forward, y up, z lateral (towards the camera). One unit = one head unit (the head is about 44 tall).

const HD = { Rf: 18.2, Ry: 21.4, Rl: 16.0 };
const bump = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const ipoly = (xs, ys, x) => {                       // piecewise-linear lookup
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * ((x - xs[i]) / (xs[i + 1] - xs[i]));
  return ys[ys.length - 1];
};

// Point on the (displaced) skull for longitude th (0 = straight ahead, +pi/2 = the near side) and latitude ph (-pi/2 chin .. +pi/2 crown)
function headPt(th, ph, look) {
  const cp = Math.cos(ph), sp = Math.sin(ph), ct = Math.cos(th), st = Math.sin(th);
  const female = !!look.female;
  // individual face structure (all optional, 1 = average): fw head width, len face length, cheek fullness, chin size, jaw width, jowl (heavy
  // lower cheeks, 0..1), ridge (brow ridge), fore (forehead prominence), lips (fullness), eyeGap
  const G = faceK;                                     // a caricature: differences between people are exaggerated (FG)
  const fw = Math.max(0.84, Math.min(1.24, G(look.fw, 'fw'))), chk = G(look.cheek, 'cheek'), chinK = G(look.chin, 'chin'), jk = G(look.jaw, 'jaw'), jowl = (look.jowl || 0) * FACE_GAIN;
  const ridge = G(look.ridge, 'ridge'), fore = G(look.fore, 'fore'), lipK = G(look.lips, 'lips'), eg = look.eyeGap || 1, lenK = look.len || 1;
  const low = sstep(0.1, -1.2, ph);                                   // 0 above the cheeks .. 1 at the chin
  let f = HD.Rf * cp * ct, y = HD.Ry * sp - (lenK - 1) * 20 * low, l = HD.Rl * fw * cp * st;       // len: the lower face is longer (or shorter)
  l *= 1 - low * ((female ? 0.3 : 0.2) - (jk - 1) * 0.55);
  f *= 1 - 0.05 * low;
  const at = Math.abs(th);
  f += 1.3 * fore * bump(ph, 0.78, 0.26) * bump(th, 0, 0.6);                                        // forehead
  f += (female ? 1.4 : 2.5) * ridge * bump(ph, 0.36, 0.13) * bump(at, 0.38, 0.55);                 // brow ridge
  f -= 2.2 * bump(ph, 0.14, 0.15) * bump(at, 0.36 * eg, 0.17);                                      // eye sockets
  l += Math.sign(st) * (1.5 * chk + 0.6 * (chk - 1)) * bump(ph, -0.1, 0.26) * bump(at, 0.85, 0.36);  // cheekbones
  l += Math.sign(st) * 0.9 * (chk - 1) * bump(ph, -0.4, 0.34) * bump(at, 1.05, 0.5);                // fuller (or leaner) cheeks
  l += Math.sign(st) * jowl * 1.5 * bump(ph, -0.78, 0.26) * bump(at, 1.1, 0.5);                      // jowls
  f += 1.5 * lipK * bump(ph, -0.66, 0.1) * bump(th, 0, 0.28);                                       // upper lip
  f += 2.3 * lipK * bump(ph, -0.88, 0.12) * bump(th, 0, 0.26);                                      // lower lip
  f += (3.0 * chinK + (jk - 1) * 4) * bump(ph, -1.12, 0.16) * bump(th, 0, (female ? 0.42 : 0.52) * (0.85 + 0.15 * chinK));   // chin
  l += Math.sign(st) * (female ? 1.2 : 1.9) * bump(ph, -0.72, 0.26) * bump(at, 1.25, 0.42) * jk;      // jaw angle
  f -= 0.8 * bump(ph, 0.1, 0.35) * bump(Math.PI - at, 0, 0.6);                                       // back of the skull
  return [f, y, l];
}
function ellNormal(p, rl = HD.Rl) { return V3.norm([p[0] / (HD.Rf * HD.Rf), p[1] / (HD.Ry * HD.Ry), p[2] / (rl * rl)]); }

function headGrid(look, nu, nv) {
  const P = [], TH = [], PH = [];
  for (let j = 0; j < nv; j++) {
    const ph = -Math.PI / 2 + (j / (nv - 1)) * Math.PI;
    for (let i = 0; i < nu; i++) { const th = -Math.PI + (i / (nu - 1)) * TAU; TH.push(th); PH.push(ph); P.push(headPt(th, ph, look)); }
  }
  return { P, TH, PH, nu, nv };
}

// hairline latitude by style and angle from the front (knots: at = 0, .5, 1, 1.4, 1.9, 2.5, pi)
const HAIRLINE = {
  crop:  [0.66, 0.60, 0.40, 0.34, 0.03, -0.32, -0.38],
  swoop: [0.76, 0.62, 0.52, 0.36, 0.03, -0.30, -0.38],
  part:  [0.70, 0.62, 0.44, 0.34, 0.04, -0.32, -0.38],
  wavy:  [0.64, 0.58, 0.42, 0.30, -0.05, -0.5, -0.56],
};
const HL_AT = [0, 0.5, 1.0, 1.4, 1.9, 2.5, Math.PI];
const hairline = (k, at) => ipoly(HL_AT, k, at);

function buildHeadMeshes(look, pal) {
  const RLL = HD.Rl * Math.max(0.84, Math.min(1.24, faceK(look.fw, 'fw')));                    // this person's head half-width
  const skinMesh = new Mesh(3200, 15000), hairMesh = new Mesh(14000, 60000), accMesh = new Mesh(2600, 12000);
  const G = headGrid(look, 73, 49);
  const skinCol = packRGBA(1, 1, 1, 1);
  const skinMat = packMat(0.24, 0.3, 0.5, LAYER.FACE, CLS.SKIN);
  const skinRGB = hexRGB(pal.skin), skinTint = packRGBA(skinRGB[0], skinRGB[1], skinRGB[2], 1);
  const O = [0, 0, 0];
  // ---- skull: planar face texture on the front half, plain skin on the back
  const cutA = (G.nu - 1) / 4, cutB = 3 * (G.nu - 1) / 4;                  // th = -pi/2 and +pi/2
  const front = (i, side) => (i > cutA && i < cutB) || (i === cutA && side >= 0) || (i === cutB && side <= 0);
  gridSurface(skinMesh, G.P, G.nu, G.nv, false, O, (i, j, side) => {
    const p = G.P[j * G.nu + i];
    if (front(i, side)) return { uv: [Math.max(0.02, Math.min(0.98, (20 - p[2]) / 40)), Math.max(0.02, Math.min(0.98, (18 - p[1]) / 40))], col: skinCol, mat: skinMat };
    return { uv: [0.985, 0.985], col: skinCol, mat: skinMat };
  }, [cutA, cutB]);

  // ---- nose. Rings are cross-sections from the root (between the eyes) down to the tip; `proj` is how far the tip sticks out of the face
  {
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const female = !!look.female;
    const nk = clampN(faceK(look.nose, 'nose') * (female ? 0.92 : 1), 0.7, 1.55), nl = clampN(faceK(look.noseL, 'noseL'), 0.7, 1.6), nw = clampN(faceK(look.noseW, 'noseW'), 0.7, 1.5);
    const br = look.bridge || 0, td = look.noseT || 0, w0 = 0.65 + 0.35 * nk, dy = 1 + clampN((nk - 1) * 0.12, -0.08, 0.1);
    const proj = 4.2 * (0.45 + 0.55 * nk) * nl, tipFront = 18.1 + proj, D = 2.6;
    const T = [0, 0.22, 0.45, 0.68, 0.86, 1.0], Wd = [1.6, 2.1, 2.6, 3.1, 3.5, 3.2];
    const rings = T.map((t, i) => {
      const y = (5.8 - (5.8 + 6.3 * dy + td * 1.2) * t);
      const prof = Math.pow(t, 1.1) * (1 - 0.06 * Math.sin(t * Math.PI)) + br * 0.09 * Math.exp(-Math.pow((t - 0.42) / 0.26, 2));
      const fFront = 15.9 + (tipFront - 15.9) * prof - td * 0.5 * t * t;
      return [fFront - 0.9 * D, y, Wd[i] * nw * w0, D];
    });
    const tip = rings[rings.length - 1];
    rings.push([tip[0] - 2.1, tip[1] - 1.5 - td * 0.3, 2.6 * nw * w0, D * 0.85]);            // the underside, turning back to the lip
    const P = [], n = 14;
    for (const [f, y, w, d] of rings) for (let i = 0; i < n; i++) { const a = (i / n) * TAU; P.push([f + d * Math.cos(a) * 0.9, y, w * Math.sin(a)]); }
    gridSurface(skinMesh, P, n, rings.length, true, [12, -0.5, 0], (i, j) => { const p = P[j * n + i]; return { uv: [(20 - p[2]) / 40, (18 - p[1]) / 40], col: skinCol, mat: skinMat }; });
    for (const s of [-1, 1]) emitEllipsoid(skinMesh, [tip[0] - 0.6, tip[1] + 0.3, s * tip[2] * 0.72], [1.9 * w0, 0, 0], [0, 1.6 * w0, 0], [0, 0, 1.5 * (0.7 + 0.3 * nw)], skinCol, skinMat, { uv: [(20 - s * 3.1) / 40, (18 + 6.3) / 40], nu: 8, nv: 6 });      // the wings of the nostrils
  }

  // ---- ears
  const eK = faceK(look.ear, 'ear'), eOut = (look.earOut || 0) * 2.2;                      // earOut: ears that stick out
  for (const s of [-1, 1]) {
    emitEllipsoid(skinMesh, [-1.8, -1.2, s * (RLL - 0.3 + eOut * 0.5)], [2.6 * eK, 0.7, 0], [1.0, 5.0 * eK, 0], [0, 0, (1.3 + eOut * 0.4) * s], skinTint, packMat(0.2, 0.25, 0.4, LAYER.WHITE, CLS.SKIN), { nu: 10, nv: 7 });
    emitEllipsoid(skinMesh, [-1.5, -1.3, s * (RLL + 0.5 + eOut * 0.9)], [1.4 * eK, 0.4, 0], [0.5, 3.0 * eK, 0], [0, 0, 0.6 * s], c3(pal.skin, 0.72), packMat(0.1, 0.2, 0.3, LAYER.WHITE, CLS.SKIN), { nu: 8, nv: 6 });
  }

  // ---- shells (hair, beard, kippah): alpha-to-coverage, finer grid so the edges are smooth
  const H = headGrid(look, 97, 65), NU = H.nu, NV = H.nv;
  const style0 = look.hair ? look.hair.style : 'none';
  const style = { buzz: 'crop', curly: 'crop', comb: 'swoop', thin: 'part', layered: 'wavy', bob: 'wavy', spiky: 'crop' }[style0] || style0;                 // new 2D names that reuse a 3D shape ...
  const volK = { buzz: 0.45, thin: 0.55, curly: 1.3, comb: 1.05, layered: 1.2, spiky: 1.15 }[style0] || 1, hlAdd = style0 === 'thin' ? 0.12 : 0;    // ... with their own thickness
  const sweep = (look.hair && look.hair.sweep) || 0;              // a fringe swept to one side: lower on the near side, higher on the far side
  const hairMat = packMat(0.42, 0.2, 0.55, LAYER.HAIR, CLS.HAIR);
  const shell = (mesh, fieldFn, matv, uvfn, shadeFn) => {
    const PS = [], COV = [], SH = [];
    for (let k = 0; k < H.P.length; k++) {
      const { cov, t, shade } = fieldFn(H.TH[k], H.PH[k], H.P[k], k);
      const base = H.P[k], n = ellNormal(base, RLL), lift = cov > 0.02 ? Math.max(0.3, t) : 0.25;
      PS.push([base[0] + n[0] * lift, base[1] + n[1] * lift, base[2] + n[2] * lift]); COV.push(cov); SH.push(shade === undefined ? 1 : shade);
    }
    gridSurface(mesh, PS, NU, NV, false, O, (i, j) => { const k = j * NU + i, s = SH[k]; return { uv: uvfn(i, j, k), col: packRGBA(s, s, s, COV[k]), mat: matv }; });
  };
  if (style !== 'none' && style !== 'sides') {
    const kn = HAIRLINE[style];
    shell(hairMesh, (th, ph, base) => {
      const at = Math.abs(wrapPi(th)), Hl = hairline(kn, at) + ((look.hair.hl || 0) + hlAdd) * sstep(2.2, 0.4, at) + sweep * (0.14 - 0.24 * Math.tanh(th * 2.2)) * sstep(1.6, 0.1, at);      // hl > 0: receding hairline
      let cov = sstep(Hl - 0.08, Hl + 0.08, ph);
      const vol = (look.hair.vol || 1) * volK;
      let t = 0.5 + vol * (style === 'swoop' ? 1.5 : style === 'wavy' ? 1.6 : style === 'part' ? 1.4 : 1.0) * sstep(Hl, Hl + 0.7, ph);
      if (style === 'swoop') t += vol * 2.4 * bump(ph, 1.0, 0.34) * bump(at, 0.55, 0.85);
      if (style === 'part') t += vol * 2.0 * bump(ph, 1.0, 0.32) * bump(at, 0.45, 0.8) * (th > 0 ? 1 : 0.55);
      if (style === 'wavy') t += vol * 1.6 * bump(ph, 1.05, 0.4) * bump(at, 0.3, 0.8);
      if (ph > 1.4) cov = 1;
      return { cov, t, shade: 0.7 + 0.3 * sstep(Hl, Hl + 0.45, ph) };
    }, hairMat, (i, j) => [(i / (NU - 1)) * 3, (j / (NV - 1)) * 1.6]);
  }
  if (style === 'sides') {
    shell(hairMesh, (th, ph) => {
      const at = Math.abs(wrapPi(th));
      const top = 0.6 - 0.35 * sstep(1.7, 2.7, at);
      const cov = sstep(0.75, 1.05, at) * (1 - sstep(top - 0.1, top + 0.1, ph)) * sstep(-0.7, -0.5, ph + (at > 2.3 ? 0.2 : 0));
      return { cov, t: 1.2, shade: 0.75 + 0.25 * sstep(top, top - 0.4, ph) };
    }, hairMat, (i, j) => [(i / (NU - 1)) * 3, (j / (NV - 1)) * 1.6]);
  }
  // long hair behind the head (women): a curtain hanging from the crown down to the shoulders
  if (style === 'wavy') {
    const rows = 12, cols = 25, PS = [], flare = style0 === 'layered' ? 0.55 : 0;            // the ends of layered hair flick out
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);
      for (let i = 0; i < cols; i++) {
        const a = -2.05 + (i / (cols - 1)) * 4.1 + Math.PI, th = wrapPi(a), edge = Math.abs(i / (cols - 1) - 0.5) * 2;
        const yy = 8 - t * (look.hair.len || 42), wob = Math.sin(t * 5 + i * 0.7) * (style0 === 'layered' ? 3.2 : 1.4) * t;
        const rad = (0.98 - 0.16 * t + 0.06 * Math.sin(t * 3)) * (1 + 0.16 * t + flare * t * t) * (1 - 0.1 * edge * t);
        PS.push([Math.cos(th) * HD.Rf * rad - 3 * t + wob, yy, Math.sin(th) * RLL * 1.03 * rad]);
      }
    }
    gridSurface(hairMesh, PS, cols, rows, false, [0, -14, 0], (i, j) => ({ uv: [(i / (cols - 1)) * 2, (j / (rows - 1)) * 2], col: packRGBA(0.85 + 0.15 * (j / (rows - 1)), 0.85 + 0.15 * (j / (rows - 1)), 0.85 + 0.15 * (j / (rows - 1)), 1), mat: hairMat }));
  }

  // ---- beard / moustache
  const bMat = packMat(0.3, 0.16, 0.45, LAYER.BEARD, CLS.HAIR);
  if (look.beard) {
    const drop = (look.beard.len || 0) * 7;
    shell(hairMesh, (th, ph, base) => {
      const f = base[0], y = base[1], l = Math.abs(base[2]), at = Math.abs(wrapPi(th));
      const top = ipoly([0, 4, 6.5, 10, 13.5, 16.2], [-7.6, -7.6, -5.4, -2.6, 0.2, 1.4], l);
      let cov = sstep(-1.7, 1.7, top - y) * sstep(2.4, 1.7, at);
      const hole = Math.pow(base[2] / 7.4, 2) + Math.pow((y + 12.9) / 4.2, 2);
      cov *= sstep(0.95, 1.25, hole);
      if (look.beard.style === 'goatee') cov *= 1 - sstep(6.2, 9.2, l);                             // a moustache and a chin patch only
      if (y > -7.4 && l < 5.5) cov = 0;
      const t = 1.0 + 1.7 * sstep(-9, -20, y);
      return { cov, t, shade: 0.8 + 0.2 * sstep(4, -12, y) };
    }, bMat, (i, j, k) => [H.P[k][2] * 0.05, H.P[k][1] * 0.05]);
    if (drop > 0) {       // a long beard: a tapered tuft hanging below the chin
      const rows = 8, cols = 15, PS = [];
      for (let j = 0; j < rows; j++) {
        const t = j / (rows - 1);
        for (let i = 0; i < cols; i++) {
          const a = -1.25 + (i / (cols - 1)) * 2.5, w = (1 - 0.72 * t) * (0.85 + 0.15 * Math.cos(a));
          PS.push([HD.Rf * 0.66 * (1 - 0.35 * t) * Math.cos(a) * 0.6 + 6.5 - 3 * t, -18.5 - t * drop, RLL * 0.56 * w * Math.sin(a)]);
        }
      }
      gridSurface(hairMesh, PS, cols, rows, false, [0, -18, 0], (i, j) => ({ uv: [(i / (cols - 1)) * 1.4, (j / (rows - 1)) * 1.4], col: packRGBA(0.92, 0.92, 0.92, 1), mat: bMat }));
    }
  } else if (look.stache) {
    shell(hairMesh, (th, ph, base) => {
      const f = base[0], y = base[1], l = base[2];
      const yc = -8.55 - 0.05 * l * l, w = look.stacheW || 1;                                   // sits under the nose, ends drop towards the mouth corners
      const m = 1 - (Math.pow(l / (7.2 * w), 2) + Math.pow((y - yc) / (1.75 - 0.12 * Math.abs(l) / 3), 2));
      const cov = (f > 4 ? 1 : 0) * sstep(-0.05, 0.25, m) * (y > -7.4 && Math.abs(l) < 1.0 ? 0.6 : 1);
      return { cov: y > -6.8 ? 0 : cov, t: 1.0, shade: 0.9 };
    }, bMat, (i, j, k) => [H.P[k][2] * 0.05, H.P[k][1] * 0.05]);
  }

  // ---- kippah
  if (look.kippah) {
    const axis = V3.norm([-4, 18.5, 1.5]), e1 = V3.norm(V3.cross(axis, [0, 0, 1])), e2 = V3.cross(axis, e1);
    const nr = 8, na = 28, PS = [], R = 0.62, hasHair = style !== 'none' && style !== 'sides';
    for (let j = 0; j < nr; j++) {
      const r = (j / (nr - 1)) * R;
      for (let i = 0; i < na; i++) {
        const a = (i / na) * TAU, d = V3.add(V3.mul(axis, Math.cos(r)), V3.mul(V3.add(V3.mul(e1, Math.cos(a)), V3.mul(e2, Math.sin(a))), Math.sin(r)));
        const ph = Math.asin(Math.max(-1, Math.min(1, d[1]))), th = Math.atan2(d[2], d[0]);
        const base = headPt(th, ph, look), n = ellNormal(base, RLL), fall = j / (nr - 1);
        const lift = (hasHair ? 2.5 : 1.2) + 0.5 * (1 - fall) - 0.5 * sstep(0.8, 1, fall);
        PS.push([base[0] + n[0] * lift, base[1] + n[1] * lift, base[2] + n[2] * lift]);
      }
    }
    gridSurface(hairMesh, PS, na, nr, true, O, (i, j) => ({ uv: [(i / na), (j / (nr - 1)) * 0.96], col: packRGBA(1, 1, 1, 1), mat: packMat(0.18, 0.2, 0.4, LAYER.KNIT, CLS.CLOTH) }));
  }

  // ---- hat (black brimmed)
  if (look.hat) {
    const hc = hexRGB(look.hat.color || '#121118'), col = packRGBA(hc[0], hc[1], hc[2], 1), mat = packMat(0.22, 0.3, 0.3, LAYER.WHITE, CLS.CLOTH);
    const y0 = 14.6, tilt = -0.04, nA = 32;
    const ringsTop = [[15.8, 0], [19, 0.1], [23, 0.5], [27, 1.5], [28.2, 1.2]];
    const brim = (rs, dy, hint) => {
      const P = [];
      for (const [r, up] of rs) for (let i = 0; i < nA; i++) { const a = (i / nA) * TAU; P.push([Math.cos(a) * r * 1.02, y0 + up + dy + tilt * Math.cos(a) * r, Math.sin(a) * r * 0.98]); }
      gridSurface(accMesh, P, nA, rs.length, true, hint, { uv: WHITE_UV, col, mat });
    };
    brim(ringsTop, 0, [0, y0 - 6, 0]);
    brim(ringsTop.slice().reverse(), -0.7, [0, y0 + 8, 0]);
    const cr = [[y0, 15.6], [y0 + 2.4, 16.0], [y0 + 6.5, 15.7], [y0 + 10.5, 15.0], [y0 + 13, 13.2], [y0 + 14, 8], [y0 + 13.6, 3], [y0 + 12.8, 0.01]];
    const Pc = [];
    for (const [yy, r] of cr) for (let i = 0; i < nA; i++) { const a = (i / nA) * TAU; Pc.push([Math.cos(a) * r * 1.03, yy, Math.sin(a) * r * 0.97]); }
    gridSurface(accMesh, Pc, nA, cr.length, true, [0, y0 + 5, 0], { uv: WHITE_UV, col, mat });
    const bandCol = packRGBA(Math.min(1, hc[0] * 2.2 + 0.09), Math.min(1, hc[1] * 2.2 + 0.09), Math.min(1, hc[2] * 2.2 + 0.11), 1);
    const Pn = [];
    for (const [yy, r] of [[y0 + 1.2, 16.1], [y0 + 4.4, 16.15]]) for (let i = 0; i < nA; i++) { const a = (i / nA) * TAU; Pn.push([Math.cos(a) * r * 1.03, yy, Math.sin(a) * r * 0.97]); }
    gridSurface(accMesh, Pn, nA, 2, true, [0, y0 + 2, 0], { uv: WHITE_UV, col: bandCol, mat });
  }

  // ---- glasses
  if (look.glasses) {
    const gl = look.glasses, gc = hexRGB(gl.color || '#222'), col = packRGBA(gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3, 1), mat = packMat(0.85, 0.7, 0.4, LAYER.WHITE, CLS.METAL);
    const round = gl.shape === 'round', rx = round ? 5.0 : 5.5, ry = round ? 4.7 : 4.1;
    const surf = (l, y) => HD.Rf * Math.sqrt(Math.max(0.04, 1 - (y / HD.Ry) ** 2 - (l / RLL) ** 2)) + 1.5;
    for (const s of [-1, 1]) {
      const cx = s * 6.0, cy = 3.3, pts = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU; let ux = Math.cos(a), uy = Math.sin(a);
        if (!round) { ux = Math.sign(ux) * Math.pow(Math.abs(ux), 0.7); uy = Math.sign(uy) * Math.pow(Math.abs(uy), 0.7); }
        const l = cx + ux * rx, y = cy + uy * ry; pts.push([surf(l, y), y, l]);
      }
      for (let i = 0; i < pts.length; i++) emitTube(accMesh, pts[i], pts[(i + 1) % pts.length], 0.42, 0.42, col, mat, { sides: 5, rings: 2, bulge: 0 });
      const oL = cx + s * rx, from = [surf(oL, cy), cy, oL];
      emitTube(accMesh, from, [-1.5, 2.6, s * (RLL - 0.6)], 0.4, 0.4, col, mat, { sides: 5, rings: 3, bulge: 0 });
    }
    emitTube(accMesh, [surf(-1, 4.2), 4.2, -1.9], [surf(1, 4.2), 4.2, 1.9], 0.4, 0.4, col, mat, { sides: 5, rings: 2, bulge: 0 });
  }
  // ---- earring
  if (look.earring) {
    const ec = hexRGB(look.earring);
    for (const s of [-1, 1]) sphere(accMesh, [-1.6, -6.5, s * (RLL + 0.5)], 1.25, packRGBA(ec[0], ec[1], ec[2], 1), packMat(0.9, 0.8, 0.5, LAYER.WHITE, CLS.METAL), { nu: 8, nv: 6 });
  }
  return { skin: skinMesh, hair: hairMesh, acc: accMesh };
}

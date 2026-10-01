// ===== 3D fighters, part 5: skeleton from the 2D pose, body meshes, rendering into sprites, and the public API =====

let YAW_T = 0.55;                    // torso turned this much towards the camera (3/4 view)
let YAW_H = 0.95;                     // head turned further, so both eyes show
const ARM_L = 31, LEG_L = 38;

// Torso cross-sections: [height above the hip pivot, lateral half-width, forward half-depth, forward offset]
const TORSO_RINGS = [
  [-7.5, 17.8, 11.8, -0.4], [-3, 19.4, 12.6, 0], [4, 20.0, 13.0, 0], [12, 18.8, 12.2, 0.2], [20, 19.8, 12.8, 0.6], [28, 21.4, 14.0, 1.0], [35, 23.0, 14.8, 1.4],
  [41, 24.2, 14.2, 1.0], [45.5, 21.2, 12.6, 0.4], [49, 15.4, 10.6, 0], [51.8, 9.8, 8.6, -0.2], [54.2, 7.6, 7.4, -0.3],
];

// ---------------------------------------------------------------------------------------------------------------
// per-person assets: textures + head meshes (built once)
// ---------------------------------------------------------------------------------------------------------------
function look3D(look) {
  let L = G3.cache.get(look);
  if (L) { G3.cache.delete(look); G3.cache.set(look, L); return L; }      // keep the most recently used at the end
  const gl = G3.gl, g = geo(look), pal = g.pal;
  L = { look, pal, tex: F3D.newTexArray(), faceKey: '', face: texCanvas(), gpu: null };
  L.faceCtx = L.face.getContext('2d');
  const tc = texCanvas(), c = tc.getContext('2d');
  paintWhite(c); F3D.uploadLayer(L.tex, LAYER.WHITE, tc, false);
  if (look.robot) paintRobotTorso(c, look); else paintTorso(c, look, pal);
  F3D.uploadLayer(L.tex, LAYER.TORSO, tc, false);
  if (look.robot) {            // the same label mirrored, for when the boss faces left (the whole model is mirrored then)
    const t2 = texCanvas(), c2 = t2.getContext('2d'); c2.translate(TEXN, 0); c2.scale(-1, 1); c2.drawImage(tc, 0, 0);
    F3D.uploadLayer(L.tex, LAYER.TORSO2, t2, false);
  }
  paintStrands(c, look.hair ? look.hair.color : '#333333', 11, 700); F3D.uploadLayer(L.tex, LAYER.HAIR, tc, false);
  paintStrands(c, look.beard ? look.beard.color : (look.stache || '#333333'), 29, 900); F3D.uploadLayer(L.tex, LAYER.BEARD, tc, false);
  paintKnit(c, look.kippah); F3D.uploadLayer(L.tex, LAYER.KNIT, tc, false);
  F3D.uploadLayer(L.tex, LAYER.CLOTH, clothCanvas(), false);
  setFace3D(L, 'open', 'closed');
  if (!look.robot) {
    const m = buildHeadMeshes(look, pal);
    L.gpu = { skin: uploadStatic(gl, m.skin), hair: uploadStatic(gl, m.hair), acc: uploadStatic(gl, m.acc) };
  }
  if (G3.cache.size >= 16) {                         // evict the least recently used person (textures + head meshes live on the GPU)
    const [k, v] = G3.cache.entries().next().value;
    gl.deleteTexture(v.tex);
    if (v.gpu) for (const m of [v.gpu.skin, v.gpu.hair, v.gpu.acc]) { gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vbo); gl.deleteBuffer(m.ibo); }
    G3.cache.delete(k);
  }
  G3.cache.set(look, L);
  return L;
}
let CLOTH_CV = null;
function clothCanvas() {
  if (!CLOTH_CV) { CLOTH_CV = texCanvas(); paintCloth(CLOTH_CV.getContext('2d')); }
  return CLOTH_CV;
}
function setFace3D(L, eyes, mouth) {
  const key = eyes + '|' + mouth;
  if (L.faceKey === key) return;
  L.faceKey = key;
  if (L.look.robot) paintRobotFace(L.faceCtx, L.look, eyes, mouth);
  else {
    if (!L.faceBase) { L.faceBase = texCanvas(); paintFaceBase(L.faceBase.getContext('2d', { willReadFrequently: true }), L.look, L.pal); }
    L.faceCtx.clearRect(0, 0, TEXN, TEXN); L.faceCtx.drawImage(L.faceBase, 0, 0);
    paintFaceExpr(L.faceCtx, L.look, L.pal, eyes, mouth);
  }
  F3D.uploadLayer(L.tex, LAYER.FACE, L.face, true);
}

// ---------------------------------------------------------------------------------------------------------------
// skeleton: everything in model space (x forward, y up, z to the camera), derived from the same pose numbers as the 2D rig
// ---------------------------------------------------------------------------------------------------------------
function skeleton3D(f, p, look) {
  const bw = look.w || 1, hs = look.head || 1;
  const hipX = p.hx, hipY = p.hy, TL = 50;
  const cl = Math.cos(p.lean), sl = Math.sin(p.lean);
  const shX = hipX + sl * TL, shY = hipY - cl * TL;
  const headCX = shX + 2 + p.headX, headCY = shY - 30 + p.headY;
  const S = { bw, hs, p, faceDir: f.face };
  S.O = [hipX, -hipY, 0];
  const eu = [sl, cl, 0], ef = [cl, -sl, 0], ez = [0, 0, 1], cy = Math.cos(YAW_T), sy = Math.sin(YAW_T);
  S.eu = eu;
  S.ff = [ef[0] * cy + ez[0] * sy, ef[1] * cy + ez[1] * sy, ef[2] * cy + ez[2] * sy];        // forward, turned to the camera
  S.ll = [-ef[0] * sy + ez[0] * cy, -ef[1] * sy + ez[1] * cy, -ef[2] * sy + ez[2] * cy];    // lateral, +z = the near side
  const at = (u, lat, fw) => [S.O[0] + eu[0] * u + S.ll[0] * lat + S.ff[0] * fw, S.O[1] + eu[1] * u + S.ll[1] * lat + S.ff[1] * fw, S.O[2] + eu[2] * u + S.ll[2] * lat + S.ff[2] * fw];
  S.at = at;
  // arms
  const arm = (target, near) => {
    const sgn = near ? 1 : -1;
    const sh = at(43, sgn * (23.6 * bw - 6.2), 0.4);
    const r = ik(sh[0], -sh[1], target[0], target[1], ARM_L, ARM_L, 1);
    const zs = sh[2];
    const wr = [r.ex, -r.ey, zs + sgn * 3.5], el = [r.jx, -r.jy, zs + sgn * 5.2];
    const d = V3.norm(V3.sub(wr, el));
    return { sh, el, wr, fist: V3.madd(wr, d, 4.6), dir: d, near };
  };
  S.armN = arm(p.handF, true); S.armF = arm(p.handB, false);
  // legs
  const leg = (target, near) => {
    const sgn = near ? 1 : -1;
    const hp = [hipX - sgn * Math.sin(YAW_T) * 7, -(hipY + 3), sgn * Math.cos(YAW_T) * 7];
    const r = ik(hp[0], -hp[1], target[0], target[1], LEG_L, LEG_L, -1);
    const zs = hp[2], an = [r.ex, -r.ey, zs + sgn * 2.5], kn = [r.jx, -r.jy, zs + sgn * 1.6];
    const sa = Math.atan2(r.ey - r.jy, r.ex - r.jx) - Math.PI / 2;
    return { hp, kn, an, ang: -sa * 0.8, near };
  };
  S.legN = leg(p.footF, true); S.legF = leg(p.footB, false);
  // head
  const hc = [headCX, -headCY - 2, 0], k = HEAD_K * hs * 1.3;         // a caricature's head is big: the face stays readable on a phone
  const roll = -p.headRot;
  S.headM = M4.mul(M4.translate(hc[0], hc[1], hc[2]), M4.mul(M4.rotZ(roll), M4.mul(M4.rotY(-YAW_H), M4.scale(k, k, k))));
  S.hc = hc; S.hk = k;
  S.neckTop = M4.pt(S.headM, -2, -13.8, 0);
  S.neckBase = at(52.5, 0, 0.2);
  return S;
}

// ---------------------------------------------------------------------------------------------------------------
// body meshes
// ---------------------------------------------------------------------------------------------------------------
const MAT_CLOTH = packMat(0.07, 0.08, 0.45, LAYER.WHITE, CLS.CLOTH);
const MAT_SKIN = packMat(0.2, 0.28, 0.45, LAYER.WHITE, CLS.SKIN);
const MAT_SHOE = packMat(0.75, 0.45, 0.35, LAYER.WHITE, CLS.SHOE);
const MAT_TORSO = packMat(0.1, 0.1, 0.4, LAYER.TORSO, CLS.CLOTH);
const TILE = [4, 11];                    // fabric weave on tubes: repeats around, world units per repeat along
const c3 = (hex, k = 1) => { const v = hexRGB(hex); return packRGBA(Math.min(1, v[0] * k), Math.min(1, v[1] * k), Math.min(1, v[2] * k), 1); };
const c3s = (css, k = 1) => { const v = hexRGB(css); return packRGBA(Math.min(1, v[0] * k), Math.min(1, v[1] * k), Math.min(1, v[2] * k), 1); };

let SHOE = null, FIST = null;
function shoeMesh() {
  if (SHOE) return SHOE;
  const m = new Mesh(400, 1500), n = 12, rings = [];
  // x from heel (-8) to toe (22): [x, half-width, top, bottom]
  const prof = [[-8.4, 3.6, 4.5, -5.8], [-6.5, 5.4, 6.2, -6], [-2, 6.2, 6.8, -6], [4, 6.0, 4.6, -6], [10, 5.6, 2.6, -5.8], [16, 4.9, 0.6, -5.4], [20.4, 3.4, -1.2, -4.6], [22.2, 1.4, -2.6, -3.8]];
  const P = [];
  for (const [x, w, top, bot] of prof) for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, cs = Math.cos(a), sn = Math.sin(a), sq = 0.75;
    const ux = Math.sign(cs) * Math.pow(Math.abs(cs), sq), uy = Math.sign(sn) * Math.pow(Math.abs(sn), sq);
    P.push([x, (top + bot) / 2 + uy * (top - bot) / 2, ux * w]);
  }
  gridSurface(m, P, n, prof.length, true, [7, -1, 0], { uv: WHITE_UV, col: packRGBA(1, 1, 1, 1), mat: MAT_SHOE });
  return (SHOE = m);
}
function fistMesh() {
  if (FIST) return FIST;
  const m = new Mesh(500, 2000), col = packRGBA(1, 1, 1, 1), mat = MAT_SKIN;
  emitEllipsoid(m, [0, 0, 0], [5.9, 0, 0], [0, 5.3, 0], [0, 0, 4.6], col, mat, { nu: 10, nv: 7 });         // palm/fingers
  for (let k = 0; k < 4; k++) sphere(m, [3.6, 3.2 - k * 2.3, 1.2], 1.9, packRGBA(0.97, 0.92, 0.9, 1), mat, { nu: 6, nv: 5 });   // knuckles
  emitEllipsoid(m, [-0.8, 2.6, 3.4], [3.4, 0, 0], [0, 1.9, 0], [0, 0, 1.9], col, mat, { nu: 8, nv: 6 });    // thumb
  return (FIST = m);
}


// The boss: a boxy ballot-box torso with a label, a light lid, and a big robot head with a visor.
function seVal(v, e) { return Math.sign(v) * Math.pow(Math.abs(v), e); }
function emitSuper(mesh, c, ax, ay, az, e, vf, nu = 32, nv = 17) {
  const P = [];
  for (let j = 0; j < nv; j++) {
    const la = -Math.PI / 2 + (j / (nv - 1)) * Math.PI, cl = seVal(Math.cos(la), e), sl = seVal(Math.sin(la), e);
    for (let i = 0; i < nu; i++) {
      const ph = (i / (nu - 1)) * TAU - Math.PI, x = cl * seVal(Math.cos(ph), e), z = cl * seVal(Math.sin(ph), e);
      P.push([c[0] + ax[0] * x + ay[0] * sl + az[0] * z, c[1] + ax[1] * x + ay[1] * sl + az[1] * z, c[2] + ax[2] * x + ay[2] * sl + az[2] * z]);
    }
  }
  gridSurface(mesh, P, nu, nv, false, c, vf, [(nu - 1) / 4, 3 * (nu - 1) / 4]);
}
function emitRobotCore(mesh, S, L) {
  const look = L.look, bw = S.bw, suit = c3(look.suit), lid = c3(look.shirt || '#dfe6f5');
  const A = 25.6 * bw, B = 17, e = 0.3, nA = 33, frontMax = (nA - 1) / 2;
  const rows = (list, col, mat, front) => {
    const P = [];
    for (const [u, a, b] of list) {
      const c = S.at(u, 0, 0), fw = V3.mul(S.ff, b), ax = V3.mul(S.ll, a);
      for (let i = 0; i < nA; i++) {
        const th = -Math.PI / 2 + TAU * (i / (nA - 1)), cs = seVal(Math.cos(th), e), sn = seVal(Math.sin(th), e);
        P.push([c[0] + fw[0] * cs + ax[0] * sn, c[1] + fw[1] * cs + ax[1] * sn, c[2] + fw[2] * cs + ax[2] * sn]);
      }
    }
    gridSurface(mesh, P, nA, list.length, false, S.at(20, 0, 0), (i, j, side) => {
      const isFront = front && (i < frontMax || (i === frontMax && side <= 0)), th = -Math.PI / 2 + TAU * (i / (nA - 1));
      if (isFront) return { uv: [(36 - list[j][1] * Math.sin(th)) / 72, (56 - list[j][0]) / 64], col: packRGBA(1, 1, 1, 1), mat: packMat(0.25, 0.3, 0.5, S.faceDir < 0 ? LAYER.TORSO2 : LAYER.TORSO) };
      return { uv: [0.5, 0.5], col, mat };
    }, [0, frontMax, nA - 1]);
    return P;
  };
  const M = packMat(0.3, 0.35, 0.5, LAYER.WHITE);
  rows([[-8, A * 0.9, B * 0.9], [-5, A * 0.99, B * 0.99], [0, A, B], [44, A, B], [47, A * 0.985, B * 0.985], [48.5, A * 0.93, B * 0.93]], suit, M, true);
  const lp = rows([[47.5, A + 2.6, B + 2.6], [49, A + 3.2, B + 3.2], [56, A + 3.2, B + 3.2], [58, A + 1.5, B + 1.5], [58.6, A * 0.8, B * 0.8]], lid, packMat(0.35, 0.35, 0.5, LAYER.WHITE), false);
  emitCap(mesh, lp.slice(4 * nA, 5 * nA - 1), S.at(58.7, 0, 0), S.eu, lid, packMat(0.35, 0.35, 0.5, LAYER.WHITE));
  // head: a rounded box with a visor, on the lid, and an antenna
  const hm = S.headM, hc = M4.pt(hm, 0, 0, 0);
  const ex = M4.pt(hm, 1, 0, 0), ey = M4.pt(hm, 0, 1, 0), ez = M4.pt(hm, 0, 0, 1);
  const vx = V3.sub(ex, hc), vy = V3.sub(ey, hc), vz = V3.sub(ez, hc);
  const hcol = packRGBA(1, 1, 1, 1);
  emitSuper(mesh, hc, V3.mul(vx, 26), V3.mul(vy, 25), V3.mul(vz, 29), 0.32, (i, j, side) => {
    const nu = 32, front = (i > (nu - 1) / 4 && i < 3 * (nu - 1) / 4) || (i === (nu - 1) / 4 && side >= 0) || (i === 3 * (nu - 1) / 4 && side <= 0);
    if (!front) return { uv: [0.985, 0.985], col: hcol, mat: packMat(0.5, 0.4, 0.4, LAYER.FACE) };
    const th = -Math.PI + TAU * (i / (nu - 1)), la = -Math.PI / 2 + Math.PI * (j / 16);
    const lz = seVal(Math.cos(la), 0.32) * seVal(Math.sin(th), 0.32) * 29, ly = seVal(Math.sin(la), 0.32) * 25;
    return { uv: [Math.max(0.02, Math.min(0.98, (20 - lz / 1.75) / 40)), Math.max(0.02, Math.min(0.98, (18 - ly / 1.35) / 40))], col: hcol, mat: packMat(0.5, 0.4, 0.4, LAYER.FACE) };
  });
  const top = V3.madd(hc, vy, 26);
  emitTube(mesh, top, V3.madd(top, vy, 15), 1.6, 1.6, c3('#5b6478'), M, { sides: 6, rings: 2, bulge: 0 });
  sphere(mesh, V3.madd(top, vy, 17), 4.6, c3('#ff4f6a'), packMat(0.7, 0.6, 0.6, LAYER.WHITE), { nu: 10, nv: 7 });
}

function emitBody(mesh, S, L, opt) {
  const look = L.look, pal = L.pal, p = S.p, bw = S.bw, lk = limbK(look);        // lk: thick or thin arms and legs
  const suit = c3(look.suit), suitFar = c3(look.suit, 0.78), pants = c3(look.pants || look.suit), pantsFar = c3(look.pants || look.suit, 0.74);
  const shirt = c3(look.shirt || '#ffffff'), shirtFar = c3(look.shirt || '#ffffff', 0.8), skin = c3(pal.skin), skinFar = c3(pal.skin, 0.8), shoe = c3(look.shoes || '#1d1b27');
  const nm = (m) => M4.normalMat(m);

  // ----- back layer first is irrelevant (depth buffer), so just emit everything
  // legs
  for (const lg of [S.legF, S.legN]) {
    const far = !lg.near, pc = far ? pantsFar : pants;
    emitTube(mesh, lg.hp, lg.kn, 9.6 * lk, 7.9 * lk, pc, MAT_CLOTH, { sides: 10, rings: 4, tile: TILE });
    emitTube(mesh, lg.kn, lg.an, 7.8 * lk, 6.0 * lk, pc, MAT_CLOTH, { sides: 10, rings: 4, tile: TILE });
    sphere(mesh, lg.hp, 9.9 * lk, pc, MAT_CLOTH, { nu: 10, nv: 7 });
    sphere(mesh, lg.kn, 7.9 * lk, pc, MAT_CLOTH, { nu: 10, nv: 7 });
    const dl = V3.norm(V3.sub(lg.an, lg.kn));
    emitTube(mesh, V3.madd(lg.an, dl, -9), V3.madd(lg.an, dl, -1.5), 6.95 * Math.max(0.9, lk), 6.75 * Math.max(0.9, lk), far ? c3(look.pants || look.suit, 0.58) : c3(look.pants || look.suit, 0.8), MAT_CLOTH, { sides: 10, rings: 2, bulge: 0.04 });   // turn-up
    const M = M4.mul(M4.translate(lg.an[0] + 1, lg.an[1] - 0.6, lg.an[2] + (far ? -0.5 : 0.5)), M4.rotZ(lg.ang));
    stamp(mesh, shoeMesh(), M, nm(M), far ? c3(look.shoes || '#1d1b27', 0.75) : shoe, MAT_SHOE);
  }
  if (look.robot) emitRobotCore(mesh, S, L);
  else {
  // torso (front half with the jacket texture, back half plain)
  {
    const rows = TORSO_RINGS.length, nA = 21, P = [];
    const belly = look.belly || 0, shoulders = look.shoulders || 0;                        // build: a belly (waist and stomach), broad (or narrow) shoulders
    for (let j = 0; j < rows; j++) {
      const [u, A0, B0, off0] = TORSO_RINGS[j];
      const bel = belly * bump(u, 10, 11), sho = shoulders * bump(u, 38, 9);
      const A = A0 * (1 + sho * 0.16 + bel * 0.12), B = B0 * (1 + bel * 0.4), off = off0 + bel * 3.4;
      const c = S.at(u, 0, off), fw = V3.mul(S.ff, B), ax = V3.mul(S.ll, A * bw);
      for (let i = 0; i < nA; i++) {
        const th = -Math.PI / 2 + Math.PI * (i / (nA - 1)) * 2;    // -90 .. +270 degrees
        P.push([c[0] + fw[0] * Math.cos(th) + ax[0] * Math.sin(th), c[1] + fw[1] * Math.cos(th) + ax[1] * Math.sin(th), c[2] + fw[2] * Math.cos(th) + ax[2] * Math.sin(th)]);
      }
    }
    const cutA = 5, cutB = 15;      // th = 0 .. hmm: front half is th in [-90, 90] => columns 0..(nA-1)/2
    const frontMax = (nA - 1) / 2;
    gridSurface(mesh, P, nA, rows, false, S.at(24, 0, 0), (i, j, side) => {
      const [u, A] = TORSO_RINGS[j];
      const th = -Math.PI / 2 + Math.PI * (i / (nA - 1)) * 2, isFront = i < frontMax || (i === frontMax && side <= 0);
      if (i === 0 && side >= 0) { /* seam start belongs to the front */ }
      if (isFront) {
        const lat = A * bw * Math.sin(th);
        return { uv: [(27 - lat) / 54, (56 - u) / 64], col: packRGBA(1, 1, 1, 1), mat: MAT_TORSO };
      }
      return { uv: [3.5 * (27 - A * bw * Math.sin(th)) / 54, 3.5 * (56 - u) / 64], col: suit, mat: MAT_CLOTH };
    }, [0, frontMax, nA - 1]);
    // caps: hem (dark inside) and neck hole
    const topC = S.at(54.2, 0, -0.3), hemC = S.at(-7.5, 0, -0.4);
    const ringTop = P.slice((rows - 1) * nA, rows * nA - 1), ringHem = P.slice(0, nA - 1);
    emitCap(mesh, ringTop, topC, S.eu, shirt, MAT_CLOTH);
    emitCap(mesh, ringHem, hemC, V3.mul(S.eu, -1), c3(look.suit, 0.5), MAT_CLOTH);
  }
  // neck + collar
  {
    const a = S.neckBase, b = S.neckTop;
    emitTube(mesh, a, b, 7.7 * faceK(look.neck, 'neck'), 7.1 * faceK(look.neck, 'neck'), skin, MAT_SKIN, { sides: 12, rings: 4, bulge: 0 });
    const d = V3.norm(V3.sub(b, a));
    emitTube(mesh, V3.madd(a, d, -1.5), V3.madd(a, d, 3.4), 8.5, 8.0, look.open ? skin : shirt, look.open ? MAT_SKIN : MAT_CLOTH, { sides: 12, rings: 3, bulge: 0 });
  }
  }
  // arms
  for (const ar of [S.armF, S.armN]) {
    const far = !ar.near, sc = far ? suitFar : suit;
    sphere(mesh, ar.sh, 7.7 * lk, sc, MAT_CLOTH, { nu: 12, nv: 8 });
    emitTube(mesh, ar.sh, ar.el, 7.6 * lk, 6.4 * lk, sc, MAT_CLOTH, { sides: 10, rings: 4, tile: TILE });
    emitTube(mesh, ar.el, ar.wr, 6.4 * lk, 5.3 * lk, sc, MAT_CLOTH, { sides: 10, rings: 4, tile: TILE });
    sphere(mesh, ar.el, 6.5 * lk, sc, MAT_CLOTH, { nu: 10, nv: 7 });
    const d = ar.dir;
    emitTube(mesh, V3.madd(ar.wr, d, -7), V3.madd(ar.wr, d, -0.5), 6.35 * Math.max(0.9, lk), 6.05 * Math.max(0.9, lk), far ? shirtFar : shirt, MAT_CLOTH, { sides: 10, rings: 2, bulge: 0.03 });  // cuff
    // fist
    const ex = d, ey = V3.norm(V3.cross([0, 0, 1], ex)), ez = V3.cross(ex, ey);
    const M = M4.basis(ex, V3.mul(ey, 1), ez, ar.fist);
    stamp(mesh, fistMesh(), M, M4.normalMat(M), far ? skinFar : skin, MAT_SKIN);
    if (p.finger && ar.near) {
      const tip = V3.madd(ar.fist, ex, 13.5);
      emitTube(mesh, V3.madd(ar.fist, ex, 3), tip, 1.75, 1.45, skin, MAT_SKIN, { sides: 6, rings: 3, bulge: 0 });
      sphere(mesh, tip, 1.5, skin, MAT_SKIN, { nu: 6, nv: 5 });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// drawing
// ---------------------------------------------------------------------------------------------------------------
function modelMatrix(f, p, look) {
  const gs = (look.h || 1) * BODY_S * (f.scale || 1), face = f.face;
  // model (y up) -> rig (y down) -> squash -> rotate about the pivot -> scale -> mirror -> world
  let M = M4.scale(1, -1, 1);
  M = M4.mul(M4.scale(p.sx, p.sy, 1), M);
  if (p.rot) M = M4.mul(M4.translate(p.rotX, p.rotY, 0), M4.mul(M4.rotZ(p.rot), M4.mul(M4.translate(-p.rotX, -p.rotY, 0), M)));
  M = M4.mul(M4.scale(face * gs, gs, gs), M);
  return M4.mul(M4.translate(f.x, f.y, 0), M);
}

function skelPoints(S) {
  const pts = [S.armN.fist, S.armF.fist, S.armN.el, S.armF.el, S.legN.an, S.legF.an, S.legN.kn, S.legF.kn, S.neckTop, S.hc, S.O, S.at(50, 0, 0)];
  const hh = M4.pt(S.headM, 0, 30, 0), hf = M4.pt(S.headM, 26, 0, 0), hb = M4.pt(S.headM, -26, 0, 0);
  pts.push(hh, hf, hb, S.at(0, 0, -14), S.at(0, 0, 14));
  return pts;
}

// A face turned 3/4 to the camera (either way) gets this much diffuse light in each colour channel; dividing by it makes a well-lit face
// show the colour the look specifies, whatever the stage lighting (20% of the stage's tint is kept for atmosphere).
function faceNorm(LG, KEY, FILL) {
  const wrapF = (n) => { let w = Math.max(0, Math.min(1, (V3.dot(n, KEY) + 0.3) / 1.3)); return w * (w * (3 - 2 * w) * 0.6 + w * 0.4); };
  const D = [0, 0, 0];
  for (const nx of [0.58, -0.58]) {
    const n = V3.norm([nx, 0, 0.81]), w = wrapF(n), f = Math.max(0, V3.dot(n, FILL));
    for (let c = 0; c < 3; c++) D[c] += 0.5 * (LG.key[c] * 1.3 * w + LG.fill[c] * 0.42 * f + (LG.bot[c] * 0.8 + LG.top[c] * 0.85) * 0.5);
  }
  return D.map((d) => 0.2 + 0.8 / Math.max(0.2, d));
}

// The GL pass: draw the figures into the top-left pw x ph pixels of the GL canvas, seen through the world window (X0,Y0,W_,H_).
function drawFigs(figs, X0, Y0, W_, H_, pw, ph, opt) {
  const gl = G3.gl;
  gl.viewport(0, 0, pw, ph);
  gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, pw, ph);
  gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.SCISSOR_TEST);
  gl.useProgram(G3.prog);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  const U = G3.U, LG = F3D.light;
  const KEY = V3.norm([-0.22, 0.66, 0.72]), FILL = V3.norm([0.7, 0.1, 0.55]);
  gl.uniform3f(U.uKeyDir, ...KEY); gl.uniform3fv(U.uKeyCol, LG.key.map((v) => v * 1.3));
  gl.uniform3f(U.uFillDir, ...FILL); gl.uniform3fv(U.uFillCol, LG.fill.map((v) => v * 0.42));
  gl.uniform3fv(U.uTop, LG.top.map((v) => v * 0.85)); gl.uniform3fv(U.uBot, LG.bot.map((v) => v * 0.8)); gl.uniform3fv(U.uRim, LG.rim.map((v) => v * 1.1));
  gl.uniform3fv(U.uNorm, faceNorm(LG, KEY, FILL));
  gl.uniform1i(U.uTex, 0);
  const zr = 260;
  // world (y down) -> clip
  const P = new Float32Array(16);
  P[0] = 2 / W_; P[5] = -2 / H_; P[10] = -1 / zr; P[12] = -2 * X0 / W_ - 1; P[13] = 1 + 2 * Y0 / H_; P[15] = 1;
  G3.dyn.reset();
  for (const fg of figs) {
    const L = fg.L, S = fg.S;
    G3.dyn.reset();
    emitBody(G3.dyn, S, L, opt);
    gl.bindVertexArray(null);
    // streamed body
    if (!G3.vao) { G3.vao = gl.createVertexArray(); gl.bindVertexArray(G3.vao); bindLayout(gl, G3.vbo, G3.ibo); gl.bindVertexArray(null); }
    gl.bindVertexArray(G3.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, G3.vbo); gl.bufferData(gl.ARRAY_BUFFER, G3.dyn.f.subarray(0, G3.dyn.nv * VW), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G3.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, G3.dyn.i.subarray(0, G3.dyn.ni), gl.STREAM_DRAW);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, L.tex);
    const M = fg.M, MVP = M4.mul(P, M);
    const nmat = M4.normalMat(M), det = M4.det3(M);
    // view-space normals: flip y (canvas -> y up)
    const NM = new Float32Array([nmat[0], -nmat[1], nmat[2], nmat[3], -nmat[4], nmat[5], nmat[6], -nmat[7], nmat[8]]);
    gl.frontFace(fg.face < 0 ? gl.CW : gl.CCW);
    gl.uniformMatrix4fv(U.uMVP, false, MVP); gl.uniformMatrix4fv(U.uM, false, M); gl.uniformMatrix3fv(U.uNM, false, NM);
    gl.uniform4f(U.uTint, ...(fg.tint || [0, 0, 0, 0])); gl.uniform1f(U.uFlash, fg.flash || 0); gl.uniform1f(U.uAlpha, fg.alpha === undefined ? 1 : fg.alpha); gl.uniform1f(U.uCover, 0);
    gl.drawElements(gl.TRIANGLES, G3.dyn.ni, gl.UNSIGNED_SHORT, 0);
    F3D.stats.verts += G3.dyn.nv;
    // static head parts
    if (L.gpu) {
      const HM = M4.mul(M, S.headM), HP = M4.mul(P, HM), hn = M4.normalMat(HM);
      const HN = new Float32Array([hn[0], -hn[1], hn[2], hn[3], -hn[4], hn[5], hn[6], -hn[7], hn[8]]);
      gl.uniformMatrix4fv(U.uMVP, false, HP); gl.uniformMatrix4fv(U.uM, false, HM); gl.uniformMatrix3fv(U.uNM, false, HN);
      gl.bindVertexArray(L.gpu.skin.vao); gl.drawElements(gl.TRIANGLES, L.gpu.skin.n, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(L.gpu.acc.vao); gl.drawElements(gl.TRIANGLES, L.gpu.acc.n, gl.UNSIGNED_SHORT, 0);
      if (G3.a2c) { gl.disable(gl.BLEND); gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); }
      gl.uniform1f(U.uCover, G3.a2c ? 1 : 0);
      gl.bindVertexArray(L.gpu.hair.vao); gl.drawElements(gl.TRIANGLES, L.gpu.hair.n, gl.UNSIGNED_SHORT, 0);
      if (G3.a2c) { gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.enable(gl.BLEND); }
    }
  }
  gl.bindVertexArray(null);
}

// Render one or more figures (ghosts first) into the GL canvas and copy the result to a sprite canvas.
// Returns { canvas, x, y, w, h } in world units (relative to the ctx passed in).
F3D.render = function (ctx, f, opt, figs) {
  const gl = G3.gl, cvs = G3.cv;
  const T = ctx.getTransform();
  const sc = Math.hypot(T.a, T.b) || 1;
  // bounding box of everything that is going to be drawn (world units)
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const fg of figs) {
    for (const q of fg.pts) { const w = M4.pt(fg.M, q[0], q[1], q[2]); x0 = Math.min(x0, w[0]); y0 = Math.min(y0, w[1]); x1 = Math.max(x1, w[0]); y1 = Math.max(y1, w[1]); }
    fg.pad = 20 * fg.gs;
  }
  const pad = 22 * figs[0].gs;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  // snap to the device pixel grid so the sprite is drawn 1:1
  let X0 = x0, Y0 = y0, W_ = x1 - x0, H_ = y1 - y0, res = sc;
  const aligned = !opt.noAlign && Math.abs(T.b) < 1e-6 && Math.abs(T.c) < 1e-6 && T.a > 0 && T.d > 0;
  if (aligned) {
    const dx0 = Math.floor(T.a * x0 + T.e), dy0 = Math.floor(T.d * y0 + T.f), dx1 = Math.ceil(T.a * x1 + T.e), dy1 = Math.ceil(T.d * y1 + T.f);
    X0 = (dx0 - T.e) / T.a; Y0 = (dy0 - T.f) / T.d; W_ = (dx1 - dx0) / T.a; H_ = (dy1 - dy0) / T.d;
  }
  let pw = Math.max(2, Math.round(W_ * sc)), ph = Math.max(2, Math.round(H_ * sc));
  const cap = G3.size;
  let sdown = 1;
  if (pw > cap || ph > cap) { sdown = Math.min(cap / pw, cap / ph); pw = Math.floor(pw * sdown); ph = Math.floor(ph * sdown); }
  drawFigs(figs, X0, Y0, W_, H_, pw, ph, opt);
  // copy out
  let spr = opt.into || f._spr;
  if (!spr) { spr = { canvas: document.createElement('canvas'), x: 0, y: 0, w: 0, h: 0 }; spr.ctx = spr.canvas.getContext('2d'); if (!opt.into) f._spr = spr; }
  if (spr.canvas.width !== pw || spr.canvas.height !== ph) { spr.canvas.width = pw; spr.canvas.height = ph; }
  spr.ctx.clearRect(0, 0, pw, ph);
  spr.ctx.drawImage(cvs, 0, G3.size - ph, pw, ph, 0, 0, pw, ph);
  spr.x = X0; spr.y = Y0; spr.w = W_; spr.h = H_;
  F3D.stats.renders++;
  if (F3D.good < 3) {                         // some GPUs / browsers hand back an empty canvas: catch that at the start and use the 2D renderer instead
    const pr = G3.probe || (G3.probe = (() => { const c = document.createElement('canvas'); c.width = c.height = 48; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; })());
    const cw = Math.min(pw, 160), ch = Math.min(ph, 160);
    pr.x.clearRect(0, 0, 48, 48); pr.x.drawImage(spr.canvas, (pw - cw) >> 1, (ph - ch) >> 1, cw, ch, 0, 0, 48, 48);
    const px = pr.x.getImageData(0, 0, 48, 48).data;
    let solid = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 40) solid++;
    if (solid < 40) throw new Error('the 3D renderer produced an empty picture');
  }
  F3D.good++;
  return spr;
};

// ---------------------------------------------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------------------------------------------
const LOOK_IDS = new WeakMap();
let lookIdSeq = 0;
const lookId = (l) => { let v = LOOK_IDS.get(l); if (!v) LOOK_IDS.set(l, (v = ++lookIdSeq)); return v; };
const POSE_CACHE = new Map();

function poseKey(p) {
  const q = (v) => Math.round(v / 1.5);
  return [p.eyes, p.mouth, q(p.hx), q(p.hy), Math.round(p.lean * 20), Math.round(p.headRot * 20), q(p.headX), q(p.headY), q(p.handF[0]), q(p.handF[1]), q(p.handB[0]), q(p.handB[1]), q(p.footF[0]), q(p.footF[1]), q(p.footB[0]), q(p.footB[1]), Math.round(p.rot * 20), p.finger ? 1 : 0].join(',');
}

function buildFigs(f, p, look, L, opt) {
  const figs = [];
  const push = (fx, pose, extra) => {
    const S = skeleton3D(fx, pose, look), M = modelMatrix(fx, pose, look);
    figs.push(Object.assign({ L, S, M, gs: (look.h || 1) * BODY_S * (fx.scale || 1), face: fx.face, pts: skelPoints(S) }, extra));
  };
  if (opt.ghosts) for (const g of opt.ghosts) push(g.f, g.f.pose, { tint: g.tint, alpha: g.alpha });
  push(f, p, { flash: opt.flash || 0, alpha: 1 });
  return figs;
}

// Make (or reuse) the sprite for this fighter this frame. Real fighters keep their sprite on themselves for the whole frame
// (so the floor reflection and the super cinematic reuse it); minions are cached by pose.
F3D.prepare = function (ctx, f, opt = {}) {
  if (!F3D.active()) return null;
  const look = f.def.look;
  try {
    const p = f.pose || poseOf(f);
    const key = (opt.flash || 0) + ':' + (opt.ghosts ? opt.ghosts.length : 0);
    if (f._spr && f._sprStamp === F3D.stamp && f._sprKey === key) return f._spr;
    const L = look3D(look);
    setFace3D(L, p.eyes, p.mouth);
    const figs = buildFigs(f, p, look, L, opt);
    const spr = F3D.render(ctx, f, opt, figs);
    f._sprStamp = F3D.stamp; f._sprKey = key; f._skel = figs[figs.length - 1].S;
    return spr;
  } catch (e) { F3D.failed = true; F3D.err = String(e && e.stack || e); return null; }
};

function overlays3D(ctx, f, p, S) {
  const look = f.def.look, gs = (look.h || 1) * BODY_S * (f.scale || 1);
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.face, 1); ctx.scale(gs, gs);
  if (p.rot) { ctx.translate(p.rotX, p.rotY); ctx.rotate(p.rot); ctx.translate(-p.rotX, -p.rotY); }
  ctx.scale(p.sx, p.sy);
  if (p.prop) { const q = S.armN.fist; drawProp(ctx, p.prop, q[0], -q[1], p.propAng); }
  if (p.dizzy) {
    const hx = S.hc[0], hy = -S.hc[1];
    for (let i = 0; i < 3; i++) {
      const a = (f.clock || 0) * 0.12 + (i * TAU) / 3, sx = hx + Math.cos(a) * 24, sy = hy - 30 + Math.sin(a) * 6;
      star(ctx, sx, sy, 5, 5.5, 2.4, a); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    }
  }
  ctx.restore();
}

// Draw a fighter with the 3D renderer. Returns false if the caller should use the 2D cartoon renderer instead.
F3D.draw = function (ctx, f, opt = {}) {
  if (!F3D.active()) return false;
  const look = f.def.look;
  try {
    const t0 = performance.now();
    const p = f.pose || poseOf(f);
    let spr;
    if (opt.reflect) {
      spr = f._spr && f._sprStamp === F3D.stamp ? f._spr : null;
      if (spr) { ctx.save(); if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha; ctx.drawImage(spr.canvas, spr.x, spr.y, spr.w, spr.h); ctx.restore(); }
      return true;
    }
    if (f.def.id === undefined || opt.cache) {
      // minion: cached by pose, positioned relative to its feet
      const T = ctx.getTransform(), sc = Math.hypot(T.a, T.b) || 1, key = lookId(look) + '|' + f.face + '|' + Math.round(sc * 8) + '|' + poseKey(p);
      let hit = POSE_CACHE.get(key);
      if (!hit) {
        const L = look3D(look);
        setFace3D(L, p.eyes, p.mouth);
        const g = { x: 0, y: 0, face: f.face, scale: f.scale, pose: p, def: f.def };
        const figs = buildFigs(g, p, look, L, {});
        const into = { canvas: document.createElement('canvas'), x: 0, y: 0, w: 0, h: 0 }; into.ctx = into.canvas.getContext('2d');
        hit = F3D.render(ctx, g, { into, noAlign: true }, figs);
        hit.skel = figs[0].S;
        POSE_CACHE.set(key, hit);
        if (POSE_CACHE.size > 90) POSE_CACHE.delete(POSE_CACHE.keys().next().value);
      }
      ctx.drawImage(hit.canvas, f.x + hit.x, f.y + hit.y, hit.w, hit.h);
      overlays3D(ctx, f, p, hit.skel);
      F3D.stats.ms += performance.now() - t0;
      return true;
    }
    spr = F3D.prepare(ctx, f, opt);
    if (!spr) return false;
    if (p.glow) { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.face, 1); const gs = (look.h || 1) * BODY_S * (f.scale || 1); ctx.scale(gs, gs); ctx.translate(p.hx, p.hy - 40); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 130, p.glow, 0.55 + Math.sin(f.clock * 0.3) * 0.15); ctx.restore(); }
    ctx.drawImage(spr.canvas, spr.x, spr.y, spr.w, spr.h);
    overlays3D(ctx, f, p, f._skel);
    F3D.stats.ms += performance.now() - t0;
    return true;
  } catch (e) {
    F3D.failed = true; F3D.err = String(e && e.stack || e);
    return false;
  }
};

// ---------------------------------------------------------------------------------------------------------------
// portraits: head and shoulders of the 3D model, turned a little more towards the viewer, cached per expression
// ---------------------------------------------------------------------------------------------------------------
const BUST_CACHE = new Map();
F3D.bust = function (def, eyes, mouth, px) {
  if (!F3D.active() || def.look.robot) return null;
  const n = px > 150 ? 512 : 256, key = def.id + '|' + eyes + '|' + mouth + '|' + n;
  let c = BUST_CACHE.get(key);
  if (c) return c;
  try {
    const look = def.look, L = look3D(look), t = performance.now();
    setFace3D(L, eyes, mouth);
    const oT = YAW_T, oH = YAW_H;
    YAW_T = 0.8; YAW_H = 1.22;
    const p = newPose(); p.eyes = eyes; p.mouth = mouth; p.handF = [8, -58]; p.handB = [-8, -58]; p.hy = -71;
    const f = { def, x: 0, y: 0, face: 1, scale: 1, pose: p };
    const S = skeleton3D(f, p, look), M = modelMatrix(f, p, look);
    YAW_T = oT; YAW_H = oH;
    const hw = M4.pt(M, S.hc[0], S.hc[1], S.hc[2]);
    const half = 37 * (look.h || 1) * BODY_S * (look.head || 1);
    const fig = { L, S, M, gs: 1, face: 1, pts: [] };
    const saveLight = F3D.light; F3D.light = STAGE_LIGHT.studio;
    const oldSize = G3.size;
    drawFigs([fig], hw[0] - half, hw[1] - half * 0.86, half * 2, half * 2, n, n, {});
    F3D.light = saveLight;
    c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'); x.drawImage(G3.cv, 0, G3.size - n, n, n, 0, 0, n, n);
    if (BUST_CACHE.size > 48) BUST_CACHE.delete(BUST_CACHE.keys().next().value);
    BUST_CACHE.set(key, c);
    return c;
  } catch (e) { F3D.failed = true; F3D.err = String(e && e.stack || e); return null; }
};

// profiling helper (CPU side only): builds the skeleton and the streamed body mesh without touching the GPU
F3D.cpuTest = function (f) {
  const look = f.def.look, L = look3D(look), p = f.pose || poseOf(f), S = skeleton3D(f, p, look);
  G3.dyn.reset(); emitBody(G3.dyn, S, L, {});
  return G3.dyn.nv;
};

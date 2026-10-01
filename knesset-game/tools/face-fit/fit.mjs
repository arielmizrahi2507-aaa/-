// fit the face-structure numbers of every fighter to the measured proportions: node fit.mjs meas.json fit.json   (K=1.6 sets the exaggeration)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const [measFile, outFile] = process.argv.slice(2);
const src = fs.readFileSync(fileURLToPath(new URL('../../src/js/30-looks.js', import.meta.url)), 'utf8');
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const { LOOKS, faceK } = new Function('sstep', src + '\nreturn { LOOKS, faceK };')(sstep);
const meas = JSON.parse(fs.readFileSync(measFile, 'utf8'));
const K = +(process.env.K || 1.6);

// ---- the forward model: the same arithmetic as frontGeo / drawFrontHead / frontNose (21b-portrait-front.js), without the hair
const LV = { cheek: 0.14, ear: 0.38, c2: 0.63, j1: 0.88, j2: 1.15, j3: 1.35, ch: 1.76 };          // heights below the eye line, in units of the distance between the eyes
function xAt(R, y) {                                                                             // half width of the outline at height y (R: right half from the crown to the chin)
  if (y >= R[R.length - 1][1]) return 0;
  for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; if (y >= a[1] && y <= b[1]) { const t = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; } }
  return R[0][0];
}
function model(L) {
  const G = faceK, fw = Math.max(0.8, Math.min(1.36, G(L.fw, 'fw'))), chk = G(L.cheek, 'cheek'), chn = G(L.chin, 'chin'), jk = G(L.jaw, 'jaw'), fore = G(L.fore, 'fore');
  const ln = (L.len || 1) - 1, jl = (L.jowl || 0) * 2.0, Ly = (y) => y + ln * 9 * sstep(6, 17, y), lowW = (jk - 1) * 3.0 + jl * 0.8;
  const tmp = L.temple || 1, jsq = L.jawSq || 0, cpt = L.chinPt || 0;
  const R = [[0, -28.6 - (fore - 1) * 1.5], [9.2, -27.4 - (fore - 1) * 1.3], [16 + (tmp - 1) * 1.6, -21.8 - (fore - 1) * 0.9], [19.4 + (tmp - 1) * 2, -13], [20.2 + (chk - 1) * 1.3, -3.6],
    [19.6 + (chk - 1) * 2.6, 5.2], [17.4 + lowW + jsq * 1.8, Ly(13.2) + jl * 1.2 + jsq * 0.8], [12.8 + lowW * 1.05 + jsq * 2.6, Ly(19.8) + jl * 1.9 + jsq * 1.1],
    [6.6 + (chn - 1) * 2.7 + jsq * 1.4 - cpt * 3.4, Ly(23.8) + (chn - 1) * 1.1 + jl * 1.5 + jsq * 0.6 + cpt * 1.2], [0, Ly(25.4) + (chn - 1) * 1.9 + jl * 1.1 + cpt * 1.8]].map(([x, y]) => [x * fw, y]);
  const nq = Math.max(0.75, Math.min(1.9, (G(L.nose, 'nose') + G(L.noseL, 'noseL')) / 2)), nwq = Math.max(0.75, Math.min(1.7, (G(L.nose, 'nose') + G(L.noseW, 'noseW')) / 2));
  const noseY = 3.9 + (nq - 1) * 3.4 + (L.noseT || 0) * 0.9, mouthY = noseY + 8.4 + ln * 3.2 + (L.mouthDy || 0);
  const eK = Math.min(1.34, G(L.eyeSize, 'eye')), ey = -5.2, ex = (9.2 + (eK - 1) * 3.6) * (L.eyeGap || 1) * (0.9 + 0.1 * fw), ipd = 2 * ex;
  const rdg = G(L.ridge, 'ridge'), yb = ey - 6.8 - (eK - 1) * 1.4 - (rdg - 1) * 0.5 + (L.browY || 0);
  const aw = 4.4 + 2.4 * (nwq - 1), mw = 7 * (L.mouthW || 1) * (0.92 + 0.08 * G(L.lips, 'lips'));
  const m = {};
  for (const [k, lv] of Object.entries(LV)) m['w_' + k] = 2 * xAt(R, ey + lv * ipd) / ipd;
  m.chin = (R[R.length - 1][1] - ey) / ipd; m.nose = (noseY + 2.6 - ey) / ipd; m.mouth = (mouthY - ey) / ipd; m.brow = (yb - ey) / ipd;
  m.nose_w = 2 * aw * 1.1 / ipd; m.mouth_w = 2 * mw / ipd; m.eye_w = 9.8 * eK / ipd;
  return m;
}

// ---- targets: the cast average + K x (what is personal)
const keys = ['w_cheek', 'w_ear', 'w_c2', 'w_j1', 'w_j2', 'w_j3', 'w_ch', 'chin', 'nose', 'mouth', 'brow', 'nose_w', 'mouth_w', 'eye_w'];
const photo = (id) => { const p = meas[id]; return { w_cheek: p.fw_cheek, w_ear: p.fw_ear, w_c2: p.fw_cheek2, w_j1: p.fw_jaw1, w_j2: p.fw_jaw2, w_j3: p.fw_jaw3, w_ch: p.fw_chin, chin: p.chin, nose: p.nose_base, mouth: p.mouth, brow: p.brow, nose_w: p.nose_w, mouth_w: p.mouth_w, eye_w: p.eye_w }; };
const ids = Object.keys(meas).filter((i) => LOOKS[i]);
const P = {}; ids.forEach((i) => { P[i] = photo(i); });
const mean = {}, sd = {};
keys.forEach((k) => { const v = ids.map((i) => P[i][k]); mean[k] = v.reduce((a, b) => a + b) / v.length; sd[k] = Math.sqrt(v.reduce((a, b) => a + (b - mean[k]) ** 2, 0) / v.length); });
const SMILE = new Set(['lapid', 'golan', 'hendel', 'gotliv', 'maoz']);                            // a wide smile widens the mouth: it is drawn as a smile anyway
const conf = (id) => { const a = Math.abs(meas[id].asym); return a < 0.12 ? 1 : a < 0.3 ? 0.75 : 0.55; };         // a turned head is measured less reliably
const target = (id) => {
  const t = {}, c = conf(id);
  keys.forEach((k) => {
    let v = P[id][k]; if (k === 'mouth_w' && SMILE.has(id)) v *= 0.84;
    const m = mean[k]; t[k] = Math.max(m - 2.6 * sd[k], Math.min(m + 2.6 * sd[k], m + K * c * (v - m)));
  });
  return t;
};

// ---- coordinate descent from the hand-made numbers
const PARAMS = { fw: [0.8, 1.5, 0.05], cheek: [0.5, 1.9, 0.08], jaw: [0.6, 1.9, 0.08], jawSq: [0, 2, 0.1], chin: [0.6, 1.9, 0.06], len: [0.85, 1.5, 0.02], nose: [0.7, 1.9, 0.05], noseL: [0.7, 2.0, 0.05], noseW: [0.7, 2.0, 0.06], mouthW: [0.75, 1.6, 0.04], eyeSize: [0.6, 1.4, 0.04], eyeGap: [0.85, 1.25, 0.02], browY: [-2, 4, 0.2], mouthDy: [-3, 3, 0.25] };
const W = { w_cheek: 1, w_ear: 1, w_c2: 1, w_j1: 1, w_j2: 1.2, w_j3: 1.2, w_ch: 0.8, chin: 1.5, nose: 1.2, mouth: 1.2, brow: 1, nose_w: 1, mouth_w: 1, eye_w: 1 };
const out = {};
for (const id of ids) {
  const L0 = LOOKS[id], T = target(id);
  const cur = {}; for (const k of Object.keys(PARAMS)) cur[k] = L0[k] === undefined ? (k === 'jawSq' || k === 'browY' || k === 'mouthDy' ? 0 : 1) : L0[k];
  const cost = (p) => {
    const m = model(Object.assign({}, L0, p)); let c = 0;
    for (const k of keys) c += W[k] * ((m[k] - T[k]) / Math.max(0.04, sd[k])) ** 2;
    for (const [k, [lo, hi]] of Object.entries(PARAMS)) c += 3 * ((p[k] - cur[k]) / (hi - lo)) ** 2;       // a little pull towards the numbers that are there
    return c;
  };
  const p = Object.assign({}, cur); let best = cost(p);
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (const [k, [lo, hi, st]] of Object.entries(PARAMS)) for (const dir of [1, -1]) for (let mult = 1; mult <= 3; mult++) {
      const q = Object.assign({}, p); q[k] = Math.max(lo, Math.min(hi, p[k] + dir * st * mult)); const c = cost(q);
      if (c < best - 1e-9) { best = c; p[k] = q[k]; moved = true; break; }
    }
    if (!moved) break;
  }
  const m = model(Object.assign({}, L0, p)), m0 = model(Object.assign({}, L0, cur));
  const dev = (mm) => keys.reduce((a, k) => a + Math.abs(mm[k] - T[k]) / sd[k], 0) / keys.length;
  out[id] = { p, before: dev(m0), after: dev(m) };
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
for (const id of ids) console.log(id.padEnd(12), 'mismatch (in cast spreads) before', out[id].before.toFixed(2), 'after', out[id].after.toFixed(2), '|', Object.entries(out[id].p).map(([k, v]) => k + ' ' + v.toFixed(2)).join(' '));

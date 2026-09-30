// ===== 3D fighters, part 3: the textures. Each person gets a texture array: face, torso front, hair, beard, kippah knit, white. =====
// Painted with the 2D canvas in a frontal view; the face is planar-projected onto the head from the front.

const FT = 6.4;                                    // face texture: pixels per head unit (covers l in [-20,20], y in [-22,18])
const faceX = (l) => 128 + l * FT;
const faceY = (y) => 115.2 - y * FT;
const TOR_X = (l) => (l + 27) * (TEXN / 54);       // torso front texture: lateral l in [-27,27], height u in [-8,56]
const TOR_Y = (u) => (56 - u) * (TEXN / 64);
const ident = (c) => c;

function texCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = TEXN;
  return c;
}
function seededRng(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

// ---------------------------------------------------------------------------------------------------------------
// FACE. Two parts: paintFaceBase (skin, pores, stubble, wrinkles: painted once per person) and paintFaceExpr (eyes, brows, mouth:
// repainted on top of a copy of the base whenever the expression changes).
// ---------------------------------------------------------------------------------------------------------------
function makeNoise(seed) {
  const rnd = seededRng(seed), tab = new Float32Array(64 * 64);
  for (let i = 0; i < tab.length; i++) tab[i] = rnd();
  const at = (x, y) => tab[(y & 63) * 64 + (x & 63)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// a smooth line through face-space points [l, y] drawn as a soft groove: wide faint shadow, narrower shadow, thin dark core, and a lit rim below
function crease(c, pal, pts, w, a) {
  if (a <= 0.01) return;
  const P = pts.map(([l, y]) => [faceX(l), faceY(y)]);
  const path = () => {
    c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    if (P.length === 2) c.lineTo(P[1][0], P[1][1]);
    else for (let k = 1; k < P.length - 1; k++) {
      const last = k === P.length - 2;
      c.quadraticCurveTo(P[k][0], P[k][1], last ? P[k + 1][0] : (P[k][0] + P[k + 1][0]) / 2, last ? P[k + 1][1] : (P[k][1] + P[k + 1][1]) / 2);
    }
  };
  const dk = rgbHex(pal.skinDD);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = rgba(dk, a * 0.2); c.lineWidth = w * 4.2; path(); c.stroke();
  c.strokeStyle = rgba(dk, a * 0.32); c.lineWidth = w * 2.2; path(); c.stroke();
  c.strokeStyle = rgba('#3a1610', a * 0.42); c.lineWidth = w * 0.8; path(); c.stroke();
  c.save(); c.translate(0, w * 1.5); c.strokeStyle = rgba(rgbHex(pal.skinL), a * 0.4); c.lineWidth = w * 0.9; path(); c.stroke(); c.restore();
}

// where a beard / stubble can grow (1 = fully), in face units
function stubbleZone(l, y) {
  const a = Math.abs(l);
  const hw = y > -3 ? 12.6 : y > -14 ? 12.6 - (-3 - y) * 0.1 : 11.5 - (-14 - y) * 0.85;
  const wl = 1 - sstep(hw - 3.2, hw + 0.6, a);
  const wt = sstep(-1.8, -6.6, y);
  const wb = sstep(-22, -19, y);
  const mouth = 1 - 0.85 * (1 - sstep(0.7, 1.15, Math.hypot(l / 6.6, (y + 12.2) / 1.9)));
  const cheeks = 0.55 + 0.45 * sstep(-6.6, -11, y);
  return wl * wt * wb * mouth * cheeks;
}

function paintFaceBase(c, look, pal) {
  const age = look.age || 0, female = !!look.female;
  c.clearRect(0, 0, TEXN, TEXN);
  c.fillStyle = pal.skin; c.fillRect(0, 0, TEXN, TEXN);
  const soft = (x, y, rx, ry, col, a, rot = 0) => {
    c.save(); c.translate(faceX(x), faceY(y)); c.rotate(rot); c.scale(rx * FT, ry * FT);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, 1); gg.addColorStop(0, rgba(col, a)); gg.addColorStop(1, rgba(col, 0));
    c.fillStyle = gg; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  const light = rgbHex(pal.skinL), shade = rgbHex(pal.skinDD);
  // broad form: mostly occlusion in the creases; the 3D lighting does the rest
  const g = c.createRadialGradient(faceX(0.5), faceY(3), 6, faceX(0), faceY(-2), 96);
  g.addColorStop(0, rgba(light, 0.4)); g.addColorStop(0.55, rgba(light, 0.1)); g.addColorStop(1, rgba(light, 0));
  c.fillStyle = g; c.fillRect(0, 0, TEXN, TEXN);
  soft(0, -19.5, 9, 3.4, shade, 0.34);                 // under the chin
  soft(-11.6, 4, 3.2, 8.5, shade, 0.2); soft(11.6, 4, 3.2, 8.5, shade, 0.2);          // temples
  soft(-11.2, -9, 3.4, 8, shade, 0.18); soft(11.2, -9, 3.4, 8, shade, 0.18);          // jaw sides
  soft(0, -7.8, 4.4, 1.5, shade, 0.34);                // under the nose
  soft(-5.6, 3.6, 6.4, 4.4, shade, 0.2 + 0.1 * age); soft(5.6, 3.6, 6.4, 4.4, shade, 0.2 + 0.1 * age);   // eye sockets
  soft(-5.4, 0.2, 5.4, 1.5, '#7a5a86', 0.1 + 0.16 * age); soft(5.4, 0.2, 5.4, 1.5, '#7a5a86', 0.1 + 0.16 * age);   // eye bags, a little violet
  soft(0, 7.6, 2.4, 3.4, light, 0.16);                 // nose bridge / glabella
  soft(-7.8, -3.6, 4.6, 3.6, female ? '#e0687a' : '#e07a6a', female ? 0.2 : 0.13); soft(7.8, -3.6, 4.6, 3.6, female ? '#e0687a' : '#e07a6a', female ? 0.2 : 0.13);   // cheeks
  soft(0, -5.7, 2.6, 2.2, '#d9645a', 0.2);             // warm nose tip
  soft(0, 14.4, 8, 3.4, light, 0.14);                  // forehead
  soft(0, -12.4, 9.4, 4.2, shade, 0.06);               // around the mouth
  soft(0, -16.6, 5.4, 2.6, '#c98d78', 0.1);            // chin

  // ---- per-pixel skin: mottling, pores, faint redness, stubble
  const hc = look.hair ? look.hair.color : '#333333', hcol = rgb(HEX.test(hc) ? hc : '#333333');
  const st = look.stubble || 0;
  const id = c.getImageData(0, 0, TEXN, TEXN), d = id.data;
  const nA = makeNoise(11 + Math.round(age * 50)), nB = makeNoise(97);
  for (let y = 0; y < TEXN; y++) {
    for (let x = 0; x < TEXN; x++) {
      const i = (y * TEXN + x) * 4, l = (x - 128) / FT, yy = (115.2 - y) / FT;
      const edge = Math.min(1, Math.min(x, TEXN - 1 - x, y, TEXN - 1 - y) / 12);          // the outer margin stays plain: no seam to the back of the head
      const faceM = 1 - sstep(13, 19, Math.hypot(l, (yy - 1) / 1.15));
      let n = ((nA(x * 0.05, y * 0.05) - 0.5) * 0.045 + (nB(x * 0.22, y * 0.22) - 0.5) * 0.02 + (hash2(x, y) - 0.5) * 0.012) * edge;
      const hp = hash2(x * 7 + 1, y * 13 + 5);
      if (hp > 0.985) n -= 0.045 * faceM; else if (hp < 0.01) n += 0.025 * faceM;        // pores and specks
      const red = (nB(x * 0.03 + 50, y * 0.03) - 0.5) * 0.05 * faceM;
      let r = d[i] * (1 + n + red), gg = d[i + 1] * (1 + n * 1.05 - red * 0.6), b = d[i + 2] * (1 + n * 1.1 - red * 0.6);
      if (st > 0) {
        const dens = st * stubbleZone(l, yy) * (0.7 + 0.6 * nA(x * 0.1 + 9, y * 0.1));
        if (dens > 0.01) {
          const m0 = 0.3 * dens;                                                       // the blue-grey shadow of shaved hair under the skin
          r += (hcol[0] - r) * m0; gg += (hcol[1] - gg) * m0; b += (hcol[2] - b) * m0;
          if (hash2(x + 31, y + 17) < dens * 0.16) { const k = 0.22 + 0.25 * hash2(x + 3, y + 91); r += (hcol[0] * 0.6 - r) * k; gg += (hcol[1] * 0.6 - gg) * k; b += (hcol[2] * 0.6 - b) * k; }
        }
      }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
  }
  c.putImageData(id, 0, 0);

  if (look.beard) soft(0, -14.5, 11, 6.5, look.beard.color, 0.5);              // skin colour under a full beard

  // ---- age: spots and wrinkles
  if (age > 0.45) {
    const rng = seededRng(4242 + Math.round(age * 100));
    for (let k = 0; k < 16 + age * 26; k++) {
      const l = (rng() - 0.5) * 30, y = -4 + rng() * 20, r = 0.25 + rng() * 0.5;
      if (Math.hypot(l, (y - 1) / 1.1) > 15) continue;
      c.fillStyle = rgba('#8a5a3a', 0.1 + 0.16 * rng()); c.beginPath(); c.ellipse(faceX(l), faceY(y), r * FT * 0.6, r * FT * 0.5, rng() * 3, 0, TAU); c.fill();
    }
  }
  const w = 0.62, A = (thr, k = 1.5) => clamp((age - thr) * k + 0.2, 0, 0.62);
  for (const s of [-1, 1]) {
    crease(c, pal, [[s * 4.8, -6.0], [s * 6.9, -8.4], [s * 7.6, -11.4]], w * 1.2, A(0.1, 1.2));                                  // nasolabial fold
    if (age > 0.3) for (const [dy, ex, ey] of [[1, 13.4, 5.0], [-1, 13.4, 1.6]]) crease(c, pal, [[s * 10.9, 3.4 + dy * 0.3], [s * (12.2 + dy * 0.1), 3.4 + (ey - 3.4) * 0.5], [s * ex, ey]], w * 0.7, A(0.3, 1.2));   // crow's feet
    if (age > 0.45) crease(c, pal, [[s * 3.4, -1.1], [s * 6.6, -1.8], [s * 9.0, -0.9]], w * 0.9, A(0.45));                       // under-eye line
    if (age > 0.45) crease(c, pal, [[s * 5.8, -13.6], [s * 6.2, -16.8]], w, A(0.45));                                          // marionette lines
    if (age > 0.4) crease(c, pal, [[s * 1.5, 10.6], [s * 1.8, 7.4]], w * 0.9, A(0.4));                                         // frown lines
  }
  if (age > 0.25) for (let k = 0; k < (age > 0.55 ? 4 : age > 0.4 ? 3 : 2); k++) {                                           // forehead
    const y = 12.4 + k * 2.2, hw = 7.4 - k * 0.5;
    crease(c, pal, [[-hw, y - 0.2], [-hw * 0.5, y + 0.5], [-0.8, y + 0.1]], w, A(0.22, 1.4));
    crease(c, pal, [[0.8, y + 0.1], [hw * 0.5, y + 0.5], [hw, y - 0.2]], w, A(0.22, 1.4));
  }
  if (age > 0.5) crease(c, pal, [[-3.2, -15.2], [0, -15.8], [3.2, -15.2]], w, A(0.5));
  // philtrum
  soft(0, -9.2, 1.2, 1.4, shade, 0.16);
  // moustache painted under the geometry (so it still shows if the shell is thin)
  if (look.stache || (look.beard && look.beard.stache !== false)) {
    const sc = look.stache || look.beard.color;
    c.save(); c.translate(faceX(0), faceY(-9.4)); c.scale(FT, -FT);
    c.fillStyle = rgba(sc, 0.9);
    c.beginPath(); c.moveTo(-7.6, -0.6); c.bezierCurveTo(-5, 2.6, -1.2, 2.2, 0, 1.2); c.bezierCurveTo(1.2, 2.2, 5, 2.6, 7.6, -0.6); c.bezierCurveTo(4.6, 0.2, 1.6, -0.2, 0, -0.5); c.bezierCurveTo(-1.6, -0.2, -4.6, 0.2, -7.6, -0.6); c.fill();
    c.restore();
  }
}

// one eye, drawn in "eye units" (c is translated to the eye centre and scaled; the inner corner is at -x)
function paintEye3(c, kind, look, pal, lookX) {
  const female = !!look.female, dk = rgbHex(pal.skinDD);
  const closed = kind === 'blink' || kind === 'happy' || kind === 'hurt' || kind === 'ko';
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (closed) {
    const y1 = kind === 'happy' ? -2.7 : kind === 'hurt' ? 2.6 : kind === 'ko' ? 1.8 : 1.4, y0 = kind === 'happy' ? 0.9 : kind === 'hurt' ? -0.5 : kind === 'ko' ? -0.5 : 0.2;
    c.strokeStyle = rgba(dk, 0.32); c.lineWidth = 2.4; c.beginPath(); c.moveTo(-4.3, y0 - 0.9); c.quadraticCurveTo(0, y1 - 1.2, 4.3, y0 - 0.9); c.stroke();      // soft lid crease above
    c.strokeStyle = '#1d0f10'; c.lineWidth = kind === 'hurt' ? 1.5 : female ? 1.4 : 1.1;
    c.beginPath(); c.moveTo(-4.3, y0); c.quadraticCurveTo(0, y1, 4.3, y0); c.stroke();
    if (female) { c.lineWidth = 0.5; c.beginPath(); c.moveTo(4.1, y0 + 0.1); c.lineTo(5.4, y0 - 1.1); c.stroke(); }
    return;
  }
  const squash = kind === 'squint' ? 0.5 : kind === 'angry' ? 0.82 : 1;
  const almond = () => { c.beginPath(); c.moveTo(-4.4, 0.3); c.bezierCurveTo(-2.9, -3.1, 2.7, -3.3, 4.4, -0.4); c.bezierCurveTo(3, 2.2, -2.3, 2.3, -4.4, 0.3); c.closePath(); };
  c.save(); c.scale(1, squash);
  almond();
  const sg = c.createRadialGradient(0.2, -0.3, 0.5, 0, 0, 5.2); sg.addColorStop(0, '#f7f4ef'); sg.addColorStop(0.7, '#ebe4de'); sg.addColorStop(1, '#c6b5ab');
  c.fillStyle = sg; c.fill();
  c.save(); almond(); c.clip();
  const ix = clamp(lookX, -1, 1.3) * 1.5 + 0.4, R = 2.4, ir = HEX.test(look.iris || '') ? look.iris : '#4a3626';
  const ig = c.createRadialGradient(ix, -0.2, 0.3, ix, -0.2, R);
  ig.addColorStop(0, lighten(ir, 0.34)); ig.addColorStop(0.55, ir); ig.addColorStop(1, darken(ir, 0.55));
  c.fillStyle = ig; c.beginPath(); c.arc(ix, -0.2, R, 0, TAU); c.fill();
  c.lineWidth = 0.09;
  for (let k = 0; k < 28; k++) {                                              // fibres of the iris
    const a = (k / 28) * TAU;
    c.strokeStyle = k % 2 ? 'rgba(255,240,220,.18)' : 'rgba(0,0,0,.22)';
    c.beginPath(); c.moveTo(ix + Math.cos(a) * 1.0, -0.2 + Math.sin(a) * 1.0); c.lineTo(ix + Math.cos(a) * R * 0.95, -0.2 + Math.sin(a) * R * 0.95); c.stroke();
  }
  c.strokeStyle = 'rgba(15,8,5,.6)'; c.lineWidth = 0.34; c.beginPath(); c.arc(ix, -0.2, R - 0.1, 0, TAU); c.stroke();      // limbal ring
  c.fillStyle = '#07040a'; c.beginPath(); c.arc(ix + 0.1, -0.2, 1.05, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.93)'; c.beginPath(); c.ellipse(ix + 0.85, -1.05, 0.55, 0.42, 0, 0, TAU); c.fill();     // window reflection
  c.fillStyle = 'rgba(255,255,255,.26)'; c.beginPath(); c.arc(ix - 0.6, 0.75, 0.3, 0, TAU); c.fill();
  const lg = c.createLinearGradient(0, -3.4, 0, 1.4); lg.addColorStop(0, 'rgba(50,18,12,.62)'); lg.addColorStop(0.45, 'rgba(50,18,12,.16)'); lg.addColorStop(1, 'rgba(50,18,12,0)');
  c.fillStyle = lg; c.fillRect(-5, -4, 10, 6);                                 // shadow of the upper lid on the eyeball
  c.fillStyle = 'rgba(214,120,110,.55)'; c.beginPath(); c.ellipse(-3.9, 0.35, 0.75, 0.55, 0, 0, TAU); c.fill();           // inner corner
  c.restore();
  c.restore();
  if (kind === 'angry') {                                                      // heavy upper lid slanting down towards the nose
    c.fillStyle = pal.skin; c.beginPath(); c.moveTo(-5.4, -4.6); c.lineTo(5.4, -4.6); c.lineTo(5.4, -0.9); c.lineTo(-5.4, -2.6); c.closePath(); c.fill();
    c.strokeStyle = rgba(dk, 0.55); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-5.2, -2.7); c.lineTo(5.2, -1.0); c.stroke();
  }
  c.strokeStyle = '#1d0f10'; c.lineWidth = female ? 1.5 : 1.15;
  c.beginPath(); c.moveTo(-4.8, 0.5); c.bezierCurveTo(-3, -3.4 * squash - 0.2, 2.9, -3.6 * squash - 0.2, 4.8, -0.5); c.stroke();     // upper lash line
  c.strokeStyle = rgba(dk, 0.5); c.lineWidth = 0.55; c.beginPath(); c.moveTo(-4.2, -0.6 - 2.4 * squash); c.bezierCurveTo(-2.4, -3.9 * squash - 1.4, 2.6, -4.2 * squash - 1.4, 4.9, -1.9); c.stroke();   // lid crease
  if (female) { c.strokeStyle = '#1d0f10'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(4.6, -0.7); c.lineTo(5.9, -1.9); c.moveTo(3.4, -2.4 * squash); c.lineTo(4.4, -3.7 * squash); c.moveTo(1.6, -3.0 * squash); c.lineTo(2.1, -4.3 * squash); c.stroke(); }
  c.strokeStyle = rgba(dk, 0.32); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-3.6, 1.7); c.quadraticCurveTo(0, 3, 3.8, 1.4); c.stroke();      // lower lid
}

// eyebrow made of individual hairs
function paintBrow3(c, side, e, look, pal) {
  const bw = look.brow || 2.5;
  let inY = 8.6, midY = 10.6, outY = 8.9;
  if (e === 'angry') { inY = 7.0; midY = 9.4; outY = 9.6; }
  else if (e === 'hurt') { inY = 10.4; midY = 10.8; outY = 8.0; }
  else if (e === 'squint') { inY = 7.8; midY = 9.2; outY = 8.0; }
  else if (e === 'happy') { inY = 8.8; midY = 11.4; outY = 9.4; }
  else if (e === 'ko') { inY = 9.6; midY = 10.6; outY = 8.4; }
  c.save(); c.translate(faceX(side * 6.0), faceY(0)); c.scale(side * FT, -FT);
  c.lineCap = 'round';
  const P = [[-3.6, inY], [-0.8, midY - 0.2], [2.4, midY], [5.2, outY]];
  const bez = (t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, f = t * t * t; return [a * P[0][0] + b * P[1][0] + d * P[2][0] + f * P[3][0], a * P[0][1] + b * P[1][1] + d * P[2][1] + f * P[3][1]]; };
  const bc = rgbHex(pal.brow), dark = darken(bc, 0.3), lite = lighten(bc, 0.18);
  c.strokeStyle = rgba(bc, 0.3); c.lineWidth = bw * 0.62;                      // the skin shadow under the hairs
  c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]); c.stroke();
  const rng = seededRng(side > 0 ? 501 : 733);
  for (let k = 0; k < 130; k++) {
    const t = rng(), [x, y] = bez(t), [x2, y2] = bez(Math.min(1, t + 0.03)), tx = x2 - x, ty = y2 - y, tl = Math.hypot(tx, ty) || 1;
    const thick = bw * 0.3 * (0.35 + 0.65 * Math.sin(Math.PI * (0.06 + 0.9 * t)));                      // fuller in the middle, thin at the tail
    const off = (rng() - 0.5) * 2 * thick, nx = -ty / tl, ny = tx / tl;
    const bx = x + nx * off, by = y + ny * off;
    const flare = (1 - t) * 0.5 - t * 0.25, len = 0.9 + rng() * 0.8;                                    // inner hairs point up, outer ones down
    const ang = Math.atan2(ty, tx) + flare * (off > 0 ? 1 : 0.4) + (rng() - 0.5) * 0.35;
    c.strokeStyle = rng() < 0.2 ? lite : rng() < 0.5 ? dark : bc; c.globalAlpha = 0.55 + rng() * 0.4; c.lineWidth = 0.14 + rng() * 0.12;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); c.stroke();
  }
  c.globalAlpha = 1;
  c.restore();
}

function paintMouth3(c, m, pal, look) {
  const female = !!look.female, lip = rgbHex(pal.lip), dark = '#3d1019', shade = rgbHex(pal.skinDD);
  c.save(); c.translate(faceX(0), faceY(-12.2)); c.scale(FT, -FT);      // units, y up
  c.lineCap = 'round'; c.lineJoin = 'round';
  const line = 'rgba(38,12,14,.85)';
  const lips = (w, up, lo) => {                                       // closed lips: cupid's bow on top, fuller lower lip
    const a = female ? 0.95 : 0.6;
    c.globalAlpha = 1; c.fillStyle = rgba(shade, 0.22); c.beginPath(); c.ellipse(0, -lo * 1.55, w * 0.5, 0.6, 0, 0, TAU); c.fill();     // shadow below the lower lip
    c.globalAlpha = a;
    let g = c.createLinearGradient(0, up, 0, -0.1); g.addColorStop(0, darken(lip, 0.22)); g.addColorStop(1, lip);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w, 0); c.bezierCurveTo(-w * 0.5, up * 0.9, -w * 0.18, up * 1.25, 0, up * 0.85); c.bezierCurveTo(w * 0.18, up * 1.25, w * 0.5, up * 0.9, w, 0);
    c.bezierCurveTo(w * 0.5, 0.35, -w * 0.5, 0.35, -w, 0); c.fill();
    g = c.createLinearGradient(0, 0, 0, -lo * 1.3); g.addColorStop(0, lip); g.addColorStop(1, lighten(lip, 0.12));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-w * 0.95, -0.05); c.bezierCurveTo(-w * 0.5, -lo * 1.3, w * 0.5, -lo * 1.3, w * 0.95, -0.05); c.bezierCurveTo(w * 0.5, 0.2, -w * 0.5, 0.2, -w * 0.95, -0.05); c.fill();
    c.globalAlpha = female ? 0.5 : 0.22; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, -lo * 0.72, w * 0.26, 0.28, 0, 0, TAU); c.fill();     // shine on the lower lip
    c.globalAlpha = 0.09; c.strokeStyle = '#3a1010'; c.lineWidth = 0.08;
    for (let k = -6; k <= 6; k++) { c.beginPath(); c.moveTo(k * w * 0.13, up * 0.4); c.lineTo(k * w * 0.12, -lo * 0.9); c.stroke(); }                     // fine lines in the lips
    c.globalAlpha = 1;
  };
  c.lineWidth = 0.55; c.strokeStyle = line;
  if (m === 'closed') { lips(6.6, 1.5, 2.1); c.beginPath(); c.moveTo(-6.6, 0); c.quadraticCurveTo(0, -0.7, 6.6, 0); c.stroke(); }
  else if (m === 'smile') { lips(6.8, 1.4, 2.1); c.beginPath(); c.moveTo(-7, 0.9); c.quadraticCurveTo(0, -1.5, 7, 0.9); c.stroke(); }
  else if (m === 'sad') { lips(6.2, 1.3, 1.9); c.beginPath(); c.moveTo(-6.4, -0.8); c.quadraticCurveTo(0, 1.1, 6.4, -0.8); c.stroke(); }
  else if (m === 'o') {
    c.fillStyle = dark; c.beginPath(); c.ellipse(0, -1.4, 3.1, 4.1, 0, 0, TAU); c.fill();
    c.strokeStyle = lip; c.lineWidth = 1.05; c.stroke();
  } else if (m === 'grin') {
    c.fillStyle = dark; c.beginPath(); c.moveTo(-7.4, 1.1); c.quadraticCurveTo(0, -1.2, 7.4, 1.1); c.quadraticCurveTo(0, -6.6, -7.4, 1.1); c.fill();
    const tg = c.createLinearGradient(0, 0.9, 0, -2.4); tg.addColorStop(0, '#fbf8f2'); tg.addColorStop(1, '#ddd5c8');
    c.fillStyle = tg; c.beginPath(); c.moveTo(-6.6, 0.9); c.quadraticCurveTo(0, -0.9, 6.6, 0.9); c.lineTo(6.2, -0.7); c.quadraticCurveTo(0, -2.4, -6.2, -0.7); c.fill();
    c.strokeStyle = 'rgba(120,100,90,.35)'; c.lineWidth = 0.09; for (let k = -5; k <= 5; k++) { c.beginPath(); c.moveTo(k * 1.15, 0.9 - Math.abs(k) * 0.05 - 0.4); c.lineTo(k * 1.1, -1.7 + Math.abs(k) * 0.02); c.stroke(); }
    c.strokeStyle = lip; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-7.4, 1.1); c.quadraticCurveTo(0, -6.6, 7.4, 1.1); c.stroke();
    c.beginPath(); c.moveTo(-7.4, 1.1); c.quadraticCurveTo(0, -1.2, 7.4, 1.1); c.stroke();
  } else {   // open / shout
    const big = m === 'shout' ? 1 : 0.7;
    c.fillStyle = dark; c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(0, 0.1, 6.4, 1); c.quadraticCurveTo(6.2, -6 * big - 1, 0, -7 * big - 1); c.quadraticCurveTo(-6.2, -6 * big - 1, -6.4, 1); c.fill();
    c.save(); c.clip();
    const tg = c.createLinearGradient(0, 1.4, 0, -1.5); tg.addColorStop(0, '#fbf8f2'); tg.addColorStop(1, '#ddd5c8');
    c.fillStyle = tg; c.beginPath(); c.moveTo(-7, 1.4); c.quadraticCurveTo(0, 0.6, 7, 1.4); c.lineTo(7, -1.5); c.quadraticCurveTo(0, -0.6, -7, -1.5); c.fill();
    const tn = c.createRadialGradient(0, -5.2 * big - 1, 0.3, 0, -5.2 * big - 1, 3.8); tn.addColorStop(0, '#d8707f'); tn.addColorStop(1, '#a5404f');
    c.fillStyle = tn; c.beginPath(); c.ellipse(0, -5.2 * big - 1, 3.8, 2.2 * big + 0.5, 0, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = lip; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(0, 0.1, 6.4, 1); c.stroke();
    c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(-6.2, -6 * big - 1, 0, -7 * big - 1); c.quadraticCurveTo(6.2, -6 * big - 1, 6.4, 1); c.stroke();
  }
  c.restore();
}

function paintFaceExpr(c, look, pal, eyes, mouth) {
  const soft = (x, y, rx, ry, col, a) => {
    c.save(); c.translate(faceX(x), faceY(y)); c.scale(rx * FT, ry * FT);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, 1); gg.addColorStop(0, rgba(col, a)); gg.addColorStop(1, rgba(col, 0));
    c.fillStyle = gg; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  const age = look.age || 0, w = 0.62;
  if (eyes === 'angry') { for (const s of [-1, 1]) crease(c, pal, [[s * 1.3, 10.8], [s * 1.6, 7.2]], w * 1.1, 0.65 + 0.2 * age); crease(c, pal, [[-3.2, 12.4], [0, 12.9], [3.2, 12.4]], w, 0.4 + 0.2 * age); }
  if (eyes === 'happy' || mouth === 'smile' || mouth === 'grin') {
    for (const s of [-1, 1]) { soft(s * 8, -3.4, 3.6, 2.6, rgbHex(pal.skinL), 0.24); if (age < 0.3) crease(c, pal, [[s * 11, 3.2], [s * 13.6, 4.6]], w * 0.7, 0.35); }
  }
  const K = 0.82 * FT * (look.eyeSize || 1);
  for (const side of [-1, 1]) {
    c.save(); c.translate(faceX(side * 5.7), faceY(3.5)); c.scale(side * K, K);
    paintEye3(c, eyes, look, pal, 0.3);
    c.restore();
  }
  paintBrow3(c, -1, eyes, look, pal); paintBrow3(c, 1, eyes, look, pal);
  // nostrils (the shape itself is geometry)
  c.fillStyle = 'rgba(46,14,10,.5)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(faceX(s * 2.1), faceY(-7.2), 1.0 * FT, 0.6 * FT, s * 0.35, 0, TAU); c.fill(); }
  soft(0, -5.7, 1.8, 1.2, rgbHex(pal.skinL), 0.4);
  paintMouth3(c, mouth, pal, look);
}
const rgbHex = (c) => { const m = String(c).match(/[\d.]+/g); if (c[0] === '#') { const v = rgb(c); return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join(''); } return '#' + [m[0], m[1], m[2]].map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''); };

// ---------------------------------------------------------------------------------------------------------------
// TORSO FRONT (jacket, shirt, tie, lapels), planar from the front
// ---------------------------------------------------------------------------------------------------------------
function paintTorso(c, look, pal) {
  c.clearRect(0, 0, TEXN, TEXN);
  c.fillStyle = pal.suit; c.fillRect(0, 0, TEXN, TEXN);
  const P = (l, u) => [TOR_X(l), TOR_Y(u)];
  const poly = (pts, fill, stroke, lw) => {
    c.beginPath(); pts.forEach(([l, u], i) => { const [x, y] = P(l, u); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.4; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
  };
  const open = !!look.open, INKC = 'rgba(15,8,30,.55)';
  // shirt V
  poly([[-6.6, 54.5], [6.6, 54.5], [0, 25.5]], pal.shirt, INKC, 1.3);
  if (open) poly([[-4.6, 54.5], [4.6, 54.5], [0, 39]], pal.skin, 'rgba(60,25,15,.4)', 1);
  // collar wings
  poly([[-6.6, 54.5], [-1.4, 49], [-9.6, 46.4]], pal.shirt, INKC, 1.2);
  poly([[6.6, 54.5], [1.4, 49], [9.6, 46.4]], pal.shirt, INKC, 1.2);
  // tie
  if (look.tie && !open) {
    const tc = look.tie, td = darken(tc, 0.3);
    const [x0] = P(-3, 0), [x1] = P(3, 0);
    const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, td); g.addColorStop(0.5, tc); g.addColorStop(1, td);
    poly([[-2.6, 49], [2.6, 49], [3.7, 33], [0, 25.2], [-3.7, 33]], g, INKC, 1.2);
    poly([[-3.4, 53.6], [3.4, 53.6], [3, 49], [-3, 49]], tc, INKC, 1.2);
  }
  if (look.tie && !open) {                                   // repp stripes and a satin sheen on the tie, a shadowed knot
    c.save(); c.beginPath(); [[-2.6, 49], [2.6, 49], [3.7, 33], [0, 25.2], [-3.7, 33]].forEach(([l, u], i) => { const [x, y] = P(l, u); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 1.4;
    for (let k = -20; k < 30; k++) { const [x0, y0] = P(-6, 26 + k * 2.6), [x1, y1] = P(6, 30 + k * 2.6); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    const [sx0, sy0] = P(-1.2, 45), [sx1, sy1] = P(-0.2, 30); const sg = c.createLinearGradient(sx0, sy0, sx1, sy1); sg.addColorStop(0, 'rgba(255,255,255,.24)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(0, 0, TEXN, TEXN);
    c.restore();
    const [kx, ky] = P(0, 49.2); const kg = c.createRadialGradient(kx, ky, 1, kx, ky, 12); kg.addColorStop(0, 'rgba(0,0,0,.34)'); kg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = kg; c.fillRect(kx - 14, ky - 6, 28, 22);
  }
  // lapels
  const lap = pal.suitL;
  poly([[-6.6, 54.5], [-14.8, 46.6], [-11.4, 33], [0, 25.5], [-5, 34], [-4.6, 47.8]], lap, INKC, 1.3);
  poly([[6.6, 54.5], [14.8, 46.6], [11.4, 33], [0, 25.5], [5, 34], [4.6, 47.8]], lap, INKC, 1.3);
  {                                                            // pressed edge (highlight) and stitching along the lapels
    c.save(); c.lineJoin = 'round';
    for (const s of [-1, 1]) {
      const edge = [[6.6, 54.5], [14.8, 46.6], [11.4, 33], [0, 25.5]].map(([l, u]) => [l * s, u]);
      c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 1.1; c.beginPath(); edge.forEach(([l, u], i) => { const [x, y] = P(l * 0.96, u - 0.7); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.setLineDash([2.2, 2.2]); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 0.7;
      c.beginPath(); edge.forEach(([l, u], i) => { const [x, y] = P(l * 0.9 - s * 0.3, u - 1.5); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.setLineDash([]);
    }
    c.restore();
  }
  // centre line + buttons + hem shadow
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); const [ax, ay] = P(0, 25.5), [bx, by] = P(0, -8); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  c.fillStyle = pal.suitDD;
  for (const u of [20, 8]) { const [x, y] = P(1.2, u); c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke(); }
  // pocket square + pin
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.1; const [px, py] = P(-16, 33.6), [px2] = P(-9.8, 0); c.beginPath(); c.moveTo(px, py); c.lineTo(px2, py - 1.5); c.stroke();
  poly([[-15.6, 34], [-13.2, 37.6], [-10.4, 34.4]], look.tie || '#ffffff', INKC, 0.9);
  if (look.pin) { const [x, y] = P(11.8, 43.4); c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fillStyle = look.pin; c.fill(); c.lineWidth = 0.9; c.strokeStyle = INKC; c.stroke(); }
  // fabric folds
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (const [l0, u0, l1, u1, ql, qu] of [[-15, 17, -3, 14, -9, 12.5], [4, 15, 15, 17, 9.5, 13], [-14, 30, -9, 22, -12.5, 25], [13.5, 30, 10, 21, 12.6, 25]]) {
    const [x0, y0] = P(l0, u0), [x1, y1] = P(l1, u1), [xq, yq] = P(ql, qu); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(xq, yq, x1, y1); c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.2;
  for (const [l0, u0, l1, u1, ql, qu] of [[-15, 19, -3, 16, -9, 14.5], [4, 17, 15, 19, 9.5, 15]]) {
    const [x0, y0] = P(l0, u0), [x1, y1] = P(l1, u1), [xq, yq] = P(ql, qu); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(xq, yq, x1, y1); c.stroke();
  }
  // plain corner used by the back of the jacket
  c.fillStyle = pal.suit; c.fillRect(TEXN - 40, TEXN - 40, 40, 40);
}

// ---------------------------------------------------------------------------------------------------------------
// HAIR / BEARD strands, KIPPAH knit, WHITE
// ---------------------------------------------------------------------------------------------------------------
function paintStrands(c, color, seed, dense) {
  const base = HEX.test(color) ? color : '#333333', rng = seededRng(seed), v = rgb(base), lum = (v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11) / 255;
  const pale = lum > 0.6;
  c.fillStyle = darken(base, pale ? 0.16 : 0.1); c.fillRect(0, 0, TEXN, TEXN);
  // clumps: wide soft bands running along the strands, alternately lighter and darker (the texture tiles, so bands are drawn wrapped)
  for (let i = 0; i < 44; i++) {
    const x = rng() * TEXN, w = 3 + rng() * 9, hi = rng() < 0.5, col = hi ? lighten(base, pale ? 0.3 : 0.24) : darken(base, 0.36), a = 0.16 + rng() * 0.2;
    for (const ox of [-TEXN, 0, TEXN]) {
      const g = c.createLinearGradient(x + ox - w, 0, x + ox + w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, hi ? rgba(rgbHex(col), a * 0.55) : rgba(rgbHex(col), a * 0.7)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x + ox - w, 0, w * 2, TEXN);
    }
  }
  // single strands: long, slightly wavy, some very bright (shine), some dark (gaps)
  const cols = [lighten(base, 0.26), lighten(base, 0.14), darken(base, 0.2), darken(base, 0.36)];
  c.lineCap = 'round';
  for (let i = 0; i < (dense || 700) * 1.6; i++) {
    const x = rng() * TEXN, y0 = rng() * TEXN, len = 40 + rng() * 150, w = 0.5 + rng() * 0.9, dx1 = (rng() - 0.5) * 8, dx2 = (rng() - 0.5) * 5;
    c.strokeStyle = cols[(rng() * cols.length) | 0]; c.globalAlpha = 0.1 + rng() * 0.24; c.lineWidth = w;
    for (const oy of [0, -TEXN, TEXN]) {
      if (y0 + len + oy < 0 || y0 + oy > TEXN) continue;
      c.beginPath(); c.moveTo(x, y0 + oy); c.quadraticCurveTo(x + dx1, y0 + oy + len * 0.5, x + dx2, y0 + oy + len); c.stroke();
    }
  }
  c.globalAlpha = 1;
}
// woven suit fabric (herringbone twill), tileable: multiplies the colour of every cloth surface and gives it relief
function paintCloth(c) {
  const id = c.createImageData(TEXN, TEXN), d = id.data, rng = seededRng(2024);
  for (let y = 0; y < TEXN; y++) {
    for (let x = 0; x < TEXN; x++) {
      const flip = ((x >> 6) & 1) ? -1 : 1, dg = (x + flip * y) & 7, rib = dg < 4 ? 1 : 0;
      const thread = ((x ^ y) & 1) * 0.035 + (((x >> 1) + (y >> 1)) & 1) * 0.02;
      const v = 0.68 + 0.2 * rib + thread + (rng() - 0.5) * 0.05, k = Math.max(0, Math.min(255, Math.round(v * 255))), i = (y * TEXN + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = k; d[i + 3] = 255;
    }
  }
  c.putImageData(id, 0, 0);
}
function paintKnit(c, kip) {
  c.fillStyle = kip ? kip.color : '#222'; c.fillRect(0, 0, TEXN, TEXN);
  if (!kip || !kip.knit) { c.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 0; y < TEXN; y += 6) c.fillRect(0, y, TEXN, 2); return; }
  c.fillStyle = kip.knit;
  for (const [y0, y1] of [[46, 58], [108, 120], [168, 178], [214, 220]]) c.fillRect(0, y0, TEXN, y1 - y0);
  c.fillStyle = darken(kip.color, 0.25);
  for (let x = 0; x < TEXN; x += 16) for (const y of [84, 144, 196]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 10); c.lineTo(x + 16, y); c.closePath(); c.fill(); }
}
function paintWhite(c) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, TEXN, TEXN); }

// ---------------------------------------------------------------------------------------------------------------
// the boss: a walking ballot box (torso label + robot face)
// ---------------------------------------------------------------------------------------------------------------
function paintRobotTorso(c, look) {
  c.fillStyle = look.suit; c.fillRect(0, 0, TEXN, TEXN);
  const g = c.createLinearGradient(0, 0, TEXN, 0); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
  c.fillStyle = g; c.fillRect(0, 0, TEXN, TEXN);
  c.fillStyle = '#ffd23d'; c.fillRect(28, 205, 200, 16);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.strokeRect(28, 205, 200, 16);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#1b1330'; c.lineWidth = 4; c.fillRect(104, 40, 48, 40); c.strokeRect(104, 40, 48, 40);   // ballot slip
  c.font = '900 50px "Secular One", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = 9; c.strokeStyle = '#1b1330'; c.strokeText('3.25%', 128, 140); c.fillStyle = '#ffffff'; c.fillText('3.25%', 128, 140);
  c.fillStyle = look.suit; c.fillRect(TEXN - 40, TEXN - 40, 40, 40);
}
function paintRobotFace(c, look, eyes, mouth) {
  c.clearRect(0, 0, TEXN, TEXN);
  const g = c.createLinearGradient(0, 0, 0, TEXN); g.addColorStop(0, '#e6ebf5'); g.addColorStop(1, '#8d97ab');
  c.fillStyle = g; c.fillRect(0, 0, TEXN, TEXN);
  c.fillStyle = '#12163a'; c.beginPath(); c.roundRect ? c.roundRect(faceX(-12.2), faceY(6), 24.4 * FT, 15 * FT, 12) : c.rect(faceX(-12.2), faceY(6), 24.4 * FT, 15 * FT); c.fill();
  const col = eyes === 'hurt' || eyes === 'ko' ? '#ff5a7a' : eyes === 'happy' ? '#7dff9a' : '#6ff0ff';
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3.4 * FT / 3; c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = faceX(s * 6.6), ey = faceY(-1.2);
    if (eyes === 'ko') { c.beginPath(); c.moveTo(ex - 15, ey - 14); c.lineTo(ex + 15, ey + 14); c.moveTo(ex + 15, ey - 14); c.lineTo(ex - 15, ey + 14); c.stroke(); }
    else if (eyes === 'happy') { c.beginPath(); c.arc(ex, ey + 8, 18, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else if (eyes === 'angry') { c.beginPath(); c.moveTo(ex - 18, ey - 22 + (s > 0 ? 8 : 0)); c.lineTo(ex + 18, ey - 6 - (s > 0 ? 8 : 0)); c.lineTo(ex + 18, ey + 16); c.lineTo(ex - 18, ey + 16); c.closePath(); c.fill(); }
    else { c.beginPath(); c.ellipse(ex, ey, 15, eyes === 'squint' ? 7 : 19, 0, 0, TAU); c.fill(); }
  }
  const open = mouth === 'shout' || mouth === 'open' || mouth === 'o' ? 34 : 14;
  c.fillStyle = '#1b1330'; c.fillRect(faceX(-9), faceY(-8.5), 18 * FT, open + 6);
  c.fillStyle = '#ffffff'; c.fillRect(faceX(-8), faceY(-8.5) + 3, 16 * FT, 6);
  c.fillStyle = '#5b6478'; for (const [x, y] of [[-14, 14], [14, 14], [-14, -16], [14, -16]]) { c.beginPath(); c.arc(faceX(x), faceY(y), 5, 0, TAU); c.fill(); }
  c.fillStyle = '#e6ebf5'; c.fillRect(0, 0, TEXN, 6);
}

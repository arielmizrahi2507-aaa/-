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
// FACE
// ---------------------------------------------------------------------------------------------------------------
function paintMouth3(c, m, pal, look) {
  const female = !!look.female, lip = pal.lip, dark = '#3d1019';
  c.save(); c.translate(faceX(0), faceY(-12.2)); c.scale(FT, -FT);      // units, y up
  c.lineCap = 'round'; c.lineJoin = 'round';
  const line = 'rgba(38,12,14,.85)';
  const lips = (w, up, lo) => {                                       // closed lips: cupid's bow on top, fuller lower lip
    c.globalAlpha = female ? 0.92 : 0.55; c.fillStyle = lip;
    c.beginPath(); c.moveTo(-w, 0); c.bezierCurveTo(-w * 0.5, up * 0.9, -w * 0.18, up * 1.25, 0, up * 0.85); c.bezierCurveTo(w * 0.18, up * 1.25, w * 0.5, up * 0.9, w, 0);
    c.bezierCurveTo(w * 0.5, 0.35, -w * 0.5, 0.35, -w, 0); c.fill();
    c.beginPath(); c.moveTo(-w * 0.95, -0.05); c.bezierCurveTo(-w * 0.5, -lo * 1.3, w * 0.5, -lo * 1.3, w * 0.95, -0.05); c.bezierCurveTo(w * 0.5, 0.2, -w * 0.5, 0.2, -w * 0.95, -0.05); c.fill();
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
    c.fillStyle = '#f6f2ea'; c.beginPath(); c.moveTo(-6.6, 0.9); c.quadraticCurveTo(0, -0.9, 6.6, 0.9); c.lineTo(6.2, -0.7); c.quadraticCurveTo(0, -2.4, -6.2, -0.7); c.fill();
    c.strokeStyle = lip; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-7.4, 1.1); c.quadraticCurveTo(0, -6.6, 7.4, 1.1); c.stroke();
    c.beginPath(); c.moveTo(-7.4, 1.1); c.quadraticCurveTo(0, -1.2, 7.4, 1.1); c.stroke();
  } else {   // open / shout
    const big = m === 'shout' ? 1 : 0.7;
    c.fillStyle = dark; c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(0, 0.1, 6.4, 1); c.quadraticCurveTo(6.2, -6 * big - 1, 0, -7 * big - 1); c.quadraticCurveTo(-6.2, -6 * big - 1, -6.4, 1); c.fill();
    c.save(); c.clip();
    c.fillStyle = '#f6f2ea'; c.beginPath(); c.moveTo(-7, 1.4); c.quadraticCurveTo(0, 0.6, 7, 1.4); c.lineTo(7, -1.5); c.quadraticCurveTo(0, -0.6, -7, -1.5); c.fill();
    c.fillStyle = '#c85a6c'; c.beginPath(); c.ellipse(0, -5.2 * big - 1, 3.8, 2.2 * big + 0.5, 0, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = lip; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(0, 0.1, 6.4, 1); c.stroke();
    c.beginPath(); c.moveTo(-6.4, 1); c.quadraticCurveTo(-6.2, -6 * big - 1, 0, -7 * big - 1); c.quadraticCurveTo(6.2, -6 * big - 1, 6.4, 1); c.stroke();
  }
  c.restore();
}

function paintBrow3(c, side, e, look, pal) {
  const bw = (look.brow || 2.5) * 0.62;
  let inY = 8.6, midY = 10.6, outY = 8.9;
  if (e === 'angry') { inY = 7.0; midY = 9.4; outY = 9.6; }
  else if (e === 'hurt') { inY = 10.4; midY = 10.8; outY = 8.0; }
  else if (e === 'squint') { inY = 7.8; midY = 9.2; outY = 8.0; }
  else if (e === 'happy') { inY = 8.8; midY = 11.4; outY = 9.4; }
  else if (e === 'ko') { inY = 9.6; midY = 10.6; outY = 8.4; }
  c.save(); c.translate(faceX(side * 6.0), faceY(0)); c.scale(side * FT, -FT);
  c.lineCap = 'round'; c.strokeStyle = pal.brow;
  const pts = [[-3.6, inY], [-0.8, midY - 0.2], [2.4, midY], [5.2, outY]];
  for (let pass = 0; pass < 3; pass++) {
    c.lineWidth = bw * (1 - pass * 0.28); c.globalAlpha = pass === 0 ? 1 : 0.7;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1] - pass * 0.15);
    c.bezierCurveTo(pts[1][0], pts[1][1] + pass * 0.12, pts[2][0], pts[2][1] + pass * 0.1, pts[3][0], pts[3][1]); c.stroke();
  }
  c.globalAlpha = 0.5; c.strokeStyle = pal.hairL || '#fff'; c.lineWidth = bw * 0.18;
  c.beginPath(); c.moveTo(-3, inY + 0.4); c.bezierCurveTo(-0.5, midY + 0.3, 2.4, midY + 0.4, 5, outY + 0.3); c.stroke();
  c.restore();
}

function paintFace(c, look, pal, eyes, mouth, lookX) {
  const age = look.age || 0, female = !!look.female;
  c.clearRect(0, 0, TEXN, TEXN);
  c.fillStyle = pal.skin; c.fillRect(0, 0, TEXN, TEXN);
  // gentle form shading (keeps the outer margin plain so the seam to the back of the head is invisible)
  let g = c.createRadialGradient(faceX(0.5), faceY(3), 6, faceX(0), faceY(-2), 96);
  g.addColorStop(0, rgba(rgbHex(pal.skinL), 0.55)); g.addColorStop(0.55, rgba(rgbHex(pal.skinL), 0.14)); g.addColorStop(1, rgba(rgbHex(pal.skinL), 0));
  c.fillStyle = g; c.fillRect(0, 0, TEXN, TEXN);
  const soft = (x, y, rx, ry, col, a, rot = 0) => {
    c.save(); c.translate(faceX(x), faceY(y)); c.rotate(rot); c.scale(rx * FT, ry * FT);
    const gg = c.createRadialGradient(0, 0, 0, 0, 0, 1); gg.addColorStop(0, rgba(col, a)); gg.addColorStop(1, rgba(col, 0));
    c.fillStyle = gg; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  const shade = rgbHex(pal.skinDD);
  soft(0, -19.5, 9, 3.4, shade, 0.34);                 // under the chin
  soft(-11.6, 4, 3.2, 8.5, shade, 0.22); soft(11.6, 4, 3.2, 8.5, shade, 0.22);        // temples
  soft(-11.2, -9, 3.4, 8, shade, 0.2); soft(11.2, -9, 3.4, 8, shade, 0.2);            // jaw sides
  soft(0, -7.8, 4.4, 1.5, shade, 0.34);                // under the nose
  soft(-5.6, 3.6, 6.4, 4.4, shade, 0.16 + 0.1 * age); soft(5.6, 3.6, 6.4, 4.4, shade, 0.16 + 0.1 * age);   // eye sockets
  soft(-5.4, 0.2, 5.4, 1.5, shade, 0.1 + 0.16 * age); soft(5.4, 0.2, 5.4, 1.5, shade, 0.1 + 0.16 * age);   // eye bags
  soft(0, 7.6, 2.4, 3.4, rgbHex(pal.skinL), 0.2);       // nose bridge / glabella highlight
  soft(-7.8, -3.6, 4.6, 3.6, female ? '#e0687a' : '#e07a6a', female ? 0.2 : 0.13); soft(7.8, -3.6, 4.6, 3.6, female ? '#e0687a' : '#e07a6a', female ? 0.2 : 0.13);   // cheeks
  soft(0, 14.4, 8, 3.4, rgbHex(pal.skinL), 0.2);        // forehead
  soft(0, -12.4, 9.4, 4.2, rgbHex(pal.skinDD), 0.07);   // around the mouth

  // stubble / beard base
  const hc = look.hair ? look.hair.color : '#333333', hcol = HEX.test(hc) ? hc : '#333333';
  if (look.beard) {
    soft(0, -14.5, 11, 6.5, look.beard.color, 0.5);
  } else if (look.stubble) {
    const st = look.stubble, rng = seededRng(77);
    c.save(); c.beginPath(); c.ellipse(faceX(0), faceY(-10.5), 12.6 * FT, 11 * FT, 0, 0, TAU); c.clip();
    c.fillStyle = rgba(hcol, 0.05 + 0.1 * st); c.fillRect(0, faceY(-3), TEXN, TEXN);
    c.fillStyle = rgba(hcol, 0.32 + 0.35 * st);
    for (let i = 0; i < 700; i++) { const x = rng() * TEXN, y = faceY(-21) + rng() * (faceY(-4) - faceY(-21)); c.fillRect(x, y, 1.3, 1.3); }
    c.restore();
  }

  // eyes
  const K = 0.9 * FT;
  for (const side of [-1, 1]) {
    c.save(); c.translate(faceX(side * 5.7), faceY(3.5)); c.scale(side, 1);
    drawEye(c, 0, 0, K, eyes, look, ident, 0.3, false);
    c.restore();
  }
  paintBrow3(c, -1, eyes, look, pal); paintBrow3(c, 1, eyes, look, pal);

  // nose shading (the shape itself is geometry)
  c.fillStyle = 'rgba(46,14,10,.5)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(faceX(s * 2.1), faceY(-7.2), 1.0 * FT, 0.6 * FT, s * 0.35, 0, TAU); c.fill(); }
  soft(0, -5.7, 1.8, 1.2, rgbHex(pal.skinL), 0.5);

  // age lines
  if (age > 0.05) {
    c.strokeStyle = `rgba(70,30,25,${0.14 + 0.32 * age})`; c.lineWidth = 0.7 * FT / 1.6; c.lineCap = 'round';
    const L = (x0, y0, x1, y1, qx, qy) => { c.beginPath(); c.moveTo(faceX(x0), faceY(y0)); c.quadraticCurveTo(faceX(qx), faceY(qy), faceX(x1), faceY(y1)); c.stroke(); };
    for (const s of [-1, 1]) {
      L(s * 4.6, -5.4, s * 7.8, -11.6, s * 6.9, -7.6);                              // nasolabial fold
      L(s * 9.4, 4.0, s * 12.4, 5.4, s * 10.9, 4.9); L(s * 9.3, 3.0, s * 12.5, 2.8, s * 10.9, 3.0);   // crow's feet
      if (age > 0.5) L(s * 3.6, -14.8, s * 6.4, -13.6, s * 5, -14.8);
    }
    if (age > 0.3) { L(-6.6, 12.8, 6.6, 12.8, 0, 13.6); L(-7.4, 15.0, 7.4, 15.0, 0, 15.9); }
    if (age > 0.55) L(-6, 11.0, 6, 11.0, 0, 11.6);
  }
  paintMouth3(c, mouth, pal, look);
  // philtrum + lip corners hint
  soft(0, -9.2, 1.2, 1.4, rgbHex(pal.skinDD), 0.16);
  // moustache painted under the geometry (so it still shows if the shell is thin)
  if (look.stache || (look.beard && look.beard.stache !== false)) {
    const sc = look.stache || look.beard.color;
    c.save(); c.translate(faceX(0), faceY(-9.4)); c.scale(FT, -FT);
    c.fillStyle = rgba(sc, 0.9);
    c.beginPath(); c.moveTo(-7.6, -0.6); c.bezierCurveTo(-5, 2.6, -1.2, 2.2, 0, 1.2); c.bezierCurveTo(1.2, 2.2, 5, 2.6, 7.6, -0.6); c.bezierCurveTo(4.6, 0.2, 1.6, -0.2, 0, -0.5); c.bezierCurveTo(-1.6, -0.2, -4.6, 0.2, -7.6, -0.6); c.fill();
    c.restore();
  }
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
  // lapels
  const lap = pal.suitL;
  poly([[-6.6, 54.5], [-14.8, 46.6], [-11.4, 33], [0, 25.5], [-5, 34], [-4.6, 47.8]], lap, INKC, 1.3);
  poly([[6.6, 54.5], [14.8, 46.6], [11.4, 33], [0, 25.5], [5, 34], [4.6, 47.8]], lap, INKC, 1.3);
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
  const base = HEX.test(color) ? color : '#333333', rng = seededRng(seed);
  c.fillStyle = base; c.fillRect(0, 0, TEXN, TEXN);
  const cols = [lighten(base, 0.28), lighten(base, 0.14), darken(base, 0.2), darken(base, 0.36)];
  c.lineCap = 'round';
  for (let i = 0; i < (dense || 700); i++) {
    const x = rng() * TEXN, y0 = rng() * TEXN, len = 26 + rng() * 90, w = 0.6 + rng() * 1.3;
    c.strokeStyle = cols[(rng() * cols.length) | 0]; c.globalAlpha = 0.12 + rng() * 0.26; c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + (rng() - 0.5) * 9, y0 + len * 0.5, x + (rng() - 0.5) * 5, y0 + len); c.stroke();
    if (y0 + len > TEXN) { c.beginPath(); c.moveTo(x, y0 - TEXN); c.quadraticCurveTo(x + (rng() - 0.5) * 9, y0 + len * 0.5 - TEXN, x + (rng() - 0.5) * 5, y0 + len - TEXN); c.stroke(); }
  }
  c.globalAlpha = 1;
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

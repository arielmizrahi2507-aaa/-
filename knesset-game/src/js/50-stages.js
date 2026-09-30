// ===== Stages: parallax backdrops painted procedurally, cached to bitmaps =====
// Each layer has a parallax factor f (0 = fixed to the camera, 1 = moves with the world) and a draw function that
// paints into a bitmap of size (W + (STAGE_W - W) * f) x H in layer-local coordinates. A layer may set `blur` (px) for depth of field.
// A stage may set `refl` (0-1): how strongly a glossy floor mirrors the fighters.

function vgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function hgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function radial(c, x, y, r, col, a0, a1 = 0) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a0)); g.addColorStop(1, rgba(col, a1));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function srand(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

let _noise = null;
function noiseTile() {
  if (_noise) return _noise;
  const t = document.createElement('canvas'); t.width = t.height = 128;
  const x = t.getContext('2d'), id = x.createImageData(128, 128), rn = srand(99);
  for (let i = 0; i < id.data.length; i += 4) { const v = (rn() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0);
  return (_noise = t);
}
// film grain / material texture
function grain(c, w, h, a) {
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = a; c.fillStyle = c.createPattern(noiseTile(), 'repeat'); c.fillRect(0, 0, w, h); c.restore();
}
// soft beam of light (additive)
function shaft(c, x, y, w0, w1, len, col, a) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.moveTo(x - w0 / 2, y); c.lineTo(x + w0 / 2, y); c.lineTo(x + w1 / 2, y + len); c.lineTo(x - w1 / 2, y + len); c.closePath(); c.fill();
  c.restore();
}
function archPath(c, cx, by, hw, hh) {
  c.beginPath(); c.moveTo(cx - hw, by); c.lineTo(cx - hw, by - hh + hw); c.arc(cx, by - hh + hw, hw, Math.PI, 0); c.lineTo(cx + hw, by); c.closePath();
}
function pillar(c, x, y, w, h, base) {
  hgrad(c, x, y, w, h, [[0, darken(base, 0.32)], [0.28, lighten(base, 0.05)], [0.5, lighten(base, 0.28)], [0.78, base], [1, darken(base, 0.4)]]);
  c.strokeStyle = 'rgba(60,40,20,.12)'; c.lineWidth = 1;
  for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x + w * i / 6, y + 14); c.lineTo(x + w * i / 6, y + h - 16); c.stroke(); }
  c.fillStyle = darken(base, 0.3); c.fillRect(x - 8, y, w + 16, 12); c.fillRect(x - 8, y + h - 14, w + 16, 14);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 8, y, w + 16, 3);
  vgrad(c, x, y + 12, w, 60, [[0, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);
}
function chair(c, x, y, s, col) {
  const g = c.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0); g.addColorStop(0, darken(col, 0.3)); g.addColorStop(0.5, lighten(col, 0.1)); g.addColorStop(1, darken(col, 0.32));
  c.fillStyle = g; rr(c, x - s * 0.5, y - s * 1.35, s, s * 1.4, s * 0.28); c.fill();
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x - s * 0.34, y - s * 1.28, s * 0.14, s * 1.1);
}
const SKINS = ['#f3c9a3', '#e2a877', '#c99870', '#f6cfa8', '#b9825a', '#d9a06b'];
const HAIRS = ['#2a2320', '#8a8f9a', '#c9a26a', '#dfe3ea', '#5a3d2b', '#1f1a1a', '#3b2a1e'];
const SUITS = ['#1d2233', '#2b2f3f', '#3a3346', '#22303a', '#42464f', '#2a2436', '#33302c'];
// seated audience member: (x, y) is the neck base; s is the scale
function person(c, x, y, s, rn, o = {}) {
  const skin = o.skin || SKINS[(rn() * SKINS.length) | 0], hairC = o.hair || HAIRS[(rn() * HAIRS.length) | 0], suit = o.suit || SUITS[(rn() * SUITS.length) | 0];
  const style = o.style || (rn() < 0.16 ? 'long' : rn() < 0.3 ? 'bald' : rn() < 0.12 ? 'kippah' : 'short');
  if (style === 'long') { c.fillStyle = darken(hairC, 0.15); c.beginPath(); c.ellipse(x, y - 8 * s, 8.6 * s, 13 * s, 0, 0, TAU); c.fill(); }
  c.beginPath(); c.moveTo(x - 15 * s, y + 34 * s); c.quadraticCurveTo(x - 17 * s, y + 4 * s, x - 6 * s, y); c.lineTo(x + 6 * s, y); c.quadraticCurveTo(x + 17 * s, y + 4 * s, x + 15 * s, y + 34 * s); c.closePath();
  const tg = c.createLinearGradient(x - 15 * s, 0, x + 15 * s, 0); tg.addColorStop(0, darken(suit, 0.25)); tg.addColorStop(0.5, lighten(suit, 0.06)); tg.addColorStop(1, darken(suit, 0.3));
  c.fillStyle = tg; c.fill();
  c.fillStyle = 'rgba(236,240,248,.88)'; c.beginPath(); c.moveTo(x - 3.4 * s, y); c.lineTo(x + 3.4 * s, y); c.lineTo(x, y + 10 * s); c.closePath(); c.fill();
  c.fillStyle = darken(skin, 0.14); c.fillRect(x - 3 * s, y - 6 * s, 6 * s, 7 * s);
  const hg = c.createRadialGradient(x - 2 * s, y - 16 * s, 1, x, y - 13 * s, 10 * s); hg.addColorStop(0, lighten(skin, 0.14)); hg.addColorStop(1, darken(skin, 0.14));
  c.fillStyle = hg; c.beginPath(); c.ellipse(x, y - 13 * s, 6.8 * s, 8.4 * s, 0, 0, TAU); c.fill();
  if (style !== 'bald') {
    c.fillStyle = hairC; c.beginPath(); c.ellipse(x, y - 16.6 * s, 7.2 * s, 6.2 * s, 0, Math.PI * 0.98, TAU * 1.02); c.fill();
    c.fillRect(x - 7.1 * s, y - 17 * s, 2 * s, 6 * s); c.fillRect(x + 5.1 * s, y - 17 * s, 2 * s, 5 * s);
  } else { c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(x - 1.5 * s, y - 19.5 * s, 3 * s, 1.5 * s, 0, 0, TAU); c.fill(); }
  if (style === 'kippah') { c.fillStyle = pick(['#15141d', '#2b3a8f', '#f2f2f2', '#7a3a2b']); c.beginPath(); c.ellipse(x - 1 * s, y - 20 * s, 4.4 * s, 2.4 * s, 0, 0, TAU); c.fill(); }
}
function flag(c, x, y, w, h) {   // national flag on a pole (x, y = top-left of the cloth)
  c.fillStyle = '#ecebe6'; c.fillRect(x, y, w, h);
  c.fillStyle = '#1d4ea8'; c.fillRect(x, y + h * 0.1, w, h * 0.13); c.fillRect(x, y + h * 0.77, w, h * 0.13);
  const cx = x + w / 2, cy = y + h / 2, r = h * 0.19;
  c.strokeStyle = '#1d4ea8'; c.lineWidth = Math.max(1.5, h * 0.035); c.lineJoin = 'miter';
  for (const rot of [0, Math.PI]) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = rot - Math.PI / 2 + i * TAU / 3; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.stroke(); }
  const fg = c.createLinearGradient(x, 0, x + w, 0); fg.addColorStop(0, 'rgba(0,0,0,.22)'); fg.addColorStop(0.3, 'rgba(255,255,255,.08)'); fg.addColorStop(0.6, 'rgba(0,0,0,.14)'); fg.addColorStop(1, 'rgba(255,255,255,.06)');
  c.fillStyle = fg; c.fillRect(x, y, w, h);
}
function menorah(c, x, y, s, col) {
  c.strokeStyle = col; c.lineWidth = 5 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 90 * s); c.stroke();
  for (let i = 1; i <= 3; i++) {
    c.beginPath(); c.moveTo(x, y - 8 * s);
    c.bezierCurveTo(x - 14 * s * i, y - 8 * s, x - 22 * s * i, y - 30 * s, x - 22 * s * i, y - 78 * s + (3 - i) * 4 * s); c.stroke();
    c.beginPath(); c.moveTo(x, y - 8 * s);
    c.bezierCurveTo(x + 14 * s * i, y - 8 * s, x + 22 * s * i, y - 30 * s, x + 22 * s * i, y - 78 * s + (3 - i) * 4 * s); c.stroke();
  }
  c.fillStyle = col;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(x + i * 22 * s, y - (i === 0 ? 92 : 80) * s, 5 * s, 0, TAU); c.fill(); }
  c.fillRect(x - 26 * s, y, 52 * s, 6 * s);
}
function books(c, x, y, w, h, rn) {   // a row of books on a shelf (y = shelf top surface)
  const cols = ['#8a2f2f', '#2d5a9a', '#c9a24a', '#2f7a4a', '#5a3a8a', '#d8cfb8', '#6b3f1e', '#2a2a3a'];
  let cx = x;
  while (cx < x + w - 8) {
    const bw = 6 + rn() * 8, bh = h * (0.62 + rn() * 0.36), col = cols[(rn() * cols.length) | 0];
    const g = c.createLinearGradient(cx, 0, cx + bw, 0); g.addColorStop(0, lighten(col, 0.12)); g.addColorStop(0.5, col); g.addColorStop(1, darken(col, 0.3));
    c.fillStyle = g; c.fillRect(cx, y - bh, bw, bh);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(cx + 1, y - bh + 4, bw - 2, 1.4);
    cx += bw + 0.6;
  }
}

const STAGES = [
  // ------------------------------------------------------------------ 1. Plenum
  {
    id: 'plenum', name: 'מליאת הכנסת', sub: 'הבית של כולם (ושל הצעקות)', music: 'battle', refl: 0.05,
    layers: [
      { f: 0.15, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#1c162e'], [0.15, '#382e4c'], [0.34, '#8c7b68'], [0.66, '#a48d6d'], [1, '#6a5640']]);
        c.fillStyle = 'rgba(0,0,0,.32)'; for (let x = 0; x < w; x += 132) c.fillRect(x, 0, 10, 72);
        for (let i = 0; i < 14; i++) { const x = 40 + i * (w - 80) / 13; radial(c, x, 44, 46, '#ffe8b0', 0.5); c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(x, 44, 5, 0, TAU); c.fill(); }
        const n = 7;
        for (let i = 0; i < n; i++) {
          const x = 70 + i * (w - 140) / (n - 1);
          if (i === 3) {   // the wall emblem takes the middle bay
            c.fillStyle = 'rgba(28,18,34,.55)'; rr(c, x - 60, 86, 120, 176, 8); c.fill();
            const eg = c.createLinearGradient(0, 92, 0, 258); eg.addColorStop(0, '#b39a72'); eg.addColorStop(1, '#8f7854');
            c.fillStyle = eg; rr(c, x - 54, 92, 108, 164, 6); c.fill();
            radial(c, x, 176, 90, '#ffe2a0', 0.4);
            c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.shadowOffsetY = 3; menorah(c, x, 238, 1.05, '#e8c15a'); c.restore();
            continue;
          }
          c.fillStyle = 'rgba(28,18,34,.6)'; archPath(c, x, 262, 47, 190); c.fill();
          const g = c.createLinearGradient(0, 76, 0, 258); g.addColorStop(0, '#fff6d8'); g.addColorStop(0.55, '#f0d494'); g.addColorStop(1, '#d9b56e');
          c.fillStyle = g; archPath(c, x, 258, 39, 178); c.fill();
          c.strokeStyle = '#4b3a2e'; c.lineWidth = 4; archPath(c, x, 258, 39, 178); c.stroke();
          c.lineWidth = 3; c.beginPath(); c.moveTo(x, 84); c.lineTo(x, 258); c.moveTo(x - 39, 170); c.lineTo(x + 39, 170); c.stroke();
          shaft(c, x + 18, 170, 60, 170, 320, '#ffe6a8', 0.11);
        }
        grain(c, w, h, 0.08);
      } },
      { f: 0.55, blur: 0.9, draw(c, w, h) {
        const rn = srand(23), cx = w / 2;
        vgrad(c, 0, 142, w, 330, [[0, '#71502e'], [0.5, '#583a22'], [1, '#3a2515']]);
        for (let x = 0; x < w; x += 64) { c.fillStyle = 'rgba(0,0,0,.24)'; c.fillRect(x, 142, 3, 330); c.fillStyle = 'rgba(255,215,160,.07)'; c.fillRect(x + 3, 142, 5, 330); }
        for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(30,15,5,${0.05 + rn() * 0.08})`; c.fillRect(rn() * w, 150 + rn() * 320, 30 + rn() * 90, 1); }
        c.fillStyle = '#2b1a0e'; c.fillRect(0, 136, w, 10); c.fillStyle = 'rgba(255,220,170,.2)'; c.fillRect(0, 146, w, 2);
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          const s = 0.78 + r * 0.11, y = 236 + r * 44, cnt = 13 + r * 2, span = w - 90 - (rows - 1 - r) * 34;
          for (let i = 0; i < cnt; i++) {
            const x = cx + (i / (cnt - 1) - 0.5) * span;
            if (Math.abs(x - cx) < 84 && r >= 2) continue;
            chair(c, x, y + 36 * s, 34 * s, r % 2 ? '#22406f' : '#2a4b82');
            if (rn() < 0.8) person(c, x, y + 4 * s, s, rn);
          }
          const dy = y + 24 * s;
          hgrad(c, 20, dy, w - 40, 14 * s, [[0, '#4a2f19'], [0.5, '#6b4526'], [1, '#4a2f19']]);
          c.fillStyle = 'rgba(255,225,170,.28)'; c.fillRect(20, dy, w - 40, 2);
          vgrad(c, 20, dy + 14 * s, w - 40, 10 * s, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]);
        }
        // speaker's rostrum + flags
        for (const fx of [cx - 176, cx + 176]) {
          c.fillStyle = '#6b6b6b'; c.fillRect(fx - 2, 236, 4, 190);
          flag(c, fx + (fx < cx ? 2 : -74), 240, 72, 52);
        }
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, 428, 92, 10, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(cx - 70, 428); c.lineTo(cx - 62, 338); c.lineTo(cx + 62, 338); c.lineTo(cx + 70, 428); c.closePath();
        const pg = c.createLinearGradient(cx - 70, 0, cx + 70, 0); pg.addColorStop(0, '#5a3a20'); pg.addColorStop(0.5, '#8b5e32'); pg.addColorStop(1, '#4e3119'); c.fillStyle = pg; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#a3763f'; rr(c, cx - 76, 328, 152, 16, 5); c.fill(); c.fillStyle = 'rgba(255,230,180,.35)'; c.fillRect(cx - 74, 329, 148, 2);
        menorah(c, cx, 412, 0.5, '#f0d06a');
        c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 22, 330); c.quadraticCurveTo(cx + 26, 300, cx + 8, 298); c.stroke();
        c.fillStyle = '#1b1b1b'; c.beginPath(); c.ellipse(cx + 6, 297, 6, 4, 0, 0, TAU); c.fill();
        grain(c, w, h, 0.06);
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#22386a'], [0.35, '#16274d'], [1, '#0a1530']]);
        c.fillStyle = '#c9a24a'; c.fillRect(0, GROUND - 8, w, 4); c.fillStyle = '#6f5622'; c.fillRect(0, GROUND - 4, w, 2);
        c.strokeStyle = 'rgba(210,175,90,.14)'; c.lineWidth = 2;
        for (let x = -300; x < w + 300; x += 70) { c.beginPath(); c.moveTo(x, GROUND - 2); c.lineTo(x + (x - w / 2) * 0.55, h); c.stroke(); }
        for (let y = GROUND + 14; y < h; y += 26) { c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(0, y, w, 1.5); }
        radial(c, w / 2, GROUND + 30, 420, '#9fc0ff', 0.14);
        pillar(c, 30, 104, 74, GROUND - 104, '#d9cbb0'); pillar(c, w - 104, 104, 74, GROUND - 104, '#d9cbb0');
        vgrad(c, 0, 0, w, 60, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
        grain(c, w, h, 0.05);
      } },
    ],
    dyn(ctx, t, cx) {
      // dust motes drifting through the window light (far layer)
      for (let i = 0; i < 22; i++) {
        const seed = i * 41.7, x = cx - 460 + ((seed * 9.1 + t * 0.12) % 920), y = 90 + ((seed * 5.3 + Math.sin(t * 0.012 + i) * 24 + t * 0.06) % 300);
        ctx.fillStyle = `rgba(255,240,200,${0.1 + 0.1 * Math.sin(t * 0.04 + i)})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
      }
    },
  },
  // ------------------------------------------------------------------ 2. News studio
  {
    id: 'studio', name: 'אולפן חדשות', sub: 'שידור חי. מכות חיות.', music: 'battle', refl: 0.2,
    layers: [
      { f: 0.2, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#060612'], [0.6, '#12103a'], [1, '#221a55']]);
        for (let i = 0; i < 9; i++) {
          const x = 30 + i * (w - 60) / 9, pw = (w - 60) / 9 - 8;
          c.fillStyle = '#0c0b28'; rr(c, x, 60, pw, 240, 10); c.fill();
          const sg = c.createLinearGradient(x, 60, x + pw, 300); sg.addColorStop(0, 'rgba(90,120,255,.16)'); sg.addColorStop(1, 'rgba(120,60,200,.08)');
          c.fillStyle = sg; rr(c, x, 60, pw, 240, 10); c.fill();
          c.fillStyle = 'rgba(160,190,255,.045)'; for (let yy = 66; yy < 296; yy += 4) c.fillRect(x + 4, yy, pw - 8, 1);
          c.strokeStyle = 'rgba(120,180,255,.4)'; c.lineWidth = 2; rr(c, x, 60, pw, 240, 10); c.stroke();
        }
        radial(c, w / 2, 190, 480, '#7a5cff', 0.34);
        c.fillStyle = '#0a0a1c'; c.fillRect(0, 0, w, 36);
        for (let i = 0; i < 12; i++) { const x = 60 + i * (w - 120) / 11; radial(c, x, 30, 60, '#bcd6ff', 0.4); c.fillStyle = '#eaf3ff'; c.fillRect(x - 14, 26, 28, 6); }
        grain(c, w, h, 0.07);
      } },
      { f: 0.6, draw(c, w, h) {
        for (let i = 0; i < 6; i++) {
          const x = 130 + i * (w - 260) / 5;
          radial(c, x, 122, 110, '#9fd2ff', 0.34);
          c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 6; c.beginPath(); c.arc(x, 122, 42, 0, TAU); c.stroke();
          c.strokeStyle = 'rgba(160,210,255,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(x, 122, 47, 0, TAU); c.stroke();
          c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 164); c.lineTo(x, 250); c.stroke();
        }
        // anchor desk
        const dx = w / 2 - 280;
        c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(w / 2, 448, 300, 12, 0, 0, TAU); c.fill();
        vgrad(c, dx, 332, 560, 110, [[0, '#f6f8ff'], [0.5, '#c9d1e8'], [1, '#8e99b8']]);
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(dx, 332, 560, 3);
        const lg = c.createLinearGradient(dx, 0, dx + 560, 0); lg.addColorStop(0, '#2f6fe4'); lg.addColorStop(0.5, '#7a5cff'); lg.addColorStop(1, '#e2323f');
        c.fillStyle = lg; c.fillRect(dx, 396, 560, 12); radial(c, w / 2, 402, 300, '#7a8cff', 0.18);
        for (const mx of [dx + 110, dx + 450]) { c.fillStyle = '#10131f'; rr(c, mx - 40, 296, 80, 38, 4); c.fill(); vgrad(c, mx - 36, 300, 72, 30, [[0, '#4fa0ff'], [1, '#1b3f8a']]); c.fillStyle = '#10131f'; c.fillRect(mx - 3, 334, 6, 4); }
        // cameras
        for (const x of [90, w - 90]) {
          c.strokeStyle = '#0d0f18'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 356); c.lineTo(x - 30, 452); c.moveTo(x, 356); c.lineTo(x + 30, 452); c.moveTo(x, 356); c.lineTo(x, 452); c.stroke();
          const cg = c.createLinearGradient(0, 300, 0, 360); cg.addColorStop(0, '#3a3f52'); cg.addColorStop(1, '#171a26');
          c.fillStyle = cg; rr(c, x - 40, 300, 80, 56, 8); c.fill(); c.strokeStyle = '#0a0b12'; c.lineWidth = 2.5; c.stroke();
          const sgn = x < w / 2 ? 1 : -1;
          c.fillStyle = '#0a0d18'; c.beginPath(); c.arc(x + sgn * 32, 328, 15, 0, TAU); c.fill();
          const lgr = c.createRadialGradient(x + sgn * 30, 325, 1, x + sgn * 32, 328, 14); lgr.addColorStop(0, '#bfe6ff'); lgr.addColorStop(0.4, '#3f7fb8'); lgr.addColorStop(1, '#10213a');
          c.fillStyle = lgr; c.beginPath(); c.arc(x + sgn * 32, 328, 11, 0, TAU); c.fill();
          c.fillStyle = '#ff2a3a'; c.beginPath(); c.arc(x - sgn * 26, 308, 3, 0, TAU); c.fill(); radial(c, x - sgn * 26, 308, 14, '#ff2a3a', 0.6);
        }
        grain(c, w, h, 0.05);
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#34407a'], [0.25, '#171d44'], [1, '#080a1c']]);
        c.fillStyle = 'rgba(130,190,255,.7)'; c.fillRect(0, GROUND - 8, w, 3);
        for (let x = -200; x < w + 200; x += 96) { c.strokeStyle = 'rgba(150,190,255,.07)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, GROUND - 4); c.lineTo(x + (x - w / 2) * 0.6, h); c.stroke(); }
        for (let i = 0; i < 6; i++) radial(c, 160 + i * (w - 320) / 5, GROUND + 40, 200, '#8f86ff', 0.16);
        vgrad(c, 0, 0, w, 50, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]);
      } },
    ],
    dyn(ctx, t, cx) {
      // animated LED equaliser bars + ticker on the big wall (layer f = 0.2)
      const x0 = Stages.lx(0.2, cx), lw = W + (STAGE_W - W) * 0.2;
      const pw = (lw - 60) / 9;
      for (let i = 0; i < 9; i++) {
        const x = x0 + 30 + i * pw + (pw - 8 - 72) / 2;
        for (let k = 0; k < 8; k++) {
          const hgt = 22 + 40 * (0.5 + 0.5 * Math.sin(t * 0.07 + i * 0.9 + k * 0.55));
          ctx.fillStyle = `hsl(${(i * 32 + k * 8 + t * 0.7) % 360},80%,60%)`;
          ctx.fillRect(x + k * 9, 286 - hgt, 6, hgt);
        }
      }
      const txt = '   מבזק: דיון סוער בכנסת   •   הקהל דורש קרב חוזר   •   הרייטינג בשמיים   •   מומחים: זה לא יגמר טוב   •   ';
      ctx.save();
      ctx.fillStyle = '#c92a37'; ctx.fillRect(x0 + 30, 300, lw - 60, 26);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0 + 30, 300, lw - 60, 4);
      ctx.beginPath(); ctx.rect(x0 + 30, 300, lw - 60, 26); ctx.clip();
      if (!Stages.tickW) { ctx.font = `800 17px ${FONT.ui}`; Stages.tickW = ctx.measureText(txt).width; }
      const tw = Stages.tickW, off = (t * 1.6) % tw;
      for (let k = -1; k < Math.ceil((lw - 60) / tw) + 1; k++) T(ctx, txt, x0 + 30 + off + k * tw, 313, { size: 17, fill: '#fff', align: 'left', weight: 800 });
      ctx.restore();
    },
  },
  // ------------------------------------------------------------------ 3. Cafeteria
  {
    id: 'cafe', name: 'קפיטריית הכנסת', sub: 'קפה, בורקס, ומכות', music: 'battle', refl: 0.04,
    layers: [
      { f: 0.2, draw(c, w, h) {
        const rn = srand(5);
        vgrad(c, 0, 0, w, h, [[0, '#f3d6a8'], [0.55, '#e9c08a'], [1, '#c99a68']]);
        for (let i = 0; i < 5; i++) {
          const x = 100 + i * (w - 200) / 4;
          const g = c.createLinearGradient(0, 60, 0, 300); g.addColorStop(0, '#bfe6ff'); g.addColorStop(0.55, '#e8f6ff'); g.addColorStop(1, '#a8d6a0');
          c.fillStyle = g; c.fillRect(x - 70, 60, 140, 240);
          c.save(); c.beginPath(); c.rect(x - 70, 60, 140, 240); c.clip();
          for (let k = 0; k < 26; k++) { c.fillStyle = `rgba(${40 + rn() * 50 | 0},${120 + rn() * 70 | 0},${50 + rn() * 40 | 0},${0.25 + rn() * 0.4})`; c.beginPath(); c.arc(x - 70 + rn() * 140, 150 + rn() * 150, 10 + rn() * 26, 0, TAU); c.fill(); }
          shaft(c, x - 20, 60, 70, 160, 260, '#fff2c0', 0.28);
          c.restore();
          c.strokeStyle = '#7a4f2c'; c.lineWidth = 9; c.strokeRect(x - 70, 60, 140, 240);
          c.lineWidth = 4; c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 300); c.moveTo(x - 70, 180); c.lineTo(x + 70, 180); c.stroke();
          c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x - 66, 64, 24, 232);
        }
        c.fillStyle = 'rgba(120,80,44,.5)'; c.fillRect(0, 300, w, 8);
        grain(c, w, h, 0.07);
      } },
      { f: 0.6, draw(c, w, h) {
        const cx = w / 2, rn = srand(9);
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(cx, 442, 350, 12, 0, 0, TAU); c.fill();
        vgrad(c, cx - 330, 300, 660, 140, [[0, '#8a5630'], [1, '#4c2e18']]);
        for (let x = cx - 322; x < cx + 322; x += 58) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, 308, 2, 128); }
        vgrad(c, cx - 336, 288, 672, 16, [[0, '#f2e4c4'], [1, '#c9b48a']]);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(cx - 336, 288, 672, 2);
        for (let i = 0; i < 9; i++) { const x = cx - 290 + i * 70; c.save(); c.translate(x, 286); c.scale(0.85, 0.85); ENT.burekas(c, {}); c.restore(); }
        // coffee machine
        const mx = cx + 200;
        c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, mx - 4, 192, 98, 112, 10); c.fill();
        const mg = c.createLinearGradient(mx, 0, mx + 90, 0); mg.addColorStop(0, '#9aa3b6'); mg.addColorStop(0.35, '#eef1f8'); mg.addColorStop(1, '#7b859c');
        c.fillStyle = mg; rr(c, mx, 190, 90, 110, 9); c.fill();
        c.fillStyle = '#22252f'; rr(c, mx + 8, 200, 74, 26, 4); c.fill(); c.fillStyle = '#e2323f'; c.beginPath(); c.arc(mx + 20, 213, 5, 0, TAU); c.fill();
        c.fillStyle = '#3a3f4c'; c.fillRect(mx + 16, 258, 58, 30); c.fillStyle = '#e8ebf2'; c.fillRect(mx + 36, 268, 18, 20);
        // pendant lamps
        for (let i = 0; i < 6; i++) {
          const x = 130 + i * (w - 260) / 5;
          radial(c, x, 138, 110, '#ffd98a', 0.5);
          c.strokeStyle = '#1d1208'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 96); c.stroke();
          const lg = c.createLinearGradient(x - 32, 0, x + 32, 0); lg.addColorStop(0, '#5a3c1c'); lg.addColorStop(0.5, '#c98a3a'); lg.addColorStop(1, '#4a2f14');
          c.fillStyle = lg; c.beginPath(); c.moveTo(x - 34, 122); c.quadraticCurveTo(x, 70, x + 34, 122); c.closePath(); c.fill();
          c.fillStyle = '#fff2c8'; c.beginPath(); c.ellipse(x, 122, 26, 5, 0, 0, TAU); c.fill();
        }
        grain(c, w, h, 0.05);
      } },
      { f: 1, draw(c, w, h) {
        // tiled floor in perspective
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#dcc79f'], [1, '#bfa47a']]);
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          const y0 = GROUND - 8 + r * r * 3.2 + r * 8, y1 = GROUND - 8 + (r + 1) * (r + 1) * 3.2 + (r + 1) * 8, tw = 60 + r * 26;
          for (let x = -tw * 2; x < w + tw * 2; x += tw) {
            if ((Math.floor(x / tw) + r) % 2) { c.fillStyle = 'rgba(120,70,30,.42)'; c.fillRect(x, y0, tw, y1 - y0); }
          }
          c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, y0, w, 1.5);
        }
        vgrad(c, 0, GROUND - 8, w, 30, [[0, 'rgba(0,0,0,.28)'], [1, 'rgba(0,0,0,0)']]);
        c.fillStyle = 'rgba(30,18,8,.85)'; c.fillRect(0, GROUND - 10, w, 3);
        radial(c, w / 2, GROUND + 40, 380, '#fff0c8', 0.22);
        for (const x of [120, w - 120]) {
          c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, 456, 100, 14, 0, 0, TAU); c.fill();
          c.fillStyle = '#2b1a0e'; c.fillRect(x - 6, 402, 12, 52); c.beginPath(); c.ellipse(x, 456, 34, 7, 0, 0, TAU); c.fill();
          const tg = c.createLinearGradient(0, 380, 0, 410); tg.addColorStop(0, '#fbf6ea'); tg.addColorStop(1, '#d8cdb4');
          c.fillStyle = tg; c.beginPath(); c.ellipse(x, 398, 72, 22, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 2; c.stroke();
          chair(c, x - 96, 448, 26, '#a83a2c'); chair(c, x + 96, 448, 26, '#a83a2c');
          c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + 20, 390, 13, 4.4, 0, 0, TAU); c.fill(); c.fillStyle = '#5a3418'; c.beginPath(); c.ellipse(x + 20, 388, 8, 2.6, 0, 0, TAU); c.fill();
        }
        grain(c, w, h, 0.05);
      } },
    ],
    dyn(ctx, t, cx) {
      // steam over the coffee machine (mid layer, f = 0.6)
      const x0 = Stages.lx(0.6, cx), lw = W + (STAGE_W - W) * 0.6;
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.02 + i * 0.25) % 1);
        ctx.fillStyle = `rgba(255,255,255,${0.42 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x0 + lw / 2 + 245 + Math.sin(t * 0.05 + i) * 8, 186 - k * 60, 8 + k * 10, 0, TAU); ctx.fill();
      }
    },
  },
  // ------------------------------------------------------------------ 4. Election night
  {
    id: 'election', name: 'ליל הבחירות', sub: 'הקולות נספרים. המכות גם.', music: 'battle', refl: 0.14,
    layers: [
      { f: 0.15, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#0a0624'], [0.55, '#2a1258'], [1, '#5a2a7a']]);
        radial(c, w / 2, 230, 520, '#7a4cff', 0.3);
        // giant results screen
        c.fillStyle = '#05061a'; rr(c, w / 2 - 336, 98, 672, 248, 14); c.fill();
        vgrad(c, w / 2 - 322, 112, 644, 220, [[0, '#0d1c52'], [1, '#080f2c']]);
        c.fillStyle = 'rgba(150,200,255,.05)'; for (let yy = 114; yy < 330; yy += 4) c.fillRect(w / 2 - 320, yy, 640, 1);
        c.strokeStyle = 'rgba(120,200,255,.7)'; c.lineWidth = 3; c.strokeRect(w / 2 - 322, 112, 644, 220);
        T(c, 'תוצאות הבחירות', w / 2, 168, { size: 24, fill: '#fff', font: 'disp' });
        radial(c, w / 2, 222, 380, '#5aa0ff', 0.14);
        grain(c, w, h, 0.07);
      } },
      { f: 0.55, blur: 1.2, draw(c, w, h) {
        const rn = srand(31);
        // stage truss with lamps
        c.fillStyle = '#262338'; c.fillRect(0, 18, w, 16); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(0, 18, w, 2);
        for (let i = 0; i < 10; i++) { const x = 60 + i * (w - 120) / 9; radial(c, x, 46, 86, '#ffe9a8', 0.5); c.fillStyle = '#fff3c8'; c.beginPath(); c.arc(x, 44, 8, 0, TAU); c.fill(); }
        // crowd: back-lit silhouettes, some with raised arms, flags and balloons
        for (let i = 0; i < 46; i++) {
          const x = 10 + i * (w - 20) / 45, y = 402 + (i % 3) * 9, k = 0.9 + (i % 4) * 0.06;
          c.fillStyle = i % 2 ? '#08051a' : '#0d0824';
          c.beginPath(); c.arc(x, y - 30 * k, 15 * k, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 24 * k, y + 50); c.quadraticCurveTo(x - 24 * k, y - 12 * k, x, y - 14 * k); c.quadraticCurveTo(x + 24 * k, y - 12 * k, x + 24 * k, y + 50); c.fill();
          c.strokeStyle = 'rgba(160,170,255,.22)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 30 * k, 15 * k, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
          if (rn() < 0.32) { c.strokeStyle = c.fillStyle; c.lineWidth = 8 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 12 * k, y - 8 * k); c.lineTo(x + 20 * k, y - 52 * k); c.stroke(); }
          if (i % 5 === 0) {
            const col = ['#ff5a7a', '#ffd23d', '#5ad7ff', '#8bff7a', '#c07aff'][(i / 5 | 0) % 5];
            c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 10, y - 44); c.lineTo(x + 16, y - 118); c.stroke();
            const bg = c.createRadialGradient(x + 11, y - 136, 2, x + 14, y - 130, 24); bg.addColorStop(0, lighten(col, 0.5)); bg.addColorStop(1, darken(col, 0.15));
            c.fillStyle = bg; c.beginPath(); c.ellipse(x + 14, y - 130, 18, 22, 0, 0, TAU); c.fill();
          }
        }
        grain(c, w, h, 0.05);
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#2a1b62'], [0.3, '#150a36'], [1, '#08041c']]);
        const eg = c.createLinearGradient(0, 0, w, 0); eg.addColorStop(0, '#ff5a7a'); eg.addColorStop(0.33, '#ffd23d'); eg.addColorStop(0.66, '#5ad7ff'); eg.addColorStop(1, '#c07aff');
        c.fillStyle = eg; c.fillRect(0, GROUND - 8, w, 4);
        for (let i = 0; i < 8; i++) radial(c, 100 + i * (w - 200) / 7, GROUND + 34, 180, ['#ff5a7a', '#5ad7ff', '#ffd23d', '#c07aff'][i % 4], 0.14);
        for (let x = 0; x < w; x += 80) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x, GROUND - 4, 40, h); }
        vgrad(c, 0, 0, w, 40, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
      } },
    ],
    dyn(ctx, t, cx) {
      // animated bar chart on the results screen (layer f = 0.15)
      const x0 = Stages.lx(0.15, cx), lw = W + (STAGE_W - W) * 0.15, centre = x0 + lw / 2;
      const cols = ['#2f6fe4', '#19c6b7', '#f4c81d', '#e23b52', '#38b56a', '#8a4fe0', '#f28a1e', '#e05fb4'];
      cols.forEach((col, i) => {
        const hgt = 30 + 80 * (0.5 + 0.5 * Math.sin(t * 0.02 + i * 1.7)) * (0.6 + 0.4 * Math.sin(t * 0.005 + i));
        const g = ctx.createLinearGradient(0, 322 - hgt, 0, 322); g.addColorStop(0, col); g.addColorStop(1, darken(col, 0.4));
        ctx.fillStyle = g; ctx.fillRect(centre - 290 + i * 74, 322 - hgt, 50, hgt);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(centre - 290 + i * 74, 322 - hgt, 8, hgt);
      });
      // sweeping spotlights
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(t * 0.012 + i * 2) * 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx - 400 + i * 400, 30); ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(255,240,180,.26)'); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(90, 520); ctx.lineTo(-90, 520); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    },
    front(ctx, t, cx) {
      // falling confetti
      for (let i = 0; i < 36; i++) {
        const seed = i * 97.13;
        const x = cx - 500 + ((seed * 13.7 + t * (0.4 + (i % 5) * 0.12)) % 1000), y = ((seed * 7.3 + t * (1.2 + (i % 4) * 0.5)) % 560) - 20;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.05 + i);
        ctx.fillStyle = ['#ff5a7a', '#ffd23d', '#5ad7ff', '#8bff7a', '#c07aff'][i % 5]; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
      }
    },
  },
  // ------------------------------------------------------------------ 5. PM office
  {
    id: 'office', name: 'לשכת ראש הממשלה', sub: 'הכיסא הכי חם בארץ', music: 'battle', refl: 0.08,
    layers: [
      { f: 0.15, blur: 1.6, draw(c, w, h) {
        // a city at sunset seen through tall windows
        vgrad(c, 0, 0, w, h, [[0, '#6a5a9a'], [0.28, '#e88a6a'], [0.55, '#ffc98a'], [0.8, '#ffe7c0'], [1, '#c98a5a']]);
        radial(c, w * 0.7, 250, 380, '#fff2c8', 0.85);
        const rn = srand(77);
        for (let layer = 0; layer < 3; layer++) {
          const a = 0.35 + layer * 0.22, base = 340 - layer * 6;
          c.fillStyle = `rgba(${90 - layer * 12},${50 - layer * 8},${86 - layer * 10},${a})`;
          for (let x = -10; x < w + 10; x += 22 + rn() * 20) { const bh = 30 + rn() * (80 - layer * 12) + layer * 14; c.fillRect(x, base - bh, 20 + rn() * 26, bh + 60); }
        }
        c.fillStyle = 'rgba(255,214,150,.5)';
        for (let i = 0; i < 180; i++) { const x = rn() * w, y = 250 + rn() * 100; c.fillRect(x, y, 2, 3); }
        grain(c, w, h, 0.06);
      } },
      { f: 0.55, draw(c, w, h) {
        const cx = w / 2, rn = srand(41);
        vgrad(c, 0, 0, w, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
        // window frames and dark wood walls
        const wood = c.createLinearGradient(0, 0, 0, 470); wood.addColorStop(0, '#5a361c'); wood.addColorStop(1, '#3a2110');
        c.fillStyle = wood; c.fillRect(0, 0, 160, h); c.fillRect(w - 160, 0, 160, h); c.fillRect(0, 0, w, 52); c.fillRect(0, 384, w, 90);
        for (let i = 0; i < 4; i++) { const x = 250 + i * (w - 500) / 3; c.fillStyle = wood; c.fillRect(x - 9, 0, 18, 400); c.fillStyle = 'rgba(255,220,170,.14)'; c.fillRect(x - 9, 0, 3, 400); }
        c.fillStyle = 'rgba(255,220,170,.16)'; c.fillRect(0, 52, w, 2); c.fillRect(0, 384, w, 2);
        for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(20,8,2,${0.06 + rn() * 0.08})`; c.fillRect(rn() * w, rn() * 470, 16 + rn() * 60, 1); }
        // bookshelves
        for (const sx of [12, w - 148]) {
          c.fillStyle = '#1d0f06'; c.fillRect(sx, 76, 136, 306);
          for (let r = 0; r < 5; r++) {
            const y = 92 + r * 58 + 50;
            books(c, sx + 6, y, 124, 46, rn);
            c.fillStyle = '#7a4a26'; c.fillRect(sx + 4, y, 128, 6); c.fillStyle = 'rgba(255,225,170,.25)'; c.fillRect(sx + 4, y, 128, 1.5);
          }
          vgrad(c, sx, 76, 136, 306, [[0, 'rgba(0,0,0,.35)'], [0.2, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.3)']]);
        }
        // flags behind the desk
        for (const [fx, dir] of [[cx - 210, 1], [cx + 210, -1]]) {
          c.fillStyle = '#c9a24a'; c.fillRect(fx - 2, 210, 4, 190); c.beginPath(); c.arc(fx, 208, 6, 0, TAU); c.fill();
          flag(c, fx + (dir > 0 ? 3 : -85), 216, 82, 60);
        }
        // desk
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(cx, 448, 280, 12, 0, 0, TAU); c.fill();
        c.fillStyle = '#1f1008'; rr(c, cx - 252, 348, 504, 98, 8); c.fill();
        vgrad(c, cx - 246, 354, 492, 88, [[0, '#7c4a28'], [1, '#452612']]);
        for (let x = cx - 240; x < cx + 246; x += 42) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, 358, 2, 80); }
        vgrad(c, cx - 254, 338, 508, 14, [[0, '#d4a55a'], [1, '#a37838']]); c.fillStyle = 'rgba(255,240,200,.5)'; c.fillRect(cx - 254, 338, 508, 2);
        // desk lamp + laptop
        c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 190, 338); c.lineTo(cx - 176, 300); c.lineTo(cx - 156, 296); c.stroke();
        c.fillStyle = '#2f6a4a'; c.beginPath(); c.moveTo(cx - 168, 292); c.lineTo(cx - 140, 292); c.lineTo(cx - 150, 306); c.lineTo(cx - 162, 306); c.closePath(); c.fill();
        radial(c, cx - 152, 312, 60, '#ffe6a0', 0.5);
        c.fillStyle = '#c8ccd6'; c.beginPath(); c.moveTo(cx + 80, 338); c.lineTo(cx + 150, 338); c.lineTo(cx + 142, 304); c.lineTo(cx + 88, 304); c.closePath(); c.fill();
        c.fillStyle = '#0d1a33'; c.fillRect(cx + 92, 308, 46, 26);
        // chair
        const chg = c.createLinearGradient(cx + 140, 0, cx + 210, 0); chg.addColorStop(0, '#5a1524'); chg.addColorStop(0.5, '#9a2a40'); chg.addColorStop(1, '#4a101c');
        c.fillStyle = chg; rr(c, cx + 150, 270, 64, 96, 24); c.fill(); c.strokeStyle = '#2a0a12'; c.lineWidth = 2; c.stroke();
        // chandelier
        c.strokeStyle = '#d4a94a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, 56); c.stroke();
        c.beginPath(); c.arc(cx, 66, 42, 0.05, Math.PI - 0.05); c.stroke();
        for (let i = -3; i <= 3; i++) { const yy = 66 + Math.sqrt(Math.max(0, 1764 - i * i * 190)) * 0.92; radial(c, cx + i * 13.5, yy, 26, '#ffe6a0', 0.7); c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(cx + i * 13.5, yy, 3.6, 0, TAU); c.fill(); }
        radial(c, cx, 96, 170, '#ffe9a8', 0.4);
        grain(c, w, h, 0.05);
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#851c30'], [0.4, '#5c1222'], [1, '#2c0810']]);
        c.fillStyle = '#d4a94a'; c.fillRect(0, GROUND - 8, w, 4); c.fillStyle = '#6f5220'; c.fillRect(0, GROUND - 4, w, 2);
        c.strokeStyle = 'rgba(226,184,74,.32)'; c.lineWidth = 2.5;
        for (let x = -100; x < w + 100; x += 92) { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x + 46, GROUND + 40); c.lineTo(x, GROUND + 80); c.lineTo(x - 46, GROUND + 40); c.closePath(); c.stroke(); }
        radial(c, w / 2, GROUND + 40, 420, '#ffd58a', 0.16);
        vgrad(c, 0, 0, w, 40, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
        grain(c, w, h, 0.06);
      } },
    ],
    dyn(ctx, t, cx) {
      for (let i = 0; i < 18; i++) {
        const seed = i * 41.7;
        const x = cx - 480 + ((seed * 9.1 + t * 0.25) % 960), y = 60 + ((seed * 5.3 + Math.sin(t * 0.01 + i) * 30) % 380);
        ctx.fillStyle = `rgba(255,240,200,${0.14 + 0.14 * Math.sin(t * 0.05 + i)})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
      }
    },
  },
];

const Stages = {
  lx(f, cx) { return -(W / 2) * (1 - f) + cx * (1 - f); },
  res: 1.25, cache: new Map(), vig: null,
  order: [],
  setRes(r) { r = clamp(Math.round(r * 4) / 4, 1, 1.5); if (r !== this.res) { this.res = r; this.cache.clear(); this.order = []; this.vig = null; } },
  layerCanvas(stage, idx) {
    const key = stage.id + ':' + idx;
    let cv = this.cache.get(key);
    if (cv) return cv;
    // keep the bitmaps of at most two stages in memory (phones)
    if (!this.order.includes(stage.id)) {
      this.order.push(stage.id);
      while (this.order.length > 2) { const old = this.order.shift(); for (const k of Array.from(this.cache.keys())) if (k.startsWith(old + ':')) this.cache.delete(k); }
    }
    const L = stage.layers[idx];
    const w = Math.ceil(W + (STAGE_W - W) * L.f), h = H;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(w * this.res); cv.height = Math.ceil(h * this.res);
    const c = cv.getContext('2d');
    c.scale(this.res, this.res);
    c.lineJoin = 'round';
    L.draw(c, w, h);
    // depth of field: soften the far layers once, at cache time
    if (L.blur && 'filter' in c) {
      const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
      const tc = t.getContext('2d'); tc.filter = `blur(${(L.blur * this.res).toFixed(2)}px)`; tc.drawImage(cv, 0, 0);
      cv = t;
    }
    this.cache.set(key, cv);
    return cv;
  },
  draw(ctx, stage, cx, t, part) {
    if (part === 'back') {
      stage.layers.forEach((L, i) => {
        const cv = this.layerCanvas(stage, i);
        const x0 = -(W / 2) * (1 - L.f) + cx * (1 - L.f);
        ctx.drawImage(cv, x0, 0, cv.width / this.res, cv.height / this.res);
      });
      if (stage.dyn) stage.dyn(ctx, t, cx);
    } else if (stage.front) stage.front(ctx, t, cx);
  },
  vignette(ctx) {
    if (!this.vig) {
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 135;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(120, 68, 34, 120, 68, 150);
      g.addColorStop(0, 'rgba(8,4,24,0)'); g.addColorStop(0.7, 'rgba(8,4,24,.28)'); g.addColorStop(1, 'rgba(8,4,24,.68)');
      c.fillStyle = g; c.fillRect(0, 0, 240, 135);
      this.vig = cv;
    }
    ctx.drawImage(this.vig, 0, 0, W, H);
  },
  prewarm(stage) { stage.layers.forEach((_, i) => this.layerCanvas(stage, i)); },
};

// ===== Stages: parallax backdrops painted procedurally, cached to bitmaps =====
// Each layer has a parallax factor f (0 = fixed to the camera, 1 = moves with the world) and a draw function that
// paints into a bitmap of size (W + (STAGE_W - W) * f) x H in layer-local coordinates.

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
function pillar(c, x, y, w, h, base, hi = '#ffffff') {
  hgrad(c, x, y, w, h, [[0, darken(base, 0.25)], [0.35, lighten(base, 0.1)], [0.5, lighten(base, 0.25)], [1, darken(base, 0.3)]]);
  c.fillStyle = darken(base, 0.35); c.fillRect(x - 6, y, w + 12, 10); c.fillRect(x - 6, y + h - 12, w + 12, 12);
}
function seat(c, x, y, s, col) {
  c.fillStyle = OUT; rr(c, x - s * 0.62, y - s * 1.2, s * 1.24, s * 1.32, s * 0.3); c.fill();
  c.fillStyle = col; rr(c, x - s * 0.5, y - s * 1.1, s * 1.0, s * 1.1, s * 0.25); c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x - s * 0.4, y - s * 1.0, s * 0.2, s * 0.9);
}
function headDot(c, x, y, r, skin, hair) {
  c.fillStyle = OUT; c.beginPath(); c.arc(x, y, r + 1.5, 0, TAU); c.fill();
  c.fillStyle = skin; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = hair; c.beginPath(); c.arc(x, y - r * 0.25, r, Math.PI, TAU); c.fill();
}
const SKINS = ['#f3c9a3', '#e2a877', '#c99870', '#f6cfa8', '#b9825a'];
const HAIRS = ['#2a2320', '#8a8f9a', '#c9a26a', '#dfe3ea', '#5a3d2b', '#1f1a1a'];
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
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(x + i * 22 * s, y - (i === 0 ? 92 : 80 - (3 - Math.abs(i)) * 0) * s + (Math.abs(i) < 3 ? 0 : 0), 5 * s, 0, TAU); c.fill(); }
  c.fillRect(x - 26 * s, y, 52 * s, 6 * s);
}

const STAGES = [
  // ------------------------------------------------------------------ 1. Plenum
  {
    id: 'plenum', name: 'מליאת הכנסת', sub: 'הבית של כולם (ושל הצעקות)', music: 'battle',
    layers: [
      { f: 0.15, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#2b2148'], [0.5, '#4a3a70'], [1, '#6b5a8f']]);
        // big arched windows with light
        for (let i = 0; i < 7; i++) {
          const x = 70 + i * (w - 140) / 6;
          c.fillStyle = '#e8d9b0'; c.beginPath(); c.moveTo(x - 34, 250); c.lineTo(x - 34, 110); c.arc(x, 110, 34, Math.PI, 0); c.lineTo(x + 34, 250); c.closePath(); c.fill();
          vgrad(c, x - 34, 80, 68, 170, [[0, 'rgba(255,240,190,.9)'], [1, 'rgba(255,200,120,.35)']]);
          c.strokeStyle = '#3a2c5e'; c.lineWidth = 6; c.stroke();
          c.beginPath(); c.moveTo(x, 76); c.lineTo(x, 250); c.moveTo(x - 34, 160); c.lineTo(x + 34, 160); c.stroke();
        }
        menorah(c, w / 2, 250, 1.6, '#e2b84a');
      } },
      { f: 0.55, draw(c, w, h) {
        // wood panelled wall
        vgrad(c, 0, 150, w, 320, [[0, '#8a5a34'], [1, '#5b3820']]);
        for (let x = 0; x < w; x += 70) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x, 150, 3, 320); c.fillStyle = 'rgba(255,220,170,.07)'; c.fillRect(x + 3, 150, 6, 320); }
        c.fillStyle = '#3e2614'; c.fillRect(0, 148, w, 10);
        // tiered seating (semicircle rows)
        const cx = w / 2;
        for (let row = 0; row < 5; row++) {
          const y = 250 + row * 34, rx = 560 + row * 90, cnt = 14 + row * 3;
          c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(cx - rx - 50, y + 4, rx * 2 + 100, 8);
          for (let i = 0; i < cnt; i++) {
            const a = Math.PI * (0.06 + 0.88 * i / (cnt - 1));
            const sx = cx + Math.cos(a) * -rx, sy = y + Math.sin(a) * 26 - 26 + 26;
            if (sx < 20 || sx > w - 20) continue;
            seat(c, sx, sy, 15, row % 2 ? '#2c5db5' : '#3a70cc');
            if (Math.random() < 0.7) headDot(c, sx, sy - 24, 7.5, pick(SKINS), pick(HAIRS));
          }
        }
        // speaker's podium
        c.fillStyle = OUT; rr(c, cx - 62, 330, 124, 96, 10); c.fill();
        vgrad(c, cx - 58, 334, 116, 88, [[0, '#c9a25a'], [1, '#8f6a2e']]);
        menorah(c, cx, 410, 0.55, '#fff2c0');
      } },
      { f: 1, draw(c, w, h) {
        // floor: dark blue carpet with gold trim
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#1c2f66'], [1, '#0e1a3d']]);
        c.fillStyle = '#e2b84a'; c.fillRect(0, GROUND - 8, w, 5);
        c.fillStyle = 'rgba(255,255,255,.06)';
        for (let x = -200; x < w + 200; x += 60) { c.beginPath(); c.moveTo(x, GROUND - 3); c.lineTo(x + (x - w / 2) * 0.5, h); c.lineTo(x + 8 + (x - w / 2) * 0.5, h); c.lineTo(x + 8, GROUND - 3); c.fill(); }
        // pillars framing the arena
        pillar(c, 30, 120, 70, GROUND - 120, '#d8c7a4'); pillar(c, w - 100, 120, 70, GROUND - 120, '#d8c7a4');
        vgrad(c, 0, 0, w, 60, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
      } },
    ],
  },
  // ------------------------------------------------------------------ 2. News studio
  {
    id: 'studio', name: 'אולפן חדשות', sub: 'שידור חי. מכות חיות.', music: 'battle',
    layers: [
      { f: 0.2, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#0d0b2a'], [0.6, '#231a5c'], [1, '#3b1d6b']]);
        // LED wall panels
        for (let i = 0; i < 9; i++) {
          const x = 30 + i * (w - 60) / 9;
          c.fillStyle = '#12103a'; rr(c, x, 60, (w - 60) / 9 - 8, 240, 10); c.fill();
          c.strokeStyle = 'rgba(120,180,255,.35)'; c.lineWidth = 2; c.stroke();
        }
        radial(c, w / 2, 180, 460, '#7a5cff', 0.35);
      } },
      { f: 0.6, draw(c, w, h) {
        // ring lights + cameras + desk
        for (let i = 0; i < 6; i++) {
          const x = 130 + i * (w - 260) / 5;
          c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 6; c.beginPath(); c.arc(x, 120, 42, 0, TAU); c.stroke();
          radial(c, x, 120, 90, '#9fd2ff', 0.35);
        }
        // anchor desk
        c.fillStyle = OUT; rr(c, w / 2 - 280, 330, 560, 110, 14); c.fill();
        vgrad(c, w / 2 - 274, 336, 548, 98, [[0, '#f0f3fb'], [1, '#aeb8d4']]);
        c.fillStyle = '#e2323f'; c.fillRect(w / 2 - 274, 392, 548, 14);
        // cameras
        for (const x of [90, w - 90]) {
          c.fillStyle = OUT; c.fillRect(x - 6, 350, 12, 100);
          c.fillStyle = '#2a2d3a'; rr(c, x - 40, 300, 80, 56, 8); c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
          c.fillStyle = '#7ad7ff'; c.beginPath(); c.arc(x + (x < w / 2 ? 30 : -30), 328, 14, 0, TAU); c.fill();
        }
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#2a2f5e'], [0.35, '#161a3a'], [1, '#0a0d24']]);
        c.fillStyle = 'rgba(120,180,255,.5)'; c.fillRect(0, GROUND - 8, w, 3);
        for (let x = 0; x < w; x += 120) { c.fillStyle = 'rgba(160,200,255,.07)'; c.fillRect(x, GROUND, 60, h); }
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
          ctx.fillStyle = `hsl(${(i * 32 + k * 8 + t * 0.7) % 360},85%,62%)`;
          ctx.fillRect(x + k * 9, 286 - hgt, 6, hgt);
        }
      }
      const txt = '   מבזק: דיון סוער בכנסת   •   הקהל דורש קרב חוזר   •   הרייטינג בשמיים   •   מומחים: זה לא יגמר טוב   •   ';
      ctx.save();
      ctx.fillStyle = '#e2323f'; ctx.fillRect(x0 + 30, 300, lw - 60, 26);
      ctx.beginPath(); ctx.rect(x0 + 30, 300, lw - 60, 26); ctx.clip();
      if (!Stages.tickW) { ctx.font = `800 17px ${FONT.ui}`; Stages.tickW = ctx.measureText(txt).width; }
      const tw = Stages.tickW, off = (t * 1.6) % tw;
      for (let k = -1; k < Math.ceil((lw - 60) / tw) + 1; k++) T(ctx, txt, x0 + 30 + off + k * tw, 313, { size: 17, fill: '#fff', align: 'left', weight: 800 });
      ctx.restore();
    },
  },
  // ------------------------------------------------------------------ 3. Cafeteria
  {
    id: 'cafe', name: 'קפיטריית הכנסת', sub: 'קפה, בורקס, ומכות', music: 'battle',
    layers: [
      { f: 0.2, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#ffdca8'], [0.6, '#ffc987'], [1, '#f2a866']]);
        // windows to the garden
        for (let i = 0; i < 5; i++) {
          const x = 90 + i * (w - 180) / 4;
          vgrad(c, x - 70, 60, 140, 240, [[0, '#a8e0ff'], [0.6, '#dff5ff'], [1, '#9fe0a0']]);
          c.fillStyle = 'rgba(70,160,80,.55)'; c.beginPath(); c.arc(x - 20, 300, 60, Math.PI, 0); c.arc(x + 30, 300, 50, Math.PI, 0); c.fill();
          c.strokeStyle = '#8a5a34'; c.lineWidth = 10; c.strokeRect(x - 70, 60, 140, 240);
          c.lineWidth = 5; c.beginPath(); c.moveTo(x, 60); c.lineTo(x, 300); c.moveTo(x - 70, 180); c.lineTo(x + 70, 180); c.stroke();
        }
      } },
      { f: 0.6, draw(c, w, h) {
        // service counter with pastries and coffee machine
        c.fillStyle = OUT; rr(c, w / 2 - 330, 300, 660, 140, 12); c.fill();
        vgrad(c, w / 2 - 324, 306, 648, 128, [[0, '#7a4a28'], [1, '#4a2b16']]);
        c.fillStyle = '#e8d2a8'; c.fillRect(w / 2 - 330, 292, 660, 16);
        for (let i = 0; i < 9; i++) {
          const x = w / 2 - 290 + i * 70;
          c.save(); c.translate(x, 288); c.scale(0.9, 0.9); ENT.burekas(c, {}); c.restore();
        }
        // coffee machine
        c.fillStyle = OUT; rr(c, w / 2 + 200, 190, 90, 110, 10); c.fill();
        vgrad(c, w / 2 + 206, 196, 78, 98, [[0, '#dfe4ee'], [1, '#8f98ad']]);
        c.fillStyle = '#e2323f'; c.beginPath(); c.arc(w / 2 + 226, 220, 8, 0, TAU); c.fill();
        c.fillStyle = '#3a3f4c'; c.fillRect(w / 2 + 214, 256, 62, 30);
        // hanging lamps
        for (let i = 0; i < 6; i++) {
          const x = 130 + i * (w - 260) / 5;
          c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 100); c.stroke();
          c.fillStyle = OUT; c.beginPath(); c.moveTo(x - 32, 120); c.quadraticCurveTo(x, 70, x + 32, 120); c.closePath(); c.fill();
          c.fillStyle = '#ffb648'; c.beginPath(); c.moveTo(x - 28, 117); c.quadraticCurveTo(x, 76, x + 28, 117); c.closePath(); c.fill();
          radial(c, x, 130, 90, '#ffd98a', 0.5);
        }
      } },
      { f: 1, draw(c, w, h) {
        // checkerboard floor
        c.fillStyle = '#e9d6b2'; c.fillRect(0, GROUND - 8, w, h);
        for (let r = 0; r < 4; r++) for (let x = -40; x < w + 40; x += 70) {
          if (((x / 70 | 0) + r) % 2) { c.fillStyle = '#b37b45'; c.fillRect(x + r * 12, GROUND - 8 + r * 22, 70, 22); }
        }
        c.fillStyle = OUT; c.fillRect(0, GROUND - 10, w, 4);
        // round tables with chairs at the edges
        for (const x of [120, w - 120]) {
          c.fillStyle = OUT; c.beginPath(); c.ellipse(x, 400, 76, 24, 0, 0, TAU); c.fill();
          c.fillStyle = '#f7f1e3'; c.beginPath(); c.ellipse(x, 396, 70, 20, 0, 0, TAU); c.fill();
          c.fillStyle = OUT; c.fillRect(x - 6, 400, 12, 52);
          seat(c, x - 92, 440, 22, '#d24a3a'); seat(c, x + 92, 440, 22, '#d24a3a');
          c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + 18, 388, 14, 5, 0, 0, TAU); c.fill();
        }
      } },
    ],
    dyn(ctx, t, cx) {
      // steam over the coffee machine (mid layer, f = 0.6)
      const x0 = Stages.lx(0.6, cx), lw = W + (STAGE_W - W) * 0.6;
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.02 + i * 0.25) % 1);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x0 + lw / 2 + 245 + Math.sin(t * 0.05 + i) * 8, 186 - k * 60, 8 + k * 10, 0, TAU); ctx.fill();
      }
    },
  },
  // ------------------------------------------------------------------ 4. Election night
  {
    id: 'election', name: 'ליל הבחירות', sub: 'הקולות נספרים. המכות גם.', music: 'battle',
    layers: [
      { f: 0.15, draw(c, w, h) {
        vgrad(c, 0, 0, w, h, [[0, '#120a3a'], [0.55, '#3b1b6e'], [1, '#7a2f8f']]);
        for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`; c.fillRect(Math.random() * w, Math.random() * 260, 2, 2); }
        // giant results screen
        c.fillStyle = OUT; rr(c, w / 2 - 330, 104, 660, 236, 16); c.fill();
        vgrad(c, w / 2 - 322, 112, 644, 220, [[0, '#0b1a4a'], [1, '#0a1030']]);
        c.strokeStyle = 'rgba(120,200,255,.6)'; c.lineWidth = 3; c.strokeRect(w / 2 - 322, 112, 644, 220);
        T(c, 'תוצאות הבחירות', w / 2, 168, { size: 24, fill: '#fff', font: 'disp' });
      } },
      { f: 0.55, draw(c, w, h) {
        // crowd silhouettes with balloons
        for (let i = 0; i < 40; i++) {
          const x = 10 + i * (w - 20) / 39, y = 400 + (i % 3) * 8;
          c.fillStyle = '#0b0620'; c.beginPath(); c.arc(x, y - 30, 16, 0, TAU); c.fill(); c.fillRect(x - 20, y - 16, 40, 60);
          if (i % 4 === 0) {
            const col = pick(['#ff5a7a', '#ffd23d', '#5ad7ff', '#8bff7a', '#c07aff']);
            c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 8, y - 44); c.lineTo(x + 14, y - 110); c.stroke();
            c.fillStyle = col; c.beginPath(); c.ellipse(x + 14, y - 130, 18, 22, 0, 0, TAU); c.fill();
          }
        }
        // stage truss with lamps
        c.fillStyle = '#2a2740'; c.fillRect(0, 20, w, 16);
        for (let i = 0; i < 10; i++) { const x = 60 + i * (w - 120) / 9; c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(x, 44, 9, 0, TAU); c.fill(); radial(c, x, 44, 60, '#ffe9a8', 0.5); }
      } },
      { f: 1, draw(c, w, h) {
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#2b1b5a'], [1, '#12082e']]);
        c.fillStyle = '#ffd23d'; c.fillRect(0, GROUND - 8, w, 4);
        for (let x = 0; x < w; x += 80) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, GROUND - 4, 40, h); }
        vgrad(c, 0, 0, w, 40, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
      } },
    ],
    dyn(ctx, t, cx) {
      // animated bar chart on the results screen (layer f = 0.15)
      const x0 = Stages.lx(0.15, cx), lw = W + (STAGE_W - W) * 0.15, centre = x0 + lw / 2;
      const cols = ['#2f6fe4', '#19c6b7', '#f4c81d', '#e23b52', '#38b56a', '#8a4fe0', '#f28a1e', '#e05fb4'];
      cols.forEach((col, i) => {
        const hgt = 30 + 80 * (0.5 + 0.5 * Math.sin(t * 0.02 + i * 1.7)) * (0.6 + 0.4 * Math.sin(t * 0.005 + i));
        ctx.fillStyle = col; ctx.fillRect(centre - 290 + i * 74, 322 - hgt, 50, hgt);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(centre - 290 + i * 74, 322 - hgt, 10, hgt);
      });
      // sweeping spotlights
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(t * 0.012 + i * 2) * 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx - 400 + i * 400, 30); ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(255,240,180,.3)'); g.addColorStop(1, 'rgba(255,240,180,0)');
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
    id: 'office', name: 'לשכת ראש הממשלה', sub: 'הכיסא הכי חם בארץ', music: 'battle',
    layers: [
      { f: 0.15, draw(c, w, h) {
        // Jerusalem-ish skyline at sunset, seen through big windows
        vgrad(c, 0, 0, w, h, [[0, '#ff9a5a'], [0.45, '#ffc98a'], [0.8, '#ffe7c0'], [1, '#c98a5a']]);
        c.fillStyle = 'rgba(80,40,70,.75)';
        c.beginPath(); c.moveTo(0, 330);
        for (let x = 0; x <= w; x += 40) c.lineTo(x, 300 - (Math.sin(x * 0.03) + Math.sin(x * 0.011 + 2)) * 14);
        c.lineTo(w, 400); c.lineTo(0, 400); c.closePath(); c.fill();
        // buildings + dome
        c.fillStyle = 'rgba(70,35,60,.9)';
        for (let i = 0; i < 26; i++) { const x = 20 + i * (w - 40) / 25; const bh = 40 + ((i * 53) % 70); c.fillRect(x, 330 - bh + 20, 28 + (i % 3) * 8, bh); }
        c.fillStyle = '#e8b64a'; c.beginPath(); c.arc(w / 2 + 40, 300, 42, Math.PI, 0); c.fill(); c.fillRect(w / 2 - 2, 250, 4, 16);
        c.fillStyle = 'rgba(70,35,60,.9)'; c.fillRect(w / 2 - 6, 300, 92, 60);
        radial(c, w * 0.7, 210, 320, '#fff2c8', 0.8);
      } },
      { f: 0.55, draw(c, w, h) {
        // window frames + wooden wall
        vgrad(c, 0, 0, w, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
        c.fillStyle = '#4a2c18';
        c.fillRect(0, 0, 150, h); c.fillRect(w - 150, 0, 150, h);
        for (let i = 0; i < 4; i++) { const x = 230 + i * (w - 460) / 3; c.fillStyle = '#4a2c18'; c.fillRect(x - 8, 0, 16, 400); }
        c.fillRect(0, 0, w, 50); c.fillRect(0, 380, w, 80);
        // bookshelves
        for (const sx of [10, w - 140]) {
          c.fillStyle = OUT; c.fillRect(sx, 80, 130, 300);
          for (let r = 0; r < 5; r++) {
            c.fillStyle = '#6b3f1e'; c.fillRect(sx + 4, 90 + r * 58 + 50, 122, 6);
            for (let b = 0; b < 9; b++) { c.fillStyle = pick(['#a83a3a', '#2f6fe4', '#e2b84a', '#38b56a', '#8a4fe0', '#e8dcc0']); c.fillRect(sx + 8 + b * 13, 96 + r * 58 + (b % 3) * 3, 10, 48 - (b % 3) * 3); }
          }
        }
        // desk
        c.fillStyle = OUT; rr(c, w / 2 - 250, 345, 500, 100, 8); c.fill();
        vgrad(c, w / 2 - 244, 351, 488, 88, [[0, '#7a4726'], [1, '#4a2a14']]);
        c.fillStyle = '#c99a4a'; c.fillRect(w / 2 - 250, 338, 500, 14);
        // chair
        seat(c, w / 2 + 170, 342, 46, '#7a1f2f');
        // chandelier
        c.strokeStyle = '#e2b84a'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, 60); c.stroke();
        c.beginPath(); c.arc(w / 2, 70, 40, 0, Math.PI); c.stroke();
        for (let i = -3; i <= 3; i++) { c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(w / 2 + i * 13, 70 + Math.sqrt(Math.max(0, 1600 - i * i * 169)) * 0.95, 4, 0, TAU); c.fill(); }
        radial(c, w / 2, 90, 130, '#ffe9a8', 0.45);
      } },
      { f: 1, draw(c, w, h) {
        // red carpet floor
        vgrad(c, 0, GROUND - 8, w, h - GROUND + 8, [[0, '#7d1a2c'], [1, '#3a0c16']]);
        c.fillStyle = '#e2b84a'; c.fillRect(0, GROUND - 8, w, 4);
        c.fillStyle = 'rgba(226,184,74,.35)';
        for (let x = -100; x < w + 100; x += 90) { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x + 45, GROUND + 40); c.lineTo(x, GROUND + 80); c.lineTo(x - 45, GROUND + 40); c.closePath(); c.fill(); }
        vgrad(c, 0, 0, w, 40, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
      } },
    ],
    dyn(ctx, t, cx) {
      for (let i = 0; i < 18; i++) {
        const seed = i * 41.7;
        const x = cx - 480 + ((seed * 9.1 + t * 0.25) % 960), y = 60 + ((seed * 5.3 + Math.sin(t * 0.01 + i) * 30) % 380);
        ctx.fillStyle = `rgba(255,240,200,${0.15 + 0.15 * Math.sin(t * 0.05 + i)})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
      }
    },
  },
];

const Stages = {
  lx(f, cx) { return -(W / 2) * (1 - f) + cx * (1 - f); },
  res: 1.25, cache: new Map(), vig: null,
  setRes(r) { r = clamp(Math.round(r * 4) / 4, 1, 2); if (r !== this.res) { this.res = r; this.cache.clear(); this.vig = null; } },
  layerCanvas(stage, idx) {
    const key = stage.id + ':' + idx;
    let cv = this.cache.get(key);
    if (cv) return cv;
    const L = stage.layers[idx];
    const w = Math.ceil(W + (STAGE_W - W) * L.f), h = H;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(w * this.res); cv.height = Math.ceil(h * this.res);
    const c = cv.getContext('2d');
    c.scale(this.res, this.res);
    c.lineJoin = 'round';
    L.draw(c, w, h);
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
      const g = c.createRadialGradient(120, 70, 40, 120, 70, 150);
      g.addColorStop(0, 'rgba(10,4,30,0)'); g.addColorStop(1, 'rgba(10,4,30,.55)');
      c.fillStyle = g; c.fillRect(0, 0, 240, 135);
      this.vig = cv;
    }
    ctx.drawImage(this.vig, 0, 0, W, H);
  },
  prewarm(stage) { stage.layers.forEach((_, i) => this.layerCanvas(stage, i)); },
};

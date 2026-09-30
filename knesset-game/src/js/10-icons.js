// ===== Vector icons: projectiles, traps, props, HUD glyphs =====
// Every drawer works in local space centred on (0,0), facing +x. `e` carries { t, sc, col, h, n }.
const OUT = '#1b1330';

let _shade = null;
function ol(ctx, fill, lw) {
  if (fill) {
    ctx.fillStyle = fill; ctx.fill();
    if (typeof fill === 'string') {   // soft form shading (light from the top left) so props sit next to the shaded fighters
      if (!_shade) { const g = ctx.createRadialGradient(-12, -16, 3, 0, 0, 74); g.addColorStop(0, 'rgba(255,255,255,.24)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(6,2,20,.26)'); _shade = g; }
      ctx.save(); ctx.clip(); ctx.fillStyle = _shade; ctx.fillRect(-140, -140, 280, 280); ctx.restore();
    }
  }
  ctx.lineWidth = (lw || 3) * 0.85;
  ctx.strokeStyle = OUT;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function glow(ctx, r, col, a = 0.6) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
}

const ENT = {
  bubble(ctx, e) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 32, 0, 0, TAU);
    ctx.moveTo(-26, 20); ctx.lineTo(-54, 42); ctx.lineTo(-10, 30);
    ol(ctx, e.col || '#ffffff');
    for (let i = 0; i < 3; i++) {
      const k = Math.sin(e.t * 0.16 - i * 0.9) * 0.5 + 0.5;
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(-16 + i * 16, -k * 6, 4.6, 0, TAU); ctx.fill();
    }
  },

  redline(ctx, e) {
    const h = e.h || 170, p = 0.65 + 0.35 * Math.sin(e.t * 0.22);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, 'rgba(255,40,70,0)');
    g.addColorStop(1, `rgba(255,60,80,${0.55 * p})`);
    ctx.fillStyle = g; ctx.fillRect(-16, -h, 32, h);
    ctx.restore();
    ctx.fillStyle = '#ff2a45'; ctx.fillRect(-3.5, -h, 7, h);
    ctx.fillStyle = '#ffd0d6'; ctx.fillRect(-1, -h, 2, h);
    ctx.fillStyle = 'rgba(255,40,70,.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 8, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const yy = -((e.t * 1.6 + i * 34) % h);
      ctx.fillStyle = 'rgba(255,220,225,.8)'; ctx.fillRect(-2 + Math.sin(yy * 0.1) * 5, yy, 4, 4);
    }
  },

  siren(ctx, e) {
    const ph = Math.floor(e.t / 4) % 2;
    for (let i = 0; i < 3; i++) {
      const r = 18 + i * 14;
      ctx.beginPath();
      ctx.arc(-24, 0, r, -0.9, 0.9);
      ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = (i + ph) % 2 ? '#ff3b4d' : '#3b8bff';
      ctx.stroke();
    }
  },

  scissors(ctx, e) {
    const open = 0.25 + Math.abs(Math.sin(e.t * 0.35)) * 0.4;
    ctx.rotate(e.t * 0.02);
    for (const sgnv of [-1, 1]) {
      ctx.save();
      ctx.rotate(open * sgnv);
      ctx.beginPath();
      ctx.moveTo(-4, 0); ctx.lineTo(34, -4 * sgnv - 2); ctx.lineTo(36, 1 * sgnv); ctx.lineTo(-2, 5 * sgnv);
      ol(ctx, '#dfe6f2', 2.5);
      ctx.beginPath(); ctx.arc(-16, 9 * sgnv, 9, 0, TAU); ol(ctx, '#e8483a', 3);
      ctx.beginPath(); ctx.arc(-16, 9 * sgnv, 4, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ol(ctx, '#555', 2);
  },

  coin(ctx, e) {
    const sq = Math.abs(Math.cos((e.t + (e.n || 0) * 7) * 0.15)) * 0.8 + 0.2;
    ctx.scale(sq, 1);
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ol(ctx, '#ffd23d');
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = '#c99700'; ctx.stroke();
    ctx.fillStyle = '#b07d00'; ctx.font = '900 17px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.direction = 'ltr'; ctx.fillText('₪', 0, 1);
  },

  bill(ctx, e) {
    ctx.rotate(Math.sin(e.t * 0.12 + (e.n || 0)) * 0.5);
    rr(ctx, -30, -16, 60, 32, 4); ol(ctx, '#7fd48b');
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ol(ctx, '#bdf0c4', 2.5);
    ctx.fillStyle = '#2e7d3e'; ctx.font = '900 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('₪', 0, 1);
    ctx.fillRect(-25, -11, 6, 3); ctx.fillRect(19, 8, 6, 3);
  },

  letter(ctx, e) {
    ctx.rotate(Math.sin(e.t * 0.2) * 0.15);
    rr(ctx, -28, -19, 56, 38, 4); ol(ctx, '#fff6dc');
    ctx.beginPath(); ctx.moveTo(-28, -19); ctx.lineTo(0, 4); ctx.lineTo(28, -19); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 4, 7, 0, TAU); ol(ctx, '#d93a3a', 2.5);
  },

  table(ctx, e) {
    const w = 200;
    // legs
    ctx.fillStyle = '#6b3f1e';
    for (const lx of [-w / 2 + 16, w / 2 - 30]) { ctx.fillRect(lx, 0, 14, 62); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(lx, 0, 14, 62); }
    rr(ctx, -w / 2, -26, w, 30, 6); ol(ctx, '#b06b32');
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-w / 2 + 8, -21, w - 16, 5);
    // papers on top
    ctx.save(); ctx.rotate(-0.1); rr(ctx, -50, -46, 44, 22, 3); ol(ctx, '#fff', 2.5); ctx.restore();
    ctx.beginPath(); ctx.arc(46, -34, 10, 0, TAU); ol(ctx, '#f2f2f2', 2.5);
  },

  ironball(ctx, e) {
    ctx.rotate(e.t * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU);
    const g = ctx.createRadialGradient(-9, -9, 3, 0, 0, 28);
    g.addColorStop(0, '#9aa3b2'); g.addColorStop(1, '#2b303b');
    ol(ctx, g);
    ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.ellipse(-9, -10, 8, 5, -0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 8); ctx.lineTo(20, -8); ctx.stroke();
  },

  roller(ctx, e) {
    const bob = Math.sin(e.t * 0.9) * 1.5;
    ctx.translate(0, bob);
    // rear wheel
    ctx.beginPath(); ctx.arc(-46, 24, 40, 0, TAU); ol(ctx, '#3d414d');
    ctx.beginPath(); ctx.arc(-46, 24, 16, 0, TAU); ol(ctx, '#f4b400', 2.5);
    // body + cabin
    rr(ctx, -70, -30, 120, 44, 10); ol(ctx, '#f4b400');
    rr(ctx, -62, -76, 58, 50, 8); ol(ctx, '#f4b400');
    rr(ctx, -54, -68, 42, 32, 5); ol(ctx, '#bfe6ff', 2.5);
    ctx.fillStyle = OUT; ctx.fillRect(-68, -84, 74, 9);
    // front drum
    const g = ctx.createLinearGradient(0, -20, 0, 70);
    g.addColorStop(0, '#dfe4ee'); g.addColorStop(0.5, '#9aa3b5'); g.addColorStop(1, '#5d6577');
    ctx.beginPath(); ctx.arc(66, 26, 44, 0, TAU); ol(ctx, g);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) { const a = e.t * 0.12 + k * 1.05; ctx.beginPath(); ctx.moveTo(66, 26); ctx.lineTo(66 + Math.cos(a) * 42, 26 + Math.sin(a) * 42); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(66, 26, 12, 0, TAU); ol(ctx, '#f4b400', 2.5);
    // exhaust puff
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-86, -70 - (e.t % 12), 7, 0, TAU); ctx.fill();
  },

  like(ctx, e) {
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ol(ctx, e.col || '#3b82f6');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-9, 2); ctx.lineTo(-4, 2); ctx.lineTo(0, -11); ctx.quadraticCurveTo(7, -10, 5, -1);
    ctx.lineTo(12, -1); ctx.quadraticCurveTo(14, 0, 13, 4); ctx.lineTo(11, 10); ctx.lineTo(-4, 10); ctx.lineTo(-9, 9); ctx.closePath();
    ctx.fill();
    ctx.fillRect(-13, 2, 4, 9);
  },

  share(ctx, e) {
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ol(ctx, e.col || '#1da1f2', 2.5);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-6, -2); ctx.lineTo(1, -2); ctx.lineTo(1, -7); ctx.lineTo(9, 0); ctx.lineTo(1, 7); ctx.lineTo(1, 2); ctx.closePath(); ctx.fill();
  },

  flash(ctx, e) {
    const k = Math.min(1, e.t / 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 90 * (0.6 + k), '#ffffff', 0.9);
    ctx.restore();
    star(ctx, 0, 0, 8, 46 * (0.5 + k), 10, e.t * 0.2); ctx.fillStyle = '#fff'; ctx.fill();
  },

  crate(ctx, e) {
    if (e.falling) {
      ctx.beginPath(); ctx.arc(0, -64, 34, Math.PI, 0); ctx.lineTo(0, -30); ctx.closePath(); ol(ctx, e.n % 2 ? '#ffffff' : '#5aa2ff');
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      for (const sx of [-24, 24]) { ctx.beginPath(); ctx.moveTo(sx, -64); ctx.lineTo(0, -8); ctx.stroke(); }
    }
    rr(ctx, -22, -22, 44, 44, 4); ol(ctx, '#c58b4a');
    ctx.strokeStyle = '#7a4d1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, -22); ctx.lineTo(22, 22); ctx.moveTo(22, -22); ctx.lineTo(-22, 22); ctx.stroke();
  },

  sign(ctx, e) {
    ctx.rotate(e.spin || 0);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-4, -8, 8, 70); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-4, -8, 8, 70);
    rr(ctx, -42, -50, 84, 50, 6); ol(ctx, '#fff7cc');
    ctx.fillStyle = e.col || '#d92b3a'; ctx.font = '900 40px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
    ctx.fillText('!', 0, -24);
    ctx.fillRect(-32, -46, 64, 4);
  },

  dove(ctx, e) {
    const fl = Math.sin(e.t * 0.5) * 0.9;
    ctx.save(); ctx.rotate(-fl * 0.15);
    // far wing
    ctx.save(); ctx.rotate(fl * 0.6); ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-30, -34 - fl * 10, -34, -8); ctx.closePath(); ol(ctx, '#dbe7f5', 2.5); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, TAU); ol(ctx, '#ffffff');
    ctx.beginPath(); ctx.arc(20, -8, 9, 0, TAU); ol(ctx, '#ffffff');
    ctx.beginPath(); ctx.moveTo(28, -9); ctx.lineTo(37, -6); ctx.lineTo(28, -4); ctx.closePath(); ol(ctx, '#ffb43c', 2);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(22, -10, 2, 0, TAU); ctx.fill();
    // tail
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-38, -4); ctx.lineTo(-36, 8); ctx.closePath(); ol(ctx, '#e8f0fa', 2.5);
    // near wing
    ctx.save(); ctx.rotate(-fl * 0.7); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-34, -40 - fl * 12, -40, -6); ctx.quadraticCurveTo(-20, -6, -8, 0); ol(ctx, '#ffffff', 2.5); ctx.restore();
    ctx.restore();
  },

  ballot(ctx, e) {
    ctx.rotate(e.t * 0.12);
    rr(ctx, -20, -26, 40, 52, 4); ol(ctx, '#ffffff');
    ctx.fillStyle = '#d0d6e2'; for (let i = 0; i < 3; i++) ctx.fillRect(-13, -17 + i * 11, 26, 3);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.strokeRect(-6, 10, 12, 10);
    ctx.strokeStyle = '#1d9b3d'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(0, 20); ctx.lineTo(9, 5); ctx.stroke();
  },

  scales(ctx, e) {
    const tilt = e.tilt || 0;
    ctx.fillStyle = '#c99a2e'; ctx.fillRect(-4, -10, 8, 60); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-4, -10, 8, 60);
    rr(ctx, -22, 46, 44, 10, 4); ol(ctx, '#c99a2e');
    ctx.save(); ctx.rotate(tilt);
    ctx.fillStyle = '#e6b83a'; ctx.fillRect(-56, -14, 112, 6); ctx.strokeRect(-56, -14, 112, 6);
    for (const sx of [-52, 52]) {
      ctx.save(); ctx.translate(sx, -11); ctx.rotate(-tilt);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, 32); ctx.moveTo(0, 0); ctx.lineTo(20, 32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, 32); ctx.quadraticCurveTo(0, 56, 26, 32); ctx.closePath(); ol(ctx, '#f6d466', 2.5);
      ctx.restore();
    }
    ctx.restore();
  },

  quip(ctx, e) {
    ctx.beginPath();
    ctx.moveTo(-26, -13); ctx.lineTo(16, -13); ctx.lineTo(34, 0); ctx.lineTo(16, 13); ctx.lineTo(-26, 13); ctx.quadraticCurveTo(-32, 0, -26, -13);
    ol(ctx, e.col || '#ffe15a');
    ctx.fillStyle = OUT; ctx.font = '900 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
    ctx.fillText(e.n ? '?!' : '!', -2, 1);
  },

  mic(ctx, e) {
    ctx.rotate(e.spin !== undefined ? e.spin : e.t * 0.25);
    ctx.fillStyle = '#555'; ctx.fillRect(-4, 0, 8, 38); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-4, 0, 8, 38);
    ctx.beginPath(); ctx.arc(0, -8, 15, 0, TAU); ol(ctx, '#c9ced8');
    ctx.strokeStyle = '#767c8b'; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i += 5) { ctx.beginPath(); ctx.moveTo(i, -20); ctx.lineTo(i, 4); ctx.stroke(); }
  },

  horn(ctx, e) {
    for (let i = 0; i < 3; i++) {
      const r = 20 + i * 15 + ((e.t * 1.5) % 15);
      ctx.beginPath(); ctx.arc(-30, 0, r, -0.95, 0.95);
      ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = i % 2 ? '#ffd24a' : '#fff3b8'; ctx.stroke();
    }
  },

  tram(ctx, e) {
    const w = 220;
    rr(ctx, -w / 2, -60, w, 92, 22); ol(ctx, '#f4f6fb');
    ctx.fillStyle = e.col || '#d92b3a'; ctx.fillRect(-w / 2 + 6, 0, w - 12, 12);
    ctx.fillStyle = '#7fbfff';
    for (let i = 0; i < 4; i++) { rr(ctx, -w / 2 + 16 + i * 46, -46, 38, 36, 6); ol(ctx, '#7fbfff', 2.5); }
    ctx.fillStyle = OUT; ctx.fillRect(-w / 2 + 10, 30, w - 20, 8);
    for (const wx of [-70, 70]) { ctx.beginPath(); ctx.arc(wx, 36, 12, 0, TAU); ol(ctx, '#3a3f4c'); }
    // pantograph
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -60); ctx.lineTo(0, -80); ctx.lineTo(20, -60); ctx.stroke();
    // headlight
    ctx.beginPath(); ctx.arc(w / 2 - 12, 8, 6, 0, TAU); ol(ctx, '#fff3a0', 2);
  },

  train(ctx, e) {
    const w = 200;
    rr(ctx, -w / 2, -56, w, 84, 12); ol(ctx, e.n === 0 ? '#e9b13a' : '#dfe4ee');
    ctx.fillStyle = '#2b6fd6'; ctx.fillRect(-w / 2 + 4, 6, w - 8, 12);
    for (let i = 0; i < 3; i++) { rr(ctx, -w / 2 + 14 + i * 60, -44, 46, 34, 6); ol(ctx, '#9ed0ff', 2.5); }
    for (const wx of [-64, -20, 24, 68]) { ctx.beginPath(); ctx.arc(wx, 32, 11, 0, TAU); ol(ctx, '#2e323d'); }
    if (e.n === 0) { rr(ctx, w / 2 - 34, -78, 26, 24, 5); ol(ctx, '#e9b13a'); ctx.beginPath(); ctx.arc(w / 2 - 6, 4, 7, 0, TAU); ol(ctx, '#fff3a0', 2); }
  },

  spot(ctx, e) {
    const h = e.h || 360, top = e.top || 60, bot = e.bot || 150;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, 'rgba(255,250,200,.65)'); g.addColorStop(1, 'rgba(255,240,150,.15)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-top / 2, -h); ctx.lineTo(top / 2, -h); ctx.lineTo(bot / 2, 0); ctx.lineTo(-bot / 2, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,245,180,.55)'; ctx.beginPath(); ctx.ellipse(0, 0, bot / 2, 12, 0, 0, TAU); ctx.fill();
  },

  beam(ctx, e) {
    const len = e.len || 600, hh = (e.h || 90) / 2 * (e.grow === undefined ? 1 : e.grow);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const c = e.col || '#7ad7ff';
    const g = ctx.createLinearGradient(0, -hh, 0, hh);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, 0.95)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, -hh, len, hh * 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(0, -hh * 0.25, len, hh * 0.5);
    glow(ctx, hh * 1.4, c, 0.8);
    ctx.restore();
  },

  nova(ctx, e) {
    const r = e.r || 50, c1 = e.col || '#5aa2ff', c2 = e.col2 || '#ffffff';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 18; ctx.strokeStyle = rgba(c1, 0.9); ctx.beginPath(); ctx.arc(0, 0, r, -1.15, 1.15); ctx.stroke();
    ctx.lineWidth = 8; ctx.strokeStyle = rgba(c2, 0.95); ctx.beginPath(); ctx.arc(0, 0, r - 6, -1.1, 1.1); ctx.stroke();
    ctx.restore();
  },

  shieldIcon(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(20, -24, 26, -22); ctx.quadraticCurveTo(26, 6, 0, 28); ctx.quadraticCurveTo(-26, 6, -26, -22); ctx.quadraticCurveTo(-20, -24, 0, -28); ctx.closePath();
    ol(ctx, '#c3ccd9');
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.quadraticCurveTo(-20, 6, -20, -17); ctx.closePath(); ctx.fillStyle = '#e9eef7'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(20, -18, 20, -17); ctx.quadraticCurveTo(20, 6, 0, 22); ctx.closePath(); ctx.fillStyle = '#7aa0e0'; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke();
  },

  gavel(ctx) {
    ctx.rotate(-0.5);
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(-4, -6, 6, 46); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-4, -6, 6, 46);
    rr(ctx, -20, -22, 38, 22, 5); ol(ctx, '#a8672b');
    ctx.fillStyle = '#e2b84a'; ctx.fillRect(-20, -14, 38, 5);
  },

  fist(ctx) {
    rr(ctx, -20, -18, 40, 34, 10); ol(ctx, '#ffcf9e');
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    for (const x of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.lineTo(x, -4); ctx.stroke(); }
    rr(ctx, -16, 14, 32, 12, 4); ol(ctx, '#e2584a');
  },

  bolt(ctx) {
    ctx.beginPath(); ctx.moveTo(6, -30); ctx.lineTo(-16, 4); ctx.lineTo(-2, 4); ctx.lineTo(-8, 30); ctx.lineTo(18, -8); ctx.lineTo(3, -8); ctx.closePath(); ol(ctx, '#ffe14a');
  },

  wind(ctx, e) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const [y, l] of [[-12, 28], [0, 36], [12, 24]]) { ctx.beginPath(); ctx.moveTo(-l, y); ctx.lineTo(l, y); ctx.stroke(); }
    ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 4.5;
    for (const [y, l] of [[-12, 28], [0, 36], [12, 24]]) { ctx.beginPath(); ctx.moveTo(-l, y); ctx.lineTo(l, y); ctx.stroke(); }
  },

  swap(ctx) {
    for (const s of [1, -1]) {
      ctx.save(); ctx.scale(s, 1); ctx.translate(0, s * -9);
      ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(8, -4); ctx.lineTo(8, -13); ctx.lineTo(26, 0); ctx.lineTo(8, 13); ctx.lineTo(8, 4); ctx.lineTo(-24, 4); ctx.closePath();
      ol(ctx, s > 0 ? '#a5d63c' : '#eaffb8', 2.5);
      ctx.restore();
    }
  },

  crowd(ctx) {
    for (const [x, y, c] of [[-16, 4, '#4a86d9'], [16, 4, '#e0584a'], [0, -6, '#52b46a']]) {
      ctx.beginPath(); ctx.arc(x, y - 10, 9, 0, TAU); ol(ctx, '#f6cfa8', 2.5);
      rr(ctx, x - 10, y, 20, 18, 6); ol(ctx, c, 2.5);
    }
  },

  hand(ctx) {
    rr(ctx, -12, -6, 26, 30, 8); ol(ctx, '#ffcf9e');
    for (let i = 0; i < 4; i++) { rr(ctx, -12 + i * 6.5, -30 + Math.abs(i - 1.5) * 3, 5.5, 26, 3); ol(ctx, '#ffcf9e', 2.2); }
    rr(ctx, -20, 2, 10, 14, 4); ol(ctx, '#ffcf9e', 2.2);
  },

  heart(ctx) {
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.bezierCurveTo(-34, -4, -18, -30, 0, -12); ctx.bezierCurveTo(18, -30, 34, -4, 0, 20); ctx.closePath(); ol(ctx, '#ff5a7a');
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-10, -10, 6, 4, -0.6, 0, TAU); ctx.fill();
  },

  star(ctx) {
    star(ctx, 0, 0, 5, 26, 11, -Math.PI / 2); ol(ctx, '#ffd23d');
  },

  burekas(ctx) {
    ctx.beginPath(); ctx.moveTo(-34, 18); ctx.quadraticCurveTo(-36, -22, 0, -26); ctx.quadraticCurveTo(38, -22, 34, 18); ctx.closePath();
    ol(ctx, '#e5a24a');
    ctx.strokeStyle = '#a9691d'; ctx.lineWidth = 3;
    for (let i = -22; i <= 22; i += 11) { ctx.beginPath(); ctx.moveTo(i, 16); ctx.quadraticCurveTo(i * 0.7, -6, i * 0.5, -22); ctx.stroke(); }
    ctx.fillStyle = '#fff3'; ctx.beginPath(); ctx.ellipse(-8, -14, 10, 4, -0.4, 0, TAU); ctx.fill();
  },

  shield(ctx, e) {
    const r = e.r || 70, p = 0.6 + 0.4 * Math.sin(e.t * 0.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, r * 1.2, e.col || '#ffd94a', 0.5 * p);
    ctx.lineWidth = 4; ctx.strokeStyle = rgba(e.col || '#ffd94a', 0.9); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  },
};

// Held props (drawn at the hand, pointing along +x). `a` is an extra rotation.
const PROP = {
  gavel(ctx) {
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(-4, -3, 40, 6); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.strokeRect(-4, -3, 40, 6);
    rr(ctx, 26, -13, 22, 26, 4); ol(ctx, '#a8672b', 2.5);
  },
  sign(ctx) {
    ctx.save(); ctx.rotate(-Math.PI / 2); ctx.translate(-30, -10); ENT.sign(ctx, { t: 0 }); ctx.restore();
  },
  briefcase(ctx) {
    rr(ctx, 6, -13, 40, 28, 5); ol(ctx, '#6b4a2b', 2.5);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, -13); ctx.lineTo(20, -19); ctx.lineTo(32, -19); ctx.lineTo(32, -13); ctx.stroke();
    ctx.fillStyle = '#e6b83a'; ctx.fillRect(24, -3, 4, 6);
  },
  mic(ctx) {
    ctx.fillStyle = '#444'; ctx.fillRect(-2, -3, 30, 6); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.strokeRect(-2, -3, 30, 6);
    ctx.beginPath(); ctx.arc(34, 0, 11, 0, TAU); ol(ctx, '#c9ced8', 2.5);
  },
  news(ctx) {
    ctx.save(); ctx.rotate(0.05);
    rr(ctx, 4, -9, 54, 18, 8); ol(ctx, '#f3ecd6', 2.5);
    ctx.fillStyle = '#777'; ctx.fillRect(12, -3, 34, 2); ctx.fillRect(12, 2, 24, 2);
    ctx.restore();
  },
  folder(ctx) {
    rr(ctx, 4, -14, 36, 28, 3); ol(ctx, '#e9c25a', 2.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(8, -11, 28, 6);
  },
  calc(ctx) {
    rr(ctx, 4, -16, 26, 34, 4); ol(ctx, '#3b4256', 2.5);
    ctx.fillStyle = '#9fe0b6'; ctx.fillRect(8, -12, 18, 7);
    ctx.fillStyle = '#dfe6f2'; for (let i = 0; i < 6; i++) ctx.fillRect(8 + (i % 3) * 7, -2 + Math.floor(i / 3) * 8, 5, 5);
  },
  pen(ctx) {
    ctx.fillStyle = '#2b5fd9'; ctx.fillRect(0, -2.5, 34, 5); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(0, -2.5, 34, 5);
    ctx.beginPath(); ctx.moveTo(34, -2.5); ctx.lineTo(44, 0); ctx.lineTo(34, 2.5); ctx.closePath(); ol(ctx, '#f2d59a', 2);
  },
  megaphone(ctx) {
    ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(26, -20); ctx.lineTo(26, 20); ctx.lineTo(2, 6); ctx.closePath(); ol(ctx, '#f0a020', 2.5);
    rr(ctx, -8, -8, 12, 16, 3); ol(ctx, '#444', 2.5);
  },
};

// Draw an entity/icon kind at a position (used by HUD and move list, and by the battle renderer).
function drawEnt(ctx, kind, x, y, e = {}) {
  const fn = ENT[kind];
  if (!fn) return;
  ctx.save();
  ctx.translate(x, y);
  if (e.dir < 0) ctx.scale(-1, 1);
  if (e.sc) ctx.scale(e.sc, e.sc);
  if (e.rot) ctx.rotate(e.rot);
  fn(ctx, e);
  ctx.restore();
}

function drawProp(ctx, kind, x, y, ang, sc = 1) {
  const fn = PROP[kind] || ENT[kind];
  if (!fn) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(sc, sc);
  fn(ctx, { t: 0 });
  ctx.restore();
}

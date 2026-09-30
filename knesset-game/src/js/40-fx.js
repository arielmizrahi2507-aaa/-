// ===== Visual effects: particles, hit bursts, floating text, screen shake =====
const COMIC = ['!בום', '!פאו', '!טראח', '!צלף', '!חבטה', '!פאף', '!ווםם', '!קראק'];

const Fx = {
  parts: [], texts: [], bursts: [], rings: [], lines: [],
  shakeAmt: 0, flashA: 0, flashCol: '#ffffff', punch: 0, calm: false,

  reset() {
    this.parts.length = 0; this.texts.length = 0; this.bursts.length = 0; this.rings.length = 0; this.lines.length = 0;
    this.shakeAmt = 0; this.flashA = 0; this.punch = 0;
  },

  add(p) {
    if (this.parts.length > 700) this.parts.shift();
    p.max = p.life;
    this.parts.push(p);
  },

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, this.calm ? a * 0.3 : a); },
  flash(col, a) { this.flashCol = col; this.flashA = Math.max(this.flashA, this.calm ? a * 0.35 : a); },

  sparks(x, y, n, col, spd = 7, life = 18) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), s = rnd(spd * 0.4, spd);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.18, drag: 0.94, life: life * rnd(0.6, 1.2), size: rnd(2, 4), color: col, shape: 'spark' });
    }
  },
  stars(x, y, n, col, spd = 5) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), s = rnd(spd * 0.3, spd);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 0.22, drag: 0.95, life: rnd(22, 40), size: rnd(5, 9), color: col, shape: 'star', rot: rnd(TAU), vr: rnd(-0.3, 0.3) });
    }
  },
  paper(x, y, n, dir = 1) {
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: dir * rnd(1, 7) + rnd(-2, 2), vy: rnd(-7, -1), g: 0.16, drag: 0.97, life: rnd(40, 75), size: rnd(6, 11), color: pick(['#ffffff', '#f4f1e6', '#dde6f5']), shape: 'paper', rot: rnd(TAU), vr: rnd(-0.3, 0.3) });
    }
  },
  dust(x, y, dir = 0, n = 6) {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + rnd(-10, 10), y: y - rnd(0, 4), vx: dir * rnd(0.5, 2.5) + rnd(-1, 1), vy: rnd(-1.4, -0.2), g: -0.01, drag: 0.94, life: rnd(16, 28), size: rnd(6, 12), color: '#d9d2e6', shape: 'smoke', size1: 2 });
    }
  },
  coins(x, y, n, dir = 1) {
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: dir * rnd(1, 6) + rnd(-2, 2), vy: rnd(-9, -3), g: 0.4, drag: 0.99, life: rnd(40, 70), size: rnd(7, 10), color: '#ffd23d', shape: 'coin', rot: rnd(TAU), vr: 0.3 });
    }
  },
  confetti(x, y, n, spread = 8) {
    const cols = ['#ff5a7a', '#ffd23d', '#5ad7ff', '#8bff7a', '#c07aff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: rnd(-spread, spread), vy: rnd(-12, -3), g: 0.24, drag: 0.98, life: rnd(60, 120), size: rnd(5, 9), color: pick(cols), shape: 'paper', rot: rnd(TAU), vr: rnd(-0.35, 0.35) });
    }
  },
  feathers(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: rnd(-3, 3), vy: rnd(-3, 1), g: 0.03, drag: 0.97, life: rnd(40, 80), size: rnd(6, 9), color: '#ffffff', shape: 'feather', rot: rnd(TAU), vr: rnd(-0.2, 0.2) });
    }
  },
  glowDots(x, y, n, col, spd = 4) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), s = rnd(0.5, spd);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: -0.03, drag: 0.96, life: rnd(20, 40), size: rnd(4, 9), color: col, shape: 'glow' });
    }
  },

  burst(x, y, o = {}) {
    this.bursts.push({ x, y, t: 0, max: o.life || 12, r: o.r || 50, col: o.col || '#fff', col2: o.col2 || '#ffe14a', rot: o.rot === undefined ? rnd(TAU) : o.rot, spikes: o.spikes || 9 });
  },
  ring(x, y, r0, r1, col, life = 16, lw = 6) {
    this.rings.push({ x, y, r0, r1, col, t: 0, max: life, lw });
  },
  text(x, y, str, o = {}) {
    this.texts.push({ x, y, str, t: 0, max: o.life || 46, vy: o.vy === undefined ? -1.1 : o.vy, size: o.size || 26, col: o.col || '#fff', stroke: o.stroke || '#0e0d11', rot: o.rot || 0, pop: o.pop === undefined ? 1 : o.pop, font: o.font || 'disp' });
  },
  comic(x, y, col) {
    this.text(x + rnd(-20, 20), y - 30, pick(COMIC), { size: rnd(26, 34), col: col || '#ffe14a', rot: rnd(-0.3, 0.3), life: 30, vy: -0.6 });
  },
  speedLines(x, y, dir, n = 6) {
    for (let i = 0; i < n; i++) this.lines.push({ x: x - dir * rnd(0, 60), y: y + rnd(-90, 30), len: rnd(50, 130), dir, t: 0, max: 10 });
  },

  update() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vx *= p.drag; p.vy = (p.vy + p.g) * p.drag;
      p.x += p.vx; p.y += p.vy;
      if (p.vr) p.rot += p.vr;
      if (p.shape === 'paper' || p.shape === 'feather') p.vx += Math.sin(p.life * 0.3) * 0.12;
      if (p.shape === 'coin' && p.y > GROUND && p.vy > 0) { p.y = GROUND; p.vy *= -0.5; }
      if (--p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.t++; t.y += t.vy; if (t.t >= t.max) this.texts.splice(i, 1); }
    for (let i = this.bursts.length - 1; i >= 0; i--) { const b = this.bursts[i]; if (++b.t >= b.max) this.bursts.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; if (++r.t >= r.max) this.rings.splice(i, 1); }
    for (let i = this.lines.length - 1; i >= 0; i--) { const l = this.lines[i]; if (++l.t >= l.max) this.lines.splice(i, 1); }
    this.shakeAmt *= 0.86; if (this.shakeAmt < 0.15) this.shakeAmt = 0;
    this.flashA *= 0.84; if (this.flashA < 0.01) this.flashA = 0;
    this.punch *= 0.85;
  },

  draw(ctx) {
    for (const r of this.rings) {
      const k = r.t / r.max;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = r.lw * (1 - k * 0.7);
      ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, Ease.outCubic(k)), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const l of this.lines) {
      const k = l.t / l.max;
      ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x - l.dir * l.len * (0.4 + k), l.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of this.bursts) {
      const k = b.t / b.max, r = b.r * (0.35 + Ease.outCubic(k) * 0.9);
      // impact flash: an additive bloom, thin cracks of light and a hot core (no cartoon starburst)
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, r * 1.35, b.col2, (1 - k) * 0.85);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(b.rot); ctx.globalAlpha = 1 - k * k;
      star(ctx, 0, 0, b.spikes, r * 0.95, r * 0.13); ctx.fillStyle = b.col; ctx.fill();
      star(ctx, 0, 0, b.spikes, r * 0.55, r * 0.2); ctx.fillStyle = b.col2; ctx.globalAlpha = (1 - k) * 0.8; ctx.fill();
      ctx.globalAlpha = (1 - k * k); ctx.beginPath(); ctx.arc(0, 0, r * 0.2 * (1 - k * 0.6), 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.shape === 'spark') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * k + 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
      } else if (p.shape === 'star') {
        star(ctx, p.x, p.y, 5, p.size * (0.4 + k * 0.6), p.size * 0.4 * (0.4 + k * 0.6), p.rot);
        ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
      } else if (p.shape === 'paper') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.8 + 0.2);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); ctx.restore();
      } else if (p.shape === 'coin') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.abs(Math.cos(p.rot)) * 0.8 + 0.2, 1);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#a87500'; ctx.stroke(); ctx.restore();
      } else if (p.shape === 'smoke') {
        const s = lerp(p.size, p.size * 2.4, 1 - k);
        ctx.globalAlpha = k * 0.55; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      } else if (p.shape === 'feather') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c9d4e6'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      } else if (p.shape === 'glow') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y); glow(ctx, p.size * 2.5 * k + 2, p.color, 0.9); ctx.restore();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const k = t.t / t.max;
      const sc = t.pop ? 1 + Math.max(0, 1 - t.t / 6) * 0.6 : 1;
      T(ctx, t.str, t.x, t.y, { size: t.size, fill: t.col, stroke: t.stroke, lw: t.size * 0.16, font: t.font, alpha: k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, rot: t.rot, scale: sc });
    }
  },

  drawScreen(ctx) {
    if (this.flashA > 0.01) {
      ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
  },
};

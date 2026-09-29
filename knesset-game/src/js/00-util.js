// ===== Core constants =====
const W = 960;            // logical canvas width
const H = 540;            // logical canvas height
const GROUND = 452;       // y of the floor line (feet)
const STAGE_W = 1600;     // world width
const WALL_L = 70;
const WALL_R = STAGE_W - 70;
const GRAV = 0.66;
const TAU = Math.PI * 2;

// ===== Math helpers =====
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const sgn = (v) => (v < 0 ? -1 : 1);
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic PRNG (battle logic + daily challenge + tests)
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Ease = {
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  smooth: (t) => t * t * (3 - 2 * t),
};

// ===== Colour helpers (hex only in, css strings out) =====
const _rgbCache = {};
function rgb(c) {
  let v = _rgbCache[c];
  if (v) return v;
  let h = c.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _rgbCache[c] = v;
  return v;
}
function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
function rgba(c, a) {
  const A = rgb(c);
  return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
}

// ===== Geometry =====
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ===== Text (Hebrew aware) =====
const HEB = /[֐-׿]/;
const FONT = {
  ui: '"Rubik","Heebo","Assistant","Segoe UI","Arial Hebrew",Arial,sans-serif',
  disp: '"Secular One","Rubik","Heebo","Arial Hebrew",Impact,Arial,sans-serif',
};

// Draws (optionally outlined) text. Hebrew strings use an RTL base direction so trailing "!" lands on the left.
function T(ctx, str, x, y, o = {}) {
  const size = o.size || 20;
  ctx.save();
  ctx.font = `${o.weight || 700} ${size}px ${FONT[o.font || 'ui']}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  ctx.direction = HEB.test(str) ? 'rtl' : 'ltr';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.scale) ctx.scale(o.scale, o.scaleY || o.scale);
  ctx.lineJoin = 'round';
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(str, 0, o.shadowY === undefined ? size * 0.08 : o.shadowY);
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw || Math.max(3, size * 0.16);
    ctx.strokeText(str, 0, 0);
  }
  ctx.fillStyle = o.fill || '#fff';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// ===== Path helpers =====
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, spikes, outer, innerR, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : innerR;
    const a = rot + (i * Math.PI) / spikes;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Thick outlined stroke helper: dark outline underneath, coloured stroke on top.
function outlinedLine(ctx, pts, color, width, outline = '#1b1330', ow = 3) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + ow * 2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// Two-bone IK. Returns the joint (elbow/knee) position; `bend` picks the side (1 or -1).
function ik(sx, sy, tx, ty, l1, l2, bend) {
  let dx = tx - sx, dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.5;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < 1) d = 1;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = sx + (dx * a) / d, my = sy + (dy * a) / d;
  return {
    jx: mx + (-dy / d) * h * bend,
    jy: my + (dx / d) * h * bend,
    ex: sx + dx, ey: sy + dy,
  };
}

// Simple event emitter-less global "hook" list for toasts etc. is defined later (UI).

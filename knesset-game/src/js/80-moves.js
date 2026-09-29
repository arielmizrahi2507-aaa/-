// ===== Move factories =====
// Normals are plain data; specials/supers are small scripts (`tick(f, t, B)` runs once per frame while the move is active).

function M(o) {
  const m = Object.assign({ kind: 'melee', height: 'mid', hitstun: 16, blockstun: 10, kx: 2.5, ky: 0, knockdown: false, rank: 1, cancel: true, air: false, crouch: false, chip: 0, armor: 0 }, o);
  m.frames = m.startup + m.active + m.recovery;
  return m;
}

const NORMAL_BASE = {
  L:  { name: 'ג׳אב', anim: 'jab', startup: 5, active: 3, recovery: 8, dmg: 4, hb: [24, -142, 68, 36], hitstun: 16, blockstun: 10, kx: 2.5, rank: 1 },
  H:  { name: 'בעיטה', anim: 'kick', startup: 11, active: 4, recovery: 16, dmg: 9, hb: [24, -118, 92, 40], hitstun: 25, blockstun: 15, kx: 7, rank: 2, lunge: { at: 4, len: 6, vx: 2.6 } },
  FH: { name: 'מכה מלמעלה', anim: 'slam', startup: 18, active: 4, recovery: 18, dmg: 10, hb: [24, -196, 80, 130], height: 'high', hitstun: 28, blockstun: 14, kx: 4, rank: 2 },
  DL: { name: 'מכה נמוכה', anim: 'lowkick', startup: 6, active: 3, recovery: 9, dmg: 3.5, hb: [24, -34, 88, 34], height: 'low', hitstun: 15, blockstun: 9, kx: 2, crouch: true, rank: 1 },
  DH: { name: 'אפרקאט', anim: 'uppercut', startup: 9, active: 4, recovery: 22, dmg: 9, hb: [16, -196, 62, 140], hitstun: 38, blockstun: 16, kx: 2.5, ky: -11, rank: 2, inv: [1, 7] },
  AL: { name: 'אגרוף אוויר', anim: 'airpunch', startup: 4, active: 9, recovery: 4, dmg: 5, hb: [10, -128, 70, 62], height: 'high', hitstun: 18, blockstun: 11, air: true, rank: 1 },
  AH: { name: 'בעיטת צניחה', anim: 'airkick', startup: 8, active: 9, recovery: 4, dmg: 8, hb: [6, -84, 82, 74], height: 'high', hitstun: 24, blockstun: 14, kx: 5, knockdown: true, air: true, rank: 2 },
};

// spec: { L: ['שם', 'anim', {overrides}], ... }  (any key may be omitted to keep the default)
function normals(spec = {}) {
  const out = {};
  for (const k in NORMAL_BASE) {
    const base = NORMAL_BASE[k];
    const s = spec[k];
    const o = Object.assign({}, base);
    if (s) {
      if (s[0]) o.name = s[0];
      if (s[1]) o.anim = s[1];
      if (s[2]) Object.assign(o, s[2]);
    }
    o.key = k;
    out[k] = M(o);
  }
  return out;
}

// ---- specials ----
function SP(o) {
  const m = Object.assign({ kind: 'special', rank: 3, cd: 180, anim: 'cast', frames: 34, icon: 'star', ai: { min: 0, max: 900, kind: 'zone' } }, o);
  m.release = o.release !== undefined ? o.release : Math.floor(m.frames * 0.4);
  return m;
}

// Fire one or more projectiles at `release`. shots: array | (f,B)=>array.  Entries may set `at` to fire on a later frame.
function spCast(o) {
  const shots = o.shots;
  const m = SP(Object.assign({ frames: 34, release: 14 }, o));
  const fire = (f, B, list) => {
    for (const s of list) B.proj(f, Object.assign({}, s));
    if (!f.mi.cast) { f.mi.cast = true; Snd.play(o.sfx || 'cast'); }
  };
  m.tick = function (f, t, B) {
    if (typeof shots === 'function') { if (t === m.release) fire(f, B, shots(f, B)); return; }
    for (const s of shots) if (t === (s.at !== undefined ? s.at : m.release)) fire(f, B, [s]);
  };
  return m;
}

// Forward rush with a hitbox. Ends early on contact.
function spDash(o) {
  const m = SP(Object.assign({ anim: 'dash', startup: 8, dashFrames: 16, recovery: 14, vx: 10, hb: [-10, -150, 110, 150], dmg: 10, hitstun: 26, blockstun: 14, kx: 8, knockdown: true, ai: { min: 120, max: 460, kind: 'gap' } }, o));
  m.frames = m.startup + m.dashFrames + m.recovery;
  m.active = m.dashFrames;
  m.tick = function (f, t, B) {
    if (t === 0) Snd.play('dash');
    if (t >= m.startup && t < m.startup + m.dashFrames) {
      if (f.mi.dashDone) { f.vx *= 0.7; return; }
      f.vx = f.face * m.vx; f.trailOn = true;
      if (t % 3 === 0) Fx.dust(f.x, GROUND, -f.face, 1);
      const r = f.strike(m.hb, m, 'dash');
      if (r !== 'miss') { f.mi.dashDone = true; f.vx *= 0.2; f.mt = Math.max(f.mt, m.startup + m.dashFrames - 4); if (m.onDashHit) m.onDashHit(f, B, r); }
    }
  };
  return m;
}

// Self buff. apply(f,B) does the work at `release`.
function spBuff(o) {
  const m = SP(Object.assign({ anim: 'buff', frames: 34, release: 12, ai: { min: 0, max: 1000, kind: 'buff' } }, o));
  m.tick = function (f, t, B) {
    if (t === m.release) {
      Snd.play('buff');
      Fx.ring(f.x, f.y - 90, 20, 120, rgba(m.glow || '#ffd94a', 0.9), 20, 6);
      Fx.glowDots(f.x, f.y - 90, 14, m.glow || '#ffd94a', 5);
      if (m.label) Fx.text(f.x, f.y - 215, m.label, { size: 24, col: m.glow || '#ffd94a', life: 50 });
      o.apply(f, B);
    }
  };
  return m;
}

// Standard super hit info helper
function superInfo(o) {
  return Object.assign({ dmg: 8, hitstun: 26, blockstun: 16, kx: 6, ky: 0, knockdown: false, height: 'mid', chip: 0.3, isSuper: true, hitstop: 8 }, o);
}

// Ground-bound entity helper positions
const groundY = (h) => GROUND - h / 2;

// Colour for generic minion suits
LOOKS.min1 = { skin: '#f0c7a6', hair: { style: 'crop', color: '#3a2c24' }, suit: '#3a3f55', shirt: '#fff', tie: '#e05a5a', h: 0.96, w: 0.96 };
LOOKS.min2 = { skin: '#d9a06b', hair: { style: 'part', color: '#1f1a1a' }, suit: '#4a3a5e', shirt: '#fff', tie: '#f0c040', h: 1.0, w: 1.0 };
LOOKS.min3 = { skin: '#f3c9a3', hair: { style: 'sides', color: '#aaa' }, suit: '#2d4a52', shirt: '#fff', tie: '#5ad7ff', h: 0.94, w: 1.04, glasses: { shape: 'round', color: '#222' } };
LOOKS.min4 = { skin: '#c99870', hair: { style: 'crop', color: '#2a2320' }, suit: '#553a3a', shirt: '#fff', tie: '#8bff7a', h: 1.02, w: 0.98, stache: '#2a2320' };
LOOKS.min5 = { skin: '#f2c6a0', hair: { style: 'wavy', color: '#8a5a3a' }, suit: '#2f5b4a', shirt: '#fff', tie: '#ff8ac0', h: 0.96, w: 0.92 };
LOOKS.crowd1 = { skin: '#f2c6a0', hair: { style: 'crop', color: '#5a3d2b' }, suit: '#4a86d9', shirt: '#4a86d9', open: true, h: 0.94, w: 0.96 };
LOOKS.crowd2 = { skin: '#c99870', hair: { style: 'part', color: '#1f1a1a' }, suit: '#e0584a', shirt: '#e0584a', open: true, h: 0.98, w: 1.0 };
LOOKS.crowd3 = { skin: '#e6b78f', hair: { style: 'wavy', color: '#c9a26a' }, suit: '#52b46a', shirt: '#52b46a', open: true, h: 0.92, w: 0.92 };
LOOKS.crowd4 = { skin: '#f6cfa8', hair: { style: 'sides', color: '#8a8f9a' }, suit: '#e6b83a', shirt: '#e6b83a', open: true, h: 0.96, w: 1.02 };
const MINIONS = ['min1', 'min2', 'min3', 'min4', 'min5'];
const CROWD = ['crowd1', 'crowd2', 'crowd3', 'crowd4'];

// A running minion (used by several supers)
function minion(B, owner, o) {
  const dir = owner.face;
  const e = B.ent(Object.assign({
    kind: 'mini', owner, dir, lookId: pick(MINIONS), w: 64, h: 160, sc: 0.7, dmg: 6, hitstun: 22, blockstun: 12, kx: 5, life: 150,
    isProj: true, clash: false, chip: 0.25, z: 1, hitstop: 5,
  }, o));
  e.x = o.x !== undefined ? o.x : owner.x - dir * 90;
  e.y = o.y !== undefined ? o.y : GROUND - 80 * (o.sc || 0.7);
  e.h = 170 * (o.sc || 0.7);
  e.y = GROUND - e.h / 2;
  e.vx = dir * (o.vx || 11);
  return e;
}

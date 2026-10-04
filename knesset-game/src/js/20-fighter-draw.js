// ===== Fighter poses =====
// `poseOf` turns a Fighter's state into joint targets for a small 2-bone IK skeleton (hips, torso lean, head, hands, feet).
// The drawing lives in 21-fighter-render.js.

const SKIN = { fair: '#f6cfa8', tan: '#e2a877', olive: '#d9a06b', brown: '#b9825a' };

// ---- Attack pose table -------------------------------------------------------------------------------------
// Each entry describes which limb moves and where it goes at full extension (e=1). Coordinates are local
// (feet origin, +x forward, -y up). `from` is the wind-up position (e<0 blends toward it).
const ATK = {
  jab:     { limb: 'handF', to: [88, -132], from: [6, -118], lean: 0.10, hip: 4 },
  cross:   { limb: 'handB', to: [92, -128], from: [-10, -112], lean: 0.24, hip: 10, twist: 1 },
  hook:    { limb: 'handF', arc: [2.5, 0.1, 58], lean: 0.2, hip: 6 },
  uppercut:{ limb: 'handF', to: [46, -204], from: [30, -74], lean: -0.08, hip: 0, rise: 12 },
  kick:    { limb: 'footF', to: [86, -92], from: [-10, -18], lean: -0.16, hip: 0, guard: true },
  lowkick: { limb: 'footF', to: [92, -22], from: [-12, -10], lean: 0.05, crouch: 0.5, guard: true },
  highkick:{ limb: 'footF', to: [66, -150], from: [0, -30], lean: -0.32, hip: 0, guard: true },
  slam:    { limb: 'both', to: [70, -66], from: [12, -214], lean: 0.32, hip: 8 },
  chop:    { limb: 'handF', arc: [-2.2, 0.55, 60], lean: 0.26, hip: 8 },
  shove:   { limb: 'both', to: [84, -122], from: [10, -116], lean: 0.32, hip: 8 },
  swing:   { limb: 'handF', arc: [-2.5, 0.6, 62], lean: 0.24, hip: 6, prop: true },
  point:   { limb: 'handF', to: [96, -134], from: [24, -150], lean: 0.12, hip: 4, finger: true },
  airpunch:{ limb: 'handF', to: [84, -110], from: [16, -120], lean: 0.2, air: true },
  airkick: { limb: 'footF', to: [76, -46], from: [10, -50], lean: -0.1, air: true },
  dash:    { limb: 'dash' },
  cast:    { limb: 'cast' },
  summon:  { limb: 'summon' },
  buff:    { limb: 'buff' },
  spin:    { limb: 'spin' },
  ground:  { limb: 'ground' },
  throw:   { limb: 'throw' },
};

function easeE(mv, mt) {
  // extension scalar: -0.35 (wind-up) .. 1 (full) .. back to 0
  // scripted specials only give `frames` / `release`; derive a wind-up, a short active window and a recovery from them
  const total = mv.frames || 30;
  const s = mv.startup !== undefined ? mv.startup : (mv.release !== undefined ? mv.release : Math.floor(total * 0.35));
  const a = mv.active !== undefined ? mv.active : 4;
  const r = mv.recovery !== undefined ? mv.recovery : Math.max(6, total - s - a);
  if (mt < s) {
    const u = mt / Math.max(1, s);
    if (u < 0.65) return -0.35 * Ease.smooth(u / 0.65);
    return lerp(-0.35, 1, Ease.outQuad((u - 0.65) / 0.35));
  }
  if (mt < s + a) return 1;
  const q = (mt - s - a) / Math.max(1, r);
  return 1 - Ease.outCubic(clamp(q, 0, 1));
}

const REST = {
  handF: [34, -124], handB: [14, -116], footF: [24, 0], footB: [-22, 0],
};

function newPose() {
  return {
    hx: 0, hy: -71, lean: 0, headX: 0, headY: 0, headRot: 0, rot: 0, rotX: 0, rotY: -60,
    handF: REST.handF.slice(), handB: REST.handB.slice(), footF: REST.footF.slice(), footB: REST.footB.slice(),
    sx: 1, sy: 1, eyes: 'open', mouth: 'closed', prop: null, propAng: 0, glow: null, dizzy: false, finger: false,
    fistF: true,
  };
}

function poseOf(f) {
  const p = newPose();
  const clock = f.clock || 0;
  const st = f.st;
  const mv = f.mv;
  const bob = Math.sin(clock * 0.09);

  const setGuard = (k = 1) => {
    p.handF = [lerp(34, 38, k), -124 + bob * 2];
    p.handB = [14, -116 + bob * 1.5];
  };

  if (st === 'idle' || st === 'intro' || st === 'walk' || st === 'dash' || st === 'blockstun' || st === 'block') {
    p.hy = -71 + bob * 1.6;
    p.sy = 1 + bob * 0.008; p.sx = 1 - bob * 0.006;
    setGuard();
    if (st === 'walk' || st === 'dash') {
      const ph = f.walkPh;
      const dirF = f.moveDir === f.face ? 1 : -1;
      const sw = Math.sin(ph) * 26 * dirF, lift = Math.max(0, Math.cos(ph)) * 12, lift2 = Math.max(0, -Math.cos(ph)) * 12;
      p.footF = [22 + sw, -lift]; p.footB = [-20 - sw, -lift2];
      p.hy += Math.abs(Math.sin(ph)) * -3;
      p.lean = 0.06 * dirF;
      p.handF = [30 - sw * 0.25, -122]; p.handB = [16 + sw * 0.25, -114];
      if (st === 'dash') {
        const dd = dirF > 0 ? 1 : -1;
        p.lean = 0.5 * dd; p.footF = [50 * dd + 4, -8]; p.footB = [-40 * dd, -4];
        p.handF = [-8, -108]; p.handB = [-20, -96]; p.hy = -60;
      }
    }
    if (st === 'block' || st === 'blockstun') {
      const cr = f.crouchBlock ? 1 : 0;
      p.handF = [42, -136 + cr * 34]; p.handB = [36, -128 + cr * 34];
      p.eyes = 'squint'; p.lean = -0.06;
      if (cr) { p.hy = -38; p.footF = [40, 0]; p.footB = [-32, 0]; p.headY = 24; }
      if (st === 'blockstun') { p.hx = -Math.sin(f.t * 1.4) * 3; p.mouth = 'o'; }
    }
    if (st === 'intro') {
      p.mouth = f.t % 40 < 20 ? 'shout' : 'smile';
      p.handF = [56, -150 + bob * 6]; p.handB = [0, -100];
    }
  } else if (st === 'crouch') {
    p.hy = -38; p.headY = 24; p.lean = 0.16;
    p.footF = [40, 0]; p.footB = [-32, 0];
    p.handF = [44, -100]; p.handB = [24, -90];
    p.sy = 0.98;
  } else if (st === 'jump') {
    const up = f.vy < 0;
    p.hy = -70;
    p.footF = [20, -34 + (up ? -6 : 4)]; p.footB = [-14, -20];
    p.handF = [44, up ? -166 : -136]; p.handB = [-8, up ? -150 : -128];
    p.lean = up ? 0.06 : -0.04;
    p.mouth = 'open';
    p.sy = up ? 1.05 : 0.97; p.sx = up ? 0.96 : 1.03;
    p.rot = f.spinRot || 0;
  } else if (st === 'hit' || st === 'airhit') {
    const k = Math.max(0, 1 - f.t / 8);
    p.lean = -0.36 - k * 0.14; p.headRot = -0.35; p.headX = -6; p.headY = 2;
    p.handF = [6, -100]; p.handB = [-24, -110];
    p.hx = -4 - k * 6;
    p.eyes = 'hurt'; p.mouth = 'shout';
    p.footF = [22, 0]; p.footB = [-26, 0];
    if (st === 'airhit') {
      p.rot = -0.9 - (f.vy > 0 ? 0.3 : 0); p.rotY = -90; p.footF = [10, -50]; p.footB = [-6, -26];
      p.handF = [40, -150]; p.handB = [-30, -150]; p.hy = -80;
    }
    if (f.crouchHit) { p.hy = -40; p.headY = 22; p.footF = [40, 0]; p.footB = [-32, 0]; }
  } else if (st === 'down' || st === 'ko') {
    // lying on the back
    const t = f.t;
    const fall = st === 'ko' && !f.grounded;
    p.rot = -Math.PI / 2 + (fall ? -0.4 : 0); p.rotY = -22; p.rotX = 0;
    p.hy = -44; p.eyes = st === 'ko' ? 'ko' : 'hurt'; p.mouth = st === 'ko' ? 'sad' : 'shout';
    p.handF = [50, -80]; p.handB = [-30, -100];
    p.footF = [24, -8]; p.footB = [-16, -4];
    p.dizzy = st === 'down' && t > 8 && t < 60;
    if (st === 'ko' && f.grounded) p.dizzy = true;
  } else if (st === 'getup') {
    const u = clamp(f.t / 22, 0, 1);
    p.rot = lerp(-Math.PI / 2, 0, Ease.outCubic(u)); p.rotY = lerp(-22, -40, u); p.hy = lerp(-44, -71, u);
    p.handF = [30, -110]; p.handB = [0, -90]; p.eyes = 'squint';
  } else if (st === 'thrown') {
    p.rot = -1.4 + (f.thrownSpin || 0); p.rotY = -70; p.hy = -60; p.eyes = 'hurt'; p.mouth = 'shout';
    p.handF = [40, -150]; p.handB = [-30, -150]; p.footF = [20, -30]; p.footB = [-20, -40];
  } else if (st === 'stun') {
    p.lean = -0.12 + Math.sin(f.clock * 0.3) * 0.12; p.headRot = Math.sin(f.clock * 0.3) * 0.3;
    p.eyes = 'ko'; p.mouth = 'o'; p.dizzy = true; p.handF = [10, -90]; p.handB = [-10, -86];
  } else if (st === 'win') {
    const t = f.t;
    p.hy = -71 - Math.abs(Math.sin(t * 0.14)) * 8;
    p.handF = [52, -196 - Math.sin(t * 0.3) * 6]; p.handB = [-10, -190 + Math.sin(t * 0.3 + 1) * 6];
    p.eyes = 'happy'; p.mouth = 'grin'; p.lean = -0.06;
  } else if (st === 'taunt') {
    p.hy = -71; p.handF = [40, -190]; p.handB = [-4, -120]; p.eyes = 'happy'; p.mouth = 'grin'; p.lean = -0.1 + Math.sin(f.t * 0.4) * 0.05;
  } else if (st === 'attack' && mv) {
    applyAttackPose(f, p, mv);
  } else if (st === 'throwing') {
    const u = f.t;
    p.mouth = 'shout'; p.eyes = 'angry';
    if (u < 8) { p.lean = 0.3; p.handF = [64, -100]; p.handB = [56, -96]; }
    else if (u < 26) { p.lean = -0.2; p.handF = [40, -200]; p.handB = [30, -196]; p.hy = -70; }
    else { p.lean = 0.42; p.handF = [70, -60]; p.handB = [60, -56]; p.hy = -60; }
  }

  // expression overrides
  if (st === 'idle' && f.hurtPct < 0.25) { p.eyes = 'angry'; }
  else if (p.eyes === 'open' && ((f.clock || 0) + (f.def.look.h || 1) * 97) % 230 < 6) p.eyes = 'blink';
  return p;
}

function applyAttackPose(f, p, mv) {
  const spec = ATK[mv.anim] || ATK.jab;
  const mt = f.mt;
  const air = mv.air || spec.air;
  p.mouth = 'shout'; p.eyes = 'angry';
  const SCRIPTED = ['cast', 'summon', 'buff', 'dash', 'spin', 'ground', 'throw'];
  if (!SCRIPTED.includes(spec.limb)) {
    const e = easeE(mv, mt);
    const ex = clamp(e, -0.4, 1.05);
    let target;
    if (spec.arc) {
      const [a0, a1, r] = spec.arc;
      const ang = lerp(a0, a1, clamp((e + 0.35) / 1.35, 0, 1));
      const sx = 14 + p.hx, sy = p.hy - 50;
      target = [sx + Math.cos(ang) * r, sy - Math.sin(ang) * r * 1.0];
    } else {
      const from = spec.from, to = spec.to;
      const u = ex < 0 ? ex / -0.35 : ex; // wind-up toward `from`
      target = ex < 0
        ? [lerp(REST[spec.limb === 'footF' ? 'footF' : 'handF'][0], from[0], u), lerp(REST[spec.limb === 'footF' ? 'footF' : 'handF'][1], from[1], u)]
        : [lerp(REST[spec.limb === 'footF' ? 'footF' : (spec.limb === 'handB' ? 'handB' : 'handF')][0], to[0], ex),
           lerp(REST[spec.limb === 'footF' ? 'footF' : (spec.limb === 'handB' ? 'handB' : 'handF')][1], to[1], ex)];
    }
    p.lean = (spec.lean || 0) * ex;
    p.hx = (spec.hip || 0) * ex;
    if (spec.twist) p.headRot = 0.1 * ex;
    if (spec.crouch) { p.hy = -71 + 39 * spec.crouch * clamp(ex + 0.35, 0, 1); p.footB = [-30, 0]; }
    if (spec.rise) p.hy = -71 - spec.rise * ex;
    if (mv.crouch) { p.hy = -40; p.headY = 22; p.footB = [-32, 0]; p.handB = [22, -92]; p.handF = [40, -100]; }

    if (spec.limb === 'handF') { p.handF = target; p.handB = [10, -112]; }
    else if (spec.limb === 'handB') { p.handB = target; p.handF = [34, -124]; }
    else if (spec.limb === 'footF') {
      p.footF = target;
      if (spec.guard) { p.handF = [40, -128]; p.handB = [16, -118]; }
      p.footB = [-20, 0];
      if (air) { p.footB = [-14, -30]; p.footF = target; }
    } else if (spec.limb === 'both') {
      const bt = [target[0], target[1]];
      p.handF = bt; p.handB = [bt[0] - 12, bt[1] + 6];
    }
    if (spec.prop && mv.prop) { p.prop = mv.prop; p.propAng = spec.arc ? -Math.atan2(target[1] - (p.hy - 50), target[0] - 14) + 0 : 0; p.propAng = Math.atan2(target[1] - (p.hy - 50), target[0] - 14); }
    if (spec.finger) p.finger = true;
    if (mv.prop && !spec.prop) { p.prop = mv.prop; p.propAng = -0.2; }
    if (air) {
      p.hy = -76; p.footB = [-14, -30];
      if (spec.limb !== 'footF') p.footF = [20, -34];
    }
    return;
  }

  // scripted special animation keys
  const total = mv.frames || (mv.startup + mv.active + mv.recovery) || 30;
  const u = clamp(mt / total, 0, 1);
  const rel = mv.release !== undefined ? mv.release : Math.floor(total * 0.4);
  if (spec.limb === 'cast') {
    if (mt < rel) {
      const k = Ease.smooth(mt / Math.max(1, rel));
      p.lean = -0.12 * k; p.handF = [lerp(34, 4, k), lerp(-124, -118, k)]; p.handB = [lerp(14, -6, k), -110];
      p.hx = -6 * k;
    } else {
      const k = Ease.outQuad(clamp((mt - rel) / 8, 0, 1)), fade = 1 - clamp((mt - rel - 10) / (total - rel), 0, 1) * 0.6;
      p.lean = 0.18 * k * fade; p.handF = [lerp(4, 92, k), -126]; p.handB = [lerp(-6, 74, k), -118];
      p.hx = 6 * k;
    }
    p.footF = [30, 0]; p.footB = [-26, 0];
    if (mv.prop) { p.prop = mv.prop; p.propAng = 0; }
  } else if (spec.limb === 'summon') {
    const k = Ease.outCubic(clamp(mt / 14, 0, 1));
    p.handF = [lerp(34, 30, k), lerp(-124, -212, k) + Math.sin(mt * 0.6) * 3]; p.handB = [lerp(14, -6, k), lerp(-116, -206, k) + Math.cos(mt * 0.6) * 3];
    p.lean = -0.08 * k; p.glow = mv.glow || '#ffd94a';
    p.footF = [30, 0]; p.footB = [-28, 0];
  } else if (spec.limb === 'buff') {
    const sh = Math.sin(mt * 1.2) * 2;
    p.handF = [30 + sh, -128]; p.handB = [10 - sh, -120]; p.hy = -60; p.lean = 0.1; p.glow = mv.glow || '#ff8a3d';
    p.footF = [34, 0]; p.footB = [-32, 0]; p.headY = 6; p.eyes = 'angry';
  } else if (spec.limb === 'dash') {
    p.lean = 0.55; p.footF = [54, -6]; p.footB = [-46, -2]; p.handF = [-16, -108]; p.handB = [-28, -98]; p.hy = -58;
    if (mv.dashHit && mt >= (mv.dashHit[0] || 0)) { p.handF = [70, -120]; p.handB = [58, -110]; p.lean = 0.5; }
  } else if (spec.limb === 'spin') {
    p.rot = (mt / total) * TAU * (mv.spins || 1); p.rotY = -90; p.footF = [40, -60]; p.footB = [-40, -60]; p.handF = [70, -100]; p.handB = [-70, -100]; p.hy = -90;
  } else if (spec.limb === 'ground') {
    const k = Ease.smooth(clamp(mt / 10, 0, 1));
    p.hy = -71 + 49 * k; p.headY = 24 * k; p.lean = 0.3 * k; p.handF = [46, -20 * (1 - k) - 6]; p.handB = [30, -8];
    p.footF = [40, 0]; p.footB = [-32, 0];
  } else if (spec.limb === 'throw') {
    p.lean = 0.3; p.handF = [64, -100]; p.handB = [56, -96];
  }
}

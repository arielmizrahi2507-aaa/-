// ===== Procedural fighter renderer =====
// Characters are drawn from a small skeleton (2-bone IK limbs, chibi head) so every move gets a real animation
// without any image assets. `poseOf` turns a Fighter's state into joint targets; `drawFighter` paints them.

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
  const s = mv.startup, a = mv.active, r = mv.recovery;
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
    hx: 0, hy: -66, lean: 0, headX: 0, headY: 0, headRot: 0, rot: 0, rotX: 0, rotY: -60,
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
    p.hy = -66 + bob * 1.6;
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
    p.rot = -Math.PI / 2 + (fall ? -0.4 : 0); p.rotY = -40; p.rotX = 0;
    p.hy = -50; p.eyes = st === 'ko' ? 'ko' : 'hurt'; p.mouth = st === 'ko' ? 'sad' : 'shout';
    p.handF = [50, -80]; p.handB = [-30, -100];
    p.footF = [24, -8]; p.footB = [-16, -4];
    p.dizzy = st === 'down' && t > 8 && t < 60;
    if (st === 'ko' && f.grounded) p.dizzy = true;
  } else if (st === 'getup') {
    const u = clamp(f.t / 22, 0, 1);
    p.rot = lerp(-Math.PI / 2, 0, Ease.outCubic(u)); p.rotY = -40; p.hy = lerp(-50, -66, u);
    p.handF = [30, -110]; p.handB = [0, -90]; p.eyes = 'squint';
  } else if (st === 'thrown') {
    p.rot = -1.4 + (f.thrownSpin || 0); p.rotY = -70; p.hy = -60; p.eyes = 'hurt'; p.mouth = 'shout';
    p.handF = [40, -150]; p.handB = [-30, -150]; p.footF = [20, -30]; p.footB = [-20, -40];
  } else if (st === 'stun') {
    p.lean = -0.12 + Math.sin(f.clock * 0.3) * 0.12; p.headRot = Math.sin(f.clock * 0.3) * 0.3;
    p.eyes = 'ko'; p.mouth = 'o'; p.dizzy = true; p.handF = [10, -90]; p.handB = [-10, -86];
  } else if (st === 'win') {
    const t = f.t;
    p.hy = -66 - Math.abs(Math.sin(t * 0.14)) * 8;
    p.handF = [52, -196 - Math.sin(t * 0.3) * 6]; p.handB = [-10, -190 + Math.sin(t * 0.3 + 1) * 6];
    p.eyes = 'happy'; p.mouth = 'grin'; p.lean = -0.06;
  } else if (st === 'taunt') {
    p.hy = -66; p.handF = [40, -190]; p.handB = [-4, -120]; p.eyes = 'happy'; p.mouth = 'grin'; p.lean = -0.1 + Math.sin(f.t * 0.4) * 0.05;
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
    if (spec.crouch) { p.hy = -66 + 34 * spec.crouch * clamp(ex + 0.35, 0, 1); p.footB = [-30, 0]; }
    if (spec.rise) p.hy = -66 - spec.rise * ex;
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
    p.hy = -66 + 44 * k; p.headY = 24 * k; p.lean = 0.3 * k; p.handF = [46, -20 * (1 - k) - 6]; p.handB = [30, -8];
    p.footF = [40, 0]; p.footB = [-32, 0];
  } else if (spec.limb === 'throw') {
    p.lean = 0.3; p.handF = [64, -100]; p.handB = [56, -96];
  }
}

// ---- Hair styles ---------------------------------------------------------------------------------------------
// Each draws around head centre (0,0), radius ~33, face pointing +x. Called after the face base is painted.
const HAIR = {
  none() {},
  swoop(ctx, c, ol) {
    // full side-swept hair (silver)
    ctx.beginPath();
    ctx.moveTo(-34, 2); ctx.bezierCurveTo(-40, -30, -14, -46, 14, -42);
    ctx.bezierCurveTo(30, -40, 38, -26, 30, -18);
    ctx.bezierCurveTo(22, -28, 8, -26, -2, -20);
    ctx.bezierCurveTo(-10, -12, -18, -6, -22, 6);
    ctx.closePath();
    ol(ctx, c);
    ctx.strokeStyle = darken(c, 0.25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-24, -14); ctx.quadraticCurveTo(-6, -36, 20, -34); ctx.moveTo(-28, -2); ctx.quadraticCurveTo(-10, -28, 8, -28); ctx.stroke();
  },
  crop(ctx, c, ol) {
    ctx.beginPath();
    ctx.moveTo(-33, 4); ctx.bezierCurveTo(-38, -26, -12, -40, 12, -38);
    ctx.bezierCurveTo(26, -36, 34, -26, 32, -16);
    ctx.bezierCurveTo(20, -24, 0, -22, -14, -18);
    ctx.bezierCurveTo(-20, -8, -24, 2, -26, 8);
    ctx.closePath();
    ol(ctx, c);
  },
  sides(ctx, c, ol) {
    // bald top with hair at back/sides
    ctx.beginPath();
    ctx.moveTo(-33, -6); ctx.bezierCurveTo(-35, -22, -26, -32, -14, -34);
    ctx.bezierCurveTo(-18, -22, -22, -10, -24, 4); ctx.bezierCurveTo(-28, 8, -32, 6, -33, -6);
    ctx.closePath(); ol(ctx, c);
  },
  wavy(ctx, c, ol, look) {
    // longer hair with volume (drawn on top of head; back locks are painted by `hairBack`)
    ctx.beginPath();
    ctx.moveTo(-38, 14); ctx.bezierCurveTo(-46, -30, -14, -50, 14, -44);
    ctx.bezierCurveTo(32, -40, 40, -22, 32, -12);
    ctx.bezierCurveTo(26, -26, 10, -30, -2, -24);
    ctx.bezierCurveTo(-12, -16, -20, -8, -24, 8);
    ctx.closePath(); ol(ctx, c);
    ctx.strokeStyle = lighten(c, 0.3); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(0, -42, 18, -34); ctx.stroke();
  },
  part(ctx, c, ol) {
    ctx.beginPath();
    ctx.moveTo(-34, 2); ctx.bezierCurveTo(-38, -28, -12, -42, 12, -40);
    ctx.bezierCurveTo(28, -38, 36, -24, 33, -12);
    ctx.bezierCurveTo(22, -18, 6, -24, -6, -22);
    ctx.bezierCurveTo(-16, -14, -22, -4, -26, 8);
    ctx.closePath(); ol(ctx, c);
    ctx.strokeStyle = darken(c, 0.4); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(6, -38); ctx.quadraticCurveTo(2, -30, -6, -22); ctx.stroke();
  },
  curly(ctx, c, ol) {
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * (Math.PI * 1.05) - 0.1;
      ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26 - 4, 11, 0, TAU);
    }
    ol(ctx, c);
  },
};

function drawHairBack(ctx, look, ol) {
  if (look.hair.style === 'wavy') {
    ctx.beginPath();
    ctx.moveTo(-6, -30); ctx.bezierCurveTo(-52, -34, -58, 30, -44, 52);
    ctx.bezierCurveTo(-30, 58, -14, 44, -6, 24); ctx.closePath();
    ol(ctx, darken(look.hair.color, 0.12));
  }
}

// ---- Face + head ---------------------------------------------------------------------------------------------
function drawHead(ctx, f, look, p, C, tintFn) {
  const ol = (c, fill, lw) => { ctx.lineWidth = lw || 3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); };
  const hs = look.head || 1;
  ctx.save();
  ctx.scale(hs, hs);
  // back hair
  drawHairBack(ctx, look, (c, fill) => ol(c, C(fill)));

  // ear
  ctx.beginPath(); ctx.ellipse(-24, 6, 7, 9, 0, 0, TAU); ol(ctx, C(darken(look.skin, 0.08)), 2.5);

  // head base
  const g = ctx.createRadialGradient(-8, -12, 4, 0, 0, 40);
  g.addColorStop(0, C(lighten(look.skin, 0.25))); g.addColorStop(1, C(look.skin));
  ctx.beginPath(); ctx.ellipse(0, 0, 33, 34, 0, 0, TAU); ol(ctx, g);
  // nose (profile bump)
  ctx.beginPath(); ctx.ellipse(33, 6, 7 * (look.nose || 1), 6 * (look.nose || 1), 0.2, 0, TAU); ol(ctx, C(darken(look.skin, 0.03)), 2.5);
  ctx.beginPath(); ctx.ellipse(30, 4, 4, 5, 0, 0, TAU); ctx.fillStyle = C(look.skin); ctx.fill();

  // beard
  if (look.beard) {
    ctx.beginPath();
    ctx.moveTo(-26, 8); ctx.bezierCurveTo(-30, 34, -6, 46, 14, 40); ctx.bezierCurveTo(28, 36, 34, 22, 30, 14);
    ctx.bezierCurveTo(22, 20, 10, 22, 2, 18); ctx.bezierCurveTo(-8, 22, -18, 18, -26, 8); ctx.closePath();
    ol(ctx, C(look.beard.color), 2.5);
  }

  // cheeks
  ctx.save();
  ctx.fillStyle = C('#ff9a9a'); ctx.globalAlpha *= 0.3;
  ctx.beginPath(); ctx.ellipse(10, 14, 7, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // eyes
  const eyeY = -3;
  const lookX = clamp(f.lookDir || 0, -1, 1) * 1.5 + 1;
  const eyeSpec = [[9, 1.0], [25, 0.8]];
  for (const [ex, es] of eyeSpec) {
    ctx.save(); ctx.translate(ex, eyeY); ctx.scale(es, es);
    const ee = p.eyes;
    if (ee === 'blink') {
      ctx.beginPath(); ctx.moveTo(-7, 2); ctx.quadraticCurveTo(0, 6, 7, 2); ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.stroke();
    } else if (ee === 'happy') {
      ctx.beginPath(); ctx.arc(0, 2, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
    } else if (ee === 'hurt') {
      ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(4, 0); ctx.lineTo(-6, 5); ctx.stroke();
    } else if (ee === 'ko') {
      ctx.lineWidth = 3.2; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
    } else {
      const sq = ee === 'squint' ? 0.45 : ee === 'angry' ? 0.8 : 1;
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 9 * sq, 0, 0, TAU); ol(ctx, C('#ffffff'), 2.5);
      ctx.fillStyle = C('#231a3a'); ctx.beginPath(); ctx.arc(lookX * 1.8, sq < 0.6 ? 0 : 1, 4 * Math.min(1, sq + 0.3), 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(lookX * 1.8 - 1.5, -2, 2, 2);
    }
    ctx.restore();
  }
  // brows
  const bw = look.brow || 3.6;
  ctx.lineWidth = bw; ctx.lineCap = 'round'; ctx.strokeStyle = C(look.browColor || darken(look.hair.color === '#e9edf3' ? '#8d95a3' : look.hair.color, 0.35));
  const ang = p.eyes === 'angry' ? 0.42 : p.eyes === 'hurt' ? -0.3 : p.eyes === 'squint' ? 0.25 : p.eyes === 'happy' ? -0.08 : 0;
  ctx.beginPath(); ctx.moveTo(2, -16 - ang * -8); ctx.lineTo(17, -16 + ang * 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(19, -14 + ang * 3); ctx.lineTo(31, -14 + ang * 9); ctx.stroke();

  // mustache
  if (look.stache) {
    ctx.beginPath(); ctx.moveTo(6, 15); ctx.quadraticCurveTo(20, 8, 33, 15); ctx.quadraticCurveTo(22, 20, 6, 20); ctx.closePath();
    ol(ctx, C(look.stache), 2);
  }
  // mouth
  const my = 21, m = p.mouth;
  ctx.save(); ctx.translate(17, my);
  if (m === 'closed') { ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(2, 3, 10, -1); ctx.stroke(); }
  else if (m === 'smile') { ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.quadraticCurveTo(2, 8, 11, -3); ctx.stroke(); }
  else if (m === 'sad') { ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.quadraticCurveTo(2, -4, 11, 3); ctx.stroke(); }
  else if (m === 'o') { ctx.beginPath(); ctx.ellipse(2, 1, 5, 6, 0, 0, TAU); ol(ctx, C('#5a1f2b'), 2.5); }
  else if (m === 'grin') {
    ctx.beginPath(); ctx.moveTo(-9, -3); ctx.quadraticCurveTo(2, 14, 13, -3); ctx.closePath(); ol(ctx, C('#5a1f2b'), 2.5);
    ctx.fillStyle = C('#fff'); ctx.beginPath(); ctx.moveTo(-7, -2); ctx.quadraticCurveTo(2, 2, 11, -2); ctx.lineTo(11, 0); ctx.quadraticCurveTo(2, 4, -7, 0); ctx.fill();
  } else { // open / shout
    const big = m === 'shout' ? 1 : 0.7;
    ctx.beginPath(); ctx.ellipse(1, 3, 9 * big + 2, 8 * big + 1, 0, 0, TAU); ol(ctx, C('#5a1f2b'), 2.5);
    ctx.fillStyle = C('#ff8fa1'); ctx.beginPath(); ctx.ellipse(1, 7, 6 * big + 1, 3.5 * big, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C('#fff'); ctx.fillRect(-6, -3, 14, 3.5);
  }
  ctx.restore();

  // hair on top
  (HAIR[look.hair.style] || HAIR.none)(ctx, C(look.hair.color), (c, fill) => ol(c, fill), look);
  // kippah
  if (look.kippah) {
    const kc = look.kippah;
    ctx.beginPath(); ctx.ellipse(-6, -29, 18, 9, -0.12, Math.PI, TAU); ctx.closePath();
    ol(ctx, C(kc.color), 2.5);
    if (kc.knit) {
      ctx.strokeStyle = C(kc.knit); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(-6, -29, 12, 5.5, -0.12, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-6, -29, 6, 2.6, -0.12, Math.PI, TAU); ctx.stroke();
    }
  }
  // glasses
  if (look.glasses) {
    const gl = look.glasses;
    ctx.lineWidth = 3; ctx.strokeStyle = C(gl.color || '#222');
    ctx.fillStyle = 'rgba(180,220,255,0.22)';
    if (gl.shape === 'round') {
      for (const [ex, es] of eyeSpec) { ctx.beginPath(); ctx.arc(ex, eyeY, 10 * es + 1, 0, TAU); ctx.fill(); ctx.stroke(); }
    } else {
      for (const [ex, es] of eyeSpec) { rr(ctx, ex - 10 * es, eyeY - 8 * es, 20 * es, 16 * es, 3); ctx.fill(); ctx.stroke(); }
    }
    ctx.beginPath(); ctx.moveTo(18, eyeY); ctx.lineTo(15, eyeY); ctx.moveTo(-1, eyeY); ctx.lineTo(-24, eyeY + 2); ctx.stroke();
  }
  // earrings
  if (look.earring) { ctx.beginPath(); ctx.arc(-24, 17, 3.5, 0, TAU); ol(ctx, C(look.earring), 1.8); }
  ctx.restore();
}


// ---- Robot variant (secret boss: the electoral threshold, a walking ballot box) ----
function drawRobotHead(ctx, f, look, p, C) {
  ctx.save();
  const ol = OUT;
  // antenna
  ctx.strokeStyle = ol; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(-8, -50); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, -53, 6, 0, TAU); ctx.fillStyle = C('#ff4f6a'); ctx.fill(); ctx.stroke();
  // skull
  const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, C('#d5dbe8')); g.addColorStop(1, C('#8d97ab'));
  rr(ctx, -34, -32, 68, 62, 14); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = ol; ctx.stroke();
  // visor
  rr(ctx, -26, -18, 56, 26, 8); ctx.fillStyle = C('#12163a'); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  const e = p.eyes, col = e === 'hurt' || e === 'ko' ? '#ff5a7a' : e === 'happy' ? '#7dff9a' : '#6ff0ff';
  ctx.strokeStyle = C(col); ctx.fillStyle = C(col); ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const ex of [-10, 16]) {
    if (e === 'ko') { ctx.beginPath(); ctx.moveTo(ex - 5, -13); ctx.lineTo(ex + 5, -3); ctx.moveTo(ex + 5, -13); ctx.lineTo(ex - 5, -3); ctx.stroke(); }
    else if (e === 'happy') { ctx.beginPath(); ctx.arc(ex, -4, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (e === 'angry') { ctx.beginPath(); ctx.moveTo(ex - 6, -12 + (ex < 0 ? 0 : 4)); ctx.lineTo(ex + 6, -6 - (ex < 0 ? 0 : 4)); ctx.lineTo(ex + 6, -2); ctx.lineTo(ex - 6, -2); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(ex, -7, 5, e === 'squint' ? 2.5 : 6, 0, 0, TAU); ctx.fill(); }
  }
  // ballot-slot mouth
  const open = p.mouth === 'shout' || p.mouth === 'open' || p.mouth === 'o' ? 8 : 3;
  rr(ctx, -16, 14, 44, open + 2, 3); ctx.fillStyle = C('#1b1330'); ctx.fill();
  ctx.fillStyle = C('#fff'); ctx.fillRect(-10, 15, 32, 2);
  // rivets
  ctx.fillStyle = C('#5b6478');
  for (const [rx, ry] of [[-28, -26], [28, -26], [-28, 24], [28, 24]]) { ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawRobotTorso(ctx, look, C, outline, tint, tw, torsoLen) {
  // a ballot box: blue body, white slot lid, big 3.25% label
  const top = -torsoLen - 8, h = torsoLen + 22, w = tw * 1.06;
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, C(darken(look.suit, 0.15))); g.addColorStop(0.5, C(lighten(look.suit, 0.12))); g.addColorStop(1, C(darken(look.suit, 0.2)));
  rr(ctx, -w, top, w * 2, h, 10); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = outline; ctx.stroke();
  // lid
  rr(ctx, -w - 3, top - 6, w * 2 + 6, 14, 6); ctx.fillStyle = C('#eef2fb'); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  rr(ctx, -w * 0.5, top - 2, w, 5, 2.5); ctx.fillStyle = C('#1b1330'); ctx.fill();
  if (!tint) {
    // paper peeking out of the slot
    ctx.save(); ctx.translate(4, top - 4); ctx.rotate(-0.12); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -11, 16, 12); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.strokeRect(-8, -11, 16, 12); ctx.restore();
    T(ctx, '3.25%', 0, top + h * 0.5 + 2, { size: 17, font: 'disp', fill: '#fff', stroke: OUT, lw: 5 });
    ctx.fillStyle = C('#ffd23d'); ctx.fillRect(-w + 5, top + h - 12, w * 2 - 10, 5);
  }
}

// ---- Full body -----------------------------------------------------------------------------------------------
function drawFighter(ctx, f, opt = {}) {
  const def = f.def, look = def.look;
  const p = f.pose || poseOf(f);
  const flash = opt.flash || 0;
  const tint = opt.tint || null;
  const C = tint
    ? () => tint
    : flash > 0
      ? (c) => (c[0] === '#' ? mix(c, '#ffffff', flash) : c)
      : (c) => c;
  const s = look.h || 1;
  const bw = look.w || 1;
  const outline = tint ? tint : OUT;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.face, 1);
  if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
  ctx.scale(s, s);
  if (p.rot) { ctx.translate(p.rotX, p.rotY); ctx.rotate(p.rot); ctx.translate(-p.rotX, -p.rotY); }
  ctx.scale(p.sx, p.sy);

  const suit = look.suit, pants = look.pants || look.suit, shirt = look.shirt || '#ffffff';
  const hipX = p.hx, hipY = p.hy;
  const torsoLen = 50;
  const shX = hipX + Math.sin(p.lean) * torsoLen, shY = hipY - Math.cos(p.lean) * torsoLen;
  const headCX = shX + 2 + p.headX, headCY = shY - 32 + p.headY;

  const limbW = 11;
  const drawArm = (target, back, propKind) => {
    const sx = shX + (back ? -9 : 9), sy = shY + 4;
    const r = ik(sx, sy, target[0], target[1], 30, 30, 1);
    const col = C(back ? darken(suit, 0.1) : lighten(suit, 0.06));
    outlinedLine(ctx, [[sx, sy], [r.jx, r.jy], [r.ex, r.ey]], col, limbW, outline, 3);
    if (!tint) {
      ctx.save(); ctx.translate(-1.5, -2);
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(r.jx, r.jy); ctx.lineTo(r.ex, r.ey); ctx.stroke(); ctx.restore();
      // shirt cuff
      const cl = Math.hypot(r.ex - r.jx, r.ey - r.jy) || 1, ux = (r.ex - r.jx) / cl, uy = (r.ey - r.jy) / cl;
      ctx.strokeStyle = OUT; ctx.lineWidth = limbW + 4; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(r.ex - ux * 14, r.ey - uy * 14); ctx.lineTo(r.ex - ux * 8, r.ey - uy * 8); ctx.stroke();
      ctx.strokeStyle = C(shirt); ctx.lineWidth = limbW - 1;
      ctx.beginPath(); ctx.moveTo(r.ex - ux * 13, r.ey - uy * 13); ctx.lineTo(r.ex - ux * 9, r.ey - uy * 9); ctx.stroke();
    }
    // fist
    ctx.beginPath(); ctx.arc(r.ex, r.ey, 9.5, 0, TAU);
    ctx.lineWidth = 3; ctx.strokeStyle = outline; ctx.fillStyle = C(look.skin); ctx.fill(); ctx.stroke();
    if (p.finger && !back) {
      ctx.beginPath(); ctx.moveTo(r.ex + 3, r.ey - 2); ctx.lineTo(r.ex + 20, r.ey - 3); ctx.lineWidth = 8; ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = C(look.skin); ctx.stroke();
    }
    return r;
  };
  const drawLeg = (target, back) => {
    const sx = hipX + (back ? -8 : 8), sy = hipY + 2;
    const r = ik(sx, sy, target[0], target[1], 38, 38, -1);
    const col = C(back ? darken(pants, 0.2) : pants);
    outlinedLine(ctx, [[sx, sy], [r.jx, r.jy], [r.ex, r.ey]], col, 13, outline, 3);
    if (!tint && !back) {
      ctx.save(); ctx.translate(-2, -1); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(r.jx, r.jy); ctx.lineTo(r.ex, r.ey); ctx.stroke(); ctx.restore();
    }
    // shoe
    ctx.beginPath(); ctx.ellipse(r.ex + 7, r.ey - 1, 16, 8.5, 0, 0, TAU);
    ctx.lineWidth = 3; ctx.strokeStyle = outline; ctx.fillStyle = C(look.shoes || '#1c1b26'); ctx.fill(); ctx.stroke();
    if (!tint) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(r.ex + 9, r.ey - 4, 8, 2.6, 0, 0, TAU); ctx.fill(); }
  };

  // glow aura
  if (p.glow && !tint) {
    ctx.save(); ctx.translate(hipX, hipY - 40); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 130, p.glow, 0.55 + Math.sin(f.clock * 0.3) * 0.15); ctx.restore();
  }

  // ---- back layer
  drawArm(p.handB, true);
  drawLeg(p.footB, true);

  // ---- torso
  ctx.save();
  const tw = 31 * bw, bw2 = 27 * bw;
  ctx.translate(hipX, hipY);
  ctx.rotate(p.lean);
  if (look.robot) drawRobotTorso(ctx, look, C, outline, tint, tw, torsoLen);
  else {
  ctx.beginPath();
  ctx.moveTo(-bw2, 4);
  ctx.quadraticCurveTo(-tw - 4, -torsoLen * 0.5, -tw + 2, -torsoLen - 2);
  ctx.quadraticCurveTo(0, -torsoLen - 10, tw - 2, -torsoLen - 2);
  ctx.quadraticCurveTo(tw + 4, -torsoLen * 0.5, bw2, 4);
  ctx.closePath();
  const tg = ctx.createLinearGradient(-tw, 0, tw, 0);
  tg.addColorStop(0, C(darken(suit, 0.1))); tg.addColorStop(0.5, C(lighten(suit, 0.1))); tg.addColorStop(1, C(darken(suit, 0.15)));
  ctx.fillStyle = tg; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.stroke();
  if (!tint) {
    // shirt v + tie/scarf
    ctx.beginPath(); ctx.moveTo(-8, -torsoLen - 6); ctx.lineTo(14, -torsoLen - 6); ctx.lineTo(4, -torsoLen * 0.35); ctx.closePath();
    ctx.fillStyle = C(look.open ? look.skin : shirt); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    if (look.tie && !look.open) {
      ctx.beginPath(); ctx.moveTo(1, -torsoLen - 4); ctx.lineTo(9, -torsoLen - 4); ctx.lineTo(8, -torsoLen * 0.55); ctx.lineTo(5, -torsoLen * 0.3); ctx.lineTo(2, -torsoLen * 0.55); ctx.closePath();
      ctx.fillStyle = C(look.tie); ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke();
    }
    // lapel lines
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.moveTo(-8, -torsoLen - 6); ctx.lineTo(4, -torsoLen * 0.3); ctx.moveTo(14, -torsoLen - 6); ctx.lineTo(4, -torsoLen * 0.3); ctx.stroke();
    // party pin
    if (look.pin) { ctx.beginPath(); ctx.arc(-10, -torsoLen * 0.62, 4, 0, TAU); ctx.fillStyle = C(look.pin); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke(); }
    // belt
    ctx.fillStyle = C('#20202a'); ctx.fillRect(-bw2 + 2, -3, bw2 * 2 - 4, 6);
  }
  }
  ctx.restore();

  drawLeg(p.footF, false);

  // ---- head
  ctx.save();
  ctx.translate(headCX, headCY);
  ctx.rotate(p.headRot);
  if (look.robot) drawRobotHead(ctx, f, look, p, C); else drawHead(ctx, f, look, p, C);
  ctx.restore();

  // ---- front arm (+ prop)
  const armR = drawArm(p.handF, false);
  if (p.prop && !tint) {
    drawProp(ctx, p.prop, armR.ex, armR.ey, p.propAng);
  }

  // dizzy stars
  if (p.dizzy && !tint) {
    for (let i = 0; i < 3; i++) {
      const a = f.clock * 0.12 + (i * TAU) / 3;
      const sx = headCX + Math.cos(a) * 30, sy = headCY - 44 + Math.sin(a) * 8;
      star(ctx, sx, sy, 5, 7, 3, a); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
    }
  }
  ctx.restore();
}

// Round portrait of a fighter's head (HUD, select cards, VS screen).
function drawPortrait(ctx, def, cx, cy, r, opt = {}) {
  const dummy = { def, x: 0, y: 0, face: 1, st: opt.st || 'idle', t: 0, clock: opt.clock || 0, mv: null, mt: 0, vy: 0, grounded: true, walkPh: 0, moveDir: 0, hurtPct: 1, lookDir: 0 };
  const p = newPose();
  p.eyes = opt.eyes || 'open'; p.mouth = opt.mouth || 'smile';
  dummy.pose = p;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (opt.bg) { ctx.fillStyle = opt.bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
  const k = r / 40;
  ctx.translate(cx, cy + r * 0.05);
  ctx.scale(k * (opt.zoom || 1) * (opt.flip ? -1 : 1), k * (opt.zoom || 1));
  ctx.translate(-4, 0);
  const look = def.look;
  const C = (c) => c;
  drawHead(ctx, dummy, look, p, C);
  // shoulders peeking from the bottom
  ctx.beginPath(); ctx.ellipse(-2, 62, 40 * (look.w || 1), 26, 0, 0, TAU);
  ctx.fillStyle = look.suit; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
  if (look.tie && !look.open) { ctx.beginPath(); ctx.moveTo(4, 40); ctx.lineTo(12, 40); ctx.lineTo(10, 60); ctx.lineTo(6, 62); ctx.lineTo(3, 58); ctx.closePath(); ctx.fillStyle = look.tie; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.lineWidth = opt.lw || 4; ctx.strokeStyle = opt.ring || OUT; ctx.stroke();
  ctx.restore();
}

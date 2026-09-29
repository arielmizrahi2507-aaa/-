// ===== Fighter: state machine, movement, move execution =====
const JUMP_V = 14.3;
const WALK_SPEED = 3.7;
const AIR_ACC = 0.22;
const MAX_AIR_VX = 4.6;
const BTN_BITS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

function clonePose(p) {
  const c = Object.assign({}, p);
  for (const k of ['handF', 'handB', 'footF', 'footB']) c[k] = p[k].slice();
  return c;
}

class Fighter {
  constructor(def, slot, opt = {}) {
    this.def = def;
    this.slot = slot;
    this.opt = opt;
    this.mods = opt.mods || {};
    this.scale = opt.scale || def.scale || 1;
    this.ctrl = opt.ctrl || (() => 0);
    this.maxHp = Math.round(def.stats.hp * (opt.hpMul || 1) + (this.mods.hp || 0));
    this.pw = 56 * this.scale;
    this.moves = def.moves;
    this.passive = def.passive || {};
    this.B = null;
    this.opp = null;
    this.meter = this.mods.startMeter || 0;
    this.reset(true);
  }

  reset(full) {
    this.x = STAGE_W / 2 + (this.slot === 0 ? -150 : 150);
    this.y = GROUND; this.vx = 0; this.vy = 0; this.grounded = true;
    this.face = this.slot === 0 ? 1 : -1;
    this.hp = this.maxHp;
    this.meter = full ? (this.mods.startMeter || 0) : Math.min(100, this.meter * 0.5 + (this.mods.startMeter || 0));
    this.st = 'idle'; this.t = 0; this.clock = 0;
    this.mv = null; this.mi = null; this.mk = ''; this.mt = 0;
    this.stunT = 0; this.lock = 0; this.inv = 0; this.hitstop = 0; this.flashT = 0;
    this.cd = { sp1: 0, sp2: 0 };
    this.tm = { silence: 0, slow: 0, dmgUp: 0, defUp: 0, haste: 0, iron: 0, shieldT: 0 };
    this.val = { dmgUpMul: 1, defUpMul: 1, shield: 0 };
    this.pv = {};
    this.in = 0; this.prevIn = 0; this.pressAt = {}; this.tapAt = { 1: -99, 2: -99 }; this.dashReq = null;
    this.walkPh = 0; this.moveDir = 0; this.crouchBlock = false; this.crouchHit = false;
    this.airHits = 0; this.airJumps = 0; this.airAttacked = false; this.bounced = false;
    this.trail = []; this.tookDamage = false; this.ko = false; this.pose = null; this.lookDir = 0;
    this.chain = 0; this.spinRot = 0; this.thrownSpin = 0; this.holder = null; this.held = null;
    this.hurtPct = 1;
  }

  // ---------- helpers ----------
  get alive() { return this.hp > 0; }
  speed() {
    let s = this.def.stats.spd * (this.mods.spd || 1) * WALK_SPEED;
    if (this.tm.slow > 0) s *= 0.6;
    if (this.tm.haste > 0) s *= 1.28;
    if (this.tm.iron > 0) s *= 0.88;
    if (this.passive.spd) s *= this.passive.spd(this, this.B);
    return s;
  }
  dmgMul(info) {
    let m = this.def.stats.pow * (this.opt.dmgMul || 1) * (this.mods.dmg || 1);
    if (this.tm.dmgUp > 0) m *= this.val.dmgUpMul;
    if (this.passive.dmgOut) m *= this.passive.dmgOut(this, info, this.B);
    if (this.mods.execute && this.opp && this.opp.hp / this.opp.maxHp < 0.5) m *= 1.15;
    return m;
  }
  takenMul(info) {
    let m = (this.def.stats.def || 1) * (this.mods.taken || 1) * (this.opt.takenMul || 1);
    if (this.tm.defUp > 0) m *= this.val.defUpMul;
    if (this.tm.iron > 0) m *= 0.65;
    if (this.passive.dmgIn) m *= this.passive.dmgIn(this, info, this.B);
    return m;
  }
  gain(n) {
    let g = n * (this.def.stats.meter || 1) * (this.mods.meter || 1);
    this.meter = Math.min(100, this.meter + g);
  }
  heal(n, show = true) {
    if (this.hp <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (show && this.hp - before >= 1) Fx.text(this.x, this.y - 210, '+' + Math.round(this.hp - before), { col: '#7dff9a', size: 22 });
  }
  faceOpp() {
    if (this.opp && this.grounded) {
      const d = this.opp.x - this.x;
      if (Math.abs(d) > 4) this.face = d > 0 ? 1 : -1;
    }
  }
  fwdHeld() { return !!(this.in & (this.face > 0 ? IN.R : IN.L)); }
  dirx() { return ((this.in & IN.R) ? 1 : 0) - ((this.in & IN.L) ? 1 : 0); }
  hasBuf(bit, win = 5) { return this.B.frame - (this.pressAt[bit] === undefined ? -99 : this.pressAt[bit]) <= win; }
  eat(bit) { this.pressAt[bit] = -99; }

  hurtbox() {
    const s = this.scale;
    let w = 58 * s, h = 172 * s;
    if (this.st === 'crouch' || ((this.st === 'block' || this.st === 'blockstun') && this.crouchBlock) || this.crouchHit) h = 104 * s;
    else if (!this.grounded) h = 150 * s;
    else if (this.st === 'down' || this.st === 'ko') { w = 150 * s; h = 44 * s; }
    return { x: this.x - w / 2, y: this.y - h, w, h };
  }
  // hitbox spec [ox, oy, w, h] (ox forward from centre) -> world rect
  box(hb) {
    const s = this.scale, ox = hb[0] * s, oy = hb[1] * s, w = hb[2] * s, h = hb[3] * s;
    return { x: this.face > 0 ? this.x + ox : this.x - ox - w, y: this.y + oy, w, h };
  }
  hurtable() {
    if (this.inv > 0 || this.ko) return false;
    return !['down', 'ko', 'thrown', 'getup', 'throwing'].includes(this.st);
  }
  solid() { return !['down', 'ko', 'thrown'].includes(this.st); }
  actionable() { return ['idle', 'walk', 'crouch', 'block'].includes(this.st) && this.lock <= 0; }

  // ---------- input ----------
  readInput() {
    const B = this.B;
    let m = 0;
    if (B.phase === 'fight' && !B.cine && !this.ko) m = this.ctrl(this, B) | 0;
    if (this.slot === 0 && Inp.dashHit) { Inp.dashHit = false; if (B.phase === 'fight') this.dashReq = { dir: this.face, at: B.frame }; }
    const pressed = m & ~this.prevIn;
    if (pressed) {
      for (const bit of BTN_BITS) if (pressed & bit) this.pressAt[bit] = B.frame;
      if (pressed & (IN.L | IN.R)) {
        const bit = pressed & IN.L ? IN.L : IN.R;
        const last = this.tapAt[bit];
        this.tapAt[bit] = B.frame;
        if (B.frame - last <= 13 && B.frame - last > 1) this.dashReq = { dir: bit === IN.R ? 1 : -1, at: B.frame };
      }
    }
    this.in = m; this.prevIn = m;
  }

  // ---------- per-frame update ----------
  update() {
    const B = this.B;
    this.clock++;
    this.hurtPct = this.hp / this.maxHp;
    if (this.opp) {
      const d = this.opp.x - this.x;
      this.lookDir = Math.abs(d) < 8 ? 0 : (d > 0 ? this.face : -this.face);
    }
    // Buffered presses are frozen (not aged) while this fighter is in hit-stop, so cancels pressed during the freeze still work.
    if (this.hitstop > 0) for (const k in this.pressAt) if (this.pressAt[k] > -50) this.pressAt[k]++;
    this.readInput();
    if (this.hitstop > 0) { this.hitstop--; this.updatePose(); return; }

    // timers
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= (this.mods.cdRate || 1) * (this.passive.cdRate ? this.passive.cdRate(this, B) : 1);
    for (const k in this.tm) if (this.tm[k] > 0) this.tm[k]--;
    if (this.inv > 0) this.inv--;
    if (this.lock > 0) this.lock--;
    if (this.flashT > 0) this.flashT--;
    if (this.passive.tick) this.passive.tick(this, B);
    if (this.val.shield > 0 && this.tm.shieldT <= 0) this.val.shield = 0;
    this.noPush = false;
    this.t++;

    switch (this.st) {
      case 'idle': case 'walk': case 'crouch': case 'block': this.updateNeutral(); break;
      case 'dash': this.updateDash(); break;
      case 'jump': this.updateJump(); break;
      case 'attack': this.updateAttack(); break;
      case 'hit': case 'blockstun':
        if (--this.stunT <= 0) { this.st = this.grounded ? 'idle' : 'jump'; this.t = 0; this.crouchHit = false; }
        break;
      case 'stun':
        if (--this.stunT <= 0) { this.st = 'idle'; this.t = 0; }
        break;
      case 'down':
        if (this.t > 34) { this.st = 'getup'; this.t = 0; this.inv = 16; }
        break;
      case 'getup':
        if (this.t > 20) { this.st = 'idle'; this.t = 0; }
        break;
      case 'throwing': this.updateThrowing(); break;
      default: break;
    }
    this.physics();
    this.updatePose();
    if (this.trailOn) {
      this.trail.push({ x: this.x, y: this.y, face: this.face, pose: clonePose(this.pose), a: 0.5 });
      if (this.trail.length > 5) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();
    this.trailOn = false;
  }

  updateNeutral() {
    const B = this.B, inp = this.in;
    this.faceOpp();
    if (this.lock > 0) { this.vx = 0; return; }
    if (this.tryActions(0)) return;
    if (this.dashReq && B.frame - this.dashReq.at <= 2 && this.st !== 'crouch') {
      const dr = this.dashReq; this.dashReq = null;
      this.startDash(dr.dir);
      return;
    }
    const dx = this.dirx();
    if (inp & IN.U) { this.jump(dx); return; }
    if (inp & IN.K) { this.st = 'block'; this.crouchBlock = !!(inp & IN.D); this.vx = 0; return; }
    if (inp & IN.D) { this.st = 'crouch'; this.vx = 0; return; }
    if (dx) {
      const fwd = dx === this.face;
      this.st = 'walk'; this.moveDir = dx;
      this.walkPh += 0.19 * (fwd ? 1 : 0.9) * this.def.stats.spd;
      this.vx = dx * this.speed() * (fwd ? 1 : 0.8);
      return;
    }
    this.st = 'idle'; this.vx = 0;
  }

  // Try to start an action from buffered inputs. `minRank` > 0 means we are cancelling out of a move.
  tryActions(minRank) {
    const B = this.B, inp = this.in, m = this.moves;
    const cancel = minRank > 0;
    if (this.hasBuf(IN.S, 4) && this.meter >= 99.9 && (!cancel || this.mi.hit || this.mi.blocked)) {
      if (B.startSuper(this)) { this.eat(IN.S); return true; }
    }
    const o = this.opp;
    const inThrow = !!o && this.grounded && Math.abs(o.x - this.x) < 92 * this.scale && o.grounded && o.hurtable() && o.solid();
    if (!cancel && inThrow && (this.hasBuf(IN.G, 4) || (this.hasBuf(IN.A, 3) && this.hasBuf(IN.B, 3)))) {
      this.eat(IN.A); this.eat(IN.B); this.eat(IN.G); this.startThrow(); return true;
    }
    if (this.hasBuf(IN.G, 4)) this.eat(IN.G);      // grab with nobody in reach: nothing happens
    // Close range: give a second button one frame to arrive so A+B can still form a throw.
    if (!cancel && inThrow) {
      const fresh = (bit) => this.B.frame - (this.pressAt[bit] === undefined ? -99 : this.pressAt[bit]) === 0;
      if ((fresh(IN.A) && !this.hasBuf(IN.B, 1)) || (fresh(IN.B) && !this.hasBuf(IN.A, 1))) return false;
    }
    if (this.hasBuf(IN.C, 6) && this.cd.sp1 <= 0 && this.tm.silence <= 0 && m.sp1 && minRank < 3) {
      this.eat(IN.C); this.startMove(m.sp1, 'sp1'); return true;
    }
    if (this.hasBuf(IN.E, 6) && this.cd.sp2 <= 0 && this.tm.silence <= 0 && m.sp2 && minRank < 3) {
      this.eat(IN.E); this.startMove(m.sp2, 'sp2'); return true;
    }
    const down = !!(inp & IN.D), fwd = this.fwdHeld();
    if (this.hasBuf(IN.B, 5)) {
      const mv = down ? m.DH : fwd ? m.FH : m.H;
      if (mv.rank > minRank) { this.eat(IN.B); this.startMove(mv, down ? 'DH' : fwd ? 'FH' : 'H'); return true; }
    }
    if (this.hasBuf(IN.A, 5)) {
      const mv = down ? m.DL : m.L;
      if (mv.rank > minRank || (mv.rank === minRank && minRank === 1 && this.chain < 2)) {
        this.eat(IN.A); this.startMove(mv, down ? 'DL' : 'L'); return true;
      }
    }
    return false;
  }

  startMove(mv, key) {
    const B = this.B;
    const prev = this.mv, keepChain = prev && this.st === 'attack';
    this.chain = keepChain && prev.rank === mv.rank ? this.chain + 1 : (keepChain ? this.chain : 0);
    this.mv = mv; this.mk = key; this.mt = 0;
    this.mi = { hit: false, blocked: false, hits: {}, armor: this.armorFor(mv, key), spawned: false };
    this.st = 'attack'; this.t = 0;
    if (key === 'sp1' || key === 'sp2') this.cd[key] = mv.cd * (this.mods.cd || 1);
    if (mv.crouch || key === 'DL') this.crouchHit = false;
    if (mv.air) this.airAttacked = true;
    if (mv.onStart) mv.onStart(this, B);
    this.faceOpp();
    if (mv.kind === 'melee') Snd.play(mv.dmg >= 8 ? 'swingH' : 'swing');
  }

  armorFor(mv, key) {
    let a = mv.armor || 0;
    const p = this.passive;
    if (p.armorKeys && p.armorKeys.includes(key)) a = Math.max(a, 1);
    if (this.tm.iron > 0 && mv.rank >= 2) a = Math.max(a, 1);
    return a;
  }

  endMove() {
    this.mv = null; this.mi = null; this.mt = 0; this.t = 0;
    this.st = this.grounded ? 'idle' : 'jump';
    this.chain = 0;
  }

  // ---------- attacks ----------
  updateAttack() {
    const m = this.mv, B = this.B;
    if (!m) { this.st = 'idle'; return; }
    if (m.kind === 'melee') this.meleeTick(m);
    else if (m.tick) m.tick(this, this.mt, B);
    if (this.st !== 'attack' || this.mv !== m) return;      // tick may have changed our state
    if (m.lunge && this.mt >= m.lunge.at && this.mt < m.lunge.at + m.lunge.len) this.vx = this.face * m.lunge.vx;
    if (m.inv && this.mt >= m.inv[0] && this.mt <= m.inv[1]) this.inv = Math.max(this.inv, 1);
    if ((this.mi.hit || this.mi.blocked) && m.cancel !== false && this.mt >= (m.startup || 0) && this.grounded && !m.air) {
      if (this.tryActions(m.rank || 1)) return;
    }
    this.mt++;
    if (this.mt >= m.frames) this.endMove();
  }

  meleeTick(m) {
    const B = this.B, mt = this.mt;
    if (mt === m.startup) { if (m.fx) m.fx(this, B); if (m.dmg >= 8) Fx.speedLines(this.x + this.face * 30, this.y - 100, this.face, 4); }
    if (mt >= m.startup && mt < m.startup + m.active) {
      if (m.hitsAt) {
        m.hitsAt.forEach((fr, i) => { if (fr === mt && !this.mi.hits['h' + i]) this.strike(m.hb, m, 'h' + i); });
      } else if (!this.mi.hit) this.strike(m.hb, m, 'main');
    }
  }

  // Generic hit attempt from an arbitrary hitbox; returns 'miss' | 'hit' | 'block' | 'perfect' | 'armor'.
  strike(hb, info, key = 'k') {
    if (!this.mi || (this.mi.hits[key] && !info.multi)) return 'miss';
    const o = this.opp;
    const box = this.box(hb);
    if (!overlap(box, o.hurtbox())) return 'miss';
    const r = this.B.hit(this, o, info, null, box);
    if (!this.mi) return r;          // a counter (e.g. perfect-block reaction) may have interrupted this move
    if (r !== 'miss') {
      this.mi.hits[key] = (this.mi.hits[key] || 0) + 1;
      if (r === 'hit' || r === 'armor' || r === 'shield') this.mi.hit = true;
      else if (r === 'block' || r === 'perfect') this.mi.blocked = true;
    }
    return r;
  }

  hasArmor() {
    const m = this.mv;
    if (!(this.st === 'attack' && this.mi && this.mi.armor > 0 && m)) return false;
    const until = m.armorUntil !== undefined ? m.armorUntil : (m.kind === 'melee' ? (m.startup || 0) + (m.active || 0) : (m.release || 10) + 8);
    return this.mt < until;
  }

  // ---------- special states ----------
  jump(dx) {
    this.st = 'jump'; this.t = 0; this.grounded = false;
    this.vy = -JUMP_V * (this.def.stats.jump || 1);
    this.vx = dx * 4.4 * Math.min(1.15, this.def.stats.spd) * (this.tm.slow > 0 ? 0.6 : 1);
    this.airAttacked = false;
    this.airJumps = this.passive.airJumps || 0;
    this.spinRot = 0;
    Snd.play('jump');
    Fx.dust(this.x, GROUND, 0, 4);
  }

  updateJump() {
    const dx = this.dirx();
    this.vx = clamp(this.vx + dx * AIR_ACC, -MAX_AIR_VX, MAX_AIR_VX);
    if (!this.airAttacked) {
      if (this.hasBuf(IN.A, 4)) { this.eat(IN.A); this.startMove(this.moves.AL, 'AL'); return; }
      if (this.hasBuf(IN.B, 4)) { this.eat(IN.B); this.startMove(this.moves.AH, 'AH'); return; }
    }
    if (this.airJumps > 0 && this.t > 5 && this.hasBuf(IN.U, 2) && this.pressAt[IN.U] > this.B.frame - this.t) {
      this.airJumps--; this.vy = -JUMP_V * 0.9; this.vx = dx * 4.4; this.eat(IN.U); this.airAttacked = false;
      Fx.ring(this.x, this.y - 20, 8, 46, '#ffffffcc', 14, 4); Snd.play('jump');
    }
  }

  startDash(dir) {
    this.st = 'dash'; this.t = 0; this.moveDir = dir;
    this.dashDir = dir;
    if (dir !== this.face) this.inv = Math.max(this.inv, 5);
    Snd.play('dash');
    Fx.dust(this.x, GROUND, -dir, 5);
  }
  updateDash() {
    const fwd = this.dashDir === this.face;
    const total = fwd ? 16 : 15;
    this.walkPh += 0.5;
    const k = 1 - this.t / total;
    this.vx = this.dashDir * (fwd ? 9.5 : 7.5) * (0.35 + 0.65 * k) * Math.min(1.2, this.def.stats.spd);
    this.trailOn = true;
    if (this.t > 5) {
      if (this.tryActions(0)) { this.vx *= 0.7; return; }
    }
    if (this.t >= total) { this.st = 'idle'; this.t = 0; this.vx *= 0.3; }
  }

  startThrow() {
    this.mv = null; this.mi = { hit: false, blocked: false, hits: {}, armor: 0 };
    this.st = 'throwing'; this.t = 0; this.holder = null;
    this.vx = 0;
    const o = this.opp;
    o.beThrown(this);
    this.held = o;
    Snd.play('swingH');
  }
  updateThrowing() {
    const o = this.held, t = this.t;
    if (!o || o.st !== 'thrown') { this.st = 'idle'; this.held = null; return; }
    this.vx = 0;
    // opponent follows the hands
    const lift = t < 8 ? 0 : t < 24 ? Math.sin(((t - 8) / 16) * Math.PI * 0.5) * 120 : 120 - ((t - 24) / 8) * 120;
    o.x = clamp(this.x + this.face * (t < 24 ? 40 : 40 + (t - 24) * 8), WALL_L, WALL_R);
    o.y = GROUND - lift;
    o.face = -this.face;
    o.thrownSpin = t < 24 ? 0 : (t - 24) * 0.2;
    if (t === 32) {
      o.st = 'hit';    // let Battle resolve the actual damage through the standard pipeline
      this.B.throwLand(this, o);
      this.held = null;
    }
    if (t >= 40) { this.st = 'idle'; this.t = 0; }
  }
  beThrown(by) {
    this.mv = null; this.mi = null; this.st = 'thrown'; this.t = 0; this.holder = by; this.vx = 0; this.vy = 0;
    this.grounded = true; this.crouchHit = false;
  }

  // ---------- physics ----------
  physics() {
    const wasGround = this.grounded;
    if (this.st === 'thrown' || this.st === 'throwing') {
      this.x = clamp(this.x, WALL_L, WALL_R);
      return;
    }
    if (!this.grounded) this.vy += GRAV * (this.gravMul || 1);
    this.x += this.vx;
    this.y += this.vy;
    if (this.y >= GROUND) {
      this.y = GROUND;
      if (!this.grounded || this.vy > 0) this.land(wasGround);
    } else this.grounded = false;

    if (this.grounded) {
      const slide = ['hit', 'blockstun', 'down', 'getup', 'attack', 'stun', 'ko', 'win', 'idle', 'crouch', 'block'].includes(this.st);
      if (slide) this.vx *= (this.st === 'attack' ? 0.8 : 0.84);
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    this.x = clamp(this.x, WALL_L, WALL_R);
  }

  land(wasGround) {
    this.y = GROUND; this.vy = 0; this.grounded = true;
    if (wasGround) return;
    const B = this.B;
    Fx.dust(this.x, GROUND, 0, 5);
    if (this.st === 'jump') {
      this.st = 'idle'; this.t = 0; this.lock = 3; this.vx *= 0.15; Snd.play('land');
    } else if (this.st === 'attack') {
      if (this.mv && this.mv.air) { this.endMove(); this.st = 'idle'; this.lock = 5; this.vx *= 0.15; Snd.play('land'); }
      else if (this.mv && this.mv.landEnd) this.mv.landEnd(this, B);
    } else if (this.st === 'airhit') {
      if (this.hp <= 0 && !this.bounced) {
        this.bounced = true; this.grounded = false; this.vy = -7; this.vx *= 0.6; Fx.shake(9); Snd.play('hitH');
        return;
      }
      this.st = this.hp <= 0 ? 'ko' : 'down'; this.t = 0; this.vx *= 0.4; this.airHits = 0;
      if (this.hp <= 0) this.ko = true;
      Fx.shake(5); Snd.play('land'); Fx.dust(this.x, GROUND, 0, 8);
    }
  }

  // ---------- being hit ----------
  takeHit(info, pushDir, stunF, ko) {
    const wasCrouch = this.st === 'crouch' || ((this.st === 'block' || this.st === 'blockstun') && this.crouchBlock);
    this.mv = null; this.mi = null; this.mt = 0; this.t = 0; this.chain = 0;
    this.crouchHit = wasCrouch && this.grounded && !(info.ky < 0) && !info.knockdown && !ko;
    this.flashT = 4;
    const ky = info.ky || 0;
    if (info.stun && !ko) {
      this.st = 'stun'; this.stunT = info.stun; this.vx = pushDir * (info.kx || 2) * 0.5;
      return;
    }
    const launch = !this.grounded || ky < 0 || info.knockdown || ko;
    if (launch) {
      this.st = 'airhit'; this.grounded = false;
      let vy = ky < 0 ? ky : (info.knockdown ? -6 : (this.grounded ? -5 : -4.5));
      if (ko) vy = -9;
      this.airHits++;
      if (this.airHits > 4 && !ko) vy = Math.max(vy, 0.5);
      this.vy = vy;
      this.vx = pushDir * ((info.kx || 3) * (ko ? 1.7 : 0.9) + (ko ? 2 : 0));
      this.y = Math.min(this.y, GROUND - 1);
    } else {
      this.st = 'hit'; this.stunT = stunF; this.vx = pushDir * (info.kx || 3);
    }
  }

  applyStun(frames) {
    this.mv = null; this.mi = null; this.st = 'stun'; this.stunT = frames; this.t = 0; this.vx = 0;
  }

  // ---------- pose smoothing ----------
  updatePose() {
    const target = poseOf(this);
    const prev = this.pose;
    const snappy = this.st === 'attack' || this.st === 'hit' || this.st === 'airhit' || this.st === 'down' || this.st === 'ko' || this.st === 'thrown' || this.st === 'throwing' || this.st === 'blockstun';
    if (!prev || snappy) { this.pose = target; return; }
    const k = 0.5;
    const P = prev;
    for (const key of ['handF', 'handB', 'footF', 'footB']) {
      P[key][0] = lerp(P[key][0], target[key][0], k); P[key][1] = lerp(P[key][1], target[key][1], k);
    }
    for (const key of ['hx', 'hy', 'lean', 'headX', 'headY', 'headRot', 'rot', 'rotX', 'rotY', 'sx', 'sy']) P[key] = lerp(P[key], target[key], k);
    P.eyes = target.eyes; P.mouth = target.mouth; P.prop = target.prop; P.propAng = target.propAng; P.glow = target.glow; P.dizzy = target.dizzy; P.finger = target.finger;
    this.pose = P;
  }
}

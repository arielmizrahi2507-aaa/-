// ===== CPU brain =====
// Reads the same public state a human sees (positions, opponent move frames, incoming projectiles) and emits an input mask.
class Brain {
  constructor(level = 0.5, seed) {
    this.lv = clamp(level, 0, 1);
    this.react = Math.round(lerp(22, 5, this.lv));
    this.blockP = lerp(0.22, 0.84, this.lv);
    this.aggr = lerp(0.3, 0.9, this.lv);
    this.specP = lerp(0.3, 0.9, this.lv);
    this.comboP = lerp(0.25, 0.9, this.lv);
    this.punishP = lerp(0.1, 0.75, this.lv);
    this.q = [];
    this.plan = 'wait'; this.planUntil = 0;
    this.blockUntil = -1; this.blockMask = 0;
    this.threatKey = ''; this.willBlock = false; this.reactAt = 0;
    this.think = 0;
    this.rand = mulberry32(seed || ((Math.random() * 1e9) | 0));
  }

  R() { return this.rand(); }
  push(m, n = 1) { this.q.push({ m, n }); }

  ctrl(f, B) {
    const o = f.opp, fr = B.frame;
    const dx = o.x - f.x, dist = Math.abs(dx);
    const tw = dx > 0 ? IN.R : IN.L, aw = dx > 0 ? IN.L : IN.R;

    // states in which nothing can be done; keep holding block through block-stun
    if (f.st === 'blockstun') return IN.K | (f.crouchBlock ? IN.D : 0);
    if (['hit', 'airhit', 'down', 'getup', 'ko', 'stun', 'thrown', 'throwing', 'win'].includes(f.st)) { this.q.length = 0; return 0; }

    if (this.q.length) {
      const a = this.q[0];
      if (--a.n <= 0) this.q.shift();
      return a.m;
    }

    const style = Brain.forceStyle || f.def.ai.style;
    const space = Brain.forceStyle ? 200 : f.def.ai.space;

    // ---------- defense ----------
    const th = this.threat(f, B, o, dist);
    if (th) {
      if (this.threatKey !== th.key) {
        this.threatKey = th.key;
        this.willBlock = this.R() < this.blockP;
        this.reactAt = fr + Math.max(0, this.react - th.head);
      }
      if (this.willBlock && fr >= this.reactAt) {
        if (th.kind === 'proj' && this.R() < 0.25 && f.grounded) { this.push(IN.U | aw, 1); return 0; }
        this.blockUntil = fr + 9;
        this.blockMask = IN.K | (th.low ? IN.D : 0);
      }
    }
    if (fr < this.blockUntil && f.grounded && f.st !== 'attack') return this.blockMask;

    // ---------- opportunities ----------
    // punish a whiffed or blocked attack
    if (o.st === 'attack' && o.mv && o.mv.kind === 'melee' && o.mt >= o.mv.startup + o.mv.active - 1 && dist < 190 && this.R() < this.punishP * 0.35) {
      return this.attack(f, B, dist, tw, aw, true);
    }
    // anti-air
    if (!o.grounded && o.vy > -2 && dist < 150 && f.grounded && this.R() < 0.5 * this.aggr + 0.2) {
      if (f.moves.DH && this.R() < 0.55) { this.push(IN.D | IN.B, 2); return IN.D; }
      this.blockUntil = fr + 12; this.blockMask = IN.K; return IN.K;
    }
    // airborne: throw a jump-in attack when close
    if (f.st === 'jump' && !f.airAttacked && dist < 170) { if (this.R() < 0.1) return this.R() < 0.5 ? IN.A : IN.B; }
    if (f.st === 'jump') return this.R() < 0.7 ? tw : 0;

    // follow-ups after a hit/block (chain cancels)
    if (f.st === 'attack' && f.mi && (f.mi.hit || f.mi.blocked) && this.R() < this.comboP * 0.5) {
      return this.followUp(f, B, dist);
    }
    if (f.st === 'attack') return 0;

    // super
    if (f.meter >= 99.9 && f.moves.sup) {
      const a = f.moves.sup.ai || {};
      const inRange = dist >= (a.min || 0) && dist <= (a.max || 900);
      const comboing = ['hit', 'airhit', 'stun'].includes(o.st);
      if (inRange && (comboing || o.st === 'down' || this.R() < 0.02 + 0.02 * this.lv)) { return IN.S; }
    }

    // ---------- planning ----------
    if (fr >= this.planUntil) this.pickPlan(f, B, dist, style, space);
    let mv = 0;
    const want = this.plan;
    const atWall = f.x < WALL_L + 60 || f.x > WALL_R - 60;

    // decide to attack now?
    if (fr >= this.think) {
      this.think = fr + Math.round(lerp(14, 5, this.aggr) + this.R() * 6);
      const m = this.specials(f, B, dist, o);
      if (m) return m;
      const inPoke = dist < 230;
      if (inPoke && this.R() < this.aggr * (style === 'zone' ? 0.55 : 0.9)) return this.attack(f, B, dist, tw, aw, false);
      if (dist < 105 && atWall && this.R() < 0.3) { this.push(IN.U | aw, 1); return 0; }
    }

    if (want === 'approach') {
      mv = tw;
      if (dist > 260 && this.R() < 0.02 + this.aggr * 0.02 && f.grounded) { this.push(tw, 1); this.push(0, 2); this.push(tw, 12); return 0; }
      if (dist > 150 && this.R() < 0.008 + 0.006 * this.aggr) { this.push(IN.U | tw, 1); return 0; }
    } else if (want === 'retreat') {
      mv = aw;
      if (atWall) { this.push(IN.U | tw, 1); this.plan = 'approach'; this.planUntil = fr + 20; }
    } else if (want === 'block') {
      this.blockUntil = fr + 6; this.blockMask = IN.K | (this.R() < 0.2 ? IN.D : 0); return this.blockMask;
    } else if (want === 'crouch') {
      return IN.D;
    }
    return mv;
  }

  pickPlan(f, B, dist, style, space) {
    const fr = B.frame, r = this.R();
    let plan;
    if (dist > space + 100) plan = r < 0.85 ? 'approach' : 'wait';
    else if (style === 'zone' && dist < space - 80) plan = r < 0.6 ? 'retreat' : (r < 0.8 ? 'approach' : 'wait');
    else if (style === 'rush') plan = dist > 120 ? 'approach' : (r < 0.75 ? 'approach' : 'block');
    else if (style === 'tank') plan = r < 0.55 ? 'approach' : (r < 0.75 ? 'block' : 'wait');
    else plan = r < 0.4 ? 'approach' : (r < 0.5 ? 'retreat' : r < 0.65 ? 'block' : r < 0.75 ? 'crouch' : 'wait');
    this.plan = plan;
    this.planUntil = fr + 10 + Math.floor(this.R() * 28);
  }

  // Estimate whether something is about to hit us. Returns { key, kind, low, head } or null.
  threat(f, B, o, dist) {
    if (o.st === 'attack' && o.mv) {
      const m = o.mv;
      if (m.kind === 'melee') {
        const reach = (m.hb[0] + m.hb[2]) * o.scale + 30;
        const untilHit = m.startup - o.mt;
        if (dist <= reach + 24 && untilHit <= 12 && untilHit >= -m.active) {
          return { key: 'm' + o.mk + ':' + (B.frame - o.mt), kind: 'melee', low: m.height === 'low', head: Math.max(0, 12 - untilHit) > 8 ? 8 : 0 };
        }
      } else if (dist < 340 && o.mt < (m.release || 12) + 14 && m.kind === 'special' && (m.ai && (m.ai.kind === 'close' || m.ai.kind === 'gap'))) {
        return { key: 's' + o.mk + ':' + (B.frame - o.mt), kind: 'special', low: false, head: 0 };
      }
    }
    if (o.st === 'throwing') return null;
    for (const e of B.ents) {
      if (e.owner !== o || e.dmg <= 0 || e.noHit || e.delay > 0) continue;
      const rel = e.x - f.x;
      const closing = e.vx !== 0 ? (Math.sign(e.vx) !== Math.sign(rel)) : false;
      if (closing && Math.abs(rel) < 240 + Math.abs(e.vx) * 4 && Math.abs(e.y - (f.y - 80)) < 120) {
        return { key: 'p' + (e.id || (e.id = ++Brain.uid)), kind: 'proj', low: e.height === 'low', head: 4 };
      }
    }
    return null;
  }

  specials(f, B, dist, o) {
    if (f.tm.silence > 0) return 0;
    const fr = B.frame;
    const cand = [];
    for (const [slot, bit] of [['sp1', IN.C], ['sp2', IN.E]]) {
      const m = f.moves[slot];
      if (!m || f.cd[slot] > 0) continue;
      const a = m.ai || {};
      let ok = dist >= (a.min || 0) && dist <= (a.max || 900);
      if (a.kind === 'buff') ok = dist > 180 && !['hit'].includes(o.st) && (f.tm.iron <= 0) && f.val.shield <= 0;
      if (a.kind === 'trap') ok = ok && o.grounded && this.R() < 0.7;
      if (a.kind === 'gap') ok = ok && o.st !== 'attack';
      if (ok) cand.push(bit);
    }
    if (!cand.length) return 0;
    if (this.R() > this.specP * 0.55) return 0;
    return pick(cand);
  }

  attack(f, B, dist, tw, aw, punish) {
    const m = f.moves, r = this.R();
    const o = f.opp;
    // opponent is turtling: throw, overhead or low
    if ((o.st === 'block' || o.st === 'blockstun') && dist < 130 && !punish) {
      if (dist < 86 && r < 0.34) return IN.A | IN.B;
      if (r < 0.62) { if (o.crouchBlock) { this.push(tw | IN.B, 2); return tw; } this.push(IN.D | IN.A, 2); return IN.D; }
      return IN.A;
    }
    if (dist < 82 && o.grounded && r < 0.14 && !punish) return IN.A | IN.B;   // throw
    if (dist < 95) {
      if (r < 0.58) return IN.A;
      if (r < 0.72) return IN.B;
      if (r < 0.8) { this.push(IN.D | IN.A, 2); return IN.D; }
      if (r < 0.9) { this.push(tw | IN.B, 2); return tw; }
      return IN.A;
    }
    if (dist < 160) {
      if (r < 0.34) return IN.B;
      if (r < 0.62) return IN.A;
      if (r < 0.78) { this.push(IN.D | IN.A, 2); return IN.D; }
      if (r < 0.9) { this.push(tw | IN.B, 2); return tw; }
      return IN.B;
    }
    if (r < 0.5) { this.push(tw | IN.B, 2); return tw; }
    if (r < 0.7) { this.push(tw, 1); this.push(0, 2); this.push(tw, 8); return 0; }
    return tw;
  }

  followUp(f, B, dist) {
    const m = f.mv, r = this.R();
    if (!m) return 0;
    const rank = m.rank || 1;
    if (rank <= 2 && f.meter >= 99.9 && f.moves.sup && this.R() < 0.5) return IN.S;
    if (rank <= 2 && this.R() < this.specP) {
      for (const [slot, bit] of [['sp1', IN.C], ['sp2', IN.E]]) {
        const sm = f.moves[slot];
        if (sm && f.cd[slot] <= 0 && f.tm.silence <= 0 && sm.ai && sm.ai.kind !== 'buff' && sm.ai.kind !== 'trap') return bit;
      }
    }
    if (rank === 1) return r < 0.5 ? IN.B : IN.A;
    return 0;
  }
}
Brain.uid = 0;

// Convenience factory used by the game modes
function makeCtrl(level, seed) {
  const brain = new Brain(level, seed);
  const fn = (f, B) => brain.ctrl(f, B);
  fn.brain = brain;
  return fn;
}

// ===== Battle: one match (rounds, entities, hit resolution, camera, cinematics) =====
const MAX_SEP = 800;
const THROW_INFO = { dmg: 11, hitstun: 30, blockstun: 0, kx: 6, ky: -5, knockdown: true, unblockable: true, hitstop: 10, isThrow: true, height: 'mid', chip: 0, rank: 0 };

class Battle {
  constructor(cfg) {
    this.cfg = cfg;
    this.stage = STAGES.find((s) => s.id === cfg.stage) || STAGES[0];
    this.rng = mulberry32(cfg.seed || ((Math.random() * 2147483647) | 0));
    this.frame = 0;
    this.f = cfg.fighters;
    this.f[0].B = this; this.f[1].B = this;
    this.f[0].opp = this.f[1]; this.f[1].opp = this.f[0];
    this.ents = [];
    this.combo = [{ hits: 0, dmg: 0, last: -999, show: 0 }, { hits: 0, dmg: 0, last: -999, show: 0 }];
    this.rtw = cfg.rounds || 2;
    this.round = 1;
    this.wins = [0, 0];
    this.timeMax = (cfg.time || 60) * 60;
    this.timeLeft = this.timeMax;
    this.cam = { x: STAGE_W / 2, zoom: 1.0 };
    this.timeScale = 1;
    this.slowT = 0;
    this.cine = null;
    this.paused = false;
    this.announce = null;
    this.toasty = 0;
    this.over = false;
    this.roundWinner = -1;
    this.stats = { maxCombo: 0, supers: 0, perfects: 0, flawless: false, hitsLanded: [0, 0] };
    this.dmgGhost = [1, 1];
    this.startRound(true);
  }

  get training() { return !!this.cfg.training; }
  emit(name, a, b, c, d, e) { if (this.cfg.onEvent) this.cfg.onEvent(name, a, b, c, d, e); }
  say(text, o = {}) { this.announce = { text, t: 0, max: o.life || 60, col: o.col || '#ffffff', size: o.size || 92 }; }

  startRound(first) {
    this.ents.length = 0;
    Fx.reset();
    this.f.forEach((f) => { f.reset(first); });
    this.f.forEach((f) => { if (f.passive.roundStart) f.passive.roundStart(f, this); });
    this.phase = 'intro'; this.phaseT = 0;
    this.timeLeft = this.timeMax;
    this.roundWinner = -1;
    this.slowT = 0; this.timeScale = 1;
    this.combo.forEach((c) => { c.hits = 0; c.dmg = 0; c.show = 0; c.last = -999; });
    this.dmgGhost = [1, 1];
    this.cam.x = STAGE_W / 2; this.cam.zoom = 1.05;
    this.say(this.cfg.attract ? '' : (this.rtw > 2 && this.wins[0] === this.rtw - 1 && this.wins[1] === this.rtw - 1 ? 'סיבוב מכריע' : 'סיבוב ' + this.round), { life: 62, size: 84 });
    if (!this.cfg.attract) Snd.play('round');
    this.emit('roundStart', this.round);
  }

  // ----- main step -----
  update() {
    if (this.paused) return;
    this.frame++; this.phaseT++;
    if (this.announce && ++this.announce.t >= this.announce.max) this.announce = null;
    if (this.toasty > 0) this.toasty--;
    if (this.cine) { this.updateCine(); Fx.update(); this.updateCamera(); return; }

    switch (this.phase) {
      case 'intro':
        if (this.phaseT >= 64) {
          this.phase = 'fight'; this.phaseT = 0;
          if (!this.cfg.attract) { this.say('!קרב', { life: 46, col: '#ffe14a', size: 110 }); Snd.play('fight'); }
        }
        break;
      case 'fight':
        if (!this.training) {
          this.timeLeft--;
          if (this.timeLeft <= 0) this.timeUp();
        }
        break;
      case 'ko': case 'timeup':
        if (this.phaseT > (this.phase === 'ko' ? 110 : 90)) this.endRound();
        break;
      case 'roundend':
        if (this.phaseT > 130) this.nextRound();
        break;
      case 'matchend':
        if (this.phaseT > 170 && !this.over) { this.over = true; this.emit('matchEnd', this.matchWinner); }
        break;
    }

    const order = this.frame % 2 ? [0, 1] : [1, 0];
    for (const i of order) this.f[i].update();
    this.updateEnts();
    this.separate();
    this.updateCombos();
    Fx.update();
    this.updateCamera();

    if (this.slowT > 0 && --this.slowT === 0) this.timeScale = 1;
    if (this.training) {
      for (const f of this.f) { if (f.hp < f.maxHp * 0.36 && f.hp > 0) f.hp = f.maxHp; if (this.cfg.infMeter) f.meter = 100; }
    }
  }

  updateCombos() {
    for (const c of this.combo) {
      if (c.hits > 0 && this.frame - c.last > 60) {
        if (c.hits >= 2) this.emit('comboEnd', c);
        c.hits = 0; c.dmg = 0;
      }
      if (c.show > 0) c.show--;
    }
    const gh = this.dmgGhost;
    this.f.forEach((f, i) => {
      const cur = f.hp / f.maxHp;
      if (gh[i] > cur) gh[i] = Math.max(cur, gh[i] - 0.004); else gh[i] = cur;
    });
  }

  updateCamera() {
    const a = this.f[0], b = this.f[1];
    const minZ = Battle.minZoom || 1;
    let tx = (a.x + b.x) / 2, tz = clamp(W / (Math.abs(a.x - b.x) + 480), minZ, Math.max(1.26, minZ));
    if (this.cine) {
      const o = this.cine.f;
      tx = o.x + o.face * 40; tz = 1.42;
    }
    if (this.cfg.attract) tz = clamp(tz, 1.0, 1.1);
    if (this.cfg.zoom) tz = this.cfg.zoom;
    this.cam.x = lerp(this.cam.x, tx, this.cine ? 0.2 : 0.14);
    this.cam.zoom = lerp(this.cam.zoom, tz, this.cine ? 0.14 : 0.1);
    const half = W / 2 / this.cam.zoom;
    this.cam.x = clamp(this.cam.x, half, STAGE_W - half);
  }

  separate() {
    const [a, b] = this.f;
    if (a.solid() && b.solid() && !a.noPush && !b.noPush) {
      const dy = Math.abs(a.y - b.y);
      const airA = !a.grounded, airB = !b.grounded;
      const overHead = (airA && a.y < b.y - 120) || (airB && b.y < a.y - 120);
      if (!overHead && dy < 110) {
        const need = (a.pw + b.pw) / 2 - Math.abs(a.x - b.x);
        if (need > 0) {
          const dir = a.x < b.x ? -1 : (a.x > b.x ? 1 : (a.slot === 0 ? -1 : 1));
          let pa = dir * need / 2, pb = -dir * need / 2;
          const na = a.x + pa, nb = b.x + pb;
          if (na < WALL_L) { pb -= (WALL_L - na); pa = WALL_L - a.x; }
          if (na > WALL_R) { pb += (na - WALL_R); pa = WALL_R - a.x; }
          if (nb < WALL_L) { pa -= (WALL_L - nb); pb = WALL_L - b.x; }
          if (nb > WALL_R) { pa += (nb - WALL_R); pb = WALL_R - b.x; }
          a.x = clamp(a.x + pa, WALL_L, WALL_R); b.x = clamp(b.x + pb, WALL_L, WALL_R);
        }
      }
    }
    // keep both inside the same screen
    const gap = Math.abs(a.x - b.x) - Math.min(MAX_SEP, W / (Battle.minZoom || 1) - 170);
    if (gap > 0) {
      const s = a.x < b.x ? 1 : -1;
      a.x += s * gap / 2; b.x -= s * gap / 2;
      if (a.vx * s < 0) a.vx *= 0.5;
      if (b.vx * -s < 0) b.vx *= 0.5;
    }
  }

  // ----- entities (projectiles, traps, minions) -----
  ent(c) {
    const e = Object.assign({
      kind: 'bubble', t: 0, life: 120, x: 0, y: 0, vx: 0, vy: 0, g: 0, w: 40, h: 40, dmg: 6, hitstun: 20, blockstun: 12,
      kx: 5, ky: 0, knockdown: false, height: 'mid', pierce: false, maxHits: 1, hits: 0, interval: 9, nextHit: 0, chip: 0.2,
      isProj: true, clash: true, dur: 1, power: 1, sc: 1, dead: false, dir: 1, z: 1, hitstop: 6, delay: 0,
    }, c);
    e.srcKey = e.owner ? e.owner.mk : '';
    this.ents.push(e);
    return e;
  }
  // projectile relative to its owner (ox/oy offsets, vx along owner's facing)
  proj(owner, c) {
    const dir = owner.face;
    const e = this.ent(Object.assign({ owner, dir }, c));
    e.x = owner.x + dir * (c.ox || 0); e.y = owner.y + (c.oy || 0);
    e.vx = dir * (c.vx || 0);
    if (c.rot !== undefined) e.rot = c.rot;
    return e;
  }

  updateEnts() {
    const list = this.ents;
    for (const e of list) {
      if (e.dead) continue;
      if (e.delay > 0) { e.delay--; continue; }
      e.t++;
      if (e.onTick) e.onTick(e, this);
      if (e.home && e.owner.opp) {
        const o = e.owner.opp, ty = o.y - 90;
        e.vy += clamp((ty - e.y) * e.home, -0.6, 0.6);
        e.vy = clamp(e.vy, -e.homeMax || -4, e.homeMax || 4);
      }
      if (e.wave) e.y += Math.sin(e.t * e.wave.f) * e.wave.a;
      e.vy += e.g; e.x += e.vx; e.y += e.vy;
      if (e.bounce !== undefined && e.y + e.h / 2 >= GROUND && e.vy > 0) {
        e.y = GROUND - e.h / 2; e.vy = -e.vy * e.bounce; e.bounces = (e.bounces || 0) + 1;
        if (Math.abs(e.vy) < 2) e.vy = 0;
        Fx.dust(e.x, GROUND, 0, 3);
        if (e.onBounce) e.onBounce(e, this);
      }
      if (e.ground && e.y + e.h / 2 >= GROUND) {
        e.y = GROUND - e.h / 2; e.vy = 0;
        if (!e.landed) { e.landed = true; if (e.onLand) e.onLand(e, this); }
      }
      if (e.dmg > 0 && !e.noHit && this.frame >= e.nextHit && (this.phase === 'fight')) {
        const opp = e.owner.opp;
        const box = { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
        if (overlap(box, opp.hurtbox())) {
          const r = this.hit(e.owner, opp, e, e, box);
          if (r !== 'miss' && r !== 'reflect') {
            e.hits++; e.nextHit = this.frame + e.interval;
            if (e.onHit) e.onHit(e, opp, r, this);
            if (!e.pierce && e.hits >= e.maxHits) e.dead = true;
          }
        }
      }
      if (--e.life <= 0) { e.dead = true; if (e.onExpire) e.onExpire(e, this); }
      if (e.x < -300 || e.x > STAGE_W + 300 || e.y > GROUND + 200 || e.y < -900) e.dead = true;
    }
    // projectile clashes
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || !a.isProj || !a.clash || a.dmg <= 0 || a.delay > 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || !b.isProj || !b.clash || b.dmg <= 0 || b.owner === a.owner || b.delay > 0) continue;
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) {
          const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
          Fx.burst(px, py, { r: 44, col: '#fff', col2: '#8be9ff', life: 10 }); Fx.sparks(px, py, 8, '#fff', 7);
          Snd.play('block');
          a.dur -= b.power; b.dur -= a.power;
          if (a.dur <= 0) a.dead = true;
          if (b.dur <= 0) b.dead = true;
        }
      }
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }

  // ----- hit resolution -----
  hit(att, def, info, src, box) {
    if (!(this.phase === 'fight') || !def.hurtable()) return 'miss';
    const dmgBase = info.dmg || 0;
    let pushDir = info.pushDir;
    if (pushDir === undefined) {
      if (src && Math.abs(src.vx) > 0.5) pushDir = sgn(src.vx);
      else pushDir = (def.x >= (src ? src.x : att.x)) ? 1 : -1;
    }
    const fromX = src ? src.x : att.x;
    const attackFrom = fromX >= def.x ? 1 : -1;

    // reflect (Tibi-style passive)
    if (src && def.passive.reflect && (def.st === 'block' || def.st === 'blockstun') && src.reflectable !== false && src.isProj && attackFrom === def.face) {
      src.owner = def; src.vx = -src.vx * 1.15; src.dir = -src.dir; src.hits = 0; src.nextHit = this.frame + 6; src.life = Math.max(src.life, 80);
      Fx.burst(src.x, src.y, { r: 46, col: '#fff', col2: '#ffe14a', life: 10 }); Snd.play('perfect');
      Fx.text(def.x, def.y - 200, '!החזרה', { size: 24, col: '#ffe14a' });
      return 'reflect';
    }

    // guard
    let guard = 'no';
    if (!info.unblockable && (def.st === 'block' || def.st === 'blockstun') && def.grounded && attackFrom === def.face) {
      const h = info.height || 'mid';
      if (h === 'low' && !def.crouchBlock) guard = 'wrong';
      else if (h === 'high' && def.crouchBlock) guard = 'wrong';
      else guard = 'yes';
    }
    const [cx, cy] = this.contact(def, box, pushDir);

    if (guard === 'yes') return this.blocked(att, def, info, src, pushDir, cx, cy);

    if (def.hasArmor() && !info.isThrow) return this.armored(att, def, info, src, pushDir, cx, cy);

    // ----- clean hit -----
    const cb = this.combo[att.slot];
    const continuing = ['hit', 'airhit', 'stun'].includes(def.st);
    if (!continuing) { cb.hits = 0; cb.dmg = 0; }
    cb.hits++;
    const n = cb.hits;
    const scale = Math.max(info.isSuper ? 0.55 : 0.3, 1 - 0.1 * Math.max(0, n - 2));
    const counter = def.st === 'attack' && def.mv && def.mt < (def.mv.startup || 6) && !continuing;
    let dmg = dmgBase * att.dmgMul(info) * scale * (counter ? 1.25 : 1) * def.takenMul(info);
    if (info.dmgFn) dmg = info.dmgFn(att, def, dmg, this);

    // shield (absorbs damage entirely while it lasts)
    if (def.val.shield > 0 && dmg > 0) {
      const ab = Math.min(def.val.shield, dmg);
      def.val.shield -= ab; dmg -= ab;
      Fx.burst(cx, cy, { r: 40, col: '#fff7c2', col2: '#ffd94a', life: 10 }); Snd.play('armor');
      if (dmg <= 0.01) { def.hitstop = 5; return 'shield'; }
    }

    let saved = false;
    if (def.hp - dmg <= 0) {
      if (def.passive.survive && def.passive.survive(def, dmg, this)) { dmg = def.hp - 1; saved = true; }
      else if (def.mods.saveOnce && !def.pv.savedOnce) { def.pv.savedOnce = true; dmg = def.hp - 1; saved = true; Fx.text(def.x, def.y - 210, '!חוק ההצלה', { size: 26, col: '#7dff9a' }); }
    }
    def.hp = Math.max(0, def.hp - dmg);
    const ko = def.hp <= 0;
    def.tookDamage = true;
    cb.dmg += dmg; cb.last = this.frame; cb.show = 100;
    this.stats.hitsLanded[att.slot]++;
    if (n > this.stats.maxCombo && att.slot === 0) this.stats.maxCombo = n;

    att.gain(dmg * 0.9 + 2);
    def.gain(dmg * 0.55);
    if (att.mods.lifesteal) att.heal(dmg * att.mods.lifesteal, false);

    const stunF = Math.max(8, (info.hitstun || 16) - Math.max(0, n - 3) * 1.5 + (counter ? 4 : 0));
    def.takeHit(info, pushDir, stunF, ko);
    if (info.slow) def.tm.slow = Math.max(def.tm.slow, info.slow);
    if (info.silence) def.tm.silence = Math.max(def.tm.silence, info.silence);
    if (info.meterDrain) { def.meter = Math.max(0, def.meter - info.meterDrain); }
    if (info.pull !== undefined) def.x = clamp(att.x + att.face * info.pull, WALL_L, WALL_R);

    // hit-stop
    const hs = info.hitstop !== undefined ? info.hitstop : (dmg < 6 ? 5 : dmg < 12 ? 8 : 11);
    if (src) def.hitstop = Math.max(def.hitstop, Math.round(hs * 0.7));
    else { att.hitstop = hs; def.hitstop = hs; }

    // wall pushback onto attacker
    const atWall = def.x <= WALL_L + 6 || def.x >= WALL_R - 6;
    if (atWall && !src && !info.isThrow && att.grounded) att.vx = -pushDir * Math.min(8, (info.kx || 3) * 1.1);

    // feedback
    const big = dmg >= 12 || info.isSuper;
    Fx.burst(cx, cy, { r: big ? 78 : dmg >= 7 ? 58 : 42, col: counter ? '#ffd0d0' : '#ffffff', col2: counter ? '#ff5a5a' : (att.def.color || '#ffe14a'), life: big ? 14 : 10, spikes: big ? 11 : 8 });
    Fx.sparks(cx, cy, big ? 14 : 8, counter ? '#ff8a8a' : '#fff7c2', big ? 10 : 7);
    if (dmg >= 8) Fx.paper(cx, cy, big ? 8 : 4, pushDir);
    Fx.text(cx + pushDir * 10, cy - 46, String(Math.ceil(dmg)), { size: 18 + Math.min(dmg, 22) * 0.7, col: counter ? '#ff8a8a' : '#ffe14a', life: 34, vy: -1.3 });
    if (counter) Fx.text(cx, cy - 78, '!קאונטר', { size: 22, col: '#ff8a8a', life: 30 });
    if (dmg >= 10) Fx.comic(cx, cy);
    Fx.shake(Math.min(14, 2 + dmg * 0.55)); if (big) { Fx.punch = 3; Fx.flash('#ffffff', 0.25); }
    Snd.play(info.isSuper ? 'superHit' : dmg < 5 ? 'hitL' : dmg < 10 ? 'hitM' : 'hitH');
    if (!this.cfg.attract && info.key === 'DH' && this.rng() < 0.1) { this.toasty = 70; Snd.play('toasty'); }

    if (att.passive.onDealt) att.passive.onDealt(att, def, info, dmg, this);
    if (def.passive.onTaken) def.passive.onTaken(def, att, info, dmg, this);
    if (info.onHit) info.onHit(att, def, this, src);
    if (saved && def.passive.onSaved) def.passive.onSaved(def, this);
    this.emit('hit', att, def, info, dmg, src ? (src.srcKey || 'proj') : (att.mk || 'x'));
    if (n >= 3 && att.slot === 0) this.emit('combo', att, n, cb.dmg);

    if (ko) this.koHit(att, def, pushDir);
    return 'hit';
  }

  contact(def, box, pushDir) {
    const hb = def.hurtbox();
    if (box) {
      const x0 = Math.max(box.x, hb.x), x1 = Math.min(box.x + box.w, hb.x + hb.w);
      const y0 = Math.max(box.y, hb.y), y1 = Math.min(box.y + box.h, hb.y + hb.h);
      return [(x0 + x1) / 2, (y0 + y1) / 2];
    }
    return [def.x - pushDir * 20, def.y - 100];
  }

  blocked(att, def, info, src, pushDir, cx, cy) {
    const perfect = def.st === 'block' && this.frame - (def.pressAt[IN.K] === undefined ? -99 : def.pressAt[IN.K]) <= 6;
    const chipFrac = info.chip !== undefined ? info.chip : (info.isSuper ? 0.3 : 0);
    let chip = perfect ? 0 : (info.dmg || 0) * chipFrac * att.dmgMul(info) * def.takenMul(info);
    if (chip > 0) def.hp = Math.max(1, def.hp - chip);
    def.st = 'blockstun'; def.stunT = Math.max(6, (info.blockstun || 10) - (perfect ? 3 : 0)); def.t = 0;
    def.vx = pushDir * (perfect ? 0.8 : Math.min(6.5, 1.6 + (info.kx || 3) * 0.55));
    if (src) def.hitstop = perfect ? 6 : 3;
    else if (perfect) { att.hitstop = 14; def.hitstop = 0; def.stunT = 3; }
    else { att.hitstop = 4; def.hitstop = 4; }
    const atWall = def.x <= WALL_L + 6 || def.x >= WALL_R - 6;
    if (atWall && !src && att.grounded) att.vx = -pushDir * 3.5;
    def.gain(perfect ? 12 : 4 + (info.dmg || 0) * 0.3); att.gain(2);
    if (perfect) {
      this.stats.perfects += def.slot === 0 ? 1 : 0;
      Fx.burst(cx, cy, { r: 64, col: '#ffffff', col2: '#66ddff', life: 12 });
      Fx.ring(cx, cy, 10, 70, '#8be9ff', 14, 5);
      Fx.text(def.x, def.y - 205, '!בלוק מושלם', { size: 24, col: '#8be9ff', life: 40 });
      Snd.play('perfect'); Fx.flash('#aeeaff', 0.12);
      if (def.passive.onPerfect) def.passive.onPerfect(def, att, info, this);
    } else {
      Fx.burst(cx, cy, { r: 34, col: '#dff6ff', col2: '#7fd0ff', life: 8, spikes: 7 });
      Fx.sparks(cx, cy, 5, '#bfe9ff', 5);
      Snd.play('block');
    }
    if (def.passive.onBlock) def.passive.onBlock(def, att, info, perfect, this);
    if (info.onBlocked) info.onBlocked(att, def, this, src);
    this.emit('block', att, def, perfect);
    return perfect ? 'perfect' : 'block';
  }

  armored(att, def, info, src, pushDir, cx, cy) {
    def.mi.armor--;
    let dmg = (info.dmg || 0) * att.dmgMul(info) * def.takenMul(info) * 0.75;
    def.hp = Math.max(1, def.hp - dmg);
    def.tookDamage = true;
    att.gain(dmg * 0.6); def.gain(dmg * 0.5);
    if (src) def.hitstop = 3; else { att.hitstop = 6; def.hitstop = 6; }
    def.flashT = 3;
    Fx.burst(cx, cy, { r: 44, col: '#fff7c2', col2: '#ffb020', life: 9 });
    Fx.sparks(cx, cy, 8, '#ffd94a', 6);
    Fx.text(def.x, def.y - 205, '!שריון', { size: 20, col: '#ffd94a', life: 30 });
    Snd.play('armor');
    const cb = this.combo[att.slot]; cb.hits = 0;
    if (att.passive.onDealt) att.passive.onDealt(att, def, info, dmg, this);
    return 'armor';
  }

  throwLand(att, def) {
    const info = Object.assign({}, THROW_INFO, { dmg: (att.def.throwDmg || THROW_INFO.dmg) });
    def.st = 'idle';
    const r = this.hit(att, def, info, null, null);
    if (r === 'miss') { def.st = 'idle'; def.grounded = true; def.y = GROUND; }
    Fx.shake(10); Fx.dust(def.x, GROUND, 0, 10);
  }

  koHit(att, def, pushDir) {
    this.phase = 'ko'; this.phaseT = 0;
    this.roundWinner = att.slot;
    this.timeScale = 0.3; this.slowT = 70;
    Fx.flash('#ffffff', 0.75); Fx.shake(16); Fx.punch = 5;
    Snd.play('ko');
    this.say('!נפילה', { life: 100, col: '#ff5a5a', size: 120 });
    this.ents.forEach((e) => { if (e.owner === def) e.dead = true; });
    this.emit('ko', att, def);
  }

  timeUp() {
    const [a, b] = this.f;
    const pa = a.hp / a.maxHp, pb = b.hp / b.maxHp;
    this.phase = 'timeup'; this.phaseT = 0;
    this.roundWinner = Math.abs(pa - pb) < 0.001 ? -1 : (pa > pb ? 0 : 1);
    this.say('!נגמר הזמן', { life: 80, col: '#ffe14a', size: 96 });
    Snd.play('round');
    this.emit('timeUp', this.roundWinner);
  }

  endRound() {
    const w = this.roundWinner;
    if (w >= 0) this.wins[w]++;
    else { this.wins[0]++; this.wins[1]++; if (this.wins[0] >= this.rtw && this.wins[1] >= this.rtw) this.rtw++; }
    this.f.forEach((f, i) => {
      f.vx = 0;
      if (w === i || w < 0) { if (f.grounded && f.hp > 0) { f.st = 'win'; f.t = 0; f.mv = null; } }
    });
    if (w >= 0) {
      const loser = this.f[1 - w];
      if (loser.hp > 0 && loser.grounded && !['ko', 'down'].includes(loser.st)) { loser.st = 'idle'; }
      if (!this.f[w].tookDamage) this.stats.flawless = w === 0 ? true : this.stats.flawless;
    }
    this.phase = 'roundend'; this.phaseT = 0;
    if (w >= 0 && !this.cfg.attract) {
      this.say('סיבוב ל' + this.f[w].def.short, { life: 100, col: '#ffe14a', size: 50 });
      Snd.play('win');
    }
    Fx.confetti(this.f[Math.max(0, w)].x, GROUND - 120, w >= 0 ? 40 : 0, 8);
    this.emit('roundEnd', w);
    const done = this.wins.some((x) => x >= this.rtw);
    if (done) {
      const mw = this.wins[0] >= this.rtw && this.wins[1] >= this.rtw ? (this.wins[0] === this.wins[1] ? w : (this.wins[0] > this.wins[1] ? 0 : 1)) : (this.wins[0] >= this.rtw ? 0 : 1);
      this.matchWinner = mw;
      this.phase = 'matchend'; this.phaseT = 0;
      this.say('ניצחון ל' + this.f[mw].def.short + '!', { life: 160, col: '#ffe14a', size: 58 });
      Fx.confetti(this.f[mw].x, GROUND - 160, 90, 10);
      if (!this.cfg.attract) Snd.play('crowd');
      this.f[mw].st = 'win'; this.f[mw].t = 0;
    }
  }

  nextRound() {
    this.round++;
    this.startRound(false);
  }

  // ----- super cinematics -----
  startSuper(f) {
    if (this.cine || this.phase !== 'fight' || !f.moves.sup) return false;
    const m = f.moves.sup;
    f.meter = Math.max(0, f.meter - 100);
    f.startMove(m, 'sup');
    f.inv = 9999;
    this.cine = { f, t: 0, dur: this.cfg.attract ? 26 : 54 };
    Snd.play('superStart');
    Fx.flash('#ffffff', 0.5);
    this.stats.supers += f.slot === 0 ? 1 : 0;
    this.emit('super', f);
    return true;
  }
  updateCine() {
    const c = this.cine;
    c.t++;
    c.f.clock++;
    c.f.updatePose();
    if (c.t >= c.dur) {
      this.cine = null;
      c.f.inv = c.f.mv && c.f.mv.invAfter !== undefined ? c.f.mv.invAfter : 26;
      Fx.flash('#ffffff', 0.35); Fx.shake(8);
    }
  }

  // ----- rendering -----
  render(ctx) {
    const z = this.cam.zoom * (1 + Fx.punch * 0.012), cx = this.cam.x;
    ctx.save();
    const sh = Fx.shakeAmt;
    const ox = sh ? rnd(-sh, sh) : 0, oy = sh ? rnd(-sh, sh) : 0;
    ctx.translate(W / 2 + ox, 300 + oy); ctx.scale(z, z); ctx.translate(-cx, -300);
    Stages.draw(ctx, this.stage, cx, this.frame, 'back');
    this.drawWorld(ctx);
    Stages.draw(ctx, this.stage, cx, this.frame, 'front');
    ctx.restore();
    Fx.drawScreen(ctx);
    if (this.cine) this.drawCine(ctx, z, cx, ox, oy);
    if (!this.cfg.attract && !this.cfg.noHud) Hud.draw(ctx, this, !!this.cine);
    if (this.toasty > 0) this.drawToasty(ctx);
  }

  drawWorld(ctx) {
    // low entities first (traps, ground markers)
    for (const e of this.ents) if (e.z < 0 && e.delay <= 0) this.drawEntity(ctx, e);
    // shadows
    for (const f of this.f) {
      const air = clamp((GROUND - f.y) / 260, 0, 1);
      ctx.fillStyle = `rgba(10,5,30,${0.38 * (1 - air * 0.6)})`;
      ctx.beginPath(); ctx.ellipse(f.x, GROUND + 3, 52 * (1 - air * 0.4) * f.scale, 11 * (1 - air * 0.4), 0, 0, TAU); ctx.fill();
    }
    // trails (afterimages)
    for (const f of this.f) {
      f.trail.forEach((tr, i) => {
        const dummy = { def: f.def, x: tr.x, y: tr.y, face: tr.face, pose: tr.pose, clock: f.clock };
        drawFighter(ctx, dummy, { tint: rgba(f.def.color || '#ffffff', 0.5), alpha: 0.35 * (i + 1) / f.trail.length });
      });
    }
    // fighters (attacker on top)
    const order = this.f.slice().sort((a, b) => (a.st === 'attack' ? 1 : 0) - (b.st === 'attack' ? 1 : 0) + (a.st === 'thrown' ? -1 : 0) * 0.5);
    for (const f of order) {
      if (f.tm.iron > 0) { ctx.save(); ctx.translate(f.x, f.y - 90); ENT.shield(ctx, { t: this.frame, r: 96, col: '#c3ccd9' }); ctx.restore(); }
      if (f.val.shield > 0) { ctx.save(); ctx.translate(f.x, f.y - 90); ENT.shield(ctx, { t: this.frame, r: 92, col: '#ffd94a' }); ctx.restore(); }
      const au = f.passive.aura ? f.passive.aura(f) : null;
      if (au) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y - 90); glow(ctx, 120, au, 0.35 + 0.1 * Math.sin(this.frame * 0.2)); ctx.restore(); }
      const flash = f.flashT > 0 ? 0.65 : 0;
      drawFighter(ctx, f, { flash });
      if (f.hasArmor && f.hasArmor() && f.mi && f.mi.armor > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y - 90); glow(ctx, 110, '#ffd94a', 0.25); ctx.restore();
      }
    }
    for (const e of this.ents) if (e.z >= 0 && e.delay <= 0) this.drawEntity(ctx, e);
    Fx.draw(ctx);
  }

  drawEntity(ctx, e) {
    if (e.draw) { ctx.save(); ctx.translate(e.x, e.y); if (e.dir < 0 && !e.noFlip) ctx.scale(-1, 1); e.draw(ctx, e, this); ctx.restore(); return; }
    if (e.kind === 'mini') {
      const look = LOOKS[e.lookId] || LOOKS.bibi;
      const dummy = { def: { look }, x: e.x, y: e.y + e.h / 2, face: e.dir, st: 'walk', t: 0, clock: e.t, mv: null, mt: 0, vy: 0, grounded: true, walkPh: e.t * 0.55, moveDir: e.dir, hurtPct: 1, lookDir: 1 };
      dummy.pose = poseOf(dummy);
      if (e.pose) e.pose(dummy.pose, e);
      ctx.save(); ctx.translate(dummy.x, dummy.y); ctx.scale(e.sc, e.sc); ctx.translate(-dummy.x, -dummy.y);
      drawFighter(ctx, dummy, {});
      ctx.restore();
      return;
    }
    drawEnt(ctx, e.kind, e.x, e.y, e);
  }

  drawCine(ctx, z, cx, ox, oy) {
    const c = this.cine, f = c.f, k = c.t / c.dur;
    const col = f.def.color || '#ffd94a';
    const a = Math.min(1, k * 5) * (k > 0.9 ? (1 - k) * 10 : 1);
    ctx.save();
    ctx.fillStyle = `rgba(8,4,26,${0.68 * a})`; ctx.fillRect(0, 0, W, H);
    // radial speed lines
    ctx.translate(W / 2, H / 2);
    ctx.globalAlpha = 0.5 * a;
    const n = 36, ph = c.t * 0.3;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + Math.sin(i * 7.3) * 0.05, r0 = 150 + ((i * 37 + c.t * 26) % 120), r1 = 700;
      ctx.strokeStyle = i % 3 === 0 ? col : '#ffffff'; ctx.lineWidth = 2 + (i % 4);
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang + 0.02) * r1, Math.sin(ang + 0.02) * r1); ctx.stroke();
    }
    ctx.restore();
    // portrait slides in from the owner's side
    const side = f.slot === 0 ? -1 : 1;
    const slide = Ease.outCubic(Math.min(1, k * 4));
    const px = W / 2 + side * (W * 0.5 + 100) * (1 - slide) + side * 250, py = H / 2 + 20;
    ctx.save();
    ctx.globalAlpha = a;
    drawPortrait(ctx, f.def, px, py, 190, { mouth: 'shout', eyes: 'angry', bg: darken(col, 0.55), ring: col, lw: 10, flip: side > 0, zoom: 1.1 });
    ctx.restore();
    // banner
    const m = f.moves.sup;
    const bx = W / 2 - side * 120, by = H / 2 - 10;
    const slide2 = Ease.outCubic(Math.min(1, k * 5));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(bx - side * (1 - slide2) * 700, by);
    ctx.rotate(-0.07 * side);
    ctx.fillStyle = col; ctx.fillRect(-380, -58, 760, 116);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-380, 34, 760, 24);
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.strokeRect(-380, -58, 760, 116);
    T(ctx, m.name, 0, -8, { size: 62, font: 'disp', fill: '#ffffff', stroke: OUT, lw: 12 });
    T(ctx, f.def.name + ' · ' + f.def.partyName, 0, 46, { size: 20, fill: '#ffffff', weight: 700 });
    ctx.restore();
    // owner drawn over the dim
    ctx.save();
    ctx.translate(W / 2 + ox, 300 + oy); ctx.scale(z, z); ctx.translate(-cx, -300);
    drawFighter(ctx, f, {});
    ctx.restore();
  }

  drawToasty(ctx) {
    const k = this.toasty / 70;
    const slide = k > 0.8 ? (1 - k) / 0.2 : k < 0.2 ? k / 0.2 : 1;
    ctx.save();
    ctx.translate(W - 90 * slide + 20, H - 96);
    ctx.rotate(-0.15);
    drawEnt(ctx, 'burekas', 0, 0, { sc: 1.4 });
    T(ctx, '!בורקס', -8, -62, { size: 32, font: 'disp', fill: '#ffe14a', stroke: OUT, lw: 8 });
    ctx.restore();
  }
}

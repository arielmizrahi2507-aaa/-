// ===== Game controller: scenes, modes (arcade / survival / versus / training / daily), results =====
const MUTATORS = [
  { id: 'turbo', name: 'טורבו', desc: 'המשחק רץ מהר ב-30%.', speed: 1.3 },
  { id: 'lowgrav', name: 'כבידה נמוכה', desc: 'כולם קופצים וצפים גבוה יותר.', grav: 0.62 },
  { id: 'brittle', name: 'זכוכית', desc: 'חצי מהחיים, ובערך פי אחד וחצי נזק.', hpMul: 0.55, dmgMul: 1.6 },
  { id: 'charged', name: 'טעון', desc: 'ההייפ מתמלא מהר פי 2 וכולם מתחילים חצי מלאים.', meter: 2.2, startMeter: 55 },
  { id: 'giants', name: 'ענקים', desc: 'כל הלוחמים גדולים ב-22%.', scale: 1.22 },
];

const Game = {
  scene: null, acc: 0, last: 0, paused: false, spec: null, dummy: 'stand', infMeter: false, showBoxes: false, showInputs: true, seg: 0, tiltDir: 1, tiltT: 0,

  // ------------------------------------------------------------------ boot / loop
  init() {
    this.cv = $('#cv'); this.ctx = this.cv.getContext('2d');
    try { document.fonts.load('400 24px "Secular One"'); document.fonts.load('700 20px Rubik'); } catch (e) { /* optional */ }
    Save.load();
    const s = Save.d.settings;
    Snd.vol.sfx = s.sfx; Snd.vol.music = s.music; Snd.muted = s.muted;
    Inp.init();
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) document.body.classList.add('canfs');
    UI.init();
    this.pv = $('#pv'); this.pvctx = this.pv.getContext('2d');
    TouchUI.init();
    FightUI.init();
    // when embedded in another page (preview panes, iframes) keys only arrive once the frame has focus
    ['pointerdown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { try { window.focus(); } catch (e) { /* ignore */ } }, { passive: true }));
    this.applySettings();
    window.addEventListener('resize', () => this.layout());
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 120));
    window.addEventListener('devicemotion', (e) => this.onMotion(e), { passive: true });
    window.addEventListener('pointerdown', () => this.landscapeAttempt(), { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.scene && this.scene.kind === 'fight' && !this.paused) this.togglePause(); });
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    UI.show('title');
  },

  applySettings() {
    const s = Save.d.settings;
    Fx.calm = s.calm; Fx.noShake = !s.shake;
    F3D.off = s.gfx3d === false;
    Snd.setMuted(s.muted);
    Snd.setVol('sfx', s.sfx); Snd.setVol('music', s.music);
    UI.applyMuteIcon();
  },

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(100, now - this.last); this.last = now;
    UI.padPoll();
    const sc = this.scene;
    if (!sc || document.hidden) return;
    const B = sc.B;
    if (!B) return;
    if (!this.paused) {
      if (sc.kind === 'fight') this.perf(dt);
      const speed = (B.cfg.speed || 1) * B.timeScale;
      this.acc += dt * speed;
      let steps = 0;
      while (this.acc >= 1000 / 60 && steps < 5) { B.update(); this.acc -= 1000 / 60; steps++; }
      if (steps === 5) this.acc = 0;
      if (sc.kind === 'attract' && B.over) this.setScene('attract');
      if (sc.kind === 'preview') { const cap = $('#pvcap'); if (cap && cap.textContent !== (B.demoLabel || '')) cap.textContent = B.demoLabel || ''; }
    }
    const c = sc.ctx, cv = sc.cv;
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    B.render(c);
    if (sc.kind !== 'preview') Stages.vignette(c);
    if (sc.kind === 'fight') { TouchUI.updateHints(B); FightUI.tick(B); }
  },

  // Screen geometry. With "landscape mode" on, a phone that the host keeps in portrait gets the whole UI turned by 90 degrees,
  // so it can be held sideways: everything below works in the rotated ("logical") size, and CSS uses --u-vw / --u-vh instead of vw / vh.
  // Slow phones: if the first seconds of a fight run well below 60 fps, drop to a cheaper mode (lower resolution, no reflections) for the session.
  perf(dt) {
    const q = this.q || (this.q = { n: 0, sum: 0, done: false });
    if (q.done) return;
    if (++q.n <= 40) return;                  // skip the warm-up (stage bitmaps are painted on the first frames)
    q.sum += Math.min(dt, 80);
    if (q.n >= 190) {
      q.done = true;
      if (q.sum / (q.n - 40) > 27) {
        if (F3D.ok && !F3D.off) { F3D.off = true; q.done = false; q.n = 0; q.sum = 0; UI.toast('מצב חסכוני', 'הדמויות התלת־ממדיות כובו כדי לשמור על חלקות. אפשר להדליק בהגדרות', 'unlock'); }
        else if (!Battle.lowFx) { Battle.lowFx = true; this.layout(); }
      }
    }
  },

  layout() {
    const set = Save.d.settings;
    const pw0 = window.innerWidth, ph0 = window.innerHeight;
    const physPortrait = ph0 > pw0 * 1.02;
    const mode = this.rotMode();
    const rot = mode !== 'off' && physPortrait ? (mode === 'ccw' ? -1 : 1) : 0;
    this.rot = rot;
    const vw = rot ? ph0 : pw0, vh = rot ? pw0 : ph0;
    const B0 = document.body, RS = document.documentElement.style;
    RS.setProperty('--u-vw', vw / 100 + 'px'); RS.setProperty('--u-vh', vh / 100 + 'px');
    RS.setProperty('--lw', vw + 'px'); RS.setProperty('--lh', vh + 'px'); RS.setProperty('--vpw', pw0 + 'px'); RS.setProperty('--vph', ph0 + 'px');
    B0.classList.toggle('rot', !!rot); B0.classList.toggle('rot-cw', rot === 1); B0.classList.toggle('rot-ccw', rot === -1);
    B0.classList.toggle('lp', vw / vh <= 1);                       // portrait layout (as the player sees it)
    B0.classList.toggle('ls', vh <= 520 && vw / vh >= 1);           // short landscape (phones on their side)
    B0.classList.toggle('phys-portrait', physPortrait);
    B0.classList.toggle('touchdev', this.touchEnabled());
    const view = document.body.dataset.view || 'none';
    const cv = this.cv, box = $('#view');
    const touchOn = this.touchEnabled();
    let w, h, left, top;
    const portrait = vh > vw * 1.08;
    if (view === 'attract') { w = Math.max(vw, vh * 16 / 9); h = w * 9 / 16; left = (vw - w) / 2; top = (vh - h) / 2; }
    else if (view === 'fight' && touchOn && portrait) { w = vw; h = w * 9 / 16; left = 0; top = Math.max(0, Math.min(24, vh * 0.02)); }
    else { w = Math.min(vw, vh * 16 / 9); h = w * 9 / 16; left = (vw - w) / 2; top = (vh - h) / 2; }
    const isPortrait = view === 'fight' && touchOn && portrait;
    document.body.classList.toggle('portrait', isPortrait);
    Battle.minZoom = isPortrait ? 1.3 : 1;
    if (isPortrait && !this.rotateHinted && this.scene && this.scene.kind === 'fight') { this.rotateHinted = true; UI.toast('טיפ', 'לחוויה מלאה סובבו את הטלפון לרוחב. אם המסך לא מסתובב: תפריט ← הגדרות ← מצב רוחב', 'unlock'); }
    document.body.classList.toggle('touch-on', view === 'fight' && touchOn);
    box.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    document.documentElement.style.setProperty('--vx', left + 'px'); document.documentElement.style.setProperty('--vy', top + 'px');
    document.documentElement.style.setProperty('--vw', w + 'px'); document.documentElement.style.setProperty('--vh', h + 'px');
    let dpr = Math.min(window.devicePixelRatio || 1, Battle.lowFx ? 1.25 : 2);
    while (w * h * dpr * dpr > 2.4e6 && dpr > 1) dpr -= 0.25;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    Stages.setRes(pw / W * 1.15);
  },

  // client (viewport) coordinates -> coordinates inside the app box, undoing the landscape-mode rotation
  toApp(cx, cy) {
    if (!this.rot) return [cx, cy];
    return this.rot === 1 ? [cy, window.innerWidth - cx] : [window.innerHeight - cy, cx];
  },
  // 'auto' (the default) turns the UI to landscape on touch devices that are held upright; the direction follows the accelerometer when there is one.
  rotMode() {
    const s = Save.d.settings;
    const m = s.rotateSet ? s.rotate : 'auto';
    if (m === 'auto' || !m) return this.touchEnabled() ? (this.tiltDir === -1 ? 'ccw' : 'cw') : 'off';
    return m;
  },
  setRotate(v) {
    const s = Save.d.settings;
    s.rotate = v; s.rotateSet = true; Save.save(); this.layout();
    const sel = $('#set-rotate'); if (sel) sel.value = v;
    Snd.play('select');
  },
  // Phone locked to portrait: which way was it turned? (x > 0: the top of the phone points to the player's left, so the UI turns clockwise)
  onMotion(e) {
    const a = e.accelerationIncludingGravity, s = Save.d.settings;
    if (!a || typeof a.x !== 'number' || (s.rotateSet && s.rotate !== 'auto') || !this.rot) return;
    const ax = /iP(hone|ad|od)/.test(navigator.userAgent) ? -a.x : a.x;
    const want = ax > 6.5 ? 1 : ax < -6.5 ? -1 : 0;
    if (!want || want === this.tiltDir) { this.tiltT = 0; return; }
    if (++this.tiltT > 14) { this.tiltDir = want; this.tiltT = 0; this.layout(); }
  },
  // First tap on an upright phone: go fullscreen and ask for landscape. Android Chrome honours it; elsewhere the UI is turned by CSS.
  landscapeAttempt() {
    if (this.fsTried || !this.rot || !this.touchEnabled()) return;
    this.fsTried = true;
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try { Promise.resolve(req.call(el)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }).catch(() => {}); } catch (e) { /* not allowed */ }
  },
  toggleFullscreen() {
    const d = document, el = d.documentElement;
    const fs = d.fullscreenElement || d.webkitFullscreenElement;
    const fail = () => UI.toast('מסך מלא', 'הדפדפן לא מאפשר מסך מלא כאן', 'unlock');
    try {
      if (!fs) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) { fail(); return; }
        Promise.resolve(req.call(el)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }).catch(fail);
      } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (e) { fail(); }
  },

  touchEnabled() {
    const t = Save.d.settings.touch;
    if (t === 'on') return true;
    if (t === 'off') return false;
    return window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window && navigator.maxTouchPoints > 0 && !window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  },

  // ------------------------------------------------------------------ scenes
  setScene(kind, p = {}) {
    this.acc = 0;
    Fx.reset();
    Inp.capture = kind === 'fight';
    document.body.dataset.view = kind === 'preview' ? 'none' : kind;
    Snd.quiet = kind !== 'fight';
    if (kind === 'none') { this.scene = null; this.layout(); return; }
    if (kind === 'attract') {
      const ids = shuffle(ROSTER.map((d) => d.id));
      const mkf = (id, slot) => new Fighter(ROSTER_BY_ID[id], slot, { ctrl: makeCtrl(0.75, Math.random() * 1e9) });
      const B = new Battle({ fighters: [mkf(ids[0], 0), mkf(ids[1], 1)], stage: pick(STAGES).id, rounds: 1, time: 40, attract: true, noHud: true });
      this.scene = { kind, B, cv: this.cv, ctx: this.ctx };
      this.layout();
      return;
    }
    if (kind === 'preview') {
      const def = ROSTER_BY_ID[p.id];
      const dummyId = p.id === 'lapid' ? 'gantz' : 'lapid';
      const f0 = new Fighter(def, 0, { ctrl: makeDemo(def) });
      const f1 = new Fighter(ROSTER_BY_ID[dummyId], 1, { ctrl: () => 0 });
      f1.maxHp = 300;
      const stg = STAGES[Math.abs(hashStr(p.id)) % STAGES.length].id;
      const B = new Battle({ fighters: [f0, f1], stage: stg, rounds: 2, time: 99, training: true, noHud: true, attract: true, zoom: 1.5, infMeter: false });
      f1.hp = f1.maxHp;
      this.scene = { kind, B, cv: this.pv, ctx: this.pvctx };
      return;
    }
    if (kind === 'fight') {
      this.scene = { kind, B: p.B, cv: this.cv, ctx: this.ctx };
      this.layout();
    }
  },

  // ------------------------------------------------------------------ mode entry
  beginMode(mode, picks, o) {
    Inp.solo = mode !== 'versus';
    this.diff = o.diff;
    const stage = o.stage || 'random';
    switch (mode) {
      case 'arcade': this.startArcade(picks[0], o.diff); break;
      case 'survival': this.startSurvival(picks[0]); break;
      case 'versus': this.startFight({ mode: 'versus', p1: { id: picks[0], human: true }, p2: { id: picks[1], human: true }, stage: stage === 'random' ? pick(STAGES).id : stage, rounds: Save.d.settings.rounds, time: Save.d.settings.timer }); break;
      case 'training': this.dummy = 'stand'; this.infMeter = false; this.showBoxes = false; this.showInputs = true; this.startFight({ mode: 'training', p1: { id: picks[0], human: true }, p2: { id: picks[1], dummy: true }, stage: stage === 'random' ? pick(STAGES).id : stage, rounds: 2, time: 99, training: true, noSplash: true }); break;
      default: break;
    }
  },

  // ------------------------------------------------------------------ building + starting a fight
  buildFighter(side, slot, seed) {
    const def = ROSTER_BY_ID[side.id];
    let ctrl;
    if (side.human) ctrl = () => Inp.read(slot);
    else if (side.dummy) ctrl = this.dummyCtrl();
    else ctrl = makeCtrl(side.level === undefined ? 0.5 : side.level, seed);
    const f = new Fighter(def, slot, { ctrl, mods: side.mods, hpMul: side.hpMul, dmgMul: side.dmgMul, scale: side.scale, startHp: side.startHp, takenMul: side.takenMul });
    if (side.grav) f.gravMul = side.grav;
    if (side.meterMul) f.mods = Object.assign({}, f.mods, { meter: (f.mods.meter || 1) * side.meterMul, startMeter: side.startMeter });
    return f;
  },
  dummyCtrl() {
    let brain = null;
    return (f, B) => {
      switch (Game.dummy) {
        case 'block': return IN.K;
        case 'crouch': return IN.K | IN.D;
        case 'jump': return B.frame % 100 === 0 ? IN.U : 0;
        case 'cpu': if (!brain) brain = new Brain(0.55); return brain.ctrl(f, B);
        default: return 0;
      }
    };
  },

  startFight(spec) {
    if (!spec.onDone && spec.mode === 'versus') spec.onDone = (res) => this.versusDone(res);
    this.spec = spec;
    this.paused = false;
    $$('#s-pause, #s-result, #s-bills, #s-daily').forEach((s) => s.classList.remove('on'));
    const seed = (Math.random() * 1e9) | 0;
    const f1 = this.buildFighter(spec.p1, 0, seed), f2 = this.buildFighter(spec.p2, 1, seed + 1);
    this.pending = { f1, f2 };
    if (spec.noSplash) { this.runBattle(); return; }
    this.showVs(spec, f1, f2);
  },

  showVs(spec, f1, f2) {
    const A = f1.def, Bd = f2.def;
    const draw = (id, def, flip) => {
      const c = $(id), x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      drawPortrait(x, def, 180, 180, 168, { bg: darken(def.color, 0.55), ring: def.color, lw: 10, mouth: 'grin', eyes: 'angry', flip, zoom: 0.88 });
    };
    draw('#vs-a', A, false); draw('#vs-b', Bd, true);
    $('#vs-an').textContent = A.name; $('#vs-bn').textContent = Bd.name;
    $('#vs-ap').innerHTML = partyChip(A); $('#vs-bp').innerHTML = partyChip(Bd);
    document.documentElement.style.setProperty('--ca', A.color); document.documentElement.style.setProperty('--cb', Bd.color);
    $('#vs-aq').textContent = pick(A.quotes.intro); $('#vs-bq').textContent = pick(Bd.quotes.intro);
    const stg = STAGES.find((s) => s.id === spec.stage);
    $('#vs-stage').textContent = stg.name;
    $('#vs-info').textContent = spec.label || '';
    Game.setScene('none');
    UI.show('vs');
    setTimeout(() => { if (F3D.active()) { try { look3D(A.look); look3D(Bd.look); } catch (e) { /* falls back to 2D */ } } }, 40);
    setTimeout(() => Stages.prewarm(stg), 60);          // paint the arena's backdrop while the splash is on screen
    Snd.quiet = false; Snd.play('superStart'); Snd.playMusic('battle');
    clearTimeout(this.vsTimer);
    this.vsTimer = setTimeout(() => this.runBattle(), spec.mode === 'training' ? 0 : 2300);
  },

  runBattle() {
    clearTimeout(this.vsTimer);
    if (!this.pending) return;
    const { f1, f2 } = this.pending; this.pending = null;
    const spec = this.spec;
    const B = new Battle({
      fighters: [f1, f2], stage: spec.stage, rounds: spec.rounds || 2, time: spec.time || 60, training: !!spec.training, infMeter: this.infMeter, showBoxes: this.showBoxes, showInputs: this.showInputs,
      speed: spec.speed || 1, pickups: spec.mode === 'survival' || spec.mode === 'daily', onEvent: (n, a, b, c, d) => this.onEvent(n, a, b, c, d),
    });
    if (spec.training) { B.phase = 'fight'; B.phaseT = 0; }
    B.cfg.hint = !Save.d.seenHelp && !this.touchEnabled() && spec.mode !== 'versus';
    this.B = B;
    UI.hide();
    this.setScene('fight', { B });
    Snd.quiet = false;
    Snd.playMusic('battle');
    TouchUI.show(true);
    FightUI.sync();
    this.layout();
  },

  // ------------------------------------------------------------------ events during a fight
  onEvent(name, a, b, c, d) {
    const S = Save.d, B = this.B;
    if (B && this.spec.training) { if (name === 'hit' && a.slot === 0 && d > 0) FightUI.last = { name: c && c.name, dmg: d }; return; }
    if (!B) return;
    if (name === 'combo') { if (b > S.bestCombo) S.bestCombo = b; }
    else if (name === 'super') { if (a.slot === 0) S.supers++; }
    else if (name === 'block') { if (b === undefined) return; if (c && a.slot !== 0 && b.slot === 0) S.perfects++; }
    else if (name === 'hit') { if (a.slot === 0 && b.slot === 1 && c && c.isThrow) S.throws++; }
    else if (name === 'roundEnd') { if (a === 0 && !B.f[0].tookDamage) S.flawless++; }
    else if (name === 'matchEnd') { this.finishFight(a); }
    else if (name === 'burekas') { S.burekas++; }
    if (name === 'combo' || name === 'super') this.checkAch();
  },

  checkAch() {
    const fresh = Save.checkAchievements();
    fresh.forEach((a) => UI.toast('הישג חדש: ' + a.name, a.desc));
    // newly unlocked characters
    EXTRA.forEach((d) => {
      if (!Save.d.unlocked[d.id] && Save.isUnlocked(d)) { Save.d.unlocked[d.id] = true; Save.save(); UI.toast('נפתחה דמות חדשה', d.name, 'unlock'); }
    });
  },

  finishFight(winner) {
    const S = Save.d, B = this.B, spec = this.spec;
    const won = winner === 0;
    S.matches++;
    S.seenHelp = true;
    const rankBefore = rankOf(S.wins).name;
    if (spec.mode === 'versus') { /* two humans: personal stats are not touched */ }
    else if (won) {
      S.wins++; S.winsBy[spec.p1.id] = (S.winsBy[spec.p1.id] || 0) + 1; S.ko++;
      if (B.f[0].hp / B.f[0].maxHp < 0.1) S.comebacks++;
    } else S.losses++;
    Save.save();
    this.checkAch();
    if (won && rankOf(S.wins).name !== rankBefore) UI.toast('דרגה חדשה!', rankOf(S.wins).name, 'unlock');
    const res = { won, winner, B, stats: B.stats, hpLeft: B.f[0].hp, hpPct: B.f[0].hp / B.f[0].maxHp, maxCombo: B.stats.maxCombo, rounds: B.wins.slice(), time: B.frame };
    Inp.capture = false; TouchUI.show(false);
    Snd.playMusic(won ? 'victory' : 'menu');
    if (won) Snd.play('win'); else Snd.play('lose');
    if (spec.onDone) spec.onDone(res);
  },

  // ------------------------------------------------------------------ result cards
  card(html, id = 'result') {
    const t = $('#' + (id === 'result' ? 'res-card' : id + '-card'));
    t.innerHTML = html;
    UI.show(id === 'bills' ? 'bills' : id);
    $('#s-' + id).classList.add('on');
  },
  winnerBanner(res) {
    const spec = this.spec;
    const w = res.B.f[res.winner];
    return `<div class="winbox" style="--pc:${w.def.color}"><img src="${portraitURL(w.def.id, 192)}" alt=""><div><small>${res.won || spec.mode === 'versus' ? 'ניצחון' : 'ניצחון ליריב'}</small><h2>${w.def.name}</h2>${partyChip(w.def)}<p>"${pick(w.def.quotes.win)}"</p></div></div>`;
  },
  statsLine(res) {
    return `<div class="rstats"><div><b>${res.maxCombo}</b><span>קומבו שיא</span></div><div><b>${res.stats.supers}</b><span>סופרים</span></div><div><b>${res.stats.perfects}</b><span>בלוקים מושלמים</span></div><div><b>${Math.round(res.time / 60)}″</b><span>משך הקרב</span></div></div>`;
  },

  act(name, el) {
    switch (name) {
      case 'skipvs': this.runBattle(); break;
      case 'resume': this.togglePause(); break;
      case 'pause-sound': UI.setMuted(!Snd.muted); $('#pause-snd').textContent = Snd.muted ? 'כבוי' : 'פועל'; Snd.play('select'); break;
      case 'pause-moves': this.showMovesCard(); break;
      case 'rotate-on': this.setRotate('auto'); break;
      case 'rotate-flip': this.setRotate(this.rot === -1 ? 'cw' : 'ccw'); break;
      case 'rotate-off': this.setRotate('off'); break;
      case 'fullscreen': this.toggleFullscreen(); break;
      case 'pause-settings': UI.show('settings', { keepScene: true }); $('#s-pause').classList.remove('on'); break;
      case 'restart': this.paused = false; this.startFight(this.spec); break;
      case 'quit': this.askQuit(); break;
      case 'quit-yes': this.quit(); break;
      case 'stay': this.pauseOpen(); break;
      case 'rematch': this.startFight(this.spec); break;
      case 'menu': this.quit(); break;
      case 'closemoves': this.pauseOpen(); break;
      case 'train-reset': this.trainReset(); break;
      case 'next-arcade': this.nextArcadeFight(); break;
      case 'retry': this.startFight(this.spec); break;
      case 'bill': this.pickBill(el.dataset.id); break;
      case 'dummy-mode': this.cycleDummy(); this.pauseOpen(); break;
      case 'boxes': this.showBoxes = !this.showBoxes; if (this.B) this.B.cfg.showBoxes = this.showBoxes; this.pauseOpen(); break;
      case 'inputs': this.showInputs = !this.showInputs; if (this.B) this.B.cfg.showInputs = this.showInputs; this.pauseOpen(); break;
      case 'dummy-meter': this.toggleMeter(); this.pauseOpen(); break;
      case 'daily-start': this.startDaily(); break;
      case 'reselect': UI.show('select', { mode: this.spec.mode }); break;
      case 'again': this.startSurvival(this.surv.fighter); break;
      default: break;
    }
  },

  cycleDummy() {
    const modes = ['stand', 'block', 'crouch', 'jump', 'cpu'];
    this.dummy = modes[(modes.indexOf(this.dummy) + 1) % modes.length];
    FightUI.sync();
  },
  toggleMeter() {
    this.infMeter = !this.infMeter;
    if (this.B) this.B.cfg.infMeter = this.infMeter;
    FightUI.sync();
  },
  // training: both fighters back to their corners with full health, no cooldowns
  trainReset() {
    const B = this.B;
    if (!B || !this.spec || !this.spec.training) return;
    B.startRound(true, true);
    B.phase = 'fight'; B.phaseT = 0; B.announce = null;
    B.f.forEach((f) => { f.st = 'idle'; f.t = 0; });
    B.timeLeft = B.timeMax;
    FightUI.last = null;
    Snd.play('select');
    if (this.paused) this.togglePause();
  },

  quit() {
    this.paused = false; clearTimeout(this.vsTimer);
    // leaving a marathon mid-run still counts the waves already cleared
    if (this.spec && this.spec.mode === 'survival' && this.surv) {
      const done = this.surv.wave - 1;
      if (done > Save.d.survivalBest) { Save.d.survivalBest = done; Save.save(); this.checkAch(); }
    }
    document.body.classList.remove('training');
    Inp.capture = false; TouchUI.show(false);
    $$('#s-pause, #s-result, #s-bills, #s-daily').forEach((s) => s.classList.remove('on'));
    this.setScene('attract');
    UI.show('title');
    Snd.playMusic('menu');
  },

  // ------------------------------------------------------------------ pause
  togglePause() {
    if (!this.scene || this.scene.kind !== 'fight' || this.B.over) return;
    this.paused = !this.paused;
    this.B.paused = this.paused;
    if (this.paused) { Inp.capture = false; this.pauseOpen(); }
    else { $('#s-pause').classList.remove('on'); Inp.capture = true; document.body.dataset.screen = 'fight'; Snd.resume(); }
  },
  modeName(spec) {
    return { arcade: 'מסע לראשות הממשלה', survival: 'מרתון חקיקה', daily: 'האתגר היומי', versus: 'קרב חברים', training: 'מצב אימון' }[spec.mode] || '';
  },
  pauseOpen() {
    const spec = this.spec || {};
    $('#pause-snd').textContent = Snd.muted ? 'כבוי' : 'פועל';
    $('#pause-mode').textContent = [this.modeName(spec), spec.label].filter(Boolean).join(' · ');
    $('#pause-quit').textContent = spec.training ? 'יציאה מהאימון' : 'יציאה לתפריט הראשי';
    const t = $('#pause-train');
    if (spec.training) {
      t.innerHTML = `<button class="btn nav" data-act="train-reset">איפוס עמדות ובריאות</button>
        <button class="btn nav" data-act="dummy-mode">התנהגות היריב: ${DUMMY_NAMES[this.dummy]}</button>
        <button class="btn nav" data-act="dummy-meter">הייפ אינסופי: ${this.infMeter ? 'פועל' : 'כבוי'}</button>
        <div class="two"><button class="btn nav" data-act="inputs">תצוגת קלט: ${this.showInputs ? 'פועלת' : 'כבויה'}</button><button class="btn nav" data-act="boxes">תיבות פגיעה: ${this.showBoxes ? 'פועלות' : 'כבויות'}</button></div>`;
    } else t.innerHTML = '';
    UI.show('pause');
    $('#s-pause').classList.add('on');
  },
  // a card shown on top of the paused fight (move list, "really leave?")
  pauseSub(html) {
    $('#res-card').innerHTML = html;
    $('#s-pause').classList.remove('on');
    $('#s-result').classList.add('on'); document.body.dataset.screen = 'result';
    $('#s-result').scrollTop = 0;
    requestAnimationFrame(() => { const f = $('#s-result .autofocus'); if (f && matchMedia('(hover:hover)').matches) f.focus({ preventScroll: true }); });
  },
  showMovesCard() {
    const def = this.B.f[0].def;
    this.pauseSub(`<div class="movecard">${UI.detailHTML(def, false)}</div><div class="stack"><button class="btn primary nav autofocus" data-act="closemoves">חזרה להפסקה</button></div>`);
  },
  // leaving a run (arcade / marathon / daily) asks first; training and friendly matches just leave
  askQuit() {
    const spec = this.spec || {};
    const what = { arcade: 'המסע', survival: 'המרתון', daily: 'האתגר היומי' }[spec.mode];
    if (!what) { this.quit(); return; }
    const note = spec.mode === 'survival' ? `הגלים שכבר ניצחתם (${Math.max(0, this.surv.wave - 1)}) נשמרים בשיא.` : 'ההתקדמות בריצה הנוכחית תאבד.';
    this.pauseSub(`<h2>לעזוב את ${what}?</h2><p class="next">${note}</p><div class="stack"><button class="btn primary big nav autofocus" data-act="stay">חזרה להפסקה</button><button class="btn danger nav" data-act="quit-yes">כן, יציאה לתפריט</button></div>`);
  },

  versusDone(res) {
    this.card(`${this.winnerBanner(res)}${this.statsLine(res)}<div class="stack"><button class="btn primary big nav autofocus" data-act="rematch">עוד סיבוב</button><button class="btn nav" data-act="reselect">בחירת לוחמים</button><button class="btn nav" data-act="menu">חזרה לתפריט</button></div>`);
  },

  // ------------------------------------------------------------------ ARCADE
  startArcade(id, diff) {
    const others = shuffle(ROSTER.map((d) => d.id).filter((x) => x !== id));
    const ladder = others.slice(0, 6).concat([id === 'threshold' ? others[6] : 'threshold']);   // the boss is a mirror-free final
    this.arc = { id, diff, ladder, idx: 0, tries: 0, t0: Date.now() };
    this.nextArcadeFight();
  },
  nextArcadeFight() {
    const A = this.arc, i = A.idx, oid = A.ladder[i], boss = oid === 'threshold';
    const base = [0.15, 0.4, 0.66][A.diff];
    const level = clamp(base + i * 0.045 + (boss ? 0.06 : 0), 0.1, 0.98);
    const stage = STAGES[(hashStr(A.id + i) + i) % STAGES.length].id;
    this.startFight({
      mode: 'arcade', p1: { id: A.id, human: true },
      p2: { id: oid, level, hpMul: (1 + [0, 0.05, 0.12][A.diff] + i * 0.02) * (boss ? [0.8, 0.9, 1][A.diff] : 1), dmgMul: [0.85, 1, 1.1][A.diff] * (boss ? [0.85, 0.95, 1][A.diff] : 1) },
      stage, rounds: Save.d.settings.rounds, time: Save.d.settings.timer, label: `קרב ${i + 1} מתוך ${A.ladder.length}` + (boss ? ' · הבוס הסודי' : ''),
      onDone: (res) => this.arcadeDone(res),
    });
  },
  arcadeDone(res) {
    const A = this.arc, S = Save.d, oid = A.ladder[A.idx];
    const ladderHTML = () => `<div class="ladder">${A.ladder.map((id, i) => `<div class="${i < A.idx ? 'done' : (i === A.idx ? 'cur' : '')}"><img src="${portraitURL(id, 96)}" alt=""><span>${i + 1}</span></div>`).join('')}</div>`;
    if (!res.won) {
      A.tries++;
      this.card(`${this.winnerBanner(res)}${this.statsLine(res)}${ladderHTML()}<div class="stack"><button class="btn primary big nav autofocus" data-act="retry">נסו שוב את הקרב</button><button class="btn nav" data-act="menu">יציאה לתפריט</button></div>`);
      return;
    }
    A.idx++;
    if (oid === 'threshold') { S.bossBeaten++; }
    if (A.idx >= A.ladder.length) {
      S.arcadeClears[A.id] = (S.arcadeClears[A.id] || 0) + 1;
      if (A.diff === 2) S.hardClear++;
      Save.save(); this.checkAch();
      const def = ROSTER_BY_ID[A.id];
      this.card(`<div class="ending" style="--pc:${def.color}"><img src="${portraitURL(A.id, 192)}" alt=""><h2>${def.short} הוא ראש הממשלה!</h2>${partyChip(def)}<p class="endtxt">${def.ending}</p><small>נפתחה דמות סודית: אחוז החסימה.</small></div>${this.statsLine(res)}<div class="stack"><button class="btn primary big nav autofocus" data-act="menu">חזרה לתפריט</button></div>`);
      Snd.play('crowd');
      return;
    }
    const nxt = ROSTER_BY_ID[A.ladder[A.idx]];
    this.card(`${this.winnerBanner(res)}${ladderHTML()}<p class="next">הקרב הבא: <b>${nxt.name}</b> (${nxt.partyName})</p><div class="stack"><button class="btn primary big nav autofocus" data-act="next-arcade">לקרב הבא</button><button class="btn nav" data-act="menu">יציאה לתפריט</button></div>`);
  },

  // ------------------------------------------------------------------ SURVIVAL (roguelite)
  startSurvival(id) {
    this.surv = { fighter: id, wave: 1, mods: {}, hp: null, picked: [], stageI: (Math.random() * 5) | 0 };
    this.nextWave();
  },
  nextWave() {
    const R = this.surv, w = R.wave;
    const boss = w % 5 === 0;
    const pool = ROSTER.map((d) => d.id).filter((x) => x !== R.fighter);
    const oid = boss && R.fighter !== 'threshold' ? 'threshold' : pool[(Math.random() * pool.length) | 0];
    const level = clamp(0.2 + w * 0.035, 0.15, 0.96);
    const me = ROSTER_BY_ID[R.fighter];
    const mods = R.mods;
    const maxHp = Math.round(me.stats.hp + (mods.hp || 0));
    if (R.hp === null || R.hp > maxHp) R.hp = maxHp;
    const stage = STAGES[(R.stageI + w) % STAGES.length].id;
    this.startFight({
      mode: 'survival', p1: { id: R.fighter, human: true, mods, startHp: R.hp },
      p2: { id: oid, level, hpMul: (boss ? 1.05 : 1) + w * 0.04, dmgMul: 1 + w * 0.02 },
      stage, rounds: 1, time: 50, label: `גל ${w}` + (boss ? ' · בוס' : ''),
      onDone: (res) => this.survivalDone(res),
    });
  },
  survivalDone(res) {
    const R = this.surv, S = Save.d;
    if (!res.won) {
      const best = R.wave - 1;
      const newBest = best > S.survivalBest;
      if (newBest) S.survivalBest = best;
      Save.save(); this.checkAch();
      const def = ROSTER_BY_ID[R.fighter];
      this.card(`<div class="ending bad" style="--pc:${def.color}"><img src="${portraitURL(R.fighter, 192)}" alt=""><h2>המרתון נגמר</h2><p class="endtxt">שרדתם ${best} גלים. ${newBest ? 'שיא חדש!' : 'השיא שלכם: ' + S.survivalBest}</p></div>
        <div class="chips">${R.picked.map((b) => `<span>${b}</span>`).join('') || '<span>בלי חוקים</span>'}</div>
        <div class="stack"><button class="btn primary big nav autofocus" data-act="again">עוד ריצה</button><button class="btn nav" data-act="menu">חזרה לתפריט</button></div>`);
      return;
    }
    const me = ROSTER_BY_ID[R.fighter];
    const maxHp = Math.round(me.stats.hp + (R.mods.hp || 0));
    R.hp = Math.min(maxHp, res.hpLeft + maxHp * 0.3);
    if (R.wave > S.survivalBest) { S.survivalBest = R.wave; Save.save(); this.checkAch(); }
    const choices = shuffle(BILLS).slice(0, 3);
    this.billChoices = choices;
    this.card(`<h2>גל ${R.wave} הושלם</h2><p class="next">מרפאים 30%. בחרו חוק להעברה:</p>
      <div class="bills">${choices.map((b) => `<button class="bill nav" data-act="bill" data-id="${b.id}" style="--pc:${b.col}"><img src="${iconURL(b.icon)}" alt=""><b>${b.name}</b><span>${b.desc}</span></button>`).join('')}</div>
      <div class="stack"><button class="btn nav" data-act="menu">סיום הריצה ויציאה לתפריט</button></div>`, 'bills');
  },
  pickBill(id) {
    const R = this.surv, b = BILLS.find((x) => x.id === id);
    if (!b) return;
    b.apply(R.mods);
    R.picked.push(b.name);
    if (R.mods.healNow) { R.hp += R.mods.healNow; R.mods.healNow = 0; }
    const me = ROSTER_BY_ID[R.fighter];
    R.hp = Math.min(R.hp, Math.round(me.stats.hp + (R.mods.hp || 0)));
    Snd.play('confirm');
    R.wave++;
    $('#s-bills').classList.remove('on');
    this.nextWave();
  },

  // ------------------------------------------------------------------ DAILY
  daily() {
    const key = todayKey();
    const rnd = mulberry32(hashStr('ks-daily-' + key));
    const pool = ROSTER.map((d) => d.id);
    const me = pool[Math.floor(rnd() * pool.length)];
    const foes = shuffle(pool.filter((x) => x !== me), rnd).slice(0, 3);
    const mut = MUTATORS[Math.floor(rnd() * MUTATORS.length)];
    const stages = [0, 1, 2].map(() => STAGES[Math.floor(rnd() * STAGES.length)].id);
    return { key, me, foes, mut, stages };
  },
  dailyIntro() {
    const D = this.daily();
    const me = ROSTER_BY_ID[D.me];
    const done = Save.d.daily.done[D.key];
    Game.setScene('none');
    this.card(`<h2>האתגר היומי</h2><small class="dk">${D.key}</small>
      <div class="dmut"><b>חוק היום: ${D.mut.name}</b><span>${D.mut.desc}</span></div>
      <div class="dline"><div class="dside"><img src="${portraitURL(D.me, 128)}" alt=""><b>${me.short}</b><small>הלוחם שלכם היום</small></div>
      <div class="darrow">◀</div>
      <div class="dfoes">${D.foes.map((f) => `<img src="${portraitURL(f, 96)}" alt="">`).join('')}</div></div>
      <p class="next">שלושה קרבות ברצף, בלי מנוחה. רצף נוכחי: ${Save.d.daily.streak} · שיא: ${Save.d.daily.best}</p>
      <div class="stack">${done ? '<p class="okmsg">כבר הושלם היום! אפשר לשחק שוב לכיף.</p>' : ''}<button class="btn primary big nav autofocus" data-act="daily-start">יוצאים לדרך</button><button class="btn nav" data-act="menu">חזרה לתפריט</button></div>`, 'daily');
  },
  startDaily() {
    const D = this.daily();
    Inp.solo = true;
    this.dly = { D, i: 0, hp: null };
    this.nextDaily();
  },
  nextDaily() {
    const R = this.dly, D = R.D, m = D.mut;
    const me = ROSTER_BY_ID[D.me];
    const p1 = { id: D.me, human: true, hpMul: m.hpMul, dmgMul: m.dmgMul, scale: m.scale, grav: m.grav, meterMul: m.meter, startMeter: m.startMeter };
    const p2 = { id: D.foes[R.i], level: 0.45 + R.i * 0.14, hpMul: (m.hpMul || 1) * (1 + R.i * 0.06), dmgMul: m.dmgMul, scale: m.scale, grav: m.grav, meterMul: m.meter, startMeter: m.startMeter };
    if (R.hp !== null) p1.startHp = R.hp;
    this.startFight({ mode: 'daily', p1, p2, stage: D.stages[R.i], rounds: 1, time: 50, speed: m.speed || 1, label: `${m.name} · קרב ${R.i + 1} מתוך 3`, onDone: (res) => this.dailyDone(res) });
  },
  dailyDone(res) {
    const R = this.dly, D = R.D, S = Save.d;
    if (!res.won) {
      this.card(`${this.winnerBanner(res)}<p class="next">האתגר נכשל בקרב ${R.i + 1}.</p><div class="stack"><button class="btn primary big nav autofocus" data-act="retry">נסו שוב את הקרב</button><button class="btn nav" data-act="menu">יציאה</button></div>`);
      return;
    }
    R.i++;
    R.hp = Math.min(res.B.f[0].maxHp, res.hpLeft + res.B.f[0].maxHp * 0.25);
    if (R.i >= 3) {
      if (!S.daily.done[D.key]) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
        S.daily.streak = S.daily.done[yk] ? S.daily.streak + 1 : 1;
        S.daily.best = Math.max(S.daily.best, S.daily.streak);
        S.daily.done[D.key] = true;
      }
      Save.save(); this.checkAch();
      this.card(`<h2>האתגר היומי הושלם!</h2><p class="endtxt">רצף: ${S.daily.streak} ימים. חוזרים מחר לחוק חדש.</p>${this.statsLine(res)}<div class="stack"><button class="btn primary big nav autofocus" data-act="menu">חזרה לתפריט</button></div>`);
      Snd.play('crowd');
      return;
    }
    this.card(`${this.winnerBanner(res)}<p class="next">מרפאים 25%. הקרב הבא מתחיל מיד.</p><div class="stack"><button class="btn primary big nav autofocus" data-act="daily-next">לקרב הבא</button><button class="btn nav" data-act="menu">יציאה לתפריט</button></div>`);
  },
};
Game.actExtra = { 'daily-next': () => Game.nextDaily() };
const _gameAct = Game.act.bind(Game);
Game.act = function (name, el) { if (Game.actExtra[name]) return Game.actExtra[name](el); return _gameAct(name, el); };

// ---- Scripted move demo for the character-select preview ----
function makeDemo(def) {
  const M = def.moves;
  const seq = [
    { say: 'מכה קלה: ' + M.L.name, go: 105 }, { press: IN.A, wait: 18 }, { press: IN.A, wait: 8 }, { say: 'קומבו: ' + M.L.name + ' ← ' + M.H.name, press: IN.B, wait: 40 },
    { say: 'מכה מלמעלה: ' + M.FH.name, go: 90 }, { press: IN.B | IN.R, wait: 60, fwd: true },
    { say: 'אפרקאט: ' + M.DH.name, go: 90 }, { press: IN.D | IN.B, wait: 70 },
    { say: 'מיוחד 1: ' + M.sp1.name, go: 300, away: true }, { press: IN.C, wait: 120 },
    { say: 'מיוחד 2: ' + M.sp2.name, go: 260 }, { press: IN.E, wait: 130 },
    { say: 'סופר: ' + M.sup.name, go: 250, meter: true }, { press: IN.S, wait: 230 },
    { say: 'זריקה', go: 70 }, { press: IN.A | IN.B, wait: 90 },
  ];
  let i = 0, wait = 0, pressLeft = 0, pressBits = 0, stepT = 0;
  const ctrl = (f, B) => {
    const o = f.opp;
    if (!o || B.phase !== 'fight') return 0;
    if (wait > 0) { wait--; return pressLeft-- > 0 ? pressBits : 0; }
    const s = seq[i % seq.length];
    if (s.say) B.demoLabel = s.say;
    if (s.meter) f.meter = 100;
    if (s.go && stepT++ < 110) {      // walk to the wanted distance (give up after ~2s, e.g. when pinned against a wall)
      const dx = o.x - f.x, d = Math.abs(dx), toward = dx > 0 ? IN.R : IN.L, away = dx > 0 ? IN.L : IN.R;
      if (d > s.go + 14) return toward;
      if (d < s.go - 14) return away;
    }
    stepT = 0;
    if (s.press) { pressBits = s.press; pressLeft = 2; wait = s.wait || 10; i++; return pressBits; }
    i++;
    return 0;
  };
  return ctrl;
}

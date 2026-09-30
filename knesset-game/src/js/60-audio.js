// ===== Audio: fully synthesised SFX + a small step-sequenced soundtrack (no audio files) =====
const Snd = {
  ctx: null, master: null, sfxG: null, musG: null, noiseBuf: null,
  vol: { sfx: 0.8, music: 0.5 }, muted: false, quiet: false,
  music: { name: null, step: 0, nextT: 0, timer: 0, track: null, bus: null },
  last: {}, tryAt: 0, watchT: 0, watchLast: -1, stuck: 0, gestured: false,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 5;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.vol.sfx; this.sfxG.connect(this.master);
      this.musG = this.ctx.createGain(); this.musG.gain.value = this.vol.music * 0.5; this.musG.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ctx.onstatechange = () => { if (this.ctx && this.ctx.state === 'running') this.stuck = 0; };
      this.iosUnlock();
    } catch (e) { this.ctx = null; }
    if (!this.watchT) this.watchT = setInterval(() => this.watch(), 1000);
  },

  // iPhones stay silent while the ring switch is on unless the page plays "media": ask for the playback audio session, and loop an inaudible clip
  iosUnlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    if (!/iP(hone|ad|od)/.test(navigator.userAgent) || this.silentEl) return;
    try {
      const a = document.createElement('audio');
      a.src = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='; a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01;
      this.silentEl = a; const p = a.play(); if (p && p.catch) p.catch(() => { this.silentEl = null; });
    } catch (e) { this.silentEl = null; }
  },

  // The browser can switch the audio off behind our back (phone call, locked screen, another tab, "interrupted" on iOS, a stalled page).
  // Anything that is not "running" is retried on every gesture / when the page comes back; a context that is closed or frozen is rebuilt.
  // (the browser only lets audio start after the player touched the page; before that we do not even try, which keeps the console quiet)
  canAuto() { return this.gestured || !!(navigator.userActivation && navigator.userActivation.hasBeenActive); },
  resume(force) {
    const c = this.ctx;
    if (!force && !this.canAuto()) return;
    if (!c) { this.init(); return; }
    if (c.state === 'closed' || this.stuck >= 3) { this.rebuild(); return; }
    if (c.state !== 'running') {
      const now = performance.now();
      if (now - this.tryAt < 250) return;
      this.tryAt = now;
      try { const p = c.resume(); if (p && p.catch) p.catch(() => { /* needs a gesture */ }); } catch (e) { /* ignore */ }
    }
    this.iosUnlock();
  },
  rebuild() {
    const keep = this.music.name;
    this.stopMusic();
    try { if (this.ctx && this.ctx.state !== 'closed') this.ctx.close(); } catch (e) { /* ignore */ }
    this.ctx = null; this.stuck = 0; this.silentEl = null;
    this.init();
    if (this.ctx) { this.setVol('sfx', this.vol.sfx); this.setVol('music', this.vol.music); this.setMuted(this.muted); if (keep) this.playMusic(keep); }
  },
  // once a second: if the clock of a "running" context does not advance, the audio is frozen
  watch() {
    const c = this.ctx;
    if (!c || document.hidden) { this.watchLast = -1; return; }
    if (c.state === 'running') {
      if (this.watchLast >= 0 && c.currentTime - this.watchLast < 0.05) this.stuck++; else this.stuck = 0;
      this.watchLast = c.currentTime;
      if (this.stuck >= 3) this.resume();
    } else { this.watchLast = -1; this.resume(); }
  },

  setVol(kind, v) {
    this.vol[kind] = v;
    if (!this.ctx) return;
    if (kind === 'sfx') this.sfxG.gain.value = v;
    else this.musG.gain.value = v * 0.5;
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  },

  // ---- primitives ----
  tone(freq, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    const v = (o.vol === undefined ? 0.25 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    let out = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    out.connect(o.dest || this.sfxG);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },

  noise(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const g = c.createGain();
    const v = (o.vol === undefined ? 0.3 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1500, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    f.Q.value = o.q || 0.9;
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxG);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  },

  // ---- SFX ----
  play(name, o) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') { this.resume(); return; }
    if (this.quiet && !UI_SOUNDS.has(name)) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    const fn = SFX[name];
    if (fn) { try { fn(this, o || {}); } catch (e) { /* audio must never break the game */ } }
  },

  // ---- Music ----
  playMusic(name) {
    if (!this.ctx) { this.music.pending = name; return; }
    if (this.music.name === name && this.music.timer) return;
    this.stopMusic();
    const tr = TRACKS[name];
    if (!tr) return;
    const m = this.music, c = this.ctx;
    m.name = name; m.track = tr; m.step = 0; m.nextT = c.currentTime + 0.08;
    try { m.bus = c.createGain(); m.bus.connect(this.musG); } catch (e) { m.bus = null; }
    m.timer = setInterval(() => this.pump(), 40);
  },
  stopMusic() {
    const m = this.music;
    if (m.timer) clearInterval(m.timer);
    m.timer = 0; m.name = null; m.pending = null;
    const bus = m.bus; m.bus = null;
    if (bus) {                                                         // notes that were already scheduled fade out with the old track
      try { bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
      setTimeout(() => { try { bus.disconnect(); } catch (e) { /* ignore */ } }, 700);
    }
  },
  pump() {
    const c = this.ctx, m = this.music, tr = m.track;
    if (!c || !tr) return;
    if (c.state !== 'running') { m.nextT = c.currentTime + 0.1; this.resume(); return; }
    if (m.nextT < c.currentTime - 0.25) m.nextT = c.currentTime + 0.05;      // the page stalled: skip what was missed instead of playing it all at once
    const sd = 60 / tr.bpm / 4;
    while (m.nextT < c.currentTime + 0.45) {
      tr.step(this, m.step, m.nextT, sd);
      m.nextT += sd; m.step++;
    }
  },
  mdst() { return this.music.bus || this.musG; },

  // instruments (absolute time scheduling)
  kick(t, v = 0.7) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.mdst()); o.start(t); o.stop(t + 0.22);
  },
  snare(t, v = 0.35) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    s.connect(f); f.connect(g); g.connect(this.mdst()); s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    og.gain.setValueAtTime(v * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(this.mdst()); o.start(t); o.stop(t + 0.12);
  },
  hat(t, v = 0.12, open = false) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = c.createGain(); const d = open ? 0.16 : 0.04;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.mdst()); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  },
  note(t, freq, dur, o = {}) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    osc.type = o.type || 'sawtooth'; osc.frequency.setValueAtTime(freq, t);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp || 1200, t); if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + dur);
    const v = o.vol || 0.15;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f); f.connect(g); g.connect(this.mdst()); osc.start(t); osc.stop(t + dur + 0.05);
  },
};

const UI_SOUNDS = new Set(['move', 'select', 'confirm', 'back', 'toast', 'tick', 'win', 'lose', 'round']);
const hz = (semi) => 440 * Math.pow(2, (semi - 9) / 12);   // semitones above C4 -> Hz

// ---- SFX recipes ----
const SFX = {
  hitL(s) { s.noise(0.07, { f0: 2400, f1: 900, vol: 0.5 }); s.tone(190, 0.09, { type: 'triangle', slide: 80, vol: 0.4 }); },
  hitM(s) { s.noise(0.1, { f0: 1800, f1: 500, vol: 0.6 }); s.tone(150, 0.13, { type: 'triangle', slide: 60, vol: 0.55 }); },
  hitH(s) { s.noise(0.16, { f0: 1400, f1: 300, vol: 0.75 }); s.tone(110, 0.22, { type: 'sine', slide: 36, vol: 0.8 }); s.tone(300, 0.08, { type: 'square', slide: 90, vol: 0.2 }); },
  block(s) { s.noise(0.05, { type: 'highpass', f0: 3200, vol: 0.4 }); s.tone(760, 0.09, { type: 'triangle', slide: 520, vol: 0.3 }); },
  perfect(s) { s.tone(1320, 0.18, { type: 'sine', vol: 0.3 }); s.tone(1980, 0.26, { type: 'sine', vol: 0.25, delay: 0.05 }); s.noise(0.06, { type: 'highpass', f0: 4000, vol: 0.3 }); },
  armor(s) { s.tone(220, 0.14, { type: 'square', slide: 140, vol: 0.25 }); s.noise(0.08, { f0: 3000, vol: 0.3 }); },
  swing(s) { s.noise(0.11, { f0: 700, f1: 2600, vol: 0.16, q: 1.2 }); },
  swingH(s) { s.noise(0.16, { f0: 500, f1: 2200, vol: 0.24, q: 1.1 }); },
  jump(s) { s.tone(240, 0.14, { type: 'square', slide: 520, vol: 0.13 }); },
  land(s) { s.noise(0.07, { type: 'lowpass', f0: 600, vol: 0.3 }); },
  dash(s) { s.noise(0.12, { f0: 400, f1: 1800, vol: 0.2 }); },
  cast(s) { s.tone(320, 0.2, { type: 'square', slide: 900, vol: 0.18 }); s.noise(0.12, { f0: 1200, f1: 3000, vol: 0.1 }); },
  buff(s) { s.tone(400, 0.3, { type: 'triangle', slide: 800, vol: 0.25 }); s.tone(600, 0.3, { type: 'triangle', slide: 1200, vol: 0.18, delay: 0.06 }); },
  heal(s) { s.tone(660, 0.12, { type: 'sine', vol: 0.25 }); s.tone(880, 0.16, { type: 'sine', vol: 0.25, delay: 0.09 }); s.tone(1320, 0.2, { type: 'sine', vol: 0.22, delay: 0.18 }); },
  coin(s) { s.tone(1400, 0.06, { type: 'square', vol: 0.12 }); s.tone(2100, 0.14, { type: 'square', vol: 0.12, delay: 0.05 }); },
  boom(s) { s.noise(0.5, { f0: 800, f1: 80, vol: 0.9, type: 'lowpass' }); s.tone(90, 0.5, { type: 'sine', slide: 30, vol: 0.9 }); },
  superStart(s) { s.tone(120, 0.7, { type: 'sawtooth', slide: 1400, vol: 0.28, lp: 3000 }); s.noise(0.7, { f0: 300, f1: 5000, vol: 0.3 }); s.tone(60, 0.6, { type: 'sine', vol: 0.5 }); },
  superHit(s) { s.noise(0.3, { f0: 2000, f1: 200, vol: 0.9 }); s.tone(70, 0.4, { type: 'sine', slide: 28, vol: 0.9 }); },
  ko(s) { s.tone(700, 0.9, { type: 'sawtooth', slide: 55, vol: 0.3, lp: 2000 }); s.noise(0.5, { f0: 1500, f1: 100, vol: 0.7, type: 'lowpass' }); s.tone(60, 0.8, { type: 'sine', vol: 0.7 }); },
  round(s) { [0, 4, 7].forEach((n, i) => s.tone(hz(2 + n), 0.22, { type: 'square', vol: 0.15, delay: i * 0.09 })); },
  fight(s) { s.tone(hz(2), 0.14, { type: 'square', vol: 0.2 }); s.tone(hz(9), 0.14, { type: 'square', vol: 0.2, delay: 0.1 }); s.tone(hz(14), 0.4, { type: 'sawtooth', vol: 0.22, delay: 0.2, lp: 2500 }); s.noise(0.3, { f0: 1000, f1: 4000, vol: 0.3, delay: 0.2 }); },
  win(s) { [0, 4, 7, 12, 16].forEach((n, i) => s.tone(hz(2 + n), 0.24, { type: 'square', vol: 0.16, delay: i * 0.11 })); },
  lose(s) { [7, 4, 1, -2].forEach((n, i) => s.tone(hz(2 + n), 0.3, { type: 'triangle', vol: 0.22, delay: i * 0.18 })); },
  tick(s) { s.tone(900, 0.04, { type: 'square', vol: 0.06 }); },
  move(s) { s.tone(520, 0.04, { type: 'square', vol: 0.07 }); },
  select(s) { s.tone(660, 0.05, { type: 'square', vol: 0.12 }); s.tone(990, 0.09, { type: 'square', vol: 0.12, delay: 0.05 }); },
  confirm(s) { s.tone(440, 0.07, { type: 'square', vol: 0.15 }); s.tone(660, 0.07, { type: 'square', vol: 0.15, delay: 0.06 }); s.tone(990, 0.16, { type: 'square', vol: 0.15, delay: 0.12 }); },
  back(s) { s.tone(520, 0.06, { type: 'square', vol: 0.12 }); s.tone(330, 0.1, { type: 'square', vol: 0.12, delay: 0.05 }); },
  crowd(s) { s.noise(1.4, { f0: 1800, f1: 900, vol: 0.35, q: 0.4, attack: 0.3 }); },
  toast(s) { s.tone(880, 0.08, { type: 'triangle', vol: 0.2 }); s.tone(1320, 0.18, { type: 'triangle', vol: 0.2, delay: 0.08 }); },
  siren(s) { s.tone(700, 0.2, { type: 'sawtooth', slide: 1000, vol: 0.14, lp: 2600 }); s.tone(1000, 0.2, { type: 'sawtooth', slide: 700, vol: 0.14, lp: 2600, delay: 0.2 }); },
  honk(s) { s.tone(190, 0.35, { type: 'sawtooth', vol: 0.25, lp: 900 }); s.tone(240, 0.35, { type: 'sawtooth', vol: 0.2, lp: 900 }); },
  zap(s) { s.tone(1200, 0.14, { type: 'sawtooth', slide: 200, vol: 0.2 }); s.noise(0.1, { f0: 4000, vol: 0.25 }); },
  flash(s) { s.noise(0.25, { type: 'highpass', f0: 3500, vol: 0.5 }); s.tone(2400, 0.25, { type: 'sine', slide: 600, vol: 0.2 }); },
  toasty(s) { s.tone(260, 0.1, { type: 'square', vol: 0.2 }); s.tone(390, 0.1, { type: 'square', vol: 0.2, delay: 0.1 }); s.tone(520, 0.3, { type: 'square', vol: 0.2, delay: 0.2 }); },
};

// ---- Soundtrack: Phrygian-dominant ("freygish") flavour, 16th-note step sequencer ----
const PD = [0, 1, 4, 5, 7, 8, 10];   // scale degrees in semitones
const TRACKS = {
  battle: {
    bpm: 140,
    bass: [0, -1, 0, 0, 0, -1, 12, 0, 0, -1, 0, 0, 1, -1, 0, 4,   0, -1, 0, 0, 0, -1, 12, 0, 8, -1, 7, -1, 5, -1, 4, 1],
    lead: [
      [12, -1, 16, -1, 19, -1, 16, -1, 12, -1, 16, -1, 20, -1, 19, -1],
      [12, -1, 16, -1, 19, -1, 16, -1, 13, -1, 16, -1, 19, -1, 20, 19],
      [24, -1, 22, 20, 19, -1, 16, -1, 20, -1, 19, 16, 13, -1, 12, -1],
      [12, 13, 16, 13, 12, -1, 19, -1, 20, 19, 16, 13, 12, -1, -1, -1],
    ],
    step(s, i, t, sd) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      if (k % 4 === 0) s.kick(t, 0.75);
      if (k === 10) s.kick(t, 0.5);
      if (k === 4 || k === 12) s.snare(t, 0.3);
      if (k % 2 === 0) s.hat(t, k % 4 === 2 ? 0.14 : 0.08, k === 14);
      const b = this.bass[(i % 32)];
      if (b !== -1 && (k % 2 === 0 || b !== 0)) s.note(t, hz(-22 + b), sd * 1.8, { type: 'sawtooth', vol: 0.32, lp: 500, lp2: 200 });
      if (bar >= 0) {
        const l = this.lead[bar][k];
        if (l !== -1) s.note(t, hz(2 + l), sd * 1.7, { type: 'square', vol: 0.09, lp: 3200, vib: true });
      }
    },
  },
  menu: {
    bpm: 96,
    arp: [0, 4, 7, 4, 1, 4, 8, 4, 0, 4, 7, 12, 10, 7, 4, 1],
    step(s, i, t, sd) {
      const k = i % 16, bar = Math.floor(i / 16) % 4;
      if (k === 0 || k === 8) s.kick(t, 0.5);
      if (k === 4 || k === 12) s.snare(t, 0.16);
      if (k % 2 === 0) s.hat(t, 0.06);
      const root = [0, 0, 1, 0][bar];
      if (k % 4 === 0) s.note(t, hz(-22 + root), sd * 3.5, { type: 'sine', vol: 0.5, lp: 400 });
      const a = this.arp[k] + root;
      s.note(t, hz(14 + a), sd * 2.2, { type: 'triangle', vol: 0.14, lp: 2400, lp2: 900 });
      if (k === 0) { s.note(t, hz(2 + root), sd * 14, { type: 'sawtooth', vol: 0.05, lp: 700, attack: 0.3 }); s.note(t, hz(9 + root), sd * 14, { type: 'sawtooth', vol: 0.04, lp: 700, attack: 0.4 }); }
    },
  },
  victory: {
    bpm: 128,
    step(s, i, t, sd) {
      const k = i % 16;
      if (k % 4 === 0) s.kick(t, 0.6);
      if (k % 2 === 0) s.hat(t, 0.08);
      const m = [12, -1, 16, -1, 19, -1, 24, -1, 22, -1, 19, -1, 16, -1, 12, -1][k];
      if (m !== -1) s.note(t, hz(2 + m), sd * 1.6, { type: 'square', vol: 0.1, lp: 3000, vib: true });
    },
  },
};

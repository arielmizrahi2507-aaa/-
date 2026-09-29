// ===== Input: keyboard + gamepad + touch, unified into per-player bitmasks =====
const IN = { L: 1, R: 2, U: 4, D: 8, A: 16, B: 32, C: 64, E: 128, K: 256, S: 512, G: 1024 };
// A light  B heavy  C special-1  E special-2  K block  S super  G grab

const KEYMAPS = {
  // Single player: everything is accepted, so any comfortable layout works.
  solo: {
    KeyA: IN.L, KeyD: IN.R, KeyW: IN.U, KeyS: IN.D, ArrowLeft: IN.L, ArrowRight: IN.R, ArrowUp: IN.U, ArrowDown: IN.D,
    KeyJ: IN.A, KeyZ: IN.A, KeyF: IN.A,
    KeyK: IN.B, KeyX: IN.B, KeyG: IN.B,
    KeyL: IN.C, KeyC: IN.C, KeyH: IN.C,
    KeyU: IN.E, KeyV: IN.E, KeyR: IN.E,
    KeyI: IN.K, Space: IN.K, KeyT: IN.K, ShiftLeft: IN.K,
    KeyO: IN.S, KeyB: IN.S, KeyY: IN.S,
    KeyE: IN.G, KeyN: IN.G,
  },
  p1: {
    KeyA: IN.L, KeyD: IN.R, KeyW: IN.U, KeyS: IN.D,
    KeyF: IN.A, KeyG: IN.B, KeyH: IN.C, KeyR: IN.E, KeyT: IN.K, KeyY: IN.S, KeyE: IN.G,
  },
  p2: {
    ArrowLeft: IN.L, ArrowRight: IN.R, ArrowUp: IN.U, ArrowDown: IN.D,
    Comma: IN.A, Numpad1: IN.A, Period: IN.B, Numpad2: IN.B, Slash: IN.C, Numpad3: IN.C,
    Semicolon: IN.E, Numpad5: IN.E, Quote: IN.K, Numpad0: IN.K, Enter: IN.S, NumpadEnter: IN.S, KeyM: IN.G, Numpad4: IN.G,
  },
};

const Inp = {
  keys: new Set(),
  touch: 0,
  solo: true,            // one human -> P1 accepts every key layout
  capture: false,        // true while a fight is on screen: swallow game keys
  padPrev: [],
  onPause: null,
  anyKey: null,

  init() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && this.capture) { if (this.isGameKey(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      if (this.capture && this.isGameKey(e.code)) e.preventDefault();
      if (this.capture && (e.code === 'Escape' || e.code === 'KeyP') && this.onPause) this.onPause();
      if (this.anyKey) this.anyKey(e);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touch = 0; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); this.touch = 0; } });
  },

  isGameKey(code) {
    return code in KEYMAPS.solo || code in KEYMAPS.p2;
  },

  touchSet(bit, on) { this.touch = on ? (this.touch | bit) : (this.touch & ~bit); },

  pads() {
    const list = [];
    try {
      const gp = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of gp) if (p && p.connected) list.push(p);
    } catch (e) { /* ignore */ }
    return list;
  },

  padMask(p) {
    let m = 0;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = p.buttons;
    const on = (i) => b[i] && (b[i].pressed || b[i].value > 0.5);
    if (ax < -0.45 || on(14)) m |= IN.L;
    if (ax > 0.45 || on(15)) m |= IN.R;
    if (ay < -0.55 || on(12)) m |= IN.U;
    if (ay > 0.55 || on(13)) m |= IN.D;
    if (on(2)) m |= IN.A;
    if (on(3)) m |= IN.B;
    if (on(0)) m |= IN.C;
    if (on(1)) m |= IN.E;
    if (on(4) || on(6)) m |= IN.K;
    if (on(5)) m |= IN.S;
    if (on(7)) m |= IN.G;
    return m;
  },

  read(slot) {
    let m = 0;
    const map = this.solo ? (slot === 0 ? KEYMAPS.solo : {}) : (slot === 0 ? KEYMAPS.p1 : KEYMAPS.p2);
    for (const code of this.keys) { const bit = map[code]; if (bit) m |= bit; }
    const pads = this.pads();
    if (this.solo) { if (slot === 0) for (const p of pads) m |= this.padMask(p); }
    else if (pads[slot]) m |= this.padMask(pads[slot]);
    if (slot === 0) m |= this.touch;
    // opposing directions cancel
    if ((m & IN.L) && (m & IN.R)) m &= ~(IN.L | IN.R);
    return m;
  },

  // Menu-style edge events from gamepads: returns {dx,dy,ok,back,start}
  padNav() {
    const out = { dx: 0, dy: 0, ok: false, back: false, start: false };
    const pads = this.pads();
    pads.forEach((p, i) => {
      const prev = this.padPrev[i] || {};
      const cur = { l: p.axes[0] < -0.5 || (p.buttons[14] && p.buttons[14].pressed), r: p.axes[0] > 0.5 || (p.buttons[15] && p.buttons[15].pressed),
        u: p.axes[1] < -0.5 || (p.buttons[12] && p.buttons[12].pressed), d: p.axes[1] > 0.5 || (p.buttons[13] && p.buttons[13].pressed),
        a: p.buttons[0] && p.buttons[0].pressed, b: p.buttons[1] && p.buttons[1].pressed, s: p.buttons[9] && p.buttons[9].pressed };
      if (cur.l && !prev.l) out.dx = -1;
      if (cur.r && !prev.r) out.dx = 1;
      if (cur.u && !prev.u) out.dy = -1;
      if (cur.d && !prev.d) out.dy = 1;
      if (cur.a && !prev.a) out.ok = true;
      if (cur.b && !prev.b) out.back = true;
      if (cur.s && !prev.s) out.start = true;
      this.padPrev[i] = cur;
    });
    return out;
  },
};

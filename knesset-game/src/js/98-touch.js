// ===== On-screen touch controls: floating stick + action buttons =====
const TouchUI = {
  el: null, pid: null, ox: 0, oy: 0, cache: {},

  init() {
    const el = this.el = $('#touch');
    const btn = (bit, label, cls) => `<button class="tb ${cls}" data-bit="${bit}" aria-label="${label}"><span>${label}</span><i class="cdfill"></i></button>`;
    el.innerHTML = `
      <div id="stickzone"><div id="stickbase"><div id="stickknob"></div></div><span class="hint">החליקו לתזוזה</span></div>
      <div id="tbtns">
        ${btn(IN.S, 'סופר', 's')}${btn(IN.E, 'מיוחד 2', 'e')}${btn(IN.C, 'מיוחד 1', 'c')}
        ${btn(IN.K, 'חסימה', 'k')}${btn(IN.B, 'בעיטה', 'b')}${btn(IN.A, 'אגרוף', 'a')}
      </div>
      <button id="tgrab" class="tsm" aria-label="תפיסה"><span>תפיסה</span></button>
      <button id="tdash" class="tsm" aria-label="ריצה"><span>ריצה</span></button>`;
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // action buttons (multi-touch friendly)
    $$('.tb', el).forEach((b) => {
      const bit = +b.dataset.bit;
      const down = (e) => { e.preventDefault(); Snd.init(); Snd.resume(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('down'); Inp.touchSet(bit, true); };
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); Inp.touchSet(bit, false); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    });
    $('#tdash').addEventListener('pointerdown', (e) => { e.preventDefault(); Inp.dashHit = true; $('#tdash').classList.add('down'); });
    $('#tdash').addEventListener('pointerup', () => $('#tdash').classList.remove('down'));
    $('#tdash').addEventListener('pointercancel', () => $('#tdash').classList.remove('down'));
    const grab = $('#tgrab');
    grab.addEventListener('pointerdown', (e) => { e.preventDefault(); grab.classList.add('down'); Inp.touchSet(IN.G, true); });
    const gup = () => { grab.classList.remove('down'); Inp.touchSet(IN.G, false); };
    grab.addEventListener('pointerup', gup); grab.addEventListener('pointercancel', gup);

    // floating stick
    const zone = $('#stickzone'), base = $('#stickbase'), knob = $('#stickknob');
    const STICK = IN.L | IN.R | IN.U | IN.D;
    const set = (mask) => { Inp.touch = (Inp.touch & ~STICK) | mask; };
    zone.addEventListener('pointerdown', (e) => {
      if (this.pid !== null) return;
      e.preventDefault(); Snd.init(); Snd.resume();
      this.pid = e.pointerId; zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      this.ox = e.clientX; this.oy = e.clientY;
      base.style.left = (this.ox - r.left) + 'px'; base.style.top = (this.oy - r.top) + 'px';
      base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      zone.classList.add('used');
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pid) return;
      e.preventDefault();
      let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
      const len = Math.hypot(dx, dy), max = 52;
      if (len > max) { this.ox += dx / len * (len - max); this.oy += dy / len * (len - max); dx = e.clientX - this.ox; dy = e.clientY - this.oy; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      let m = 0;
      if (dx < -16) m |= IN.L; else if (dx > 16) m |= IN.R;
      if (dy < -30) m |= IN.U; else if (dy > 26) m |= IN.D;
      set(m);
    });
    const end = (e) => {
      if (e.pointerId !== this.pid) return;
      this.pid = null; set(0); base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  },

  show(on) {
    this.el.classList.toggle('on', !!on && Game.touchEnabled());
    if (!on) { Inp.touch = 0; $$('.tb.down', this.el).forEach((b) => b.classList.remove('down')); }
  },

  // Reflect super-ready / cooldown state on the buttons
  updateHints(B) {
    if (!this.el.classList.contains('on')) return;
    const f = B.f[0];
    const st = { s: f.meter >= 99.9 ? 1 : 0, c: f.cd.sp1 > 0 || f.tm.silence > 0 ? 1 : 0, e: f.cd.sp2 > 0 || f.tm.silence > 0 ? 1 : 0 };
    for (const k in st) {
      if (this.cache[k] !== st[k]) { this.cache[k] = st[k]; const b = $('.tb.' + k, this.el); b.classList.toggle(k === 's' ? 'ready' : 'cool', !!st[k]); }
    }
    const m1 = f.moves.sp1, m2 = f.moves.sp2;
    if (m1) $('.tb.c .cdfill', this.el).style.height = (f.cd.sp1 > 0 ? clamp(f.cd.sp1 / m1.cd, 0, 1) * 100 : 0) + '%';
    if (m2) $('.tb.e .cdfill', this.el).style.height = (f.cd.sp2 > 0 ? clamp(f.cd.sp2 / m2.cd, 0, 1) * 100 : 0) + '%';
  },
};

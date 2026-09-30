// ===== In-fight overlay: one menu button (every setting lives in that menu) + the training read-out =====
const DUMMY_NAMES = { stand: 'עומד', block: 'חוסם', crouch: 'חוסם בהתכופפות', jump: 'קופץ', cpu: 'נלחם' };

const FightUI = {
  last: null,          // training: the last clean hit {name, dmg}
  statTxt: '',

  init() {
    const menu = this.menu = $('#fmenu'), bar = this.bar = $('#trainbar');
    menu.innerHTML = `${ICONS.menu}<span class="lbl">תפריט</span><span class="hold">החזק לעצירה</span><kbd>Esc</kbd>`;
    bar.innerHTML = '<div class="tstat" id="tstat"></div>';
    // the button must never take keyboard focus (Space = block and Enter = super would "click" it)
    menu.addEventListener('mousedown', (e) => e.preventDefault());
    // A mouse clicks as before. On a touch screen a quick tap does nothing (a thumb brushing the button must not stop the fight): the button has to
    // be held for half a second, and a red bar fills while it is held.
    const HOLD = 550;
    let timer = 0, ptype = '', hintAt = 0;
    const release = () => {
      if (!timer) return;
      clearTimeout(timer); timer = 0; menu.classList.remove('holding');
      const now = performance.now();
      if (now - hintAt > 3500) { hintAt = now; UI.toast('עצירה', 'כדי לעצור את הקרב מחזיקים את הכפתור חצי שנייה', 'unlock'); }
    };
    menu.addEventListener('pointerdown', (e) => {
      ptype = e.pointerType || '';
      if (ptype === 'mouse') return;
      e.preventDefault();
      UI.guardAt = [e.clientX, e.clientY];
      clearTimeout(timer); menu.classList.remove('holding'); void menu.offsetWidth; menu.classList.add('holding');
      timer = setTimeout(() => {
        timer = 0; menu.classList.remove('holding');
        UI.clickGuard = Infinity;                                   // the thumb is still down and the pause menu appears under it: ignore the release
        setTimeout(() => { if (UI.clickGuard === Infinity) UI.clickGuard = performance.now() + 400; }, 5000);
        Snd.init(); Snd.resume(); Game.togglePause();
      }, HOLD);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => menu.addEventListener(ev, (e) => {
      if ((e.pointerType || ptype) === 'mouse') return;
      if (UI.clickGuard === Infinity) UI.clickGuard = performance.now() + 400;
      release();
    }));
    menu.addEventListener('contextmenu', (e) => e.preventDefault());
    menu.addEventListener('click', (e) => {
      e.preventDefault(); menu.blur();
      const pt = e.pointerType || ptype;
      if (pt && pt !== 'mouse') return;                          // touch: only the hold opens the menu
      Snd.init(); Snd.resume(); Game.togglePause();
    });
  },

  // called whenever a fight starts
  sync() {
    const tr = !!(Game.spec && Game.spec.training);
    document.body.classList.toggle('training', tr);
    this.last = null; this.statTxt = '';
    if (tr) this.tick(Game.B, true);
  },

  // training read-out (information only, no controls): last hit and current combo
  tick(B, force) {
    if (!B || !Game.spec || !Game.spec.training) return;
    if (!force && B.frame % 6) return;
    const c = B.combo[0], l = this.last;
    let t = 'מצב אימון · תקפו וראו כאן את הנזק';
    if (l) t = `מכה אחרונה: ${l.name ? l.name + ' · ' : ''}${(Math.round(l.dmg * 10) / 10)} נזק`;
    if (c.hits >= 2) t += `  |  קומבו: ${c.hits} פגיעות, ${Math.round(c.dmg)} נזק`;
    if (t !== this.statTxt) { this.statTxt = t; $('#tstat').textContent = t; }
  },
};

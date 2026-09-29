// ===== In-fight overlay: one menu button (every setting lives in that menu) + the training read-out =====
const DUMMY_NAMES = { stand: 'עומד', block: 'חוסם', crouch: 'חוסם בהתכופפות', jump: 'קופץ', cpu: 'נלחם' };

const FightUI = {
  last: null,          // training: the last clean hit {name, dmg}
  statTxt: '',

  init() {
    const menu = this.menu = $('#fmenu'), bar = this.bar = $('#trainbar');
    menu.innerHTML = `${ICONS.menu}<span>תפריט</span><kbd>Esc</kbd>`;
    bar.innerHTML = '<div class="tstat" id="tstat"></div>';
    // the button must never take keyboard focus (Space = block and Enter = super would "click" it)
    menu.addEventListener('mousedown', (e) => e.preventDefault());
    menu.addEventListener('click', (e) => { e.preventDefault(); menu.blur(); Snd.init(); Snd.resume(); Game.togglePause(); });
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

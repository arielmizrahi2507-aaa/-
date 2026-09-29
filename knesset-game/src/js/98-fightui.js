// ===== In-fight overlay: an always-visible menu button and the training toolbar =====
const DUMMY_NAMES = { stand: 'עומד', block: 'חוסם', crouch: 'חוסם בהתכופפות', jump: 'קופץ', cpu: 'נלחם' };

const FightUI = {
  last: null,          // training: the last clean hit {name, dmg}
  statTxt: '',

  init() {
    const menu = this.menu = $('#fmenu'), bar = this.bar = $('#trainbar');
    menu.innerHTML = `${ICONS.menu}<span>תפריט</span><kbd>Esc</kbd>`;
    bar.innerHTML = `<div class="trow">
        <span class="tlabel">מצב אימון</span>
        <button type="button" tabindex="-1" data-t="reset">איפוס עמדות</button>
        <button type="button" tabindex="-1" data-t="dummy"></button>
        <button type="button" tabindex="-1" data-t="meter"></button>
        <button type="button" tabindex="-1" class="exit" data-t="exit">${ICONS.close}<span>יציאה מהאימון</span></button>
      </div><div class="tstat" id="tstat"></div>`;
    const press = (el, fn) => {
      // the buttons must never take keyboard focus (Space = block and Enter = super would "click" them)
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', (e) => { e.preventDefault(); el.blur(); Snd.init(); Snd.resume(); fn(el); });
    };
    press(menu, () => Game.togglePause());
    $$('button', bar).forEach((b) => press(b, () => Game.act('train-' + b.dataset.t)));
  },

  // labels + whether the toolbar is shown (called whenever a fight starts or a training option changes)
  sync() {
    const tr = !!(Game.spec && Game.spec.training);
    document.body.classList.toggle('training', tr);
    this.last = null; this.statTxt = '';
    if (!tr) return;
    $('[data-t=dummy]', this.bar).textContent = 'יריב: ' + DUMMY_NAMES[Game.dummy];
    $('[data-t=meter]', this.bar).textContent = 'הייפ אינסופי: ' + (Game.infMeter ? 'כן' : 'לא');
    this.tick(Game.B, true);
  },

  // training read-out: last hit and current combo
  tick(B, force) {
    if (!B || !Game.spec || !Game.spec.training) return;
    if (!force && B.frame % 6) return;
    const c = B.combo[0], l = this.last;
    let t = 'תקפו את היריב וראו כאן את הנזק';
    if (l) t = `מכה אחרונה: ${l.name ? l.name + ' · ' : ''}${(Math.round(l.dmg * 10) / 10)} נזק`;
    if (c.hits >= 2) t += `  |  קומבו: ${c.hits} פגיעות, ${Math.round(c.dmg)} נזק`;
    if (t !== this.statTxt) { this.statTxt = t; $('#tstat').textContent = t; }
  },
};

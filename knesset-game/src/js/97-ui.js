// ===== UI: menus, character select with live move demo, settings, help, achievements =====
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const ICON_SC = { roller: 0.22, tram: 0.16, train: 0.18, table: 0.2, beam: 0.3, spot: 0.2, redline: 0.22, scales: 0.32, crate: 0.5, bubble: 0.4, nova: 0.4, siren: 0.4, horn: 0.4, sign: 0.36, shield: 0.2, shieldIcon: 0.75, gavel: 0.7, mic: 0.6, dove: 0.6, letter: 0.55, ironball: 0.6, ballot: 0.6, quip: 0.6, flash: 0.32, bill: 0.6, wind: 0.6, hand: 0.6, crowd: 0.6, swap: 0.6, fist: 0.7, bolt: 0.7, coin: 0.9, scissors: 0.7, like: 0.8, heart: 0.8, star: 0.8, burekas: 0.6,
  flame: 0.9, firepillar: 0.2, slide: 0.9, unicorn: 0.34, arrow: 0.5, law: 0.75, lectern: 0.34, orange: 0.9, wave: 0.44, notice: 0.9, plug: 0.26 };
const iconCache = new Map();
function iconURL(kind, size = 64) {
  const key = kind + ':' + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  drawEnt(x, kind, size / 2, size / 2 + (kind === 'sign' ? 8 : 0), { sc: (ICON_SC[kind] || 0.5) * size / 64 * 1.5, t: 0, h: 70, r: 70, tilt: 0.2 });
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
const portCache = new Map();
function portraitURL(id, size = 128, flat = false) {
  const key = id + ':' + size + (flat ? 'f' : '');
  if (portCache.has(key)) return portCache.get(key);
  const def = ROSTER_BY_ID[id];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  drawPortrait(x, def, size / 2, size / 2, size / 2 - 4, { bg: darken(def.color, 0.55), ring: def.color, lw: 6, mouth: 'smile', flat });
  const url = c.toDataURL();
  portCache.set(key, url);
  return url;
}

const partyChip = (def) => `<span class="party" style="--pc:${def.color}">${def.partyName}${def.bloc ? ' · ' + def.bloc : ''}</span>`;
const pips = (n, max = 5) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
const cdText = (m) => (m.cd ? 'טעינה ' + (m.cd / 60).toFixed(1).replace('.0', '') + ' שנ׳' : '');

const ICONS = {
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.5 2.5zM19 12a7 7 0 0 1-.9 3.4l1.5 1.5A9 9 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1a7 7 0 0 1 5 6.7zM4.3 3 3 4.3 7.7 9H3v6h4l5 4v-6.7l4.3 4.3c-.7.5-1.4.9-2.3 1.2v2.1a9 9 0 0 0 3.6-1.8l2 2 1.3-1.3L4.3 3zM12 5 9.9 7.1 12 9.2V5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M3 5.5h18v3H3zM3 10.5h18v3H3zM3 15.5h18v3H3z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M5.6 3.5 3.5 5.6 9.9 12l-6.4 6.4 2.1 2.1L12 14.1l6.4 6.4 2.1-2.1L14.1 12l6.4-6.4-2.1-2.1L12 9.9z"/></svg>',
};

const UI = {
  cur: null,
  params: {},
  screens: {},

  // true when a click lands where the guarded finger is (the ghost click of a release); a deliberate tap on another button is not swallowed
  nearGuard(e) {
    const g = this.guardAt;
    if (!g) return true;
    if (!e.clientX && !e.clientY) return false;                                   // a click made with the keyboard has no position
    return Math.abs(e.clientX - g[0]) < 48 && Math.abs(e.clientY - g[1]) < 48;
  },

  init() {
    this.root = $('#screens');
    this.root.innerHTML = [this.tplTitle(), this.tplSelect(), this.tplVs(), this.tplSettings(), this.tplHelp(), this.tplAchv(), this.tplResult(), this.tplBills(), this.tplPause(), this.tplDaily()].join('');
    this.root.addEventListener('click', (e) => {
      if (this.clickGuard && performance.now() < this.clickGuard && this.nearGuard(e)) return;       // the finger that opened the pause menu is still on the screen: its release is not a tap on a menu button
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      Snd.init(); Snd.resume();
      this.act(t.dataset.act, t, e);
    });
    const unlock = () => { Snd.gestured = true; Snd.init(); Snd.resume(true); if (Snd.music.pending) Snd.playMusic(Snd.music.pending); };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
    document.addEventListener('keydown', (e) => this.onKey(e));
    $('#mute').addEventListener('click', () => { Snd.init(); this.setMuted(!Snd.muted); });
    this.applyMuteIcon();
    this.bindSettings();
  },

  show(name, params = {}) {
    this.cur = name; this.params = params;
    $$('.screen', this.root).forEach((s) => s.classList.toggle('on', s.id === 's-' + name));
    document.body.dataset.screen = name;
    const scr = $('#s-' + name, this.root);
    if (scr) { scr.scrollTop = 0; const h = this['enter_' + name]; if (h) h.call(this, params); }
    this.shownAt = performance.now();
    requestAnimationFrame(() => this.focusPrimary(scr));
  },
  // the main button of a screen gets the focus for mouse and gamepad players (touch players never see a focus ring)
  focusPrimary(scr) {
    const f = $('.autofocus', scr || document) || $('.nav', scr || document);
    if (f && (matchMedia('(hover:hover)').matches || Inp.dev === 'pad')) f.focus({ preventScroll: true });
  },
  hide() { $$('.screen', this.root).forEach((s) => s.classList.remove('on')); this.cur = null; document.body.dataset.screen = 'fight'; },
  overlay(name, on = true) { const s = $('#s-' + name, this.root); if (s) s.classList.toggle('on', on); },

  setMuted(m) {
    Snd.setMuted(m); Save.d.settings.muted = m; Save.save(); this.applyMuteIcon();
  },
  applyMuteIcon() { $('#mute').innerHTML = Snd.muted ? ICONS.mute : ICONS.sound; $('#mute').setAttribute('aria-label', Snd.muted ? 'הפעלת סאונד' : 'השתקה'); },

  toast(title, sub, kind = 'ach') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`;
    $('#toasts').appendChild(t);
    Snd.play('toast');
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4200);
  },

  // ---------------------------------------------------------------- key / pad navigation
  // Esc / P in a fight: running -> pause, pause card -> resume, sub-card (moves, confirm) -> back to the pause card
  onKey(e) {
    const k = e.code;
    if (Game.scene && Game.scene.kind === 'fight' && (k === 'Escape' || k === 'KeyP')) {
      e.preventDefault();
      if (e.repeat) return;
      const sub = this.cur && $('.screen.on [data-act="closemoves"], .screen.on [data-act="stay"], .screen.on [data-act="back"]');
      if (sub) sub.click(); else Game.togglePause();
      return;
    }
    if (this.cur === null || Inp.capture) return;
    if (k === 'Escape' || k === 'Backspace') {
      const b = $('.screen.on [data-act="back"], .screen.on [data-act="close"]');
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[k]) { if (e.target && /INPUT|SELECT/.test(e.target.tagName)) return; e.preventDefault(); this.nav(dirs[k][0], dirs[k][1]); }
  },
  nav(dx, dy) {
    const scr = $('.screen.on', this.root);
    if (!scr) return;
    const items = $$('.nav', scr).filter((n) => n.offsetParent !== null && !n.disabled);
    if (!items.length) return;
    const cur = document.activeElement && items.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { (items.find((n) => n.classList.contains('autofocus')) || items[0]).focus(); return; }
    const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bs = 1e9;
    for (const n of items) {
      if (n === cur) continue;
      const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const ddx = x - cx, ddy = y - cy;
      const along = dx ? ddx * dx : ddy * dy, across = dx ? Math.abs(ddy) : Math.abs(ddx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bs) { bs = score; best = n; }
    }
    if (best) { best.focus(); Snd.play('move'); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (best.dataset.act === 'pick') this.preview(best.dataset.id); }
  },
  // gamepad left / right on a slider or a drop-down changes its value (returns true when it did); wrap: cycle a drop-down on "A"
  stepControl(el, dir, wrap) {
    if (!el) return false;
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const mn = +el.min || 0, mx = +el.max || 100, step = Math.max(+el.step || 1, (mx - mn) / 10), rtl = getComputedStyle(el).direction === 'rtl';
      const v = Math.max(mn, Math.min(mx, +el.value + (rtl ? -dir : dir) * step));
      if (v !== +el.value) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); Snd.play('move'); }
      return true;
    }
    if (el.tagName === 'SELECT') {
      const n = el.options.length; let i = el.selectedIndex + dir;
      if (wrap) i = (i + n) % n; else i = Math.max(0, Math.min(n - 1, i));
      if (i !== el.selectedIndex) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); Snd.play('move'); }
      return true;
    }
    return false;
  },
  padPoll() {
    const n = Inp.padNav();   // polled every frame so the edge detection stays fresh
    if (Game.scene && Game.scene.kind === 'fight') {
      // Start pauses / resumes; B closes a sub-card or resumes
      if (n.start || (n.back && this.cur === 'pause')) { const sub = this.cur && $('.screen.on [data-act="closemoves"], .screen.on [data-act="stay"], .screen.on [data-act="back"]'); if (sub) sub.click(); else Game.togglePause(); return; }
    }
    if (this.cur === null || Inp.capture) return;
    if (n.dx && this.stepControl(document.activeElement, n.dx)) { /* a slider or a list changed */ }
    else if (n.dx || n.dy) this.nav(n.dx, n.dy);
    const fresh = performance.now() - (this.shownAt || 0) > 350;         // a button still being mashed at the end of a fight must not press "next" by accident
    if (n.ok && fresh) { const a = document.activeElement; if (a && a.click && a.closest('.screen.on') && a.tagName !== 'SELECT' && a.type !== 'range') a.click(); else if (a && a.tagName === 'SELECT') this.stepControl(a, 1, true); }
    if (n.start && fresh) {                                              // Start = the big button: confirm a choice / next fight / continue
      if (this.cur === 'select' && this.sel && !this.sel.view) this.confirmPick();
      else if (['result', 'bills', 'daily', 'vs'].includes(this.cur)) { const b = $('.screen.on .autofocus'); if (b) b.click(); }
    }
    if (n.back) { const b = $('.screen.on [data-act="back"], .screen.on [data-act="close"], .screen.on [data-act="closemoves"], .screen.on [data-act="stay"]'); if (b) b.click(); }
  },

  // ---------------------------------------------------------------- templates
  tplTitle() {
    return `<section class="screen" id="s-title">
      <div class="title-wrap">
        <div class="logo">
          <div class="l1" data-t="מכות">מכות</div>
          <div class="l2" data-t="בכנסת">בכנסת</div>
          <div class="l3">KNESSET SMACKDOWN</div>
          <p class="tag">משחק לחימה סאטירי · ${ROSTER.length} לוחמים · ${new Set(ROSTER.map((d) => d.party)).size} מפלגות · יכולת מיוחדת לכל אחד</p>
          <p class="rothint">📱 סובבו את הטלפון על הצד, והמשחק יתיישר</p>
        </div>
        <nav class="menu">
          <button class="btn primary big nav autofocus" data-act="arcade"><b>מסע לראשות הממשלה</b><small>סדרת קרבות + בוס סודי</small></button>
          <button class="btn blue big nav" data-act="quick"><b>קרב רגיל</b><small>קרב אחד נגד המחשב: בוחרים יריב, קושי וזירה</small></button>
          <button class="btn pink big nav" data-act="survival"><b>מרתון חקיקה</b><small>גלים אינסופיים, חוקים ושדרוגים</small></button>
          <button class="btn cyan big nav" data-act="daily"><b>האתגר היומי</b><small id="daily-sub">חוק חדש כל יום</small></button>
          <button class="btn big nav" data-act="versus"><b>קרב חברים</b><small>שניים על מקלדת אחת</small></button>
          <div class="menu-row">
            <button class="btn nav" data-act="training">אימון</button>
            <button class="btn nav" data-act="roster">הדמויות והמכות</button>
            <button class="btn nav" data-act="achv">הישגים</button>
            <button class="btn nav" data-act="settings">הגדרות</button>
            <button class="btn nav" data-act="help">איך משחקים</button>
          </div>
          <div class="rotbox">
            <button class="btn cyan nav" data-act="rotate-on" id="rot-on"><b>↻ <span id="rot-label">שחקו על הצד (מצב רוחב)</span></b><small>מסובב את כל המשחק, גם אם הטלפון נשאר נעול לאורך</small></button>
            <button class="btn nav" data-act="rotate-flip" id="rot-flip">↺ הפוך כיוון</button>
            <button class="btn nav" data-act="rotate-off" id="rot-off">חזרה לתצוגה רגילה</button>
          </div>
        </nav>
      </div>
      <footer class="foot">
        <span id="title-stats"></span>
        <span class="disc">פרודיה וסאטירה: כל הדמויות קריקטורות, וכל הציטוטים, היכולות והמכות בדויים. אין קשר בין המשחק לאיש מהמופיעים בו.</span>
      </footer>
    </section>`;
  },

  tplSelect() {
    return `<section class="screen" id="s-select">
      <header class="bar">
        <button class="btn ghost nav" data-act="back">חזרה</button>
        <div class="ttl"><small id="sel-mode"></small><h2 id="sel-step"></h2></div>
        <div id="sel-extra" class="extra"></div>
      </header>
      <div class="selbody">
        <div class="grid" id="grid"></div>
        <aside class="detail" id="detail">
          <div class="pvwrap"><canvas id="pv" width="480" height="270"></canvas><div id="pvstage" class="pvstage"></div><div id="pvcap" class="pvcap"></div></div>
          <div id="dinfo"></div>
        </aside>
      </div>
      <footer class="bar foot-bar"><button class="btn primary big nav" data-act="confirm" id="btn-confirm">בחירה</button></footer>
    </section>`;
  },

  tplVs() {
    return `<section class="screen" id="s-vs" data-act="skipvs">
      <div class="vs-wrap">
        <div class="vs-side l"><canvas id="vs-a" width="360" height="360"></canvas><h3 id="vs-an"></h3><div id="vs-ap"></div><q id="vs-aq"></q></div>
        <div class="vs-mid"><div class="vs-burst">VS</div></div>
        <div class="vs-side r"><canvas id="vs-b" width="360" height="360"></canvas><h3 id="vs-bn"></h3><div id="vs-bp"></div><q id="vs-bq"></q></div>
      </div>
      <div class="vs-foot"><b id="vs-stage"></b><span id="vs-info"></span><em class="vs-skip">לחצו בכל מקום כדי לדלג</em></div>
      <button class="btn ghost vs-cancel" data-act="menu">${ICONS.close}<span>ביטול</span></button>
    </section>`;
  },

  tplSettings() {
    return `<section class="screen" id="s-settings">
      <header class="bar"><button class="btn ghost nav" data-act="back" id="set-back">חזרה</button><div class="ttl"><h2>הגדרות</h2></div><span></span></header>
      <div class="panel narrow">
        <label class="row">עוצמת אפקטים<input type="range" min="0" max="100" id="set-sfx" class="nav"></label>
        <label class="row">עוצמת מוזיקה<input type="range" min="0" max="100" id="set-music" class="nav"></label>
        <label class="row">שיר הפתיחה
          <select id="set-song" class="nav"><option value="classic">הקלאסי</option><option value="new">החדש</option></select></label>
        <label class="row">רעידות מסך<input type="checkbox" id="set-shake" class="nav"></label>
        <label class="row">אפקטים מרוככים (פחות הבהובים)<input type="checkbox" id="set-calm" class="nav"></label>
        <label class="row">דמויות תלת־ממדיות (מכבים אם המשחק איטי)<input type="checkbox" id="set-3d" class="nav"></label>
        <label class="row">כפתורי מגע
          <select id="set-touch" class="nav"><option value="auto">אוטומטי</option><option value="on">תמיד</option><option value="off">כבוי</option></select></label>
        <label class="row touchonly">מצב רוחב (בטלפון שמוחזק לאורך)
          <select id="set-rotate" class="nav"><option value="auto">אוטומטי: לרוחב בטלפון</option><option value="off">כבוי</option><option value="cw">סיבוב ימינה ↻</option><option value="ccw">סיבוב שמאלה ↺</option></select></label>
        <div class="row fsonly"><button class="btn nav" data-act="fullscreen">מסך מלא</button></div>
        <label class="row nextmatch">סיבובים לניצחון
          <select id="set-rounds" class="nav"><option value="1">1 (קרב חטוף)</option><option value="2">2 (מומלץ)</option><option value="3">3 (ארוך)</option></select></label>
        <label class="row nextmatch">זמן סיבוב
          <select id="set-timer" class="nav"><option value="45">45 שניות</option><option value="60">60 שניות</option><option value="90">90 שניות</option></select></label>
        <div class="row nextmatch"><button class="btn danger nav" data-act="reset">איפוס כל ההתקדמות</button></div>
      </div>
    </section>`;
  },

  tplHelp() {
    const kb = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    return `<section class="screen" id="s-help">
      <header class="bar"><button class="btn ghost nav" data-act="back">חזרה</button><div class="ttl"><h2>איך משחקים</h2></div><span></span></header>
      <div class="panel wide help">
        <div class="cols">
          <div>
            <h3>מקלדת (שחקן יחיד)</h3>
            <table>
              ${kb('תנועה', 'A ו-D או חיצים. W קפיצה, S התכופפות')}
              ${kb('אגרוף / בעיטה', 'J או Z / K או X')}
              ${kb('מיוחד 1 / מיוחד 2', 'L או C / U או V')}
              ${kb('חסימה', 'I או רווח (מחזיקים)')}
              ${kb('סופר', 'O או B (כשההייפ מלא)')}
              ${kb('זריקה', 'E או N (או אגרוף ובעיטה יחד), מקרוב')}
              ${kb('ריצה / נסיגה', 'לחיצה כפולה על כיוון')}
              ${kb('הפסקה', 'Esc או P')}
            </table>
            <h3>שני שחקנים</h3>
            <table>
              ${kb('שחקן 1', 'WASD · F,G,H,R,T,Y')}
              ${kb('שחקן 2', 'חיצים · פסיק, נקודה, סלש, נקודה-פסיק, גרש, Enter')}
              ${kb('שלט משחק', 'X אגרוף · Y בעיטה · A מיוחד 1 · B מיוחד 2 · LB חסימה · RB סופר · RT זריקה · Start הפסקה. הסבר מלא למטה')}
            </table>
          </div>
          <div>
            <h3>כללי הקרב</h3>
            <ul>
              <li><b>מנדטים:</b> הם החיים. מי שיורד ל-0 נופל מתחת לאחוז החסימה.</li>
              <li><b>הייפ:</b> מתמלא ממכות ומהגנה. כשהוא מלא, לחצו סופר לסרטון-על.</li>
              <li><b>יכולות מיוחדות:</b> אין עלות, יש זמן טעינה (הסמלים שמתחת לפס ההייפ).</li>
              <li><b>חסימה:</b> החזיקו חסימה. מכה נמוכה דורשת חסימה מכופפת, מכה מלמעלה דורשת חסימה עומדת.</li>
              <li><b>בלוק מושלם:</b> לחצו חסימה ממש לפני הפגיעה: בלי נזק, והיריב נתקע.</li>
              <li><b>קומבו:</b> אגרוף, אגרוף, בעיטה, ואז יכולת מיוחדת. כל פגיעה ברצף חלשה קצת יותר.</li>
              <li><b>זריקה:</b> כפתור זריקה (או אגרוף ובעיטה יחד) מקרוב: עוקפת חסימה.</li>
              <li><b>טיפ:</b> רוצים לראות כל מכה? בחירת דמות מראה הדגמה חיה.</li>
            </ul>
            <h3>כפתורי מגע</h3>
            <p>מקל התנועה משמאל: החליקו ימינה/שמאלה, למעלה לקפיצה, למטה להתכופפות. כפתורי הפעולה מימין. שני הכפתורים הקטנים שלידם הם ריצה וזריקה.</p>
          </div>
        </div>
        <h3 class="padh">🎮 שלט משחק: איך מפעילים יכולות</h3>
        ${Controls.padHTML()}
      </div>
    </section>`;
  },

  tplAchv() {
    return `<section class="screen" id="s-achv">
      <header class="bar"><button class="btn ghost nav" data-act="back">חזרה</button><div class="ttl"><h2>הישגים</h2><small id="achv-count"></small></div><span></span></header>
      <div class="panel wide"><div class="achv-grid" id="achv-grid"></div><div id="stats-box" class="stats-box"></div></div>
    </section>`;
  },

  tplResult() {
    return `<section class="screen" id="s-result"><div class="res-card" id="res-card"></div></section>`;
  },
  tplBills() {
    return `<section class="screen" id="s-bills"><div class="res-card wide-card" id="bills-card"></div></section>`;
  },
  tplPause() {
    return `<section class="screen dim" id="s-pause"><div class="res-card pause-card">
      <h2>הפסקה</h2>
      <p class="pmode" id="pause-mode"></p>
      <div class="stack">
        <button class="btn primary big nav autofocus" data-act="resume">המשך לשחק</button>
        <div id="pause-train" class="stack"></div>
        <div class="two">
          <button class="btn nav" data-act="restart">התחלה מחדש</button>
          <button class="btn nav" data-act="pause-moves">המכות שלי</button>
        </div>
        <button class="btn nav" data-act="pause-controls">🎮 בקרות: מה לוחצים</button>
        <div class="two">
          <button class="btn nav" data-act="pause-settings">הגדרות</button>
          <button class="btn nav" data-act="pause-sound">סאונד: <span id="pause-snd"></span></button>
        </div>
        <button class="btn danger nav" data-act="quit">${ICONS.close}<span id="pause-quit">יציאה לתפריט הראשי</span></button>
      </div>
      <p class="keyhint">במקלדת: Esc או P להמשך</p>
    </div></section>`;
  },
  tplDaily() {
    return `<section class="screen" id="s-daily"><div class="res-card" id="daily-card"></div></section>`;
  },

  // ---------------------------------------------------------------- Title
  enter_title() {
    Game.setScene('attract');
    const s = Save.d;
    const rk = rankOf(s.wins);
    $('#title-stats').textContent = `דרגה: ${rk.name}${rk.next ? ' (עוד ' + rk.next + ' ניצחונות ל' + rk.nextName + ')' : ''} · ניצחונות: ${s.wins} · שיא במרתון: גל ${s.survivalBest} · הישגים: ${Object.keys(s.ach).length}/${ACHIEVEMENTS.length}`;
    const dk = todayKey();
    $('#daily-sub').textContent = s.daily.done[dk] ? 'הושלם היום! רצף: ' + s.daily.streak : (s.daily.streak ? 'רצף נוכחי: ' + s.daily.streak : 'חוק חדש כל יום');
    Snd.playMusic('menu');
    if (Game.rot && !s.settings.rotHinted) {         // a phone held upright: the game turns itself to landscape, so tell the player once
      s.settings.rotHinted = true; Save.save();
      setTimeout(() => UI.toast('סובבו את הטלפון על הצד', 'המשחק מיועד לרוחב ומסתובב לבד. אם הוא הפוך, לחצו "הפוך כיוון" בתפריט', 'unlock'), 700);
    }
  },

  // ---------------------------------------------------------------- Select
  enter_select(p) {
    Game.setScene('none');
    const S = this.sel = { mode: p.mode, step: p.step || 0, picks: p.picks || [], hover: null, diff: (this.sel && this.sel.diff !== undefined) ? this.sel.diff : 1, stage: (this.sel && this.sel.stage) || 'random', view: p.mode === 'roster' };
    const titles = { arcade: 'מסע לראשות הממשלה', survival: 'מרתון חקיקה', quick: 'קרב רגיל נגד המחשב', versus: 'קרב חברים', training: 'אימון', roster: 'הדמויות והמכות' };
    $('#sel-mode').textContent = titles[p.mode] || '';
    const steps = {
      arcade: ['בחרו לוחם'], survival: ['בחרו לוחם'], roster: ['הדמויות והמכות'], quick: ['בחרו לוחם', 'בחרו יריב'],
      versus: ['שחקן 1: בחרו לוחם', 'שחקן 2: בחרו לוחם'], training: ['בחרו לוחם', 'בחרו יריב לאימון'],
    };
    $('#sel-step').textContent = steps[p.mode][S.step];
    // grid
    const all = ROSTER.concat(EXTRA);
    $('#grid').innerHTML = all.map((d) => {
      const locked = !Save.isUnlocked(d);
      return `<button class="card nav ${locked ? 'locked' : ''}" data-act="pick" data-id="${d.id}" style="--pc:${d.color}">
        <img src="${portraitURL(d.id, 128, true)}" alt=""><b>${locked ? '???' : d.short}</b><span>${locked ? 'נעול' : d.partyName}</span></button>`;
    }).join('');
    // extras (difficulty / stage)
    let extra = '';
    const diffSeg = `<div class="seg" id="diff-seg">${['קל', 'בינוני', 'קשה'].map((t, i) => `<button class="nav ${S.diff === i ? 'on' : ''}" data-act="diff" data-v="${i}">${t}</button>`).join('')}</div>`;
    if (p.mode === 'arcade') extra = diffSeg;
    if (p.mode === 'quick') extra = diffSeg + `<div class="seg stg"><button class="nav" data-act="stage-prev">▶</button><b id="stage-name"></b><button class="nav" data-act="stage-next">◀</button></div>` + (S.step === 1 ? `<button class="btn nav" data-act="rand-opp">🎲 יריב אקראי</button>` : '');
    if (p.mode === 'versus' || p.mode === 'training') extra = `<div class="seg stg"><button class="nav" data-act="stage-prev">▶</button><b id="stage-name"></b><button class="nav" data-act="stage-next">◀</button></div>`;
    $('#sel-extra').innerHTML = extra;
    this.updateStageName();
    $('#btn-confirm').style.display = S.view ? 'none' : '';
    const lp = ROSTER_BY_ID[Save.d.lastPick];                  // a fighter that no longer exists (an older version of the game) is ignored
    const first = S.picks[S.step - 1] || (S.mode === 'roster' ? 'bibi' : (lp && Save.isUnlocked(lp) ? lp.id : 'bibi'));
    this.preview(first, true);
    Snd.playMusic('menu');
  },
  updateStageName() {
    const n = $('#stage-name'), b = $('#pvstage');
    const S = this.sel;
    const txt = S.stage === 'random' ? 'זירה: אקראית' : 'זירה: ' + STAGES.find((s) => s.id === S.stage).name;
    if (b) { b.textContent = n ? txt : ''; b.style.display = n ? '' : 'none'; }                  // the arena is named on the preview too (only where an arena can be chosen)
    if (n) n.textContent = txt;
  },
  preview(id, force) {
    const S = this.sel;
    if (!S || (!force && S.hover === id)) return;
    const def = ROSTER_BY_ID[id];
    if (!def) return;
    S.hover = id;
    $$('#grid .card').forEach((c) => { c.classList.toggle('sel', c.dataset.id === id); c.classList.toggle('autofocus', c.dataset.id === id); });
    const locked = !Save.isUnlocked(def);
    $('#btn-confirm').disabled = locked;
    $('#btn-confirm').textContent = locked ? 'נעול: ' + def.unlock.text : (S.mode === 'arcade' || S.mode === 'survival' ? 'יוצאים לדרך' : (S.mode === 'versus' && S.step === 0 ? 'שחקן 1 בחר. הלאה' : ((S.mode === 'training' || S.mode === 'quick') && S.step === 0 ? 'הלאה: בחירת יריב' : (S.mode === 'quick' ? 'לקרב!' : 'בחירה'))));
    $('#dinfo').innerHTML = this.detailHTML(def, locked);
    Game.setScene('preview', { id, stage: S.mode === 'quick' || S.mode === 'versus' || S.mode === 'training' ? S.stage : null });
  },
  detailHTML(def, locked) {
    const r = def.rating;
    const mv = (label, m, cls, key) => `<div class="mv ${cls || ''}"><img src="${iconURL(m.icon || 'star')}" alt=""><div><b><em>${label}${key ? Controls.tag(key) : ''}</em> ${m.name}</b> <span class="cdc">${cls === 'sup' ? 'דורש הייפ מלא' : cdText(m)}</span><p>${m.desc}</p></div></div>`;
    const nm = def.moves;
    return `<div class="dwrap" style="--pc:${def.color}"><div class="dhead">
        <img src="${portraitURL(def.id)}" alt="">
        <div><h3>${def.name}</h3>${partyChip(def)} <span class="arch">${def.title} · ${def.arch}</span><p class="role">${def.role}</p></div>
      </div>
      <p class="blurb">${def.blurb}</p>
      ${locked ? `<p class="lockmsg">נעול. כדי לפתוח: ${def.unlock.text}.</p>` : ''}
      <div class="stats">${[['כוח', r.pow], ['מהירות', r.spd], ['הגנה', r.def], ['טווח', r.rng], ['קושי', r.dif]].map(([n, v]) => `<div><span>${n}</span><span class="pips">${pips(v)}</span></div>`).join('')}</div>
      <div class="passive"><h4>יכולת מיוחדת · ${def.passive.name}</h4><p>${def.passive.desc}</p></div>
      <div class="moves">
        ${mv('מיוחד 1', nm.sp1, '', 'sp1')}${mv('מיוחד 2', nm.sp2, '', 'sp2')}${mv('סופר', nm.sup, 'sup', 'sup')}
        <div class="normals"><h4>המכות הרגילות</h4>
          <ul><li><em>אגרוף${Controls.tag('L')}</em> ${nm.L.name}</li><li><em>בעיטה${Controls.tag('H')}</em> ${nm.H.name}</li><li><em>קדימה+בעיטה</em> ${nm.FH.name}</li>
          <li><em>למטה+אגרוף</em> ${nm.DL.name}</li><li><em>למטה+בעיטה</em> ${nm.DH.name}</li><li><em>באוויר</em> ${nm.AL.name} / ${nm.AH.name}</li></ul></div>
      </div>
      <p class="asof">המפלגה והתפקיד נכונים ל-${VERIFIED_ON}. המכות, היכולות והכינויים בדויים, לצחוק בלבד.</p></div>`;
  },

  // ---------------------------------------------------------------- Achievements
  enter_achv() {
    Game.setScene('none');
    const d = Save.d;
    $('#achv-count').textContent = `${Object.keys(d.ach).length} מתוך ${ACHIEVEMENTS.length}`;
    $('#achv-grid').innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach ${d.ach[a.id] ? 'got' : ''}"><b>${a.name}</b><span>${a.desc}</span></div>`).join('');
    $('#stats-box').innerHTML = `<h3>הסטטיסטיקה שלכם</h3><div class="sgrid">${[
      ['ניצחונות', d.wins], ['הפסדים', d.losses], ['הפלות (KO)', d.ko], ['סופרים', d.supers], ['בלוקים מושלמים', d.perfects], ['זריקות', d.throws], ['קומבו שיא', d.bestCombo], ['גל שיא במרתון', d.survivalBest],
    ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`;
  },

  // ---------------------------------------------------------------- Settings
  enter_settings(p) {
    const inFight = !!(p && p.keepScene);       // opened from the pause menu: the paused fight stays underneath
    if (!inFight) Game.setScene('none');
    $$('#s-settings .nextmatch').forEach((r) => { r.style.display = inFight ? 'none' : ''; });
    $('#set-back').textContent = inFight ? 'חזרה להפסקה' : 'חזרה';
    const s = Save.d.settings;
    $('#set-sfx').value = Math.round(s.sfx * 100); $('#set-music').value = Math.round(s.music * 100);
    $('#set-shake').checked = s.shake; $('#set-calm').checked = s.calm; $('#set-3d').checked = s.gfx3d !== false; $('#set-touch').value = s.touch; $('#set-rotate').value = s.rotateSet ? (s.rotate || 'auto') : 'auto';
    $('#set-rounds').value = String(s.rounds); $('#set-timer').value = String(s.timer);
    $('#set-song').value = s.lobbySong === 'new' ? 'new' : 'classic';
  },
  bindSettings() {
    const s = () => Save.d.settings;
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    on('#set-sfx', 'input', (e) => { s().sfx = e.target.value / 100; Snd.init(); Snd.setVol('sfx', s().sfx); Snd.play('hitM'); Save.save(); });
    on('#set-music', 'input', (e) => { s().music = e.target.value / 100; Snd.init(); Snd.setVol('music', s().music); Save.save(); });
    on('#set-song', 'change', (e) => { s().lobbySong = e.target.value === 'new' ? 'new' : 'classic'; Save.save(); Snd.init(); const n = Snd.music.name; if (n === 'menu' || n === 'menu2') Snd.playMusic('menu'); });
    on('#set-shake', 'change', (e) => { s().shake = e.target.checked; Save.save(); Game.applySettings(); });
    on('#set-calm', 'change', (e) => { s().calm = e.target.checked; Save.save(); Game.applySettings(); });
    on('#set-3d', 'change', (e) => { s().gfx3d = e.target.checked; Save.save(); Game.applySettings(); });
    on('#set-touch', 'change', (e) => { s().touch = e.target.value; Save.save(); Game.layout(); });
    on('#set-rotate', 'change', (e) => { Game.setRotate(e.target.value); });
    on('#set-rounds', 'change', (e) => { s().rounds = +e.target.value; Save.save(); });
    on('#set-timer', 'change', (e) => { s().timer = +e.target.value; Save.save(); });
  },

  // ---------------------------------------------------------------- actions
  act(name, el) {
    const S = this.sel;
    switch (name) {
      case 'arcade': case 'survival': case 'quick': case 'versus': case 'training': case 'roster':
        Snd.play('confirm'); this.show('select', { mode: name }); break;
      case 'daily': Snd.play('confirm'); Game.dailyIntro(); break;
      case 'settings': case 'help': case 'achv': Snd.play('confirm'); this.show(name); break;
      case 'back': Snd.play('back'); this.back(); break;
      case 'pick': {
        const id = el.dataset.id;
        if (S.hover === id && !S.view) { this.confirmPick(); break; }   // second tap on the same card confirms
        Snd.play('select'); this.preview(id);
        break;
      }
      case 'diff': S.diff = +el.dataset.v; $$('#diff-seg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === S.diff)); Snd.play('move'); break;
      case 'stage-next': case 'stage-prev': {
        const ids = ['random'].concat(STAGES.map((s) => s.id));
        let i = ids.indexOf(S.stage) + (name === 'stage-next' ? 1 : -1);
        i = (i + ids.length) % ids.length; S.stage = ids[i]; this.updateStageName(); Game.setPreviewStage(S.stage); Snd.play('move'); break;
      }
      case 'rand-opp': {
        const pool = ROSTER.filter((d) => Save.isUnlocked(d) && d.id !== S.picks[0] && d.id !== S.hover);
        if (pool.length) { Snd.play('select'); this.preview(pool[(Math.random() * pool.length) | 0].id); }
        break;
      }
      case 'confirm': this.confirmPick(); break;
      case 'reset':
        if (confirm('לאפס את כל ההתקדמות, ההישגים והסטטיסטיקה?')) { localStorage.removeItem(Save.key); Save.load(); Game.applySettings(); this.show('title'); Snd.play('back'); }
        break;
      default: Game.act(name, el); break;
    }
  },
  back() {
    if (Game.paused && this.cur === 'settings') { Game.pauseOpen(); return; }
    const S = this.sel;
    if (this.cur === 'select' && S && S.step > 0 && (S.mode === 'versus' || S.mode === 'training' || S.mode === 'quick')) { this.show('select', { mode: S.mode, step: S.step - 1, picks: S.picks.slice(0, S.step - 1) }); return; }
    Game.setScene('attract');
    this.show('title');
  },
  confirmPick() {
    const S = this.sel;
    const id = S.hover;
    const def = ROSTER_BY_ID[id];
    if (!def || !Save.isUnlocked(def)) { Snd.play('back'); return; }
    Snd.play('confirm');
    Save.d.lastPick = S.step === 0 ? id : Save.d.lastPick;
    const picks = S.picks.slice(0, S.step); picks[S.step] = id;
    if ((S.mode === 'versus' || S.mode === 'training' || S.mode === 'quick') && S.step === 0) { this.show('select', { mode: S.mode, step: 1, picks }); return; }
    Game.beginMode(S.mode, picks, { diff: S.diff, stage: S.stage });
  },
};

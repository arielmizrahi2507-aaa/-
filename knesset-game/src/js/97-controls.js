// ===== Controls help: what to press on the device the player is using (keyboard, gamepad, touch) =====
const CTL = {
  kb:  { L: 'J', H: 'K', sp1: 'L', sp2: 'U', block: 'I', sup: 'O', grab: 'E' },
  pad: { L: 'X', H: 'Y', sp1: 'A', sp2: 'B', block: 'LB', sup: 'RB', grab: 'RT' },
};
const PAD_COL = { A: '#38b56a', B: '#e23b52', X: '#3c8cff', Y: '#f4c81d' };

const Controls = {
  seen: {},

  // a small key cap for the current device, appended to a move's name ("" on touch screens)
  tag(key) {
    const t = CTL[Inp.device()];
    return t && t[key] ? ` <kbd class="kcap">${t[key]}</kbd>` : '';
  },
  chip(k, extra = '') { return `<span class="pk" style="--k:${PAD_COL[k] || '#4a3a8a'}">${k}${extra}</span>`; },

  // the drawing only has Latin letters inside (so text direction cannot mix them up); everything Hebrew is in the legend next to it
  padSVG() {
    const face = (x, y, k) => `<circle cx="${x}" cy="${y}" r="13" fill="${PAD_COL[k]}" stroke="#150c2a" stroke-width="2.5"/><text x="${x}" y="${y + 5.5}" text-anchor="middle" class="pt1">${k}</text>`;
    const key = (x, y, w, h, t, hot) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2 - 1}" fill="${hot ? '#ffd23d' : '#3a2f6a'}" stroke="#150c2a" stroke-width="2.5"/><text x="${x + w / 2}" y="${y + h / 2 + 4.6}" text-anchor="middle" class="pt2" fill="${hot ? '#2b1400' : '#fff'}">${t}</text>`;
    return `<svg class="padsvg" viewBox="0 0 560 300" role="img" aria-label="שלט משחק">
      ${key(132, 56, 74, 24, 'LT', 1)}${key(354, 56, 74, 24, 'RT', 1)}${key(116, 84, 100, 20, 'LB', 1)}${key(344, 84, 100, 20, 'RB', 1)}
      <path d="M150 108 Q118 108 96 154 Q64 228 80 270 Q92 294 118 276 Q142 256 162 228 L398 228 Q418 256 442 276 Q468 294 480 270 Q496 228 464 154 Q442 108 410 108 Z" fill="#2c2260" stroke="#150c2a" stroke-width="4"/>
      <circle cx="190" cy="154" r="27" fill="#1c1540" stroke="#150c2a" stroke-width="3"/><circle cx="190" cy="154" r="16" fill="#ffd23d" stroke="#150c2a" stroke-width="2.5"/>
      <path d="M233 180 h14 v14 h14 v14 h-14 v14 h-14 v-14 h-14 v-14 h14 z" fill="#1c1540" stroke="#150c2a" stroke-width="2.5"/>
      <circle cx="330" cy="200" r="22" fill="#1c1540" stroke="#150c2a" stroke-width="3"/><circle cx="330" cy="200" r="12" fill="#3a2f6a"/>
      ${face(382, 128, 'Y')}${face(356, 154, 'X')}${face(408, 154, 'B')}${face(382, 180, 'A')}
      ${key(250, 144, 34, 16, '', 0)}${key(296, 144, 34, 16, '', 1)}
      <text x="313" y="177" text-anchor="middle" class="pt2" fill="#ffd23d">START</text>
    </svg>`;
  },

  padHTML() {
    const row = (k, name, note) => `<div class="pr">${k}<div><b>${name}</b>${note ? `<small>${note}</small>` : ''}</div></div>`;
    return `<div class="padhelp">
      <div class="padfig">${this.padSVG()}<p class="padnote">בשלט פלייסטיישן:<br><bdi dir="ltr">✕ = A · ○ = B · □ = X · △ = Y</bdi><br><bdi dir="ltr">L1 = LB · R1 = RB · R2 = RT</bdi></p></div>
      <div class="padlist">
        ${row(this.chip('X'), 'אגרוף', 'מהיר')}
        ${row(this.chip('Y'), 'בעיטה', 'חזקה ואיטית יותר')}
        ${row(this.chip('A'), 'יכולת מיוחדת 1', 'היכולת הראשונה של הדמות')}
        ${row(this.chip('B'), 'יכולת מיוחדת 2', 'היכולת השנייה של הדמות')}
        ${row(this.chip('RB'), 'סופר', 'כשפס ההייפ מלא (כתוב "סופר מוכן")')}
        ${row(this.chip('LB') + this.chip('LT'), 'חסימה', 'מחזיקים. חסימה עם חץ למטה חוסמת מכות נמוכות')}
        ${row(this.chip('RT'), 'זריקה', 'מקרוב, עוקפת חסימה')}
        ${row(this.chip('✥'), 'תנועה', 'מקל שמאלי או חיצים. למעלה קפיצה, למטה התכופפות, לחיצה כפולה לריצה')}
        ${row(this.chip('Start'), 'הפסקה ותפריט', 'בתפריטים: מקל לניווט, <bdi>A</bdi> אישור, <bdi>B</bdi> חזרה, <bdi>Start</bdi> אישור מהיר')}
      </div>
      <ol class="padsteps">
        <li><b>איך מפעילים יכולת:</b> מתחת לפס ההייפ של כל לוחם יש שני סמלים. כשעוברים לשלט מופיעה עליהם האות של הכפתור (<bdi>A</bdi> או <bdi>B</bdi>).</li>
        <li>סמל בהיר: היכולת מוכנה. סמל כהה שמתמלא: היא בטעינה. אין עלות, רק זמן טעינה.</li>
        <li>לחצו <b><bdi>A</bdi></b> או <b><bdi>B</bdi></b> בזמן שאתם קרובים ליריב, גם באמצע קומבו: <bdi dir="ltr">X, X, Y</bdi> ואז <bdi>A</bdi>.</li>
        <li>פס ההייפ מתמלא ממכות שנתתם וחסימות. כשהוא מלא לחצו <b><bdi>RB</bdi></b> לסופר.</li>
        <li>מכות עם כיוון: קדימה + <bdi>Y</bdi>, למטה + <bdi>X</bdi>, למטה + <bdi>Y</bdi>. באוויר: <bdi>X</bdi> או <bdi>Y</bdi>.</li>
        <li>אם השלט לא מגיב: לחצו על כפתור כלשהו בשלט, כדי שהדפדפן יזהה אותו. שני שחקנים: כל אחד עם שלט משלו.</li>
      </ol>
    </div>`;
  },

  kbHTML() {
    const kb = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    return `<table class="ctl">
      ${kb('תנועה', 'A ו-D או חיצים. W קפיצה, S התכופפות')}
      ${kb('אגרוף / בעיטה', 'J או Z / K או X')}
      ${kb('מיוחד 1 / מיוחד 2', 'L או C / U או V')}
      ${kb('חסימה', 'I או רווח (מחזיקים)')}
      ${kb('סופר', 'O או B (כשההייפ מלא)')}
      ${kb('זריקה', 'E או N (או אגרוף ובעיטה יחד), מקרוב')}
      ${kb('ריצה / נסיגה', 'לחיצה כפולה על כיוון')}
      ${kb('הפסקה', 'Esc או P')}
    </table>`;
  },
  touchHTML() {
    return `<p>מקל התנועה משמאל: החליקו ימינה/שמאלה, למעלה לקפיצה, למטה להתכופפות. כפתורי הפעולה מימין:</p>
      <ul><li><b>אגרוף</b> ו<b>בעיטה</b>: המכות הרגילות.</li><li><b>מיוחד 1</b> ו<b>מיוחד 2</b>: היכולות המיוחדות של הדמות. הסמל שמתחת לפס ההייפ מראה מתי הן מוכנות.</li><li><b>חסימה</b>: מחזיקים. <b>סופר</b>: כשפס ההייפ מלא.</li><li>שני הכפתורים הקטנים שלידם: ריצה וזריקה.</li></ul>`;
  },

  // pause-menu card with the three devices as tabs
  cardHTML(dev) {
    const tab = (d, t) => `<button class="nav ${dev === d ? 'on' : ''}" data-act="ctl-${d}">${t}</button>`;
    const body = dev === 'pad' ? this.padHTML() : dev === 'touch' ? this.touchHTML() : this.kbHTML();
    return `<h2>בקרות</h2><div class="seg ctltabs">${tab('pad', 'שלט')}${tab('kb', 'מקלדת')}${tab('touch', 'מגע')}</div><div class="ctlbody">${body}</div><div class="stack"><button class="btn primary nav autofocus" data-act="closemoves">חזרה להפסקה</button></div>`;
  },

  // a pad was plugged in / woke up
  onPad(e) {
    Inp.dev = 'pad';
    const id = e && e.gamepad ? e.gamepad.index : 0;
    try { if (Snd.canAuto()) { Snd.init(); Snd.resume(); } } catch (x) { /* audio is optional */ }
    if (this.seen[id]) return;
    this.seen[id] = true;
    try { if (UI.cur) UI.focusPrimary($('#s-' + UI.cur)); } catch (x) { /* focus is a nicety */ }         // show the focus ring right away
    UI.toast('שלט זוהה', 'X אגרוף · Y בעיטה · A ו-B יכולות מיוחדות · LB חסימה · RB סופר · RT זריקה. הסבר מלא: "איך משחקים"', 'unlock');
  },
};

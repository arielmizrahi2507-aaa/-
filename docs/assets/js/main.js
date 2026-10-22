/* ג'ודוקאן אילת | main.js
   אין עוגיות, אין מעקב, אין בקשות לצד שלישי. localStorage משמש רק לשמירת העדפות נגישות במכשיר של הגולש. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* ---------- תפריט צד / תפריט נייד ---------- */
  var side = doc.querySelector('.side');
  var menuBtn = doc.querySelector('.menu-btn');

  function setMenu(open) {
    if (!side || !menuBtn) return;
    side.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      setMenu(!side.classList.contains('open'));
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && side.classList.contains('open')) {
        setMenu(false);
        menuBtn.focus();
      }
    });
  }

  /* קישורי עוגן: סוגרים תפריט ומעבירים מיקוד אל הקטע, כדי שגם מקלדת וקורא מסך יגיעו אליו */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
    if (!a) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.pathname !== location.pathname || !url.hash || url.hash.length < 2) return;
    var target = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    setMenu(false);
    window.setTimeout(function () {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, 60);
  });

  /* סימון הקטע הפעיל בתפריט */
  var navLinks = [].slice.call(doc.querySelectorAll('.side-nav a[href^="#"]'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    navLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var link = map[en.target.id] || null;
          if (link === current) return;
          if (current) current.removeAttribute('aria-current');
          if (link) link.setAttribute('aria-current', 'location');
          current = link;
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    Object.keys(map).concat(['faq']).forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- טופס הרשמה: מרכיב הודעת וואטסאפ, לא שולח מידע לשרת ---------- */
  var form = doc.getElementById('wa-form');
  if (form) {
    var waNumber = form.getAttribute('data-wa');
    var nameEl = form.elements['jk-name'];
    var phoneEl = form.elements['jk-phone'];
    var groupEl = form.elements['jk-group'];

    var setErr = function (input, msg) {
      var err = doc.getElementById(input.id + '-err');
      var bad = !!msg;
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (err) {
        err.textContent = msg || '';
        err.classList.toggle('on', bad);
      }
      return bad;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameEl.value.replace(/\s+/g, ' ').trim();
      var phone = phoneEl.value.trim();
      var firstBad = null;

      if (name.length < 2) {
        setErr(nameEl, 'נא להזין שם מלא.');
        firstBad = firstBad || nameEl;
      } else { setErr(nameEl, ''); }

      if (phone && !/^[0-9+\-\s()]{7,18}$/.test(phone)) {
        setErr(phoneEl, 'מספר הטלפון נראה לא תקין. אפשר להשאיר ריק.');
        firstBad = firstBad || phoneEl;
      } else { setErr(phoneEl, ''); }

      if (firstBad) { firstBad.focus(); return; }

      var lines = ['שלום, אשמח לקבל פרטים על הרשמה לג\'ודוקאן אילת.', 'שם: ' + name];
      if (phone) lines.push('טלפון: ' + phone);
      lines.push('קבוצה: ' + groupEl.value);
      var url = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(lines.join('\n'));
      var w = window.open(url, '_blank', 'noopener');
      if (!w) location.href = url;
    });

    [nameEl, phoneEl].forEach(function (el) {
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') setErr(el, ''); });
    });
  }

  /* ---------- תפריט נגישות ---------- */
  var KEY = 'jk-a11y';
  var state = { fs: 1, contrast: 0, gray: 0, links: 0, font: 0, spacing: 0, nomotion: 0 };
  var FLAGS = ['contrast', 'gray', 'links', 'font', 'spacing', 'nomotion'];

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved && typeof saved === 'object') {
      if (typeof saved.fs === 'number' && saved.fs >= 1 && saved.fs <= 1.4) state.fs = saved.fs;
      FLAGS.forEach(function (k) { if (saved[k]) state[k] = 1; });
    }
  } catch (err) { /* אחסון חסום: ממשיכים בלי שמירה */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
  }

  function apply() {
    if (state.fs === 1) root.style.removeProperty('--fs'); else root.style.setProperty('--fs', String(state.fs));
    FLAGS.forEach(function (k) { root.classList.toggle('a11y-' + k, !!state[k]); });
  }
  apply();

  var live;
  function say(msg) { if (live) { live.textContent = ''; window.setTimeout(function () { live.textContent = msg; }, 30); } }

  var OPTIONS = [
    { key: 'contrast', label: 'ניגודיות גבוהה', on: 'ניגודיות גבוהה הופעלה', off: 'ניגודיות גבוהה כובתה' },
    { key: 'gray', label: 'גווני אפור', on: 'גווני אפור הופעלו', off: 'גווני אפור כובו' },
    { key: 'links', label: 'הדגשת קישורים', on: 'הדגשת קישורים הופעלה', off: 'הדגשת קישורים כובתה' },
    { key: 'font', label: 'גופן קריא', on: 'גופן קריא הופעל', off: 'גופן קריא כובה' },
    { key: 'spacing', label: 'ריווח טקסט', on: 'ריווח טקסט הופעל', off: 'ריווח טקסט כבה' },
    { key: 'nomotion', label: 'עצירת אנימציות', on: 'האנימציות נעצרו', off: 'האנימציות חזרו' }
  ];

  function el(tag, attrs, html) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html) n.innerHTML = html;
    return n;
  }

  var icon = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-access"></use></svg>';
  var closeIcon = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-close"></use></svg>';

  var wrap = el('div', { 'class': 'a11y-root' });
  var toggle = el('button', { type: 'button', 'class': 'a11y-toggle', 'aria-expanded': 'false', 'aria-controls': 'a11y-panel' }, icon + '<span class="a11y-label">נגישות</span>');
  var panel = el('div', { id: 'a11y-panel', 'class': 'a11y-panel', role: 'dialog', 'aria-labelledby': 'a11y-title', hidden: '' });
  var head = el('div', { 'class': 'a11y-head' });
  head.appendChild(el('h2', { id: 'a11y-title' }, 'תפריט נגישות'));
  var closeBtn = el('button', { type: 'button', 'class': 'a11y-close', 'aria-label': 'סגירת תפריט הנגישות' }, closeIcon);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  var grid = el('div', { 'class': 'a11y-grid' });
  var bigger = el('button', { type: 'button', 'class': 'a11y-opt' }, 'הגדלת טקסט (A+)');
  var smaller = el('button', { type: 'button', 'class': 'a11y-opt' }, 'הקטנת טקסט (A-)');
  grid.appendChild(bigger);
  grid.appendChild(smaller);

  var buttons = {};
  OPTIONS.forEach(function (o) {
    var b = el('button', { type: 'button', 'class': 'a11y-opt', 'aria-pressed': state[o.key] ? 'true' : 'false' }, o.label);
    b.addEventListener('click', function () {
      state[o.key] = state[o.key] ? 0 : 1;
      b.setAttribute('aria-pressed', state[o.key] ? 'true' : 'false');
      apply(); save(); say(state[o.key] ? o.on : o.off);
    });
    buttons[o.key] = b;
    grid.appendChild(b);
  });

  var reset = el('button', { type: 'button', 'class': 'a11y-opt a11y-reset' }, 'איפוס כל ההגדרות');
  grid.appendChild(reset);
  panel.appendChild(grid);

  var statement = el('p', { 'class': 'a11y-foot' });
  var base = doc.body.getAttribute('data-base') || '';
  statement.innerHTML = '<a href="' + base + 'accessibility.html">הצהרת נגישות</a>';
  panel.appendChild(statement);

  live = el('div', { 'class': 'a11y-live', 'aria-live': 'polite', role: 'status' });
  wrap.appendChild(panel);
  wrap.appendChild(toggle);
  wrap.appendChild(live);
  doc.body.appendChild(wrap);

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { bigger.focus(); }
  }
  toggle.addEventListener('click', function () { setPanel(panel.hidden); });
  closeBtn.addEventListener('click', function () { setPanel(false); toggle.focus(); });
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { setPanel(false); toggle.focus(); }
  });

  bigger.addEventListener('click', function () {
    state.fs = Math.min(1.4, Math.round((state.fs + 0.1) * 10) / 10);
    apply(); save(); say('גודל הטקסט: ' + Math.round(state.fs * 100) + ' אחוזים');
  });
  smaller.addEventListener('click', function () {
    state.fs = Math.max(1, Math.round((state.fs - 0.1) * 10) / 10);
    apply(); save(); say('גודל הטקסט: ' + Math.round(state.fs * 100) + ' אחוזים');
  });
  reset.addEventListener('click', function () {
    state.fs = 1;
    FLAGS.forEach(function (k) { state[k] = 0; buttons[k].setAttribute('aria-pressed', 'false'); });
    apply(); save(); say('כל הגדרות הנגישות אופסו');
  });
})();

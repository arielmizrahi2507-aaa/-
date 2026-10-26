/* ג'ודוקאן אילת | main.js
   אין עוגיות, אין מעקב, אין בקשות לצד שלישי. localStorage משמש רק לשמירת העדפות נגישות במכשיר של הגולש.
   כל מה שכאן הוא שיפור הדרגתי: בלי JavaScript התפריט, הקישורים והתוכן ממשיכים לעבוד. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* ---------- אזור הודעות לקוראי מסך ---------- */
  var live = doc.createElement('div');
  live.className = 'a11y-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  doc.body.appendChild(live);

  function say(msg) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 30);
  }

  function reducedMotion() {
    return root.classList.contains('a11y-nomotion') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- תפריט צד / תפריט נייד ---------- */
  var side = doc.querySelector('.side');
  var menuBtn = doc.querySelector('.menu-btn');

  function setMenu(open) {
    if (!side || !menuBtn) return;
    side.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
    /* כשהתפריט פתוח לא מודדים את הכותרת, ולכן אחרי הסגירה מודדים שוב (למשל אם הטלפון הסתובב בינתיים) */
    if (!open) hsRefresh();
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

  /* ---------- גלילה לעוגנים ----------
     גלילה ידנית, כדי שהקישורים יעבדו גם בתצוגות שחוסמות ניווט לפי #, כמו מסגרות מוגבלות בתוך אפליקציות. */
  function goTo(id, hash) {
    var target = doc.getElementById(id);
    if (!target) return false;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try {
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (err) {
      target.scrollIntoView();
    }
    window.setTimeout(function () {
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    }, 80);
    try { history.replaceState(null, '', hash); } catch (err) { /* מסגרת מוגבלת: ממשיכים בלי לעדכן את הכתובת */ }
    return true;
  }

  doc.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented || a.target === '_blank') return;
    var raw = a.getAttribute('href');
    var hash;
    if (raw.charAt(0) === '#') {
      /* קישור לקטע בעמוד עצמו. בודקים לפי הטקסט שבקישור ולא לפי הכתובת המלאה: בתצוגה מוטמעת (srcdoc)
         הכתובת מתפרשת ביחס לדף המארח, והקישור היה מנווט את המסגרת אל הדף ההוא */
      hash = raw;
    } else {
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.protocol !== location.protocol || url.host !== location.host || url.pathname !== location.pathname) return;
      hash = url.hash;
    }

    if (raw === '#') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      var brand = doc.querySelector('.brand');
      if (brand) window.setTimeout(function () { try { brand.focus({ preventScroll: true }); } catch (err) { brand.focus(); } }, 80);
      return;
    }
    if (!hash || hash.length < 2) {
      /* קישור לעמוד שכבר פתוח (למשל "צור קשר" מתוך עמוד יצירת הקשר): לא טוענים אותו מחדש, כדי שהטופס לא יתרוקן */
      if (!hash) {
        e.preventDefault();
        setMenu(false);
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      return;
    }
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (err) { return; }
    if (!doc.getElementById(id)) return;
    e.preventDefault();
    setMenu(false);
    goTo(id, hash);
  });

  /* ---------- כפתור חזרה למעלה (העמוד ארוך) ---------- */
  var toTop = doc.querySelector('.to-top');
  if (toTop) {
    var ticking = false;
    var updateTop = function () {
      ticking = false;
      toTop.hidden = window.pageYOffset < 900;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateTop); }
    }, { passive: true });
    updateTop();
  }

  /* ---------- סימון הקטע הפעיל בתפריט ---------- */
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

  /* ---------- טפסים: אימות, כוכבית אדומה, וואטסאפ ומייל ----------
     שום מידע לא נשלח לשרת. מרכיבים הודעה ופותחים את האפליקציה במכשיר של הגולש. */
  var RULES = {
    name: function (v) {
      v = v.replace(/\s+/g, ' ').trim();
      if (!v) return 'missing';
      var words = v.split(' ');
      if (words.length < 2 || words.some(function (w) { return w.length < 2; })) return 'partial';
      return '';
    },
    phone: function (v) {
      v = v.trim();
      if (!v) return 'missing';
      var digits = v.replace(/\D/g, '');
      if (/^(\+|00)/.test(v)) {
        /* מספר בינלאומי: +972 הופך למספר מקומי, ומספר זר נבדק לפי אורך */
        digits = digits.replace(/^00/, '');
        if (/^972/.test(digits)) digits = '0' + digits.slice(3).replace(/^0/, '');
        else return digits.length >= 8 && digits.length <= 15 ? '' : 'partial';
      }
      if (/^0(5\d|7\d)\d{7}$/.test(digits) || /^0[2-489]\d{7}$/.test(digits)) return '';
      return 'partial';
    },
    email: function (v) {
      v = v.trim();
      if (!v) return 'missing';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'partial';
    },
    consent: function (checked) {
      return checked ? '' : 'missing';
    },
    age: function (v) {
      v = v.trim();
      if (!v) return 'missing';
      if (!/^\d{1,3}$/.test(v)) return 'partial';
      var n = parseInt(v, 10);
      if (n < 4) return 'low';
      if (n > 99) return 'high';
      return '';
    }
  };

  var MSG = {
    name: { missing: 'נא להזין שם מלא.', partial: 'השם לא מלא. נא להזין שם פרטי ושם משפחה.' },
    phone: { missing: 'נא להזין מספר טלפון.', partial: 'מספר הטלפון לא מלא. נא להזין מספר ישראלי, למשל 050-1234567, או מספר בינלאומי שמתחיל ב־+.' },
    email: { partial: 'כתובת המייל לא מלאה. נא להזין כתובת כמו name@example.com.' },
    consent: { missing: 'כדי לשלוח הודעה צריך לאשר את מדיניות הפרטיות.' },
    age: {
      missing: 'נא להזין את גיל המתאמן או המתאמנת.',
      partial: 'נא להזין גיל במספרים בלבד.',
      low: 'המועדון מקבל מתאמנים מגיל 4.',
      high: 'נא להזין גיל עד 99.'
    }
  };

  function control(field) { return field.querySelector('input,select,textarea'); }

  function validateField(field) {
    var rule = field.getAttribute('data-rule');
    if (!rule || !RULES[rule]) return '';
    var input = control(field);
    var code = RULES[rule](input.type === 'checkbox' ? input.checked : input.value);
    if (code === 'missing' && !field.hasAttribute('data-required')) return '';
    return code;
  }

  /* סימון שדה: כוכבית אדומה, מסגרת, הודעה בטקסט ו־aria-invalid, כך שהמידע לא מועבר בצבע בלבד */
  function setState(field, code) {
    var rule = field.getAttribute('data-rule');
    var input = control(field);
    var err = field.querySelector('.err');
    var star = field.querySelector('.req');
    var bad = !!code;
    field.classList.toggle('invalid', bad);
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (star) star.hidden = !bad;
    if (err) {
      err.textContent = bad ? ((MSG[rule] && MSG[rule][code]) || 'נא להשלים את השדה.') : '';
      err.classList.toggle('on', bad);
    }
    return bad;
  }

  function copyText(text, done) {
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }

  doc.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-copy],[data-copy-from]') : null;
    if (!b) return;
    if (b.getAttribute('data-busy')) return;
    var text = b.getAttribute('data-copy');
    var src = null;
    if (text === null) {
      src = doc.getElementById(b.getAttribute('data-copy-from'));
      text = src ? src.value : '';
    }
    copyText(text, function (ok) {
      say(ok ? 'הועתק' : 'ההעתקה לא הצליחה. אפשר לסמן ולהעתיק ידנית.');
      if (!ok && src) { src.focus(); src.select(); }
      var kids = [].slice.call(b.childNodes);
      b.setAttribute('data-busy', '1');
      b.textContent = ok ? 'הועתק' : 'לא הועתק';
      window.setTimeout(function () {
        b.textContent = '';
        kids.forEach(function (n) { b.appendChild(n); });
        b.removeAttribute('data-busy');
      }, 1800);
    });
  });

  /* פתיחה בלשונית חדשה באמצעות קישור זמני: אין חלון קופץ שנחסם, ואין ניווט כפול של הדף עצמו */
  function openInNewTab(url) {
    var a = doc.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.hidden = true;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
  }

  function initForm(form) {
    var waNumber = form.getAttribute('data-wa');
    var email = form.getAttribute('data-email') || '';
    var subject = form.getAttribute('data-subject') || '';
    var fields = [].slice.call(form.querySelectorAll('.field[data-rule]'));
    var result = form.querySelector('.result');

    fields.forEach(function (f) {
      var recheck = function () {
        if (f.classList.contains('invalid')) setState(f, validateField(f));
      };
      control(f).addEventListener('input', recheck);
      control(f).addEventListener('change', recheck);
    });

    function value(name) {
      var el = form.elements[name];
      return el ? el.value.replace(/\s+/g, ' ').trim() : '';
    }

    function buildMessage() {
      var lines = ['שלום, אשמח לקבל פרטים על הרשמה לג\'ודוקאן אילת.', '', 'שם: ' + value('name')];
      if (value('phone')) lines.push('טלפון: ' + value('phone'));
      if (value('email')) lines.push('אימייל: ' + value('email'));
      if (value('age')) lines.push('גיל המתאמן או המתאמנת: ' + value('age'));
      if (value('group')) lines.push('קבוצה: ' + value('group'));
      var msgEl = form.elements.message;
      if (msgEl && msgEl.value.trim()) lines.push('הודעה: ' + msgEl.value.trim());
      return lines.join('\n');
    }

    /* אירוע לחיצה ולא submit: תצוגות מוגבלות (iframe בלי allow-forms) חוסמות שליחת טפסים לפני שהסקריפט רץ */
    function send(ch) {
      var bad = [];
      fields.forEach(function (f) { if (setState(f, validateField(f))) bad.push(f); });

      if (bad.length) {
        if (result) result.hidden = true;
        control(bad[0]).focus();
        say(bad.length === 1 ? 'יש להשלים שדה אחד' : 'יש להשלים ' + bad.length + ' שדות');
        return;
      }

      var text = buildMessage();
      var waUrl = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(text);
      /* בלי כתובת מוגדרת נפתחת טיוטה בלי נמען; עם כתובת היא מתמלאת אוטומטית */
      var mailUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));

      /* הלוח נשאר גם אם האפליקציה לא נפתחת (למשל בתצוגה מוגבלת): אפשר ללחוץ שוב או להעתיק */
      if (result) {
        var area = result.querySelector('textarea');
        var openWa = result.querySelector('.js-open-wa');
        var openMail = result.querySelector('.js-open-mail');
        if (area) area.value = text;
        if (openWa) openWa.href = waUrl;
        if (openMail) openMail.href = mailUrl;
        result.hidden = false;
      }

      if (ch === 'mail') {
        try { window.location.href = mailUrl; } catch (err) { /* הלוח מספק גיבוי */ }
      } else {
        openInNewTab(waUrl);
      }
      if (result) result.focus();
    }

    [].slice.call(form.querySelectorAll('button[data-channel]')).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); send(b.getAttribute('data-channel')); });
    });
    /* Enter (ב"הבא" במקלדת של הטלפון) עובר לשדה הבא: לא מאמת ולא שולח, כדי שלא יישארו תקועים בשדה השם אחרי שם פרטי בלבד.
       שליחה רק בשני הכפתורים. */
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || !e.target || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
      e.preventDefault();
      var all = [].slice.call(form.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]), select, textarea'))
        .filter(function (c) { return !c.disabled && c.offsetParent !== null; });
      var next = all[all.indexOf(e.target) + 1];
      if (next) next.focus();
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); send('wa'); });
  }

  [].slice.call(doc.querySelectorAll('form[data-wa]')).forEach(initForm);

  /* ---------- גלילה לצד בנייד ----------
     קבוצות כרטיסים (data-hs) הופכות לפס שמחליקים בו הצידה: החלקה באצבע, גרירה בעכבר, ובמקלדת מקשי החצים. בלי כפתורים ובלי נקודות.
     בנוסף, כשגוללים את הדף למטה ומגיעים לפס, הוא נעצר במקומו והגלילה הרגילה של הדף מזיזה את הכרטיסים הצידה, ואחרי הכרטיס האחרון
     הדף ממשיך להיגלל כרגיל. התנועה הזאת מתבטלת בהגדרת "הפחתת תנועה" של המכשיר, ב"עצירת אנימציות" וב"בלי גלילה לצד" בתפריט הנגישות,
     ובפס שגבוה מהמסך הפנוי (טלפון על הצד, טקסט מוגדל). בלי JavaScript, או כשמפעילים "בלי גלילה לצד", הכרטיסים נשארים ברשימה רציפה. */
  var mq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
  var carousels = [];
  var hsRaf = 0;

  var pins = [];       /* לכל פס פונקציה שמיישרת אותו לפי מקום הדף */
  var pinRaf = 0;
  var pinTop = 0;      /* הקצה התחתון של הכותרת הדביקה */
  var pinView = 0;     /* הגובה הפנוי, בין הכותרת לסרגל התחתון */
  var PIN_ROOM = 16;   /* כמה מקום נשאר מעל הפס ומתחתיו */
  var stickyOk = !!(window.CSS && window.CSS.supports && window.CSS.supports('position', 'sticky'));
  /* מסגרת שמתרחבת לגובה התוכן (חלק מהמציגים המוטמעים) לא גוללת בעצמה, ושם אין מה לעצור */
  var pageScrolls = window.innerHeight > 0 && doc.documentElement.scrollHeight > window.innerHeight * 1.5;

  function carouselOn() {
    return !!(mq && mq.matches) && !root.classList.contains('a11y-stack');
  }

  function pinOn() {
    return carouselOn() && stickyOk && pageScrolls && !reducedMotion();
  }

  /* כשהתפריט פתוח הכותרת גבוהה מהרגיל, ולכן אז לא מודדים */
  function measureView() {
    if (side && side.classList.contains('open')) return;
    var top = 0;
    var h = 0;
    if (side) {
      var cs = window.getComputedStyle(side);
      top = cs.position === 'sticky' ? (parseFloat(cs.top) || 0) : 0;
      h = side.getBoundingClientRect().height;
    }
    var bar = doc.querySelector('.mbar');
    var barH = bar && window.getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().height : 0;
    pinTop = Math.ceil(top + h);
    pinView = Math.max(0, Math.floor(window.innerHeight - pinTop - barH));
  }

  function pinSync() {
    pinRaf = 0;
    pins.forEach(function (f) { f(); });
  }

  /* גלילה מיידית של הדף, גם כשבסגנון מוגדרת גלילה חלקה */
  function jumpBy(dy) {
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollBy(0, dy);
    root.style.scrollBehavior = prev;
  }

  function hsRefresh() {
    if (hsRaf) return;
    hsRaf = window.requestAnimationFrame(function () {
      hsRaf = 0;
      measureView();
      carousels.forEach(function (c) { c(); });
      pinSync();
    });
  }

  function initCarousel(track, n) {
    var label = track.getAttribute('data-hs');
    var addedRole = false;
    var addedLabel = false;
    var drag = null;
    var suppress = false;
    var raf = 0;
    var settle = 0;
    var active = 0;

    /* .hs היא העטיפה שגבוהה כמו מרחק הגלילה, ו־.hs-stage היא הבמה שנדבקת למסך בזמן שהכרטיסים זזים. כשאין עצירה הבמה לא מייצרת תיבה */
    var wrap = el('div', { 'class': 'hs' });
    var stage = el('div', { 'class': 'hs-stage' });
    track.parentNode.insertBefore(wrap, track);
    wrap.appendChild(stage);
    stage.appendChild(track);
    if (!track.id) track.id = 'hs-' + n;

    var list = [].slice.call(track.classList.contains('gloss') ? track.querySelectorAll('dl > div') : track.children);

    function rtl() { return window.getComputedStyle(track).direction === 'rtl'; }

    /* הפס יוצא עד קצה המסך, והכרטיס הראשון נשאר מיושר לטקסט.
       מודדים את העטיפה (שלא זזה) וכותבים רק כשהמספרים השתנו, כדי שלא יהיה חישוב פריסה מיותר בזמן גלילה */
    var bleedS = '';
    var bleedE = '';
    function bleed() {
      var s = '';
      var e = '';
      if (carouselOn()) {
        var r = wrap.getBoundingClientRect();
        var w = doc.documentElement.clientWidth;
        s = Math.max(0, Math.round(rtl() ? w - r.right : r.left)) + 'px';
        e = Math.max(0, Math.round(rtl() ? r.left : w - r.right)) + 'px';
      }
      if (s === bleedS && e === bleedE) return;
      bleedS = s;
      bleedE = e;
      if (s) { track.style.setProperty('--hs-s', s); track.style.setProperty('--hs-e', e); }
      else { track.style.removeProperty('--hs-s'); track.style.removeProperty('--hs-e'); }
    }

    var wasScrollable = null;
    function update() {
      raf = 0;
      var max = track.scrollWidth - track.clientWidth;
      var scrollable = carouselOn() && max > 4;
      if (scrollable !== wasScrollable) {
        wasScrollable = scrollable;
        if (scrollable) {
          track.setAttribute('tabindex', '0');
          if (!track.hasAttribute('role')) { track.setAttribute('role', 'group'); addedRole = true; }
          if (!track.hasAttribute('aria-label')) { track.setAttribute('aria-label', label); addedLabel = true; }
        } else {
          track.removeAttribute('tabindex');
          if (addedRole) { track.removeAttribute('role'); addedRole = false; }
          if (addedLabel) { track.removeAttribute('aria-label'); addedLabel = false; }
        }
      }
      if (!scrollable) return;
      var pos = Math.abs(track.scrollLeft);
      var tr = track.getBoundingClientRect();
      var padStart = parseFloat(window.getComputedStyle(track).paddingInlineStart) || 0;
      var isRtl = rtl();
      var best = 0;
      var bestD = Infinity;
      list.forEach(function (it, i) {
        var r = it.getBoundingClientRect();
        var d = Math.abs(isRtl ? (tr.right - padStart) - r.right : r.left - (tr.left + padStart));
        if (d < bestD) { bestD = d; best = i; }
      });
      if (pos <= 2) best = 0;
      if (pos >= max - 2) best = list.length - 1;
      active = best;
    }

    function schedule() { if (!raf) raf = window.requestAnimationFrame(update); }

    function go(dir) {
      var a = list[0].getBoundingClientRect();
      var b = list[1] ? list[1].getBoundingClientRect() : null;
      var step = b ? Math.abs(b.left - a.left) : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * step * (rtl() ? -1 : 1), behavior: reducedMotion() ? 'auto' : 'smooth' });
      window.clearTimeout(settle);
      settle = window.setTimeout(function () { say(label + ': ' + (active + 1) + ' מתוך ' + list.length); }, 600);
    }

    track.addEventListener('keydown', function (e) {
      if (e.target !== track || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go((e.key === 'ArrowLeft') === rtl() ? 1 : -1);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        var toEnd = e.key === 'End';
        track.scrollTo({ left: toEnd ? (rtl() ? -1 : 1) * (track.scrollWidth - track.clientWidth) : 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    });

    /* גרירה בעכבר. במגע ההחלקה מובנית בדפדפן */
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !wasScrollable) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    track.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        track.classList.add('hs-drag');
        try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    function endDrag() {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      track.classList.remove('hs-drag');
      if (moved) { suppress = true; window.setTimeout(function () { suppress = false; }, 0); }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', function (e) { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
    track.addEventListener('dragstart', function (e) { if (carouselOn()) e.preventDefault(); });

    /* ---- עצירת הפס בזמן גלילת הדף ----
       כשהפס נעצר, גלילת הדף ב־p פיקסלים מזיזה את הכרטיסים p פיקסלים הצידה, עד סוף הפס. כמה גללו אפשר לדעת ממקום העטיפה במסך.
       כשהפס זז מעצמו (החלקה, גרירה, מקשי החצים, חיפוש בדף, מיקוד), מעבירים את הדף למקום המתאים, כך ששני הכיוונים נשארים מסונכרנים */
    var pinned = false;
    var pinD = 0;
    var written = 0;     /* המקום שהסקריפט עצמו כתב, כדי להבדיל בין הד של הכתיבה לבין תנועה של הגולש */
    var holdUntil = 0;
    var adoptTimer = 0;
    var dirSign = -1;

    /* פס שלא נכנס בגובה המסך הפנוי ננסה פעם נוספת עם כרטיסים מהודקים (פחות ריווח, אותו גודל טקסט). אם גם אז לא נכנס, הוא נשאר פס רגיל */
    function pinFits() {
      wrap.classList.remove('hs-tight');
      var th = track.offsetHeight;
      if (th > 0 && th <= pinView - PIN_ROOM) return th;
      wrap.classList.add('hs-tight');
      th = track.offsetHeight;
      if (th > 0 && th <= pinView - PIN_ROOM) return th;
      wrap.classList.remove('hs-tight');
      return 0;
    }

    function pinMeasure() {
      var max = track.scrollWidth - track.clientWidth;
      var th = pinOn() && max > 4 ? pinFits() : 0;
      if (!th) wrap.classList.remove('hs-tight');
      var want = th > 0;
      if (want) {
        wrap.style.setProperty('--hs-top', pinTop + 'px');
        wrap.style.setProperty('--hs-stage', pinView + 'px');
        wrap.style.setProperty('--hs-d', max + 'px');
        wrap.style.setProperty('--hs-g', Math.floor((pinView - th) / 2) + 'px');
        dirSign = rtl() ? -1 : 1;
      } else if (pinned) {
        ['--hs-top', '--hs-stage', '--hs-d', '--hs-g'].forEach(function (k) { wrap.style.removeProperty(k); });
      }
      if (want !== pinned) {
        pinned = want;
        wrap.classList.toggle('hs-pin', want);
        written = Math.abs(track.scrollLeft);
      }
      pinD = max;
    }

    function pinPlace() {
      if (!pinned || Date.now() < holdUntil) return;
      var r = wrap.getBoundingClientRect();
      var want = Math.max(0, Math.min(pinD, pinTop - r.top));
      if (Math.abs(Math.abs(track.scrollLeft) - want) < 0.75) return;
      written = want;
      track.scrollLeft = dirSign * want;
    }
    pins.push(pinPlace);

    function pinAdopt() {
      adoptTimer = 0;
      if (!pinned) return;
      var r = wrap.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var cur = Math.abs(track.scrollLeft);
      var raw = pinTop - r.top;
      holdUntil = 0;
      /* כבר מסונכרנים, גם כשהדף מעבר לקצה הפס (שם הכרטיסים נשארים בקצה): אין סיבה להזיז את הדף */
      if (Math.abs(cur - Math.max(0, Math.min(pinD, raw))) < 1) return;
      written = cur;
      jumpBy(cur - raw);
    }

    track.addEventListener('scroll', function () {
      if (!pinned || Math.abs(Math.abs(track.scrollLeft) - written) <= 1.5) return;
      holdUntil = Date.now() + 200;
      window.clearTimeout(adoptTimer);
      adoptTimer = window.setTimeout(pinAdopt, 130);
    }, { passive: true });

    track.addEventListener('scroll', schedule, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(hsRefresh).observe(track);

    carousels.push(function () { bleed(); update(); pinMeasure(); });
  }

  [].slice.call(doc.querySelectorAll('[data-hs]')).forEach(initCarousel);
  if (carousels.length) {
    var lastW = doc.documentElement.clientWidth;
    var lastH = window.innerHeight;
    window.addEventListener('resize', function () {
      var w = doc.documentElement.clientWidth;
      var h = window.innerHeight;
      /* שינוי קטן בגובה הוא סרגל הכתובות בנייד שמתכווץ, ולא צריך לחשב מחדש */
      if (w === lastW && Math.abs(h - lastH) < 160) return;
      lastW = w;
      lastH = h;
      hsRefresh();
    });
    window.addEventListener('orientationchange', hsRefresh);
    window.addEventListener('scroll', function () {
      if (!pinRaf) pinRaf = window.requestAnimationFrame(pinSync);
    }, { passive: true });
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', hsRefresh);
      else if (mq.addListener) mq.addListener(hsRefresh);
    }
    var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (rm) {
      if (rm.addEventListener) rm.addEventListener('change', hsRefresh);
      else if (rm.addListener) rm.addListener(hsRefresh);
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(hsRefresh);
    hsRefresh();
  }

  /* ---------- תפריט נגישות ---------- */
  var KEY = 'jk-a11y';
  var state = { fs: 1, contrast: 0, gray: 0, links: 0, font: 0, spacing: 0, nomotion: 0, stack: 0 };
  var FLAGS = ['contrast', 'gray', 'links', 'font', 'spacing', 'nomotion', 'stack'];

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
    hsRefresh();
  }
  apply();

  var OPTIONS = [
    { key: 'contrast', label: 'ניגודיות גבוהה', on: 'ניגודיות גבוהה הופעלה', off: 'ניגודיות גבוהה כובתה' },
    { key: 'gray', label: 'גווני אפור', on: 'גווני אפור הופעלו', off: 'גווני אפור כובו' },
    { key: 'links', label: 'הדגשת קישורים', on: 'הדגשת קישורים הופעלה', off: 'הדגשת קישורים כובתה' },
    { key: 'font', label: 'גופן קריא', on: 'גופן קריא הופעל', off: 'גופן קריא כובה' },
    { key: 'spacing', label: 'ריווח טקסט', on: 'ריווח טקסט הופעל', off: 'ריווח טקסט כבה' },
    { key: 'nomotion', label: 'עצירת אנימציות', on: 'האנימציות נעצרו', off: 'האנימציות חזרו' },
    { key: 'stack', label: 'בלי גלילה לצד', on: 'התצוגה הרציפה הופעלה, בלי גלילה לצד', off: 'הגלילה לצד חזרה' }
  ];

  /* בונים רק בעזרת DOM ו־textContent, בלי innerHTML */
  function el(tag, attrs, content) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    [].concat(content || []).forEach(function (c) {
      n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return n;
  }

  function svgIcon(name) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(ns, 'svg');
    var use = doc.createElementNS(ns, 'use');
    svg.setAttribute('class', 'i');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  var wrap = el('div', { 'class': 'a11y-root' });
  var toggle = el('button', { type: 'button', 'class': 'a11y-toggle', 'aria-expanded': 'false', 'aria-controls': 'a11y-panel' }, [svgIcon('access'), el('span', { 'class': 'a11y-label' }, 'נגישות')]);
  var panel = el('div', { id: 'a11y-panel', 'class': 'a11y-panel', role: 'dialog', 'aria-labelledby': 'a11y-title', hidden: '' });
  var head = el('div', { 'class': 'a11y-head' });
  head.appendChild(el('h2', { id: 'a11y-title' }, 'תפריט נגישות'));
  var closeBtn = el('button', { type: 'button', 'class': 'a11y-close', 'aria-label': 'סגירת תפריט הנגישות' }, svgIcon('close'));
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
  statement.appendChild(el('a', { href: 'accessibility.html' }, 'הצהרת נגישות'));
  panel.appendChild(statement);

  wrap.appendChild(panel);
  wrap.appendChild(toggle);
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

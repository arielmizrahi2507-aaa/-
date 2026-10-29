# -*- coding: utf-8 -*-
"""Assembles the static pages of the Judokan Eilat site into docs/.
Single source for sidebar, footer, sprite and the facts used on every page.

    python3 tools/build_site.py

Optional environment variables:
    JK_EMAIL  club e-mail address (overrides CLUB_EMAIL below); when set, the contact page also offers sending by e-mail
    JK_OUT    output folder (default: ../docs), useful for test builds"""
import json, os, re, hashlib, base64
from pathlib import Path
from urllib.parse import quote

DOCS = os.environ.get("JK_OUT") or str(Path(__file__).resolve().parent.parent / "docs")

CLUB = "ג'ודוקאן אילת"
PHONE = "050-5788781"
PHONE_TEL = "+972505788781"
WA = "972505788781"
STREET = "מקור החסידה 9"
ADDR = "מקור החסידה 9, אילת"
UPDATED = "23.10.2026"
YEAR = "2026"

WAZE = "https://waze.com/ul?q=" + quote("מקור החסידה 9 אילת") + "&navigate=yes"
GMAPS = "https://www.google.com/maps/search/?api=1&query=" + quote("מקור החסידה 9, אילת")
WA_LINK = "https://wa.me/" + WA + "?text=" + quote("שלום, אשמח לקבל פרטים על הרשמה לג'ודוקאן אילת.")
IJF = "https://www.ijf.org/"
IJA = "https://www.ija.org.il/"
CLUB_EMAIL = ""  # the club's e-mail address. Empty on purpose: the e-mail option then opens a ready draft without a recipient
EMAIL = os.environ.get("JK_EMAIL", CLUB_EMAIL).strip()
if EMAIL and not re.fullmatch(r"[^\s@\"'<>&]+@[^\s@\"'<>&]+\.[^\s@\"'<>&]{2,}", EMAIL):
    raise SystemExit("The e-mail address is not valid: " + EMAIL)
MAIL_SUBJECT = "פנייה מהאתר: הרשמה לג'ודוקאן אילת"

NEWTAB = '<span class="sr-only"> (נפתח בלשונית חדשה)</span>'

# the club's logo (circle only): assets/img/logo.svg, a vector redrawn from the photo of the club's shirt print;
# the PNG icons are made from it by tools/make_logo_assets.py
BRAND_MARK = '<img class="brand-mark" src="assets/img/logo.svg" width="1000" height="1000" alt="" decoding="async">'
LOGO_ALT = "לוגו המועדון: ג'ודוקא בזריקה בתוך עיגול אדום, ומעליו הכיתוב ג'ודוקאן אילת"
OG_ALT = "לוגו ג'ודוקאן אילת, מועדון ג'ודו באילת"


def ext(url, text, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<a{c} href="{url}" target="_blank" rel="noopener noreferrer">{text}{NEWTAB}</a>'


def tel(cls="tel"):
    return f'<a class="{cls}" href="tel:{PHONE_TEL}" dir="ltr">{PHONE}</a>'


def icon(name, cls="i"):
    return f'<svg class="{cls}" aria-hidden="true" focusable="false"><use href="#i-{name}"/></svg>'


SPRITE = """<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">
<!-- Icons: arrow/menu/check/wa from the supplied design; phone, pin, navigation: Feather (MIT) -->
<defs>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></symbol>
<symbol id="i-wa" viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-nav" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></symbol>
<symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
<symbol id="i-access" viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5M9 21l3-6 3 6"/></symbol>
</defs>
</svg>"""

NAV = [
    ("top", "ראשי", "始"),
    ("about", "המועדון", "礼"),
    ("programs", "חוגים", "組"),
    ("champions", "אלופים", "勝"),
    ("training", "האימון", "技"),
    ("schedule", "מערכת שעות", "稽古"),
    ("way", "הדרך", "道"),
    ("faq", "שאלות נפוצות", "問"),
    ("join", "צור קשר", "縁"),
]


def sidebar(home, current=None):
    base = "" if home else "index.html"
    items = []
    for i, (sid, label, kj) in enumerate(NAV, 1):
        if sid.endswith(".html"):
            href = sid
            cur = ' aria-current="page"' if current == sid else ""
        else:
            href = f"{base}#{sid}"
            cur = ""
        items.append(
            f'<a href="{href}"{cur}><span class="num" aria-hidden="true">{i:02d}</span>'
            f'<span class="lbl">{label}</span><span class="kj" lang="ja" aria-hidden="true">{kj}</span></a>'
        )
    nav = "\n".join(items)
    return f"""<header class="side" id="side">
<div class="side-top">
<a class="brand" href="{base}#top">
{BRAND_MARK}
<span class="brand-text"><b>{CLUB}</b><small lang="en" dir="ltr">JUDOKAN · EILAT JUDO</small></span>
</a>
<button type="button" class="menu-btn" aria-label="פתיחת תפריט" aria-expanded="false" aria-controls="site-nav">{icon("menu", "i")}</button>
</div>
<nav class="side-nav" id="site-nav" aria-label="ניווט ראשי">
{nav}
</nav>
<div class="side-bottom">
<a class="side-cta" href="{base}#join">צרו קשר</a>
<div class="side-contact">{tel("tel")}<br>{ADDR}</div>
<div class="side-osu" aria-hidden="true"></div>
</div>
</header>"""


def footer(home):
    base = "" if home else "index.html"
    footer_mail = f'<br><a href="mailto:{EMAIL}" dir="ltr">{EMAIL}</a>' if EMAIL else ""
    return f"""<footer class="foot" id="site-footer" tabindex="-1">
<div class="foot-in">
<div class="foot-grid">
<div class="foot-col">
<div class="foot-brand">{BRAND_MARK}<b>{CLUB}</b></div>
<p>מועדון ג'ודו באילת. בנים ובנות מגיל 4, נוער ומבוגרים.</p>
</div>
<div class="foot-col">
<h2 class="foot-label">כתובת</h2>
<address class="foot-val">{ADDR}</address>
</div>
<div class="foot-col">
<h2 class="foot-label">טלפון ושעות</h2>
<div class="foot-val">{tel("tel")}{footer_mail}<br>ימי אימון: ראשון, שלישי וחמישי<br>16:00 עד 21:00</div>
</div>
<div class="foot-col">
<h2 class="foot-label">ניווט והודעה</h2>
<div class="foot-icons">
{ext(WAZE, icon("nav") + '<span class="sr-only">ניווט עם Waze</span>')}
{ext(GMAPS, icon("pin") + '<span class="sr-only">פתיחה ב־Google Maps</span>')}
{ext(WA_LINK, icon("wa") + '<span class="sr-only">הודעה בוואטסאפ</span>')}
<a href="tel:{PHONE_TEL}">{icon("phone")}<span class="sr-only">חיוג למועדון</span></a>
</div>
</div>
</div>
<nav class="foot-links" aria-label="מידע משפטי וקישורים שימושיים">
<a href="{base}#join">יצירת קשר</a>
<a href="{base}#faq">שאלות נפוצות</a>
<a href="accessibility.html">הצהרת נגישות</a>
<a href="privacy.html">מדיניות פרטיות</a>
<a href="terms.html">תנאי שימוש</a>
{ext(IJA, "איגוד הג'ודו בישראל")}
{ext(IJF, "הפדרציה הבינלאומית לג'ודו (IJF)")}
<a href="#">חזרה לראש העמוד</a>
</nav>
<div class="foot-bar">
<p>© {YEAR} {CLUB}. כל הזכויות שמורות.</p>
<p lang="ja">柔よく剛を制す</p>
</div>
</div>
<a class="to-top" href="#" aria-label="חזרה לראש העמוד" hidden>{icon("up")}</a>
</footer>"""


MBAR = f"""<nav class="mbar" aria-label="פעולות מהירות">
<a class="call" href="tel:{PHONE_TEL}">{icon("phone")}<span>התקשרו</span></a>
<a class="wa" href="{WA_LINK}" target="_blank" rel="noopener noreferrer">{icon("wa")}<span>וואטסאפ</span>{NEWTAB}</a>
</nav>"""

INIT_JS = ("(function(){var d=document.documentElement;d.classList.add('js');try{var s=JSON.parse(localStorage.getItem('jk-a11y')||'{}');"
           "if(s.fs>1&&s.fs<=1.4)d.style.setProperty('--fs',s.fs);['contrast','gray','links','font','spacing','nomotion','stack'].forEach(function(k){if(s[k])d.classList.add('a11y-'+k)})}catch(e){}})();")


INIT_HASH = base64.b64encode(hashlib.sha256(INIT_JS.encode("utf-8")).digest()).decode()
CSP = ("default-src 'none'; script-src 'self' 'sha256-" + INIT_HASH + "'; style-src 'self'; img-src 'self'; font-src 'self'; "
       "connect-src 'none'; frame-src 'none'; object-src 'none'; form-action https://wa.me; base-uri 'none'; upgrade-insecure-requests")


BUILT = []   # the pages this run wrote


def page(filename, title, desc, main, home=False, jsonld=None, og=True, current=None, skip2=None):
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>\n"
    ogtags = ""
    if og:
        ogtags = f"""<meta property="og:type" content="website">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="{CLUB}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="assets/img/og-image.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{OG_ALT}">
<meta name="twitter:card" content="summary_large_image">
"""
    skip2_html = f'<a class="skip" href="{skip2[0]}">{skip2[1]}</a>\n' if skip2 else ""
    html = f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#EE362E">
<meta name="color-scheme" content="light">
{ogtags}<link rel="icon" href="assets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="assets/img/logo-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preload" href="assets/fonts/heebo-hebrew.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/style.css">
<script>{INIT_JS}</script>
{ld}</head>
<body>
<a class="skip" href="#main">דלגו לתוכן הראשי</a>
{skip2_html}{SPRITE}
<div class="layout">
{sidebar(home, current)}
<div class="content">
{main}
{footer(home)}
</div>
</div>
{MBAR}
<script src="assets/js/main.js" defer></script>
</body>
</html>
"""
    with open(os.path.join(DOCS, filename), "w", encoding="utf-8") as f:
        f.write(html)
    BUILT.append(filename)


# ---------------------------------------------------------------- forms
GROUP_OPTIONS = ["לא בטוחים, אשמח לייעוץ", "גן וכיתה א׳ (גילאי 4 עד 7)", "כיתה ב׳ ומעלה", "מבוגרים"]

FORM_NOTE = 'נפתחת הודעה מוכנה, והיא נשלחת רק כשלוחצים "שלח" באפליקציה. האתר לא שומר שום מידע.'


def ctl(p, key, tag="input", attrs="", inner=""):
    base = f'id="{p}-{key}" name="{key}" aria-describedby="{p}-{key}-err" aria-invalid="false"'
    if tag == "input":
        return f"<input {base} {attrs}>"
    return f"<{tag} {base} {attrs}>{inner}</{tag}>"


def field(p, key, label, control, required=False, rule=""):
    note = "(חובה)" if required else "(לא חובה)"
    rule_attr = f' data-rule="{rule}"' if rule else ""
    req_attr = ' data-required="1"' if required else ""
    if required:
        control = control.replace('aria-invalid="false"', 'aria-invalid="false" aria-required="true"', 1)
    return (f'<div class="field"{rule_attr}{req_attr}>\n'
            f'<label for="{p}-{key}">{label}<span class="req" aria-hidden="true" hidden>*</span><span class="opt">{note}</span></label>\n'
            f'{control}\n<span class="err" id="{p}-{key}-err"></span>\n</div>')


def consent_field(p):
    return (f'<div class="field field--check" data-rule="consent" data-required="1">\n'
            f'<div class="check-row"><input id="{p}-consent" name="consent" type="checkbox" aria-describedby="{p}-consent-err" aria-invalid="false" aria-required="true">'
            f'<label for="{p}-consent">קראתי והסכמתי ל<a href="privacy.html">מדיניות הפרטיות</a><span class="req" aria-hidden="true" hidden>*</span><span class="opt">(חובה)</span></label></div>\n'
            f'<span class="err" id="{p}-consent-err"></span>\n</div>')


def contact_block():
    mail = f'<br>אימייל: <a href="mailto:{EMAIL}" dir="ltr">{EMAIL}</a>' if EMAIL else ""
    return f'טלפון: {tel("tel")}{mail}<br>כתובת: {ADDR}'


def form_result(p, mail=False):
    open_mail = f'<a class="btn btn--line js-open-mail" href="mailto:{EMAIL}">{icon("mail")}פתיחה במייל</a>' if mail else ""
    hint = "אם האפליקציה לא נפתחה, לחצו על אחד הכפתורים, או העתיקו את ההודעה ושלחו אותה ידנית."
    if not mail:
        hint = f"אם וואטסאפ לא נפתח, לחצו על הכפתור, או העתיקו את ההודעה ושלחו אותה ידנית אל {tel('tel')}."
    return f"""<div class="result" id="{p}-result" tabindex="-1" role="region" aria-labelledby="{p}-result-title" hidden>
<h3 id="{p}-result-title">ההודעה מוכנה</h3>
<p>{hint}</p>
<label for="{p}-text" class="sr-only">נוסח ההודעה</label>
<textarea id="{p}-text" readonly rows="7"></textarea>
<div class="btn-row">
<a class="btn js-open-wa" href="{WA_LINK}" target="_blank" rel="noopener noreferrer">{icon("wa")}פתיחה בוואטסאפ{NEWTAB}</a>
{open_mail}
<button type="button" class="btn btn--line" data-copy-from="{p}-text">{icon("copy")}העתקת ההודעה</button>
</div>
</div>"""


NOJS_MESSAGE = "שלום, אשמח לקבל פרטים על הרשמה לג'ודוקאן אילת.\n\nשם:\nטלפון:\nגיל המתאמן או המתאמנת:\n"


def nojs_card(p, title, tag):
    """What a visitor gets when scripts do not run: one box with a ready message to complete, sent to WhatsApp by a plain GET form
    (wa.me reads the text parameter). The checkbox has no name, so it is checked by the browser but not sent."""
    return f"""<form class="cform nojs-card" id="{p}-nojs" method="get" action="https://wa.me/{WA}" target="_blank">
<{tag} class="form-title">{title}</{tag}>
<p class="nojs-help">משלימים את הפרטים בתיבה ולוחצים על השליחה. ההודעה נפתחת בוואטסאפ, ושם שולחים אותה.</p>
<div class="field">
<label for="{p}-nojs-text">הפרטים שלכם</label>
<textarea id="{p}-nojs-text" name="text" rows="7" maxlength="400" required>{NOJS_MESSAGE}</textarea>
</div>
<div class="field field--check">
<div class="check-row"><input id="{p}-nojs-consent" type="checkbox" required><label for="{p}-nojs-consent">קראתי והסכמתי ל<a href="privacy.html">מדיניות הפרטיות</a></label></div>
</div>
<div class="send-row">
<button type="submit" class="send-wa">{icon("wa")}שליחה בוואטסאפ</button>
</div>
<p class="form-note">{FORM_NOTE}</p>
<p class="form-note">או התקשרו: {tel("tel")}</p>
</form>"""


def details_form(p, form_id, title, tag, full):
    """The form with all the checks (needs scripts) followed by the plain card for visitors without scripts.
    full: the contact page form (also e-mail and a free message); otherwise the short form of the home page."""
    options = "".join(f"<option>{o}</option>" for o in GROUP_OPTIONS)
    name = field(p, "name", "שם מלא", ctl(p, "name", "input", 'type="text" maxlength="60" autocomplete="name" enterkeyhint="next" placeholder="שם פרטי ושם משפחה"'), True, "name")
    phone = field(p, "phone", "טלפון", ctl(p, "phone", "input", 'type="tel" maxlength="20" inputmode="tel" autocomplete="tel" enterkeyhint="next" placeholder="050-0000000" class="ltr-input"'), True, "phone")
    email = field(p, "email", "אימייל", ctl(p, "email", "input", 'type="email" maxlength="80" autocomplete="email" enterkeyhint="next" placeholder="כתובת המייל שלכם" class="ltr-input"'), False, "email") if full else ""
    age = field(p, "age", "גיל המתאמן או המתאמנת", ctl(p, "age", "input", 'type="text" maxlength="3" inputmode="numeric" enterkeyhint="next" placeholder="למשל 8" class="ltr-input"'), True, "age")
    group = field(p, "group", "קבוצה מבוקשת", ctl(p, "group", "select", '', options))
    message = field(p, "message", "הודעה", ctl(p, "message", "textarea", 'rows="4" maxlength="300" placeholder="אפשר לכתוב כאן כל שאלה"')) if full else ""
    rows = "\n".join(x for x in (name, phone, email, age, group, message, consent_field(p)) if x)
    return f"""<form class="cform" id="{form_id}" data-wa="{WA}" data-email="{EMAIL}" data-subject="{MAIL_SUBJECT}" novalidate>
<{tag} class="form-title">{title}</{tag}>
<div class="form-fields">
{rows}
<div class="send-row">
<button type="button" class="send-wa" data-channel="wa">{icon("wa")}שליחה בוואטסאפ</button>
<button type="button" class="send-mail" data-channel="mail">{icon("mail")}שליחה במייל</button>
</div>
<p class="form-note">{FORM_NOTE}</p>
{form_result(p, True)}
</div>
</form>
{nojs_card(p, title, tag)}"""


def join_form():
    """The one form of the site (the red band): name, phone, e-mail, age, group, a free message and the consent box."""
    return details_form("jf", "join-form", "השאירו פרטים", "h3", True)


def contact_info(tag="h3", cid="join-info-title"):
    mail_row = ""
    if EMAIL:
        mail_row = (f'<div class="ci-row"><div class="ci-label">אימייל</div><div class="ci-val"><a href="mailto:{EMAIL}" dir="ltr">{EMAIL}</a></div>'
                    f'<div class="ci-actions"><button type="button" class="ci-btn" data-copy="{EMAIL}">{icon("copy")}העתקה<span class="sr-only"> של כתובת המייל</span></button></div></div>')
    return f"""<aside class="contact-info" aria-labelledby="{cid}">
<{tag} id="{cid}">פרטי קשר</{tag}>
<div class="ci-row"><div class="ci-label">טלפון</div><div class="ci-val">{tel("tel")}</div><div class="ci-actions"><a class="ci-btn" href="tel:{PHONE_TEL}">{icon("phone")}חיוג</a><button type="button" class="ci-btn" data-copy="{PHONE}">{icon("copy")}העתקה<span class="sr-only"> של מספר הטלפון</span></button></div></div>
<div class="ci-row"><div class="ci-label">וואטסאפ</div><div class="ci-val">הודעה אל אותו מספר</div><div class="ci-actions">{ext(WA_LINK, icon("wa") + "כתבו בוואטסאפ", "ci-btn")}</div></div>
{mail_row}
<div class="ci-row"><div class="ci-label">כתובת</div><address class="ci-val">{ADDR}</address><div class="ci-actions">{ext(WAZE, icon("nav") + "Waze", "ci-btn")}{ext(GMAPS, icon("pin") + "Google Maps", "ci-btn")}</div></div>
<div class="ci-row"><div class="ci-label">ימי פעילות</div><div class="ci-val">ראשון, שלישי וחמישי<br><bdi dir="ltr">16:00–21:00</bdi></div></div>
</aside>"""


# ---------------------------------------------------------------- index
def index_main():
    return f"""<main id="main" tabindex="-1">

<section id="top" class="hero" aria-labelledby="hero-title" tabindex="-1">
<div class="hero-in">
<div class="hero-copy">
<div class="kicker">מועדון ג'ודו · אילת</div>
<h1 id="hero-title">משמעת עצמית.<br>כבוד לאחר.<br><span>ג'ודו.</span></h1>
<p class="hero-lead">אנחנו מציעים שיעורי ג'ודו, אומנות לחימה יפנית, לילדים צעירים, לנערים ולבוגרים, בנים ובנות כאחד, החל מגיל ארבע.</p>
<div class="btn-row">
<a class="btn" href="#join">צרו קשר {icon("arrow", "i arrow")}</a>
<a class="btn btn--line" href="#programs">לכל הגילאים</a>
</div>
<ul class="stats" role="list">
<li class="stat"><b><bdi dir="ltr">4+</bdi></b><span>גיל התחלה</span></li>
<li class="stat"><b>3</b><span>ימי אימון בשבוע</span></li>
<li class="stat"><b>12</b><span>חודשי פעילות בשנה</span></li>
</ul>
</div>
<div class="hero-art">
<div class="sun"><img src="assets/img/logo.svg" width="1000" height="1000" alt="{LOGO_ALT}" fetchpriority="high"></div>
<div class="hero-vert" lang="ja" aria-hidden="true">礼に始まり礼に終わる</div>
<p class="hero-quote">מעל לכל אנחנו מקפידים על משמעת עצמית ועל כבוד לאחר.</p>
</div>
</div>
</section>

<section id="about" class="band band-dark" aria-labelledby="about-title" tabindex="-1">
<div class="band-in">
<div class="band-head">
<div class="h"><div class="eyebrow">המועדון</div><h2 id="about-title">בית ספר לג'ודו באילת.</h2></div>
<p>המדריכים שלנו עובדים עם הילדים והנוער על פיתוח ביטחון עצמי, כושר גופני, זריזות וקואורדינציה. אנחנו מציעים למתאמנים ליגות, תחרויות ומחנות אימונים, ופועלים 12 חודשים בשנה.</p>
</div>
<div class="cards4" data-hs="ארבעת עמודי התווך של המועדון">
<div class="card-dark"><div class="kj" lang="ja" aria-hidden="true">体</div><h3>גוף וכושר</h3><p>אצלנו עובדים עם הילדים והנוער על כושר גופני, זריזות וקואורדינציה. בג'ודו לומדים גם ליפול בבטחה, מיומנות שימושית בכל ספורט וביום־יום.</p></div>
<div class="card-dark"><div class="kj" lang="ja" aria-hidden="true">心</div><h3>ביטחון ומשמעת</h3><p>פיתוח ביטחון עצמי הוא חלק מהעבודה שלנו עם הילדים והנוער, ומעל לכל אנחנו מקפידים על משמעת עצמית.</p></div>
<div class="card-dark"><div class="kj" lang="ja" aria-hidden="true">技</div><h3>טכניקה</h3><p>בג'ודו, טכניקה נכונה מנצחת כוח: לומדים להשתמש בתנועה של בן הזוג ולהפעיל כוח בדיוק ברגע הנכון.</p></div>
<div class="card-dark"><div class="kj" lang="ja" aria-hidden="true">礼</div><h3>כבוד לאחר</h3><p>מעל לכל אנחנו מקפידים על כבוד לאחר. בג'ודו מקדמים ברכה (קידה) בתחילת האימון ובסופו, ומתאמנים בזוגות.</p></div>
</div>
<p class="note">באומנויות הלחימה היפניות מדברים על <span lang="ja">心技体</span> (שין־גי־טאי): נפש, טכניקה וגוף שמתפתחים יחד, וכבוד שמלווה את כולם.</p>
<div class="coach" id="coach">
<div class="coach-name">
<span class="coach-tag">מאמן ראשי</span>
<h3>דוד בן-ארבון</h3>
<div class="kohaku" aria-hidden="true"></div>
<p class="coach-belt">חגורה אדומה־לבנה, דרגת דאן גבוהה</p>
</div>
<div class="coach-bio">
<p>בשנת 2000 החליט דוד לקחת את כל הניסיון והידע שלו בתחום, להגשים חלום ולפתוח בעיר בית ספר לג'ודו משלו.</p>
<p>הוא התחיל לתרגל ג'ודו בצרפת כבר בילדותו, עלה לישראל ב־1970 ומאז מלמד ג'ודו.</p>
<p>החגורה האדומה־לבנה שהוא עונד מציינת דרגת דאן גבוהה, מדאן&nbsp;6 עד דאן&nbsp;8.</p>
</div>
</div>
</div>
</section>

<section id="programs" class="band" aria-labelledby="programs-title" tabindex="-1">
<div class="band-in">
<div class="center-head">
<div class="eyebrow">החוגים</div>
<h2 id="programs-title">יש מקום לכל גיל.</h2>
<p>האקדמיה שלנו מתאימה לילדים מגיל 4, כתחביב או כמקצוע לעתיד. השיעורים מחולקים לפי שכבת גיל.</p>
</div>
<ul class="programs" role="list" data-hs="החוגים לפי גיל">
<li class="prog"><div class="prog-top"><span class="prog-no">01</span><span class="prog-age">גילאי <bdi dir="ltr">4–7</bdi></span></div><h3>גן וכיתה א׳</h3><p>שיעורי ג'ודו לילדים צעירים, בנים ובנות כאחד, החל מגיל ארבע.</p><span class="prog-meta">שיעור של כשעה</span></li>
<li class="prog"><div class="prog-top"><span class="prog-no">02</span><span class="prog-age">גילאי <bdi dir="ltr">7–18</bdi></span></div><h3>כיתה ב׳ ומעלה</h3><p>המדריכים שלנו עובדים עם הילדים והנוער על פיתוח ביטחון עצמי, כושר גופני, זריזות וקואורדינציה.</p><p>אצלנו פועלת נבחרת צעירה לגילאי 10 עד 13: שלושה אימונים בשבוע, כשעה וחצי כל אחד, ואימון מנטלי עם איש מקצוע.</p><span class="prog-meta">שיעור של כשעה וחצי</span></li>
<li class="prog"><div class="prog-top"><span class="prog-no">03</span><span class="prog-age">18+</span></div><h3>מבוגרים</h3><p>גם מבוגרים מתאמנים אצלנו, בקבוצה של מבוגרים. לפרטים על הקבוצה, התקשרו.</p><span class="prog-meta">שיעור של כשעה וחצי</span></li>
<li class="prog prog--dark"><div class="prog-top"><span class="prog-no">04</span><span class="prog-age">להמשך הדרך</span></div><h3>ליגות ותחרויות</h3><p>אנחנו מציעים למתאמנים ליגות, תחרויות ומחנות אימונים.</p></li>
</ul>
</div>
</section>

<section id="champions" class="band band-paper" aria-labelledby="champions-title" tabindex="-1">
<div class="band-in">
<div class="band-head">
<div class="h"><div class="eyebrow">אלופים</div><h2 id="champions-title">בית הספר לג'ודו שמגדל אלופים.</h2></div>
<p>כמה נתונים על הדרך של המתאמנים שלנו.</p>
</div>
<ul class="champs" role="list" data-hs="אלופים והישגים">
<li class="champ"><div class="champ-num" aria-hidden="true">12</div><h3>12 אלופי ישראל בשנה אחת</h3><p>בשנת 2011 נוספו לנו 12 אלופי ישראל בשנה אחת.</p></li>
<li class="champ"><div class="champ-num" aria-hidden="true">2023</div><h3>אלוף ישראל לבוגרים 2023</h3><p>אחד המתאמנים שלנו, שגדל באילת ומתאמן אצלנו מגיל צעיר, הוא אלוף ישראל לבוגרים 2023 במשקל מעל 100 ק״ג. בשנת 2024 סיים במקום החמישי בגרנד פרי לינץ שבאוסטריה.</p></li>
<li class="champ"><div class="champ-num champ-num--jp" lang="ja" aria-hidden="true">勝</div><h3>מדליסטים בכל גיל ומשקל</h3><p>בשנת 2011 היו לנו בעלי מדליות כמעט בכל גיל ומשקל, בבנים וגם בבנות, וההישגים הבולטים ביותר היו של הבנות.</p></li>
<li class="champ"><div class="champ-num" aria-hidden="true">130</div><h3>כ־130 מתאמנים בשנה רגילה</h3><p>בשנה רגילה התאמנו אצלנו כ־130 מתאמנים.</p></li>
</ul>
</div>
</section>

<section id="training" class="band" aria-labelledby="training-title" tabindex="-1">
<div class="band-in">
<div class="band-head">
<div class="h"><div class="eyebrow">האימון</div><h2 id="training-title">כך נראה אימון ג'ודו.</h2></div>
<p>מבנה האימון דומה ברוב מועדוני הג'ודו בעולם. זהו תיאור כללי של אימון ג'ודו, ופרטי האימון בכל קבוצה נקבעים על ידי המאמן.</p>
</div>
<div class="train-grid">
<ol class="steps" role="list" data-hs="שלבי האימון">
<li class="step"><h3>קידה ופתיחה <span lang="ja" aria-hidden="true">礼</span></h3><p>נכנסים למזרן, מקדמים ברכה ומתחילים יחד.</p></li>
<li class="step"><h3>חימום <span lang="ja" aria-hidden="true">準備運動</span></h3><p>תנועה, גמישות וחיזוק. בגילאים צעירים, בדרך כלל דרך משחק.</p></li>
<li class="step"><h3>נפילות <span lang="ja" aria-hidden="true">受身</span></h3><p>לומדים ליפול, להתהפך ולקום בבטחה.</p></li>
<li class="step"><h3>טכניקה <span lang="ja" aria-hidden="true">技</span></h3><p>המאמן מדגים זריקה או החזקה, והמתאמנים מתרגלים בזוגות.</p></li>
<li class="step"><h3>תרגול חופשי <span lang="ja" aria-hidden="true">乱取り</span></h3><p>בגילאים גדולים בדרך כלל מתאמנים בתנועה חופשית עם בן זוג, ובקטנים עוברים למשחקי תנועה.</p></li>
<li class="step"><h3>סיום <span lang="ja" aria-hidden="true">礼</span></h3><p>מסדרים את המזרן, מקדמים ברכה ויוצאים.</p></li>
</ol>
<div class="side-block">
<h3>מחגורה לבנה לחגורה שחורה</h3>
<p>בג'ודו מתקדמים בדרגות שמסומנות בצבע החגורה. מתחילים בלבנה, עוברים שורה של חגורות צבעוניות (קיו) ומגיעים לשחורה, הדאן הראשון. מכאן הדרך נמשכת.</p>
<ol class="belts" role="list" aria-label="רצף החגורות בג'ודו">
<li class="belt belt--w"><span class="belt-bar" aria-hidden="true"></span><span class="belt-label">לבנה<small>התחלה</small></span></li>
<li class="belt belt--c"><span class="belt-bar" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="belt-label">חגורות צבעוניות<small>דרגות קיו</small></span></li>
<li class="belt belt--b"><span class="belt-bar" aria-hidden="true"></span><span class="belt-label">שחורה<small>דאן <bdi dir="ltr">1–5</bdi></small></span></li>
<li class="belt belt--k"><span class="belt-bar" aria-hidden="true"></span><span class="belt-label">אדומה־<wbr>לבנה<small>דאן <bdi dir="ltr">6–8</bdi></small></span></li>
<li class="belt belt--r"><span class="belt-bar" aria-hidden="true"></span><span class="belt-label">אדומה<small>דאן <bdi dir="ltr">9–10</bdi></small></span></li>
</ol>
<p class="note">דוגמה לרצף החגורות. צבעי הביניים משתנים בין מועדונים ואיגודים.</p>
<div class="glossary">
<h3>מילון ג'ודו קטן</h3>
<div class="gloss" data-hs="מילון ג'ודו קטן">
<dl>
<div><dt lang="ja">柔道家</dt><dd><b>ג'ודוקה</b>: מי שמתאמן בג'ודו.</dd></div>
<div><dt lang="ja">先生</dt><dd><b>סנסאי</b>: מורה.</dd></div>
<div><dt lang="ja">礼</dt><dd><b>ריי</b>: קידה, וגם נימוס וכבוד.</dd></div>
<div><dt lang="ja">受身</dt><dd><b>אוקמי</b>: נפילה בטוחה.</dd></div>
<div><dt lang="ja">始め</dt><dd><b>הג'ימה</b>: התחילו!</dd></div>
<div><dt lang="ja">待て</dt><dd><b>מאטה</b>: עצרו, חכו.</dd></div>
<div><dt lang="ja">一本</dt><dd><b>איפון</b>: ניקוד מלא שמסיים את הקרב.</dd></div>
<div><dt lang="ja">柔道着</dt><dd><b>ג'ודוגי</b>: בגד הג'ודו.</dd></div>
</dl>
</div>
</div>
</div>
</div>
</div>
</section>

<section id="schedule" class="band band-paper" aria-labelledby="schedule-title" tabindex="-1">
<div class="sched-in">
<div class="sched-copy">
<div class="eyebrow">מערכת שעות</div>
<h2 id="schedule-title">מתי מתאמנים?</h2>
<p>אנחנו פועלים בשלושה ימים בשבוע, 12 חודשים בשנה. שעת ההתחלה של כל קבוצה מתעדכנת מדי פעם, ולכן כדאי לאשר בטלפון לפני ההגעה.</p>
<div class="sched-kanji" aria-hidden="true"></div>
</div>
<div class="sched-main">
<ul class="days" role="list" aria-label="ימי ושעות פעילות" data-hs="ימי ושעות פעילות">
<li class="day"><b>ראשון</b><span><bdi dir="ltr">16:00–21:00</bdi></span></li>
<li class="day"><b>שלישי</b><span><bdi dir="ltr">16:00–21:00</bdi></span></li>
<li class="day"><b>חמישי</b><span><bdi dir="ltr">16:00–21:00</bdi></span></li>
</ul>
<div class="table-wrap" role="region" aria-label="טבלת משך השיעורים לפי קבוצה" tabindex="0">
<table>
<caption>משך השיעורים לפי קבוצה</caption>
<thead><tr><th scope="col">קבוצה</th><th scope="col">גילאים</th><th scope="col">משך שיעור</th></tr></thead>
<tbody>
<tr><td>גן וכיתה א׳</td><td><bdi dir="ltr">4–7</bdi></td><td>כשעה</td></tr>
<tr><td>כיתה ב׳ ומעלה</td><td><bdi dir="ltr">7–18</bdi></td><td>כשעה וחצי</td></tr>
<tr><td>מבוגרים</td><td>18+</td><td>כשעה וחצי</td></tr>
</tbody>
</table>
</div>
<p class="sched-note">שעות הפעילות הן טווח הזמן שבו אנחנו פתוחים. את שעת ההתחלה של הקבוצה שלכם נמסור בטלפון {tel("tel")}.</p>
</div>
</div>
</section>

<section id="way" class="band band-dark" aria-labelledby="way-title" tabindex="-1">
<div class="band-in">
<div class="band-head">
<div class="h"><div class="eyebrow">הדרך</div><h2 id="way-title">הרעיון שמאחורי הטכניקה.</h2></div>
<p>ג'יגורו קאנו בנה את הג'ודו כשיטת חינוך. את הפילוסופיה שלו מסכמים שני עקרונות. לצדם עומדים שמונה ערכים שהפדרציה הבינלאומית לג'ודו מגדירה לכל מתאמן.</p>
</div>
<div class="principles" data-hs="שני עקרונות היסוד">
<div class="principle"><div class="kj" lang="ja" aria-hidden="true">精力善用</div><h3>ניצול מיטבי של הכוח</h3><p>להשיג את המרב במינימום מאמץ, בעזרת טכניקה נכונה ותזמון נכון.</p></div>
<div class="principle"><div class="kj" lang="ja" aria-hidden="true">自他共栄</div><h3>התקדמות משותפת</h3><p>מתאמנים זה עם זה ולא זה נגד זה. כשבן הזוג משתפר, גם אני משתפר.</p></div>
</div>
<div class="values-title">
<h3>שמונת ערכי הג'ודו</h3>
<p>לפי קוד הערכים של הפדרציה הבינלאומית לג'ודו (IJF).</p>
</div>
<ul class="values" role="list" data-hs="שמונת ערכי הג'ודו">
<li><b>נימוס</b><span>מברכים, מודים ומקשיבים.</span></li>
<li><b>אומץ</b><span>מנסים גם כשקשה.</span></li>
<li><b>כנות</b><span>אומרים ועושים את האמת.</span></li>
<li><b>כבוד</b><span>שומרים על יושרה ועל הוגנות.</span></li>
<li><b>ענווה</b><span>מתקדמים בלי להתנשא.</span></li>
<li><b>הערכה</b><span>מעריכים את המאמן, את החברים ואת המאמץ של כל אחד.</span></li>
<li><b>שליטה עצמית</b><span>פועלים בשקט ובדיוק, גם בלחץ.</span></li>
<li><b>ידידות</b><span>בן הזוג לאימון הוא שותף, לא יריב.</span></li>
</ul>
<ol class="timeline" role="list" data-hs="ציוני דרך בהיסטוריה">
<li><b>1882</b><span>ג'יגורו קאנו (<span lang="ja">嘉納治五郎</span>) מקים בטוקיו את הקודוקאן (<span lang="ja">講道館</span>), בית הספר שבו נולד הג'ודו.</span></li>
<li><b>1964</b><span>הג'ודו נכנס לתוכנית המשחקים האולימפיים, בטוקיו.</span></li>
<li><b>1992</b><span>בברצלונה זוכה ישראל במדליות האולימפיות הראשונות שלה: יעל ארד בכסף ואורן סמדג'ה בארד. שתיהן בג'ודו.</span></li>
</ol>
</div>
</section>

<section id="faq" class="band" aria-labelledby="faq-title" tabindex="-1">
<div class="band-in">
<div class="center-head">
<div class="eyebrow">שאלות נפוצות</div>
<h2 id="faq-title">לפני שמתחילים.</h2>
</div>
<div class="faq">
<details><summary>מאיזה גיל אפשר להתחיל?</summary><div class="ans"><p>מגיל 4. הקבוצה הראשונה היא לגן ולכיתה א׳.</p></div></details>
<details><summary>האם ג'ודו מתאים גם לבנות?</summary><div class="ans"><p>כן. אנחנו מלמדים ג'ודו לבנים ולבנות כאחד.</p></div></details>
<details><summary>זה לתחביב או למי שרוצה להתחרות?</summary><div class="ans"><p>האקדמיה שלנו מתאימה לילדים מגיל 4, כתחביב או כמקצוע לעתיד. אצלנו יש גם ליגות, תחרויות ומחנות אימונים.</p></div></details>
<details><summary>האם ג'ודו בטוח לילדים?</summary><div class="ans"><p>בג'ודו לומדים ליפול בבטחה, והאימון מונחה על ידי מאמן. כמו בכל ענף ספורט, חשוב להגיע בבריאות טובה ולהקשיב להוראות. אם יש מגבלה רפואית, כדאי לעדכן את המאמן לפני תחילת האימונים.</p></div></details>
<details><summary>מה לובשים ומה מביאים?</summary><div class="ans"><p>לאימון מקובל להגיע בבגדי ספורט נוחים, עם ציפורניים קצרות וללא תכשיטים. כדאי לברר מול המאמן מה הציוד הנדרש, כולל בגד ג'ודו.</p></div></details>
<details><summary>האם יש תחרויות?</summary><div class="ans"><p>כן. אצלנו יש ליגות, תחרויות ומחנות אימונים.</p></div></details>
<details><summary>האם מבוגרים יכולים להצטרף?</summary><div class="ans"><p>כן. מבוגרים מתאמנים אצלנו בקבוצה של מבוגרים. לפרטים על הקבוצה, התקשרו.</p></div></details>
<details><summary>איך נרשמים וכמה זה עולה?</summary><div class="ans"><p>ההרשמה מתבצעת בטלפון, בוואטסאפ או דרך <a href="#join">הטופס שבסוף העמוד</a>. פרטי המסלולים והעלויות מתעדכנים לפי הגיל והקבוצה, ואנחנו נמסור אותם בשיחה.</p></div></details>
<details><summary>איך מגיעים?</summary><div class="ans"><p>אנחנו נמצאים ב{STREET}, אילת. אפשר לנווט ישירות עם {ext(WAZE, '<span lang="en" dir="ltr">Waze</span>')} או {ext(GMAPS, '<span lang="en" dir="ltr">Google Maps</span>')}, וגם מהכפתורים בתחתית האתר.</p></div></details>
</div>
</div>
</section>

<section id="join" class="join" aria-labelledby="join-title" tabindex="-1">
<div class="join-in">
<div class="join-copy">
<div class="join-kj" lang="ja" aria-hidden="true">始めよう</div>
<h2 id="join-title">מוכנים<br>להתחיל?</h2>
<p class="join-lead">התקשרו או כתבו בוואטסאפ לפרטים על הקבוצות, השעות, העלויות ודרך ההרשמה.</p>
<ul class="join-list" role="list">
<li>{icon("check", "i")}פעילות 12 חודשים בשנה</li>
<li>{icon("check", "i")}בנים ובנות, מגיל 4 ועד מבוגרים</li>
<li>{icon("check", "i")}ליגות, תחרויות ומחנות אימונים</li>
</ul>
</div>
<div class="join-side">
{join_form()}
{contact_info()}
</div>
</div>
</section>

</main>"""


index_ld = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    "name": CLUB,
    "alternateName": ["גודוקאן אילת", "Judokan Eilat"],
    "description": "מועדון ג'ודו באילת לבנים ולבנות מגיל 4, לנוער ולמבוגרים. פעילות כל השנה, ליגות, תחרויות ומחנות אימונים.",
    "sport": "Judo",
    "telephone": "+972-50-578-8781",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": STREET,
        "addressLocality": "אילת",
        "addressCountry": "IL",
    },
    "openingHoursSpecification": [{
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["https://schema.org/Sunday", "https://schema.org/Tuesday", "https://schema.org/Thursday"],
        "opens": "16:00",
        "closes": "21:00",
    }],
    "founder": {"@type": "Person", "name": "דוד בן-ארבון", "jobTitle": "מאמן ראשי"},
    "areaServed": "אילת",
}

page(
    "index.html",
    "ג'ודוקאן אילת | מועדון ג'ודו לילדים, נוער ומבוגרים",
    "ג'ודוקאן אילת (גודוקאן): מועדון ג'ודו במקור החסידה 9. אימונים מגיל 4 לבנים ובנות, נוער ומבוגרים, כל השנה. ליגות, תחרויות ומחנות אימונים. התקשרו 050-5788781.",
    index_main(),
    home=True,
    jsonld=index_ld,
)

# ---------------------------------------------------------------- legal pages
def legal(title_h1, meta_line, body):
    return f"""<main id="main" tabindex="-1">
<div class="legal">
<a class="back" href="index.html">{icon("arrow", "i arrow flip")} חזרה לעמוד הראשי</a>
<h1>{title_h1}</h1>
<p class="meta">{meta_line}</p>
{body}
</div>
</main>"""


ACCESS_BODY = f"""
<p>{CLUB} רוצה שכל אדם יוכל לקבל מידע על המועדון וליצור איתנו קשר בצורה עצמאית ושוויונית, כולל אנשים עם מוגבלות. לכן האתר נבנה מראש לפי כללי הנגישות.</p>

<h2>התקן שעליו מבוסס האתר</h2>
<p>האתר נבנה בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג־2013, ולתקן הישראלי ת"י 5568 (הנחיות לנגישות תכנים באינטרנט, המבוססות על WCAG) ברמת AA. בפועל האתר נבנה גם לפי הנחיות WCAG 2.1 ברמת AA.</p>

<h2>התאמות הנגישות שבוצעו</h2>
<ul>
<li><strong>מבנה:</strong> שפת העמוד מוגדרת עברית וכיוון הקריאה מימין לשמאל. הכותרות בנויות בסדר היררכי, ואזורי העמוד מסומנים (כותרת, ניווט, תוכן ראשי, תחתית).</li>
<li><strong>מקלדת:</strong> אפשר לגלוש בכל האתר באמצעות מקלדת בלבד. בתחילת כל עמוד יש קישור "דלגו לתוכן הראשי", והמיקום הנוכחי מסומן בבירור.</li>
<li><strong>קוראי מסך:</strong> לשדות הטופס יש תוויות, לכפתורים ולקישורים יש שמות ברורים, קישורים שנפתחים בלשונית חדשה מסומנים, וקישוטים גרפיים מוסתרים מטכנולוגיות מסייעות. מונחים ביפנית מסומנים בשפתם.</li>
<li><strong>ניגודיות וצבעים:</strong> ניגודיות הטקסט היא לפחות 4.5 ל־1, ובטקסט גדול לפחות 3 ל־1. מידע אינו מועבר בצבע בלבד.</li>
<li><strong>תצוגה:</strong> אפשר להגדיל את הטקסט עד 200 אחוז ללא אובדן תוכן. האתר מתאים את עצמו למסכי נייד, טאבלט ומחשב.</li>
<li><strong>תפריט נגישות באתר:</strong> הגדלה והקטנה של הטקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים, גופן קריא, ריווח טקסט ועצירת אנימציות. ההעדפות נשמרות בדפדפן שלכם בלבד.</li>
<li><strong>טופס:</strong> לכל שדה יש תווית גלויה, ושדות חובה מסומנים בטקסט. שדה שלא מולא, או מולא חלקית, מסומן בכוכבית אדומה ובהודעה בטקסט מתחתיו שמסבירה מה חסר, והמיקוד עובר אל השדה הראשון שדורש תיקון. המידע אינו מועבר בצבע בלבד.</li>
<li><strong>גלילה לצד:</strong> בנייד, כשגוללים את הדף ומגיעים לפס כרטיסים, הפס נעצר במקומו והכרטיסים זזים הצידה עם הגלילה הרגילה. הכרטיסים זזים רק כשכל השאר במסך עומד במקום: קודם הטקסט שמעל הפס יוצא מהמסך, ורק אז הכרטיסים מתחילים לזוז, ואחרי הכרטיס האחרון הפס נשאר במקומו עד שהחלק הבא מגיע. אחרי זה הדף ממשיך להיגלל כרגיל. אפשר גם להחליק בפס הצידה באצבע או לגרור בעכבר, ובמקלדת להשתמש במקשי החצים אחרי שמגיעים אל הפס עם Tab. מי שמגדיר במכשיר "הפחתת תנועה", או מפעיל "עצירת אנימציות" בתפריט הנגישות, מקבל פס שמחליקים בו בעצמם, בלי תנועה שנגררת אחרי הגלילה. מי שמעדיף תצוגה רציפה, בלי גלילה לצד, יכול להפעיל "בלי גלילה לצד" בתפריט הנגישות. פס שגבוה מהמסך הפנוי, למשל בטלפון על הצד או בטקסט מוגדל, לא נעצר, ומחליקים בו בעצמם.</li>
<li><strong>אורך העמוד:</strong> בתחילת כל עמוד יש קישור דילוג לתוכן הראשי, תפריט ניווט לכל הקטעים, וכפתור חזרה לראש העמוד.</li>
<li><strong>בלי JavaScript:</strong> התפריט, הקישורים והתוכן זמינים גם כשהסקריפטים חסומים. במקום הטופס המלא יש אז כרטיס פשוט: תיבה אחת עם הודעה מוכנה שנשלחת בוואטסאפ, וקישור חיוג.</li>
<li><strong>תנועה:</strong> אין תוכן מהבהב. האנימציות קצרות, והאתר מכבד את הגדרת "הפחתת תנועה" של מערכת ההפעלה.</li>
</ul>

<h2>בדיקות</h2>
<p>האתר נבדק בכלי בדיקה אוטומטיים (axe) ובבדיקות של ניווט מקלדת, ניגודיות, הגדלת טקסט עד 200 אחוז ותצוגה במסכי נייד, טאבלט ומחשב. בדיקה עם קוראי מסך שונים טרם בוצעה, ולכן ייתכנו הבדלים בחוויית השימוש.</p>

<h2>מגבלות ידועות</h2>
<ul>
<li>האתר מפנה לאתרים חיצוניים (Waze, Google Maps, וואטסאפ ואיגודי ג'ודו). הנגישות שלהם באחריות מפעיליהם.</li>
<li>ייתכן שחלקים מסוימים טרם הונגשו במלואם. אם נתקלתם בקושי, נשמח לדעת ולתקן.</li>
</ul>

<h2>שירות חלופי</h2>
<p>אפשר לקבל את כל המידע ולהירשם גם בשיחת טלפון או בהודעת וואטסאפ אל {tel("tel")}.</p>

<h2>פנייה בנושא נגישות</h2>
<div class="box">
<p>נתקלתם בבעיית נגישות או יש לכם הצעה לשיפור? פנו אל מנהל המועדון:</p>
<p>{contact_block()}</p>
<p>נשתדל להשיב בהקדם ולטפל בכל פנייה.</p>
</div>
"""

page(
    "accessibility.html",
    "הצהרת נגישות | ג'ודוקאן אילת",
    "הצהרת הנגישות של אתר ג'ודוקאן אילת: התקן, התאמות הנגישות שבוצעו, מגבלות ידועות ודרכי פנייה.",
    legal("הצהרת נגישות", f"עודכנה לאחרונה: {UPDATED}", ACCESS_BODY),
    og=False,
)

mail_priv = ", או טיוטה בתוכנת הדואר אם בחרתם במייל"

PRIVACY_BODY = f"""
<p>אנחנו ב{CLUB} מכבדים את הפרטיות שלכם. המדיניות הזו מסבירה איזה מידע האתר אוסף ואיך משתמשים בו, בהתאם לחוק הגנת הפרטיות, התשמ"א־1981.</p>

<h2>מה האתר אוסף</h2>
<ul>
<li>האתר אינו אוסף מידע אישי, אינו משתמש בעוגיות (cookies) למעקב או לפרסום, ואינו כולל כלי ניתוח תנועה של צד שלישי.</li>
<li>כל הגופנים והקבצים נטענים מהשרת של האתר עצמו, ללא פנייה לשירותים חיצוניים.</li>
<li>שרת האחסון עשוי לתעד נתונים טכניים (כגון כתובת IP וסוג דפדפן) לצורכי תפעול ואבטחה, בהתאם למדיניות ספק האחסון.</li>
</ul>

<h2>העדפות נגישות</h2>
<p>אם תשתמשו בתפריט הנגישות, ההעדפות שלכם (למשל גודל טקסט) יישמרו באחסון המקומי של הדפדפן במכשיר שלכם בלבד. הן אינן נשלחות אלינו ואינן מועברות לאף גורם.</p>

<h2>טופס יצירת הקשר</h2>
<p>הטופס באתר, בפס האדום שבסוף עמוד הבית, אינו שולח מידע לשרת. הוא מרכיב הודעה ופותח וואטסאפ{mail_priv}, במכשיר שלכם. לפני השליחה יש לסמן שקראתם והסכמתם למדיניות הזו. ההודעה נשלחת רק אם תלחצו שם על "שליחה". בדפדפן שלא מפעיל סקריפטים מוצג במקומם כרטיס פשוט עם תיבת הודעה אחת, והדפדפן עצמו פותח וואטסאפ עם הטקסט שבתיבה כשלוחצים על "שליחה בוואטסאפ". אם תבחרו להעתיק את ההודעה, ההעתקה נעשית במכשיר שלכם בלבד. השימוש בוואטסאפ ובשירות הדואר שלכם כפוף לתנאים ולמדיניות הפרטיות של מפעיליהם.</p>

<h2>פנייה אלינו בטלפון או בוואטסאפ</h2>
<p>אם תפנו אלינו בטלפון או בוואטסאפ, הפרטים שתמסרו (למשל שם, גיל ומספר טלפון) ישמשו לצורך מענה לפנייה ולהרשמה בלבד. פרטים של קטינים נמסרים על ידי הוריהם או האפוטרופוסים שלהם. לא נשלח אליכם הודעות פרסומיות ללא הסכמה מפורשת שלכם.</p>

<h2>אבטחה</h2>
<p>האתר סטטי: אין בו מסד נתונים, אין שרת שמעבד מידע ואין סקריפטים של צד שלישי. מדיניות אבטחה בדפדפן מונעת טעינת תכנים ממקורות חיצוניים.</p>

<h2>קישורים לאתרים אחרים</h2>
<p>האתר מקשר לשירותים ולאתרים חיצוניים, כמו Waze, Google Maps, וואטסאפ ואיגודי הג'ודו. לאתרים אלה יש מדיניות פרטיות משלהם, ואנחנו לא אחראים להם.</p>

<h2>הזכויות שלכם</h2>
<p>אתם זכאים לעיין במידע שנמסר לנו עליכם, לבקש לתקן אותו או למחוק אותו. לכל בקשה, פנו אלינו:</p>
<div class="box">
<p>{contact_block()}</p>
</div>

<h2>שינויים במדיניות</h2>
<p>ייתכן שנעדכן את המדיניות מעת לעת. הנוסח העדכני יופיע בעמוד הזה, עם תאריך העדכון האחרון.</p>
"""

page(
    "privacy.html",
    "מדיניות פרטיות | ג'ודוקאן אילת",
    "מדיניות הפרטיות של אתר ג'ודוקאן אילת: האתר לא אוסף מידע אישי ולא משתמש בעוגיות מעקב.",
    legal("מדיניות פרטיות", f"עודכנה לאחרונה: {UPDATED}", PRIVACY_BODY),
    og=False,
)

TERMS_BODY = f"""
<p>ברוכים הבאים לאתר של {CLUB}. השימוש באתר מהווה הסכמה לתנאים האלה. אם אינכם מסכימים להם, אנא הימנעו משימוש באתר.</p>

<h2>מטרת האתר</h2>
<p>האתר נועד למסור מידע כללי על המועדון, החוגים, שעות הפעילות ודרכי ההרשמה. המידע באתר אינו מהווה הצעה מחייבת או הבטחה.</p>

<h2>דיוק המידע</h2>
<p>אנחנו משתדלים שהמידע באתר יהיה מדויק ועדכני, אך שעות הפעילות, הקבוצות והעלויות עשויים להשתנות. לפרטים מעודכנים, התקשרו אל {tel("tel")}. במקרה של סתירה בין האתר למידע שמסר המועדון, המידע שמסר המועדון קובע.</p>

<h2>קניין רוחני</h2>
<p>התכנים, העיצוב והמיתוג באתר שייכים ל{CLUB} או לבעלי הזכויות בהם. אין להעתיק, להפיץ או לעשות בהם שימוש מסחרי ללא אישור מראש ובכתב. הגופנים באתר מופצים ברישיון SIL Open Font License, וחלק מהסמלים מבוססים על ספריית Feather ברישיון MIT. הנוסחים המלאים של הרישיונות נמצאים בתיקיית assets של האתר.</p>

<h2>קישורים לאתרים אחרים</h2>
<p>האתר כולל קישורים לאתרים וליישומים חיצוניים (כמו וואטסאפ, Waze, Google Maps ואיגודי הג'ודו) לנוחותכם. אנחנו לא אחראים לתוכן שלהם, לזמינותם או למדיניות הפרטיות שלהם.</p>

<h2>הגבלת אחריות</h2>
<p>השימוש באתר הוא על אחריות המשתמש. במידה המותרת בדין, {CLUB} לא יישא באחריות לנזק שנגרם משימוש באתר או מהסתמכות על המידע שבו. ההשתתפות באימונים כפופה להנחיות המאמן ולהצהרות שהמועדון מבקש.</p>

<h2>דין חל וסמכות שיפוט</h2>
<p>על התנאים האלה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית תהיה לבתי המשפט המוסמכים במחוז הדרום.</p>

<h2>לשון הכתיבה</h2>
<p>האתר מנוסח בלשון רבים וניטרלית ככל האפשר, והוא פונה לכל המינים.</p>

<h2>יצירת קשר</h2>
<div class="box">
<p>{contact_block()}</p>
</div>
"""

page(
    "terms.html",
    "תנאי שימוש | ג'ודוקאן אילת",
    "תנאי השימוש באתר ג'ודוקאן אילת.",
    legal("תנאי שימוש", f"עודכנו לאחרונה: {UPDATED}", TERMS_BODY),
    og=False,
)

# a page that is no longer generated must not linger in the output folder
for stale in sorted(f for f in os.listdir(DOCS) if f.endswith(".html") and f not in BUILT):
    os.remove(os.path.join(DOCS, stale))
    print("removed a page that is no longer generated:", stale)
print("built:", sorted(BUILT))

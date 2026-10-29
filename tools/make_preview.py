# -*- coding: utf-8 -*-
"""Builds one self-contained HTML file from docs/ for previewing the site where only a single file can be shown (a chat, an app viewer).

    python3 tools/make_preview.py        # writes build/preview/ (ignored by git); JK_PREVIEW_OUT overrides the folder

Fonts, CSS, JS and images are inlined. The three legal pages are embedded as "views" in the same file (the contact details and the form are in the red band of the home page).

Navigation does not depend on JavaScript, because some viewers block scripts:
every link to another page becomes a fragment link (#view-privacy ...) and CSS (:target) shows that view.
When scripts do run, a small router shows the view by class instead (and closes the phone menu).
When scripts do not run, a banner says so and tells how to see the full site.
The finished page is wrapped once more: a plain page whose only content is an <iframe srcdoc> holding the site. Inside a srcdoc
document a fragment link such as #about is resolved against the PARENT's address and would load the parent page into the frame;
the site therefore carries <base href="about:srcdoc">, which is only right when it really is a srcdoc, i.e. always inside the wrapper.
That makes the file behave the same however a viewer embeds it (by address or by srcdoc, with or without scripts) and when it is opened in a browser.
Two files are written: the site itself (used by the tests) and the wrapped file (the one to send).
The Content-Security-Policy meta is dropped here only: the bundle needs inline script and style."""
import re, base64, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DOCS = str(ROOT / "docs")
OUT_DIR = os.environ.get("JK_PREVIEW_OUT") or str(ROOT / "build" / "preview")
OUT_INNER = OUT_DIR + "/judokan-eilat-inner.html"      # the site itself (what the tests open)
OUT = OUT_DIR + "/judokan-eilat-site.html"             # wrapped: this is the file to send

def read(p): return open(os.path.join(DOCS, p), encoding="utf-8").read()
def b64(p): return base64.b64encode(open(os.path.join(DOCS, p), "rb").read()).decode()

css = read("assets/css/style.css")
css = re.sub(r'url\("(\.\./fonts/[^"]+\.woff2)"\)',
             lambda m: 'url("data:font/woff2;base64,' + b64(os.path.normpath(os.path.join("assets/css", m.group(1)))) + '")', css)
js = read("assets/js/main.js")
# the accessibility panel is built by the script and links to the statement page: in the bundle the statement is a view of the same file
PANEL_LINK = "{ href: 'accessibility.html' }"
assert js.count(PANEL_LINK) == 1, "the statement link in the accessibility panel (main.js) changed: update the preview"
js = js.replace(PANEL_LINK, "{ href: '#view-accessibility' }")

PREVIEW_CSS = """
/* ---- preview only: pages as views, shown by :target without scripts, or by .shown with scripts ---- */
.view{display:none}
.view:target,.view.shown{display:block}
.view:target~#main,.view.shown~#main{display:none}
.view:has(:target){display:block}
.view:has(:target)~#main{display:none}
.view{scroll-margin-top:0}
.preview-banner{display:none}
html:not(.js) .preview-banner{display:block;padding:.85rem 1rem;background:#FFF3C4;color:#141414;border-bottom:2px solid #141414;font:700 1rem/1.6 Heebo,sans-serif;text-align:center}
"""

BANNER = ('<div class="preview-banner" role="note">התצוגה הזו רצה בלי JavaScript, ולכן התפריט הנפתח, בדיקת השדות בטופס והחלקה בין כרטיסים לא פועלים כאן, והטופס מוצג בגרסה פשוטה. '
          'כדי לראות את האתר במלואו, הורידו את הקובץ ופתחו אותו בדפדפן (Chrome או Safari).</div>\n')

def split(html):
    return re.search(r"<head>(.*?)</head>", html, re.S).group(1), re.search(r"<body>(.*)</body>", html, re.S).group(1)

head, body = split(read("index.html"))
head = re.sub(r'<link rel="stylesheet" href="assets/css/style.css">', lambda m: "<style>" + css + PREVIEW_CSS + "</style>", head)
head = re.sub(r'<link rel="(preload|icon|apple-touch-icon)"[^>]*>', "", head)
head = re.sub(r'<meta property="og:image[^"]*"[^>]*>', "", head)
head = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', "", head)
head += '<link rel="icon" href="data:image/png;base64,' + b64("assets/img/favicon-32.png") + '">'
body = body.replace('<script src="assets/js/main.js" defer></script>', "")

# the other pages become views placed BEFORE the home page's <main>, so that CSS (~) can hide the home page when one is shown
views = ""
for name in ("accessibility", "privacy", "terms"):
    _, b = split(read(name + ".html"))
    m = re.search(r'<main id="main" tabindex="-1">(.*?)</main>', b, re.S)
    views += f'<main id="view-{name}" class="view" tabindex="-1">{m.group(1)}</main>\n'
HOME_MAIN = '<main id="main" tabindex="-1">'
assert body.count(HOME_MAIN) == 1
body = body.replace(HOME_MAIN, views + HOME_MAIN, 1)

# links to other pages become fragment links to the views
body = re.sub(r'href="(accessibility|privacy|terms)\.html"', lambda m: f'href="#view-{m.group(1)}"', body)
body = re.sub(r'href="index\.html#([^"]+)"', r'href="#\1"', body)
body = body.replace('href="index.html"', 'href="#top"')
assert not re.search(r'href="(accessibility|privacy|terms|index)\.html', body), "a link to a page was left"

# the logo images are inlined as data URIs (the bundle has to be one file)
MIME = {".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}
def inline_img(m):
    path = m.group(2)
    return m.group(1) + 'data:' + MIME[os.path.splitext(path)[1]] + ';base64,' + b64(path) + '"'
body = re.sub(r'((?:src|srcset)=")(assets/img/[^"]+)"', inline_img, body)
assert 'assets/img/' not in body, "an image was left un-inlined"

body = BANNER + body

router = """(function(){
var views=[].slice.call(document.querySelectorAll('.view'));
var side=document.getElementById('side'),menuBtn=document.querySelector('button.menu-btn');
/* on a phone the open menu covers the screen: close it whenever a page is chosen */
function closeMenu(){if(side&&menuBtn&&side.classList.contains('open'))menuBtn.click();}
/* the accessibility panel floats over the page: close it when its statement link opens a view */
function closePanel(){var p=document.getElementById('a11y-panel'),c=document.querySelector('.a11y-close');if(p&&!p.hidden&&c)c.click();}
function show(view){closeMenu();closePanel();views.forEach(function(v){v.classList.toggle('shown',v===view);});}
document.addEventListener('click',function(e){
var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;
var id=(a.getAttribute('href')||'').slice(1);if(!id)return;
var t=document.getElementById(id);if(!t)return;
if(t.classList.contains('view')){e.preventDefault();e.stopImmediatePropagation();show(t);window.scrollTo(0,0);return;}
if(!(t.closest&&t.closest('.view')))show(null);
},true);})();"""

def page(extra_head=""):
    return ('<!doctype html>\n<html lang="he" dir="rtl">\n<head>' + extra_head + head + "</head>\n<body>" + body +
            "<script>" + router + "</script>\n<script>" + js + "</script>\n</body>\n</html>\n")

os.makedirs(OUT_DIR, exist_ok=True)
inner_plain = page()
open(OUT_INNER, "w", encoding="utf-8").write(inner_plain)

# the copy that goes in the wrapper: base about:srcdoc FIRST in the head (it must precede every URL that uses it)
inner_wrapped = page('<base href="about:srcdoc">')
def attr(v): return v.replace("&", "&amp;").replace('"', "&quot;")
wrapper = ('<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>ג\'ודוקאן אילת</title>\n'
           '<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100vh;height:100dvh}</style>\n</head>\n'
           '<body>\n<iframe title="ג\'ודוקאן אילת" srcdoc="' + attr(inner_wrapped) + '"></iframe>\n</body>\n</html>\n')
open(OUT, "w", encoding="utf-8").write(wrapper)
print("site written:", os.path.relpath(OUT_INNER, ROOT), round(len(inner_plain.encode("utf-8")) / 1024), "KB")
print("wrapped file written:", os.path.relpath(OUT, ROOT), round(len(wrapper.encode("utf-8")) / 1024), "KB")

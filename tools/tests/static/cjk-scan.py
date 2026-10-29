# Every Japanese character used by the site (pages, script, stylesheet escapes) must exist in the small self-hosted subset font,
# otherwise the browser would silently draw it with a system font (or a box).
# Needs fontTools with Brotli to read the woff2 file:  pip install -r tools/tests/requirements.txt
# Exit codes: 0 all characters present, 1 characters missing, 77 skipped (fontTools or Brotli not installed).
import glob, os, re, sys

root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
try:
    from fontTools.ttLib import TTFont
    import brotli  # noqa: F401  (fontTools needs it for woff2)
except ImportError as e:
    print('SKIPPED: %s. Install the checker packages with: pip install -r tools/tests/requirements.txt' % e)
    sys.exit(77)


def is_cjk(o):
    return 0x3040 <= o <= 0x30FF or 0x3400 <= o <= 0x9FFF or 0x3000 <= o <= 0x303F or 0xFF00 <= o <= 0xFFEF


chars = set()
sources = glob.glob(root + '/docs/*.html') + [root + '/docs/assets/js/main.js', root + '/docs/assets/css/style.css']
for p in sources:
    with open(p, encoding='utf-8') as f:
        chars.update(ch for ch in f.read() if is_cjk(ord(ch)))
with open(root + '/docs/assets/css/style.css', encoding='utf-8') as f:
    css = f.read()
for m in re.finditer(r'\\([0-9a-fA-F]{4,5})', css):   # characters written as CSS escapes
    o = int(m.group(1), 16)
    if is_cjk(o):
        chars.add(chr(o))

cmap = TTFont(root + '/docs/assets/fonts/shippori-mincho-800-subset.woff2').getBestCmap()
missing = sorted(c for c in chars if ord(c) not in cmap)
print('used CJK characters:', len(chars), ''.join(sorted(chars)))
print('glyphs in the font :', len(cmap))
print('MISSING from font  :', missing)
sys.exit(1 if missing else 0)

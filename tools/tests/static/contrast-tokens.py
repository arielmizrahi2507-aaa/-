# The colour tokens in docs/assets/css/style.css (:root) must keep the contrast the design relies on (WCAG 1.4.3, 1.4.11).
# axe checks what is actually rendered; this guards the palette itself, so a changed token fails here in a fraction of a second.
# Minimums: 4.5 for normal text, 3.0 for large text (the white-on-brand-red pairs) and for the borders of controls.
import os, re, sys

root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
css = open(os.path.join(root, 'docs', 'assets', 'css', 'style.css'), encoding='utf-8').read()
block = re.search(r':root\{(.*?)\}', css, re.S).group(1)
tok = {m.group(1): m.group(2) for m in re.finditer(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})', block)}
tok['white'] = '#FFFFFF'


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


# (foreground, background, minimum, where it is used)
PAIRS = [
    ('accent-ink', 'white', 4.5, 'red links and small red text on white'),
    ('accent-ink', 'paper', 4.5, 'red links and small red text on the light panels'),
    ('accent-deep', 'white', 4.5, 'hover colour of links'),
    ('white', 'accent-ink', 4.5, 'white text on the dark red (hover states)'),
    ('ink', 'white', 4.5, 'body text'),
    ('ink', 'paper', 4.5, 'body text on light panels'),
    ('ink-2', 'white', 4.5, 'secondary text'),
    ('ink-2', 'paper', 4.5, 'secondary text on light panels'),
    ('ink-3', 'white', 4.5, 'tertiary text'),
    ('ink-3', 'paper', 4.5, 'tertiary text on light panels'),
    ('ink', 'accent', 4.5, 'small dark text on the brand red (the labels of the contact details in the red band)'),
    ('white', 'accent', 3.0, 'white on the brand red is for large or bold text only (the red band, buttons, the menu button)'),
    ('accent-soft', 'night', 4.5, 'red text on the dark sidebar and bands'),
    ('accent-soft', 'night-2', 4.5, 'red text on the dark panels'),
    ('accent-soft', 'night-3', 4.5, 'red text on the dark panels'),
    ('on-night', 'night', 4.5, 'text on dark'),
    ('on-night-2', 'night', 4.5, 'text on dark'),
    ('on-night-3', 'night', 4.5, 'quiet text on dark'),
    ('on-night-3', 'night-2', 4.5, 'quiet text on dark panels'),
    ('on-night-3', 'night-3', 4.5, 'quiet text on dark panels'),
    ('on-night-3', 'night-4', 4.5, 'quiet text on the lightest dark panel'),
    ('white', 'night', 4.5, 'white on dark'),
    ('field', 'white', 3.0, 'border of form fields (non-text contrast)'),
    ('field', 'paper', 3.0, 'border of form fields on light panels'),
]
bad = 0
for fg, bg, minimum, use in PAIRS:
    missing = [n for n in (fg, bg) if n not in tok]
    if missing:
        bad += 1
        print(f'  FAIL: token --{missing[0]} is not defined in :root ({fg} on {bg})')
        continue
    r = ratio(tok[fg], tok[bg])
    ok = r >= minimum
    if not ok:
        bad += 1
    print(f'  {"ok  " if ok else "FAIL"} {r:5.2f}:1 (min {minimum})  {fg} {tok[fg]} on {bg} {tok[bg]}  [{use}]')
print(f'{len(PAIRS)} colour pairs checked, {bad} problems')
sys.exit(1 if bad else 0)

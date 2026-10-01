# write the fitted numbers into 30-looks.js: python3 apply_fit.py fit.json ../../src/js/30-looks.js
# The structure numbers are on the first line of every entry; hair, beard, glasses ... are never touched. The hand-drawn hair outlines are scaled with the width of the head.
import json, re, sys

fit = json.load(open(sys.argv[1])); path = sys.argv[2]
SKIP = {'bengvir': {'fw', 'cheek', 'jaw', 'jawSq', 'chin', 'len', 'eyeGap'}}       # the head is turned or looks down in the photo: these stay hand-made
t = open(path, encoding='utf8').read()

def fweff(v):                      # the width of the head as the portrait uses it (gain 1.25, clamped)
    v = 1.0 if v is None else v
    return max(0.8, min(1.36, max(0.5, min(1.9, 1 + (v - 1) * 1.25))))
def num(x):
    s = ('%.2f' % x).rstrip('0').rstrip('.'); return s if s not in ('-0', '') else '0'
def scale_pts(body, key, r):
    m = re.search(key + r': (\[\[.*?\]\])', body)
    if not m: return body
    arr = json.loads(m.group(1))
    return body[:m.start(1)] + json.dumps([[round(a * r, 2), b] for a, b in arr]) + body[m.end(1):]

for id, o in fit.items():
    m = re.search(r"\n  %s: \{\n(.*?)\n  \}," % id, t, re.S)
    if not m: continue
    lines = m.group(1).split('\n'); first = lines[0]
    mm = re.search(r'\bfw: ([-0-9.]+)', first); old_fw = float(mm.group(1)) if mm else None
    skip = SKIP.get(id, set())
    for k, v in o['p'].items():
        if k in skip: continue
        if k in ('jawSq', 'browY', 'mouthDy') and abs(v) < 1e-9 and not re.search(r'\b%s: ' % k, first): continue
        if re.search(r'\b%s: [-0-9.]+' % k, first): first = re.sub(r'\b%s: [-0-9.]+' % k, '%s: %s' % (k, num(v)), first, count=1)
        else: first = first.rstrip().rstrip(',') + ', %s: %s,' % (k, num(v))
    lines[0] = first; body = '\n'.join(lines)
    r = fweff(o['p']['fw'] if 'fw' not in skip else old_fw) / fweff(old_fw)
    if abs(r - 1) > 1e-3:
        for key in ('dome', 'line', 'lineL'): body = scale_pts(body, key, r)
    t = t[:m.start()] + "\n  %s: {\n%s\n  }," % (id, body) + t[m.end():]
open(path, 'w', encoding='utf8').write(t)
print('applied', len(fit), 'fighters')

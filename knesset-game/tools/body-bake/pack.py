# Packs the PNG parts written by bake-parts.mjs into WebP for the game: python3 pack.py <baked dir> <assets dir (src/assets/parts)>
import sys, os, json, glob
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
Q = int(os.environ.get('WQ', '88'))
total = 0
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    im = Image.open(f).convert('RGBA')
    out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp')
    im.save(out, 'WEBP', quality=Q, method=6, alpha_quality=96)
    total += os.path.getsize(out)
meta = json.load(open(os.path.join(src, 'meta.json')))
json.dump(meta, open(os.path.join(dst, 'meta.json'), 'w'), separators=(',', ':'))
print('packed %d parts, %.0f KB' % (len(glob.glob(os.path.join(src, '*.png'))), total / 1024))

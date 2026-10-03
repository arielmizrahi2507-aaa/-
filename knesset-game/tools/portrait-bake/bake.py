# bake the game portraits: python3 bake.py OUTDIR [id1,id2,...]
# every fighter gets the faces the game asks for: base (open eyes, smile), angry+shout, angry+grin (big) and hurt+shout, hurt+sad, ko+sad (small, for the HUD)
import sys, os, json, time, numpy as np, cv2
from multiprocessing import Pool
from PIL import Image
import compose as C

VARIANTS = [
    ('base', 'open', 'smile', 512),
    ('angry_shout', 'angry', 'shout', 512),
    ('angry_grin', 'angry', 'grin', 512),
    ('hurt_shout', 'hurt', 'shout', 160),
    ('hurt_sad', 'hurt', 'sad', 160),
    ('ko_sad', 'ko', 'sad', 160),
]
QUALITY = int(os.environ.get('WQ', '82'))

def one(args):
    id, outdir = args
    t0 = time.time(); sizes = {}
    for (name, eyes, mouth, size) in VARIANTS:
        P, A, h = C.render_portrait(id, 1.0, eyes=eyes, mouth=mouth, verbose=False)
        img, a = C.to_srgb_rgba(P, A)
        c, a2 = C.crop_final(img, a, 512)
        c = C.photo_finish(c.astype(np.float32), a2.astype(np.float32), seed=sum(map(ord, id)))
        if size != 512:
            cp = cv2.resize(c * a2[:, :, None], (size, size), interpolation=cv2.INTER_AREA); a2 = cv2.resize(a2, (size, size), interpolation=cv2.INTER_AREA)
            c = np.where(a2[:, :, None] > 1e-3, cp / np.maximum(a2[:, :, None], 1e-3), 0)
        rgba = np.dstack([np.clip(c, 0, 1), np.clip(a2, 0, 1)])
        im = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
        path = os.path.join(outdir, '%s.%s.webp' % (id, name))
        im.save(path, 'WEBP', quality=QUALITY if size >= 512 else max(QUALITY - 4, 70), method=6, alpha_quality=92)
        sizes[name] = os.path.getsize(path)
    print(id, 'baked in %.0fs' % (time.time() - t0), {k: round(v / 1024, 1) for k, v in sizes.items()}, flush=True)
    return id, sizes

if __name__ == '__main__':
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True)
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else list(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hp.json'))).keys())
    with Pool(4) as p: res = p.map(one, [(i, outdir) for i in ids], chunksize=1)
    tot = sum(sum(s.values()) for _, s in res)
    print('total %.0f KB for %d fighters' % (tot / 1024, len(ids)))

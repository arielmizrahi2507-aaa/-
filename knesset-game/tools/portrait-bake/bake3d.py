# bake the 3D face textures + the layout numbers: python3 bake3d.py OUTDIR [id1,id2,...]
import sys, os, json, time, numpy as np
from multiprocessing import Pool
from PIL import Image
import facetex as FT

STATES = [('t_rest', 'open', 'closed'), ('t_blink', 'blink', 'closed'), ('t_angry', 'angry', 'closed'), ('t_shout', 'angry', 'shout'),
          ('t_hurt', 'hurt', 'shout'), ('t_ko', 'ko', 'sad'), ('t_happy', 'happy', 'grin')]
QUALITY = int(os.environ.get('WQ3', '78'))

def one(args):
    id, outdir = args
    t0 = time.time(); lay = None; sizes = {}
    for name, e, m in STATES:
        tex, h = FT.face_tex(id, e, m)
        lay = FT.layout(h)
        if name == 't_rest':
            rl = FT.relief_tex(h)
            p = os.path.join(outdir, '%s.t_relief.webp' % id); Image.fromarray(rl, 'L').save(p, 'WEBP', quality=92, method=6); sizes['t_relief'] = os.path.getsize(p)
        im = Image.fromarray((np.clip(tex, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
        p = os.path.join(outdir, '%s.%s.webp' % (id, name)); im.save(p, 'WEBP', quality=QUALITY, method=6)
        sizes[name] = os.path.getsize(p)
    print(id, 'face textures in %.0fs' % (time.time() - t0), {k: round(v / 1024, 1) for k, v in sizes.items()}, flush=True)
    return id, lay, sum(sizes.values())

if __name__ == '__main__':
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True)
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else list(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hp.json'))).keys())
    with Pool(4) as p: res = p.map(one, [(i, outdir) for i in ids], chunksize=1)
    path = os.path.join(outdir, 'layout.json'); old = json.load(open(path)) if os.path.exists(path) else {}
    old.update({i: {k: ([round(x, 4) for x in v] if isinstance(v, list) else round(v, 4)) for k, v in lay.items()} for i, lay, _ in res})
    json.dump(old, open(path, 'w'), indent=0, sort_keys=True)
    print('total %.0f KB' % (sum(t for _, _, t in res) / 1024))

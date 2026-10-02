# recompute only the layout numbers (no textures): python3 layout_only.py OUTDIR [ids]
import sys, os, json
import facetex as FT
from rend2 import Head
outdir = sys.argv[1]
ids = sys.argv[2].split(',') if len(sys.argv) > 2 else list(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hp.json'))).keys())
path = os.path.join(outdir, 'layout.json'); old = json.load(open(path)) if os.path.exists(path) else {}
for i in ids:
    lay = FT.layout(Head(i))
    old[i] = {k: ([round(x, 4) for x in v] if isinstance(v, list) else round(v, 4)) for k, v in lay.items()}
json.dump(old, open(path, 'w'), indent=0, sort_keys=True)
print('layout for', len(ids), 'faces')

# Packs the baked layers of a stage into the game's assets: src/assets/stages/<id>.<layer>.webp + <id>.json (the layout of the layers).
import os, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'src', 'assets', 'stages'))

def pack_stage(stage, layers, mod, work, out_dir=None, quality=None):
    """layers: list of dict(name, f, scale, img float RGBA straight, floor, width) from FAR to NEAR (the order in which the game draws them)"""
    from stagelib import W, H, GROUND_Y, K, horizon_row
    out_dir = out_dir or OUT; os.makedirs(out_dir, exist_ok=True)
    quality = quality or getattr(mod, 'QUALITY', {})
    meta = {'id': stage, 'h_cam': mod.H_CAM, 'yh': round(horizon_row(mod.H_CAM), 2), 'layers': []}
    total = 0
    for old in os.listdir(out_dir):
        if old.startswith(stage + '.') : os.remove(os.path.join(out_dir, old))
    for Ly in layers:
        img = np.clip(Ly['img'], 0, 1)
        rgba = (img * 255 + 0.5).astype(np.uint8)
        opaque = bool(rgba[..., 3].min() >= 254)
        pim = Image.fromarray(rgba if not opaque else rgba[..., :3], 'RGBA' if not opaque else 'RGB')
        q = quality.get(Ly['name'], 82)
        path = os.path.join(out_dir, '%s.%s.webp' % (stage, Ly['name']))
        pim.save(path, 'WEBP', quality=int(q), method=6, alpha_quality=int(min(100, q + 8)))
        size = os.path.getsize(path); total += size
        lw = (Ly['width'] if Ly.get('floor') else (W + (1600 - W) * Ly['f']))
        meta['layers'].append({'name': Ly['name'], 'kind': 'floor' if Ly.get('floor') else 'wall', 'f': round(float(Ly['f']), 4), 'w': round(float(lw), 2), 'h': H,
                               'pw': int(rgba.shape[1]), 'ph': int(rgba.shape[0]), 'alpha': not opaque})
        print('  %-8s %5dx%-4d q%d %s  %6.0f KB' % (Ly['name'], rgba.shape[1], rgba.shape[0], q, 'RGBA' if not opaque else 'RGB ', size / 1024))
    with open(os.path.join(out_dir, stage + '.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print('packed %s: %d layers, %.0f KB' % (stage, len(layers), total / 1024))
    return meta

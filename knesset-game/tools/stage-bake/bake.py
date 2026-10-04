#!/usr/bin/env python3
# Bakes the realistic backdrops of the arenas: python3 bake.py <stage> [options]
#   --quick            a fast single picture of the whole scene at the neutral camera (to judge the composition and the light)
#   --raw              render the parallax layers (the slow part; the result is cached as npz)
#   --post             denoise + grade + write the layers and previews from the cached renders
#   --pack             write the final WebP layers (and the meta json) into the game's assets folder
# The work folder (renders, previews) is outside the repository: --work DIR (default /tmp/stagebuild).
import os, sys, json, time, argparse, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'scenes'))
import numpy as np, cv2
from stagelib import *

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('stage')
    ap.add_argument('--quick', action='store_true'); ap.add_argument('--raw', action='store_true'); ap.add_argument('--post', action='store_true'); ap.add_argument('--pack', action='store_true')
    ap.add_argument('--layers', default=''); ap.add_argument('--scale-mul', type=float, default=1.0); ap.add_argument('--spp-mul', type=float, default=1.0)
    ap.add_argument('--work', default='/tmp/stagebuild'); ap.add_argument('--q', nargs='*', default=[]); ap.add_argument('--tag', default='')
    ap.add_argument('--cx', default='480,800,1120'); ap.add_argument('--no-denoise', action='store_true')
    ap.add_argument('--exposure', type=float, default=None); ap.add_argument('--pass-spp', type=int, default=None); ap.add_argument('--render-layers', default='', help='render only these layers (the others stay as they were); --post still uses all'); ap.add_argument('--live', action='store_true', help='build the scene (no rendering) so that the positions of the animated parts are known when packing')
    a = ap.parse_args()
    mod = importlib.import_module(a.stage)
    q = {}
    for kv in a.q:
        k, v = kv.split('='); q[k] = (int(v) if v.lstrip('-').isdigit() else float(v)) if v.replace('.', '', 1).replace('-', '', 1).isdigit() else v
    work = os.path.join(a.work, a.stage + (('_' + a.tag) if a.tag else '')); os.makedirs(work, exist_ok=True)
    only = [s for s in a.layers.split(',') if s] or None
    tone = dict(mod.TONE)
    if a.exposure is not None: tone['exposure'] = a.exposure
    if a.live and not (a.quick or a.raw):
        b = SceneBuilder(a.stage); q.setdefault('work', work); mod.build(b, q)
        if getattr(mod, 'LIVE', None): json.dump(mod.LIVE, open(os.path.join(work, 'live.json'), 'w'))
        b.cleanup(); print('live positions written'); return
    if a.quick or a.raw:
        t0 = time.time()
        b = SceneBuilder(a.stage)
        q.setdefault('work', work)
        mod.build(b, q)
        if getattr(mod, 'LIVE', None): json.dump(mod.LIVE, open(os.path.join(work, 'live.json'), 'w'))
        print('scene built: %d triangles, %.1fs' % (b.stats['tris'], time.time() - t0), flush=True)
        if a.quick:
            sc = 0.5 * a.scale_mul
            L = render_layer(b, -3.3, 1e9, 1.0, scale=sc, h_cam=mod.H_CAM, aperture=mod.APERTURE, spp=int(32 * a.spp_mul), pass_spp=8, bg=True)
            img = finish_layer(L, denoise_it=not a.no_denoise, **tone)
            lay = [{'img': img, 'f': 1.0, 'scale': sc}]
            out = [composite(lay, cx) for cx in [float(c) for c in a.cx.split(',')]]
            save_png(os.path.join(work, 'quick.png'), np.hstack(out) if len(out) > 1 else out[0])
            print('quick preview written %s (%.1fs)' % (os.path.join(work, 'quick.png'), time.time() - t0))
        if a.raw:
            render_stage_raw(b, mod.SLABS, os.path.join(work, 'raw'), h_cam=mod.H_CAM, aperture=mod.APERTURE, only=([s for s in a.render_layers.split(',') if s] or only), spp_mul=a.spp_mul, scale_mul=a.scale_mul, pass_spp=a.pass_spp)
        b.cleanup()
    if (a.post or a.pack) and not getattr(mod, 'LIVE', None) and os.path.exists(os.path.join(work, 'live.json')):
        mod.LIVE = json.load(open(os.path.join(work, 'live.json')))
    if a.post or a.pack:
        layers = post_stage(os.path.join(work, 'raw'), mod.SLABS, tone, denoise_it=not a.no_denoise, only=only)
        if hasattr(mod, 'shaft_spec') and not only:                       # light shafts: an additive layer (single scattering in numpy), stored as an opaque picture
            import volume
            sp = mod.shaft_spec(); f_ = sp['f']; sc_ = sp.get('scale', 0.6)
            rgbv = volume.shafts(sp['sun'], sp['plane_z'], sp['windows'], sp['bars'], f_, h_cam=mod.H_CAM, scale=sc_, steps=sp.get('steps', 64), sigma=1.0, g=sp.get('g', 0.55),
                                 color=sp.get('color', (1.0, 0.78, 0.5)), gain=sp.get('gain', 0.45), z_min=sp.get('z_min', 0.5))
            disp = volume.to_display(rgbv)
            layers.append({'name': 'shafts', 'f': f_, 'scale': sc_, 'img': np.dstack([disp, np.ones(disp.shape[:2], np.float32)]).astype(np.float32), 'floor': False, 'width': 0, 'order': 99, 'blend': 'add'})
        cxs = [float(c) for c in a.cx.split(',')]
        out = [composite(layers, cx) for cx in cxs]
        save_png(os.path.join(work, 'preview.png'), np.hstack(out) if len(out) > 1 else out[0])
        for Ly in layers:
            save_png(os.path.join(work, 'layer_%s.png' % Ly['name']), Ly['img'][..., :3] * Ly['img'][..., 3:4])
        print('preview written', os.path.join(work, 'preview.png'))
        if a.pack:
            from pack import pack_stage
            pack_stage(a.stage, layers, mod, work)

if __name__ == '__main__':
    main()

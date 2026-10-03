# ליל הבחירות: election night in a dark arena. A giant LED screen with the results, a lighting truss, coloured spotlights, balloons, a cheering crowd (a dark mass lit from behind, a few phone lights and flags), a glossy black floor.
# The light beams in the haze, the confetti and the pulsing of the screen are drawn by the game on top; LIVE says where the screen is.
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, trimesh, cv2
from stagelib import *
import solids as S, texlib

NAME = 'election'
H_CAM = 1.5
APERTURE = 0.03

ZS = 12.5                               # the screen
SX0, SX1, SY0, SY1 = -6.8, 6.8, 1.5, 6.1
CROWD_Z0, CROWD_Z1 = 5.6, 10.2

SLABS = [
    dict(name='balloons', order=4, z0=3.2, z1=5.5, f=layer_f(4.3), scale=1.25, spp=96),
    dict(name='crowd', order=3, z0=5.5, z1=11.0, f=layer_f(8.0), scale=1.25, spp=128),
    dict(name='floor', order=1, floor=True, z0=-3.3, z1=ZS - 0.1, f=1.0, width=floor_width(H_CAM), scale=1.25, spp=96, post_blur=(1.0, 0.6)),
    dict(name='refl_back', order=2, reflect=True, z0=11.0, z1=40.0, f=layer_f(12.5), scale=1.0, spp=64, zref=12.5, refl_a=0.5, refl_h=3.0, refl_blur=2.4),
    dict(name='back', order=0, z0=11.0, z1=40.0, f=layer_f(12.5), scale=1.1, spp=96, aperture=0.035),
]
QUALITY = dict(balloons=84, crowd=82, floor=82, refl_back=70, back=82)
TONE = dict(exposure=1.0, sat=1.1, contrast=1.06, bloom_strength=0.16, bloom_thresh=1.2, sharp=0.35)
LIVE = {}

def _M(b, name, tex, tile, **kw): return b.B(name, M_tex(tex, tile, **kw))

def screen_image(wm, hm, ppm):
    """the results screen: a dark blue field with a fine grid, the title, nine bars of different colours, a baseline"""
    w, h = int(wm * ppm), int(hm * ppm)
    img = np.zeros((h, w, 3), np.float32)
    yy = np.linspace(0, 1, h)[:, None, None]
    img[:] = np.array(lin('#0b1a46'), np.float32) * (1.4 - 0.7 * yy) * 2.2
    grid = ((np.arange(h)[:, None] % int(0.35 * ppm)) < 2) | ((np.arange(w)[None, :] % int(0.35 * ppm)) < 2)
    img[grid] *= 1.5
    # the title
    title = texlib.text_image('תוצאות הבחירות', int(0.78 * ppm), w, int(1.05 * ppm), color=(1, 1, 1), bg=(0, 0, 0), bold=True)
    lum = title.mean(axis=2, keepdims=True)
    th = title.shape[0]
    img[int(0.18 * ppm):int(0.18 * ppm) + th] = img[int(0.18 * ppm):int(0.18 * ppm) + th] * (1 - np.clip(lum * 1.5, 0, 1)) + np.array([4.5, 4.8, 5.4], np.float32) * np.clip(lum * 1.5, 0, 1)
    # the bars
    base = h - int(0.45 * ppm); n = 9
    cols = ['#2f6fe4', '#1fc2b0', '#ffd23d', '#e2323f', '#38c25a', '#8a5cff', '#ff8a2a', '#e24fa3', '#5ad7ff']
    heights = [0.62, 1.0, 0.72, 0.42, 0.52, 0.56, 0.37, 0.64, 0.45]
    bw = int(w * 0.075); gap = int(w * 0.03); x0 = int((w - n * bw - (n - 1) * gap) / 2)
    maxh = int(h * 0.52)
    for i in range(n):
        xa = x0 + i * (bw + gap); hh = int(maxh * heights[i]); c = np.array(lin(cols[i]), np.float32) * 3.4
        # (the bars themselves are drawn and animated by the game)
    img[base:base + max(3, int(0.05 * ppm)), int(w * 0.04):int(w * 0.96)] = np.array([3.0, 3.4, 4.2], np.float32)
    # a frame
    t = max(3, int(0.05 * ppm)); fc = np.array([1.0, 2.4, 4.8], np.float32)
    img[:t] = fc; img[-t:] = fc; img[:, :t] = fc; img[:, -t:] = fc
    return img.astype(np.float32), (x0, base, bw, gap, maxh, n)

def build(b, q):
    rng = np.random.RandomState(13)
    pp = q.get('ppm_mul', 1.0)
    # ------------------------------------------------------------------------------------------------------------------ materials
    deck = texlib.tex_stone_tiles((2.4, 2.4), int(160 * pp), (1.2, 1.2), base=('#363c56', '#58627f'), vein_col='#7a86a8', vein_amt=0.3, seed=9, polish=0.45, grout_mm=4.0, tint_var=0.1)
    m_floor = _M(b, 'floor', deck, 2.4, nstr=0.5, spec=0.9)
    m_black = b.B('black', B_principled('#08090d', 0.55, twosided=True))
    m_truss = b.B('truss', B_principled('#17191f', 0.45, metallic=0.6, twosided=True))
    m_grey = b.B('grey', B_principled('#2a2d36', 0.5, twosided=True))
    m_glow = b.B('glow', B_black())
    m_people = b.B('people', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.7, 'specular': 0.3}})
    m_balloon = b.B('balloon', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.12, 'clearcoat': 0.8, 'clearcoat_gloss': 0.96, 'specular': 0.7}})
    flag_tex = texlib.flag_israel(880, 640)
    m_flag = b.B('flag', {'type': 'twosided', 'bsdf': {'type': 'diffuse', 'reflectance': T_(flag_tex, 1.0)}})
    # ------------------------------------------------------------------------------------------------------------------ the hall
    XW, YC = 20.0, 9.0
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 40]), 0, -0.1, 2), m_floor)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 40]), 0, YC + 0.1, 2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 40]), -XW, YC / 2, 2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 40]), XW, YC / 2, 2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.4]), 0, YC / 2, ZS + 1.0), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.2]), 0, YC / 2, -14), m_black)
    # the screen
    ppm_s = int(110 * pp)
    img, bars = screen_image(SX1 - SX0, SY1 - SY0, ppm_s)
    quad = trimesh.Trimesh(np.array([[SX0, SY0, ZS], [SX1, SY0, ZS], [SX1, SY1, ZS], [SX0, SY1, ZS]], np.float32), np.array([[0, 2, 1], [0, 3, 2]]), process=False)
    em = {'type': 'area', 'radiance': {'type': 'bitmap', 'bitmap': mi.Bitmap(np.ascontiguousarray(img[::-1], np.float32)), 'raw': True, 'filter_type': 'bilinear'}}
    b.mesh(quad, m_glow, emitter=em, uv='given', uv_arr=np.array([[0, 0], [1, 0], [1, 1], [0, 1]], np.float32))
    b.mesh(S.at(trimesh.creation.box(extents=[SX1 - SX0 + 0.5, SY1 - SY0 + 0.5, 0.3]), 0, (SY0 + SY1) / 2, ZS + 0.2), m_black)
    # side towers of light
    for side in (-1, 1):
        tow = trimesh.Trimesh(np.array([[side * 8.3 - 0.5, 0.0, ZS - 0.4], [side * 8.3 + 0.5, 0.0, ZS - 0.4], [side * 8.3 + 0.5, 6.2, ZS - 0.4], [side * 8.3 - 0.5, 6.2, ZS - 0.4]], np.float32), np.array([[0, 2, 1], [0, 3, 2]]), process=False)
        cl = np.array([lin('#e24fa3'), lin('#e24fa3'), lin('#5ad7ff'), lin('#5ad7ff')], np.float32) * 3.0
        b.mesh(tow, {'type': 'diffuse', 'reflectance': lin_rgb([0, 0, 0])}, emitter={'type': 'area', 'radiance': {'type': 'mesh_attribute', 'name': 'vertex_color'}}, colors=cl, uv=None)
    # ------------------------------------------------------------------------------------------------------------------ truss, lamps, spotlights
    lamps = []
    for z_t, y_t in ((9.2, 6.2), (6.0, 6.6)):
        b.mesh(S.at(trimesh.creation.box(extents=[2 * 14, 0.14, 0.14]), 0, y_t + 0.3, z_t), m_truss)
        b.mesh(S.at(trimesh.creation.box(extents=[2 * 14, 0.14, 0.14]), 0, y_t - 0.3, z_t), m_truss)
        for xx in np.arange(-14, 14.01, 0.7):
            b.mesh(S.capsule_between((xx, y_t - 0.3, z_t), (xx + 0.35, y_t + 0.3, z_t), 0.03, 6), m_truss, uv=None)
        for xx in np.arange(-13, 13.1, 1.3):
            b.mesh(S.at(S.cylinder_y(0.14, 0.34, seg=18), xx, y_t - 0.55, z_t), m_grey)
            lamps.append(S.at(S.cylinder_y(0.1, 0.02, seg=18), xx, y_t - 0.73, z_t))
    b.mesh(S.merge(lamps), m_glow, emitter=E_area([40.0, 36.0, 28.0]), uv=None)
    spots = [((-6.0, 5.1, 9.2), (-3.0, 0.0, 0.8), [100.0, 10.0, 70.0]), ((-2.0, 5.1, 9.2), (-1.0, 0.0, 1.5), [10.0, 50.0, 100.0]),
             ((2.0, 5.1, 9.2), (1.0, 0.0, 1.5), [100.0, 56.0, 16.0]), ((6.0, 5.1, 9.2), (3.0, 0.0, 0.8), [56.0, 20.0, 100.0])]
    for (o, t, inten) in spots:
        b.shape(L_spot(o, t, inten, cutoff=21.0, beam=11.0), 'spot')
    # ------------------------------------------------------------------------------------------------------------------ the crowd
    people = []; phones = []; flags = []
    dark = [(0.03, 0.03, 0.05), (0.05, 0.045, 0.04), (0.07, 0.07, 0.09), (0.09, 0.055, 0.065), (0.045, 0.065, 0.1), (0.11, 0.11, 0.12), (0.14, 0.045, 0.045), (0.03, 0.06, 0.045)]
    rows = int((CROWD_Z1 - CROWD_Z0) / 0.78) + 1
    for r in range(rows):
        z = CROWD_Z0 + r * 0.78 + rng.uniform(-0.1, 0.1)
        n = int(24 / 0.62)
        for i in range(n):
            if rng.rand() < 0.12: continue
            x = -12 + i * 0.62 + rng.uniform(-0.18, 0.18)
            fem = rng.rand() < 0.4
            arms = 'up' if rng.rand() < 0.38 else 'down'
            hgt = (1.62 if fem else 1.76) + rng.uniform(-0.1, 0.1)
            sk = S.SKIN[rng.randint(len(S.SKIN))]; hr = S.HAIR[rng.randint(len(S.HAIR))]
            cl = dark[rng.randint(len(dark))] if rng.rand() < 0.7 else tuple(np.array(rgb(['#3a4a7a', '#7a3a3a', '#3a6a4a', '#8a8a8a', '#6a4a8a', '#a08a4a'][rng.randint(6)])) * rng.uniform(0.6, 1.0))
            p, c = S.person('stand', hgt, skin=sk, hair=hr, cloth=cl, shirt=None, tie=None, rng=rng, female=fem, hair_style=2 if fem else rng.randint(2), arms=arms, sub=1, cap=6, shoulder=0.43 if fem else 0.47)
            p = S.at(p, x, 0.0, z, ry=180 + rng.uniform(-15, 15)) if False else S.at(p, x, 0.0, z)
            c = c * 1.0
            people.append((p, c))
            if arms == 'up' and rng.rand() < 0.5:
                phones.append(S.at(trimesh.creation.box(extents=[0.045, 0.09, 0.01]), x + (0.5 if rng.rand() < 0.5 else -0.5) * 0.4, hgt + 0.55, z - 0.1))
        if r % 2 == 0 and rng.rand() < 0.9:
            for k in range(rng.randint(1, 3)):
                fx = rng.uniform(-9, 9); fh = rng.uniform(2.3, 2.9)
                flags.append((fx, z, fh))
    for g in range(0, len(people), 16):
        grp = people[g:g + 16]
        b.mesh(S.merge([p for p, _ in grp]), m_people, colors=np.vstack([c for _, c in grp]), uv=None)
    if phones: b.mesh(S.merge(phones), m_glow, emitter=E_area([3.0, 3.4, 4.2]), uv=None)
    for (fx, fz, fh) in flags:
        b.mesh(S.at(S.cylinder_y(0.012, 1.6, seg=8), fx, fh - 0.8, fz), m_grey)
        fm, fuv = S.flag_cloth(0.9, 0.66, 28, 18, wave=0.05, waves=1.6, phase=rng.uniform(0, 6), droop=0.1)
        b.mesh(S.at(fm, fx + 0.01, fh, fz - 0.02), m_flag, uv='given', uv_arr=fuv)
    # ------------------------------------------------------------------------------------------------------------------ balloons
    bal_m = []; bal_c = []
    cols = ['#e2323f', '#ffd23d', '#2f6fe4', '#38c25a', '#e24fa3', '#8a5cff', '#ff8a2a', '#5ad7ff']
    for (cx_, cz_) in ((-6.2, 4.4), (6.2, 4.5), (-9.0, 4.8), (9.0, 4.7)):
        for k in range(14):
            bx = cx_ + rng.uniform(-0.7, 0.7); by = 3.7 + rng.uniform(0, 1.9); bz = cz_ + rng.uniform(-0.4, 0.4)       # high up, out of the light of the spots
            m = S.ellipsoid((0.26, 0.31, 0.26), (bx, by, bz), sub=2)
            bal_m.append(m); bal_c.append(np.tile(np.array(rgb(cols[rng.randint(len(cols))]), np.float32), (len(m.vertices), 1)))
            st = S.sweep_circle(np.array([[bx, by - 0.3, bz], [cx_ + rng.uniform(-0.1, 0.1), 0.9, cz_], [cx_, 0.0, cz_]]), 0.004, 5)
            bal_m.append(st); bal_c.append(np.tile(np.array([0.5, 0.5, 0.5], np.float32), (len(st.vertices), 1)))
    b.mesh(S.merge(bal_m), m_balloon, colors=np.vstack(bal_c), smooth=True, uv=None)
    # ------------------------------------------------------------------------------------------------------------------ fill light from the camera side (so the crowd and the floor are not pitch black)
    b.shape(L_rect((0.0, 3.4, -8.0), (0.0, -0.25, 1.0), 14.0, 5.0, [1.0, 0.95, 1.3]), 'fill')
    # coloured washes on the crowd from the front (an audience is lit by the stage)
    b.shape(L_rect((-9.0, 5.0, -4.0), (0.35, -0.3, 1.0), 6.0, 3.0, [2.6, 0.5, 1.8]), 'wash_l')
    b.shape(L_rect((9.0, 5.0, -4.0), (-0.35, -0.3, 1.0), 6.0, 3.0, [0.5, 1.6, 2.8]), 'wash_r')
    # where the screen is, in the picture of the 'back' layer
    f_back = layer_f(12.5); lw = layer_width(f_back)
    u0, v0 = project(SX0, SY1, ZS, lw, H_CAM); u1, v1 = project(SX1, SY0, ZS, lw, H_CAM)
    LIVE.clear(); LIVE.update({'layer': 'back', 'screen': [round(u0, 1), round(v0, 1), round(u1, 1), round(v1, 1)]})
    x0, base, bw, gap, maxh, n = bars
    LIVE['bars'] = {'n': n, 'x0': round(u0 + (x0 / (img.shape[1])) * (u1 - u0), 1), 'bw': round(bw / img.shape[1] * (u1 - u0), 2), 'gap': round(gap / img.shape[1] * (u1 - u0), 2),
                    'base': round(v0 + (base / img.shape[0]) * (v1 - v0), 1), 'maxh': round(maxh / img.shape[0] * (v1 - v0), 1)}

# לשכת ראש הממשלה: the prime minister's office at sunset. Dark parquet and a big red rug, walnut walls and bookcases, tall windows onto a city, an executive desk, two flags, a chandelier.
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, trimesh
from stagelib import *
import solids as S, skylib, texlib

NAME = 'office'
H_CAM = 1.5
APERTURE = 0.03
SUN_AZ, SUN_EL = -34.0, 8.0

# the parallax layers, from NEAR to FAR: the floor and what is around the fighters, the furniture, the wall with the windows (transparent where the windows are), the sky
SLABS = [
    dict(name='mid', z0=1.0, z1=5.6, f=layer_f(3.6), scale=1.25, spp=96),
    dict(name='floor', floor=True, z0=-3.3, z1=6.6, f=1.0, width=floor_width(H_CAM), scale=1.25, spp=96),
    dict(name='wall', z0=5.6, z1=8.0, f=layer_f(6.5), scale=1.25, spp=96),
    dict(name='sky', z0=8.0, z1=1e9, f=0.08, bg=True, scale=1.0, spp=48, aperture=0.025, noycut=True, tone=dict(exposure=0.62, sat=1.2, contrast=1.05)),
]
QUALITY = dict(sky=80, wall=82, floor=82, mid=84)
TONE = dict(exposure=1.0, sat=1.0, contrast=1.0, bloom_strength=0.10, bloom_thresh=1.5, sharp=0.35)

def _M(b, name, tex, tile, **kw): return b.B(name, M_tex(tex, tile, **kw))
def _metal(b, name, col, rough=0.25): return b.B(name, B_principled(col, rough, metallic=1.0, spec=0.5, twosided=True))
def _paint(b, name, col, rough=0.6): return b.B(name, B_principled(col, rough, twosided=True))

def build(b, q):
    rng = np.random.RandomState(7)
    pp = q.get('ppm_mul', 1.0)
    # ------------------------------------------------------------------------------------------------------------------ materials
    parquet = texlib.tex_parquet((2.4, 2.4), int(200 * pp), 0.48, tone=('#38200f', '#7d4c27'), seed=3)
    m_floor = _M(b, 'floor', parquet, 2.4, nstr=2.5, spec=0.5, cc=0.55, cc_gloss=0.9)
    rug = texlib.tex_rug((9.0, 9.0), int(100 * pp), field='#6a1222', gold='#c9a24b', seed=21)
    m_rug = b.B('rug', B_principled(T_(rug[0], 1.0, wrap='clamp'), T_(rug[1], 1.0, wrap='clamp'), sheen=0.4, twosided=True))
    m_rug_side = _paint(b, 'rug_side', '#3a0c14', 0.95)
    walnut = texlib.tex_planks((2.4, 2.4), int(180 * pp), 0.30, (0.8, 1.8), tone=('#2b160a', '#6a3d1c'), seed=5, ring=7.0, joint_mm=2.2)
    m_wood = _M(b, 'wood', walnut, 2.4, nstr=1.5, spec=0.45, cc=0.25, cc_gloss=0.78)
    m_wood_v = _M(b, 'wood_v', walnut, 2.4, nstr=1.5, spec=0.45, cc=0.25, cc_gloss=0.78)                   # used with rotated UV
    plaster = texlib.tex_paint((2.0, 2.0), int(160 * pp), '#d9cdb3', var=0.04, seed=7)
    m_plaster = _M(b, 'plaster', plaster, 2.0, spec=0.3)
    m_ceiling = _paint(b, 'ceiling', '#e2d8c3', 0.9)
    leather_g = texlib.tex_leather((0.6, 0.6), int(500 * pp), color='#16301f', seed=9)
    m_inlay = _M(b, 'inlay', leather_g, 0.6, nstr=1.0, spec=0.4)
    leather_r = texlib.tex_leather((0.6, 0.6), int(500 * pp), color='#5a121c', seed=10)
    m_chair = _M(b, 'chair', leather_r, 0.6, nstr=1.2, spec=0.5, cc=0.25, cc_gloss=0.8)
    m_brass = _metal(b, 'brass', '#cfa84e', 0.22)
    m_chrome = _metal(b, 'chrome', '#c4c6ca', 0.18)
    m_dark = _paint(b, 'dark', '#101012', 0.5)
    m_green = b.B('green', B_principled('#1f5a3c', 0.18, clearcoat=0.5, twosided=True))
    m_paper = _paint(b, 'paper', '#ece7da', 0.85)
    m_screen = b.B('screen', {'type': 'diffuse', 'reflectance': lin_rgb([0.02, 0.03, 0.05])})
    m_books = b.B('books', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.6, 'specular': 0.4}})
    flag_tex = texlib.flag_israel(880, 640)
    m_flag = b.B('flag', {'type': 'twosided', 'bsdf': {'type': 'diffuse', 'reflectance': T_(flag_tex, 1.0)}})

    # ------------------------------------------------------------------------------------------------------------------ the room
    ZB, T = 6.5, 0.45           # inner face of the back wall, wall thickness
    Y_C = 5.3                   # ceiling
    X_W = 14.0
    # floor, rug, ceiling, side walls, the wall behind the camera (not seen by the camera, but it keeps the light inside)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.2, 18]), 0, -0.1, ZB - 9 + 0.0), m_floor)
    rug_t = 0.018
    qd = trimesh.Trimesh(np.array([[-4.5, rug_t, -3.8], [4.5, rug_t, -3.8], [4.5, rug_t, 5.2], [-4.5, rug_t, 5.2]], np.float32), np.array([[0, 2, 1], [0, 3, 2]]), process=False)
    b.mesh(qd, m_rug, uv='given', uv_arr=np.array([[0, 0], [1, 0], [1, 1], [0, 1]], np.float32))
    b.mesh(S.at(trimesh.creation.box(extents=[9.0, rug_t, 9.0]), 0, rug_t / 2, 0.7), m_rug_side)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.2, 18]), 0, Y_C + 0.1, ZB - 9), m_ceiling)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, Y_C, 18]), -X_W, Y_C / 2, ZB - 9), m_plaster)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, Y_C, 18]), X_W, Y_C / 2, ZB - 9), m_plaster)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, Y_C, 0.2]), 0, Y_C / 2, ZB - 18), m_plaster)
    # skirting + wainscot of walnut panels along the back wall
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 1.1, T]), 0, 0.55, ZB + T / 2), m_wood)
    for i in range(-6, 7):                                                                  # raised panels
        px = i * 2.1
        b.mesh(S.at(S.rbox((1.7, 0.7, 0.05), 0.012), px, 0.58, ZB - 0.015), m_wood)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.14, 0.06]), 0, 0.07, ZB - 0.02), m_wood)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.07, 0.1]), 0, 1.12, ZB - 0.03), m_wood)     # the rail on top of the wainscot
    # the window zone: three windows, walnut piers
    win_x = [(-3.9, -1.7), (-1.1, 1.1), (1.7, 3.9)]
    y0, y1 = 1.1, 4.35
    piers = [(-4.5, -3.9), (-1.7, -1.1), (1.1, 1.7), (3.9, 4.5)]
    for (xa, xb) in piers:
        b.mesh(S.at(trimesh.creation.box(extents=[xb - xa, y1 - y0, T]), (xa + xb) / 2, (y0 + y1) / 2, ZB + T / 2), m_wood_v, rot_uv=True)
        b.mesh(S.at(S.rbox((xb - xa - 0.1, y1 - y0 - 0.3, 0.05), 0.01), (xa + xb) / 2, (y0 + y1) / 2, ZB - 0.02), m_wood_v, rot_uv=True)
    # lintel above the windows and the plaster between bookcases
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, Y_C - y1, T]), 0, (y1 + Y_C) / 2, ZB + T / 2), m_plaster)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.18, 0.2]), 0, Y_C - 0.09, ZB - 0.1), m_plaster)      # cornice
    b.mesh(S.at(trimesh.creation.box(extents=[2 * X_W, 0.1, 0.12]), 0, y1 + 0.05, ZB - 0.04), m_wood)
    # window frames: outer frame, mullions and transoms, set back in the reveal
    fz = ZB + 0.2
    for (xa, xb) in win_x:
        cxw = (xa + xb) / 2; ww = xb - xa
        for (cx_, cy_, sx_, sy_) in ((xa + 0.03, (y0 + y1) / 2, 0.06, y1 - y0), (xb - 0.03, (y0 + y1) / 2, 0.06, y1 - y0), (cxw, y1 - 0.03, ww, 0.06), (cxw, y0 + 0.03, ww, 0.06),
                                      (cxw, (y0 + y1) / 2, 0.04, y1 - y0), (cxw - ww / 4, (y0 + y1) / 2, 0.03, y1 - y0), (cxw + ww / 4, (y0 + y1) / 2, 0.03, y1 - y0)):
            b.mesh(S.at(trimesh.creation.box(extents=[sx_, sy_, 0.07]), cx_, cy_, fz), m_wood)
        for yt in (y0 + 0.9, y0 + 1.8, y0 + 2.6):
            b.mesh(S.at(trimesh.creation.box(extents=[ww, 0.035, 0.06]), cxw, yt, fz), m_wood)
        b.mesh(S.at(trimesh.creation.box(extents=[ww + 0.16, 0.06, 0.34]), cxw, y0 - 0.03, ZB + 0.1), m_wood)      # sill
    # bookcases on both sides
    pal = [np.array(rgb(c), np.float32) for c in ('#5a1a1a', '#2c3e5a', '#1f4a36', '#6a4a22', '#3a2a22', '#7a2a2a', '#222a3a', '#8a7448', '#4a1f3a', '#c8bfa8', '#2a4a4a', '#704a30')]
    for side in (-1, 1):
        for k in range(2):
            x_a = 4.5 + k * 2.1; x_b = x_a + 2.1
            cxb = side * (x_a + x_b) / 2
            b.mesh(S.at(trimesh.creation.box(extents=[2.1, Y_C - 1.1, 0.04]), cxb, (Y_C + 1.1) / 2 + 0.0, ZB + 0.36), m_wood)           # back panel
            for sx_ in (x_a, x_b):
                b.mesh(S.at(trimesh.creation.box(extents=[0.05, Y_C - 0.1, 0.42]), side * sx_, (Y_C - 0.1) / 2 + 0.05, ZB + 0.18), m_wood_v, rot_uv=True)
            ys = np.arange(1.15, Y_C - 0.4, 0.40)
            for y_ in ys:
                b.mesh(S.at(trimesh.creation.box(extents=[2.1, 0.03, 0.4]), cxb, y_, ZB + 0.18), m_wood)
                bm, bc = S.books(2.0, 0.34, 0.26, rng, pal, 0.72, lean=0.12)
                if bm is not None:
                    bm = S.at(bm, side * (x_a + 0.05) + (0 if side > 0 else -2.0), y_ + 0.015, ZB + 0.06)
                    b.mesh(bm, m_books, colors=bc, uv=None)
            b.mesh(S.at(trimesh.creation.box(extents=[2.1, 0.06, 0.45]), cxb, Y_C - 0.06, ZB + 0.18), m_wood)
    bulbs = []                  # every light bulb of the room: one emitter
    # ------------------------------------------------------------------------------------------------------------------ the desk
    DZ = 3.0
    b.mesh(S.at(S.rbox((2.5, 0.07, 1.25), 0.02), 0, 0.735, DZ), m_wood)                                  # top
    b.mesh(S.at(trimesh.creation.box(extents=[2.2, 0.008, 0.98]), 0, 0.773, DZ), m_inlay)
    for sx in (-1, 1):
        b.mesh(S.at(S.rbox((0.7, 0.66, 1.1), 0.015), sx * 0.88, 0.37, DZ), m_wood)                           # pedestals
        for yy in (0.55, 0.38, 0.21):
            b.mesh(S.at(S.rbox((0.6, 0.15, 0.03), 0.01), sx * 0.88, yy, DZ - 0.565), m_wood)
            b.mesh(S.at(trimesh.creation.box(extents=[0.14, 0.015, 0.02]), sx * 0.88, yy, DZ - 0.59), m_brass)
    b.mesh(S.at(trimesh.creation.box(extents=[1.1, 0.62, 0.04]), 0, 0.42, DZ + 0.3), m_wood)
    b.mesh(S.at(S.rbox((1.0, 0.5, 0.05), 0.012), 0, 0.42, DZ + 0.33), m_wood)
    for sx in (-0.2, 0.2):
        b.mesh(S.at(S.rbox((0.38, 0.4, 0.03), 0.01), sx, 0.42, DZ + 0.285), m_wood)
    # lamp, laptop, papers, pens
    lamp = S.lathe_y([(0.001, 0.0), (0.09, 0.0), (0.1, 0.012), (0.045, 0.03), (0.02, 0.06), (0.018, 0.30)], 40)
    b.mesh(S.at(lamp, -0.8, 0.775, DZ + 0.15), m_brass, smooth=True)
    shade = S.lathe_y([(0.07, 0.0), (0.095, 0.02), (0.11, 0.08), (0.105, 0.12), (0.03, 0.14), (0.001, 0.145)], 40)
    b.mesh(S.at(shade, -0.8, 1.04, DZ + 0.15), m_green, smooth=True)
    bulbs.append(S.ellipsoid((0.035, 0.035, 0.035), (-0.8, 1.06, DZ + 0.15), sub=2))
    lap = S.rbox((0.34, 0.018, 0.24), 0.006); b.mesh(S.at(lap, 0.78, 0.8, DZ + 0.1, ry=-18), m_chrome)
    scr = S.rbox((0.34, 0.012, 0.23), 0.004); b.mesh(S.at(scr, 0.78, 0.8, DZ + 0.1, ry=-18), m_chrome)
    b.mesh(S.at(trimesh.creation.box(extents=[0.30, 0.205, 0.003]), 0.78 + 0.02, 0.9, DZ + 0.1 + 0.09, rx=-80, ry=-18), {'type': 'diffuse', 'reflectance': lin_rgb([0.03, 0.05, 0.09])})
    for k in range(3):
        b.mesh(S.at(trimesh.creation.box(extents=[0.30, 0.006 * (k + 1), 0.21]), 0.15 + 0.01 * k, 0.775 + 0.003 * (k + 1), DZ - 0.1, ry=8 - 6 * k), m_paper)
    b.mesh(S.at(S.cylinder_y(0.04, 0.1, seg=24), -0.15, 0.825, DZ + 0.3), m_dark)
    for k in range(3):
        b.mesh(S.at(S.capsule_between((0, 0, 0), (0.02 * (k - 1), 0.12, 0.015 * (k - 1)), 0.004), -0.15, 0.83, DZ + 0.3), m_brass)
    # the PM's chair behind the desk
    for (cm, kind) in S.chair_office():
        mat = {'leather': m_chair, 'metal': m_chrome, 'dark': m_dark}[kind]
        b.mesh(S.at(cm, 0.55, 0.0, DZ + 1.25, ry=170), mat, smooth=(kind != 'leather'))
    # ------------------------------------------------------------------------------------------------------------------ flags
    for side in (-1, 1):
        fx = side * 2.75; fz_ = 4.9
        b.mesh(S.at(S.cylinder_y(0.014, 2.6, seg=14), fx, 1.3, fz_), m_brass)
        b.mesh(S.at(S.ellipsoid((0.03, 0.045, 0.03), sub=2), fx, 2.62, fz_), m_brass)
        b.mesh(S.at(S.cylinder_y(0.14, 0.04, seg=30), fx, 0.02, fz_), m_brass)
        fm, fuv = S.flag_cloth(1.45, 1.06, 56, 36, wave=0.06, waves=2.1, phase=0.9 * side, droop=0.15)
        if side > 0: fm.apply_scale([-1, 1, 1]); fm.invert()
        fm = S.at(fm, fx + (0.015 * side), 2.3 - 0.0, fz_ - 0.02)
        if side > 0: fuv = fuv.copy(); fuv[:, 0] = fuv[:, 0]
        b.mesh(fm, m_flag, uv='given', uv_arr=fuv)
    # ------------------------------------------------------------------------------------------------------------------ the chandelier (brass arms, candle bulbs)
    cx_, cy_, cz_ = 0.0, 3.55, 3.0
    b.mesh(S.at(S.cylinder_y(0.012, 5.3 - cy_ - 0.2, seg=10), cx_, (cy_ + 5.1) / 2 + 0.0, cz_), m_brass)
    body = S.lathe_y([(0.001, -0.12), (0.05, -0.08), (0.03, -0.02), (0.07, 0.04), (0.035, 0.10), (0.02, 0.2)], 36)
    b.mesh(S.at(body, cx_, cy_, cz_), m_brass, smooth=True)
    for ring, (rr, n, yy) in enumerate(((0.55, 8, 0.02), (0.33, 6, 0.16))):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * ring) / n
            tip = np.array([rr * math.cos(a), yy + 0.12, rr * math.sin(a)])
            path = [np.array([0, yy - 0.05, 0]), np.array([rr * 0.5 * math.cos(a), yy - 0.16, rr * 0.5 * math.sin(a)]), np.array([rr * 0.85 * math.cos(a), yy - 0.05, rr * 0.85 * math.sin(a)]), tip]
            arm = S.sweep_circle(np.array(path), 0.009, 8)
            b.mesh(S.at(arm, cx_, cy_, cz_), m_brass, smooth=True)
            b.mesh(S.at(S.cylinder_y(0.02, 0.07, seg=14), tip[0] + cx_, tip[1] + cy_ + 0.04, tip[2] + cz_), m_brass)
            b.mesh(S.at(S.cylinder_y(0.013, 0.09, seg=12), tip[0] + cx_, tip[1] + cy_ + 0.12, tip[2] + cz_), m_paper)
            bulbs.append(S.ellipsoid((0.016, 0.02, 0.016), (tip[0] + cx_, tip[1] + cy_ + 0.19, tip[2] + cz_), sub=2))
    b.mesh(S.merge(bulbs), B_black(), emitter=E_area([70.0, 48.0, 24.0]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ light
    sw, sh = int(q.get('sky_w', 6144)), int(q.get('sky_h', 3072))
    sky, sd = skylib.cached(os.path.join(q.get('work', '/tmp'), 'sky_%d.npz' % sw), lambda: skylib.sunset_sky(sw, sh, SUN_AZ, SUN_EL, seed=3, sun_E=0.0))
    b.shape(L_env(sky, q.get('sky_gain', 1.3)), 'env')
    for k in range(3):                      # the sun: a directional light, three copies at a third of the strength (the path tracer picks lights at random, so a stronger pick rate means less noise)
        b.shape(L_sun(sd, q.get('sun', 4.5) / 3.0, (1.0, 0.70, 0.42)), 'sun')
    # the soft light that comes from the side of the camera (a bounce): a big panel behind the camera that the picture never sees
    b.shape(L_rect((0.0, 3.4, -8.0), (0.0, -0.45, 1.0), 14.0, 5.0, [0.9, 0.82, 0.74]), 'fill')
    # one big soft box in the ceiling over the fighting area (the ceiling is above the picture)
    b.shape(L_rect((0.0, 5.18, -0.4), (0.0, -1.0, 0.0), 9.0, 3.4, [4.2, 3.3, 2.4], up=(0, 0, 1)), 'softbox')

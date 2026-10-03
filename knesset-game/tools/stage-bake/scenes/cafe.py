# קפיטריית הכנסת: the cafeteria. Patterned cement tiles, a long wooden counter with baskets of rolls and an espresso machine, pendant lamps, tall windows onto a sunny garden, café tables and potted plants.
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, trimesh
from stagelib import *
import solids as S, skylib, texlib

NAME = 'cafe'
LIVE = {}
H_CAM = 1.5
APERTURE = 0.03
SUN_AZ, SUN_EL = 28.0, 21.0
WIN = [(-5.0 + 2.5 * i - 1.05, -5.0 + 2.5 * i + 1.05) for i in range(5)]         # the five windows (x ranges), their height
WIN_Y = (1.55, 4.7)

def shaft_spec():
    """the sun through the windows, for volume.shafts"""
    sa, se = math.radians(SUN_AZ), math.radians(SUN_EL)
    sun = (math.sin(sa) * math.cos(se), math.sin(se), math.cos(sa) * math.cos(se))
    windows = []; bars = []
    y0, y1 = WIN_Y
    for (xa, xb) in WIN:
        cx = (xa + xb) / 2; ww = xb - xa
        windows.append((xa + 0.06, xb - 0.06, y0 + 0.06, y1 - 0.06))
        bars.append((cx - 0.025, cx + 0.025, y0, y1))
        for yt in (y0 + 1.0, y0 + 2.1): bars.append((xa, xb, yt - 0.02, yt + 0.02))
    return dict(sun=sun, plane_z=7.6 + 0.2, windows=windows, bars=bars, f=layer_f(5.0), scale=0.6, gain=0.4, color=(1.0, 0.9, 0.7))

ZC = 5.0            # the front of the counter
ZW = 7.6            # the back wall

SLABS = [
    dict(name='tables', z0=1.8, z1=4.35, f=layer_f(3.0), scale=1.25, spp=96),
    dict(name='counter', z0=4.35, z1=6.9, f=layer_f(5.5), scale=1.25, spp=96),
    dict(name='floor', floor=True, z0=-3.3, z1=ZW - 0.1, f=1.0, width=floor_width(H_CAM), scale=1.25, spp=96),
    dict(name='wall', z0=6.9, z1=12.0, f=layer_f(7.8), scale=1.25, spp=96),
    dict(name='sky', z0=12.0, z1=1e9, f=0.16, bg=True, scale=1.0, spp=64, aperture=0.035, noycut=True, tone=dict(exposure=0.8)),
]
QUALITY = dict(tables=84, counter=84, floor=82, wall=82, sky=78)
TONE = dict(exposure=1.0, sat=1.06, contrast=1.04, bloom_strength=0.10, bloom_thresh=1.5, sharp=0.35)

def _M(b, name, tex, tile, **kw): return b.B(name, M_tex(tex, tile, **kw))

def plant(rng, n=34, h=1.3, spread=0.75):
    """a leafy potted plant: curved stems with big blade leaves; returns (mesh, vertex colours)"""
    ms = []; cs = []
    for i in range(n):
        a = rng.uniform(0, 2 * math.pi); lean = rng.uniform(0.25, 0.95) * spread
        hh = h * rng.uniform(0.55, 1.0)
        pts = np.array([[0, 0.0, 0], [math.cos(a) * lean * 0.3, hh * 0.5, math.sin(a) * lean * 0.3], [math.cos(a) * lean * 0.7, hh * 0.85, math.sin(a) * lean * 0.7], [math.cos(a) * lean, hh, math.sin(a) * lean]])
        stem = S.sweep_circle(pts, 0.008, 5)
        ms.append(stem); cs.append(np.tile(np.array(rgb('#3a5a2a'), np.float32), (len(stem.vertices), 1)))
        leaf = S.ellipsoid((0.16, 0.012, 0.34), sub=1)
        leaf = S.at(leaf, 0, 0, 0.30)
        leaf = S.at(leaf, 0, 0, 0, rx=-rng.uniform(15, 60), ry=math.degrees(-a) + 90)
        leaf = S.at(leaf, pts[-1][0], pts[-1][1], pts[-1][2])
        g = np.array(rgb('#2f6a2a'), np.float32) * rng.uniform(0.6, 1.3)
        ms.append(leaf); cs.append(np.tile(g, (len(leaf.vertices), 1)))
    return S.merge(ms), np.vstack(cs)

def chair_cafe():
    parts = []
    parts.append(('dark', S.cylinder_y(0.2, 0.04, (0, 0.46, 0), 28)))
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        parts.append(('dark', S.capsule_between((sx * 0.15, 0.45, sz * 0.15), (sx * 0.19, 0.0, sz * 0.19), 0.014, 6)))
    for sx in (-1, 1):
        parts.append(('dark', S.capsule_between((sx * 0.17, 0.47, 0.17), (sx * 0.18, 0.95, 0.2), 0.014, 6)))
    pts = np.array([[math.cos(a) * 0.19, 0.84 + 0.04 * math.sin(a * 2), 0.17 + 0.03 * math.cos(a)] for a in np.linspace(-1.2, 1.2, 14)])
    parts.append(('dark', S.sweep_circle(pts, 0.016, 6)))
    return parts

def build(b, q):
    rng = np.random.RandomState(9)
    pp = q.get('ppm_mul', 1.0)
    # ------------------------------------------------------------------------------------------------------------------ materials
    cement = texlib.tex_cement_tile((2.4, 2.4), int(190 * pp), 0.4, seed=5, colors=('#7f98a2', '#f1e7d2', '#d6b78e', '#5f737c'), grout_mm=3.0)
    m_floor = _M(b, 'floor', cement, 2.4, nstr=0.4, spec=0.45, cc=0.2, cc_gloss=0.7)
    plaster = texlib.tex_paint((2.0, 2.0), int(150 * pp), '#e6d2ac', var=0.04, seed=3)
    m_wall = _M(b, 'wall', plaster, 2.0, spec=0.3)
    subway = texlib.tex_stone_tiles((2.4, 2.4), int(170 * pp), (0.15, 0.075), base=('#e4e2da', '#f4f2ea'), vein_col='#e0ddd2', vein_amt=0.0, seed=2, polish=0.12, grout_mm=2.0, tint_var=0.02, stagger=0.5)
    m_tile = _M(b, 'subway', subway, 2.4, nstr=1.2, spec=0.5, cc=0.4, cc_gloss=0.9)
    oak = texlib.tex_planks((2.4, 2.4), int(160 * pp), 0.11, (0.9, 2.0), tone=('#a8743f', '#d9ab6c'), seed=12, ring=9.0, joint_mm=3.0, rough=(0.4, 0.55))
    m_oak = _M(b, 'oak', oak, 2.4, nstr=1.4, spec=0.5, cc=0.3, cc_gloss=0.8)
    dark = texlib.tex_planks((2.4, 2.4), int(160 * pp), 0.16, (0.9, 2.0), tone=('#3a2212', '#6d4222'), seed=19, ring=8.0, joint_mm=2.0)
    m_dark_wood = _M(b, 'darkwood', dark, 2.4, nstr=1.0, spec=0.5, cc=0.3, cc_gloss=0.8)
    marble = texlib.tex_stone_tiles((2.4, 2.4), int(170 * pp), (2.4, 1.2), base=('#cfc9bb', '#eeeae0'), vein_col='#9d968a', vein_amt=1.0, seed=8, polish=0.12, grout_mm=0.8, scale=1.1)
    m_marble = _M(b, 'marble', marble, 2.4, nstr=0.3, spec=0.6, cc=0.5, cc_gloss=0.92)
    wicker = texlib.tex_fabric((0.4, 0.4), int(420 * pp), '#a9793f', weave=6e-3, var=0.30, seed=4)
    m_wicker = _M(b, 'wicker', wicker, 0.4, nstr=2.5, spec=0.3)
    brushed = texlib.tex_metal_brushed((1.0, 1.0), int(400 * pp), '#a9adb3', seed=6)
    m_steel = _M(b, 'steel', brushed, 1.0, nstr=0.6, metal=1.0, spec=0.5)
    m_chrome = b.B('chrome', B_principled('#cfd2d6', 0.12, metallic=1.0, twosided=True))
    m_brass = b.B('brass', B_principled('#c9a24b', 0.25, metallic=1.0, twosided=True))
    m_black = b.B('black', B_principled('#101114', 0.4, twosided=True))
    m_white = b.B('white', B_principled('#f1efe8', 0.2, clearcoat=0.5, twosided=True))
    m_red = b.B('red', B_principled('#c0332b', 0.3, clearcoat=0.5, twosided=True))
    m_vc = b.B('vc', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.7, 'specular': 0.3}})
    m_bread = b.B('bread', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.65, 'specular': 0.25}})
    m_glow = b.B('glow', B_black())
    m_shade = b.B('shade', B_principled('#2f5a45', 0.25, clearcoat=0.5, twosided=True))
    board = texlib.text_image('x', 10, 8, 8)    # placeholder to warm the font cache
    # the chalkboard menu
    bw, bh = 900, 1100
    boardimg = np.full((bh, bw, 3), lin('#1d2b24'), np.float32)
    lines = [('תפריט היום', 96, 80), ('קפה .......... 12 ₪', 70, 260), ('בורקס ........ 9 ₪', 70, 400), ('קרואסון ..... 11 ₪', 70, 540), ('טוסט ......... 24 ₪', 70, 680), ('מכות ......... חינם', 74, 860)]
    for (t, sz, yy) in lines:
        ti = texlib.text_image(t, sz, bw, 150, color=(0.92, 0.92, 0.86), bg=(0.0, 0.0, 0.0), bold=True)
        lum = ti.mean(axis=2, keepdims=True)
        y0 = yy; y1 = min(bh, yy + 150)
        boardimg[y0:y1] = boardimg[y0:y1] * (1 - np.clip(lum[:y1 - y0] * 1.3, 0, 1)) + lin('#efece0') * np.clip(lum[:y1 - y0] * 1.3, 0, 1)
    boardimg *= (1 + 0.05 * texlib.fbm(bh, bw, 5, 4)[..., None])
    m_board = b.B('board', {'type': 'twosided', 'bsdf': {'type': 'diffuse', 'reflectance': T_(boardimg, 1.0, wrap='clamp')}})
    # ------------------------------------------------------------------------------------------------------------------ the room
    XW, YC = 14.0, 5.7
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 24]), 0, -0.1, -4), m_floor)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 24]), 0, YC + 0.1, -4), m_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 24]), -XW, YC / 2, -4), m_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 24]), XW, YC / 2, -4), m_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.2]), 0, YC / 2, -14), m_wall)
    # the back wall: tiles below, piers between five tall windows, plaster above
    T = 0.45
    win = WIN
    y0, y1 = WIN_Y
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, y0, T]), 0, y0 / 2, ZW + T / 2), m_tile)
    edges = [-XW] + [v for w_ in win for v in w_] + [XW]
    for i in range(0, len(edges), 2):
        xa, xb = edges[i], edges[i + 1]
        b.mesh(S.at(trimesh.creation.box(extents=[xb - xa, y1 - y0, T]), (xa + xb) / 2, (y0 + y1) / 2, ZW + T / 2), m_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC - y1, T]), 0, (y1 + YC) / 2, ZW + T / 2), m_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.12, 0.2]), 0, 1.58, ZW - 0.1), m_wall)
    for (xa, xb) in win:
        cx = (xa + xb) / 2; ww = xb - xa
        fz = ZW + 0.2
        for (px, py, sx, sy) in ((xa + 0.03, (y0 + y1) / 2, 0.06, y1 - y0), (xb - 0.03, (y0 + y1) / 2, 0.06, y1 - y0), (cx, y1 - 0.03, ww, 0.06), (cx, y0 + 0.03, ww, 0.06), (cx, (y0 + y1) / 2, 0.05, y1 - y0)):
            b.mesh(S.at(trimesh.creation.box(extents=[sx, sy, 0.07]), px, py, fz), m_white)
        for yt in (y0 + 1.0, y0 + 2.1):
            b.mesh(S.at(trimesh.creation.box(extents=[ww, 0.04, 0.06]), cx, yt, fz), m_white)
        b.mesh(S.at(trimesh.creation.box(extents=[ww + 0.14, 0.05, 0.3]), cx, y0 - 0.025, ZW + 0.1), m_white)
    # the menu board on the plaster to the left, shelves with jars to the right
    b.mesh(S.at(trimesh.creation.box(extents=[2.3, 2.8, 0.05]), -7.1, 3.0, ZW - 0.03), m_dark_wood)
    qd = trimesh.Trimesh(np.array([[-8.1, 1.7, ZW - 0.07], [-6.1, 1.7, ZW - 0.07], [-6.1, 4.3, ZW - 0.07], [-8.1, 4.3, ZW - 0.07]], np.float32), np.array([[0, 2, 1], [0, 3, 2]]), process=False)
    b.mesh(qd, m_board, uv='given', uv_arr=np.array([[1, 1], [0, 1], [0, 0], [1, 0]], np.float32))
    for sy in (2.2, 3.0, 3.8):
        b.mesh(S.at(trimesh.creation.box(extents=[2.4, 0.04, 0.26]), 7.3, sy, ZW - 0.12), m_oak)
        for k in range(7):
            jh = rng.uniform(0.16, 0.26)
            b.mesh(S.at(S.cylinder_y(0.055, jh, seg=14), 6.4 + 0.33 * k + rng.uniform(-0.03, 0.03), sy + 0.02 + jh / 2, ZW - 0.12), m_vc if False else m_white, uv=None)
    # ------------------------------------------------------------------------------------------------------------------ the counter
    CW = 9.4
    b.mesh(S.at(trimesh.creation.box(extents=[CW, 1.0, 0.7]), 0, 0.5, ZC + 0.4), m_oak, rot_uv=True)                         # body with the vertical slats of the front
    b.mesh(S.at(S.rbox((CW + 0.2, 0.06, 0.95), 0.012), 0, 1.03, ZC + 0.35), m_marble)
    b.mesh(S.at(trimesh.creation.box(extents=[CW + 0.1, 0.1, 0.05]), 0, 0.05, ZC + 0.02), m_dark_wood)
    # baskets with rolls
    bowl = S.lathe_y([(0.001, 0.0), (0.19, 0.0), (0.24, 0.07), (0.275, 0.16), (0.262, 0.165), (0.225, 0.08), (0.17, 0.02), (0.001, 0.02)], 36)
    rolls_m = []; rolls_c = []
    for k in range(7):
        bx = -4.1 + 0.82 * k
        b.mesh(S.at(bowl, bx, 1.06, ZC + 0.4), m_wicker, smooth=True)
        kind = rng.randint(3)
        for j in range(rng.randint(9, 15)):
            a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(0, 0.2) * (1.0 - 0.0)
            hup = 0.04 + 0.2 * (1 - rr / 0.2) ** 1.2 + rng.uniform(0, 0.04)
            col = np.array(rgb(['#d99a52', '#c4803a', '#e6b46a', '#b86f2f'][rng.randint(4)]), np.float32) * rng.uniform(0.85, 1.1)
            if kind == 0:                                                     # round rolls
                m = S.ellipsoid((0.085, 0.055, 0.085), (bx + math.cos(a) * rr, 1.06 + 0.1 + hup, ZC + 0.4 + math.sin(a) * rr), sub=2)
            elif kind == 1:                                                   # long loaves (made at the origin, turned, then put in the basket)
                m = S.at(S.ellipsoid((0.24, 0.045, 0.06), (0, 0, 0), sub=2), bx + math.cos(a) * rr * 0.4, 1.06 + 0.1 + hup, ZC + 0.4 + math.sin(a) * rr * 0.6, ry=rng.uniform(-40, 40))
            else:                                                             # bourekas, flat triangles
                m = S.ellipsoid((0.11, 0.035, 0.09), (bx + math.cos(a) * rr, 1.06 + 0.1 + hup, ZC + 0.4 + math.sin(a) * rr), sub=2)
            rolls_m.append(m); rolls_c.append(np.tile(col, (len(m.vertices), 1)))
    b.mesh(S.merge(rolls_m), m_bread, colors=np.vstack(rolls_c), smooth=True, uv=None)
    # cake stand
    b.mesh(S.at(S.lathe_y([(0.001, 0), (0.12, 0), (0.03, 0.02), (0.025, 0.2), (0.2, 0.22), (0.2, 0.235), (0.001, 0.235)], 36), 1.85, 1.06, ZC + 0.4), m_white, smooth=True)
    b.mesh(S.at(S.cylinder_y(0.17, 0.09, seg=28), 1.85, 1.06 + 0.28, ZC + 0.4), m_vc if False else m_red)
    # the espresso machine
    mx, mz = 3.4, ZC + 0.4
    b.mesh(S.at(S.rbox((1.0, 0.5, 0.55), 0.03), mx, 1.06 + 0.25, mz), m_steel)
    b.mesh(S.at(S.rbox((1.04, 0.05, 0.6), 0.015), mx, 1.06 + 0.52, mz), m_chrome)
    b.mesh(S.at(S.rbox((0.98, 0.04, 0.5), 0.01), mx, 1.06 + 0.02, mz - 0.05), m_black)
    for gx in (-0.28, 0.28):
        b.mesh(S.at(S.cylinder_y(0.06, 0.1, seg=22), mx + gx, 1.06 + 0.22, mz - 0.3), m_chrome)
        b.mesh(S.at(S.rbox((0.1, 0.04, 0.2), 0.012), mx + gx, 1.06 + 0.2, mz - 0.4), m_black)
        b.mesh(S.at(S.cylinder_y(0.012, 0.18, seg=10), mx + gx, 1.06 + 0.1, mz - 0.5), m_black)
    for sx in (-0.5, 0.5):
        b.mesh(S.sweep_circle(np.array([[mx + sx, 1.06 + 0.3, mz - 0.25], [mx + sx * 1.1, 1.06 + 0.15, mz - 0.38], [mx + sx * 1.1, 1.06 + 0.05, mz - 0.42]]), 0.008, 8), m_chrome, smooth=True, uv=None)
    b.mesh(S.at(S.ellipsoid((0.012, 0.012, 0.01), sub=1), mx + 0.0, 1.06 + 0.38, mz - 0.28), m_red, uv=None)
    for cxx in np.linspace(mx - 0.4, mx + 0.4, 5):
        b.mesh(S.at(S.lathe_y([(0.001, 0), (0.025, 0), (0.04, 0.07), (0.043, 0.075), (0.039, 0.07), (0.022, 0.006), (0.001, 0.006)], 20), cxx, 1.06 + 0.545, mz + 0.05), m_white, smooth=True)
    b.mesh(S.at(S.cylinder_y(0.11, 0.3, seg=22, r2=0.05), mx - 1.1, 1.06 + 0.15, mz), m_black)       # the grinder
    # ------------------------------------------------------------------------------------------------------------------ pendant lamps (the bulbs are one emitter)
    bulbs = []
    for k in range(5):
        lx = -5.0 + 2.5 * k
        b.mesh(S.at(S.cylinder_y(0.004, 2.1, seg=6), lx, 5.7 - 1.05, ZC - 0.6), m_black, uv=None)
        shade = S.lathe_y([(0.07, 0.0), (0.2, 0.0), (0.3, 0.12), (0.32, 0.2), (0.1, 0.26), (0.03, 0.3), (0.001, 0.3)], 40)
        shade_in = S.lathe_y([(0.075, 0.003), (0.195, 0.003), (0.295, 0.12), (0.315, 0.2)], 40)
        b.mesh(S.at(shade, lx, 3.5, ZC - 0.6), m_shade, smooth=True)
        b.mesh(S.at(shade_in, lx, 3.5, ZC - 0.6), m_brass, smooth=True)
        bulbs.append(S.ellipsoid((0.05, 0.065, 0.05), (lx, 3.5 + 0.0, ZC - 0.6), sub=2))
    b.mesh(S.merge(bulbs), m_glow, emitter=E_area([55.0, 40.0, 24.0]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ tables, chairs, plants
    for tx, tz, ang in ((-3.9, 2.9, 0), (3.9, 2.9, 0), (-6.3, 3.4, 0), (6.3, 3.4, 0)):
        b.mesh(S.at(S.cylinder_y(0.45, 0.04, seg=36), tx, 0.74, tz), m_oak)
        b.mesh(S.at(S.cylinder_y(0.04, 0.72, seg=16), tx, 0.36, tz), m_black)
        b.mesh(S.at(S.cylinder_y(0.28, 0.03, seg=28), tx, 0.015, tz), m_black)
        b.mesh(S.at(S.lathe_y([(0.001, 0), (0.03, 0), (0.05, 0.07), (0.05, 0.09), (0.045, 0.1), (0.04, 0.09), (0.001, 0.005)], 18), tx + 0.08, 0.76, tz - 0.05), m_white, smooth=True)
        for sgn, a0 in ((1, -35), (-1, 145)):
            for (kind, cm) in chair_cafe():
                b.mesh(S.at(cm, tx + sgn * -0.0, 0.0, tz + (0.65 if sgn > 0 else -0.65), ry=a0 + 180 if sgn > 0 else 0), m_dark_wood, smooth=True)
    for px_, pz_, ph in ((-8.2, 3.6, 1.5), (8.0, 3.4, 1.35)):
        pm, pc = plant(rng, 38, ph, 0.8)
        b.mesh(S.at(pm, px_, 0.55, pz_), m_vc, colors=pc, smooth=True, uv=None)
        b.mesh(S.at(S.lathe_y([(0.001, 0), (0.2, 0), (0.28, 0.15), (0.3, 0.55), (0.32, 0.6), (0.27, 0.6), (0.001, 0.52)], 32), px_, 0.0, pz_), m_white, smooth=True)
    # ------------------------------------------------------------------------------------------------------------------ outside: a garden of trees (blurred by the depth of field), and the sky
    fol_m = []; fol_c = []
    leaf_pal = [np.array(rgb(h), np.float32) for h in ('#3f8a32', '#5aa03a', '#2f7a2c', '#78b040', '#4a9534', '#2a6a28')]
    trunks = []; trunk_c = []
    for i in range(44):
        x = rng.uniform(-38, 38); z = rng.uniform(16, 46); hgt = rng.uniform(4.5, 9.5)
        trunk = S.cylinder_y(rng.uniform(0.16, 0.3), hgt, (x, hgt / 2 - 0.2, z), 8)
        trunks.append(trunk); trunk_c.append(np.tile(np.array(rgb('#4a3626'), np.float32), (len(trunk.vertices), 1)))
        for j in range(rng.randint(5, 8)):
            R = rng.uniform(1.0, 2.0)
            cen = np.array([x + rng.uniform(-2.2, 2.2), hgt + rng.uniform(-1.0, 2.4), z + rng.uniform(-1.8, 1.8)])
            nl = 220
            P = rng.randn(nl, 3); P /= np.linalg.norm(P, axis=1, keepdims=True); P *= (R * rng.uniform(0.35, 1.0, (nl, 1)))
            P[:, 1] *= 0.8
            base_col = leaf_pal[rng.randint(len(leaf_pal))] * rng.uniform(0.8, 1.2)
            for k in range(nl):
                n_ = rng.randn(3); n_ /= np.linalg.norm(n_)
                t1 = np.cross(n_, [0.3, 1.0, 0.2]); t1 /= np.linalg.norm(t1) + 1e-9; t2 = np.cross(n_, t1)
                c0 = cen + P[k]; hl, hw = 0.22, 0.11
                fol_m.append(trimesh.Trimesh(np.array([c0 - t1 * hl - t2 * hw, c0 + t1 * hl - t2 * hw, c0 + t1 * hl + t2 * hw, c0 - t1 * hl + t2 * hw], np.float32), np.array([[0, 1, 2], [0, 2, 3]]), process=False))
                shade = 0.6 + 0.6 * (P[k][1] / R * 0.5 + 0.5)
                fol_c.append(np.tile(base_col * shade * rng.uniform(0.85, 1.15), (4, 1)))
    b.mesh(S.merge(trunks), m_vc, colors=np.vstack(trunk_c), smooth=True, uv=None)
    b.mesh(S.merge(fol_m), m_vc, colors=np.vstack(fol_c), uv=None)
    b.mesh(S.at(trimesh.creation.box(extents=[120, 0.3, 80]), 0, -0.2, 50), b.B('grass', B_principled('#4f7a38', 0.9, twosided=True)))
    # ------------------------------------------------------------------------------------------------------------------ light
    sw, sh = int(q.get('sky_w', 6144)), int(q.get('sky_h', 3072))
    sky, sd = skylib.cached(os.path.join(q.get('work', '/tmp'), 'sky_%d.npz' % sw), lambda: skylib.day_sky(sw, sh, SUN_AZ, SUN_EL, seed=7))
    b.shape(L_env(sky, q.get('sky_gain', 1.0)), 'env')
    for k in range(3):
        b.shape(L_sun(sd, q.get('sun', 4.5) / 3.0, (1.0, 0.9, 0.72)), 'sun')
    b.shape(L_rect((0.0, 3.4, -8.0), (0.0, -0.3, 1.0), 14.0, 5.0, [0.9, 0.85, 0.78]), 'fill')
    su, sv = project(mx, 1.06 + 0.62, mz, layer_width(layer_f(5.5)), H_CAM)
    LIVE.clear(); LIVE.update({'layer': 'counter', 'steam': [round(su, 1), round(sv, 1)]})
    b.shape(L_rect((0.0, YC - 0.15, 1.5), (0.0, -1.0, 0.0), 16.0, 5.0, [0.4, 0.38, 0.34]), 'ceiling')

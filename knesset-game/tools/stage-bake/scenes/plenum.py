# מליאת הכנסת: the plenum hall. A stone floor in the well, the speaker's lectern with the menorah, two flags, five tiers of desks and blue chairs with the members, a wood-clad back wall with the emblem and arched windows.
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, trimesh
from stagelib import *
import solids as S, texlib

NAME = 'plenum'
H_CAM = 1.5
APERTURE = 0.03

Z0, TD, RISE = 4.4, 1.3, 0.40          # front of the first tier, depth of a tier, height of a step
NT = 5
Z_BACK = Z0 + TD * NT + 0.9            # the back wall

SLABS = [
    dict(name='podium', z0=1.2, z1=4.35, f=layer_f(2.8), scale=1.25, spp=96),
    dict(name='floor', floor=True, z0=-4.6, z1=Z0 + 0.1, f=1.0, width=floor_width(H_CAM), scale=1.25, spp=96, post_blur=(0.8, 0.5)),
    dict(name='tier1', z0=4.35, z1=Z0 + 2 * TD - 0.01, f=layer_f(5.7), scale=1.25, spp=96, noycut=True),
    dict(name='back', z0=Z0 + 2 * TD - 0.01, z1=30.0, f=layer_f(10.0), scale=1.1, spp=96, aperture=0.035),
]
QUALITY = dict(podium=84, floor=82, tier1=82, back=80)
TONE = dict(exposure=1.3, sat=1.05, contrast=1.04, bloom_strength=0.06, bloom_thresh=1.6, sharp=0.35)

def _M(b, name, tex, tile, **kw): return b.B(name, M_tex(tex, tile, **kw))

def build(b, q):
    rng = np.random.RandomState(11)
    pp = q.get('ppm_mul', 1.0)
    # ------------------------------------------------------------------------------------------------------------------ materials
    stone = texlib.tex_stone_tiles((2.4, 2.4), int(190 * pp), (0.8, 0.8), base=('#8d7d65', '#bcae94'), vein_col='#8c7a62', vein_amt=0.55, seed=4, polish=0.2, grout_mm=2.5, tint_var=0.06)
    m_floor = _M(b, 'floor', stone, 2.4, nstr=1.6, spec=0.5, cc=0.5, cc_gloss=0.88)
    oak = texlib.tex_planks((2.4, 2.4), int(170 * pp), 0.2, (0.9, 2.0), tone=('#8a5a30', '#cf9d62'), seed=12, ring=8.0, joint_mm=1.5, rough=(0.38, 0.55))
    m_oak = _M(b, 'oak', oak, 2.4, nstr=1.2, spec=0.5, cc=0.35, cc_gloss=0.82)
    m_oak_v = _M(b, 'oak_v', oak, 2.4, nstr=1.2, spec=0.5, cc=0.35, cc_gloss=0.82)
    veneer = texlib.tex_planks((2.4, 2.4), int(170 * pp), 0.6, (1.6, 2.4), tone=('#7a4a26', '#c08a52'), seed=15, ring=6.0, joint_mm=1.0, rough=(0.35, 0.5))
    m_furn = _M(b, 'furn', veneer, 2.4, nstr=0.8, spec=0.5, cc=0.4, cc_gloss=0.85)
    slat = texlib.tex_planks((2.4, 2.4), int(150 * pp), 0.14, (1.0, 2.3), tone=('#6e4524', '#b98349'), seed=14, ring=9.0, joint_mm=3.0, rough=(0.45, 0.6))
    m_slat = _M(b, 'slat', slat, 2.4, nstr=1.4, spec=0.45)
    fab = texlib.tex_fabric((0.5, 0.5), int(500 * pp), '#1f46a0', var=0.16, seed=8)
    m_chair = _M(b, 'chair', fab, 0.5, nstr=0.8, spec=0.35, sheen=0.5)
    m_dark = b.B('dark', B_principled('#18181a', 0.5, twosided=True))
    m_gold = b.B('gold', B_principled('#d2a94c', 0.2, metallic=1.0, twosided=True))
    m_cream = b.B('cream', B_principled('#d8ccb2', 0.7, twosided=True))
    m_stone_wall = b.B('stonewall', B_principled('#7d6f58', 0.8, twosided=True))
    m_paper = b.B('paper', B_principled('#ece7da', 0.85, twosided=True))
    m_people = b.B('people', {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}, 'roughness': 0.65, 'specular': 0.35}})
    flag_tex = texlib.flag_israel(880, 640)
    m_flag = b.B('flag', {'type': 'twosided', 'bsdf': {'type': 'diffuse', 'reflectance': T_(flag_tex, 1.0)}})
    m_glow = b.B('glow', B_black())
    # ------------------------------------------------------------------------------------------------------------------ the hall
    XW, YC = 15.0, 7.2
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 30]), 0, -0.1, Z0 - 15 + 8), m_floor)                                  # the floor of the well (and under the tiers)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 30]), 0, YC + 0.1, Z0 - 15 + 8), m_cream)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 30]), -XW, YC / 2, Z0 - 15 + 8), m_slat, rot_uv=True)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 30]), XW, YC / 2, Z0 - 15 + 8), m_slat, rot_uv=True)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.2]), 0, YC / 2, -12), m_cream)                                         # behind the camera
    # the back wall: wooden slats, a stone panel behind the emblem, arched windows that glow
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.3]), 0, YC / 2, Z_BACK + 0.15), m_slat, rot_uv=True)
    b.mesh(S.at(trimesh.creation.box(extents=[6.0, 4.6, 0.12]), 0, 4.1, Z_BACK - 0.05), m_stone_wall)
    b.mesh(S.at(trimesh.creation.box(extents=[6.2, 0.1, 0.2]), 0, 6.45, Z_BACK - 0.1), m_oak)
    b.mesh(S.at(trimesh.creation.box(extents=[6.2, 0.1, 0.2]), 0, 1.85, Z_BACK - 0.1), m_oak)
    men = S.menorah(2.2)
    b.mesh(S.at(men, 0, 3.0, Z_BACK - 0.2), m_gold, smooth=True, uv=None)
    for side in (-1, 1):
        ob = S.olive_branch(2.0, 18, 0.7, side, seed=3 + side)
        b.mesh(S.at(ob, side * 0.55, 2.85, Z_BACK - 0.2), m_gold, smooth=True, uv=None)
    wins = []
    for k in range(-5, 6):
        if abs(k) <= 1: continue
        wins.append(S.at(S.arch_panel(1.05, 2.1, 0.06), k * 2.25, 3.95, Z_BACK - 0.06))
        b.mesh(S.at(trimesh.creation.box(extents=[1.25, 0.1, 0.16]), k * 2.25, 3.9, Z_BACK - 0.08), m_oak)          # sills
    b.mesh(S.merge(wins), m_glow, emitter=E_area([5.0, 4.5, 3.6]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ the tiers
    people = []; chairs = []; desks = []
    skin = [np.array(rgb(c), np.float32) for c in S.SKIN]; hair = [np.array(rgb(c), np.float32) for c in S.HAIR]
    suits = [(0.07, 0.08, 0.13), (0.10, 0.10, 0.12), (0.16, 0.17, 0.20), (0.05, 0.06, 0.08), (0.2, 0.2, 0.23), (0.09, 0.12, 0.2), (0.28, 0.27, 0.26)]
    shirts = [(0.85, 0.85, 0.87), (0.9, 0.9, 0.9), (0.66, 0.78, 0.92), (0.88, 0.76, 0.8), (0.82, 0.86, 0.82)]
    ties = [None, '#7a1f2b', '#1f3f8c', '#2b2b2b', '#c8a24a', '#3d6b4a', '#b3b3b8']
    kip = ['#e8e1d2', '#2b3a6a', '#7a3d2a', '#c9a24a', '#3a5a4a']
    for k in range(NT):
        zf = Z0 + TD * k; hk = RISE * (k + 1)
        # riser + tier floor
        b.mesh(S.at(trimesh.creation.box(extents=[2 * XW - 0.4, hk, TD]), 0, hk / 2, zf + TD / 2), m_oak_v if False else m_oak)
        # the long desk and its front panel
        desks.append(S.at(S.rbox((2 * XW - 1.0, 0.05, 0.56), 0.012), 0, hk + 0.74, zf + 0.46))
        desks.append(S.at(trimesh.creation.box(extents=[2 * XW - 1.0, 0.42, 0.03]), 0, hk + 0.50, zf + 0.20))
        for sx in np.arange(-XW + 1.5, XW - 1.4, 1.56):
            desks.append(S.at(trimesh.creation.box(extents=[0.04, 0.7, 0.54]), sx, hk + 0.36, zf + 0.5))               # dividers
        # seats
        n_seat = int((2 * XW - 2.2) / 0.78)
        for i in range(n_seat):
            x = -XW + 1.3 + 0.78 * i + rng.uniform(-0.04, 0.04)
            zc = zf + 0.92
            chairs.append(S.at(S.rbox((0.5, 0.1, 0.5), 0.03), x, hk + 0.44, zc - 0.02))
            chairs.append(S.at(S.rbox((0.5, 0.66, 0.1), 0.04), x, hk + 0.86, zc + 0.24, rx=-5))
            if rng.rand() < 0.07: continue                                                                           # an empty seat
            fem = rng.rand() < 0.28
            sk = S.SKIN[rng.randint(len(S.SKIN))]; hr = S.HAIR[rng.randint(len(S.HAIR))]
            suit = suits[rng.randint(len(suits))]
            p, c = S.person('seated', 1.75 + rng.uniform(-0.07, 0.07), skin=sk, hair=hr, cloth=suit, shirt=shirts[rng.randint(len(shirts))], tie=None if fem else ties[rng.randint(len(ties))],
                            rng=rng, female=fem, hair_style=2 if fem else (rng.randint(2) if rng.rand() < 0.85 else -1), kippah=kip[rng.randint(len(kip))] if (not fem and rng.rand() < 0.12) else None,
                            arms='up' if rng.rand() < 0.04 else ('desk' if rng.rand() < 0.5 else 'down'), sub=2 if k < 2 else 1, cap=10 if k < 2 else 6, shoulder=0.44 if fem else 0.47)
            p = S.at(p, x, hk, zc, ry=0)
            people.append((p, c))
            # papers and a microphone on the desk in front of the member
            if rng.rand() < 0.6:
                desks.append(S.at(trimesh.creation.box(extents=[0.3, 0.006, 0.22]), x + rng.uniform(-0.12, 0.12), hk + 0.77, zf + 0.5, ry=rng.uniform(-25, 25)))
    b.mesh(S.merge(desks), m_oak)
    # chairs in groups (one shape each keeps the scene small)
    for g in range(0, len(chairs), 80):
        b.mesh(S.merge(chairs[g:g + 80]), m_chair)
    for g in range(0, len(people), 12):
        grp = people[g:g + 12]
        b.mesh(S.merge([p for p, _ in grp]), m_people, colors=np.vstack([c for _, c in grp]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ the lectern
    LZ = 2.7
    b.mesh(S.at(trimesh.creation.box(extents=[2.6, 0.16, 1.5]), 0, 0.08, LZ + 0.1), m_furn)
    b.mesh(S.at(S.rbox((1.5, 1.0, 0.75), 0.03), 0, 0.16 + 0.5, LZ + 0.15), m_furn)
    top = S.rbox((1.62, 0.06, 0.86), 0.02); b.mesh(S.at(top, 0, 1.2, LZ + 0.07, rx=-9), m_furn)
    b.mesh(S.at(S.rbox((1.2, 0.68, 0.05), 0.012), 0, 0.72, LZ - 0.25), m_furn)
    b.mesh(S.at(S.menorah(0.52), 0, 0.5, LZ - 0.29), m_gold, smooth=True, uv=None)
    mic = np.array([[0.30, 1.22, LZ + 0.05], [0.30, 1.36, LZ + 0.02], [0.28, 1.46, LZ - 0.08], [0.24, 1.52, LZ - 0.2], [0.19, 1.5, LZ - 0.27]])
    b.mesh(S.sweep_circle(mic, 0.008, 8), m_dark, smooth=True, uv=None)
    b.mesh(S.at(S.ellipsoid((0.025, 0.025, 0.05), sub=2), 0.18, 1.5, LZ - 0.3), m_dark, uv=None)
    # flags
    for side in (-1, 1):
        fx = side * 3.3; fz = 3.5
        b.mesh(S.at(S.cylinder_y(0.014, 2.7, seg=14), fx, 1.35, fz), m_gold)
        b.mesh(S.at(S.ellipsoid((0.03, 0.045, 0.03), sub=2), fx, 2.72, fz), m_gold)
        b.mesh(S.at(S.cylinder_y(0.15, 0.04, seg=30), fx, 0.02, fz), m_gold)
        fm, fuv = S.flag_cloth(1.45, 1.06, 56, 36, wave=0.06, waves=2.0, phase=0.9 * side, droop=0.15)
        if side > 0: fm.apply_scale([-1, 1, 1]); fm.invert()
        b.mesh(S.at(fm, fx + 0.015 * side, 2.4, fz - 0.02), m_flag, uv='given', uv_arr=fuv)
    # ------------------------------------------------------------------------------------------------------------------ light
    b.shape(L_rect((0.0, YC - 0.2, 0.5), (0.0, -1.0, 0.0), 12.0, 6.0, [0.5, 0.47, 0.42]), 'well')
    b.shape(L_rect((0.0, YC - 0.2, 8.5), (0.0, -1.0, 0.0), 20.0, 6.0, [0.9, 0.85, 0.75]), 'tiers')
    b.shape(L_rect((0.0, 3.4, -8.0), (0.0, -0.3, 1.0), 14.0, 5.0, [0.32, 0.30, 0.28]), 'fill')
    b.shape(L_spot((0.0, 6.8, Z_BACK - 3.0), (0.0, 3.2, Z_BACK - 0.2), [90.0, 70.0, 48.0], cutoff=26.0, beam=15.0), 'emblem')

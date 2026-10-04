# אולפן חדשות: a TV news studio. A glossy dark floor, a wall of LED panels, ring lights hanging in front of it, a lighting truss, the white anchor desk with its glowing base, two studio cameras.
# The animated parts (the equaliser bars on the panels and the scrolling news ticker) are drawn by the game on top of the picture; LIVE says where.
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, trimesh, cv2
from stagelib import *
import solids as S, texlib

NAME = 'studio'
H_CAM = 1.5
APERTURE = 0.03

ZW = 11.0                    # the LED wall
WALL_W, WALL_Y0, WALL_Y1 = 22.0, 0.55, 5.35
DESK_Z = 3.6

SLABS = [
    dict(name='desk', z0=1.6, z1=5.4, f=layer_f(3.6), scale=1.25, spp=96, order=4),
    dict(name='refl_desk', order=3, reflect=True, z0=1.6, z1=5.4, f=layer_f(3.6), scale=1.0, spp=64, zref=3.6, refl_a=0.55, refl_h=1.6, refl_blur=1.6),
    dict(name='floor', order=1, floor=True, z0=-4.6, z1=ZW - 0.05, f=1.0, width=floor_width(H_CAM), scale=1.25, spp=96, post_blur=(1.0, 0.6)),
    dict(name='refl_back', order=2, reflect=True, z0=5.4, z1=30.0, f=layer_f(9.5), scale=1.0, spp=64, zref=9.5, refl_a=0.42, refl_h=2.6, refl_blur=2.2, noycut=False),
    dict(name='back', order=0, z0=5.4, z1=30.0, f=layer_f(9.5), scale=1.1, spp=96, aperture=0.035, noycut=True),
]
QUALITY = dict(desk=84, refl_desk=70, floor=82, refl_back=70, back=82)
TONE = dict(exposure=1.0, sat=1.08, contrast=1.05, bloom_strength=0.14, bloom_thresh=1.2, sharp=0.35)

# the animated parts: rectangles in the picture of a layer (logical px of that picture), computed from world coordinates in build()
LIVE = {}

def _M(b, name, tex, tile, **kw): return b.B(name, M_tex(tex, tile, **kw))

def led_wall_image(wm, hm, ppm, panels, gap, seed):
    """the picture on the wall: panels with a vertical gradient, soft light blooms, faint scanlines, a bright thin frame; returns linear radiance"""
    w, h = int(wm * ppm), int(hm * ppm)
    rng = np.random.RandomState(seed)
    img = np.zeros((h, w, 3), np.float32)
    pw = w / panels; g = int(gap * ppm)
    yy = np.linspace(0, 1, h)[:, None]
    top = np.array(lin('#0a1458'), np.float32); mid = np.array(lin('#2a1a7a'), np.float32); bot = np.array(lin('#5a1a8a'), np.float32)
    grad = np.where(yy[..., None] < 0.55, top + (mid - top) * (yy[..., None] / 0.55), mid + (bot - mid) * ((yy[..., None] - 0.55) / 0.45))
    for i in range(panels):
        x0 = int(i * pw) + g // 2; x1 = int((i + 1) * pw) - g // 2
        hue = np.array([0.8 + 0.4 * math.sin(i * 0.9), 0.8, 1.2 + 0.4 * math.cos(i * 0.7)], np.float32)
        panel = grad * hue[None, None, :] * 3.2
        # a soft bloom in the middle of each panel
        xs = np.linspace(-1, 1, x1 - x0)[None, :]; ys = np.linspace(-1, 1, h)[:, None]
        panel = panel * (1.0 + 0.9 * np.exp(-(xs ** 2 * 2.0 + (ys + 0.3) ** 2 * 1.2)))[..., None]
        img[:, x0:x1] = panel[:, :x1 - x0]
        # bright thin frame
        fr = np.zeros((h, x1 - x0), bool); t = max(2, int(0.012 * ppm))
        fr[:t] = True; fr[-t:] = True; fr[:, :t] = True; fr[:, -t:] = True
        img[:, x0:x1][fr] = np.array([0.5, 1.2, 2.4], np.float32) * 1.1
    scan = 1.0 - 0.10 * ((np.arange(h) % 6) < 2)[:, None, None]
    return (img * scan).astype(np.float32)

def torus_ring(R, r, center, seg=64, tube=14):
    ang = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    path = np.array([[center[0] + R * math.cos(a), center[1] + R * math.sin(a), center[2]] for a in ang] + [[center[0] + R, center[1], center[2]]])
    return S.sweep_circle(path, r, tube)

def build(b, q):
    rng = np.random.RandomState(5)
    pp = q.get('ppm_mul', 1.0)
    # ------------------------------------------------------------------------------------------------------------------ materials
    floor_tex = (np.full((8, 8, 3), lin('#090c16'), np.float32), np.full((8, 8), 0.28, np.float32), np.full((8, 8), 0.5, np.float32))
    spk = texlib.snoise(512, 512, 0.6, 3)
    floor_tex = (np.full((512, 512, 3), lin('#222a4a'), np.float32), np.full((512, 512), q.get('floor_rough', 0.5), np.float32), np.full((512, 512), 0.5, np.float32))
    m_floor = _M(b, 'floor', floor_tex, 3.0, spec=0.9, cc=0.0)
    m_white = b.B('white', B_principled('#f1f3f8', 0.12, clearcoat=0.8, cc_rough=0.04, spec=0.6, twosided=True))
    m_black = b.B('black', B_principled('#0b0c10', 0.45, twosided=True))
    m_metal = b.B('metal', B_principled('#6d727c', 0.3, metallic=1.0, twosided=True))
    m_grey = b.B('grey', B_principled('#2a2d36', 0.5, twosided=True))
    m_truss = b.B('truss', B_principled('#15171c', 0.45, metallic=0.6, twosided=True))
    m_glow = b.B('glow', B_black())
    m_wallframe = b.B('wallframe', B_principled('#06070c', 0.6, twosided=True))
    # ------------------------------------------------------------------------------------------------------------------ the room
    XW, YC = 16.0, 7.0
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 30]), 0, -0.1, -2), m_floor)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, 0.2, 30]), 0, YC + 0.1, -2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 30]), -XW, YC / 2, -2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[0.2, YC, 30]), XW, YC / 2, -2), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.2]), 0, YC / 2, -14), m_black)
    b.mesh(S.at(trimesh.creation.box(extents=[2 * XW, YC, 0.4]), 0, YC / 2, ZW + 0.5), m_wallframe)                                  # the dark wall behind the LED panels
    # the LED wall: one quad with the picture of all panels, an emitter
    ppm_wall = int(110 * pp)
    img = led_wall_image(WALL_W, WALL_Y1 - WALL_Y0, ppm_wall, 9, 0.14, 4)
    quad_pts = np.array([[-WALL_W / 2, WALL_Y0, ZW], [WALL_W / 2, WALL_Y0, ZW], [WALL_W / 2, WALL_Y1, ZW], [-WALL_W / 2, WALL_Y1, ZW]], np.float32)
    quad = trimesh.Trimesh(quad_pts, np.array([[0, 2, 1], [0, 3, 2]]), process=False)
    em = {'type': 'area', 'radiance': {'type': 'bitmap', 'bitmap': mi.Bitmap(np.ascontiguousarray(img[::-1], np.float32)), 'raw': True, 'filter_type': 'bilinear'}}
    b.mesh(quad, m_glow, emitter=em, uv='given', uv_arr=np.array([[0, 0], [1, 0], [1, 1], [0, 1]], np.float32))
    # the ticker strip below the panels (dark red; the moving text is drawn by the game)
    tk_y0, tk_y1 = 0.62, 1.12
    tk = trimesh.Trimesh(np.array([[-WALL_W / 2 + 0.3, tk_y0, ZW - 0.02], [WALL_W / 2 - 0.3, tk_y0, ZW - 0.02], [WALL_W / 2 - 0.3, tk_y1, ZW - 0.02], [-WALL_W / 2 + 0.3, tk_y1, ZW - 0.02]], np.float32), np.array([[0, 2, 1], [0, 3, 2]]), process=False)
    b.mesh(tk, m_glow, emitter=E_area([1.4, 0.07, 0.10]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ truss with lamps, ring lights
    whites = []
    for z_t in (ZW - 1.0, 7.5):
        for yy in (5.5,):
            b.mesh(S.at(trimesh.creation.box(extents=[2 * 13, 0.12, 0.12]), 0, yy + 0.25, z_t), m_truss)
            b.mesh(S.at(trimesh.creation.box(extents=[2 * 13, 0.12, 0.12]), 0, yy - 0.25, z_t), m_truss)
            for xx in np.arange(-13, 13.01, 0.6):
                b.mesh(S.at(S.capsule_between((xx, yy - 0.25, z_t), (xx + 0.3, yy + 0.25, z_t), 0.025, 6), 0, 0, 0), m_truss, uv=None)
    for xx in np.arange(-12, 12.1, 2.0):                                                      # spotlights on the front truss
        b.mesh(S.at(S.cylinder_y(0.11, 0.3, seg=18), xx, 5.0, 7.5), m_grey)
        whites.append(S.at(S.cylinder_y(0.085, 0.02, seg=18), xx, 4.84, 7.5))
    for xx in np.arange(-13, 13.1, 1.2):                                                      # the row of lamps under the wall truss
        b.mesh(S.at(trimesh.creation.box(extents=[0.34, 0.1, 0.12]), xx, 5.1, ZW - 1.0), m_grey)
        whites.append(S.at(trimesh.creation.box(extents=[0.30, 0.012, 0.09]), xx, 5.04, ZW - 1.0))
    for xx in (-10.0, -6.0, -2.0, 2.0, 6.0, 10.0):                                            # ring lights on wires
        ring = torus_ring(0.55, 0.03, (xx, 3.15, ZW - 2.4))
        whites.append(ring)
        b.mesh(S.sweep_circle(np.array([[xx, 5.4, ZW - 2.4], [xx, 3.7, ZW - 2.4]]), 0.006, 6), m_black, uv=None)
        b.mesh(S.sweep_circle(np.array([[xx - 0.55, 3.15, ZW - 2.4], [xx - 0.2, 3.15 + 0.0, ZW - 2.4]]), 0.0, 3), m_black, uv=None) if False else None
    b.mesh(S.merge(whites), m_glow, emitter=E_area([26.0, 28.0, 32.0]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ the anchor desk
    dz = DESK_Z
    from shapely.geometry import Point, box as sbox
    body_poly = sbox(-2.4, -0.62, 2.4, 0.62).buffer(0.0)
    body = trimesh.creation.extrude_polygon(sbox(-2.15, -0.5, 2.15, 0.5).buffer(0.35, resolution=18), 0.72)       # a rounded body, extruded up
    body.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))                       # extrusion axis z -> y (up)
    body.apply_translation([0, 0, dz])
    b.mesh(body, m_white, smooth=False)
    top = trimesh.creation.extrude_polygon(sbox(-2.15, -0.5, 2.15, 0.5).buffer(0.39, resolution=18), 0.05)
    top.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0])); top.apply_translation([0, 0.72, dz])
    b.mesh(top, m_white)
    # the glowing base: a thin emissive band round the foot
    strip = trimesh.creation.extrude_polygon(sbox(-2.15, -0.5, 2.15, 0.5).buffer(0.352, resolution=18).difference(sbox(-2.15, -0.5, 2.15, 0.5).buffer(0.34, resolution=18)), 0.09)
    strip.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0])); strip.apply_translation([0, 0.14, dz])
    sx_min, sx_max = -2.55, 2.55
    cols = np.zeros((len(strip.vertices), 3), np.float32)
    t = np.clip((strip.vertices[:, 0] - sx_min) / (sx_max - sx_min), 0, 1)
    c0, c1, c2 = np.array(lin('#2f6fe4')), np.array(lin('#7a5cff')), np.array(lin('#e2323f'))
    cols = np.where(t[:, None] < 0.5, c0 + (c1 - c0) * (t[:, None] / 0.5), c1 + (c2 - c1) * ((t[:, None] - 0.5) / 0.5)).astype(np.float32) * 3.0
    b.mesh(strip, {'type': 'diffuse', 'reflectance': lin_rgb([0, 0, 0])}, emitter={'type': 'area', 'radiance': {'type': 'mesh_attribute', 'name': 'vertex_color'}}, colors=cols, uv=None)
    # two monitors and some desk furniture
    scr = []
    for mx in (-1.55, 1.55):
        b.mesh(S.at(S.rbox((0.8, 0.5, 0.05), 0.012), mx, 1.06, dz + 0.1, ry=0), m_black)
        b.mesh(S.at(trimesh.creation.box(extents=[0.08, 0.3, 0.08]), mx, 0.9, dz + 0.16), m_black)
        scr.append(S.at(trimesh.creation.box(extents=[0.72, 0.42, 0.004]), mx, 1.06, dz + 0.074))
    b.mesh(S.merge(scr), m_glow, emitter=E_area([0.25, 0.55, 1.2]), uv=None)
    for mx in (-0.45, 0.45):
        b.mesh(S.sweep_circle(np.array([[mx, 0.77, dz - 0.1], [mx, 0.95, dz - 0.18], [mx + 0.03, 1.05, dz - 0.3]]), 0.007, 8), m_black, smooth=True, uv=None)
        b.mesh(S.at(S.ellipsoid((0.025, 0.025, 0.05), sub=2), mx + 0.03, 1.05, dz - 0.33), m_black, uv=None)
    # ------------------------------------------------------------------------------------------------------------------ two studio cameras
    tally = []
    for side in (-1, 1):
        cx_, cz_ = side * 6.0, 2.6
        b.mesh(S.at(S.cylinder_y(0.07, 0.9, seg=16), cx_, 0.65, cz_), m_metal)
        for k in range(3):
            a = k * 2 * math.pi / 3 + 0.5
            b.mesh(S.capsule_between((cx_, 0.25, cz_), (cx_ + 0.45 * math.cos(a), 0.03, cz_ + 0.45 * math.sin(a)), 0.02, 6), m_metal, uv=None)
        b.mesh(S.at(S.rbox((0.45, 0.4, 0.8), 0.04), cx_, 1.3, cz_, ry=side * 20), m_grey)
        b.mesh(S.at(S.cylinder_y(0.1, 0.38, seg=22), cx_ - side * 0.0, 1.32, cz_ - 0.55, rx=90, ry=side * 20), m_black)
        b.mesh(S.at(S.rbox((0.3, 0.2, 0.25), 0.02), cx_, 1.62, cz_ + 0.05), m_black)
        tally.append(S.at(S.ellipsoid((0.018, 0.018, 0.018), sub=1), cx_ - side * 0.2, 1.55, cz_ - 0.38))
    b.mesh(S.merge(tally), m_glow, emitter=E_area([60.0, 1.5, 2.0]), uv=None)
    # ------------------------------------------------------------------------------------------------------------------ light: the wall and the rings do most of it; a soft white key over the desk, a cool fill from the camera side
    b.shape(L_rect((0.0, 6.2, DESK_Z - 0.5), (0.0, -1.0, 0.0), 7.0, 2.4, [3.0, 3.0, 3.3]), 'key')
    b.shape(L_rect((0.0, 3.4, -8.0), (0.0, -0.3, 1.0), 14.0, 5.0, [1.0, 1.1, 1.5]), 'fill')
    # where the animated things go, in the picture of the 'back' layer (logical px) and as a share of the wall width
    f_back = layer_f(9.5)
    # the panels' equaliser area: lower third of every panel; the ticker strip
    u0, v0 = project(-WALL_W / 2 + 0.3, tk_y1, ZW, layer_width(f_back), H_CAM)
    u1, v1 = project(WALL_W / 2 - 0.3, tk_y0, ZW, layer_width(f_back), H_CAM)
    LIVE.clear()
    LIVE.update({'layer': 'back', 'ticker': [round(u0, 1), round(v0, 1), round(u1, 1), round(v1, 1)], 'panels': 9})
    pu0, pv0 = project(-WALL_W / 2, WALL_Y1, ZW, layer_width(f_back), H_CAM); pu1, pv1 = project(WALL_W / 2, 1.3, ZW, layer_width(f_back), H_CAM)
    LIVE['wall'] = [round(pu0, 1), round(pv0, 1), round(pu1, 1), round(pv1, 1)]

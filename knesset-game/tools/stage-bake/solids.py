# Procedural objects for the arena scenes: rounded solids, cloth, books, people, chairs, lamps ... (trimesh meshes, metres).
import math
import numpy as np
import trimesh

def _tm(V, F): return trimesh.Trimesh(np.asarray(V, np.float64), np.asarray(F, np.int64), process=False)

def merge(ms):
    ms = [m for m in ms if m is not None and len(m.faces)]
    return trimesh.util.concatenate(ms) if ms else None

def at(m, x=0.0, y=0.0, z=0.0, rx=0.0, ry=0.0, rz=0.0, s=None):
    """copy of m, scaled, rotated (degrees; applied in x, y, z order) and moved"""
    m = m.copy()
    if s is not None: m.apply_scale(s)
    R = trimesh.transformations
    if rx: m.apply_transform(R.rotation_matrix(math.radians(rx), [1, 0, 0]))
    if ry: m.apply_transform(R.rotation_matrix(math.radians(ry), [0, 1, 0]))
    if rz: m.apply_transform(R.rotation_matrix(math.radians(rz), [0, 0, 1]))
    m.apply_translation([x, y, z]); return m

def superq(size, e1=0.3, e2=0.3, seg=40, center=(0, 0, 0)):
    """a superellipsoid of the given full extents (sx, sy, sz): e = 1 an ellipsoid, e -> 0 a box with rounded edges; y is up"""
    sx, sy, sz = [v / 2.0 for v in size]
    u = np.linspace(-math.pi / 2, math.pi / 2, seg + 1); v = np.linspace(-math.pi, math.pi, 2 * seg + 1)
    uu, vv = np.meshgrid(u, v, indexing='ij')
    def sp(a, e): return np.sign(a) * np.abs(a) ** e
    x = sx * sp(np.cos(uu), e1) * sp(np.cos(vv), e2)
    z = sz * sp(np.cos(uu), e1) * sp(np.sin(vv), e2)
    y = sy * sp(np.sin(uu), e1)
    V = np.stack([x, y, z], -1).reshape(-1, 3)
    nu, nv = uu.shape
    F = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            a = i * nv + j; b = a + 1; c = a + nv + 1; d = a + nv
            F += [[a, d, c], [a, c, b]]
    m = _tm(V, F); m.merge_vertices(); m.remove_degenerate_faces() if hasattr(m, 'remove_degenerate_faces') else None
    m.fix_normals(); m.apply_translation(center); return m

def rbox(size, rad=0.02, center=(0, 0, 0), seg=14):
    """a box with rounded edges (radius rad)"""
    e = float(np.clip(rad / (min(size) / 2.0 + 1e-9) * 1.4, 0.04, 1.0))
    return superq(size, e, e, seg, center)

def ellipsoid(r, center=(0, 0, 0), sub=3):
    m = trimesh.creation.icosphere(subdivisions=sub, radius=1.0)
    m.vertices = m.vertices * np.asarray(r if hasattr(r, '__len__') else (r, r, r)); m.apply_translation(center); return m

def cylinder_y(r, h, center=(0, 0, 0), seg=40, r2=None, cap=True):
    """a vertical cylinder / cone frustum, bottom at y = center.y - h/2"""
    r2 = r if r2 is None else r2
    ang = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    V = [[r * math.cos(a), -h / 2, r * math.sin(a)] for a in ang] + [[r2 * math.cos(a), h / 2, r2 * math.sin(a)] for a in ang]
    F = []
    for i in range(seg):
        j = (i + 1) % seg
        F += [[i, j, seg + j], [i, seg + j, seg + i]]
    if cap:
        V += [[0, -h / 2, 0], [0, h / 2, 0]]
        for i in range(seg):
            j = (i + 1) % seg
            F += [[2 * seg, j, i], [2 * seg + 1, seg + i, seg + j]]
    m = _tm(V, F); m.fix_normals(); m.apply_translation(center); return m

def lathe_y(profile, seg=48, center=(0, 0, 0), close=True):
    """surface of revolution about the y axis: profile = [(radius, y), ...] from bottom to top"""
    prof = np.asarray(profile, np.float64); n = len(prof)
    ang = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    V = np.array([[r * math.cos(a), y, r * math.sin(a)] for (r, y) in prof for a in ang])
    F = []
    for i in range(n - 1):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg; c = (i + 1) * seg + (j + 1) % seg; d = (i + 1) * seg + j
            F += [[a, b, c], [a, c, d]]
    m = _tm(V, F)
    if close:
        for (ri, yi, idx0) in ((prof[0][0], prof[0][1], 0), (prof[-1][0], prof[-1][1], (n - 1) * seg)):
            if ri > 1e-6:
                c = len(m.vertices); m.vertices = np.vstack([m.vertices, [0, yi, 0]])
                fs = [[c, idx0 + (j + 1) % seg, idx0 + j] for j in range(seg)]
                m.faces = np.vstack([m.faces, fs])
    m.merge_vertices(); m.fix_normals(); m.apply_translation(center); return m

def sweep_circle(path, r, seg=14, closed=False):
    """a round pipe along a polyline (smooth joints)"""
    path = np.asarray(path, np.float64); n = len(path)
    T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    up = np.array([0, 1.0, 0]); Vs = []
    for i in range(n):
        t = T[i]; a = np.cross(t, up)
        if np.linalg.norm(a) < 1e-4: a = np.cross(t, np.array([1.0, 0, 0]))
        a /= np.linalg.norm(a); b = np.cross(t, a)
        rr = r[i] if hasattr(r, '__len__') else r
        for k in range(seg):
            ang = 2 * math.pi * k / seg; Vs.append(path[i] + rr * (math.cos(ang) * a + math.sin(ang) * b))
    F = []
    for i in range(n - 1):
        for k in range(seg):
            a_ = i * seg + k; b_ = i * seg + (k + 1) % seg; c_ = (i + 1) * seg + (k + 1) % seg; d_ = (i + 1) * seg + k
            F += [[a_, b_, c_], [a_, c_, d_]]
    m = _tm(Vs, F); m.fix_normals(); return m

def grid_surface(P, flip=False):
    """P (ny, nx, 3) points -> triangle mesh; also returns UV in 0..1"""
    ny, nx, _ = P.shape
    V = P.reshape(-1, 3); F = []
    for i in range(ny - 1):
        for j in range(nx - 1):
            a = i * nx + j; b = a + 1; c = a + nx + 1; d = a + nx
            F += [[a, b, c], [a, c, d]] if not flip else [[a, c, b], [a, d, c]]
    u = np.tile(np.linspace(0, 1, nx), ny); v = np.repeat(np.linspace(0, 1, ny), nx)
    return _tm(V, F), np.stack([u, v], -1)

def flag_cloth(w, h, nx=48, ny=32, wave=0.07, waves=2.3, phase=0.0, droop=0.0, sway=0.0):
    """a flag of w x h metres hanging from a vertical pole at x = 0 (the pole side), its face towards -z; the free edge waves; returns (mesh, uv per vertex)"""
    xs = np.linspace(0, w, nx); ys = np.linspace(h, 0, ny)
    X, Y = np.meshgrid(xs, ys)
    k = X / w
    Z = wave * np.sin(k * waves * 2 * math.pi + phase) * (0.15 + 0.85 * k) + wave * 0.25 * np.sin(Y / h * 5 + k * 3 + phase) * k
    Yy = Y - droop * k ** 2 * h * 0.3
    Xx = X * (1 - 0.03 * np.abs(Z) / (wave + 1e-6) * k)
    m, uv = grid_surface(np.stack([Xx + sway * Y * 0, Yy, Z], -1), flip=True)
    return m, uv

def curtain(w, h, pleats=9, depth=0.09, nx=160, ny=8, sway=0.0, seed=0):
    """a pleated curtain hanging from y = h to y = 0, hanging in the plane z = 0 (face to -z)"""
    rng = np.random.RandomState(seed)
    xs = np.linspace(0, w, nx); ys = np.linspace(h, 0, ny)
    X, Y = np.meshgrid(xs, ys)
    Z = depth * (np.sin(X / w * pleats * 2 * math.pi) * (0.7 + 0.3 * np.sin(X * 1.7 + 1.0)) + 0.2 * np.sin(X / w * pleats * 6 * math.pi + 0.7)) * (0.55 + 0.45 * (1 - Y / h))
    m, uv = grid_surface(np.stack([X, Y, Z], -1), flip=True)
    return m, uv

def books(width, height, depth, rng, palette, hmin=0.7, gap=0.0, lean=0.0, max_n=400):
    """a row of books standing on y = 0 starting at x = 0 (spines towards -z, z in 0..depth) -> (mesh, vertex colours (linear))"""
    ms = []; cols = []; x = 0.0
    while x < width and len(ms) < max_n:
        bw = rng.uniform(0.018, 0.05); bh = height * rng.uniform(hmin, 1.0); bd = depth * rng.uniform(0.75, 1.0)
        if x + bw > width: break
        m = trimesh.creation.box(extents=[bw * 0.96, bh, bd]); m.apply_translation([x + bw / 2, bh / 2, bd / 2])
        if lean and rng.rand() < lean:
            ang = math.radians(rng.uniform(-14, 14)); m.apply_transform(trimesh.transformations.rotation_matrix(ang, [0, 0, 1], [x + bw / 2, 0, 0]))
        c = palette[rng.randint(len(palette))] * rng.uniform(0.75, 1.15)
        ms.append(m); cols.append(np.tile(np.asarray(c, np.float32), (len(m.vertices), 1)))
        # a gold band on some spines
        if rng.rand() < 0.45:
            for yb in (bh * 0.82, bh * 0.14):
                g = trimesh.creation.box(extents=[bw * 0.98, 0.006, 0.004]); g.apply_translation([x + bw / 2, yb, -0.001])
                ms.append(g); cols.append(np.tile(np.array([0.62, 0.45, 0.12], np.float32), (len(g.vertices), 1)))
        x += bw + gap
    return merge(ms), np.vstack(cols)

# ----------------------------------------------------------------------------------------------------------------------------- people (simple, soft figures for crowds and benches)
SKIN = ['#e8bd98', '#d9a47a', '#c78e63', '#b57a52', '#d9a47a', '#c78e63', '#e8bd98', '#9a6540', '#6a4129']
HAIR = ['#14100d', '#251a12', '#3a2a1c', '#5a4126', '#8a6a3a', '#b9b3a8', '#d8d2c6', '#6d2f1c']

def person(kind='seated', height=1.75, skin='#e3b48c', hair='#251a12', cloth='#1a2236', shirt='#e6e6ea', tie=None, rng=None, face=0.0, hair_style=0, shoulder=0.46, arms='down', female=False, kippah=None, scale=1.0, sub=2, cap=10):
    """a soft-shaped human figure (ellipsoids and capsules) -> (mesh, vertex colours (linear)); standing: feet at y = 0; seated: the seat is at y = 0.45 and the figure's hip there; faces -z.
    arms: 'down' | 'up' (raised, cheering) | 'desk' (forward, on a desk)"""
    from stagelib import rgb as _rgb
    rng = rng or np.random.RandomState(0)
    parts = []   # (mesh, colour)
    def add(m, c): parts.append((m, np.asarray(_rgb(c) if isinstance(c, str) else c, np.float32)))
    H = height * scale
    seated = (kind == 'seated')
    hip_y = 0.45 * scale if seated else H * 0.52
    torso_h = H * 0.31; sh_y = hip_y + torso_h
    sw = shoulder * scale * (0.92 if female else 1.0)
    # torso: a tapered superellipsoid
    add(at(superq((sw * 0.82, torso_h * 1.05, 0.26 * scale * (0.95 if female else 1.05)), 0.7, 0.8, 18), 0, hip_y + torso_h * 0.5, 0), cloth)
    add(at(superq((sw * 1.04, 0.13 * scale, 0.22 * scale), 0.7, 0.9, 14), 0, sh_y - 0.02, 0), cloth)           # shoulders
    if shirt is not None: add(at(superq((0.1 * scale, 0.2 * scale, 0.04), 0.8, 0.8, 10), 0, sh_y - 0.1 * scale, -0.115 * scale), shirt)     # the shirt in the jacket opening
    if tie: add(at(superq((0.035 * scale, 0.2 * scale, 0.025), 0.6, 0.6, 8), 0, sh_y - 0.17 * scale, -0.13 * scale), tie)
    # neck + head
    add(at(cylinder_y(0.052 * scale, 0.1 * scale, seg=12), 0, sh_y + 0.06 * scale, 0), skin)
    hr = 0.105 * scale * (1 + face * 0.1)
    head_y = sh_y + 0.07 * scale + 0.12 * scale
    add(at(ellipsoid((hr * 0.88, hr * 1.2, hr * 1.0), sub=sub), 0, head_y, 0), skin)
    # a few facial features, so that the head reads as a face from a distance: brows, eyes, nose, mouth
    if sub >= 1:
        sk_rgb = np.asarray(_rgb(skin) if isinstance(skin, str) else skin, np.float32)
        dark = sk_rgb * 0.45
        add(at(ellipsoid((hr * 0.50, hr * 0.07, hr * 0.12), sub=1), 0, head_y + hr * 0.30, -hr * 0.93), dark * 0.8)
        for sx in (-1, 1):
            add(at(ellipsoid((hr * 0.12, hr * 0.07, hr * 0.07), sub=1), sx * hr * 0.30, head_y + hr * 0.10, -hr * 0.93), (0.025, 0.02, 0.02))
        add(at(ellipsoid((hr * 0.09, hr * 0.25, hr * 0.14), sub=1), 0, head_y - hr * 0.12, -hr * 1.0), sk_rgb * 0.88)
        add(at(ellipsoid((hr * 0.26, hr * 0.045, hr * 0.07), sub=1), 0, head_y - hr * 0.50, -hr * 0.9), np.array([0.35, 0.12, 0.10], np.float32) * (0.6 + 0.4 * sk_rgb.mean() / 0.5))
    if kippah:
        add(at(ellipsoid((hr * 0.62, hr * 0.34, hr * 0.62), sub=sub), 0, head_y + hr * 0.95, 0.0), kippah)
    elif hair_style >= 0:
        hc = hair
        if hair_style == 0:   add(at(ellipsoid((hr * 0.93, hr * 0.75, hr * 1.04), sub=sub), 0, head_y + hr * 0.38, hr * 0.12), hc)
        elif hair_style == 1: add(at(ellipsoid((hr * 0.92, hr * 0.55, hr * 1.0), sub=sub), 0, head_y + hr * 0.62, hr * 0.06), hc)
        elif hair_style == 2:
            add(at(ellipsoid((hr * 0.95, hr * 0.85, hr * 1.1), sub=sub), 0, head_y + hr * 0.2, hr * 0.15), hc)
            add(at(ellipsoid((hr * 1.0, hr * 1.5, hr * 0.5), sub=sub), 0, head_y - hr * 0.55, hr * 0.55), hc)    # long hair at the back
    # legs / lap
    if seated:
        for sx in (-1, 1):
            add(at(capsule_between((sx * 0.1 * scale, hip_y, 0.0), (sx * 0.11 * scale, hip_y + 0.0, -0.42 * scale), 0.085 * scale, cap), 0, 0, 0), cloth)
            add(at(capsule_between((sx * 0.11 * scale, hip_y, -0.42 * scale), (sx * 0.11 * scale, 0.05 * scale, -0.46 * scale), 0.07 * scale, cap), 0, 0, 0), cloth)
    else:
        for sx in (-1, 1):
            add(capsule_between((sx * 0.1 * scale, hip_y, 0), (sx * 0.1 * scale, 0.06 * scale, 0), 0.085 * scale), cloth)
            add(at(superq((0.1 * scale, 0.07 * scale, 0.26 * scale), 0.5, 0.5, 8), sx * 0.1 * scale, 0.035 * scale, -0.06 * scale), '#0c0a09')
    # arms
    for sx in (-1, 1):
        sh = (sx * sw * 0.52, sh_y - 0.04 * scale, 0.0)
        if arms == 'up':
            el = (sx * sw * 0.75, sh_y + 0.14 * scale, -0.05 * scale); hd = (sx * sw * 0.85, sh_y + 0.42 * scale, -0.04 * scale)
        elif arms == 'desk':
            el = (sx * sw * 0.62, sh_y - 0.3 * scale, -0.04 * scale); hd = (sx * sw * 0.40, sh_y - 0.38 * scale, -0.36 * scale)
        else:
            el = (sx * sw * 0.58, sh_y - 0.3 * scale, 0.0); hd = (sx * sw * 0.55, sh_y - 0.56 * scale, -0.04 * scale)
        add(capsule_between(sh, el, 0.05 * scale, cap), cloth); add(capsule_between(el, hd, 0.042 * scale, cap), cloth)
        add(at(ellipsoid((0.04 * scale, 0.05 * scale, 0.035 * scale), sub=1), *hd), skin)
    ms = []; cs = []
    for m, c in parts:
        ms.append(m); cs.append(np.tile(c, (len(m.vertices), 1)))
    return merge(ms), np.vstack(cs)

def capsule_between(a, b, r, seg=10):
    a = np.asarray(a, np.float64); b = np.asarray(b, np.float64)
    d = b - a; L = float(np.linalg.norm(d))
    if L < 1e-6: return ellipsoid((r, r, r), a, 1)
    m = trimesh.creation.capsule(radius=r, height=L, count=[seg, seg])
    m.apply_translation([0, 0, -L / 2.0])
    z = np.array([0, 0, 1.0]); dn = d / L; ax = np.cross(z, dn); s = np.linalg.norm(ax)
    if s > 1e-8: m.apply_transform(trimesh.transformations.rotation_matrix(math.atan2(s, float(np.dot(z, dn))), ax / s))
    elif np.dot(z, dn) < 0: m.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    m.apply_translation((a + b) / 2.0); return m

def chair_office(color_seat=(0.4, 0.05, 0.08)):
    """returns a list of (mesh, kind) with kind in leather / metal / dark; a high-backed executive chair facing -z, seat at y = 0.48"""
    parts = []
    parts.append((at(rbox((0.58, 0.14, 0.58), 0.05), 0, 0.50, 0), 'leather'))
    back = at(rbox((0.56, 0.78, 0.13), 0.05), 0, 0.97, 0.30, rx=-6)
    parts.append((back, 'leather'))
    for sx in (-1, 1):
        parts.append((at(rbox((0.07, 0.07, 0.5), 0.025), sx * 0.31, 0.74, 0.02), 'leather'))
        parts.append((at(rbox((0.05, 0.28, 0.06), 0.02), sx * 0.31, 0.60, 0.22), 'metal'))
    parts.append((cylinder_y(0.035, 0.28, (0, 0.30, 0.0), 16), 'metal'))
    for k in range(5):
        a = k * 2 * math.pi / 5
        parts.append((capsule_between((0, 0.14, 0), (0.30 * math.cos(a), 0.10, 0.30 * math.sin(a)), 0.02), 'metal'))
        parts.append((at(ellipsoid((0.035, 0.035, 0.035), sub=1), 0.31 * math.cos(a), 0.05, 0.31 * math.sin(a)), 'dark'))
    return parts

# ----------------------------------------------------------------------------------------------------------------------------- the emblem of the hall
def menorah(h=2.0, arm_r=0.05, seg=14):
    """a seven-branch candelabrum standing on y = 0, symmetric about x = 0, flat in the plane z = 0 (round pipes, so it has depth); returns one mesh"""
    parts = []
    tube = 0.016 * h / 2.0 * (arm_r / 0.05)
    # foot and stem
    parts.append(lathe_y([(0.001, 0.0), (0.16 * h / 2, 0.0), (0.17 * h / 2, 0.02 * h / 2), (0.10 * h / 2, 0.06 * h / 2), (0.045 * h / 2, 0.10 * h / 2), (0.03 * h / 2, 0.14 * h / 2)], 36))
    stem_top = h * 0.88
    parts.append(cylinder_y(0.022 * h / 2, stem_top - 0.12 * h / 2, (0, (stem_top + 0.12 * h / 2) / 2, 0), 18))
    for yk in (0.30, 0.52, 0.72):
        parts.append(at(ellipsoid((0.045 * h / 2, 0.03 * h / 2, 0.045 * h / 2), sub=2), 0, yk * h, 0))
    # cups on the stem and the arms
    tops = [stem_top]
    for j, rj in enumerate((0.115, 0.235, 0.355)):
        r = rj * h / 2.0 * 1.0
        ys = stem_top - 0.07 * h - 0.0 - (0.16 - 0.055 * j) * h - r * 0.0
        ys = stem_top - r - 0.04 * h
        for s in (-1, 1):
            pts = []
            for k in range(0, 21):
                phi = math.pi * k / 20.0
                pts.append([s * r * (1 - math.cos(phi)), ys - r * math.sin(phi), 0.0])
            pts.append([s * 2 * r, stem_top, 0.0])
            parts.append(sweep_circle(np.array(pts), tube, seg))
            parts.append(at(cylinder_y(0.03 * h / 2, 0.035 * h / 2, seg=18, r2=0.022 * h / 2), s * 2 * r, stem_top + 0.012, 0))
    parts.append(at(cylinder_y(0.03 * h / 2, 0.035 * h / 2, seg=18, r2=0.022 * h / 2), 0, stem_top + 0.012, 0))
    for p in (0.0,):
        pass
    return merge(parts)

def olive_branch(length=1.6, leaves=16, curve=0.55, side=1, seed=0, leaf=0.085):
    """a curved branch with olive leaves in the plane z = 0, growing from (0, 0) upwards and curving to the side"""
    rng = np.random.RandomState(seed)
    pts = []
    for k in range(0, 41):
        t = k / 40.0; ang = curve * t * t * 1.4
        pts.append([side * (length * (1 - math.cos(ang)) / max(curve * 1.4, 1e-3) * 0.9 * t), length * t, 0.0])
    pts = np.array(pts); parts = [sweep_circle(pts, 0.011, 8)]
    for i in range(leaves):
        t = (i + 1) / (leaves + 1); k = int(t * 40)
        d = pts[min(k + 1, 40)] - pts[k]; ang = math.degrees(math.atan2(d[1], d[0]))
        for sgn in (-1, 1):
            lf = ellipsoid((leaf * 0.5, leaf * 0.14, leaf * 0.05), sub=1)
            lf = at(lf, leaf * 0.5, 0, 0)                                        # the leaf grows out of its stem point
            lf = at(lf, 0, 0, 0, rz=ang + sgn * (50 + rng.uniform(-8, 8)))
            parts.append(at(lf, pts[k][0], pts[k][1], 0.0))
    return merge(parts)

def arch_panel(w, h, thick=0.04, seg=24):
    """a window with a round top (w wide, h high including the arch), bottom edge at y = 0, centred on x = 0, facing -z"""
    from shapely.geometry import Polygon
    r = w / 2.0; pts = [(-r, 0.0), (r, 0.0), (r, h - r)]
    for k in range(1, seg):
        a = math.pi * k / seg; pts.append((r * math.cos(a), h - r + r * math.sin(a)))
    pts += [(-r, h - r)]
    m = trimesh.creation.extrude_polygon(Polygon(pts), thick)
    m.apply_translation([0, 0, -thick / 2]); return m

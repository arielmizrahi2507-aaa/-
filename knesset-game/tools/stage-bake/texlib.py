# Procedural, tileable material textures for the arena scenes (numpy only, no photographs, no image data of any kind comes in).
# Every generator returns (albedo (h, w, 3) linear rgb, roughness (h, w), height (h, w) in [0, 1]) for a tile of 'size_m' metres at 'ppm' pixels per metre.
# The textures are periodic, so the tile can repeat over a floor or a wall without a visible seam.
import math
import numpy as np, cv2

def s2l(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)

def hexrgb(c):
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)

def lin(c):
    """'#rrggbb' or an sRGB triple -> linear rgb array"""
    return s2l(hexrgb(c) if isinstance(c, str) else np.asarray(c, np.float32))

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1); return t * t * (3 - 2 * t)

def snoise(h, w, beta=2.0, seed=0, aniso=(1.0, 1.0)):
    """periodic field with a 1/f^beta spectrum, zero mean and unit deviation; aniso = (lx, ly): the relative length of the features along each axis (a large factor = long streaks along it)"""
    fx = np.fft.fftfreq(w)[None, :] * aniso[0]; fy = np.fft.fftfreq(h)[:, None] * aniso[1]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1.0
    amp = f ** (-beta / 2.0); amp[0, 0] = 0.0
    o = np.fft.ifft2(np.fft.fft2(np.random.RandomState(seed).randn(h, w)) * amp).real
    return ((o - o.mean()) / (o.std() + 1e-9)).astype(np.float32)

def fbm(h, w, seed=0, octaves=5, beta=2.0, aniso=(1.0, 1.0), gain=0.55):
    o = np.zeros((h, w), np.float32); a = 1.0; tot = 0.0
    for i in range(octaves):
        o += a * snoise(h, w, beta, seed * 31 + i, aniso); tot += a; a *= gain
    return o / tot

def palette(t, stops):
    """t (array, 0..1) -> linear rgb through [(pos, '#rrggbb'), ...] (interpolated in linear light)"""
    pos = np.array([p for p, _ in stops], np.float32); cols = np.array([lin(c) for _, c in stops], np.float32)
    t = np.clip(t, 0, 1); out = np.empty(t.shape + (3,), np.float32)
    for ch in range(3): out[..., ch] = np.interp(t, pos, cols[:, ch])
    return out

def to_normal(hgt, strength=2.0):
    gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5; gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
    n = np.dstack([-gx * strength, -gy * strength, np.ones_like(hgt)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return (n * 0.5 + 0.5).astype(np.float32)

def _dims(size_m, ppm):
    return int(round(size_m[1] * ppm)), int(round(size_m[0] * ppm))

# --------------------------------------------------------------------------------------------------------------------------------------- wood
def _wood_grain(u, v, vc, tilt, freq, warp, fibre, seed_phase, late=2.3):
    """flat-sawn board: growth rings cut at a shallow angle give the long arches ('cathedral'); u along the grain, v across, in board widths"""
    r = np.sqrt((v - vc) ** 2 + (tilt * u) ** 2)
    ph = r * freq + warp + seed_phase
    g = ph - np.floor(ph)
    return g ** late, fibre

def tex_planks(size_m=(2.4, 2.4), ppm=300, plank_w=0.16, plank_len=(0.9, 2.2), tone=('#6b3f1f', '#b98349'), seed=1, ring=9.0, joint_mm=1.6, tint_var=0.16, bevel=True, grain=1.0, rough=(0.38, 0.62), pores=0.5):
    """boards laid along x in staggered rows"""
    h, w = _dims(size_m, ppm); rng = np.random.RandomState(seed)
    rows = max(1, int(round(size_m[1] / plank_w))); rh = h / rows
    X = np.broadcast_to(np.arange(w, dtype=np.float32)[None, :], (h, w)); Y = np.broadcast_to(np.arange(h, dtype=np.float32)[:, None], (h, w))
    bid = np.zeros((h, w), np.int32); x0m = np.zeros((h, w), np.float32); lenm = np.zeros((h, w), np.float32); rowm = np.zeros((h, w), np.int32)
    boards = []
    for j in range(rows):
        lens = []; tot = 0.0
        while tot < w:
            l = rng.uniform(*plank_len) * ppm; lens.append(l); tot += l
        lens = np.array(lens) * (w / tot); start = rng.uniform(0, w)
        edges = np.concatenate([[0], np.cumsum(lens)]) + start
        ya, yb = int(round(j * rh)), int(round((j + 1) * rh))
        for k in range(len(lens)):
            xa, xb = edges[k], edges[k + 1]
            xs = (np.arange(int(math.floor(xa)), int(math.ceil(xb))) % w)
            idx = len(boards)
            bid[ya:yb, xs] = idx; x0m[ya:yb, xs] = xa % w if xa % w < xb % w or True else 0; lenm[ya:yb, xs] = xb - xa; rowm[ya:yb, xs] = j
            boards.append((xa, xb, ya, yb))
    nb = len(boards)
    xa = np.array([b[0] for b in boards], np.float32); ln = np.array([b[1] - b[0] for b in boards], np.float32); ya = np.array([b[2] for b in boards], np.float32)
    # per board parameters
    vc = rng.uniform(-1.5, 2.5, nb).astype(np.float32); tilt = rng.uniform(0.03, 0.16, nb).astype(np.float32) * rng.choice([-1, 1], nb)
    phase = rng.uniform(0, 1, nb).astype(np.float32); freq = ring * rng.uniform(0.7, 1.4, nb).astype(np.float32)
    tint = (1.0 + tint_var * rng.randn(nb)).astype(np.float32); hue = (rng.randn(nb, 3) * 0.025).astype(np.float32)
    ox = rng.randint(0, w, nb); oy = rng.randint(0, h, nb)
    # local coordinates (in board widths)
    ux = ((X - xa[bid] + w * 4) % w) / rh                     # along the board (the board never wraps over more than the tile)
    ux = np.where(ux * rh > ln[bid] + 1, ux - w / rh, ux)
    vy = (Y - ya[bid]) / rh
    warp_f = fbm(h, w, seed + 3, 4, 2.6, (8.0, 1.0)); fib_f = snoise(h, w, 0.9, seed + 4, (250.0, 1.0)); fine_f = snoise(h, w, 1.4, seed + 5, (50.0, 1.0))
    pore_f = snoise(h, w, 0.2, seed + 6, (33.0, 1.0))
    gy = (Y.astype(np.int32) + oy[bid]) % h; gx = (X.astype(np.int32) + ox[bid]) % w
    warp = warp_f[gy, gx] * 0.35; fib = fib_f[gy, gx]; fine = fine_f[gy, gx]; pr = pore_f[gy, gx]
    g, _ = _wood_grain(ux, vy, vc[bid], tilt[bid], freq[bid], warp, fib, phase[bid])
    t = 0.46 + 0.34 * grain * (g - 0.35) + 0.075 * grain * fib + 0.05 * fine
    pore = (pr > 1.55).astype(np.float32) * pores
    t = t - 0.16 * pore
    albedo = palette(t, [(0.0, tone[0]), (1.0, tone[1])]) * (tint[bid][..., None] * (1 + hue[bid]))
    # joints and bevels
    dx = np.minimum(ux * rh, ln[bid] - ux * rh); dy = np.minimum(vy * rh, rh - vy * rh); d = np.minimum(dx, dy)
    gw = max(0.9, joint_mm * 1e-3 * ppm)
    groove = np.exp(-(d / gw) ** 2)
    bev = np.clip(1 - d / (gw * 2.5), 0, 1) if bevel else 0 * d
    albedo = albedo * (1 - 0.70 * groove[..., None])
    hgt = 0.62 + 0.04 * (g - 0.5) * grain - 0.55 * groove - 0.12 * bev * (1 - groove) - 0.05 * pore
    rgh = rough[0] + (rough[1] - rough[0]) * (0.4 + 0.3 * fine + 0.3 * (g - 0.5)) + 0.35 * groove + 0.2 * pore
    return np.clip(albedo, 0, 4).astype(np.float32), np.clip(rgh, 0.05, 1).astype(np.float32), np.clip(hgt, 0, 1).astype(np.float32)

def tex_parquet(size_m=(2.4, 2.4), ppm=300, square=0.48, strips=4, tone=('#5a3416', '#a56f3b'), seed=2, ring=10.0, joint_mm=1.2, rough=(0.30, 0.50)):
    """basket-weave parquet: squares of parallel strips, the direction alternates like a chess board"""
    h, w = _dims(size_m, ppm); rng = np.random.RandomState(seed)
    n_sq_x = max(2, int(round(size_m[0] / square))); n_sq_y = max(2, int(round(size_m[1] / square)))
    n_sq_x += n_sq_x % 2; n_sq_y += n_sq_y % 2
    sw = w / n_sq_x; sh = h / n_sq_y
    X = np.broadcast_to(np.arange(w, dtype=np.float32)[None, :], (h, w)); Y = np.broadcast_to(np.arange(h, dtype=np.float32)[:, None], (h, w))
    qi = np.floor(X / sw).astype(np.int32); qj = np.floor(Y / sh).astype(np.int32)
    horiz = ((qi + qj) % 2 == 0)                                    # strips run along x in this square
    lx = X - qi * sw; ly = Y - qj * sh
    along = np.where(horiz, lx, ly); across = np.where(horiz, ly, lx)
    lenp = np.where(horiz, sw, sh); wid = np.where(horiz, sh, sw) / strips
    si = np.floor(across / wid).astype(np.int32)                    # strip number inside the square
    sid = (qj * n_sq_x + qi) * strips + si
    nb = n_sq_x * n_sq_y * strips + 1
    vc = rng.uniform(-1.5, 2.5, nb).astype(np.float32); tilt = rng.uniform(0.04, 0.2, nb).astype(np.float32) * rng.choice([-1, 1], nb)
    phase = rng.uniform(0, 1, nb).astype(np.float32); freq = ring * rng.uniform(0.8, 1.3, nb).astype(np.float32)
    tint = (1.0 + 0.12 * rng.randn(nb)).astype(np.float32); hue = (rng.randn(nb, 3) * 0.02).astype(np.float32)
    ox = rng.randint(0, w, nb); oy = rng.randint(0, h, nb)
    u = along / wid; v = (across - si * wid) / wid
    warp_h = fbm(h, w, seed + 3, 4, 2.6, (8.0, 1.0)); fib_h = snoise(h, w, 0.9, seed + 4, (100.0, 1.0)); fine_h = snoise(h, w, 1.4, seed + 5, (33.0, 1.0))
    warp_v = fbm(w, h, seed + 13, 4, 2.6, (8.0, 1.0)).T; fib_v = snoise(w, h, 0.9, seed + 14, (100.0, 1.0)).T; fine_v = snoise(w, h, 1.4, seed + 15, (33.0, 1.0)).T
    gy = (Y.astype(np.int32) + oy[sid]) % h; gx = (X.astype(np.int32) + ox[sid]) % w
    wf = np.where(horiz, warp_h[gy, gx], warp_v[gy, gx]); fib = np.where(horiz, fib_h[gy, gx], fib_v[gy, gx]); fine = np.where(horiz, fine_h[gy, gx], fine_v[gy, gx])
    g, _ = _wood_grain(u, v, vc[sid], tilt[sid], freq[sid], wf * 0.35, fib, phase[sid])
    t = 0.46 + 0.34 * (g - 0.35) + 0.07 * fib + 0.05 * fine
    albedo = palette(t, [(0.0, tone[0]), (1.0, tone[1])]) * (tint[sid][..., None] * (1 + hue[sid]))
    dA = np.minimum(along, lenp - along); dB = np.minimum(across - si * wid, (si + 1) * wid - across); d = np.minimum(dA, dB)
    gw = max(0.9, joint_mm * 1e-3 * ppm); groove = np.exp(-(d / gw) ** 2)
    albedo = albedo * (1 - 0.7 * groove[..., None])
    hgt = 0.62 + 0.04 * (g - 0.5) - 0.55 * groove
    rgh = rough[0] + (rough[1] - rough[0]) * (0.4 + 0.3 * fine) + 0.35 * groove
    return np.clip(albedo, 0, 4).astype(np.float32), np.clip(rgh, 0.05, 1).astype(np.float32), np.clip(hgt, 0, 1).astype(np.float32)

# --------------------------------------------------------------------------------------------------------------------------------------- stone
def _marble(h, w, seed, vein_amt=1.0, scale=2.2, cloud_amt=0.18, dark_vein=0.5):
    wp = fbm(h, w, seed, 6, 2.5) * 0.8
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); xx /= w; yy /= h
    v1 = np.abs(np.sin(2 * np.pi * (xx * 1.0 + yy * 0.6) * scale + wp * 5.0))
    v2 = np.abs(np.sin(2 * np.pi * (xx * -0.7 + yy * 1.3) * scale * 1.7 + wp * 7.0 + 1.3))
    vein = np.clip(1 - v1 * 9.0, 0, 1) ** 1.5 * vein_amt + 0.45 * np.clip(1 - v2 * 14.0, 0, 1) ** 2 * vein_amt
    cloud = 0.5 + cloud_amt * fbm(h, w, seed + 2, 5, 2.2)
    speck = snoise(h, w, 0.4, seed + 3)
    return np.clip(vein, 0, 1), cloud, speck

def tex_stone_tiles(size_m=(2.4, 2.4), ppm=256, tile=(0.6, 0.6), base=('#b9ab94', '#e1d6c2'), vein_col='#8a7d6a', vein_amt=0.8, seed=3, grout_mm=2.0, polish=0.22, tint_var=0.07, scale=1.4, cloud_amt=0.16, stagger=0.0):
    """polished stone / marble floor tiles with veins; every tile shows another piece of the stone"""
    h, w = _dims(size_m, ppm); rng = np.random.RandomState(seed)
    nx = max(1, int(round(size_m[0] / tile[0]))); ny = max(1, int(round(size_m[1] / tile[1])))
    tw = w / nx; th = h / ny
    X = np.broadcast_to(np.arange(w, dtype=np.float32)[None, :], (h, w)); Y = np.broadcast_to(np.arange(h, dtype=np.float32)[:, None], (h, w))
    qj = np.floor(Y / th).astype(np.int32)
    Xs = X + (qj % 2) * tw * stagger
    qi = np.floor((Xs % w) / tw).astype(np.int32) % nx
    tid = qj * nx + qi
    vein, cloud, speck = _marble(h, w, seed, vein_amt, scale, cloud_amt)
    ox = rng.randint(0, w, nx * ny); oy = rng.randint(0, h, nx * ny)
    gy = (Y.astype(np.int32) + oy[tid]) % h; gx = (X.astype(np.int32) + ox[tid]) % w
    vn = vein[gy, gx]; cl = cloud[gy, gx]; sp = speck[gy, gx]
    tint = (1 + tint_var * rng.randn(nx * ny)).astype(np.float32)
    col = palette(cl, [(0.0, base[0]), (1.0, base[1])]) * tint[tid][..., None]
    vc = lin(vein_col)
    col = col * (1 - 0.65 * vn[..., None]) + vc[None, None, :] * (0.65 * vn[..., None])
    col = col * (1 + 0.025 * sp[..., None])
    fu = (Xs % tw); fv = (Y % th); d = np.minimum(np.minimum(fu, tw - fu), np.minimum(fv, th - fv))
    gw = max(0.8, grout_mm * 1e-3 * ppm); groove = np.exp(-(d / gw) ** 2)
    col = col * (1 - 0.45 * groove[..., None])
    hgt = 0.6 - 0.5 * groove + 0.01 * sp
    rgh = polish + 0.05 * vn + 0.5 * groove + 0.03 * (sp * 0.5 + 0.5)
    return np.clip(col, 0, 4).astype(np.float32), np.clip(rgh, 0.04, 1).astype(np.float32), np.clip(hgt, 0, 1).astype(np.float32)

def tex_terrazzo(size_m=(2.0, 2.0), ppm=256, base='#d9d2c4', chips=('#8a6f52', '#3f4a52', '#b5483a', '#e8e2d4', '#6b7a6e'), seed=4, density=1800):
    h, w = _dims(size_m, ppm); rng = np.random.RandomState(seed)
    col = np.broadcast_to(lin(base), (h, w, 3)).copy() * (1 + 0.03 * fbm(h, w, seed, 5)[..., None])
    mask = np.zeros((h, w), np.float32)
    ccol = np.zeros((h, w, 3), np.float32)
    n = int(density * size_m[0] * size_m[1])
    for i in range(n):
        cx = rng.randint(0, w); cy = rng.randint(0, h); r = rng.uniform(1.5, 6.5) * ppm / 256.0
        ax = r * rng.uniform(0.6, 1.4); ay = r * rng.uniform(0.6, 1.4); a = rng.uniform(0, math.pi)
        tmp = np.zeros((h, w), np.uint8) if False else None
        pts = np.array([[cx + ax * math.cos(a + k * 2 * math.pi / 7) * rng.uniform(0.7, 1.1), cy + ay * math.sin(a + k * 2 * math.pi / 7) * rng.uniform(0.7, 1.1)] for k in range(7)], np.int32)
        c = lin(chips[rng.randint(len(chips))]) * rng.uniform(0.8, 1.15)
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                if -20 < cx + ox < w + 20 and -20 < cy + oy < h + 20:
                    m = np.zeros((h, w), np.uint8); cv2.fillConvexPoly(m, pts + np.array([ox, oy], np.int32), 255, cv2.LINE_AA)
                    mm = m.astype(np.float32) / 255.0; mask = np.maximum(mask, mm)
                    ccol = ccol * (1 - mm[..., None]) + c[None, None, :] * mm[..., None]
    col = col * (1 - mask[..., None]) + ccol * mask[..., None]
    hgt = 0.5 + 0.05 * mask
    return np.clip(col, 0, 4).astype(np.float32), np.full((h, w), 0.18, np.float32) + 0.1 * (1 - mask), hgt

def tex_cement_tile(size_m=(2.0, 2.0), ppm=200, tile=0.2, seed=5, colors=('#1d4e6b', '#e9e1cf', '#c8553d', '#2b2b2b'), grout_mm=2.5):
    """patterned cement tiles (a four-fold floral/geometric motif made from circles and rotated squares)"""
    h, w = _dims(size_m, ppm); rng = np.random.RandomState(seed)
    nx = max(1, int(round(size_m[0] / tile))); ny = max(1, int(round(size_m[1] / tile)))
    tw = w / nx; th = h / ny
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    qi = np.floor(X / tw).astype(np.int32) % nx; qj = np.floor(Y / th).astype(np.int32) % ny
    fu = ((X % tw) / tw - 0.5) * 2; fv = ((Y % th) / th - 0.5) * 2                     # -1..1 inside the tile
    variant = rng.randint(0, 3, (ny, nx))[qj, qi]
    rot = rng.randint(0, 4, (ny, nx))[qj, qi]
    for k in range(1, 4):                                                               # rotate the motif by 90 degrees steps
        m = rot >= k
        fu, fv = np.where(m, -fv, fu), np.where(m, fu, fv)
    r = np.sqrt(fu ** 2 + fv ** 2); dia = np.abs(fu) + np.abs(fv)
    c = [lin(x) for x in colors]
    pat0 = np.where(dia < 0.85, 1, 0) * np.where(r < 0.45, 2, 1) + np.where(dia >= 0.85, 0, 0)
    pat1 = np.where(r < 0.8, 1, 0) + np.where(r < 0.5, 1, 0) + np.where(np.minimum(np.abs(fu), np.abs(fv)) < 0.12, 1, 0)
    pat2 = (np.floor(r * 3) % 2).astype(np.int32) + 2 * (dia < 0.4)
    pat = np.where(variant == 0, pat0, np.where(variant == 1, pat1, pat2)) % len(c)
    col = np.zeros((h, w, 3), np.float32)
    for i, cc in enumerate(c): col[pat == i] = cc
    col = cv2.GaussianBlur(col, (0, 0), 0.7)
    col = col * (1 + 0.06 * fbm(h, w, seed + 1, 5)[..., None])
    d = np.minimum(np.minimum((X % tw), tw - (X % tw)), np.minimum((Y % th), th - (Y % th)))
    gw = max(0.8, grout_mm * 1e-3 * ppm); groove = np.exp(-(d / gw) ** 2)
    col = col * (1 - 0.5 * groove[..., None])
    return np.clip(col, 0, 4).astype(np.float32), np.clip(0.42 + 0.4 * groove, 0.05, 1).astype(np.float32), np.clip(0.6 - 0.5 * groove, 0, 1).astype(np.float32)

# --------------------------------------------------------------------------------------------------------------------------------------- soft materials
def tex_carpet(size_m=(2.0, 2.0), ppm=256, color='#1b3a73', var=0.16, pattern=None, seed=6, pile=0.7):
    h, w = _dims(size_m, ppm)
    fib = snoise(h, w, 0.2, seed); mid = fbm(h, w, seed + 1, 5, 2.4); clump = snoise(h, w, 1.0, seed + 2)
    t = 1 + var * (0.55 * fib + 0.8 * mid + 0.5 * clump)
    col = lin(color)[None, None, :] * t[..., None]
    if pattern is not None: col = col * (1 + pattern[..., None])
    return np.clip(col, 0, 4).astype(np.float32), np.full((h, w), 0.95, np.float32), np.clip(0.5 + 0.25 * fib * pile, 0, 1).astype(np.float32)

def tex_paint(size_m=(2.0, 2.0), ppm=200, color='#e6dfd0', var=0.035, seed=7, grad=0.0):
    h, w = _dims(size_m, ppm)
    nz = fbm(h, w, seed, 6, 2.3); fine = snoise(h, w, 0.5, seed + 1)
    col = lin(color)[None, None, :] * (1 + var * nz[..., None] + 0.012 * fine[..., None])
    return np.clip(col, 0, 4).astype(np.float32), np.full((h, w), 0.82, np.float32) - 0.05 * fine, np.clip(0.5 + 0.04 * fine, 0, 1).astype(np.float32)

def tex_fabric(size_m=(0.5, 0.5), ppm=900, color='#1c3a6e', weave=1.4e-3, var=0.14, seed=8, twill=False):
    h, w = _dims(size_m, ppm)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    px = ppm * weave * 2
    a = np.sin(xx / px * 2 * np.pi); b = np.sin(yy / px * 2 * np.pi)
    if twill: wv = 0.5 + 0.5 * np.sin((xx + yy) / px * 2 * np.pi)
    else: wv = 0.5 + 0.25 * a * b + 0.15 * (a + b) * 0.5
    nz = fbm(h, w, seed, 4, 2.0) * 0.5 + 0.5 * snoise(h, w, 0.6, seed + 1)
    t = wv + 0.2 * nz
    col = lin(color)[None, None, :] * (1 + var * (t[..., None] - 0.5) * 2)
    return np.clip(col, 0, 4).astype(np.float32), np.full((h, w), 0.78, np.float32), np.clip(t, 0, 1).astype(np.float32)

def tex_leather(size_m=(0.6, 0.6), ppm=500, color='#5a1a22', var=0.10, seed=9):
    h, w = _dims(size_m, ppm)
    c = snoise(h, w, 0.9, seed); b = snoise(h, w, 2.6, seed + 1)
    # leather grain: a cellular pattern from the thresholded ridges of a band-passed noise
    g = np.clip(1.0 - np.abs(cv2.GaussianBlur(c, (0, 0), 1.2) * 3.0), 0, 1) ** 2
    col = lin(color)[None, None, :] * (1 + var * (b[..., None] * 0.5 - g[..., None] * 0.7))
    return np.clip(col, 0, 4).astype(np.float32), np.clip(0.34 + 0.18 * g, 0.05, 1).astype(np.float32), np.clip(0.55 - 0.3 * g, 0, 1).astype(np.float32)

def tex_veneer(size_m=(2.4, 2.4), ppm=220, tone=('#6a4223', '#a97544'), panels=(0.6, 1.2), seed=10, ring=5.0, joint_mm=3.0, vertical=True):
    """wall panelling: vertical panels of figured veneer with shadow gaps"""
    a, r, hgt = tex_planks((size_m[1], size_m[0]) if vertical else size_m, ppm, plank_w=panels[0], plank_len=(panels[1] * 0.9, panels[1] * 1.1), tone=tone, seed=seed, ring=ring, joint_mm=joint_mm, rough=(0.45, 0.6))
    if vertical:
        a = np.ascontiguousarray(np.rot90(a)); r = np.ascontiguousarray(np.rot90(r)); hgt = np.ascontiguousarray(np.rot90(hgt))
    return a, r, hgt

def tex_metal_brushed(size_m=(1.0, 1.0), ppm=400, color='#9a9ca0', seed=11, streak=0.06):
    h, w = _dims(size_m, ppm)
    s = snoise(h, w, 0.8, seed, (100.0, 1.0)); s2 = snoise(h, w, 1.2, seed + 1, (33.0, 1.0))
    col = lin(color)[None, None, :] * (1 + streak * (s[..., None] + 0.5 * s2[..., None]))
    return np.clip(col, 0, 4).astype(np.float32), np.clip(0.28 + 0.07 * s, 0.05, 1).astype(np.float32), np.clip(0.5 + 0.05 * s, 0, 1).astype(np.float32)

def tex_concrete(size_m=(2.0, 2.0), ppm=200, color='#8b8a86', seed=12, var=0.12, polish=0.3):
    h, w = _dims(size_m, ppm)
    nz = fbm(h, w, seed, 7, 2.2); fine = snoise(h, w, 0.4, seed + 1); pit = (snoise(h, w, 0.2, seed + 2) > 2.4).astype(np.float32)
    col = lin(color)[None, None, :] * (1 + var * nz[..., None] + 0.03 * fine[..., None] - 0.35 * pit[..., None])
    return np.clip(col, 0, 4).astype(np.float32), np.clip(polish + 0.08 * fine + 0.3 * pit, 0.04, 1).astype(np.float32), np.clip(0.5 + 0.05 * nz - 0.2 * pit, 0, 1).astype(np.float32)

def led_dots(size_m=(1.0, 1.0), ppm=240, pitch_mm=12.0, base=None):
    """an LED wall: a grid of round diodes in the sub-pixel pattern, as a multiplier mask (0..1) for an emission picture"""
    h, w = _dims(size_m, ppm); p = pitch_mm * 1e-3 * ppm
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx % p) / p - 0.5; v = (yy % p) / p - 0.5
    d = np.sqrt(u ** 2 + v ** 2)
    return np.clip(1 - smooth(0.30, 0.46, d), 0, 1).astype(np.float32)

# --------------------------------------------------------------------------------------------------------------------------------------- one-off pictures: rug, flag, text
def tex_rug(size_m=(9.0, 9.0), ppm=110, field='#6e1424', gold='#c8a04a', cream='#e6d6a8', navy='#1c2748', seed=21, cell=1.1):
    """a large woven rug (no tiling): border bands, a diamond lattice with small motifs, a central medallion; returns albedo, roughness, height"""
    h, w = _dims(size_m, ppm)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X = (xx - w / 2) / ppm; Y = (yy - h / 2) / ppm                       # metres from the centre
    hx, hy = size_m[0] / 2, size_m[1] / 2
    d_edge = np.minimum(hx - np.abs(X), hy - np.abs(Y))                   # distance to the rug's edge
    col = np.broadcast_to(lin(field), (h, w, 3)).copy()
    nz = fbm(h, w, seed, 5, 2.2); fine = snoise(h, w, 0.2, seed + 1)
    col *= (1 + 0.10 * nz[..., None])
    G = lin(gold); C = lin(cream); N = lin(navy)
    def band(a, b, c): return smooth(a - 0.012, a + 0.012, d_edge) * (1 - smooth(b - 0.012, b + 0.012, d_edge))
    # fringe-free borders: outer navy band, gold line, wide field band with a zigzag, gold line, cream line
    col = np.where(band(0.0, 0.28, 0)[..., None] > 0.5, N[None, None, :] * (1 + 0.1 * nz[..., None]), col)
    col = np.where(band(0.28, 0.34, 0)[..., None] > 0.5, G[None, None, :], col)
    zz = np.abs(((np.where(np.abs(X) > hx - 0.9, Y, X)) * 6.0) % 2.0 - 1.0)                     # zigzag along the border
    zig = band(0.34, 0.86, 0) * (zz < 0.3 + 0.5 * np.clip((d_edge - 0.34) / 0.52, 0, 1) * 0.0)
    col = np.where(zig[..., None] > 0.5, C[None, None, :] * 0.85, col)
    col = np.where(band(0.86, 0.92, 0)[..., None] > 0.5, G[None, None, :], col)
    # the field: a diamond lattice
    inside = (d_edge > 0.95)
    u = (X + Y) / cell; v = (X - Y) / cell
    fu = np.abs(u - np.round(u)); fv = np.abs(v - np.round(v))
    line = np.clip(1 - np.minimum(fu, fv) * cell / 0.032, 0, 1)
    col = np.where((inside & (line > 0.5))[..., None], G[None, None, :] * 0.95, col)
    # small motif at the lattice crossings
    cx_ = np.round(u) * cell; cy_ = np.round(v) * cell
    px = (cx_ + cy_) / 2; py = (cx_ - cy_) / 2
    dm = np.sqrt((X - px) ** 2 + (Y - py) ** 2)
    col = np.where((inside & (dm < 0.07))[..., None], G[None, None, :] * 0.9, col)
    col = np.where((inside & (dm < 0.035))[..., None], N[None, None, :], col)
    # medallion
    dia = np.abs(X) / 1.9 + np.abs(Y) / 1.9
    ring = (np.abs(dia - 1.0) < 0.018) | (np.abs(dia - 0.82) < 0.012) | (np.abs(dia - 0.6) < 0.014)
    col = np.where((inside & ring)[..., None], G[None, None, :], col)
    col = np.where((inside & (dia < 0.58))[..., None], col * 0.7 + lin('#8a1c30')[None, None, :] * 0.3, col)
    col = col * (1 + 0.03 * fine[..., None])
    return np.clip(col, 0, 4).astype(np.float32), np.full((h, w), 0.95, np.float32), np.clip(0.5 + 0.25 * fine, 0, 1).astype(np.float32)

def flag_israel(w=880, h=640, ss=3):
    """the flag of Israel (white, two blue stripes, the blue Star of David), as a linear rgb picture; proportions 8:11"""
    W, H = w * ss, h * ss
    img = np.full((H, W, 3), 255, np.uint8)
    blue = (0xb8, 0x38, 0x00)   # BGR of #0038b8
    sh = int(H * 25 / 160); top = int(H * 15 / 160)
    img[top:top + sh] = blue; img[H - top - sh:H - top] = blue
    cx, cy = W / 2, H / 2; R = H * (80 / 160) / 2 * 0.92                      # the star fits in the white band between the stripes
    t = int(H * 5.5 / 160)
    def tri(sign):
        pts = [(cx + R * math.sin(math.radians(a)), cy - sign * R * math.cos(math.radians(a))) for a in (0, 120, 240)]
        return np.array(pts, np.int32)
    for sg in (1, -1): cv2.polylines(img, [tri(sg)], True, blue, t, cv2.LINE_AA)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    rgb = img[..., ::-1].astype(np.float32) / 255.0
    return s2l(rgb)

def text_image(text, size_px, w, h, font=None, color=(1, 1, 1), bg=(0, 0, 0), rtl=True, bold=True, align='center', margin=0.0):
    """text on a plain background (Hebrew right to left with the system's shaper), linear rgb float picture of w x h"""
    from PIL import Image, ImageDraw, ImageFont
    fp = font or ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    f = ImageFont.truetype(fp, size_px)
    im = Image.new('RGB', (w, h), tuple(int(c * 255) for c in bg)); dr = ImageDraw.Draw(im)
    kw = {'direction': 'rtl', 'language': 'he'} if rtl else {}
    bb = dr.textbbox((0, 0), text, font=f, **kw); tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = (w - tw) / 2 - bb[0] if align == 'center' else (w - tw - margin * w - bb[0] if rtl else margin * w - bb[0])
    y = (h - th) / 2 - bb[1]
    dr.text((x, y), text, font=f, fill=tuple(int(c * 255) for c in color), **kw)
    return s2l(np.asarray(im, np.float32) / 255.0)

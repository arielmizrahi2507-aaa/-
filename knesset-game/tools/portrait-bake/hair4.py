# strand hair: thousands of single strands grown along the flow field of the style, drawn in a few passes from the deep layer to the top layer.
# It sits on top of the soft fibre texture of hair3 (which stays the under-coat) and gives what a photograph of hair has and a texture does not:
# clumps of different tones, strands that cross, a ragged tip line, light strands over dark ones, highlights that follow single locks.
import numpy as np, cv2
from rend2 import SS, I, CX, EY, XX, YY, blur, smoothstep, fbm, noise

def _sample(f, x, y):
    xi = np.clip(np.rint(x).astype(np.int32), 0, SS - 1); yi = np.clip(np.rint(y).astype(np.int32), 0, SS - 1)
    return f[yi, xi]

def grow(mask, vx, vy, n, length, step, seed, wander=0.30, clump=0.35, clump_scale=26, roots=None, stop=0.30, tip_margin=(0.0, 6.0), rootw=None):
    """n strands from roots inside the mask; returns xs, ys (n, K) with NaN after the end of a strand"""
    rng = np.random.RandomState(seed)
    if roots is None:
        ys_, xs_ = np.nonzero(mask > 0.55)
        if len(xs_) < 50: return None, None
        if rootw is not None:                                           # fewer roots next to the bare skin: the hairline thins out instead of ending on a line
            pw = rootw[ys_, xs_].astype(np.float64) + 1e-4; k = rng.choice(len(xs_), size=n, p=pw / pw.sum())
        else:
            k = rng.randint(len(xs_), size=n)
        x = xs_[k].astype(np.float32) + rng.rand(n).astype(np.float32); y = ys_[k].astype(np.float32) + rng.rand(n).astype(np.float32)
    else:
        x, y = roots
    L = rng.uniform(length[0], length[1], n).astype(np.float32)
    K = int(np.ceil(length[1] / step)) + 1
    cn = fbm(seed + 5, [clump_scale, max(6, clump_scale // 3)], [1.0, 0.5]).astype(np.float32)          # coherent angle noise: neighbouring strands bend alike (a lock)
    cn = cn / (np.abs(cn).max() + 1e-6)
    off = rng.randn(n).astype(np.float32) * wander * 0.35                                                  # every strand has its own small lean
    margin = rng.uniform(tip_margin[0], tip_margin[1], n).astype(np.float32)
    ox = np.full((n, K), np.nan, np.float32); oy = np.full((n, K), np.nan, np.float32)
    alive = np.ones(n, bool); run = np.zeros(n, np.float32)
    ang0 = np.zeros(n, np.float32)
    for k in range(K):
        ox[alive, k] = x[alive]; oy[alive, k] = y[alive]
        dx = _sample(vx, x, y); dy = _sample(vy, x, y)
        a = clump * _sample(cn, x, y) * 1.4 + off + ang0
        c, s = np.cos(a), np.sin(a)
        nx_ = dx * c - dy * s; ny_ = dx * s + dy * c
        x = x + nx_ * step; y = y + ny_ * step; run += step
        inside = _sample(mask, x, y) > stop
        ended = (run >= L)
        # a strand may leave the mask by its own random margin before it stops (the tip line is ragged)
        left = ~inside
        margin = margin - left * step
        alive = alive & (~ended) & (margin > 0)
    return ox, oy

def splat(xs, ys, cols, wts, shape=(SS, SS)):
    """bilinear splat of points: returns (sum w*c (H,W,3), sum w (H,W))"""
    H, W = shape
    ok = ~np.isnan(xs)
    x = xs[ok]; y = ys[ok]; w = wts[ok]; c = cols[ok]
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32); fx = x - x0; fy = y - y0
    acc = np.zeros((H * W, 3), np.float64) if False else None
    accW = np.zeros(H * W, np.float32); accC = [np.zeros(H * W, np.float32) for _ in range(3)]
    for dx, dy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi = x0 + dx; yi = y0 + dy; v = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
        idx = yi[v] * W + xi[v]; wv = (ww * w)[v]
        accW += np.bincount(idx, weights=wv, minlength=H * W).astype(np.float32)
        for ch in range(3): accC[ch] += np.bincount(idx, weights=wv * c[v, ch], minlength=H * W).astype(np.float32)
    return np.stack([a.reshape(H, W) for a in accC], -1), accW.reshape(H, W)

def strand_hair(mask, vx, vy, base, mix, grey, shade, spec_map, spec_col, seed, rootw=None, density=1.0, length=(30, 80), step=1.2, passes=3, width=0.62, gain=1.0, contrast=0.22,
                tone=0.26, lock_scale=22, wander=0.30, thin=0.0, tip_margin=(0.0, 6.0), root_dark=0.25, hl=0.55, kappa=1.15):
    """returns (rgb (H,W,3), alpha (H,W)): the strand layer. shade = lighting of the mass, spec_map = highlight strength per pixel, grey = share of light strands (0..1)"""
    rng = np.random.RandomState(seed + 77)
    area = float((mask > 0.55).sum())
    if area < 300: return np.zeros((SS, SS, 3), np.float32), np.zeros((SS, SS), np.float32)
    mean_len = 0.5 * (length[0] + length[1])
    per_pass = int(np.clip(density * area * 1.35 / (mean_len * 1.5), 800, 60000)) // 1
    canvas = np.zeros((SS, SS, 3), np.float32); cover = np.zeros((SS, SS), np.float32)
    lockn = fbm(seed + 9, [lock_scale, max(5, lock_scale // 3)], [1.0, 0.6]).astype(np.float32); lockn = lockn / (np.abs(lockn).max() + 1e-6)
    greyn = fbm(seed + 13, [max(6, lock_scale // 2), 4], [1.0, 0.6]).astype(np.float32); greyn = greyn / (np.abs(greyn).max() + 1e-6)
    for p in range(passes):
        ox, oy = grow(mask, vx, vy, per_pass, length, step, seed + 101 * p, wander=wander, clump_scale=lock_scale, tip_margin=tip_margin, rootw=rootw)
        if ox is None: break
        n, K = ox.shape
        t = np.arange(K, dtype=np.float32)[None, :] * step / max(length[1], 1.0)                              # 0 at the root .. 1 at the longest tip
        ln = np.nansum(~np.isnan(ox), axis=1).astype(np.float32)[:, None]
        tt = (np.arange(K, dtype=np.float32)[None, :] + 0.5) / np.maximum(ln, 1.0)                           # 0 at the root, 1 at the own tip
        # colour of every strand: the tone of its lock, its own jitter, light/dark, the lighting where it lies, darker towards the root
        px = np.nan_to_num(ox[:, 0], nan=0.0); py = np.nan_to_num(oy[:, 0], nan=0.0)
        lk = _sample(lockn, px, py); gr = _sample(greyn, px, py)
        jit = np.exp(rng.randn(n).astype(np.float32) * contrast * 0.8 + lk * tone)
        is_light = (rng.rand(n) < np.clip(grey + 0.55 * gr * (grey > 0), 0, 1))
        c0 = np.where(is_light[:, None], mix[None, :], base[None, :]).astype(np.float32)
        layer_dark = 0.80 + 0.20 * (p / max(passes - 1, 1))                                                  # the deep layer is darker, the top layer shows the true colour and the highlights
        sh = _sample(shade, np.nan_to_num(ox, nan=0.0), np.nan_to_num(oy, nan=0.0))                          # (n, K)
        spm = _sample(spec_map, np.nan_to_num(ox, nan=0.0), np.nan_to_num(oy, nan=0.0))
        rootf = (1.0 - root_dark) + root_dark * np.clip(tt * 2.0, 0, 1)
        col = (c0[:, None, :] * (jit * layer_dark)[:, None, None]) * (sh * rootf)[:, :, None]
        col = col + (spm * hl * (0.4 + 0.6 * np.clip(0.5 + 0.8 * lk, 0, 1))[:, None] * (p / max(passes - 1, 1)))[:, :, None] * spec_col[None, None, :]
        w = np.broadcast_to(np.float32(1.0) * (1.0 - 0.45 * np.clip(tt - 0.6, 0, 1) / 0.4), (n, K)).astype(np.float32)   # the tip is thinner
        accC, accW = splat(ox, oy, col.astype(np.float32), w)
        if width > 0.3: accC = cv2.GaussianBlur(accC, (0, 0), width); accW = cv2.GaussianBlur(accW, (0, 0), width)
        a = 1.0 - np.exp(-kappa * gain * accW)
        c = accC / np.maximum(accW, 1e-6)[:, :, None]
        canvas = canvas * (1 - a)[:, :, None] + c * a[:, :, None]
        cover = cover + a - cover * a
    return canvas / np.maximum(cover, 1e-3)[:, :, None], cover                  # straight (not premultiplied) colour

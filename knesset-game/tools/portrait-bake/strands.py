# strand renderer for hair, beards and moustaches
import numpy as np, cv2
from rend2 import SS, I, CX, EY, XX, YY, blur, smoothstep, hexlin, noise, fbm, LKEY, normals






# ---------------------------------------------------------------------------------------------------------------- line integral convolution hair
def flow_grid(flow, step=16):
    g = np.arange(0, SS + step, step, dtype=np.float32)
    d = np.zeros((len(g), len(g), 2), np.float32)
    for j, y in enumerate(g):
        for i, x in enumerate(g):
            d[j, i] = flow(float(x), float(y))
    vx = cv2.resize(d[:, :, 0], (SS, SS), interpolation=cv2.INTER_LINEAR); vy = cv2.resize(d[:, :, 1], (SS, SS), interpolation=cv2.INTER_LINEAR)
    nn = np.hypot(vx, vy) + 1e-6
    return vx / nn, vy / nn

def lic(noise_img, vx, vy, length=20, step=1.4):
    acc = noise_img.copy(); w = 1.0
    for sgn in (1, -1):
        for k in range(1, length + 1):
            wk = 1.0 - k / (length + 1.0)
            mx = (XX + sgn * vx * k * step).astype(np.float32); my = (YY + sgn * vy * k * step).astype(np.float32)
            acc += wk * cv2.remap(noise_img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            w += wk
    return acc / w

def white_noise(seed, sigma=0.6):
    r = np.random.RandomState(seed); n = r.randn(SS, SS).astype(np.float32)
    return cv2.GaussianBlur(n, (0, 0), sigma) if sigma > 0 else n

def norm_field(f, mask=None):
    sel = f[mask > 0.5] if mask is not None and (mask > 0.5).any() else f.ravel()
    return (f - sel.mean()) / (sel.std() + 1e-6)

def hair_texture(mask, vx, vy, seed, fine_len=24, lock_len=60, lock_scale=1.8):
    fine = norm_field(lic(white_noise(seed, 0.55), vx, vy, fine_len, 1.3), mask)
    lock = norm_field(lic(cv2.GaussianBlur(white_noise(seed + 1, 0), (0, 0), lock_scale), vx, vy, lock_len, 1.6), mask)
    grey = norm_field(lic(white_noise(seed + 2, 0.8), vx, vy, fine_len, 1.3), mask)
    return fine, lock, grey

HVEC = np.array([-0.40, -0.52, 0.76], np.float32); HVEC = HVEC / np.linalg.norm(HVEC) + np.array([0, 0, 1.0], np.float32); HVEC = HVEC / np.linalg.norm(HVEC)

def lit_fibres(mask, vx, vy, base, mix, skinc, seed=1, fine_len=24, lock_len=60, lock_scale=1.8, k_fine=0.18, k_lock=0.30, grey_frac=0.0, under=0.28, spec=0.5, spec_pow=48.0,
               dome=6.0, dome_cap=70.0, dome_mask=None, scalp=0.0, occl=0.30, shape_mask=None, target=None, target2=None):
    """returns (rgb_lin, alpha) of a fibre mass (hair, beard) inside `mask` with fibres along (vx, vy)"""
    fine, lock, grey = hair_texture(mask, vx, vy, seed, fine_len, lock_len, lock_scale)
    br = np.exp(k_fine * fine + k_lock * lock)
    light = float(base.mean()) > 0.30
    col = base[None, None, :] * br[:, :, None]
    if grey_frac > 0:
        gm = smoothstep(1.0 - 2.0 * grey_frac, 1.0 - 2.0 * grey_frac + 0.9, grey)
        col = col * (1 - gm)[:, :, None] + (mix[None, None, :] * br[:, :, None]) * gm[:, :, None]
    dm = mask if dome_mask is None else dome_mask
    D = cv2.distanceTransform((dm > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    Zh = blur(np.sqrt(np.clip(D, 0, dome_cap)) * dome, 5)
    gy, gx = np.gradient(Zh)
    nx, ny, nz = -gx, -gy, np.ones_like(Zh); nn = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2); nx, ny, nz = nx / nn, ny / nn, nz / nn
    ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.30) / 1.30, 0, 1)
    D2 = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    shade = (0.34 + 0.95 * ndl) * (1 - occl + occl * smoothstep(0, 16, D2))
    slope = gx * vx + gy * vy
    T = np.stack([vx, vy, slope], -1); T = T / (np.linalg.norm(T, axis=2, keepdims=True) + 1e-6)
    TH = T[:, :, 0] * HVEC[0] + T[:, :, 1] * HVEC[1] + T[:, :, 2] * HVEC[2]
    sp = np.power(np.clip(1 - TH ** 2, 0, 1), spec_pow / 2) * np.clip(ndl * 1.2, 0, 1) * (0.55 + 0.45 * np.clip(0.5 + 0.5 * lock, 0, 1))
    spec_col = np.clip(0.45 * base / max(float(base.max()), 1e-3) + 0.55, 0, 1)
    rgb = col * shade[:, :, None] + sp[:, :, None] * spec * spec_col[None, None, :]
    if scalp > 0:                                                      # thin hair: the scalp shows through between the fibres
        see = smoothstep(0.2, 1.4, -fine) * scalp
        rgb = rgb * (1 - see)[:, :, None] + (skinc * 0.62 * shade)[:, :, None] * see[:, :, None] if False else rgb * (1 - see)[:, :, None] + (skinc[None, None, :] * 0.62 * shade[:, :, None]) * see[:, :, None]
    if target is not None:
        sel = mask > 0.5
        if sel.sum() > 200:
            lum = lambda c: 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
            if target2 is not None:                                      # two targets: the upper and the lower part of the mass (a beard greyer at the chin)
                t = smoothstep(EY + 0.85 * I, EY + 1.95 * I, YY)
                s_up = np.clip(float(lum(np.asarray(target))) / max(float(lum(rgb[sel & (t < 0.5)]).mean()) if (sel & (t < 0.5)).any() else 1e-3, 1e-3), 0.4, 2.0)
                s_lo = np.clip(float(lum(np.asarray(target2))) / max(float(lum(rgb[sel & (t >= 0.5)]).mean()) if (sel & (t >= 0.5)).any() else 1e-3, 1e-3), 0.4, 2.0)
                rgb = rgb * (s_up * (1 - t) + s_lo * t)[:, :, None]
            else:
                m = float(lum(rgb[sel]).mean()); k = float(np.clip(float(lum(np.asarray(target))) / max(m, 1e-4), 0.45, 2.0))
                rgb = rgb * k
    return rgb, blur(mask, 1.3)

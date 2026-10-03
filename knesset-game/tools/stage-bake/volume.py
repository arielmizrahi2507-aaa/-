# Light shafts: the sun coming through the windows lights the dusty air of a room. A single-scattering ray march in numpy (no path tracer): for every pixel of the camera, samples along the ray
# from the fighters' plane to the wall; a sample is lit when the ray from it towards the sun passes through a window opening (and not through a bar of the frame). The result is an additive picture
# (the game draws it with 'lighter'), so it is stored as an opaque RGB layer.
import math
import numpy as np, cv2
from stagelib import K, W, H, D_CAM, F_PX, GROUND_Y, horizon_row, layer_width, filmic, tonemap

def _lit_mask(P, s, plane_z, windows, bars, soft=0.03):
    """P (n, 3) points inside the room; s unit vector towards the sun; windows [(x0, x1, y0, y1)], bars [(x0, x1, y0, y1)] on the plane z = plane_z; returns 0..1"""
    sz = s[2]
    t = (plane_z - P[:, 2]) / sz
    hx = P[:, 0] + t * s[0]; hy = P[:, 1] + t * s[1]
    def box(x0, x1, y0, y1):
        ax = np.clip(np.minimum(hx - x0, x1 - hx) / soft + 0.5, 0, 1); ay = np.clip(np.minimum(hy - y0, y1 - hy) / soft + 0.5, 0, 1)
        return ax * ay
    open_ = np.zeros(len(P), np.float32)
    for w_ in windows: open_ = np.maximum(open_, box(*w_))
    for b_ in bars: open_ = open_ * (1 - box(*b_))
    return np.where(t > 0, open_, 0.0)

def shafts(sun_dir, plane_z, windows, bars, f, h_cam=1.5, scale=0.6, z_min=0.5, steps=56, sigma=1.0, g=0.55, color=(1.0, 0.78, 0.5), gain=1.0, seed=3,
           fade_from=None, noise_amt=0.35, width_px=None):
    """returns an opaque float rgb picture (display encoded, 0..1) of the size (H * scale, layer_width(f) * scale)"""
    s = np.asarray(sun_dir, np.float64); s /= np.linalg.norm(s)
    Wl = width_px or layer_width(f); w = int(round(Wl * scale)); h = int(round(H * scale))
    yh = horizon_row(h_cam)
    uu = (np.arange(w) + 0.5) / scale; vv = (np.arange(h) + 0.5) / scale
    U, V = np.meshgrid(uu, vv)
    dx = (U - Wl / 2.0) / F_PX; dy = (yh - V) / F_PX                  # the ray direction with d.z = 1 (x to the right, y up)
    C = np.array([0.0, h_cam, -D_CAM])
    t0 = D_CAM + z_min; t1 = D_CAM + plane_z
    rng = np.random.RandomState(seed)
    acc = np.zeros((h, w), np.float64)
    # Henyey-Greenstein for the angle between the light's way (-s) and the way to the camera (-d)
    dn = np.sqrt(dx * dx + dy * dy + 1.0)
    cos_t = (s[0] * dx + s[1] * dy + s[2] * 1.0) / dn
    phase = (1 - g * g) / (4 * math.pi * (1 + g * g - 2 * g * cos_t) ** 1.5)
    ph = rng.uniform(0, 6.28, 6)
    for i in range(steps):
        t = t0 + (t1 - t0) * (i + rng.uniform(0.0, 1.0)) / steps         # jittered samples
        X = C[0] + t * dx; Y = C[1] + t * dy; Z = C[2] + t * 1.0
        P = np.stack([X.ravel(), Y.ravel(), np.full(X.size, Z)], 1) if np.isscalar(Z) else np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
        lit = _lit_mask(P, s, plane_z, windows, bars).reshape(h, w)
        # the dust is patchy
        nz = 1.0 + noise_amt * (np.sin(X * 1.7 + ph[0]) * np.sin(Y * 2.3 + ph[1]) * np.sin(Z * 1.3 + ph[2]) + 0.6 * np.sin(X * 4.1 + Y * 3.3 + ph[3]) * np.sin(Z * 2.9 + ph[4]))
        # the air near the floor is thicker
        dens = nz * (0.6 + 0.4 * np.exp(-np.clip(Y, 0, 8) / 2.5))
        acc += lit * dens * dn * (t1 - t0) / steps
    out = acc * phase * sigma * gain
    rgb = np.stack([out * c for c in color], -1).astype(np.float32)
    return rgb

def to_display(rgb, strength=1.0):
    """a soft S curve on the added light so that it never burns out"""
    x = np.maximum(rgb * strength, 0)
    y = 1 - np.exp(-1.6 * x)
    return np.clip(y, 0, 1).astype(np.float32)

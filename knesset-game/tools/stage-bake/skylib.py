# Procedural skies for the arena scenes: gradient + sun glow + clouds + a city skyline, as an equirectangular float image (linear radiance).
# Axes as in stagelib: +y up, the camera looks along +z; azimuth 0 = +z, positive azimuth towards +x (the right of the picture).
import math
import numpy as np, cv2
import texlib
from texlib import lin, snoise, fbm, smooth

def _dirs(h, w):
    """unit direction of every pixel of an equirectangular image whose centre looks along +z (matches Mitsuba's envmap with the default orientation after the +90 degree turn we apply in the scene)"""
    el = (0.5 - (np.arange(h) + 0.5) / h) * math.pi                  # +90 .. -90 degrees
    az = -((np.arange(w) + 0.5) / w - 0.5) * 2 * math.pi             # Mitsuba's envmap is mirrored w.r.t. our camera: azimuth falls towards the right of the image
    AZ, EL = np.meshgrid(az, el)
    return AZ, EL

def grad(el_deg, stops):
    """colour as a function of the elevation in degrees through [(deg, '#hex' or rgb-linear), ...]"""
    pos = np.array([p for p, _ in stops], np.float32); cols = np.array([lin(c) if isinstance(c, str) else np.asarray(c, np.float32) for _, c in stops], np.float32)
    out = np.empty(el_deg.shape + (3,), np.float32)
    for ch in range(3): out[..., ch] = np.interp(el_deg, pos, cols[:, ch])
    return out

def clouds(AZ, EL, seed, cover=0.5, sharp=2.2, band=(0.0, 40.0), stretch=3.5):
    """cloud density 0..1 (stretched along the azimuth)"""
    h, w = AZ.shape
    n = fbm(h, w, seed, 6, 2.3, aniso=(stretch, 1.0)) * 0.5 + 0.5 * fbm(h, w, seed + 5, 4, 2.0, aniso=(stretch, 1.0))
    d = np.clip((n - (1 - cover) * 0.55) * sharp, 0, 1)
    el = np.degrees(EL)
    fade = smooth(band[0] - 1, band[0] + 3, el) * (1 - smooth(band[1] - 8, band[1], el))
    return d * fade

def sunset_sky(w=8192, h=4096, sun_az=-34.0, sun_el=7.0, seed=3, skyline=True, sky_scale=1.0, window_glow=1.0, cloud_cover=0.55, city_seed=11, haze=0.55, sun_E=6.0, sun_col=(1.0, 0.70, 0.42)):
    AZ, EL = _dirs(h, w)
    el = np.degrees(EL); az = np.degrees(AZ)
    sky = grad(el, [(-90, '#2a1f2e'), (-3, '#c78a62'), (0, '#ffc98a'), (2.5, '#ffb472'), (7, '#f08a6a'), (14, '#c8708a'), (25, '#8a6aa8'), (45, '#4a4a90'), (90, '#1c2450')])
    # glow round the sun
    sa, se = math.radians(sun_az), math.radians(sun_el)
    sd = np.array([math.sin(sa) * math.cos(se), math.sin(se), math.cos(sa) * math.cos(se)], np.float32)
    dx = np.cos(EL) * np.sin(AZ); dy = np.sin(EL); dz = np.cos(EL) * np.cos(AZ)
    cosang = np.clip(dx * sd[0] + dy * sd[1] + dz * sd[2], -1, 1); ang = np.degrees(np.arccos(cosang))
    glow = np.exp(-(ang / 7.0) ** 2) * 2.2 + np.exp(-(ang / 22.0) ** 2) * 0.9 + np.exp(-(ang / 60.0) ** 2) * 0.35
    sky = sky * (1.0 + glow[..., None] * np.array([1.0, 0.75, 0.45], np.float32)[None, None, :] * 1.1)
    sky = sky * 2.4 * sky_scale
    # clouds: dark violet bodies, orange-pink undersides near the sun side
    cd = clouds(AZ, EL, seed, cloud_cover, 2.4, (3.0, 55.0))
    lit = np.clip(0.5 + 0.5 * np.cos(np.radians(az - sun_az)), 0, 1) * np.exp(-np.abs(el - sun_el) / 28.0)
    ccol = (lin('#6a4a7a')[None, None, :] * (1 - lit[..., None]) + lin('#ffb078')[None, None, :] * lit[..., None] * 2.6) * (0.9 + 0.2 * fbm(h, w, seed + 8, 3, 2.0, aniso=(3.0, 1.0))[..., None])
    sky = sky * (1 - 0.65 * cd[..., None]) + ccol * 0.65 * cd[..., None] * sky_scale * 1.7
    if skyline:
        sky = _skyline(sky, AZ, EL, city_seed, haze, sun_az)
    if sun_E > 0:                                   # the sun itself: a small disc whose irradiance on a surface that faces it is sun_E
        disc = np.exp(-(ang / 0.42) ** 2)
        omega = (2 * math.pi / w) * (math.pi / h) * np.cos(EL)
        L = sun_E / float((disc * omega).sum())
        sky = sky + (disc * L)[..., None] * np.array(sun_col, np.float32)[None, None, :]
    return sky.astype(np.float32), sd

def _skyline(sky, AZ, EL, seed, haze, sun_az):
    """three depth layers of buildings (far = pale and hazy, near = dark with a few lit windows and sunlit edges); the horizon is at elevation 0"""
    h, w, _ = sky.shape
    rng = np.random.RandomState(seed)
    r0 = int(h * (0.5 - 14.0 / 180.0)); r1 = int(h * (0.5 + 6.0 / 180.0))
    sub = sky[r0:r1].copy(); sh = r1 - r0
    deg_per_px = 360.0 / w
    rows = np.arange(r0, r1); el_rows = (0.5 - (rows + 0.5) / h) * 180.0
    # the haze at the horizon: a warm pale band
    hz_col = lin('#f6b07c') * 1.8
    for layer in range(3):
        base_el = -1.6 + layer * 0.45
        hmax = [2.2, 3.4, 5.2][layer]
        bw_deg = [(0.30, 0.8), (0.4, 1.1), (0.55, 1.5)][layer]
        col = [lin('#c9a0b0'), lin('#8a5f82'), lin('#2a1f38')][layer]
        cols_h = np.zeros(w, np.float32); cols_id = np.zeros(w, np.int32); edge = np.zeros(w, np.float32); bid = 0; x = 0.0
        while x < w:
            bw = rng.uniform(*bw_deg) / deg_per_px
            hh = (0.2 + 0.8 * rng.rand() ** 1.7) * hmax
            if rng.rand() < 0.08: hh = hmax * rng.uniform(0.95, 1.3)                       # a tower
            xa, xb = int(x), int(min(w, x + bw)); cols_h[xa:xb] = hh; cols_id[xa:xb] = bid
            if bw > 6 and rng.rand() < 0.4:                                                   # a setback: a narrower, taller top
                cols_h[xa + int(bw * 0.25):xa + int(bw * 0.75)] = hh + rng.uniform(0.12, 0.45)
            edge[xa:min(xa + max(2, int(0.06 / deg_per_px)), xb)] = 1.0                       # the edge that faces the sun
            bid += 1; x += bw + rng.uniform(0.0, 0.04) / deg_per_px
        inside = (el_rows[:, None] < (base_el + cols_h)[None, :]) & (el_rows[:, None] > base_el - 8)
        tone = 1.0 + 0.10 * np.random.RandomState(seed + 3 + layer).randn(1, w, 1).astype(np.float32)
        body = np.broadcast_to(col * tone, (sh, w, 3)).copy()
        # a little lighter towards the foot of the buildings (haze), sunlit edges
        foot = smooth(base_el + 0.9, base_el - 1.2, el_rows)[:, None, None]                        # 0 on the roofs .. 1 at the foot: the buildings melt into the haze
        body = body * (1 - 0.92 * foot) + hz_col[None, None, :] * 0.8 * foot
        body = body + lin('#ff9a5a')[None, None, :] * (edge[None, :, None] * 0.30 * (layer + 1) / 3.0) * (1 - foot)
        # lit windows: small, sparse, warm
        yy = (el_rows[:, None] - base_el) / 0.16; xx = np.arange(w)[None, :] * deg_per_px / 0.11
        wgrid = ((np.floor(yy) + cols_id[None, :] * 5) % 2 == 0) & ((np.floor(xx) % 2) == 0)
        lit_w = wgrid & (np.random.RandomState(seed + 20 + layer).rand(sh, w) < [0.0, 0.05, 0.10][layer]) & (yy > 0.5)
        warm = np.array([1.0, 0.76, 0.42], np.float32)[None, None, :] * (0.9 + 0.8 * np.random.RandomState(seed + 9).rand(sh, w, 1))
        body = np.where(lit_w[..., None] & (foot < 0.5), warm * [0.0, 0.35, 0.6][layer], body)
        hazef = (haze * [0.80, 0.38, 0.04][layer])
        body = body * (1 - hazef) + hz_col[None, None, :] * hazef
        m = cv2.GaussianBlur(inside.astype(np.float32), (0, 0), 0.7)[..., None]
        sub = sub * (1 - m) + body * m
    sky[r0:r1] = sub
    return sky

def blur_sky_for_light(sky, factor=8):
    """a small version for the lighting (the image seen by the camera is the big one)"""
    h, w, _ = sky.shape
    return cv2.resize(sky, (w // factor, h // factor), interpolation=cv2.INTER_AREA)


def cached(path, fn):
    """the sky takes a minute to make: keep it as a file (the sun direction is stored with it)"""
    import os
    if os.path.exists(path):
        z = np.load(path); return z['sky'], z['sd']
    sky, sd = fn(); os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    np.savez(path, sky=sky, sd=sd); return sky, sd

def day_sky(w=6144, h=3072, sun_az=25.0, sun_el=22.0, seed=7, cloud_cover=0.45, sky_scale=1.0, sun_E=0.0, sun_col=(1.0, 0.92, 0.78)):
    """a clear afternoon: blue gradient, soft white clouds, a hazy horizon, a glow round the sun"""
    AZ, EL = _dirs(h, w)
    el = np.degrees(EL); az = np.degrees(AZ)
    sky = grad(el, [(-90, '#c4d4d0'), (-2, '#c9dff0'), (1, '#cfe3f3'), (6, '#a9d0ee'), (18, '#7fb3ea'), (40, '#4f8fdc'), (90, '#2f68c4')])
    sa, se = math.radians(sun_az), math.radians(sun_el)
    sd = np.array([math.sin(sa) * math.cos(se), math.sin(se), math.cos(sa) * math.cos(se)], np.float32)
    dx = np.cos(EL) * np.sin(AZ); dy = np.sin(EL); dz = np.cos(EL) * np.cos(AZ)
    cosang = np.clip(dx * sd[0] + dy * sd[1] + dz * sd[2], -1, 1); ang = np.degrees(np.arccos(cosang))
    glow = np.exp(-(ang / 10.0) ** 2) * 2.0 + np.exp(-(ang / 35.0) ** 2) * 0.5
    sky = sky * (1.0 + glow[..., None] * np.array([1.0, 0.85, 0.6], np.float32)[None, None, :] * 0.9) * 2.0 * sky_scale
    cd = clouds(AZ, EL, seed, cloud_cover, 2.6, (3.0, 60.0), stretch=2.5)
    lit = np.clip(0.55 + 0.45 * np.cos(np.radians(az - sun_az)), 0, 1)
    ccol = lin('#f4f6fa')[None, None, :] * (0.65 + 0.5 * lit[..., None]) * 2.6
    sky = sky * (1 - 0.8 * cd[..., None]) + ccol * 0.8 * cd[..., None] * sky_scale
    if sun_E > 0:
        disc = np.exp(-(ang / 0.42) ** 2); omega = (2 * math.pi / w) * (math.pi / h) * np.cos(EL)
        sky = sky + (disc * (sun_E / float((disc * omega).sum())))[..., None] * np.array(sun_col, np.float32)[None, None, :]
    return sky.astype(np.float32), sd

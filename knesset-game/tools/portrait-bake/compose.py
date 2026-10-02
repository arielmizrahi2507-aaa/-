import os, sys, json, time, numpy as np, cv2
from scipy.interpolate import RBFInterpolator
import rend2 as R
from rend2 import *
import geom
import hair3 as H3
import beard3 as B3

try: SPEC = json.load(open(os.path.join(R.HERE, 'spec.json')))
except Exception: SPEC = {}

def default_spec(L):
    mood = float(L.get('mood', 0.0))
    sp = {'mood': float(np.clip(mood * 0.28, -0.85, 0.85)), 'smile_teeth': bool(L.get('teeth')), 'smile_k': 1.0 if L.get('teeth') else 0.35}
    return sp

class Canvas:
    def __init__(self): self.P = np.zeros((SS, SS, 3), np.float32); self.A = np.zeros((SS, SS), np.float32)
    def over(self, rgb, a):
        a = np.clip(a, 0, 1); a3 = a[:, :, None]; rgb = np.asarray(rgb, np.float32)
        if rgb.ndim == 1: rgb = rgb[None, None, :]
        self.P = self.P * (1 - a3) + rgb * a3; self.A = self.A * (1 - a) + a
    def add_alpha(self, a): self.A = np.clip(self.A + a - self.A * a, 0, 1)

def ear_alpha(h):
    out = np.zeros((SS, SS), np.float32)
    for sg, (x0, y0, x1, y1) in zip((-1, 1), ear_geometry(h)):
        w = max(x1 - x0, 0.14 * I); hg = min(max(y1 - y0, 0.55 * I), 0.86 * I); w = min(w, 0.30 * I); cx = (x0 + x1) / 2 - sg * 0.02 * I; cy = (y0 + y1) / 2
        t = np.linspace(0, 2 * np.pi, 80, endpoint=False); ex = (w / 2) * np.sin(t) * (1 + 0.20 * np.cos(t)); ey = -(hg / 2) * np.cos(t)
        out = np.maximum(out, poly_mask(np.stack([cx + ex, cy + ey], 1), 1.0))
    return out

def caricature_warp(P, A, M_src, K):
    """warp the premultiplied image so that the landmark layout becomes MEAN + K (M - MEAN)"""
    if abs(K - 1.0) < 1e-3: return P, A
    M_dst = geom.MEAN + K * (M_src - geom.MEAN)
    src = px(M_src)[:, :2]; dst = px(M_dst)[:, :2]
    # anchors: points on rings around the head keep their place (the warp fades out)
    ring = []
    for rr, nn in ((2.0, 24), (2.8, 24), (3.8, 24)):
        for t in np.linspace(0, 2 * np.pi, nn, endpoint=False):
            ring.append([CX + rr * I * np.cos(t), EY + 0.1 * I + rr * I * np.sin(t) * 1.15])
    ring = np.array(ring)
    d_src = np.vstack([src, ring]); d_dst = np.vstack([dst, ring])
    rbf = RBFInterpolator(d_dst, d_src - d_dst, kernel='thin_plate_spline', smoothing=8.0)
    g = 8
    gy, gx = np.mgrid[0:SS:g, 0:SS:g].astype(np.float32)
    disp = rbf(np.stack([gx.ravel(), gy.ravel()], 1)).reshape(gx.shape + (2,)).astype(np.float32)
    dxm = cv2.resize(disp[:, :, 0], (SS, SS), interpolation=cv2.INTER_CUBIC); dym = cv2.resize(disp[:, :, 1], (SS, SS), interpolation=cv2.INTER_CUBIC)
    mapx = XX + dxm; mapy = YY + dym
    P2 = cv2.remap(P, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    A2 = cv2.remap(A, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return P2, A2

EXPO = 0.80

def render_portrait(id, K=1.0, seed=0, verbose=True, eyes='open', mouth='smile'):
    t0 = time.time()
    h = Head(id); h.spec = default_spec(h.L); h.spec.update(SPEC.get(id, {}))
    L = h.L
    skin = render_head(h, eyes, mouth)
    cheek = np.zeros((SS, SS), np.float32)
    for sg in (-1, 1): cheek += gauss(CX + sg * 0.62 * I, EY + 0.62 * I, 0.20 * I, 0.14 * I) * h.m_head
    k = calib_scale(skin, cheek > 0.5, hexlin(L['skin']) * float(h.spec.get('skin_exposure', 0.93)))
    skin = skin * k
    skin = paint_mouth_interior(skin, h)
    h.skin_img = skin
    skin = draw_eye(skin, h, 'R'); skin = draw_eye(skin, h, 'L'); skin = draw_brows(skin, h)
    head_a = np.clip(h.m_head + h.m_neck + ear_alpha(h), 0, 1)
    cv = Canvas()
    cv.over(skin, head_a)
    cloth, cloth_a = draw_clothes(h)
    cv.over(cloth, cloth_a * (1 - h.m_head))
    # facial hair
    bd = L.get('beard')
    if bd:
        cv.P, a = (B3.draw_stubble3 if bd.get('stub') else B3.draw_beard3)(cv.P, h, bd); cv.add_alpha(a)
    elif float(L.get('stubble', 0)) > 0.05:
        cv.P = draw_stubble(cv.P, h, float(L['stubble']))
    st = L.get('stache') or (bd and bd.get('color'))
    if L.get('stache'):
        cv.P, a = draw_stache(cv.P, h, L['stache']); cv.add_alpha(a)
    cv.P = draw_glasses(cv.P, h)
    cv.P, a = H3.draw_hair3(cv.P, h, seed=5 + seed); cv.add_alpha(a)
    cv.P, a = draw_kippah(cv.P, h); cv.add_alpha(a)
    cv.P = draw_earring(cv.P, h)
    if verbose: print(id, 'rendered', round(time.time() - t0, 1), 's')
    P, A = caricature_warp(cv.P, cv.A, h.M, K)
    return P, A, h

def to_srgb_rgba(P, A):
    C = np.where(A[:, :, None] > 1e-3, P / np.maximum(A[:, :, None], 1e-3), 0)
    return lin2srgb(np.clip(C, 0, 1)), A

def crop_final(img, A, size=512):
    x0, x1 = int(CX - 2.5 * I), int(CX + 2.5 * I); y0 = int(EY - 2.1 * I); y1 = y0 + (x1 - x0)
    c = img[y0:y1, x0:x1]; a = A[y0:y1, x0:x1]
    c = cv2.resize(c * a[:, :, None], (size, size), interpolation=cv2.INTER_AREA); a = cv2.resize(a, (size, size), interpolation=cv2.INTER_AREA)
    c = np.where(a[:, :, None] > 1e-3, c / np.maximum(a[:, :, None], 1e-3), 0)
    return np.clip(c, 0, 1), a

def preview(id, K=1.0, name=None, eyes='open', mouth='smile'):
    """the 512 px portrait composited on a dark gradient, plus the straight colour and the alpha"""
    P, A, h = render_portrait(id, K, eyes=eyes, mouth=mouth)
    img, a = to_srgb_rgba(P, A)
    c, a2 = crop_final(img, a, 512)
    bg = np.zeros((512, 512, 3), np.float32); yy, xx = np.mgrid[0:512, 0:512]; r = np.hypot(xx - 256, yy - 256) / 256; bg[:] = (0.25 - 0.1 * r)[:, :, None] * np.array([0.9, 1.0, 1.15])
    comp = c * a2[:, :, None] + bg * (1 - a2[:, :, None])
    return comp, c, a2

if __name__ == '__main__':
    ids = sys.argv[1].split(','); K = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    tiles = []
    for id in ids:
        comp, c, a2 = preview(id, K)
        tiles.append((comp * 255).astype(np.uint8))
        cv2.imwrite('p_%s.png' % id, cv2.cvtColor((comp * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    cv2.imwrite('p_sheet.png', cv2.cvtColor(np.hstack(tiles), cv2.COLOR_RGB2BGR))

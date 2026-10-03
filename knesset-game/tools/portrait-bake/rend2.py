# Realistic portrait renderer v2: the face geometry comes from the measured landmarks (symmetrised), everything else is procedural.
import os, sys, json, numpy as np, cv2
from scipy.interpolate import RBFInterpolator
from paint import poly_mask, line_mask, smooth_curve, blur, over
import geom

SS = 1024; I = 150.0; CX = 512.0; EY = 520.0
TUNE = json.loads(os.environ.get('TUNE', '{}'))
def T(k, d=1.0): return float(TUNE.get(k, d))
YY, XX = np.mgrid[0:SS, 0:SS].astype(np.float32)
HERE = os.path.dirname(os.path.abspath(__file__))
LOOKS = json.load(open(os.path.join(HERE, 'looks.json')))

# ---------------------------------------------------------------------------------------------------------------- colour
def srgb2lin(c):
    c = np.asarray(c, np.float32); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)
def lin2srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055).astype(np.float32)
def hexlin(h):
    h = h.lstrip('#'); return srgb2lin(np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32))
def lum(c): return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------------------------------------------------------- noise
_NOISE = {}
def noise(seed, scale):
    k = (seed, scale)
    if k not in _NOISE:
        r = np.random.RandomState(seed); a = r.randn(SS // scale + 2, SS // scale + 2).astype(np.float32)
        _NOISE[k] = cv2.resize(a, (SS, SS), interpolation=cv2.INTER_CUBIC)
    return _NOISE[k]
def fbm(seed, scales, weights=None):
    out = np.zeros((SS, SS), np.float32); weights = weights or [1.0] * len(scales)
    for i, (s, w) in enumerate(zip(scales, weights)): out += w * noise(seed + i * 17, s)
    return out / (sum(abs(w) for w in weights) ** 0.5)

def gauss(cx, cy, sx, sy, rot=0.0):
    dx, dy = XX - cx, YY - cy
    if rot:
        c, s = np.cos(rot), np.sin(rot); dx, dy = c * dx + s * dy, -s * dx + c * dy
    return np.exp(-0.5 * ((dx / sx) ** 2 + (dy / sy) ** 2)).astype(np.float32)
def gline(p0, p1, w, n=20):
    out = np.zeros((SS, SS), np.float32)
    for t in np.linspace(0, 1, n):
        c = (1 - t) * np.asarray(p0, float) + t * np.asarray(p1, float); out = np.maximum(out, gauss(c[0], c[1], w, w))
    return out
def gpoly(pts, w, n=8):
    """a soft ridge along a polyline"""
    out = np.zeros((SS, SS), np.float32); pts = np.asarray(pts, float)
    for a, b in zip(pts[:-1], pts[1:]): out = np.maximum(out, gline(a, b, w, n))
    return out

# ---------------------------------------------------------------------------------------------------------------- masks
def clean(mask, close=7, open_=3, blur_s=1.6, keep_largest=True):
    m8 = (mask > 0.5).astype(np.uint8)
    if close > 1: m8 = cv2.morphologyEx(m8, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
    if open_ > 1: m8 = cv2.morphologyEx(m8, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_, open_)))
    if keep_largest:
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m8)
        if n > 1: m8 = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return smoothstep(0.35, 0.65, blur(m8.astype(np.float32), blur_s))

def fill_holes(mask):
    m8 = (mask > 0.5).astype(np.uint8); inv = 1 - m8; h, w = m8.shape
    ff = inv.copy(); cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
    return np.maximum(mask, (ff == 1).astype(np.float32))

OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

def px(M): return np.stack([CX + M[:, 0] * I, EY + M[:, 1] * I], 1)

def keep_near(mask, limit=1.75 * I, ymin=None, ymax=None):
    """keep only the connected components that are close to the head (the parse also finds other people in the photo)"""
    m8 = (mask > 0.5).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m8)
    out = np.zeros_like(mask)
    for k in range(1, n):
        cx_, cy_ = cent[k]
        if abs(cx_ - CX) < limit and stats[k, cv2.CC_STAT_AREA] > 150: out[lab == k] = 1.0
    return out * mask

def row_profile(mask, y0, y1):
    """half width about the axis of every row (the extent of the mask): fills notches, makes the shape symmetric"""
    prof = np.zeros(SS, np.float32)
    for y in range(max(0, int(y0)), min(SS, int(y1))):
        xs = np.nonzero(mask[y] > 0.5)[0]
        if len(xs): prof[y] = max(CX - xs.min(), xs.max() - CX)
    return prof

def profile_mask(prof, smooth=5.0, y_first=None):
    from scipy.ndimage import gaussian_filter1d
    p = gaussian_filter1d(prof, smooth)
    m = (np.abs(XX - CX) <= p[:, None]).astype(np.float32)
    return clean(m, 3, 1, 1.3, keep_largest=False)

_OW = None
def _outline_weight():
    """per landmark: 0 inside the face, 1 on its outline (from the mean mesh): where to exaggerate the face shape"""
    global _OW
    if _OW is None:
        M = geom.MEAN[:, :2]
        poly = M[OVAL]; c = np.array([0.0, 0.75])
        ang = np.arctan2(poly[:, 1] - c[1], poly[:, 0] - c[0]); rad = np.hypot(poly[:, 0] - c[0], poly[:, 1] - c[1])
        o = np.argsort(ang); ang, rad = ang[o], rad[o]
        ang = np.concatenate([ang - 2 * np.pi, ang, ang + 2 * np.pi]); rad = np.concatenate([rad, rad, rad])
        d = M - c; a = np.arctan2(d[:, 1], d[:, 0]); ratio = np.hypot(d[:, 0], d[:, 1]) / np.interp(a, ang, rad)
        _OW = smoothstep(0.62, 0.95, ratio).astype(np.float32)
    return _OW

class Head:
    """everything derived from the photo for one person: landmarks, masks, colours"""
    def __init__(self, id):
        self.id = id; self.L = LOOKS[id]; self.age = float(self.L.get('age', 0.4))
        Ms = geom.SYM[id].copy()
        # a face that looks into the camera keeps its own asymmetry (a higher brow, a lopsided mouth); a turned one is symmetrised from its visible half
        self.asym_keep = T('asym', 1.0) * float(np.clip((0.22 - abs(geom.info[id]['asym'])) / 0.12, 0, 1))
        asym_vec = self.asym_keep * (geom.RAW[id] - Ms) * 0.8
        # caricature of the measured face: the outline (jaw, chin, cheeks, forehead) is exaggerated more than the inside (eyes, nose, mouth), which keeps its measured place;
        # photos of turned heads and faces hidden by a beard are less certain, so they are exaggerated less
        self.K = float(os.environ.get('KMESH', '1.1'))
        K_out = float(os.environ.get('KOUT', T('kout', 2.4))); K_in = float(os.environ.get('KIN', T('kin', 1.5)))
        asym = abs(geom.info[id]['asym']); rel = 1.0 if asym < 0.2 else (0.85 if asym < 0.5 else 0.7)
        bd = self.L.get('beard')
        if bd and not bd.get('stub') and float(bd.get('len', 0)) > -0.2: rel *= 0.8
        rel *= float(self.L.get('kscale', 1.0))
        w_out = _outline_weight()
        Kp = (K_in + (K_out - K_in) * w_out)
        Kp = 1.0 + (Kp - 1.0) * rel
        Ky = 1.0 + (Kp - 1.0) * T('ky', 0.5)                                                  # the length of the face is exaggerated less than its width (a very long face looks wrong)
        D_ = Ms - geom.MEAN
        self.M = geom.MEAN + np.stack([Kp * D_[:, 0], Ky * D_[:, 1], Kp * D_[:, 2]], 1) + asym_vec      # the shape is exaggerated, the natural asymmetry is not
        self.M[:, 2] = Ms[:, 2]
        ax = np.abs(self.M[:, 0]); wide = 1 + 0.05 * smoothstep(0.7, 1.2, ax) + 0.05 * smoothstep(0.7, 1.6, self.M[:, 1]) * smoothstep(0.3, 1.0, ax)
        self.M[:, 0] = self.M[:, 0] * wide
        self.P = px(self.M)
        hp = json.load(open(os.path.join(HERE, 'hp.json'))).get(id)
        parse = bool(hp and (hp.get('parse') or id in os.environ.get('NOHP', '').split(',')))      # the silhouette of the head and the hair as the face-parsing found it on the photo (a shape, no pixels)
        lab = np.load(os.path.join(geom.DATA, 'lab_%s.npy' % id))
        K = lambda *ks: np.isin(lab, ks).astype(np.float32)
        self.lab = lab
        P = self.P
        self.m_face = clean(fill_holes(K(1, 2, 3, 4, 5, 6, 10, 11, 12, 13)), 9, 5)
        hair0 = keep_near(clean(K(17), 7, 3, 1.2, keep_largest=False))
        if parse:                                                   # parts of the background / other people that the parse took for hair are cut away ('keep': the outline of the real hair, 'cut': polygons to remove, 'add': polygons to add), all in eye distances from the eye centre
            ptsp = lambda poly: np.array([[CX + x * I, EY + y * I] for x, y in poly])
            if hp.get('keep'): hair0 = hair0 * poly_mask(smooth_curve(ptsp(hp['keep']), 200, closed=True), 1.0)
            for poly in hp.get('cut', []): hair0 = hair0 * (1 - poly_mask(ptsp(poly), 1.0))
            for poly in hp.get('add', []): hair0 = np.maximum(hair0, poly_mask(ptsp(poly), 1.0))
        self.m_hair = clean(fill_holes(hair0), 9, 3, 1.4, keep_largest=False)
        if parse and (hp.get('sym') or os.environ.get('SYM')):                  # a hair mass that the photo hides on one side (a hand, an arm, the turn of the head) is completed from the other side
            self.m_hair = clean(fill_holes(np.maximum(self.m_hair, np.roll(self.m_hair[:, ::-1], 1, axis=1))), 7, 3, 1.4, keep_largest=False)
        self.m_hat = clean(K(18), 5, 3, 1.4)
        self.m_ears = clean(keep_near(K(7, 8)), 5, 3, 1.2, keep_largest=False)
        self.m_glasses = K(6)
        oval = poly_mask(smooth_curve(P[OVAL], 120, closed=True), 1.2)
        self.m_oval = oval
        if parse:                                                  # the parsed hair: a smooth outline for straight hair, and no strands over the middle of the cheeks (the photo's wind or hand put them there)
            psm = float(hp.get('psm', os.environ.get('PSM', 0)))
            if psm > 0: self.m_hair = clean(fill_holes((blur(self.m_hair, psm) > 0.5).astype(np.float32)), 5, 3, 1.4, keep_largest=False)
            core = cv2.erode((oval > 0.5).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(float(hp.get('core', 0.15)) * I) + 1,) * 2)).astype(np.float32) * (YY > EY - 0.42 * I)
            self.m_hair = self.m_hair * (1 - blur(core, 3))
        # the skin silhouette of the head: the landmark oval + the parsed face and bald scalp above the eyes; a skull is convex and symmetric
        above = (YY < EY + 0.15 * I).astype(np.float32)
        top = np.clip(self.m_face * above, 0, 1)
        head = clean(fill_holes(np.clip(oval + top, 0, 1)), 7, 3, 1.4)
        ytop = np.nonzero(head.max(1) > 0.5)[0].min()
        prof = row_profile(head, ytop, P[152, 1])
        # above the temples the profile must not shrink as we go down (a skull is wider lower down); below it follows the oval
        yt = int(EY - 0.2 * I); run = np.maximum.accumulate(prof[:yt + 1]); prof2 = prof.copy(); prof2[:yt + 1] = run
        self.m_head = clean(profile_mask(prof2, 4.0) * (YY < P[152, 1] + 40), 3, 1, 1.3)
        sh = np.clip(self.m_head + self.m_hair + self.m_hat, 0, 1)
        ytop2 = np.nonzero(sh.max(1) > 0.5)[0].min()
        prof_sh = row_profile(sh, ytop2, EY + 1.1 * I)
        yt2 = int(EY - 0.1 * I); run2 = np.maximum.accumulate(prof_sh[:yt2 + 1]); prof_sh[:yt2 + 1] = run2
        self.m_skullhair = clean(np.clip(profile_mask(prof_sh, 5.0) * (YY < EY + 1.1 * I) + sh, 0, 1), 5, 1, 1.4)
        self.top_y = float(ytop2)
        if parse: hp = None
        if hp:                                                    # a hand-made parametric silhouette replaces the parsed one
            import hairmodel as HM
            hp = dict(hp)
            ov = smooth_curve(P[OVAL][:, :2], 300, closed=True); fwh = 0.0                     # the hair outline must stay outside a wider face
            for yy_ in (-0.25, 0.0, 0.3):
                xs = []
                for p0, p1 in zip(ov[:-1], ov[1:]):
                    if (p0[1] - (EY + yy_ * I)) * (p1[1] - (EY + yy_ * I)) <= 0 and p0[1] != p1[1]:
                        t_ = ((EY + yy_ * I) - p0[1]) / (p1[1] - p0[1]); xs.append(abs(p0[0] + t_ * (p1[0] - p0[0]) - CX))
                if xs: fwh = max(fwh, max(xs) / I)
            hp['w'] = max(hp['w'], fwh + 0.10)
            mk = HM.build_masks(hp, P)
            self.m_head, self.m_hair, self.m_skullhair = mk['head'], mk['hair'], mk['skullhair']
            self.top_y = float(np.nonzero(self.m_skullhair.max(1) > 0.5)[0].min())
            self.hp = hp

# ---------------------------------------------------------------------------------------------------------------- landmark groups
EYE_UP = {'R': [33, 246, 161, 160, 159, 158, 157, 173, 133], 'L': [263, 466, 388, 387, 386, 385, 384, 398, 362]}
EYE_LO = {'R': [33, 7, 163, 144, 145, 153, 154, 155, 133], 'L': [263, 249, 390, 373, 374, 380, 381, 382, 362]}
BROW_UP = {'R': [70, 63, 105, 66, 107], 'L': [300, 293, 334, 296, 336]}
BROW_LO = {'R': [46, 53, 52, 65, 55], 'L': [276, 283, 282, 295, 285]}

# ---------------------------------------------------------------------------------------------------------------- geometry helpers
def curve(pts, n=40): return smooth_curve(np.asarray(pts, float), n)

def neck_mask(h):
    P = h.P; L = h.L
    jl, jr = P[132, 0], P[361, 0]; w = (jr - jl) * (T('neckw', 0.74) + 0.07 * (float(L.get('neck', 1.0)) - 1.0))
    y0 = P[152, 1] - 0.55 * I; y1 = SS + 20
    poly = np.array([[CX - w / 2, y0], [CX + w / 2, y0], [CX + w * 0.54, EY + 2.4 * I], [CX + w * 0.62, y1], [CX - w * 0.62, y1], [CX - w * 0.54, EY + 2.4 * I]])
    return poly_mask(poly, 3.0)

def ear_geometry(h):
    """(left, right) ear boxes (x0, y0, x1, y1) in px, from the parsed ear labels (or sensible defaults)"""
    m = h.m_ears > 0.5
    P = h.P; res = []
    for sg in (-1, 1):
        half = m & ((XX < CX) if sg < 0 else (XX >= CX))
        if half.sum() > 400:
            ys, xs = np.nonzero(half); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        else:
            xe = CX + sg * (abs(P[234, 0] - CX) + 0.05 * I); x0, x1 = (xe, xe + 0.22 * I) if sg > 0 else (xe - 0.22 * I, xe); y0, y1 = EY - 0.15 * I, EY + 0.72 * I
        res.append((float(x0), float(y0), float(x1), float(y1)))
    return res

# ---------------------------------------------------------------------------------------------------------------- the height field
def mesh_relief(h):
    M = h.M; P = h.P
    z = M[:, 2] * I
    rbf = RBFInterpolator(P[:, :2], z, kernel='thin_plate_spline', smoothing=T('rbfs', 90.0))
    g = 8
    gy, gx = np.mgrid[0:SS:g, 0:SS:g].astype(np.float32)
    zc = rbf(np.stack([gx.ravel(), gy.ravel()], 1)).reshape(gx.shape).astype(np.float32)
    Z = blur(cv2.resize(zc, (SS, SS), interpolation=cv2.INTER_CUBIC), 5.0)
    hull = np.zeros((SS, SS), np.uint8); cv2.fillConvexPoly(hull, cv2.convexHull(P[:, :2].astype(np.int32)), 1)
    hd = cv2.distanceTransform(hull, cv2.DIST_L2, 5)
    w = smoothstep(0.02 * I, 0.34 * I, hd)
    low = blur(np.where(hull > 0, Z, 0), 60) / np.maximum(blur(hull.astype(np.float32), 60), 1e-3)
    return (Z - low) * w, w

def build_height(h):
    P, L = h.P, h.L
    nk = neck_mask(h); h.m_neck = nk
    body = np.clip(h.m_head + nk + h.m_ears * 0, 0, 1)
    D = cv2.distanceTransform((body > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    R = 300.0
    infl = blur(R * np.sqrt(np.clip(1 - (1 - np.minimum(D, R) / R) ** 2, 0, 1)) * 0.52, 5)
    rel, wface = mesh_relief(h)
    Z = infl + rel * 0.95
    h.Z_infl = infl
    # the neck is set back behind the jaw
    nonly = np.clip(nk - h.m_head, 0, 1)
    Z -= 70 * blur(nonly, 12) * smoothstep(P[152, 1] - 0.45 * I, P[152, 1] + 0.1 * I, YY)
    fore = float(L.get('fore', 1.0)); ridge = float(L.get('ridge', 1.0)); cheek = float(L.get('cheek', 1.0)); chin = float(L.get('chin', 1.0)); lips = float(L.get('lips', 1.0)); nose = float(L.get('nose', 1.0)); jaw = float(L.get('jaw', 1.0))
    # personal volume on top of the measured relief
    Z += 10 * (fore - 1) * gauss(CX, EY - 0.95 * I, 0.65 * I, 0.4 * I) * 2
    for sg in (-1, 1):
        Z += 14 * (cheek - 0.8) * gauss(CX + sg * 0.62 * I, EY + 0.62 * I, 0.30 * I, 0.25 * I)
        Z += 8 * ridge ** 0.7 * gline((CX + sg * 0.20 * I, EY - 0.40 * I), (CX + sg * 0.95 * I, EY - 0.34 * I), 0.10 * I)              # the brow ridge
        Z -= 14 * gauss(CX + sg * 0.50 * I, EY + 0.02 * I, 0.30 * I, 0.17 * I)                                                         # the eye sockets
        Z -= 8 * gauss(CX + sg * 1.12 * I, EY - 0.18 * I, 0.16 * I, 0.30 * I)                                                          # the temples
    Z += 12 * (chin) * gauss(CX, P[152, 1] - 0.20 * I, 0.22 * I, 0.17 * I)                                                              # the chin ball
    jowl = float(L.get('jowl', 0.0)) * T('jowl', 1.0)
    if jowl > 0:                                                                                                                          # jowls: soft bulges beside the chin, a groove between them and the chin
        for sg in (-1, 1):
            Z += 10 * jowl * gauss(CX + sg * 0.70 * I, P[152, 1] - 0.20 * I, 0.24 * I, 0.17 * I)
            Z -= 5 * jowl * gauss(CX + sg * 0.38 * I, P[152, 1] - 0.27 * I, 0.09 * I, 0.14 * I)
    Z -= 5 * gauss(CX, P[17, 1] + 0.10 * I, 0.18 * I, 0.04 * I)                                                                          # the groove under the lower lip
    Z += ear_relief(h)
    Z += nose_relief(h)
    mid_w = np.exp(-0.5 * ((XX - CX) / (0.28 * I)) ** 2) * smoothstep(P[2, 1], P[2, 1] + 0.25 * I, YY) * (1 - smoothstep(P[152, 1] + 0.1 * I, P[152, 1] + 0.5 * I, YY))
    Z = Z * (1 - mid_w) + cv2.GaussianBlur(Z, (0, 0), sigmaX=0.16 * I, sigmaY=2.0) * mid_w
    h.Z_base = Z
    h.wface = wface
    return Z

def nose_relief(h):
    """the nose as a few primitives placed on the measured landmarks: the dorsum, the tip bulb and the wings (alae); sizes from the look's own nose numbers"""
    P, L = h.P, h.L
    nz = float(L.get('nose', 1.0)); nw = float(L.get('noseW', 1.0)); nl = float(L.get('noseL', 1.0))
    sc = T('nosek', 1.8) * (0.55 + 0.45 * nz)
    out = np.zeros((SS, SS), np.float32)
    path = P[[168, 6, 197, 195, 5, 4, 1]][:, :2].astype(float)
    n = 28
    pts = smooth_curve(path, n)
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1)
        amp = (5.0 + 13.0 * t ** 1.4) * sc
        sx = (0.105 + 0.030 * t) * I * (0.78 + 0.22 * nw); sy = (0.060 + 0.020 * t) * I
        out = np.maximum(out, amp * gauss(x, y, sx, sy))
    tip = P[1]
    out += 11.0 * sc * gauss(tip[0], tip[1] - 0.005 * I, 0.080 * I * (0.7 + 0.3 * nw), 0.062 * I)
    for sg, idx in ((-1, 129), (1, 358)):
        a = P[idx]
        out += 8.5 * sc * gauss(CX + sg * (abs(a[0] - CX) * 0.82), a[1] - 0.015 * I, 0.058 * I, 0.060 * I)
    return out

def ear_relief(h):
    """a simple ear: a raised rim (helix), a hollow (concha), the tragus bump and the lobe; placed on the parsed ear boxes"""
    out = np.zeros((SS, SS), np.float32)
    boxes = ear_geometry(h)
    size = float(h.L.get('ear', 1.0))
    for sg, (x0, y0, x1, y1) in zip((-1, 1), boxes):
        w = max(x1 - x0, 0.14 * I); hgt = max(y1 - y0, 0.55 * I)
        hgt = min(hgt, 0.86 * I); w = min(w, 0.30 * I)
        cx = (x0 + x1) / 2 - sg * 0.02 * I; cy = (y0 + y1) / 2
        # an egg-shaped mask
        t = np.linspace(0, 2 * np.pi, 80, endpoint=False)
        ex = (w / 2) * np.sin(t) * (1 + 0.20 * np.cos(t)); ey = -(hgt / 2) * np.cos(t)
        em = poly_mask(np.stack([cx + ex, cy + ey], 1), 1.0)
        d = cv2.distanceTransform((em > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
        rim = np.exp(-((d - 0.10 * w) / (0.07 * w)) ** 2) * 16
        bowl = -smoothstep(0.18 * w, 0.40 * w, d) * 14
        base = blur(em, 3) * 14
        # antihelix + tragus
        ah = line_mask(curve([[cx - sg * 0.05 * w, cy - 0.30 * hgt], [cx + sg * 0.12 * w, cy - 0.05 * hgt], [cx - sg * 0.02 * w, cy + 0.18 * hgt]], 20), 3.0, 1.8) * 6
        tr = gauss(cx - sg * 0.40 * w, cy + 0.02 * hgt, 0.10 * w, 0.07 * hgt) * 6
        out += (base + rim + bowl + ah + tr) * em
    return out

def cast_shadow(Z, ldir, steps=56, step_px=2.2, softness=2.5):
    lx, ly, lz = ldir; d = np.array([lx, ly], np.float32); n = np.linalg.norm(d); d2 = d / n; rise = lz / n
    occl = np.full_like(Z, -1e9)
    for k in range(1, steps + 1):
        t = k * step_px
        Mx = np.float32([[1, 0, -d2[0] * t], [0, 1, -d2[1] * t]])
        Zs = cv2.warpAffine(Z, Mx, (SS, SS), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        occl = np.maximum(occl, Zs - t * rise)
    return blur(smoothstep(0, softness, occl - Z), 1.6)

def normals(Z):
    gy, gx = np.gradient(Z); nx, ny, nz = -gx, -gy, np.ones_like(Z)
    n = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2); return nx / n, ny / n, nz / n

LKEY = np.array([-0.50, -0.58, 0.64], np.float32); LKEY /= np.linalg.norm(LKEY)
LFILL = np.array([0.70, -0.05, 0.70], np.float32); LFILL /= np.linalg.norm(LFILL)

LKEY = np.array([-T('lkx', 0.44), -T('lky', 0.42), T('lkz', 0.80)], np.float32); LKEY /= np.linalg.norm(LKEY)

# ---------------------------------------------------------------------------------------------------------------- features: eyes, brows, mouth
def eye_geometry(h, side, open_px):
    """upper / lower lid curves of one eye (canvas px): the corners and the centre line come from the measured mesh, the opening is a template of the given height"""
    P = h.P
    up0 = curve(P[EYE_UP[side]], 40); lo0 = curve(P[EYE_LO[side]], 40)
    mid = (up0 + lo0) / 2
    t = np.linspace(0, 1, len(mid))                                  # 0 = outer corner, 1 = inner corner
    s_up = np.sin(np.pi * np.clip(t, 0, 1)) ** 0.62 * (1 + 0.22 * (t - 0.45)); s_up = s_up / s_up.max()
    s_lo = np.sin(np.pi * np.clip(t, 0, 1)) ** 0.85; s_lo = s_lo / s_lo.max()
    hood = float(h.spec.get('hood', 0.0))
    up = mid + np.stack([0 * t, -(0.60 - 0.34 * hood) * open_px * s_up], 1); lo = mid + np.stack([0 * t, (0.40 + 0.10 * hood) * open_px * s_lo], 1)
    return up, lo

def mouth_params(h):
    P = h.P; L = h.L
    c1, c2 = P[61], P[291]
    f = float(np.clip(0.75 + 0.25 * float(L.get('lips', 1.0)), 0.7, 1.45))
    w = float(np.clip(np.linalg.norm(c2 - c1) / I, 0.70, 1.02)) * float(L.get('mouthW', 1.0)) ** 0.5 * I
    tu = float(np.clip((P[13, 1] - P[0, 1]) / I, 0.070, 0.112)) * f * I
    tl = float(np.clip((P[17, 1] - P[14, 1]) / I, 0.098, 0.165)) * f * I
    seam_y = P[13, 1]
    corner_dy = float(np.clip(((c1[1] + c2[1]) / 2 - seam_y) / I, -0.04, 0.06)) * I
    return dict(w=w, seam_y=seam_y, tu=tu, tl=tl, corner_dy=corner_dy, cx=CX)

def lips_shape(mp, mood=0.0, n=60, open_=0.0, narrow=1.0):
    """outer upper / outer lower / upper-inner (seam) / inner lower curves of the lips, in px"""
    w = mp['w'] * 0.5 * narrow * (1 + 0.06 * max(mood, 0)); cx = mp['cx']; sy = mp['seam_y']; tu = mp['tu']; tl = mp['tl']
    u = np.linspace(-1, 1, n)
    corner = -mood * 0.055 * I + 0.25 * np.clip(mp['corner_dy'], -0.1 * I, 0.1 * I)
    seam = sy + corner * u ** 2
    g = (1 - u ** 2) ** 0.72 + 0.20 * np.exp(-(np.abs(u) - 0.30) ** 2 / 0.010) - 0.17 * np.exp(-u ** 2 / 0.0035)
    h2 = (1 - u ** 2) ** 0.80; h3 = (1 - u ** 2) ** 0.85
    x = cx + u * w
    inner_lo = seam + open_ * h3
    upper = np.stack([x, seam - tu * g], 1); lower = np.stack([x, inner_lo + tl * h2], 1)
    return upper, lower, np.stack([x, seam], 1), np.stack([x, inner_lo], 1)

EXPR_MOUTH = {
    'closed': dict(mood=0.0, open=0.0, narrow=1.0), 'smile': dict(mood=0.55, open=0.0, narrow=1.0), 'sad': dict(mood=-0.7, open=0.0, narrow=0.95),
    'grin': dict(mood=0.95, open=0.115, narrow=1.0), 'shout': dict(mood=0.15, open=0.34, narrow=0.92), 'o': dict(mood=0.0, open=0.15, narrow=0.50),
    'open': dict(mood=0.10, open=0.22, narrow=0.96),
}
EXPR_EYES = {
    'open': dict(open=1.0), 'squint': dict(open=0.55), 'angry': dict(open=0.60, brow_in=0.115, brow_out=-0.025), 'blink': dict(closed=True), 'happy': dict(closed=True, arch=0.05, brow_in=-0.01, brow_out=-0.03),
    'hurt': dict(closed=True, arch=-0.02, brow_in=-0.07, brow_out=0.025, squeeze=1.0), 'ko': dict(closed=True, arch=-0.03, brow_in=0.0, brow_out=0.03),
}

# ---------------------------------------------------------------------------------------------------------------- the skin
def skin_albedo(h):
    L = h.L; P = h.P; age = h.age
    base = hexlin(L['skin'])
    A = np.ones((SS, SS, 3), np.float32) * (base * np.array([1.0, 1.04, T('blue', 1.30)], np.float32))[None, None, :]
    ruddy = float(L.get('ruddy', 0.0)) + 0.10
    # low-frequency colour variation: melanin, blood (red), a yellowish forehead
    n1 = fbm(101, [90, 40, 18], [1.0, 0.7, 0.4]); n2 = fbm(131, [70, 28], [1.0, 0.6])
    red = np.zeros((SS, SS), np.float32)
    for sg in (-1, 1):
        red += 0.55 * gauss(CX + sg * 0.62 * I, EY + 0.50 * I, 0.30 * I, 0.22 * I)              # cheeks
        red += 0.35 * gauss(CX + sg * 1.10 * I, EY + 0.35 * I, 0.14 * I, 0.30 * I)              # ears' side / temples
    red += 0.60 * gauss(CX, P[1, 1] + 0.01 * I, 0.17 * I, 0.14 * I)                              # the nose tip
    for sg in (-1, 1): red += 0.35 * gauss(CX + sg * 0.26 * I, P[2, 1] - 0.03 * I, 0.10 * I, 0.08 * I)  # the wings
    red += 0.18 * gauss(CX, EY - 1.15 * I, 0.6 * I, 0.25 * I)
    red += 0.25 * gauss(CX, P[152, 1] - 0.25 * I, 0.20 * I, 0.14 * I)
    red = (red * (0.5 + ruddy) + 0.10 * n1) * T('red', 0.6)
    A = A * (1 + red[:, :, None] * np.array([0.30, -0.22, -0.20], np.float32)[None, None, :])
    A = A * (1 + 0.05 * n2[:, :, None] * np.array([0.5, 0.35, 0.0], np.float32)[None, None, :]) * (1 + 0.04 * n1[:, :, None])
    mot = fbm(171, [26, 12, 6], [1.0, 0.7, 0.4]) * T('mottle', 1.0)
    A = A * (1 + 0.040 * mot[:, :, None] * np.array([0.9, -0.45, -0.8], np.float32)[None, None, :]) * (1 + 0.025 * mot[:, :, None])
    # under the eyes: a bluish-brown shade, bigger with age and bags
    bags = float(L.get('bags', 0.4)); dark = np.zeros((SS, SS), np.float32)
    for sg in (-1, 1): dark += gauss(CX + sg * 0.50 * I, EY + 0.26 * I, 0.26 * I, 0.075 * I)
    A = A * (1 - dark * (0.10 + 0.22 * bags))[:, :, None] * (1 - dark[:, :, None] * 0.04 * np.array([-1, 0, 1.0], np.float32)[None, None, :])
    # the temples and the sides of the forehead are darker in the shade; the eyelids a bit pinker/darker
    for sg in (-1, 1): A = A * (1 - 0.06 * gauss(CX + sg * 0.5 * I, EY - 0.1 * I, 0.28 * I, 0.06 * I))[:, :, None]
    # beard shadow (clean-shaven men): a bluish-grey tint over the lower face
    st = float(L.get('stubble', 0.0))
    if not L.get('female'):
        shad = smoothstep(EY + 0.45 * I, EY + 1.1 * I, YY) * smoothstep(1.15 * I, 0.8 * I, np.abs(XX - CX)) * h.m_head
        A = A * (1 - (0.05 + 0.20 * st) * shad)[:, :, None] * (1 - ((0.02 + 0.05 * st) * shad)[:, :, None] * np.array([0.6, 0.2, -0.4], np.float32)[None, None, :])
    # personal marks: moles [x, y, radius, strength] (eye distances from the eye centre, y down), freckles {n, k, zone}, red blotches, scars (polylines)
    sp_ = h.spec
    for mx, my, mr, ms in sp_.get('moles', []):
        m_ = gauss(CX + mx * I, EY + my * I, max(1.5, mr * I), max(1.5, mr * I))
        A = A * (1 - 0.62 * ms * m_)[:, :, None] * (np.array([1.0, 0.86, 0.78], np.float32)[None, None, :] ** m_[:, :, None])
    fk = sp_.get('freckles')
    if fk:
        rng = np.random.RandomState(23); fr = np.zeros((SS, SS), np.float32)
        for _ in range(int(fk.get('n', 60))):
            if fk.get('zone', 'cheeks') == 'cheeks':
                x = CX + rng.choice([-1, 1]) * rng.uniform(0.25, 0.95) * I; y = EY + rng.uniform(0.05, 0.62) * I
            else:
                x = CX + rng.uniform(-1.0, 1.0) * I; y = EY + rng.uniform(-1.2, 1.2) * I
            fr = np.maximum(fr, gauss(x, y, rng.uniform(1.4, 3.2), rng.uniform(1.4, 3.2)) * rng.uniform(0.35, 1.0))
        A = A * (1 - 0.30 * float(fk.get('k', 0.6)) * fr)[:, :, None] * (np.array([1.0, 0.90, 0.80], np.float32)[None, None, :] ** fr[:, :, None])
    for bx, by, brx, bry, bs in sp_.get('blotch', []):                                       # a red patch (rosacea, sunburn): centre, radii (eye distances), strength
        bl = gauss(CX + bx * I, EY + by * I, brx * I, bry * I)
        A = A * (1 + bs * bl[:, :, None] * np.array([0.22, -0.20, -0.18], np.float32)[None, None, :])
    for sc in sp_.get('scars', []):
        pts = np.array([[CX + x * I, EY + y * I] for x, y in sc['pts']], np.float32)
        lm = line_mask(pts, float(sc.get('w', 2.4)), 1.0)
        A = A * (1 + float(sc.get('k', 0.35)) * lm[:, :, None] * np.array([0.30, -0.10, -0.05], np.float32)[None, None, :])
    # age spots
    if age > 0.55:
        rng = np.random.RandomState(7); spots = np.zeros((SS, SS), np.float32)
        for _ in range(int(40 * (age - 0.4))):
            x = CX + rng.uniform(-1.0, 1.0) * I; y = EY + rng.uniform(-1.6, 0.9) * I
            spots = np.maximum(spots, gauss(x, y, rng.uniform(2.5, 6), rng.uniform(2.5, 6)) * rng.uniform(0.4, 1.0))
        A = A * (1 - 0.18 * spots)[:, :, None] * np.array([1, 0.94, 0.86], np.float32)[None, None, :] ** spots[:, :, None]
    return A

def nose_detail(h):
    """what makes a nose read in a photograph: the nostril openings (kidney shaped, under the tip), the groove that runs round every wing (ala) and the bright rim of the wing;
    placed on the measured landmarks, the sizes follow the look's noseW"""
    P, L = h.P, h.L
    nw = float(L.get('noseW', 1.0)); wk = float(h.spec.get('nose_detail', 1.0))
    nos = np.zeros((SS, SS), np.float32); groove = np.zeros((SS, SS), np.float32); rim = np.zeros((SS, SS), np.float32)
    ny_ = P[1, 1] * 0.25 + P[2, 1] * 0.75 - 0.010 * I
    for sg, idx in ((-1, 129), (1, 358)):
        a = P[idx]; ax = abs(a[0] - CX)
        c = np.array([CX + sg * (0.100 + 0.022 * (nw - 1.0)) * I, ny_])
        nos = np.maximum(nos, gauss(c[0], c[1], 0.052 * I * (0.88 + 0.12 * nw), 0.022 * I, rot=sg * 0.50))
        s0 = np.array([CX + sg * max(0.46 * ax, 0.13 * I), P[195, 1] + 0.02 * I])
        s1 = np.array([CX + sg * (ax + 0.012 * I), a[1] - 0.045 * I])
        s2 = np.array([CX + sg * (ax + 0.020 * I), a[1] + 0.012 * I])
        s3 = np.array([CX + sg * ax * 0.90, a[1] + 0.060 * I])
        crv = curve([s0, s1, s2, s3], 30)
        groove = np.maximum(groove, line_mask(crv, 4.0, 2.2) * np.linspace(0.55, 1.0, 30).mean() * 1.3)
        rim = np.maximum(rim, gauss(CX + sg * ax * 0.86, a[1] - 0.035 * I, 0.040 * I, 0.022 * I))
    return nos, groove * wk, rim * wk

def wrinkle_field(h, squeeze=0.0, smile=0.0):
    """negative height (px) of the typical wrinkles; strength from age and the look's own numbers; spec 'wr' scales every group (fore, glab, crow, bag, nl, mar)"""
    P = h.P; L = h.L; age = h.age; bags = float(L.get('bags', 0.4)); lid = float(L.get('lid', 0.4))
    W_ = h.spec.get('wr', {}); wk = lambda k, d=1.0: float(W_.get(k, d))
    g = np.zeros((SS, SS), np.float32); rng = np.random.RandomState(11)
    a = 0.25 + 0.75 * age
    brow_y = (P[105, 1] + P[334, 1]) / 2; top = EY - 1.55 * I
    n = int(round((1 + 5 * age) * min(1.7, wk('fore'))))
    for k in range(n):
        y = brow_y - 0.30 * I - k * (brow_y - top - 0.35 * I) / max(n, 1)
        half = (0.80 - 0.05 * k) * I
        cuts = np.sort(rng.uniform(-0.55, 0.55, 2)) * half
        edges = [-half, cuts[0] - 0.05 * half, cuts[0] + 0.07 * half, cuts[1] - 0.05 * half, cuts[1] + 0.07 * half, half]
        for si, (xa, xb) in enumerate(((edges[0], edges[1]), (edges[2], edges[3]), (edges[4], edges[5]))):
            if rng.rand() < 0.22 or xb - xa < 0.15 * I: continue
            xs = np.linspace(CX + xa, CX + xb, 24)
            u = np.linspace(-1, 1, 24)
            ys = y + rng.uniform(-3, 3) - 4.5 * (1 - u ** 2) * np.sign(xa + xb + 1e-3) * 0.0 - 5 * (1 - (np.linspace(CX + xa, CX + xb, 24) - CX) ** 2 / (half ** 2)) + noise(60 + k + si, 12)[int(y), 300:324] * 0.7
            g -= line_mask(np.stack([xs, ys], 1), 2.2, 1.6) * (1.6 + 4.2 * a) * rng.uniform(0.40, 1.0) * wk('fore')
    for (eo, sg) in ((33, -1), (263, 1)):
        for ang in (-0.50, 0.0, 0.46):
            p0 = P[eo] + np.array([sg * 10, 0.0]); ln = (0.16 + 0.12 * a) * I * min(1.4, wk('crow'))
            p1 = p0 + np.array([sg * np.cos(ang), np.sin(ang)]) * ln
            g -= line_mask(np.array([p0, (p0 + p1) / 2 + [0, 3 * np.sign(ang + 1e-3)], p1]), 2.8, 1.8) * (0.8 + 2.4 * a + 3.2 * squeeze + 1.4 * smile) * wk('crow')
    bi = float(h.expr['ee'].get('brow_in', 0.0)) if hasattr(h, 'expr') else 0.0
    bi = bi + 0.055 * wk('glab', 0.0)                                                      # permanent frown lines between the brows
    if bi > 0.05:
        for sg in (-1, 1):
            a0 = np.array([CX + sg * 0.085 * I, brow_y - 0.01 * I]); b0 = np.array([CX + sg * 0.058 * I, brow_y + 0.15 * I])
            g -= line_mask(np.array([a0, (a0 + b0) / 2 + [sg * 0.012 * I, 0], b0]), 4.6, 2.6) * (1.6 + 20.0 * bi)
    for sg, (wing, cor) in ((-1, (129, 61)), (1, (358, 291))):
        a0 = P[wing] + np.array([sg * 8, 12.0]); b0 = P[cor] + np.array([sg * 0.17 * I, 0.0]); mid = (a0 + b0) / 2 + np.array([sg * 0.12 * I, -4.0])
        g -= line_mask(curve([a0, mid, b0], 30), 7.0, 4.2) * (1.6 + 5.2 * a + 2.4 * smile) * wk('nl') * T('fold', 1.0)
    for sg, cor in ((-1, 61), (1, 291)):
        a0 = P[cor] + np.array([sg * 0.075 * I, 0.06 * I]); b0 = a0 + np.array([sg * 0.05 * I, (0.15 + 0.12 * a) * I])
        g -= line_mask(curve([a0, (a0 + b0) / 2 + [sg * 0.045 * I, 0], b0], 20), 5.0, 3.2) * (0.4 + 3.2 * a) * wk('mar') * T('fold', 1.0)
    for sg, side in ((-1, 'R'), (1, 'L')):
        lo = curve(P[EYE_LO[side]], 30) + np.array([0, 0.115 * I])
        g -= line_mask(lo, 5.0, 3.0) * (1.0 + 4.0 * bags + 2.0 * a) * wk('bag')
        up = curve(P[EYE_UP[side]], 30) + np.array([0, -0.075 * I])
        g -= line_mask(up, 3.4, 1.8) * (2.0 + 3.0 * lid)
    ch = wk('chin', 0.0)
    if ch > 0:                                                                              # a crease under the lower lip, a dimple in the chin
        y0 = P[17, 1] + 0.12 * I
        g -= line_mask(curve([[CX - 0.22 * I, y0 - 2], [CX, y0 + 3], [CX + 0.22 * I, y0 - 2]], 20), 3.4, 2.0) * 4.0 * ch
    return g

def fine_skin(h, age):
    """pores and grain: a small relief that makes the light sparkle a little"""
    g = fbm(11, [3, 2], [1.0, 0.7]) * 0.38 + fbm(12, [6], [1.0]) * 0.30
    return g * (0.8 + 0.5 * age)

# ---------------------------------------------------------------------------------------------------------------- the head render
def sss_mix(E, alb):
    out = np.empty_like(alb)
    for c, s in enumerate((9.0, 5.0, 3.0)): out[:, :, c] = alb[:, :, c] * blur(E, s)
    return out


def eyelid_detail(h, geos):
    """the upper lid of a photographed eye: a crease (supratarsal fold) above the lash line, the lid skin between them slightly darker and redder, and a bright ridge of skin above the crease;
    returns (crease, band, ridge) masks"""
    L = h.L; lid = float(L.get('lid', 0.4)); hood = float(h.spec.get('hood', 0.0)); wk = float(h.spec.get('lid_detail', 1.0))
    crease = np.zeros((SS, SS), np.float32); band = np.zeros((SS, SS), np.float32); ridge = np.zeros((SS, SS), np.float32)
    for side, (up, lo) in geos:
        t = np.linspace(0, 1, len(up)); arch = np.sin(np.pi * np.clip(t, 0, 1)) ** 0.8
        off = (0.062 + 0.040 * lid) * I * (1.0 - 0.30 * hood)
        crv = up + np.stack([0 * t, -(off * (0.55 + 0.75 * arch))], 1)
        crease = np.maximum(crease, line_mask(crv, 3.0, 1.5))
        band = np.maximum(band, poly_mask(np.vstack([up, crv[::-1]]), 2.0))
        ridge = np.maximum(ridge, line_mask(crv + np.array([0, -0.030 * I]), 4.0, 3.0))
    return crease * wk, band * wk, ridge * wk

def socket_darkness(h, geos):
    """darkness map (0..~0.5) of the eye sockets: the shade under the brow ridge, the lid, the tear trough and the inner corner"""
    L, age = h.L, h.age
    ridge = float(L.get('ridge', 1.0)); lid = float(L.get('lid', 0.4)); bags = float(L.get('bags', 0.4))
    S_ = np.zeros((SS, SS), np.float32)
    for side, (up, lo) in geos:
        mid = (up + lo) / 2; cx = float(mid[:, 0].mean()); cy = float(mid[:, 1].mean()); w = float(up[:, 0].max() - up[:, 0].min())
        S_ += T('sock', 1.35) * (0.10 + 0.07 * ridge + 0.10 * lid) * gauss(cx, cy - 0.115 * I, 0.62 * w, 0.075 * I)
        S_ += T('sock', 1.35) * (0.05 + 0.10 * lid) * gauss(cx, cy - 0.040 * I, 0.52 * w, 0.040 * I)
        S_ += T('sock', 1.35) * (0.04 + 0.13 * bags * (0.5 + age)) * gauss(cx, cy + 0.165 * I, 0.58 * w, 0.050 * I)
        inner = up[-1] if side == 'R' else up[0]; sgn = 1.0 if side == 'R' else -1.0
        S_ += T('sock', 1.35) * 0.12 * gauss(inner[0] + sgn * 0.05 * I, inner[1] + 0.03 * I, 0.06 * I, 0.10 * I)
    return np.clip(S_, 0, 0.55)

def render_head(h, eyes='open', mouth='smile'):
    """returns the lit skin (linear rgb) of the bare head: skin with lips, ears and the shapes of the eyes; the eyes themselves and the brows are painted afterwards"""
    L, P, age = h.L, h.P, h.age
    ee = EXPR_EYES.get(eyes, EXPR_EYES['open']); em = dict(EXPR_MOUTH.get(mouth, EXPR_MOUTH['closed']))
    sp = h.spec
    if mouth == 'smile':
        em['mood'] = em['mood'] * float(sp.get('smile_k', 1.0)) + float(sp.get('mood', 0.0))
        if sp.get('smile_teeth'): em['open'] = 0.06
    else:
        em['mood'] += float(sp.get('mood', 0.0)) * 0.5
    h.expr = dict(eyes=eyes, mouth=mouth, ee=ee, em=em)
    Z = build_height(h)
    meas = ((P[145, 1] - P[159, 1]) + (P[374, 1] - P[386, 1])) / 2 / I
    target = float(np.clip(meas, 0.078, 0.150)) * float(sp.get('eye_open', 1.0)) * I
    open_px = 0.012 * I if ee.get('closed') else target * ee.get('open', 1.0)
    eyeR_up, eyeR_lo = eye_geometry(h, 'R', open_px); eyeL_up, eyeL_lo = eye_geometry(h, 'L', open_px)
    E_R = poly_mask(np.vstack([eyeR_up, eyeR_lo[::-1][1:-1]]), 0.8); E_L = poly_mask(np.vstack([eyeL_up, eyeL_lo[::-1][1:-1]]), 0.8)
    mp = mouth_params(h)
    lipU, lipL, seam, inner_lo = lips_shape(mp, em['mood'], 60, em['open'] * I, em['narrow'])
    lips_all = poly_mask(np.vstack([lipU, lipL[::-1][1:-1]]), 0.8)
    cavity = poly_mask(np.vstack([seam, inner_lo[::-1][1:-1]]), 0.8) if em['open'] > 0.015 else np.zeros((SS, SS), np.float32)
    lips_m = np.clip(lips_all - cavity, 0, 1)
    upper_m = poly_mask(np.vstack([lipU, seam[::-1][1:-1]]), 0.8); lower_m = np.clip(lips_m - upper_m, 0, 1)
    D = np.zeros((SS, SS), np.float32)
    D -= blur(E_R + E_L, 6) * 12
    for up in (eyeR_up, eyeL_up):
        D += line_mask(up, 12, 6) * 6
        D -= line_mask(up + np.array([0, -0.10 * I]), 5, 3) * (4 + 4 * float(L.get('lid', 0.4)))
    lips = float(L.get('lips', 1.0))
    D += blur(upper_m, 3) * (8 + 3 * lips) + blur(lower_m, 3.5) * (11 + 4 * lips)
    D -= line_mask(seam, 3.0, 1.3) * 5 * (1 - np.clip(em['open'] / 0.05, 0, 1)) + blur(cavity, 2) * 14
    wr = wrinkle_field(h, squeeze=ee.get('squeeze', 0.0), smile=max(em['mood'], 0) + em['open'])
    fs = fine_skin(h, age) * T('fine', 1.0)
    nos, groove, rim = nose_detail(h)
    D -= 11 * nos + 5.0 * groove - 2.5 * rim
    pf = float(sp.get('puff', 0.0))
    if pf > 0:                                                                                  # puffy bags under the eyes
        for lo_ in (eyeR_lo, eyeL_lo):
            c_ = lo_.mean(0); wdt = float(lo_[:, 0].max() - lo_[:, 0].min())
            D += 9.0 * pf * gauss(c_[0], c_[1] + 0.17 * I, 0.46 * wdt, 0.045 * I)
            D -= 4.5 * pf * gauss(c_[0], c_[1] + 0.27 * I, 0.50 * wdt, 0.030 * I)
    # a smile pushes the cheeks up
    if em['mood'] > 0.1:
        for sg in (-1, 1): D += 7 * em['mood'] * gauss(CX + sg * 0.62 * I, EY + 0.50 * I, 0.26 * I, 0.17 * I)
    Zd = Z + D + wr + fs
    A = skin_albedo(h)
    sk = socket_darkness(h, (('R', (eyeR_up, eyeR_lo)), ('L', (eyeL_up, eyeL_lo))))
    A = A * (1 - sk)[:, :, None] * (1 + sk[:, :, None] * np.array([0.10, -0.06, -0.04], np.float32)[None, None, :])
    crease, lidband, lidridge = eyelid_detail(h, (('R', (eyeR_up, eyeR_lo)), ('L', (eyeL_up, eyeL_lo))))
    lidk = 0.6 + float(L.get('lid', 0.4))
    A = A * (1 - 0.20 * crease * lidk - 0.08 * lidband * lidk + 0.03 * lidridge)[:, :, None] * (1 + (0.10 * lidband * lidk)[:, :, None] * np.array([0.5, -0.2, -0.3], np.float32)[None, None, :])
    lip_col = hexlin(L['lip']) if L.get('lip') else None
    base = hexlin(L['skin'])
    lipc = lip_col if lip_col is not None else np.clip(base * np.array([0.88, 0.58, 0.60], np.float32) * T('lipk', 0.62) + base * (1 - T('lipk', 0.62)) * 0.8 + np.array([0.025, 0.0, 0.0], np.float32), 0, 1)
    A = A * (1 - lips_m[:, :, None]) + lipc[None, None, :] * (lips_m[:, :, None]) * (0.92 + 0.12 * lower_m[:, :, None] - 0.10 * upper_m[:, :, None])
    vl = noise(55, 2)
    A = A * (1 - 0.10 * lips_m * np.clip(blur(vl, 0.8), -1, 1))[:, :, None]
    A = A * (1 - 0.88 * np.clip(nos, 0, 1) - 0.20 * np.clip(groove, 0, 1))[:, :, None]
    A = A * (1 + np.clip(wr, -8, 0) * 0.018)[:, :, None]
    A = A * (1 - 0.65 * line_mask(seam, 2.6, 1.0) * (1 - np.clip(em['open'] / 0.05, 0, 1)))[:, :, None]
    pores = np.clip(blur(noise(77, 2), 0.6), -2, 2); A = A * (1 + 0.025 * T('pore', 1.0) * pores)[:, :, None]
    Zs = blur(Zd, T('nblur', 1.1))
    nx, ny, nz = normals(Zs)
    sh = blur(cast_shadow(blur(Z + D * 0.6, 1.4), LKEY, steps=34, step_px=2.4, softness=4.0), 9.0) * 0.8
    ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.25) / 1.25, 0, 1)
    ndf = np.clip((nx * LFILL[0] + ny * LFILL[1] + nz * LFILL[2] + 0.2) / 1.2, 0, 1)
    cav = np.clip(blur(Zs, 6) - Zs, 0, None) + 0.5 * np.clip(blur(Zs, 24) - Zs, 0, None); ao = np.exp(-cav / T('aoscale', 15.0))
    E = (0.11 + 1.12 * ndl * (1 - 0.66 * sh) + 0.13 * ndf) * ao * (0.92 + 0.08 * ao)
    # the neck: in the shade of the jaw just under the chin, rounder (darker) towards its sides
    nonly = np.clip(h.m_neck - h.m_head, 0, 1)
    if nonly.sum() > 500:
        nb = blur(nonly, 3.0)
        dn = cv2.distanceTransform((h.m_neck > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
        under = np.exp(-np.clip(YY - (P[152, 1] - 0.05 * I), 0, None) / (0.30 * I))
        dh = cv2.distanceTransform((h.m_head < 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)       # distance from the jaw line, outside the head
        jawsh = np.exp(-dh / (0.085 * I))
        E = E * np.clip(1 - nb * (0.18 + 0.30 * under + 0.26 * (1 - smoothstep(0.0, 0.34 * I, dn)) + 0.42 * jawsh), 0.30, 1)
    lit = sss_mix(E, A)
    lit[:, :, 0] += (1 - ndl) * 0.05 * ao * A[:, :, 0] * (1 - sh)
    hv = LKEY + np.array([0, 0, 1.0], np.float32); hv /= np.linalg.norm(hv)
    ndh = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1)
    oil = 0.55 + 0.45 * np.clip(0.4 * noise(31, 4) + 0.6 * gauss(CX, EY - 0.75 * I, 0.5 * I, 0.35 * I) + 0.7 * gauss(CX, P[1, 1] - 0.15 * I, 0.14 * I, 0.35 * I), 0, 1.5)
    spec = (ndh ** 28 * 0.06 + ndh ** 120 * 0.14) * T('spec', 0.5) * oil * ao * (1 - 0.8 * sh)
    spec += lower_m * (ndh ** 40) * 0.12 * ao * (1 - sh)
    out = lit + spec[:, :, None] * np.array([1.0, 0.96, 0.90], np.float32)[None, None, :]
    h.parts = dict(Z=Zd, ao=ao, shadow=sh, nx=nx, ny=ny, nz=nz, E_R=E_R, E_L=E_L, eyeR=(eyeR_up, eyeR_lo), eyeL=(eyeL_up, eyeL_lo), lipU=lipU, lipL=lipL, seam=seam, inner_lo=inner_lo, lips_m=lips_m, lower_m=lower_m, cavity=cavity, lips_all=lips_all, A=A, em=em)
    return out

def paint_mouth_interior(img, h):
    """the dark inside of an open mouth with teeth and a tongue (painted on the lit image)"""
    mp = h.parts; em = mp['em']; cav = mp['cavity']
    if cav.sum() < 40: return img
    seam, inner = mp['seam'], mp['inner_lo']
    op = em['open'] * I
    # dark cavity with a gradient: darkest in the throat
    y = YY
    depth = np.clip((YY - float(seam[:, 1].min())) / max(op, 1), 0, 1)
    cavc = np.array([0.030, 0.006, 0.006], np.float32)[None, None, :] * (0.5 + 0.5 * depth)[:, :, None]
    img = over(img, cavc, cav)
    cx = CX
    # upper teeth: a band under the upper lip
    t_h = min(op * 0.62, 0.085 * I)
    xs = np.linspace(-1, 1, 60); wmouth = (seam[-1, 0] - seam[0, 0]) / 2
    upper_t = np.stack([cx + xs * wmouth * 0.92, seam[:, 1] + 0.0], 1)
    lower_t = np.stack([cx + xs * wmouth * 0.92, seam[:, 1] + t_h * (1 - xs ** 2) ** 0.55 + 1.5], 1)
    teeth_m = poly_mask(np.vstack([upper_t, lower_t[::-1]]), 0.7) * cav
    tshade = 0.55 + 0.45 * (1 - np.clip(np.abs((XX - cx) / (wmouth * 0.95)), 0, 1) ** 1.6)
    tgrad = 0.78 + 0.22 * np.clip(1 - (YY - seam[len(seam) // 2, 1]) / max(t_h, 1), 0, 1)
    tooth = np.array([0.74, 0.70, 0.60], np.float32)[None, None, :] * (tshade * tgrad)[:, :, None]
    gaps = (np.sin((XX - cx) / (wmouth * 0.095) * np.pi) > 0.93).astype(np.float32)
    tooth = tooth * (1 - 0.35 * gaps)[:, :, None]
    img = over(img, tooth, teeth_m)
    # lower teeth, and a tongue for a wide mouth
    if op > 0.17 * I:
        lt_h = min(op * 0.30, 0.05 * I)
        lt_u = np.stack([cx + xs * wmouth * 0.80, inner[:, 1] - lt_h * (1 - xs ** 2) ** 0.6], 1); lt_l = np.stack([cx + xs * wmouth * 0.80, inner[:, 1] - 0.5], 1)
        lt_m = poly_mask(np.vstack([lt_u, lt_l[::-1]]), 0.7) * cav
        img = over(img, np.array([0.58, 0.54, 0.46], np.float32)[None, None, :] * (0.5 + 0.5 * tshade)[:, :, None], lt_m)
        tcx, tcy = cx, (seam[len(seam) // 2, 1] + inner[len(inner) // 2, 1]) / 2 + op * 0.20
        ton = gauss(tcx, tcy + op * 0.16, wmouth * 0.52, op * 0.20)
        img = over(img, np.array([0.42, 0.10, 0.10], np.float32), np.clip(ton * 1.4, 0, 1) * cav * (1 - teeth_m))
        img = over(img, np.array([0.60, 0.20, 0.18], np.float32), np.clip(gauss(tcx, tcy + op * 0.05, wmouth * 0.25, op * 0.10) * 1.2, 0, 1) * cav * 0.55)
    # the shadow of the upper lip on the teeth and the cavity
    shadow = np.clip(blur(h.parts['lips_all'] * 0, 1) + 0, 0, 1)
    img = img * (1 - 0.30 * blur(line_mask(seam, 6.0, 3.0), 3.0) * cav)[:, :, None]
    return img

# ---------------------------------------------------------------------------------------------------------------- eyes, brows
def eye_makeup(img, h, side):
    """eye shadow over the lid and a liner with a wing (spec 'makeup': colour, k = strength, liner, wing = length in eye distances)"""
    mk = h.spec.get('makeup')
    if not mk: return img
    up, lo = h.parts['eyeR'] if side == 'R' else h.parts['eyeL']
    col = hexlin(mk.get('color', '#3b2b33')); k = float(mk.get('k', 0.5)); sgn = -1.0 if side == 'R' else 1.0     # sgn: the outer side of this eye
    sh = np.zeros((SS, SS), np.float32); n = 12
    for i in range(n):
        t = i / (n - 1); p = up[min(int(t * (len(up) - 1)), len(up) - 1)]
        sh = np.maximum(sh, (0.50 + 0.50 * (1 - t) ** 0.8) * gauss(p[0] + sgn * 0.02 * I * (1 - t), p[1] - (0.045 + 0.03 * (1 - t)) * I, 0.070 * I, (0.050 + 0.030 * (1 - t)) * I))
    sh = blur(sh, 3.0)
    img = over(img, col, np.clip(sh * k * 1.6, 0, 1) * np.clip(h.m_head + 0.0, 0, 1))
    ln = float(mk.get('liner', 1.0))
    if ln > 0:
        o = up[0]; wing = float(mk.get('wing', 0.06)) * I
        pts = np.array([o + [-sgn * 0.01 * I, 0.0], o + [sgn * wing * 0.55, -wing * 0.18], o + [sgn * wing, -wing * 0.50]])
        img = over(img, np.array([0.012, 0.009, 0.010], np.float32), line_mask(pts, 3.4, 0.8) * 0.85 * ln)
        img = over(img, np.array([0.012, 0.009, 0.010], np.float32), line_mask(up + np.array([0, -1.2]), 5.2, 1.0) * 0.55 * ln)
    return img

def draw_eye(img, h, side, state='open', ri_scale=1.0):
    L, P = h.L, h.P
    up, lo = h.parts['eyeR'] if side == 'R' else h.parts['eyeL']
    img = eye_makeup(img, h, side)
    E = h.parts['E_R'] if side == 'R' else h.parts['E_L']
    x0, x1 = up[:, 0].min(), up[:, 0].max(); w = x1 - x0
    ee = h.expr['ee'] if hasattr(h, 'expr') else {}
    if ee.get('closed'):
        x0c, x1c = up[:, 0].min(), up[:, 0].max()
        u_ = np.linspace(0, 1, len(up)); mid = (up + lo) / 2
        if side == 'R': xs_ = np.linspace(x0c, x1c, 40)
        else: xs_ = np.linspace(x1c, x0c, 40)
        t_ = np.linspace(0, 1, 40)
        ymid = np.interp(t_, u_, mid[:, 1]); xline = np.interp(t_, u_, mid[:, 0])
        arch = ee.get('arch', 0.0) * I
        ycurve = ymid - arch * (1 - (2 * t_ - 1) ** 2) + 0.012 * I * (1 - (2 * t_ - 1) ** 2)
        line = np.stack([xline, ycurve], 1)
        # a soft shadow of the closed lid and the lower rim
        img = img * (1 - 0.22 * blur(line_mask(line + np.array([0, -4.0]), 9.0, 4.0), 3.0))[:, :, None]
        img = over(img, np.array([0.30, 0.15, 0.13], np.float32), line_mask(line + np.array([0, 5.0]), 3.0, 2.0) * 0.30)
        female = bool(L.get('female'))
        img = over(img, np.array([0.014, 0.010, 0.009], np.float32), line_mask(line, 4.4 if female else 3.4, 1.0) * 0.95)
        rng = np.random.RandomState(5 if side == 'R' else 6); lay = np.zeros((SS, SS), np.float32)
        for k in range(10 if not female else 16):
            tt = 0.15 + 0.8 * k / (10 if not female else 16); i0 = int(tt * 39); xk, yk = line[i0]
            sgn = -1 if side == 'R' else 1
            cv2.line(lay, (int(xk * 16), int(yk * 16)), (int((xk + sgn * 0.02 * I) * 16), int((yk + 0.03 * I) * 16)), float(0.5 + 0.5 * rng.rand()), 1, cv2.LINE_AA, 4)
        img = over(img, np.array([0.014, 0.010, 0.009], np.float32), np.clip(lay, 0, 1) * 0.8)
        return img
    cx = (x0 + x1) / 2 + (-1 if side == 'R' else 1) * 0.0 * w
    # the eye opening at the middle
    iu = np.argsort(up[:, 0]); il = np.argsort(lo[:, 0])
    ut = np.interp(cx, up[iu, 0], up[iu, 1]); lt = np.interp(cx, lo[il, 0], lo[il, 1])
    hh = max(lt - ut, 6.0)
    ri = float(np.clip(0.200 * w, 0.080 * I, 0.104 * I)) * ri_scale * T('iris', 1.0) * float(h.spec.get('iris_k', 1.0))      # an iris is about 0.4 of the width of the eye (0.19 of the distance between the eyes); the lids cut it
    cy = ut + 0.60 * ri + 0.85 * max(0.0, hh - 1.60 * ri)           # the upper lid covers about a fifth of the iris, the lower lid just touches it (a wide opening lets the iris sink, so that no white shows under it)
    ix = cx + (0.5 if side == 'R' else -0.5) * 0.0
    dx, dy = XX - ix, YY - cy; rho = np.sqrt(dx * dx + dy * dy) / ri; th = np.arctan2(dy, dx)
    # sclera: slightly warm white with a spherical shade, darker towards the corners and under the upper lid
    t = np.clip((YY - ut) / max(hh, 1), 0, 1)
    across = np.clip(np.abs(XX - (x0 + x1) / 2) / (w / 2), 0, 1)
    scl = np.array([0.58, 0.53, 0.47], np.float32)[None, None, :] * float(h.spec.get('sclera', 1.0)) * (0.50 + 0.50 * (1 - across ** 2.2))[:, :, None] * (0.45 + 0.55 * smoothstep(0.0, 0.55, t))[:, :, None]
    red = (smoothstep(0.55, 1.0, across) * 0.35)[:, :, None] * np.array([0.10, -0.02, -0.04], np.float32)[None, None, :]
    scl = scl + red
    # iris with fibres, a dark limbal ring and a lighter ring around the pupil
    base = hexlin(L.get('iris', '#4a3626'))
    fib = 0.5 + 0.5 * np.sin(th * 34 + noise(9, 5) * 3.0 + 3 * noise(13, 9)); fib2 = 0.5 + 0.5 * np.sin(th * 71 + noise(14, 3) * 4.0)
    irc = base[None, None, :] * (0.62 + 0.55 * fib[:, :, None] * 0.7 + 0.25 * fib2[:, :, None] * 0.4)
    collar = np.exp(-((rho - 0.52) / 0.16) ** 2)[:, :, None] * (base[None, None, :] * 0.8 + 0.10)
    irc = (irc + collar * 0.55) * (1 - 0.55 * float(h.spec.get('iris_dark', 0.0)))
    irc = irc * (1 - 0.72 * smoothstep(0.80, 1.0, rho))[:, :, None]
    pup = 1 - smoothstep(0.30, 0.38, rho)
    irisA = 1 - smoothstep(0.97, 1.03, rho)
    eye = scl * (1 - irisA[:, :, None]) + irc * irisA[:, :, None]
    eye = eye * (1 - pup[:, :, None]) + np.array([0.004, 0.003, 0.003], np.float32)[None, None, :] * pup[:, :, None]
    # shadow of the upper lid on the eyeball
    lidsh = float(h.spec.get('lid_shadow', 0.0))
    eye = eye * (0.16 + 0.84 * smoothstep(0.0, 0.70 + 0.25 * lidsh, t))[:, :, None] * (0.80 + 0.2 * smoothstep(0.0, 0.2, t))[:, :, None]
    # catchlights
    cl = np.exp(-(((XX - (ix - 0.34 * ri)) / (0.22 * ri)) ** 2 + ((YY - (cy - 0.36 * ri)) / (0.16 * ri)) ** 2))
    cl2 = np.exp(-(((XX - (ix + 0.36 * ri)) ** 2 + (YY - (cy + 0.40 * ri)) ** 2) / (2 * (0.10 * ri) ** 2)))
    eye = eye + (cl[:, :, None] * 1.1 + cl2[:, :, None] * 0.35)
    # the eyeball is inside the opening only
    img = over(img, eye, E)
    # the lower lid's wet line and the inner corner
    inner = up[-1] if side == 'R' else up[0]
    cor = gauss(inner[0], inner[1] + 0.2 * hh, 0.05 * I, 0.04 * I)
    img = over(img, np.array([0.45, 0.14, 0.12], np.float32), cor * 0.55 * E)
    img = over(img, np.array([0.55, 0.28, 0.24], np.float32), line_mask(lo, 2.4, 1.0) * 0.55)
    # lashes: a dark thick line along the upper edge + short strokes
    lash_c = np.array([0.022, 0.015, 0.013], np.float32)
    female = bool(L.get('female'))
    img = over(img, lash_c, line_mask(up, 3.8 if female else 2.6, 1.0) * (0.92 if female else 0.74))
    rng = np.random.RandomState(5 if side == 'R' else 6)
    lay = np.zeros((SS, SS), np.float32)
    nl = 22 if female else 12
    for k in range(nl):
        tt = 0.12 + 0.78 * k / (nl - 1); xk = np.interp(tt, np.linspace(0, 1, len(up)), up[:, 0]); yk = np.interp(tt, np.linspace(0, 1, len(up)), up[:, 1])
        sgn = -1 if side == 'R' else 1
        dxs = sgn * (0.2 + 0.8 * (tt if side == 'R' else 1 - tt)) * (0.020 if not female else 0.032) * I * (0.7 + 0.6 * rng.rand())
        dys = -(0.030 if not female else 0.048) * I * (0.7 + 0.5 * rng.rand())
        cv2.line(lay, (int(xk * 16), int(yk * 16)), (int((xk + dxs) * 16), int((yk + dys) * 16)), float(0.5 + 0.5 * rng.rand()), 1, cv2.LINE_AA, 4)
    img = over(img, lash_c, np.clip(lay, 0, 1) * 0.8)
    return img

def draw_brows(img, h, seed=3):
    """brows: a darker skin band under the hair, then hundreds of hairs that rise at the head of the brow and lie flat towards the tail"""
    L, P = h.L, h.P; sp = h.spec.get('brow', {})
    ee = h.expr['ee'] if hasattr(h, 'expr') else {}
    col = hexlin(L.get('browColor', '#3a3030'))
    th = float(L.get('brow', 4.0)); scale = np.clip(th / 4.0, 0.55, 1.7) * float(sp.get('k', 1.0)) * T('browk', 1.08)
    din, dout = ee.get('brow_in', 0.0) * I, ee.get('brow_out', 0.0) * I
    tilt = float(sp.get('tilt', 0.0)) * I                                       # + : the inner end lower (stern)
    arch = float(sp.get('arch', 0.0)) * I
    dy_all = (float(sp.get('dy', 0.0)) + T('browdy', 0.012)) * I
    grey = float(sp.get('grey', 0.0)); dens = float(sp.get('dens', 1.0))
    pale = np.clip(col * 1.9 + 0.12, 0, 1)
    for side in ('R', 'L'):
        up = curve(P[BROW_UP[side]], 48); lo = curve(P[BROW_LO[side]], 48)
        mid = (up + lo) / 2; half = (lo - up) / 2
        t = np.linspace(0, 1, len(mid)); outer_end = t if side == 'R' else 1 - t        # 0 at the nose end, 1 at the tail
        prof = 0.42 + 0.78 * (1 - outer_end) ** 0.85
        up2 = mid - half * prof[:, None] * scale * 1.15; lo2 = mid + half * prof[:, None] * scale * 1.15
        off = (din + tilt) * (1 - outer_end) + (dout - tilt * 0.6) * outer_end + dy_all - arch * (1 - (2 * outer_end - 1) ** 2)
        up2 = up2 + np.stack([0 * off, off], 1); lo2 = lo2 + np.stack([0 * off, off], 1); mid = mid + np.stack([0 * off, off], 1)
        pm = poly_mask(np.vstack([up2, lo2[::-1]]), 2.0)
        pmw = np.clip(blur(poly_mask(np.vstack([up2, lo2[::-1]]), 0.0), 3.5) * 1.6, 0, 1)
        img = over(img, col * 0.55, pmw * 0.26)                                        # the skin under the hair is a little darker
        rng = np.random.RandomState(seed + (0 if side == 'R' else 9))
        nh = int(900 * dens * np.clip(scale, 0.7, 1.5))
        lay = np.zeros((SS, SS, 3), np.float32); cov = np.zeros((SS, SS), np.float32)
        for k in range(nh):
            tt = rng.beta(1.15, 1.0); i0 = min(int(tt * (len(mid) - 1)), len(mid) - 2)
            frac = float(np.clip(rng.randn() * 0.52, -1.15, 1.15))                          # most hairs in the body of the brow, a few strays at the edges
            c = mid[i0] + (lo2[i0] - mid[i0]) * frac * 0.92
            oe = outer_end[i0]
            # direction: steep at the head, flat at the tail (in image terms: towards the tail = +x for the right-hand brow in the image)
            ang = np.radians(78 - 95 * oe ** 0.8) + rng.randn() * 0.18
            sx = 1.0 if side == 'L' else -1.0                                           # 'L' tail points to +x
            d = np.array([sx * np.cos(ang), -np.sin(ang)], np.float32)
            ln = rng.uniform(0.050, 0.095) * I * (0.8 + 0.4 * scale)
            a_ = c - d * ln * 0.35; b_ = c + d * ln * 0.65
            pale_h = rng.rand() < grey
            cc = (pale if pale_h else col) * rng.uniform(0.75, 1.20)
            wdt = 1 if rng.rand() < 0.8 else 2
            ak = float(rng.uniform(0.6, 1.0))
            cv2.line(lay, (int(a_[0] * 16), int(a_[1] * 16)), (int(b_[0] * 16), int(b_[1] * 16)), (float(cc[0] * ak), float(cc[1] * ak), float(cc[2] * ak)), wdt, cv2.LINE_AA, 4)
            cv2.line(cov, (int(a_[0] * 16), int(a_[1] * 16)), (int(b_[0] * 16), int(b_[1] * 16)), ak, wdt, cv2.LINE_AA, 4)
        covc = np.clip(cov, 0, 1)
        colimg = np.where(cov[:, :, None] > 1e-3, lay / np.maximum(cov[:, :, None], 1e-3), 0)
        img = over(img, np.clip(colimg, 0, 1.2), covc * 0.92 * np.clip(pmw * 1.3, 0, 1))
    return img

# ---------------------------------------------------------------------------------------------------------------- exposure calibration
def calib_scale(img, mask, target_rgb, lo=0.55, hi=1.7):
    sel = mask > 0.5
    if sel.sum() < 200: return 1.0
    m = float(lum(img[sel]).mean()); t = float(lum(np.asarray(target_rgb)))
    return float(np.clip(t / max(m, 1e-4), lo, hi))

# ---------------------------------------------------------------------------------------------------------------- hair
import strands as ST

def tri_mask(pts, blur_s=1.0): return poly_mask(np.asarray(pts, float), blur_s)

def draw_clothes(h):
    """returns (rgb_lin, alpha): jacket, shirt, collar, tie, pin; the head will be drawn over it"""
    L, P = h.L, h.P
    suit = hexlin(L.get('suit', '#1b2236')); shirt = hexlin(L.get('shirt', '#ffffff')); tie = hexlin(L['tie']) if L.get('tie') else None
    openc = bool(L.get('open')); sh = float(L.get('shoulders', 0.0)); ww = float(L.get('w', 1.0))
    c = P[152, 1] + T('neckdrop', 0.06) * I; jl, jr = P[132, 0], P[361, 0]
    nw = (jr - jl) * (T('neckw', 0.74) + 0.07 * (float(L.get('neck', 1.0)) - 1.0))                   # neck width
    sx = (1.0 + 0.16 * sh + 0.20 * (ww - 1.0))                                           # shoulder width factor
    ybot = SS + 10
    # ---- the jacket: neck -> trapezius -> shoulder -> down
    prof = np.array([[0.5 * nw + 0.02 * I, c + 0.16 * I], [0.5 * nw + 0.30 * I, c + 0.26 * I], [1.15 * I * sx, c + 0.50 * I], [1.95 * I * sx, c + 0.86 * I], [2.55 * I * sx, c + 1.45 * I], [2.8 * I * sx, ybot]])
    pr = smooth_curve(prof, 60)
    right = np.stack([CX + pr[:, 0] - (0.5 * nw + 0.02 * I) + (0.5 * nw + 0.02 * I) - 0 * pr[:, 0], pr[:, 1]], 1)
    right = np.stack([CX + pr[:, 0], pr[:, 1]], 1)
    left = np.stack([2 * CX - right[:, 0], right[:, 1]], 1)
    jacket = poly_mask(np.vstack([[(CX - 0.5 * nw, c - 0.02 * I)], left, [(CX - 3.2 * I, ybot), (CX + 3.2 * I, ybot)], right[::-1], [(CX + 0.5 * nw, c - 0.02 * I)]]), 1.2)
    D = cv2.distanceTransform((jacket > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    Zc = blur(np.sqrt(np.clip(D, 0, 260)) * 5.0, 10)
    Zc = Zc + (np.sin(XX * 1.9) * np.sin(YY * 1.9)) * 0.20 + fbm(41, [2, 5], [1.0, 0.6]) * 0.25 + fbm(45, [60, 26], [1.0, 0.5]) * 4.0
    nx, ny, nz = normals(Zc)
    ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.2) / 1.2, 0, 1)
    E = 0.16 + 0.85 * ndl
    out = suit[None, None, :] * E[:, :, None] * (1 + 0.05 * fbm(43, [2])[:, :, None]); out = out * jacket[:, :, None]; alpha = jacket.copy()
    # ---- shirt: the V between the lapels
    vy_top = c + 0.12 * I; vy_bot = c + (1.30 if openc else 1.55) * I
    vw = 0.5 * nw + 0.36 * I
    v = np.array([[CX - 0.5 * nw - 0.03 * I, c - 0.03 * I], [CX + 0.5 * nw + 0.03 * I, c - 0.03 * I], [CX + vw, vy_top + 0.20 * I], [CX, vy_bot], [CX - vw, vy_top + 0.20 * I]])
    shirt_m = tri_mask(v, 1.0)
    shade_s = (0.66 + 0.34 * np.exp(-((XX - CX) / (0.5 * I)) ** 2)) * (0.8 + 0.2 * smoothstep(c + 1.6 * I, c, YY))
    scol = shirt[None, None, :] * shade_s[:, :, None] * (1 + 0.04 * fbm(47, [3])[:, :, None])
    out = out * (1 - shirt_m[:, :, None]) + scol * shirt_m[:, :, None]
    if openc:                                                                # the open collar shows the chest skin
        skin = hexlin(L['skin']) * 0.66
        vv = np.array([[CX - 0.5 * nw, c - 0.03 * I], [CX + 0.5 * nw, c - 0.03 * I], [CX, vy_bot - 0.10 * I]])
        m = tri_mask(vv, 2.5); out = out * (1 - m[:, :, None] * 0.97) + (skin[None, None, :] * (0.78 + 0.22 * ndl[:, :, None])) * m[:, :, None] * 0.97
    for sg in (-1, 1):                                                       # collar flaps
        flap = np.array([[CX + sg * 0.5 * nw, c - 0.05 * I], [CX + sg * (0.5 * nw + 0.36 * I), c + 0.20 * I], [CX + sg * 0.05 * nw, c + 0.52 * I]])
        fm = tri_mask(flap, 0.9)
        out = out * (1 - fm[:, :, None]) + (shirt[None, None, :] * (0.95 if sg < 0 else 0.70)) * fm[:, :, None]
        out = out * (1 - 0.30 * line_mask(flap[[0, 1, 2, 0]], 2.2, 1.2)[:, :, None])
    for sg in (-1, 1):                                                       # lapel edges (the jacket front): lighter cloth and a crease
        lap = np.array([[CX + sg * (0.5 * nw + 0.38 * I), c + 0.24 * I], [CX + sg * (0.5 * nw + 0.98 * I), c + 0.62 * I], [CX + sg * 0.16 * I, vy_bot + 0.10 * I], [CX + sg * 0.03 * I, vy_bot]])
        out = out * (1 - 0.50 * line_mask(lap[[0, 3]], 2.6, 1.2)[:, :, None])
        out = out + 0.06 * line_mask(lap[[0, 3]] + np.array([sg * 4.0, 0]), 1.6, 0.8)[:, :, None] * suit[None, None, :] * 10
    if tie is not None and not openc:
        knot = np.array([[CX - 0.16 * I, c + 0.10 * I], [CX + 0.16 * I, c + 0.10 * I], [CX + 0.22 * I, c + 0.44 * I], [CX - 0.22 * I, c + 0.44 * I]])
        blade = np.array([[CX - 0.18 * I, c + 0.42 * I], [CX + 0.18 * I, c + 0.42 * I], [CX + 0.32 * I, c + 1.45 * I], [CX, c + 1.70 * I], [CX - 0.32 * I, c + 1.45 * I]])
        for poly_ in (blade, knot):
            tm = tri_mask(poly_, 0.9)
            grad = 0.62 + 0.55 * np.exp(-((XX - (CX - 0.06 * I)) / (0.13 * I)) ** 2)
            tc = tie[None, None, :] * grad[:, :, None] * (1 + 0.10 * fbm(51, [2])[:, :, None] + 0.04 * np.sin(YY * 0.6 + XX * 0.6)[:, :, None])
            out = out * (1 - tm[:, :, None]) + tc * tm[:, :, None]
            out = out * (1 - 0.45 * line_mask(poly_, 1.8, 1.0, closed=True)[:, :, None])
        alpha = np.maximum(alpha, tri_mask(blade, 1.0))
    if L.get('pin'):
        pc = (CX + 0.95 * I * sx, c + 0.92 * I); pm = (gauss(pc[0], pc[1], 0.07 * I, 0.07 * I) > 0.45).astype(np.float32)
        out = out * (1 - pm[:, :, None]) + hexlin(L['pin'])[None, None, :] * pm[:, :, None]
        out = out + (gauss(pc[0] - 4, pc[1] - 4, 3, 3) > 0.5).astype(np.float32)[:, :, None] * 0.5
    alpha = np.maximum(alpha, shirt_m)
    jawsh = np.exp(-np.clip(YY - (c - 0.12 * I), 0, None) / (0.28 * I)) * smoothstep(1.3 * I, 0.6 * I, np.abs(XX - CX))
    out = out * (1 - 0.55 * jawsh)[:, :, None]
    return out, np.clip(alpha, 0, 1)

# ---------------------------------------------------------------------------------------------------------------- beard, moustache, stubble
def face_oval_right(h):
    P = h.P
    return P[[454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152]].copy()      # from the right ear down to the chin (canvas px)

def beard_polygon(h, cheek=0.0, ext=0.0, off=0.02, mouth_clear=True, goatee=False, flare=0.0, gw=1.0):
    P = h.P
    if goatee:
        yb = P[17, 1] + 0.04 * I; yt = P[17, 1] - 0.015 * I; cy = P[152, 1]
        pts = [[CX - 0.30 * I * gw, yt], [CX + 0.30 * I * gw, yt], [CX + 0.34 * I * gw, yb + 0.15 * I], [CX + 0.22 * I * gw, cy - 0.02 * I + ext * I], [CX, cy + 0.07 * I + ext * I], [CX - 0.22 * I * gw, cy - 0.02 * I + ext * I], [CX - 0.34 * I * gw, yb + 0.15 * I]]
        return poly_mask(smooth_curve(np.array(pts), 80, closed=True), 2.5)
    O = face_oval_right(h)
    cen = np.array([CX, EY + 0.55 * I])
    O2 = []
    for k, p in enumerate(O):
        v = p - cen; v = v / (np.linalg.norm(v) + 1e-6)
        t = k / (len(O) - 1)
        o = off * I * (1 + flare * 2.0 * np.sin(np.pi * t))
        q = p + v * o
        if ext > 0: q[1] += ext * I * smoothstep(0.35, 0.95, t) * (0.6 + 0.4 * smoothstep(0.7, 1.0, t))
        O2.append(q)
    O2 = np.array(O2)
    contour = np.array([[1.20, 0.10], [1.10, 0.42], [0.94, 0.64], [0.66, 0.80], [0.38, 0.86], [0.12, 0.84]]) * I
    contour[:, 1] += cheek * I
    contour = np.stack([CX + contour[:, 0], EY + contour[:, 1]], 1)
    right = np.vstack([[CX, EY + 0.84 * I + cheek * I], contour[::-1][::-1][::-1][::-1], O2])
    right = np.vstack([contour[::-1], O2])                                         # from the sideburn?? (see below)
    # polygon: start under the nose, go out along the cheek line to the ear, then down the jaw to the chin
    cl = contour[::-1]                                                              # from the philtrum outwards
    poly_r = np.vstack([[CX, EY + (0.84 + cheek) * I], cl[:, :2][::-1][::-1][::-1]]) if False else np.vstack([[CX, EY + (0.84 + cheek) * I], contour[::-1][::-1][::-1]])
    cl_out = contour[::-1][::-1]
    right = np.vstack([[CX, EY + (0.84 + cheek) * I], contour[::-1], O2])
    left = np.stack([2 * CX - right[:, 0], right[:, 1]], 1)[::-1]
    poly = np.vstack([right, left])
    return poly_mask(smooth_curve(poly, 160, closed=True, s=0), 2.0)

def beard_flow(curl=0.0):
    nz = noise(7, 36)
    def f(x, y):
        s = 1 if x > CX else -1; ax = abs(x - CX) / I
        lean = s * (0.30 * min(1.0, ax / 1.1)) * (1 - smoothstep(EY + 1.1 * I, EY + 1.9 * I, y)) - s * 0.50 * smoothstep(EY + 1.5 * I, EY + 2.6 * I, y)
        a = np.pi / 2 - lean + curl * float(nz[int(np.clip(y, 0, SS - 1)), int(np.clip(x, 0, SS - 1))]) * 0.5
        return np.cos(a), np.sin(a)
    return f

def draw_stubble(img, h, amount, seed=3):
    L = h.L; hr = L.get('hair') or {}
    col = hexlin(hr.get('color', '#333333')) * 0.5
    if L.get('beard'): col = hexlin(L['beard']['color']) * 0.5
    rng = np.random.RandomState(seed)
    reg = beard_polygon(h, cheek=float(h.spec.get('stubble_cheek', -0.10)), ext=0.0, off=0.0) * h.m_head
    reg = np.clip(reg * (0.7 + 0.3 * smoothstep(EY + 0.3 * I, EY + 1.1 * I, YY)), 0, 1)
    dots = (noise(91, 1) > (1.2 - 1.4 * amount)).astype(np.float32) * (noise(92, 2) > -0.2)
    dots = blur(dots, 0.5)
    mu = hexlin(L['skin']) * 0.55
    img = over(img, col, np.clip(dots * reg * (0.35 + 0.9 * amount), 0, 1))
    img = over(img, mu, blur(reg, 8) * 0.10 * amount)
    return img

def draw_stache(img, h, color, seed=31):
    """moustache: thick in the middle and thinner towards the corners (spec 'taper'), corners that hang down ('droop'), ragged edges, 'alpha' = how solid it is"""
    sp = h.spec.get('stache', {})
    P = h.P; mp = h.parts
    sw = sp.get('w', 1.0); sh_ = sp.get('h', 1.0); tp = float(sp.get('taper', 0.55)); dr = float(sp.get('droop', 1.0)); al = float(sp.get('alpha', 1.0))
    ny = P[2, 1]; ly = mp['lipU'][len(mp['lipU']) // 2][1]
    top = ny + 0.045 * I; bot = ly + 0.015 * I * sh_
    wid = 0.40 * I * sw
    u = np.linspace(-1, 1, 41); au = np.abs(u)
    upper = np.stack([CX + u * wid, top + 0.0 * u + 0.02 * I * au], 1)
    mid_low = bot - 0.02 * I * (1 - au) ** 0.5                                        # where the hairs end above the lip
    th = (mid_low - upper[:, 1]) * (1 - tp * au ** 1.3) * (1 - 0.85 * au ** 5)                  # thick in the middle, thinner and rounded towards the ends
    lower = np.stack([CX + u * wid * 0.98, upper[:, 1] + th + dr * 0.05 * I * sh_ * au ** 2.2], 1)
    region = poly_mask(smooth_curve(np.vstack([upper, lower[::-1]]), 100, closed=True), 1.6)
    base = hexlin(color)
    def flow(x, y):
        s = 1 if x > CX else -1; a = np.pi / 2 - s * (0.30 + 1.0 * min(1.0, abs(x - CX) / (0.42 * I)))
        return np.cos(a), np.sin(a)
    vx, vy = ST.flow_grid(flow)
    rgbc, a0 = ST.lit_fibres(region, vx, vy, base, base, hexlin(h.L['skin']), seed=seed, fine_len=9, lock_len=22, lock_scale=1.2, k_fine=0.30, k_lock=0.30, spec=0.14, spec_pow=26, dome=4.0, dome_cap=30.0, occl=0.2, target=base * sp.get('exposure', 0.80))
    near = np.clip(blur(region, 7.0) * 5.0, 0, 1)                                                               # the ragged edge only close to the moustache (the noise alone would speckle the whole face)
    alpha = np.clip(smoothstep(0.16, 0.70, blur(region, 3.0) + 0.17 * noise(77, 1) * near), 0, 1) * al
    if sp.get('strands', T('sstrands', 1.0)):                                                                    # single hairs over the fibre texture
        import hair4 as H4
        yy_ = (YY - (top + 0.0)) / max(bot - top, 1.0)
        shade_s = (0.62 + 0.30 * smoothstep(1.0, 0.2, yy_)).astype(np.float32)
        spec_map = np.zeros((SS, SS), np.float32) + (0.10 if float(base.mean()) > 0.12 else 0.03)
        spec_col = np.clip(0.45 * base / max(float(base.max()), 1e-3) + 0.55, 0, 1)
        rgb_s, cov_s = H4.strand_hair(np.clip(region, 0, 1), vx, vy, base, base, 0.0, shade_s, spec_map, spec_col, seed + 3, density=float(sp.get('s_density', 1.6)) * (0.35 + 0.65 * al), passes=3, length=(16, 46), wander=0.70,
                                      lock_scale=8, contrast=0.55, tone=0.45, tip_margin=(0.0, 9.0), hl=0.5, kappa=1.1)
        rgbc = rgbc * (1 - cov_s * 0.9)[:, :, None] + rgb_s * (cov_s * 0.9)[:, :, None]
        inner = smoothstep(0.55, 0.92, blur(region, 6.0))                                                           # solid inside, the edge is made by the hairs themselves, not by the outline of the region
        alpha = np.clip(np.maximum(alpha * (0.25 + 0.45 * inner) * (0.4 + 0.6 * al), cov_s * 0.97), 0, 1)
    img = over(img, rgbc, alpha)
    return img, alpha

# ---------------------------------------------------------------------------------------------------------------- glasses, kippah, earring
def draw_glasses(img, h):
    gl = h.L.get('glasses'); sp = h.spec.get('glasses', {})
    if not gl: return img
    P = h.P; col = hexlin(gl.get('color', '#222222')); lw = max(1.8, float(gl.get('lw', 1.0)) * 3.0)
    shape = gl.get('shape', 'rect')
    w = sp.get('w', 0.94 if shape == 'rect' else 0.86) * I; hh = sp.get('h', 0.62 if shape == 'rect' else 0.86) * I
    cy = EY + sp.get('dy', 0.0) * I
    sh = np.zeros((SS, SS), np.float32); fr = np.zeros((SS, SS), np.float32); lens = np.zeros((SS, SS), np.float32)
    for sg in (-1, 1):
        cx = CX + sg * 0.505 * I
        t = np.linspace(0, 2 * np.pi, 120, endpoint=False)
        if shape == 'round': pts = np.stack([cx + np.cos(t) * w / 2, cy + np.sin(t) * hh / 2], 1)
        else:
            e = 4.0; pts = np.stack([cx + np.sign(np.cos(t)) * np.abs(np.cos(t)) ** (2 / e) * w / 2, cy - 0.03 * I + np.sign(np.sin(t)) * np.abs(np.sin(t)) ** (2 / e) * hh / 2], 1)
        lens = np.maximum(lens, poly_mask(pts, 0.8))
        fr = np.maximum(fr, line_mask(pts, lw, 0.7, closed=True))
        # temple arm: from the outer corner back to the ear
        a0 = np.array([cx + sg * w / 2, cy - 0.12 * I]); a1 = np.array([CX + sg * 1.22 * I, cy - 0.10 * I])
        fr = np.maximum(fr, line_mask(np.array([a0, a1]), lw * 0.9, 0.7))
    bridge = curve([[CX - 0.505 * I + 0.47 * I, cy - 0.12 * I], [CX, cy - 0.20 * I], [CX + 0.505 * I - 0.47 * I, cy - 0.12 * I]], 20)
    fr = np.maximum(fr, line_mask(bridge, lw * 0.9, 0.7))
    # shadow on the skin, lens tint and glare, the frame with a metallic gradient
    shadow = np.roll(np.roll(fr, 3, 0), 2, 1)
    img = img * (1 - 0.35 * blur(shadow, 2.5))[:, :, None]
    img = img * (1 - 0.06 * lens)[:, :, None] + np.array([0.7, 0.8, 0.9], np.float32)[None, None, :] * (0.025 * lens)[:, :, None]
    glare = np.clip(np.sin((XX + YY) * 0.040) * 0.5 - 0.1, 0, 1) * lens
    img = img + glare[:, :, None] * 0.035
    fcol = col[None, None, :] * (0.7 + 0.5 * np.clip((XX - YY) / SS + 0.5, 0, 1))[:, :, None]
    fcol = fcol + 0.25 * np.clip(1 - np.abs(((YY - cy) / (0.5 * hh))), 0, 1)[:, :, None] * (col.mean() > 0.2)
    img = over(img, fcol, fr * 0.97)
    return img

def draw_kippah(img, h):
    kp = h.L.get('kippah'); sp = h.spec.get('kippah', {}); hp = getattr(h, 'hp', None) or {}
    if not kp: return img, np.zeros((SS, SS), np.float32)
    col = hexlin(kp['color']); knit = hexlin(kp['knit']) if kp.get('knit') else None; has_knit = knit is not None
    top = hp.get('kip_top', hp.get('top', -1.85) - 0.04); front = hp.get('kip_front', top + 0.55); wid = hp.get('kip_w', 1.15 if has_knit else 1.0)
    side = hp.get('kip_side', front + 0.20)                                   # the rim is lower at the sides (the cap wraps round the skull) and arches up over the forehead
    cx = CX + sp.get('dx', 0.0) * I
    yt = EY + top * I; yf = EY + front * I; ys = EY + side * I
    t = np.linspace(np.pi, 2 * np.pi, 70)
    upper = np.stack([cx + np.cos(t) * wid / 2 * I, ys + (yt - ys) * np.abs(np.sin(t)) ** (2 / 2.6)], 1)
    u = np.linspace(-1, 1, 70)
    lower = np.stack([cx + u * wid / 2 * I, ys + (yf - ys) * (1 - np.abs(u) ** 2.0)], 1)
    m = poly_mask(np.vstack([upper, lower[::-1]]), 1.0)
    if hp.get('kip_full'):                                                   # a cap that covers the whole crown: the skull above the rim line
        uu = np.clip(np.abs(XX - cx) / (wid / 2 * I), 0, 1)
        rim = ys + (yf - ys) * (1 - uu ** 2.0)
        m = np.clip(h.m_skullhair * smoothstep(-1.5, 1.5, rim - YY), 0, 1)
    d = cv2.distanceTransform((m > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    Zk = blur(np.sqrt(np.clip(d, 0, 70)) * 4.5, 3)
    nx, ny, nz = normals(Zk); ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.2) / 1.2, 0, 1)
    shade = 0.30 + 0.90 * ndl
    base = col[None, None, :] * shade[:, :, None]
    if has_knit:
        rr = np.sqrt(((XX - cx) / (wid / 2 * I)) ** 2 + ((YY - (yt + 0.12 * I)) / (0.55 * I)) ** 2)
        ring = (np.sin(rr * 30) > 0.30).astype(np.float32) * smoothstep(0.12, 0.3, rr)
        cell = (np.sin(XX * 0.85) * np.sin(YY * 0.85) > 0.1).astype(np.float32)
        base = base * (1 - 0.75 * ring)[:, :, None] + knit[None, None, :] * shade[:, :, None] * (ring * (0.65 + 0.35 * cell))[:, :, None]
        band = smoothstep(yf - 0.09 * I, yf - 0.03 * I, YY) * m                                   # a band along the lower edge
        base = base * (1 - 0.6 * band)[:, :, None] + (knit[None, None, :] * shade[:, :, None]) * (0.6 * band)[:, :, None]
        base = base * (1 + 0.06 * fbm(23, [2])[:, :, None])
    else:
        base = base + 0.08 * np.clip(ndl - 0.55, 0, 1)[:, :, None] * 1.5
        base = base * (1 + 0.04 * fbm(23, [3])[:, :, None])
    alpha = blur(m, 1.0)
    # a soft shadow under the lower edge, on the forehead
    img = img * (1 - 0.28 * blur(np.clip(blur(m, 1) * 0 + line_mask(lower, 6.0, 3.0), 0, 1), 4.0))[:, :, None]
    base = base * (0.70 + 0.30 * smoothstep(0, 6, d))[:, :, None]
    img = over(img, base, alpha)
    return img, alpha

def draw_earring(img, h):
    col = h.L.get('hoop') or h.L.get('earring')
    if not col: return img
    c = hexlin(col); boxes = ear_geometry(h)
    for sg, (x0, y0, x1, y1) in zip((-1, 1), boxes):
        cx = (x0 + x1) / 2; cy = y1 + 0.05 * I
        t = np.linspace(0, 2 * np.pi, 80, endpoint=False)
        r = 0.115 * I
        ring = np.stack([cx + np.cos(t) * r, cy + 0.10 * I + np.sin(t) * r], 1)
        sh = np.roll(np.roll(line_mask(ring, 5.5, 1.0, closed=True), 3, 0), 2, 1)
        img = img * (1 - 0.35 * blur(sh, 2.5))[:, :, None]
        m = line_mask(ring, 4.5, 0.7, closed=True)
        g = 0.6 + 0.6 * np.clip((XX - cx) / (2 * r) + 0.4, 0, 1) * np.clip(1 - (YY - cy) / (2 * r), 0, 1)
        img = over(img, c[None, None, :] * g[:, :, None], m)
        img = over(img, np.array([1, 1, 1.0], np.float32), line_mask(ring[10:22], 2.0, 0.6) * 0.8)
    return img

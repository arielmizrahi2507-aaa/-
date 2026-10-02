# parametric head / hair silhouette (symmetric, in IPD units relative to the eye centre), fitted to the parse labels or given by hand
import json, numpy as np, cv2
from scipy.interpolate import PchipInterpolator
from rend2 import SS, I, CX, EY, XX, YY, poly_mask, smooth_curve, clean, blur, smoothstep, OVAL, px
import geom

def px_(x, y): return CX + np.asarray(x) * I, EY + np.asarray(y) * I

def superellipse_outline(top, w, yw, n, y_side, k=60):
    """right half then left half (a closed polygon) of the outer silhouette: the top arc through (0, top), widest (w) at yw, going straight down to y_side"""
    th = np.linspace(0, np.pi, k)
    c, s = np.cos(th), np.sin(th)
    x = w * np.sign(c) * np.abs(c) ** (2 / n); y = yw - (yw - top) * np.abs(s) ** (2 / n)
    pts = [(x[i], y[i]) for i in range(k)]                                   # from the right side over the top to the left side
    pts = [(w * 0.985, y_side), (w, yw)] + pts[1:-1] + [(-w, yw), (-w * 0.985, y_side)]
    return np.array(pts)

def hairline_curve(hl, k=80, x_end=1.06):
    xs = np.array([0.0, 0.35, 0.70, 1.00, x_end]); ys = np.array(list(hl) + [hl[-1] + 0.10])
    f = PchipInterpolator(xs, ys); xx = np.linspace(-x_end, x_end, k)
    return xx, f(np.abs(xx))

def build_masks(hp, P):
    """returns dict of masks (SS,SS float): head (skin of the head), hair, skullhair"""
    oval = poly_mask(smooth_curve(P[OVAL], 120, closed=True), 1.0)
    top, w, yw, n = hp['top'], hp['w'], hp['yw'], hp['n']
    sb = hp.get('sb', 0.10)
    O = superellipse_outline(top, w, yw, n, sb)
    outer = poly_mask(np.stack(px_(O[:, 0], O[:, 1]), 1), 1.0)
    if hp.get('bald') or hp.get('sides_only'):
        # the skull is a skin dome; sides_only keeps a band of hair that hugs the skull outline at the sides (above and behind the ears)
        dome = outer * (YY < EY + 0.15 * I)
        head = np.clip(dome + oval, 0, 1)
        hair = np.zeros((SS, SS), np.float32)
        skullhair = np.maximum(outer, head)
        if hp.get('sides_only'):
            band = hp.get('band', 0.22)
            O2 = superellipse_outline(top - 0.004, w + 0.02, yw, n, sb + 0.03)
            outer_h = poly_mask(np.stack(px_(O2[:, 0], O2[:, 1]), 1), 1.0)
            d_in = cv2.distanceTransform((outer_h > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
            bandm = 1.0 - smoothstep(0.55 * band * I, band * I, d_in)
            st = hp.get('sides_top', -1.2)
            ramp = smoothstep(EY + st * I, EY + (st + 0.50) * I, YY)
            fade_dn = 1.0 - smoothstep(EY + (sb - 0.16) * I, EY + (sb + 0.02) * I, YY)
            hair = bandm * ramp * fade_dn * outer_h * (1 - 0.9 * blur(oval, 1.5))
            skullhair = np.maximum(outer_h, head)
    else:
        hx, hy = hairline_curve(hp['hl'])
        ptsF = np.vstack([np.stack(px_(hx, hy), 1), np.stack(px_(hx[::-1], np.full_like(hx, -0.30)), 1)])
        forehead = poly_mask(smooth_curve(ptsF, 160, closed=True), 1.0)
        yy_h = np.interp(np.abs((XX - CX) / I), hx[hx >= 0], hy[hx >= 0])
        below_hl = (YY > EY + yy_h * I).astype(np.float32)
        head = np.clip(forehead * outer + oval * below_hl, 0, 1)
        hair = np.clip(outer - head, 0, 1) * (YY < EY + sb * I + 2)
        lg = hp.get('long')
        if lg:                                                       # long hair: panels beside the face down to 'end'
            e = lg['end']; we = lg.get('w', w + 0.2)
            panel = np.array([[w, yw], [we, yw + (e - yw) * 0.45], [we * 0.96, e - 0.05], [we * 0.80, e], [0.62, e - 0.02], [0.60, 0.6], [0.95, 0.2], [1.02, -0.3]])
            panel = smooth_curve(panel, 80)
            pr = np.stack(px_(panel[:, 0], panel[:, 1]), 1); pl = np.stack(px_(-panel[:, 0], panel[:, 1]), 1)
            panels = np.clip(poly_mask(pr, 1.0) + poly_mask(pl, 1.0), 0, 1) * (1 - oval)
            hair = np.clip(hair + panels * (1 - head), 0, 1)
        skullhair = np.maximum(outer, head)
    if hp.get('bald'): hair = hair * 0
    return dict(head=clean(head, 3, 1, 1.2, False), hair=clean(hair, 3, 1, 1.2, False), skullhair=clean(np.clip(np.maximum(skullhair, hair), 0, 1), 3, 1, 1.2, False), outer=outer)

def fit_from_labels(lab, P, bald_thresh=6000):
    """measure the parameters on the (symmetrised) label map"""
    K = lambda *ks: np.isin(lab, ks)
    face = K(1, 2, 3, 4, 5, 6, 10, 11, 12, 13); hair = K(17); hat = K(18)
    both = face | hair | hat
    cols = lambda x: int(round(CX + x * I))
    hp = {}
    # top of the head at the centre columns
    band = both[:, cols(-0.35):cols(0.35)]
    ys = np.nonzero(band.any(1))[0]
    top = (ys.min() - EY) / I if len(ys) else -1.9
    hp['top'] = float(np.clip(top, -2.35, -1.45))
    # hairline at x = 0, .35, .7, 1.0 : the first skin pixel below the hair
    hl = []
    for x in (0.0, 0.35, 0.70, 1.00):
        c0, c1 = cols(x - 0.04), cols(x + 0.04); col = (face[:, c0:c1].mean(1) > 0.5)
        ysk = np.nonzero(col & (np.arange(SS) < EY + 0.1 * I))[0]
        y = (ysk.min() - EY) / I if len(ysk) else -0.9
        hl.append(float(y))
    # monotone: the hairline gets lower towards the temples
    hl = [float(np.clip(v, -2.2, -0.5)) for v in hl]
    for i in range(1, 4): hl[i] = max(hl[i], hl[i - 1] - 0.02)
    hp['hl'] = hl
    # the outer width and where it is widest, in the upper half of the head
    wd = []
    for yy in np.arange(-1.6, -0.1, 0.1):
        row = both[int(EY + yy * I)]; xs = np.nonzero(row)[0]
        wd.append(((xs.max() - xs.min()) / 2 / I if len(xs) else 0.0, yy))
    wmax, yw = max(wd, key=lambda t: t[0]); hp['w'] = float(np.clip(wmax, 1.0, 1.7)); hp['yw'] = float(np.clip(yw, -1.1, -0.3))
    # squareness: compare the width at y = top + 0.3 with a perfect ellipse
    yq = hp['top'] + 0.35; row = both[int(EY + yq * I)]; xs = np.nonzero(row)[0]
    wq = (xs.max() - xs.min()) / 2 / I if len(xs) else hp['w'] * 0.7
    e = np.clip((hp['yw'] - yq) / (hp['yw'] - hp['top']), 0.05, 0.95); ell = hp['w'] * np.sqrt(1 - (e) ** 2)
    ratio = np.clip(wq / max(ell, 1e-3), 0.7, 1.3); hp['n'] = float(np.clip(2.0 + (ratio - 1.0) * 6.0, 2.0, 4.0))
    # sideburns
    hs = hair.copy(); hs[:, :cols(-0.9)] = False; hs[:, cols(0.9):] = False  # the middle only is excluded: look at the sides
    side = hair & (np.abs(XX - CX) > 0.85 * I) & (YY < EY + 0.9 * I)
    ys = np.nonzero(side.any(1))[0]; hp['sb'] = float(np.clip((ys.max() - EY) / I if len(ys) else -0.2, -0.6, 0.6)) if hair.sum() > bald_thresh else -0.2
    hp['bald'] = bool(hair.sum() < bald_thresh)
    return hp

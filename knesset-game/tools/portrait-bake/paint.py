# drawing helpers on the 1024 canvas (float masks, anti-aliased)
import numpy as np, cv2
from scipy.interpolate import splprep, splev
SS = 1024
SH = 4   # sub-pixel bits for cv2 polygon drawing

def smooth_curve(pts, n=60, closed=False, s=0.0):
    pts = np.asarray(pts, float)
    if len(pts) < 4: return pts
    try:
        tck, u = splprep([pts[:, 0], pts[:, 1]], s=s, per=1 if closed else 0, k=3)
        xs, ys = splev(np.linspace(0, 1, n), tck); return np.stack([xs, ys], 1)
    except Exception:
        return pts

def poly_mask(pts, blur=0.0, shape=(SS, SS)):
    m = np.zeros(shape, np.float32)
    p = np.round(np.asarray(pts, float) * (1 << SH)).astype(np.int32)
    cv2.fillPoly(m, [p.reshape(-1, 1, 2)], 1.0, lineType=cv2.LINE_AA, shift=SH)
    if blur > 0: m = cv2.GaussianBlur(m, (0, 0), blur)
    return m

def line_mask(pts, width, blur=0.0, shape=(SS, SS), closed=False):
    m = np.zeros(shape, np.float32)
    p = np.round(np.asarray(pts, float) * (1 << SH)).astype(np.int32)
    cv2.polylines(m, [p.reshape(-1, 1, 2)], closed, 1.0, thickness=max(1, int(round(width))), lineType=cv2.LINE_AA, shift=SH)
    if blur > 0: m = cv2.GaussianBlur(m, (0, 0), blur)
    return m

def blur(a, s): return cv2.GaussianBlur(a.astype(np.float32), (0, 0), s)
def over(dst, color, alpha):
    """dst (H,W,3) float; color (3,) or (H,W,3); alpha (H,W)"""
    a = alpha[:, :, None]
    c = np.asarray(color, np.float32)
    if c.ndim == 1: c = c[None, None, :]
    return dst * (1 - a) + c * a

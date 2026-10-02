# The depth of every portrait: how far each picture element of the head stands out of the rim plane of the head (its widest part, about the plane of the ears): the skull, the relief
# of the face, the volume of the hair and the beard. The game turns the portrait towards the opponent with it (the drawn and the 3D fighters look at each other, not into the camera).
# python3 depthmap.py OUTDIR [id1,id2,...]  ->  OUTDIR/<id>.depth.webp (lossless, 8 bit, 128 x 128, the same square as the portraits: 5 inter-eye distances wide, the eye line 2.1 from the top;
#                                              0..255 = 0..DEPTH_RANGE inter-eye distances) for the game, and <id>.depth.png / .npy to look at
import sys, os, json, numpy as np, cv2
from multiprocessing import Pool
import compose as C
import rend2 as R
from rend2 import SS, I, CX, EY, blur, smoothstep

DEPTH_RANGE = 2.0      # inter-eye distances that a grey value of 255 stands for
OUT = 128

def full_depth(h, A):
    """depth in px of the 1024 canvas for the whole head: the measured face (the skull, nose, brows ...), a rounded volume for the hair and the beard"""
    Z = h.Z_base.astype(np.float32)
    skin = np.clip(h.m_head + h.m_neck, 0, 1)
    sil = (A > 0.45).astype(np.uint8)
    D = cv2.distanceTransform(sil, cv2.DIST_L2, 5).astype(np.float32)
    Rr = 300.0
    infl = Rr * np.sqrt(np.clip(1 - (1 - np.minimum(D, Rr) / Rr) ** 2, 0, 1)) * 0.52
    ws = blur(skin, 10)
    Zf = ws * Z + (1 - ws) * (infl * 0.92)
    Zf = np.maximum(Zf, infl * 0.7 * (1 - ws) + Zf * ws)
    Zf = blur(Zf, 6)
    return np.clip(Zf, 0, None) * (blur(sil.astype(np.float32), 3) > 0.02)

def one(args):
    id, outdir = args
    P, A, h = C.render_portrait(id, 1.0, eyes='open', mouth='smile', verbose=False)
    Z = full_depth(h, A)
    tilt = float(h.spec.get('tilt', 0.0))
    if abs(tilt) > 1e-3:
        R_ = cv2.getRotationMatrix2D((CX, EY + 2.2 * I), tilt, 1.0)
        Z = cv2.warpAffine(Z, R_, (SS, SS), flags=cv2.INTER_LINEAR)
        A = cv2.warpAffine(A, R_, (SS, SS), flags=cv2.INTER_LINEAR)
    x0, x1 = int(CX - 2.5 * I), int(CX + 2.5 * I); y0 = int(EY - 2.1 * I); y1 = y0 + (x1 - x0)
    z = Z[y0:y1, x0:x1]; a = A[y0:y1, x0:x1]
    # the depth outside the picture is the depth at its edge (the warp samples a little beyond the silhouette)
    zn = cv2.resize(z * a, (OUT, OUT), interpolation=cv2.INTER_AREA); an = cv2.resize(a, (OUT, OUT), interpolation=cv2.INTER_AREA)
    zz = np.where(an > 0.02, zn / np.maximum(an, 0.02), 0)
    for _ in range(6):                                                    # grow the depth outwards, so a bilinear lookup near the edge finds a sensible value
        zb = cv2.dilate(zz, np.ones((3, 3), np.uint8)); zz = np.where(an > 0.02, zz, zb)
    zz = zz / (I * DEPTH_RANGE)
    g = np.clip(zz * 255 + 0.5, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(outdir, id + '.depth.png'), g)
    from PIL import Image
    Image.fromarray(np.stack([g, g, g], -1)).save(os.path.join(outdir, id + '.depth.webp'), 'WEBP', lossless=True, method=6)
    np.save(os.path.join(outdir, id + '.depth.npy'), zz.astype(np.float32))
    print(id, 'depth max %.2f IPD' % (zz.max() * DEPTH_RANGE), flush=True)
    return id

if __name__ == '__main__':
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True)
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else list(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hp.json'))).keys())
    with Pool(4) as p: p.map(one, [(i, outdir) for i in ids], chunksize=1)

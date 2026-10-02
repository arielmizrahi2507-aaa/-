# per-person face geometry: the 478 mesh points rotated to the front, in units of the distance between the eyes, symmetrised and (optionally) caricatured
import os, json, numpy as np
DATA = os.environ.get('PORTRAIT_DATA', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))      # private inputs, see README
unit = lambda v: v / np.linalg.norm(v)
PAIRS = [(33, 263), (133, 362), (234, 454), (127, 356), (93, 323), (132, 361), (58, 288), (172, 397), (61, 291), (129, 358), (70, 300), (105, 334), (66, 296), (107, 336), (159, 386), (145, 374), (468, 473), (148, 377), (176, 400)]
lm = json.load(open(os.path.join(DATA, 'lm.json')))
info = json.load(open(os.path.join(DATA, 'front_info.json')))
IDS = list(lm.keys())

def frame(P):
    u = unit(np.mean([P[b] - P[a] for a, b in PAIRS], axis=0)); v0 = P[152] - P[10]; v = unit(v0 - np.dot(v0, u) * u); n = np.cross(u, v)
    return np.stack([u, v, n])

def normalised(id):
    P = np.array(lm[id], float); R = frame(P); Q = (P - P.mean(0)) @ R.T
    ec1, ec2 = (Q[33] + Q[133]) / 2, (Q[263] + Q[362]) / 2; ipd = np.linalg.norm(ec1[:2] - ec2[:2]); c = (ec1 + ec2) / 2
    M = (Q - c) / ipd          # x right, y down, z towards the viewer (positive = nearer?) -> checked below
    return M

RAW = {i: normalised(i) for i in IDS}
# make z grow towards the viewer: the nose tip must be in front of the eyes
for i in IDS:
    if RAW[i][1][2] < RAW[i][33][2]: RAW[i][:, 2] *= -1
AVG = np.mean([RAW[i] for i in IDS], axis=0)
# mirror partner of every landmark: an optimal one-to-one pairing of the average mesh with its reflection
from scipy.optimize import linear_sum_assignment
refl = AVG.copy(); refl[:, 0] *= -1
_C = np.linalg.norm(refl[:, None, :] - AVG[None, :, :], axis=2)
_r, MIR = linear_sum_assignment(_C)
MIDLINE = np.array([abs(AVG[k, 0]) < 0.045 or MIR[k] == k for k in range(478)])

def symmetric(M, side):
    """side > 0: the viewer's right half is the visible one (copy it to the left); side < 0 the opposite; 0: average both halves"""
    S = M.copy()
    for k in range(478):
        m = MIR[k]
        a, b = M[k], M[m].copy(); b[0] *= -1
        if side == 0: S[k] = (a + b) / 2
        elif (side > 0 and a[0] >= 0) or (side < 0 and a[0] <= 0): S[k] = a
        else: S[k] = b
        if MIDLINE[k]: S[k][0] = 0.0
    for k in range(478):                            # exact symmetry: the point on the right side defines its partner
        m = MIR[k]
        if k < m:
            r, l = (k, m) if S[k][0] >= S[m][0] else (m, k)
            S[l] = S[r].copy(); S[l][0] = -S[r][0]
    return S

def person_mesh(id, K=1.0):
    a = info[id]['asym']
    side = 0 if abs(a) < 0.12 else (1 if a > 0 else -1)
    M = symmetric(RAW[id], side)
    return M

SYM = {i: person_mesh(i) for i in IDS}
MEAN = np.mean([SYM[i] for i in IDS], axis=0)
def caricature(id, K=1.3):
    a = abs(info[id]['asym']); c = 1.0 if a < 0.12 else (0.8 if a < 0.3 else 0.6)
    return MEAN + K * c * (SYM[id] - MEAN)

if __name__ == '__main__':
    import cv2
    tiles = []
    for i in IDS:
        for K in (1.0, 1.6):
            M = caricature(i, K) if K != 1.0 else SYM[i]
            img = np.full((300, 300, 3), 30, np.uint8)
            pts = (M[:, :2] * 70 + np.array([150, 150 + 20])).astype(int)
            for p in pts: cv2.circle(img, tuple(p), 1, (200, 220, 255), -1)
            cv2.putText(img, '%s K%.1f' % (i, K), (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
            tiles.append(img)
    while len(tiles) % 14: tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[k:k + 14]) for k in range(0, len(tiles), 14)]
    cv2.imwrite('mesh_sheet.png', np.vstack(rows))
    print('mirror pairs ok', int(sum(MIR[MIR[k]] == k for k in range(478))), 'of 478')

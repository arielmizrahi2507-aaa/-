# landmark points -> proportions in units of the distance between the eyes: python3 measure.py lm.json meas.json
import json, sys
import numpy as np

lm = json.load(open(sys.argv[1]))
unit = lambda v: v / np.linalg.norm(v)
# pairs of points that are left / right of each other: their mean direction is the horizontal axis of the face
PAIRS = [(33, 263), (133, 362), (234, 454), (127, 356), (93, 323), (132, 361), (58, 288), (172, 397), (61, 291), (129, 358), (70, 300), (105, 334), (66, 296), (107, 336), (159, 386), (145, 374), (468, 473), (148, 377), (176, 400)]
res = {}
for k, pts in lm.items():
    if pts is None: continue
    P = np.array(pts, float)
    u = unit(np.mean([P[b] - P[a] for a, b in PAIRS], axis=0))
    v0 = P[152] - P[10]; v = unit(v0 - np.dot(v0, u) * u)      # down
    n = np.cross(u, v)
    Q = (P - P.mean(0)) @ np.stack([u, v, n]).T                 # the face seen from the front
    ec1, ec2 = (Q[33] + Q[133]) / 2, (Q[263] + Q[362]) / 2      # the centres of the eyes (they do not move with the gaze, the pupils do)
    ipd = np.linalg.norm(ec1[:2] - ec2[:2]); y0 = (ec1[1] + ec2[1]) / 2
    d = lambda a, b: abs(Q[a][0] - Q[b][0]) / ipd
    yy = lambda i: (Q[i][1] - y0) / ipd
    res[k] = {
        'ipd_px': float(ipd), 'fw_ear': d(234, 454), 'fw_cheek': d(127, 356), 'fw_cheek2': d(93, 323), 'fw_jaw1': d(132, 361), 'fw_jaw2': d(58, 288), 'fw_jaw3': d(172, 397), 'fw_chin': d(148, 377),
        'chin': yy(152), 'nose_tip': yy(1), 'nose_base': yy(2), 'mouth': (yy(13) + yy(14)) / 2, 'brow': (yy(105) + yy(334)) / 2, 'fore': yy(10),
        'nose_w': d(129, 358), 'mouth_w': d(61, 291), 'eye_w': (abs(Q[33][0] - Q[133][0]) + abs(Q[263][0] - Q[362][0])) / 2 / ipd,
        'asym': float(((Q[1][0] - Q[234][0]) - (Q[454][0] - Q[1][0])) / ipd),      # about 0 for a face seen from the front
    }
json.dump(res, open(sys.argv[2], 'w'), indent=1)
print(len(res), 'faces measured')

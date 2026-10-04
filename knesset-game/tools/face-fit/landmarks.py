# photos -> face-landmark points (478 per face, in photo pixels): python3 landmarks.py <photos dir> pairs.json lm.json
import json, sys
import numpy as np, cv2
import mediapipe as mp
from PIL import Image

photos, pairs_file, out_file = sys.argv[1:4]
pairs = json.load(open(pairs_file))
fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.3)
out = {}
for q in pairs:
    im = Image.open(photos.rstrip('/') + '/' + q['photo']).convert('RGB'); W, H = im.size
    bx, by, bw, bh = q['box']
    m = 0.25
    x0 = max(0, int(bx - bw * m)); y0 = max(0, int(by - bh * m)); x1 = min(W, int(bx + bw * (1 + m))); y1 = min(H, int(by + bh * (1 + m)))
    crop = np.array(im.crop((x0, y0, x1, y1)))
    sc = max(1.0, 640 / max(crop.shape[:2]))                         # small crops are enlarged for the detector
    big = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC) if sc > 1 else crop
    r = fm.process(big)
    if not r.multi_face_landmarks:
        out[q['id']] = None; print(q['id'], 'no face found'); continue
    h, w = big.shape[:2]
    out[q['id']] = [[p.x * w / sc + x0, p.y * h / sc + y0, p.z * w / sc] for p in r.multi_face_landmarks[0].landmark]
    print(q['id'], 'ok')
json.dump(out, open(out_file, 'w'))

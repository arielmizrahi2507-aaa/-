# 3D face textures: the head without accessories, mapped into the face space of the 3D head (planar front projection), 256 x 256
#   l in [-20, 20] (lateral, head units), y from 18.5 down to -28.5; column = (l + 20) / 40 * 256, row = (18.5 - y) / 47 * 256
# KU = head units per inter-eye distance (uniform), the eye line sits at y = EYE3
import sys, os, json, numpy as np, cv2
import compose as C
from rend2 import *
KU = 12.6; EYE3 = -1.0; TN = 256                                # head units per eye distance; height of the eye line in the 3D head
FL = 20.0; FYT = 18.5; FYH = 47.0                               # face space of the 3D head: lateral +-FL, from the height FYT down FYH units (the chin of a long face is at about -27)

def layout(h):
    """anchors of the face in units of the distance between the eyes (y down from the eye line), from the (caricatured) mesh"""
    M = h.M
    ax = lambda a, b: abs(M[a, 0] - M[b, 0]) / 2
    hl = []
    if getattr(h, 'hp', None) and not h.hp.get('bald') and not h.hp.get('sides_only'):          # the hairline (eye distances below the eye line) at x = 0 .. 1.9, for the hair of the 3D head
        import hairmodel as HM
        hx, hy = HM.hairline_curve(h.hp['hl'], x_end=1.9)
        hl = [float(np.interp(x, hx[hx >= 0], hy[hx >= 0])) for x in (0.0, 0.35, 0.70, 1.00, 1.15, 1.40, 1.90)]
    return dict(hl=hl, 
        brow=float((M[105, 1] + M[334, 1]) / 2), nose_tip=float(M[1, 1]), nose_base=float(M[2, 1]), alar=float(ax(129, 358)),
        lip_top=float(M[0, 1]), seam=float((M[13, 1] + M[14, 1]) / 2), lip_bot=float(M[17, 1]), mouth_half=float(ax(61, 291)),
        chin=float(M[152, 1]), jaw_y=float((M[132, 1] + M[361, 1]) / 2), jaw_half=float(ax(132, 361)), cheek_y=float((M[234, 1] + M[454, 1]) / 2), cheek_half=float(ax(234, 454)),
        top=float(M[10, 1]), eye_half=float(abs(M[33, 0] - M[263, 0]) / 2))

RELIEF_RANGE = 10.6                                             # head units that a relief value of +-127 stands for

def to_face(img, out, pad_value=0.0, interp=cv2.INTER_LINEAR):
    """resample a canvas image (1024 px, 150 px per eye distance) into the face space of the 3D head (out x out pixels)"""
    u, v = np.meshgrid(np.arange(out), np.arange(out))
    l = (u + 0.5) / out * 2 * FL - FL; y = FYT - (v + 0.5) / out * FYH
    X = (CX + l / KU * I).astype(np.float32); Y = (EY - (y - EYE3) / KU * I).astype(np.float32)
    fx = out / (2 * FL) * KU / I; fy = out / FYH * KU / I           # output px per canvas px
    f = min(fx, fy)
    sm = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_AREA) if f < 1 else img
    k = sm.shape[0] / img.shape[0]
    return cv2.remap(sm, X * k, Y * k, interp, borderMode=cv2.BORDER_CONSTANT, borderValue=pad_value)

def relief_tex(h, out=128):
    """the shape of the face without the broad dome of the head (nose, brows, sockets, lips, cheeks, chin), as 8 bit: 128 = flat"""
    m = np.clip(blur((h.m_head > 0.5).astype(np.float32), 3.0), 0, 1)
    rel = (h.Z_base - h.Z_infl) * m * (KU / I)                      # head units
    r = to_face(rel.astype(np.float32), out)
    return np.clip(128 + r / RELIEF_RANGE * 127, 0, 255).astype(np.uint8)

def face_tex(id, eyes, mouth, out=TN):
    P, A, h = C.render_portrait(id, 1.0, eyes=eyes, mouth=mouth, verbose=False, skip=('glasses', 'kippah', 'earring', 'clothes'))
    img, a = C.to_srgb_rgba(P, A)                                   # straight sRGB colour + alpha, canonical frame (1024 px, 150 px per eye distance)
    skin = np.array([int(h.L['skin'][i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
    comp = img * a[:, :, None] + (skin * 0.86)[None, None, :] * (1 - a[:, :, None])
    tex = to_face(comp, out, 0.0)
    # the colour of the cheeks: the plain skin the texture fades into at its edges (no seam to the back of the head, which uses one texel of the border)
    cx0 = lambda l: int((l + FL) / (2 * FL) * out); cy0 = lambda y: int((FYT - y) / FYH * out)
    yA, yB = cy0(EYE3 - 0.40 * KU), cy0(EYE3 - 0.85 * KU)
    cheek = np.concatenate([tex[yA:yB, cx0(-0.85 * KU):cx0(-0.5 * KU)].reshape(-1, 3), tex[yA:yB, cx0(0.5 * KU):cx0(0.85 * KU)].reshape(-1, 3)]).mean(0)
    yy, xx = np.mgrid[0:out, 0:out].astype(np.float32)
    d = np.minimum(np.minimum(xx, out - 1 - xx), yy) * (2 * FL / out)      # distance to the left / right / top border in head units
    wgt = smoothstep(0.3, 4.0, d)[:, :, None]
    tex = tex * wgt + cheek[None, None, :] * (1 - wgt)
    return np.clip(tex, 0, 1), h

if __name__ == '__main__':
    ids = sys.argv[1].split(','); st = sys.argv[2] if len(sys.argv) > 2 else 'open,closed'
    e, m = st.split(',')
    tiles = []
    for id in ids:
        t, h = face_tex(id, e, m)
        cv2.imwrite('ft_%s.png' % id, cv2.cvtColor((t * 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
        tiles.append((t * 255).astype(np.uint8))
        print(id, {k: round(v, 3) for k, v in layout(h).items()})
    cv2.imwrite('ft_sheet.png', cv2.cvtColor(np.hstack(tiles), cv2.COLOR_RGB2BGR))

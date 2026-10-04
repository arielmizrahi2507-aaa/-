# hair v3: soft hairline over a scalp layer, ragged silhouette, wobbling flow, clumps, thin hair that lets the scalp show, contact shadow, flyaways
import numpy as np, cv2
from rend2 import SS, I, CX, EY, XX, YY, blur, smoothstep, hexlin, noise, fbm, LKEY, normals, over, lum
from rend2 import T as _T
import strands as ST

# flow presets: c = centre of the radial part (IPD units from the eye centre), r radial weight, up/down weights, wob = angular wobble (rad)
FLOWS = {
    'swept':  dict(c=(0.0, -0.55), r=1.0, up=1.5, down=0.0, wob=0.16, wob_s=60, wob2=0.07),
    'back':   dict(c=(0.0, -0.40), r=1.0, up=1.1, down=0.0, wob=0.20, wob_s=55, wob2=0.08),
    'crop':   dict(c=(0.0, -2.20), r=1.0, up=0.0, down=0.0, wob=0.34, wob_s=30, wob2=0.16),
    'spiky':  dict(c=(0.0, -0.60), r=1.0, up=0.7, down=0.0, wob=0.46, wob_s=22, wob2=0.20),
    'part':   dict(c=(0.0, -1.80), r=0.75, up=0.0, down=0.6, wob=0.14, wob_s=60, wob2=0.06),
    'down':   dict(c=(0.0, -1.80), r=0.25, up=0.0, down=1.0, wob=0.30, wob_s=70, wob2=0.10),
    'sides':  dict(c=(0.0, -0.20), r=1.0, up=0.0, down=0.55, wob=0.14, wob_s=40, wob2=0.08),
}

# texture presets (px)
STYLES = {
    'swoop':   dict(flow='swept', fine_len=16, lock_len=30, mid_len=14, k_fine=0.16, k_lock=0.22, k_mid=0.14, spec=0.20, spec_pow=14, thin=0.0, soft=10, fuzz=0.30),
    'comb':    dict(flow='swept', fine_len=16, lock_len=30, mid_len=14, k_fine=0.16, k_lock=0.22, k_mid=0.14, spec=0.20, spec_pow=14, thin=0.0, soft=10, fuzz=0.30),
    'part':    dict(flow='part',  fine_len=16, lock_len=34, mid_len=14, k_fine=0.16, k_lock=0.22, k_mid=0.14, spec=0.22, spec_pow=14, thin=0.0, soft=10, fuzz=0.30),
    'crop':    dict(flow='crop',  fine_len=9,  lock_len=16, mid_len=9,  k_fine=0.20, k_lock=0.22, k_mid=0.16, spec=0.14, spec_pow=12, thin=0.0, soft=9, fuzz=0.35),
    'buzz':    dict(flow='crop',  fine_len=5,  lock_len=8,  mid_len=5,  k_fine=0.26, k_lock=0.16, k_mid=0.10, spec=0.08, spec_pow=10, thin=0.25, soft=7, fuzz=0.28),
    'thin':    dict(flow='back',  fine_len=12, lock_len=24, mid_len=10, k_fine=0.18, k_lock=0.20, k_mid=0.14, spec=0.16, spec_pow=12, thin=0.55, soft=12, fuzz=0.34),
    'spiky':   dict(flow='spiky', fine_len=11, lock_len=18, mid_len=9,  k_fine=0.20, k_lock=0.26, k_mid=0.18, spec=0.16, spec_pow=12, thin=0.0, soft=8, fuzz=0.45),
    'curly':   dict(flow='crop',  fine_len=7,  lock_len=12, mid_len=8,  k_fine=0.26, k_lock=0.28, k_mid=0.22, spec=0.12, spec_pow=10, thin=0.0, soft=8, fuzz=0.50, wob_k=3.0),
    'wavy':    dict(flow='down',  fine_len=28, lock_len=70, mid_len=30, k_fine=0.14, k_lock=0.24, k_mid=0.16, spec=0.30, spec_pow=22, thin=0.0, soft=4, fuzz=0.30),
    'layered': dict(flow='down',  fine_len=28, lock_len=70, mid_len=30, k_fine=0.14, k_lock=0.24, k_mid=0.16, spec=0.30, spec_pow=22, thin=0.0, soft=4, fuzz=0.30),
    'bob':     dict(flow='down',  fine_len=26, lock_len=64, mid_len=28, k_fine=0.13, k_lock=0.22, k_mid=0.14, spec=0.32, spec_pow=24, thin=0.0, soft=4, fuzz=0.26),
    'sides':   dict(flow='sides', fine_len=8,  lock_len=14, mid_len=8,  k_fine=0.22, k_lock=0.18, k_mid=0.12, spec=0.10, spec_pow=10, thin=0.0, soft=7, fuzz=0.30),
}


# strand layer (hair4.py): length range of the strands in px, density, passes, wander (bend of a single lock), size of a lock
STRANDS = {
    'swoop':   dict(length=(50, 130), wander=0.30, lock_scale=26),
    'comb':    dict(length=(50, 130), wander=0.30, lock_scale=26),
    'part':    dict(length=(50, 130), wander=0.30, lock_scale=26),
    'crop':    dict(length=(14, 36), wander=0.40, lock_scale=14),
    'buzz':    dict(length=(6, 14), wander=0.30, lock_scale=8, density=0.9),
    'thin':    dict(length=(30, 90), wander=0.40, lock_scale=22),
    'spiky':   dict(length=(16, 44), wander=0.45, lock_scale=14),
    'curly':   dict(length=(10, 26), wander=1.00, lock_scale=10),
    'wavy':    dict(length=(110, 300), wander=0.45, lock_scale=34),
    'layered': dict(length=(110, 300), wander=0.45, lock_scale=34),
    'bob':     dict(length=(90, 240), wander=0.40, lock_scale=34),
    'sides':   dict(length=(20, 70), wander=0.35, lock_scale=14),
}

def _flow(kind_or_dict, seed, wob_k=1.0, part_x=None):
    F = dict(FLOWS[kind_or_dict]) if isinstance(kind_or_dict, str) else dict(kind_or_dict)
    cx, cy = CX + F['c'][0] * I, EY + F['c'][1] * I
    if part_x is not None: cx = part_x
    def f(x, y):
        dx, dy = x - cx, y - cy; n = np.hypot(dx, dy) + 1e-6
        vx = F['r'] * dx / n; vy = F['r'] * dy / n - F['up'] + F['down']
        m = np.hypot(vx, vy) + 1e-6
        return vx / m, vy / m
    vx, vy = ST.flow_grid(f)
    ang = F['wob'] * wob_k * fbm(seed + 3, [max(8, int(F['wob_s'])), max(6, int(F['wob_s']) // 3)], [1.0, 0.5]) + F['wob2'] * wob_k * noise(seed + 8, 7)
    c, s = np.cos(ang), np.sin(ang)
    return vx * c - vy * s, vx * s + vy * c

def _cast_fx(alpha, skin_mask, strength=0.34, dx=3, dy=7, sig=6.0):
    sh = np.roll(blur(alpha, sig), (dy, dx), (0, 1))
    return 1.0 - strength * np.clip(sh, 0, 1) * (1 - alpha) * skin_mask

def draw_hair3(img, h, seed=5):
    L = h.L; hr = L.get('hair') or {}
    style = hr.get('style', 'none')
    dt = float(h.spec.get('dome_tint', 0.0))
    if dt > 0 and hr.get('color'):                                   # a balding head: the dome carries a shadow of short hair
        top_w = smoothstep(EY - 0.1 * I, EY - 1.35 * I, YY) * h.m_head
        n_ = 0.65 + 0.35 * np.clip(0.5 + 0.5 * ST.norm_field(noise(70, 2), top_w), 0, 1)
        img = over(img, hexlin(hr['color']) * 0.7, np.clip(dt * top_w * n_, 0, 1))
    if style == 'none' or h.m_hair.sum() < 300: return img, np.zeros((SS, SS), np.float32)
    S = dict(STYLES.get(style, STYLES['crop'])); S.update(h.spec.get('hair', {}))
    mask = np.clip(h.m_hair, 0, 1)
    base = hexlin(hr.get('color', '#333333')); mix = hexlin(hr.get('mix', hr.get('color', '#333333'))); skinc = hexlin(L['skin'])
    flow_name = S.get('flow_custom') or S['flow']
    vx, vy = _flow(flow_name, seed, S.get('wob_k', 1.0), part_x=(CX + S['part'] * I) if 'part' in S else None)
    # ---- distance fields: to the exposed skin (hairline) and to the outside
    skin_reg = (np.clip(h.m_head - mask, 0, 1) > 0.5).astype(np.uint8)
    d_skin = cv2.distanceTransform(1 - skin_reg, cv2.DIST_L2, 5).astype(np.float32)
    # ---- fibres
    fine, lock, grey = ST.hair_texture(mask, vx, vy, seed, S['fine_len'], S['lock_len'], S.get('lock_scale', 1.9))
    mid = ST.norm_field(ST.lic(cv2.GaussianBlur(ST.white_noise(seed + 5, 0), (0, 0), S.get('mid_scale', 4.2)), vx, vy, S['mid_len'], 1.5), mask)
    hc = _T('hair_c', 0.65)
    br = np.exp(hc * (S['k_fine'] * fine + S['k_lock'] * lock + S['k_mid'] * mid))
    col = base[None, None, :] * br[:, :, None]
    gf = 0.34 if hr.get('mix') else 0.0
    gf = float(S.get('grey', gf))
    if gf > 0:
        gm = smoothstep(1.0 - 2.0 * gf, 1.0 - 2.0 * gf + 0.9, grey)
        col = col * (1 - gm)[:, :, None] + (mix[None, None, :] * br[:, :, None]) * gm[:, :, None]
    # ---- the volume
    dm = h.m_skullhair
    D = cv2.distanceTransform((dm > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    Zh = blur(np.sqrt(np.clip(D, 0, S.get('dome_cap', 70))) * S.get('dome', 6.5), 5)
    gy, gx = np.gradient(Zh)
    nx, ny, nz = -gx, -gy, np.ones_like(Zh); nn = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2); nx, ny, nz = nx / nn, ny / nn, nz / nn
    ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.30) / 1.30, 0, 1)
    D2 = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    shade = (0.36 + 0.92 * ndl) * (1 - 0.30 + 0.30 * smoothstep(0, 18, D))                  # darker towards the outer edge of the head only (not at the hairline)
    shade = shade * (0.90 + 0.10 * smoothstep(0, 26, d_skin))                     # roots: a little darker near the hairline
    # broad glossy band (the 'angel ring') from the dome normal; modulated by the clump noise so that only some locks glint
    slope = gx * vx + gy * vy
    T = np.stack([vx, vy, slope], -1); T = T / (np.linalg.norm(T, axis=2, keepdims=True) + 1e-6)
    HV = LKEY + np.array([0, 0, 1.0], np.float32); HV = HV / np.linalg.norm(HV)
    TH = T[:, :, 0] * HV[0] + T[:, :, 1] * HV[1] + T[:, :, 2] * HV[2]
    sp = np.power(np.clip(1 - TH ** 2, 0, 1), S['spec_pow'] / 2) * np.clip(ndl * 1.1, 0, 1) * np.clip(0.55 + 0.45 * lock, 0.1, 1.2) * np.clip(0.7 + 0.3 * fine, 0.3, 1.2)
    spec_col = np.clip(0.40 * base / max(float(base.max()), 1e-3) + 0.60, 0, 1)
    rgb = col * shade[:, :, None] + sp[:, :, None] * S['spec'] * _T('hair_spec', 0.6) * spec_col[None, None, :] * (0.4 + 0.6 * float(base.mean() > 0.12))
    # ---- exposure calibration to the wanted average colour
    sel = mask > 0.5
    if sel.sum() > 200:
        target = base * float(S.get('exposure', 0.80)); m = float(lum(rgb[sel]).mean()); k = float(np.clip(float(lum(target)) / max(m, 1e-4), 0.45, 2.0)); rgb = rgb * k
    # ---- single strands over the fibre texture
    strand_cov = None
    if S.get('strands', _T('strands', 1.0)) and style not in ('none',):
        import hair4 as H4
        SP = dict(STRANDS.get(style, STRANDS['crop'])); SP.update(S.get('strand', {}))
        spec_map = np.clip(sp * S['spec'] * _T('hair_spec', 0.6) * 2.2, 0, 1.5).astype(np.float32)
        gfr = float(S.get('grey', 0.34 if hr.get('mix') else 0.0))
        shade_s = np.clip(shade * float(S.get('s_shade', 1.0)), 0.05, 2.0).astype(np.float32)
        rootw = (0.10 + 0.90 * smoothstep(0.0, 34.0, d_skin)).astype(np.float32)
        rgb_s, strand_cov = H4.strand_hair(mask, vx, vy, base, mix, gfr, shade_s, spec_map, spec_col, seed, rootw=rootw, density=float(S.get('s_density', 1.0)) * SP.pop('density', 1.0), passes=int(S.get('s_passes', 3)),
                                           contrast=float(S.get('s_contrast', 0.22)), tone=float(S.get('s_tone', 0.26)), thin=float(S['thin']), **SP)
        # the exposure of the strand layer follows the wanted average colour like the fibre texture does
        selc = (strand_cov > 0.5) & (mask > 0.5)
        if selc.sum() > 200:
            target = base * float(S.get('exposure', 0.80)); m = float(lum(rgb_s[selc]).mean()); k = float(np.clip(float(lum(target)) / max(m, 1e-4), 0.45, 2.0)); rgb_s = rgb_s * k
        rgb = rgb * (1 - strand_cov * 0.9)[:, :, None] + rgb_s * (strand_cov * 0.9)[:, :, None]
    # ---- alpha: ragged outer edge, soft hairline, thin hair
    mk = blur(mask, S.get('edge_blur', 3.4))
    fz = ST.norm_field(ST.lic(ST.white_noise(seed + 11, 0.7), vx, vy, 9, 1.3), mask) * float(S['fuzz'])
    a_edge = smoothstep(0.38, 0.62, mk + 0.20 * fz) * smoothstep(0.015, 0.06, mk)          # the noise must not create hairs far away from the mass
    R = float(S['soft']) * _T('soft_k', 1.6)
    n_soft = blur(ST.white_noise(seed + 12, 0), 2.0) * 3.0
    a_hl = smoothstep(0.0, 1.0, (d_skin - 1.0 + 0.40 * R * n_soft) / R)
    a_hl_fast = smoothstep(0.0, 1.0, (d_skin - 1.0 + 0.30 * R * n_soft) / (0.55 * R))
    thin = float(S['thin'])
    cover = np.ones_like(mk)
    if thin > 0:                                                    # strands thin out towards the hairline / the top, the scalp shows between them
        reg = smoothstep(0.0, 70.0, d_skin) * 0.35 + 0.65
        cover = smoothstep(-1.0 - 2.4 * (1 - thin), 0.9 - 1.3 * thin, fine + 0.9 * mid - 1.6 * thin * (1.1 - reg))
        cover = np.clip(0.30 + 0.70 * cover, 0, 1)
    # scalp layer: skin colour next to the hairline and the dark under-colour deeper in; opaque all over the mass, so that nothing of the background shows through the soft edge
    under_dark = (skinc * 0.62 * thin + base * 0.30 * (1 - thin))[None, None, :] * shade[:, :, None] * 0.9
    w_skin = 1.0 - smoothstep(0.0, 1.6 * R + 2.0, d_skin)
    skin_img = getattr(h, 'skin_img', None)
    if skin_img is not None: scalp = skin_img * (0.86 * w_skin)[:, :, None] + under_dark * (1 - w_skin)[:, :, None]            # the scalp next to the hairline is in the shade of the hair
    else: scalp = under_dark
    # the scalp layer is solid right up to the exposed skin: the hair mass ends exactly where the skin starts, so blurring the mass alone left a 1-2 px see-through gap (a dark line) along the hairline
    d_mask = cv2.distanceTransform((mask < 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    mk_s = blur(np.maximum(mask, ((h.m_head > 0.5) & (d_mask < 4.0)).astype(np.float32)), S.get('edge_blur', 3.4))
    scalp_a = smoothstep(0.50, 0.72, mk_s) * smoothstep(0.015, 0.06, mk)
    img = over(img, scalp, scalp_a)
    alpha_hair = np.clip(a_edge * (a_hl_fast if strand_cov is not None else a_hl) * cover, 0, 1)
    if strand_cov is not None:
        sc_ = np.clip(strand_cov * a_hl * (cover if thin > 0 else 1.0), 0, 1)
        alpha_hair = np.clip(1 - (1 - alpha_hair) * (1 - sc_ * 0.92), 0, 1)
    # ---- shadow of the hair on the skin below the hairline and at the temples
    skin_mask = np.clip(h.m_head, 0, 1)
    f = _cast_fx(alpha_hair, skin_mask, S.get('shadow', 0.32))
    img = img * f[:, :, None]
    img = over(img, rgb, alpha_hair)
    # ---- baby hairs along the hairline and flyaways at the silhouette
    rng = np.random.RandomState(seed + 31)
    lay = np.zeros((SS, SS), np.float32); lay_c = np.zeros((SS, SS, 3), np.float32)
    nb = int(S.get('baby', 0 if S['flow'] == 'down' else 110))
    hl_pts = np.argwhere((d_skin > 0.5) & (d_skin < 3.0) & (mask > 0.5))
    if len(hl_pts) > 50 and nb > 0:
        for _ in range(nb):
            y, x = hl_pts[rng.randint(len(hl_pts))]
            y = y + rng.uniform(-3, 7); x = x + rng.uniform(-2, 2)
            dx, dy = vx[int(np.clip(y, 0, SS - 1)), int(np.clip(x, 0, SS - 1))], vy[int(np.clip(y, 0, SS - 1)), int(np.clip(x, 0, SS - 1))]
            ln = rng.uniform(5, 15); b = rng.uniform(-0.35, 0.35)
            p0 = np.array([x, y], np.float32); p2 = p0 + np.array([dx, dy], np.float32) * ln; pm = (p0 + p2) / 2 + np.array([-dy, dx], np.float32) * ln * b
            tt = np.linspace(0, 1, 5)[:, None].astype(np.float32); pts = (1 - tt) ** 2 * p0 + 2 * (1 - tt) * tt * pm + tt ** 2 * p2
            cv2.polylines(lay, [np.round(pts * 16).astype(np.int32).reshape(-1, 1, 2)], False, float(rng.uniform(0.35, 0.8)), 1, cv2.LINE_AA, 4)
    nf = int(S.get('fly', 70))
    ed = np.argwhere((a_edge > 0.25) & (a_edge < 0.85) & (d_skin > 14) & (mk > 0.08))
    if len(ed) > 50 and nf > 0:
        for _ in range(nf):
            y, x = ed[rng.randint(len(ed))]
            dx, dy = vx[y, x], vy[y, x]
            if rng.rand() < 0.5: dx, dy = -dx, -dy                  # some wander back
            a_ = np.arctan2(dy, dx) + rng.randn() * 0.5; dx, dy = np.cos(a_), np.sin(a_)
            ln = rng.uniform(10, 38); b = rng.uniform(-0.45, 0.45)
            p0 = np.array([x, y], np.float32); p2 = p0 + np.array([dx, dy], np.float32) * ln; pm = (p0 + p2) / 2 + np.array([-dy, dx], np.float32) * ln * b
            tt = np.linspace(0, 1, 6)[:, None].astype(np.float32); pts = (1 - tt) ** 2 * p0 + 2 * (1 - tt) * tt * pm + tt ** 2 * p2
            cv2.polylines(lay, [np.round(pts * 16).astype(np.int32).reshape(-1, 1, 2)], False, float(rng.uniform(0.25, 0.6)), 1, cv2.LINE_AA, 4)
    fiber_c = np.clip(rgb * 1.05, 0, 1.5)
    img = over(img, fiber_c, np.clip(lay, 0, 1) * 0.8)
    alpha_total = np.clip(np.maximum(scalp_a, alpha_hair) + np.clip(lay, 0, 1) * 0.8 * (1 - scalp_a), 0, 1)
    return img, alpha_total

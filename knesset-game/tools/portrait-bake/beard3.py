# beard v3: a soft shadow tone under the hairs, low-contrast fibres, patchy salt-and-pepper, thin coverage on the cheeks, ragged edge
import numpy as np, cv2
from rend2 import SS, I, CX, EY, XX, YY, blur, smoothstep, hexlin, noise, fbm, LKEY, normals, over, lum, beard_polygon, beard_flow, T
import strands as ST

def draw_beard3(img, h, bd, seed=21):
    L = h.L; sp = h.spec.get('beard', {})
    style = bd.get('style')
    ln = float(bd.get('len', 0.0)); flare = float(bd.get('flare', 0.0))
    ext = max(0.0, ln) * 0.376 * sp.get('ext_k', 1.0)
    region = beard_polygon(h, cheek=sp.get('cheek', 0.0), ext=ext, off=sp.get('off', 0.03 + 0.02 * max(ln, 0)), goatee=(style == 'goatee'), flare=flare * 0.25)
    lipgap = blur(np.clip(h.parts['lips_m'], 0, 1), 6.0) * 2.2
    region = region * np.clip(1 - lipgap * (0.0 if style == 'goatee' else 1.0), 0, 1)
    if region.sum() < 500: return img, np.zeros((SS, SS), np.float32)
    base = hexlin(bd['color']); chin = hexlin(bd.get('chin', bd['color'])); mix = hexlin(bd.get('mix', bd['color']))
    short = ln <= 0.3
    dense = float(sp.get('dense', 1.0))
    vx, vy = ST.flow_grid(beard_flow(curl=0.6 + 0.4 * ln + sp.get('curl', 0.0)))
    # ---- fibres
    fine, lock, grey = ST.hair_texture(region, vx, vy, seed + 3, 8 if short else 16 + int(8 * ln), 26 if short else 44 + int(14 * ln), 1.5)
    mott = ST.norm_field(ST.lic(cv2.GaussianBlur(ST.white_noise(seed + 7, 0), (0, 0), 3.4), vx, vy, 22, 1.5), region)
    longb = ln > 1.0
    br = np.exp(float(sp.get('k_fine', 0.13 if longb else 0.20)) * fine + float(sp.get('k_lock', 0.13 if longb else 0.24)) * lock)
    t_chin = smoothstep(EY + 0.85 * I, EY + 1.95 * I, YY)
    gf = float(sp.get('grey', 0.34 if bd.get('mix') else 0.0))
    gsel = 0.75 * mott + 0.45 * grey
    gm = smoothstep(1.0 - 2.2 * gf, 1.0 - 2.2 * gf + 1.6, gsel) if gf > 0 else np.zeros_like(fine)
    base_t = base[None, None, :] * (1 - t_chin)[:, :, None] + chin[None, None, :] * t_chin[:, :, None]
    col = base_t * br[:, :, None]
    col = col * (1 - gm)[:, :, None] + (mix[None, None, :] * br[:, :, None]) * gm[:, :, None]
    # ---- lighting from the volume of the mass
    D = cv2.distanceTransform((region > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    Zh = blur(np.sqrt(np.clip(D, 0, 90)) * 5.0, 5)
    gy, gx = np.gradient(Zh)
    nx, ny, nz = -gx, -gy, np.ones_like(Zh); nn = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2); nx, ny, nz = nx / nn, ny / nn, nz / nn
    ndl = np.clip((nx * LKEY[0] + ny * LKEY[1] + nz * LKEY[2] + 0.30) / 1.30, 0, 1)
    shade = ((0.55 + 0.55 * ndl) if longb else (0.40 + 0.80 * ndl)) * (0.70 + 0.30 * smoothstep(0, 16, D))
    sp_ = np.power(np.clip(1 - (vx * 0.2 + vy * 0.3) ** 2, 0, 1), 6) * np.clip(ndl, 0, 1) * (0.02 if longb else 0.07)
    rgb = col * shade[:, :, None] + sp_[:, :, None]
    # exposure to the wanted colours (upper part -> cheek colour, lower part -> chin colour)
    sel = region > 0.5
    if sel.sum() > 300:
        ex = float(sp.get('exposure', 0.78)); up = sel & (t_chin < 0.5); lo = sel & (t_chin >= 0.5)
        s_up = np.clip(float(lum(base * ex)) / max(float(lum(rgb[up]).mean()) if up.any() else 1e-3, 1e-3), 0.4, 2.0)
        s_lo = np.clip(float(lum(chin * ex)) / max(float(lum(rgb[lo]).mean()) if lo.any() else 1e-3, 1e-3), 0.4, 2.0)
        rgb = rgb * (s_up * (1 - t_chin) + s_lo * t_chin)[:, :, None]
    # ---- coverage: thin on the cheeks, dense at the jaw and chin, ragged edge
    soft = blur(region, 1.6)
    feather = smoothstep(EY + 0.20 * I, EY + 0.70 * I, YY)
    cheekthin = 0.30 + 0.70 * smoothstep(EY + 0.45 * I, EY + 1.15 * I, YY)
    cov_n = 0.5 + 0.5 * np.clip(ST.norm_field(ST.lic(ST.white_noise(seed + 9, 0.8), vx, vy, 9, 1.2), region), -1.5, 1.5)
    cover = np.clip((0.35 + 0.95 * dense * cheekthin) * (0.55 + 0.75 * cov_n), 0, 1)
    rb = blur(region, 3.2)
    edge_rag = smoothstep(0.30, 0.70, rb + 0.16 * ST.norm_field(ST.lic(ST.white_noise(seed + 11, 0.7), vx, vy, 8, 1.2), region)) * smoothstep(0.015, 0.06, rb)
    alpha = np.clip(edge_rag * (0.10 + 0.90 * feather) * cover, 0, 1)
    # ---- the shade of the beard under the hairs (the skin looks dark where the beard is dense)
    under_a = np.clip(soft * (0.10 + 0.90 * feather) * (0.30 + 0.45 * dense * cheekthin), 0, 0.85) * (0.8 if short else 1.0)
    under_c = (base_t * 0.42 + hexlin(L['skin'])[None, None, :] * 0.18) * shade[:, :, None]
    img = over(img, under_c, under_a)
    img = over(img, rgb, alpha)
    return img, np.clip(alpha + under_a * (1 - alpha), 0, 1)


def draw_stubble3(img, h, bd, seed=41):
    """short beard: thousands of tiny strokes over a soft tone of beard shadow (grey or dark), dense at the chin and jaw, thin at the cheek line"""
    L = h.L; sp = h.spec.get('beard', {})
    amount = float(bd.get('stub', 0.85)) * float(sp.get('dense', 1.0))
    region = beard_polygon(h, cheek=sp.get('cheek', 0.0), ext=0.0, off=sp.get('off', 0.02))
    lipgap = blur(np.clip(h.parts['lips_m'], 0, 1), 5.0) * 2.0
    region = region * np.clip(1 - lipgap, 0, 1) * np.clip(h.m_head + h.m_neck * 0.0, 0, 1)
    if region.sum() < 500: return img, np.zeros((SS, SS), np.float32)
    base = hexlin(bd['color']); chin = hexlin(bd.get('chin', bd['color'])); mix = hexlin(bd.get('mix', bd['color']))
    gf = float(sp.get('grey', 0.55 if bd.get('mix') else 0.0))
    D = cv2.distanceTransform((region > 0.5).astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    edge = smoothstep(0.0, 0.30 * I, D)
    lowr = 0.45 + 0.55 * smoothstep(EY + 0.55 * I, EY + 1.35 * I, YY)
    dens = np.clip(region * edge * lowr, 0, 1)
    t_chin = smoothstep(EY + 0.85 * I, EY + 1.8 * I, YY)
    tone_c = (base * (1 - t_chin)[:, :, None] + chin * t_chin[:, :, None]) * 0.55 + hexlin(L['skin'])[None, None, :] * 0.14
    img = over(img, tone_c, np.clip(blur(dens, 3.0) * (0.22 + 0.30 * amount), 0, 0.6))
    rng = np.random.RandomState(seed)
    ys, xs = np.nonzero(dens > 0.12)
    if len(xs) < 100: return img, np.clip(blur(dens, 2.0), 0, 1)
    w = dens[ys, xs].astype(np.float64); w = w / w.sum()
    n = int(len(xs) * 0.20 * (0.4 + amount))
    idx = rng.choice(len(xs), size=n, p=w)
    lay = np.zeros((SS, SS, 3), np.float32); cov = np.zeros((SS, SS), np.float32)
    flow = beard_flow(curl=0.3)
    for i in idx:
        x = xs[i] + rng.uniform(-0.5, 0.5); y = ys[i] + rng.uniform(-0.5, 0.5)
        dx, dy = flow(x, y); a_ = np.arctan2(dy, dx) + rng.randn() * 0.5; dx, dy = np.cos(a_), np.sin(a_)
        ln = rng.uniform(2.0, 4.2)
        grey_h = rng.rand() < (gf * (0.35 + 0.65 * float(t_chin[int(y), int(x)])))
        c = (mix if grey_h else (base * (1 - t_chin[int(y), int(x)]) + chin * t_chin[int(y), int(x)])) * rng.uniform(0.75, 1.25)
        ak = float(rng.uniform(0.45, 0.95))
        p0 = (int(x * 16), int(y * 16)); p1 = (int((x + dx * ln) * 16), int((y + dy * ln) * 16))
        cv2.line(lay, p0, p1, (float(c[0] * ak), float(c[1] * ak), float(c[2] * ak)), 1, cv2.LINE_AA, 4)
        cv2.line(cov, p0, p1, ak, 1, cv2.LINE_AA, 4)
    covc = np.clip(cov, 0, 1)
    col = np.where(cov[:, :, None] > 1e-3, lay / np.maximum(cov[:, :, None], 1e-3), 0)
    img = over(img, np.clip(col, 0, 1.5), covc * 0.9)
    return img, np.clip(np.maximum(covc * 0.9, blur(dens, 2.0) * 0.5), 0, 1)

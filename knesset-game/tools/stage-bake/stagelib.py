# Offline renderer for the realistic arena backdrops: a physically based path tracer (Mitsuba 3, CPU, LLVM JIT) + the Open Image Denoise library.
# The scenes are built from procedural geometry and procedural textures (numpy), there is no photograph anywhere.
#
# Conventions (metres): x to the right of the picture, y up, z away from the camera. The fighters stand in the plane z = 0 (x = 0 is the middle of the arena),
# the camera is D_CAM metres in front of it at the height H_CAM, looks along +z and is a lens-shift camera (vertical lines stay vertical).
# One metre in the fighters' plane is K pixels of the 960 x 540 game canvas, the floor line (the fighters' feet) is at y = GROUND_Y.
import os, sys, json, time, math, tempfile, shutil
import numpy as np, cv2

import mitsuba as mi, drjit as dr
mi.set_variant('llvm_ad_rgb')
import trimesh

K = 125.0                   # px per metre at the fighters' plane (a fighter of look.h = 1 is 215 px tall, so 1.72 m)
W, H = 960, 540             # the logical canvas of the game
GROUND_Y = 452.0
STAGE_W = 1600.0
D_CAM = 10.0                # distance camera - fighters' plane
F_PX = K * D_CAM            # focal length in logical pixels (the horizontal field of view of the 960 px canvas is 41.9 degrees)

def layer_f(z):
    """parallax factor of a layer whose content is z metres behind the fighters' plane (negative: in front of it)"""
    return D_CAM / (D_CAM + z)

def layer_width(f):
    return W + (STAGE_W - W) * f

def project(x, y, z, width, h_cam=1.5):
    """position (logical px) in the picture of a layer that is `width` px wide, of the world point (x, y, z): x to the right, y up, z away from the fighters' plane"""
    d = D_CAM + z
    return width / 2.0 + F_PX * x / d, GROUND_Y - K * h_cam - F_PX * (y - h_cam) / d

def floor_width(h_cam=1.5):
    """width (logical px) of the floor picture: the camera may be 320 px left or right of the middle and the nearest floor rows move 1.47 times as far"""
    yh = GROUND_Y - K * h_cam; fmax = (H - yh) / (K * h_cam)
    return int(round((W + 2 * 320 * fmax) / 10.0) * 10)

# ---------------------------------------------------------------------------------------------------------------- the layered integrator
class LayerPath(mi.SamplingIntegrator):
    """a path tracer whose camera rays only see part of the scene: the picture of one parallax layer, with an alpha channel; everything else is still in the scene for the light (shadows, bounces).
    mode 'slab':  the surfaces whose depth (along the optical axis) is between z_lo and z_hi, above the height y_cut (the floor belongs to the floor layer). The layer fades out over 'ramp' metres before z_hi
                  (so that it melts into the layer behind it); bg = 1 makes the background (the sky: what no ray hits) opaque.
    mode 'floor': only the floor (what is lower than y_cut) between the depths z_lo and z_hi, whatever stands in front of it: the ray starts just above the floor plane y = y_plane.
    AOVs: albedo and shading normal (for the denoiser)."""
    def __init__(self, props):
        super().__init__(props)
        self.z_lo = props.get('z_lo', 0.0); self.z_hi = props.get('z_hi', 1e9); self.ramp = props.get('ramp', 0.0); self.bg = props.get('bg', 0.0); self.clamp = props.get('clamp', 25.0)
        self.floor = props.get('floor', 0.0); self.y_plane = props.get('y_plane', 0.03); self.y_cut = props.get('y_cut', 0.0); self.refl = props.get('refl', 0.0)
        self.fwd = mi.Vector3f(0.0, 0.0, 1.0)
        self.kind = props.get('kind', 'path')
        d = {'type': self.kind, 'max_depth': int(props.get('max_depth', 8)), 'rr_depth': 5}
        self.inner = mi.load_dict(d)
    def sample(self, scene, sampler, ray, medium=None, active=True):
        if self.floor > 0.5:
            dy = ray.d.y
            down = active & (dy < -1e-5)
            ys = self.y_plane + 0.02
            t0 = (ys - ray.o.y) / dr.select(down, dy, -1.0)
            zc = ray.o.z + ray.d.z * t0 - ray.o.z                       # depth of the start point below the camera lens
            ok = down & (t0 > 0) & (zc >= self.z_lo) & (zc <= self.z_hi)
            r2 = mi.Ray3f(o=ray.o + ray.d * t0, d=ray.d, maxt=0.6 / dr.maximum(-dy, 1e-4), time=ray.time, wavelengths=ray.wavelengths)
            si = scene.ray_intersect(r2, ok)
            hit = ok & si.is_valid() & (si.p.y < self.y_cut)
        elif self.refl > 0.5:
            # the camera is the mirror image of the real one, below the floor: its rays start where they cross the floor plane and go up to the objects
            df = dr.dot(ray.d, self.fwd)
            t_lo = self.z_lo / df
            t_hi = self.z_hi / df
            dy = ray.d.y
            up = active & (dy > 1e-5)
            t0 = (self.y_plane + 0.02 - ray.o.y) / dr.select(up, dy, 1.0)
            t_start = dr.maximum(t0, t_lo)
            r2 = mi.Ray3f(o=ray.o + ray.d * t_start, d=ray.d, maxt=dr.minimum(ray.maxt, t_hi) - t_start, time=ray.time, wavelengths=ray.wavelengths)
            si = scene.ray_intersect(r2, up)
            hit = up & si.is_valid() & (si.p.y >= self.y_cut)
        else:
            df = dr.dot(ray.d, self.fwd)
            t_lo = self.z_lo / df
            t_hi = self.z_hi / df
            r2 = mi.Ray3f(o=ray.o + ray.d * t_lo, d=ray.d, maxt=dr.minimum(ray.maxt, t_hi) - t_lo, time=ray.time, wavelengths=ray.wavelengths)
            si = scene.ray_intersect(r2, active)
            hit = active & si.is_valid()
            if self.y_cut > 0.0:
                hit = hit & (si.p.y >= self.y_cut)
        spec, valid, aovs = self.inner.sample(scene, sampler, r2, medium, active if (self.bg > 0.5) else hit)
        em = si.emitter(scene, hit)                                  # a lamp or a screen seen directly keeps its brightness; only the light that comes by bounces is clamped (fireflies)
        spec = dr.minimum(spec, dr.select(em != None, 1e5, self.clamp))
        zh = si.p.z - ray.o.z
        w = mi.Float(1.0)
        if self.ramp > 0.0:
            t = dr.clip((self.z_hi - zh) / self.ramp, 0.0, 1.0)
            w = t * t * (3.0 - 2.0 * t)
        bsdf = si.bsdf(r2)
        alb = bsdf.eval_diffuse_reflectance(si, hit)
        n = si.sh_frame.n
        if self.bg > 0.5:
            alpha = dr.select(hit, w, 1.0); out = dr.select(hit, spec * w, spec)
            return (out, active, [dr.select(hit, alb.x, 0.0), dr.select(hit, alb.y, 0.0), dr.select(hit, alb.z, 0.0), dr.select(hit, n.x, 0.0), dr.select(hit, n.y, 0.0), dr.select(hit, n.z, 0.0)])
        return (dr.select(hit, spec * w, 0.0), hit & (w > 0.0), [alb.x, alb.y, alb.z, dr.select(hit, n.x, 0.0), dr.select(hit, n.y, 0.0), dr.select(hit, n.z, 0.0)])
    def aov_names(self): return ['alb.R', 'alb.G', 'alb.B', 'n.X', 'n.Y', 'n.Z']
    def to_string(self): return 'LayerPath[]'

mi.register_integrator('layerpath', lambda props: LayerPath(props))

# ---------------------------------------------------------------------------------------------------------------- colours
def s2l(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)
def l2s(c):
    c = np.clip(np.asarray(c, np.float32), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055).astype(np.float32)
def rgb(c):
    """'#rrggbb' or (r, g, b) in 0..1 (sRGB) -> linear rgb list"""
    if isinstance(c, str):
        c = c.lstrip('#'); c = [int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [float(v) for v in s2l(np.asarray(c, np.float32))]

# ---------------------------------------------------------------------------------------------------------------- tileable procedural textures (numpy): see texlib.py
import texlib
from texlib import (tex_planks, tex_parquet, tex_stone_tiles, tex_terrazzo, tex_cement_tile, tex_carpet, tex_paint, tex_fabric, tex_leather, tex_veneer,
                    tex_metal_brushed, tex_concrete, led_dots, snoise, fbm, palette, smooth, lin)
def height_to_normal(hgt, strength=2.0): return texlib.to_normal(hgt, strength)

# ---------------------------------------------------------------------------------------------------------------- Mitsuba texture / material dicts
def bmp(arr, rgb_ok=True):
    a = np.ascontiguousarray(arr, np.float32)
    if a.ndim == 2: a = np.dstack([a, a, a])
    return mi.Bitmap(a)

def T_(arr, tile=1.0, tile_v=None, raw=True, wrap='repeat'):
    """a bitmap texture; the UV of the meshes are in metres, tile = the size in metres that the image covers"""
    return {'type': 'bitmap', 'bitmap': bmp(arr), 'raw': raw, 'filter_type': 'bilinear', 'wrap_mode': wrap,
            'to_uv': mi.ScalarTransform4f().scale([1.0 / tile, 1.0 / (tile_v or tile), 1.0])}

def lin_rgb(c): return {'type': 'rgb', 'value': [float(v) for v in c]}

def B_diffuse(c): return {'type': 'diffuse', 'reflectance': c if isinstance(c, dict) else lin_rgb(rgb(c))}

def B_principled(base, rough=0.5, metallic=0.0, spec=0.5, clearcoat=0.0, cc_rough=0.03, sheen=0.0, aniso=0.0, trans=0.0, normal=None, twosided=False, anisotropic_rot=None):
    b = {'type': 'principled', 'base_color': base if isinstance(base, dict) else lin_rgb(rgb(base)), 'roughness': rough if isinstance(rough, dict) else float(rough),
         'metallic': metallic if isinstance(metallic, dict) else float(metallic), 'specular': float(spec)}
    if clearcoat: b['clearcoat'] = float(clearcoat); b['clearcoat_gloss'] = float(1.0 - cc_rough)
    if sheen: b['sheen'] = float(sheen)
    if aniso: b['anisotropic'] = float(aniso)
    if trans: b['spec_trans'] = float(trans)
    if normal is not None: b = {'type': 'normalmap', 'normalmap': normal, 'bsdf': b}
    if twosided: b = {'type': 'twosided', 'bsdf': b}
    return b

def B_glass(ior=1.5, tint=None):
    d = {'type': 'dielectric', 'int_ior': float(ior), 'ext_ior': 1.0}
    if tint is not None: d['specular_transmittance'] = lin_rgb(rgb(tint))
    return d

def B_pane(ior=1.5): return {'type': 'thindielectric', 'int_ior': float(ior), 'ext_ior': 1.0}

def B_black(): return {'type': 'diffuse', 'reflectance': {'type': 'rgb', 'value': [0.0, 0.0, 0.0]}}

def M_tex(tex, tile, nstr=0.0, rough_mul=1.0, rough_add=0.0, spec=0.5, metal=0.0, cc=0.0, cc_gloss=0.9, mul=None, two=True, sheen=0.0, tile_v=None, aniso=0.0):
    """a principled material from a (albedo, roughness, height) texture set; tile = the size of the texture in metres (tile_v for a different height)"""
    a, r, h = tex
    if mul is not None: a = a * np.asarray(mul, np.float32)[None, None, :]
    base = T_(a, tile, tile_v)
    rough = T_(np.clip(r * rough_mul + rough_add, 0.02, 1.0), tile, tile_v)
    nm = None
    if nstr > 0: nm = {'type': 'bitmap', 'bitmap': bmp(height_to_normal(h, nstr)), 'raw': True, 'filter_type': 'bilinear', 'wrap_mode': 'repeat',
                       'to_uv': mi.ScalarTransform4f().scale([1.0 / tile, 1.0 / (tile_v or tile), 1.0])}
    return B_principled(base, rough, metal, spec, cc, 1.0 - cc_gloss, sheen, aniso, 0.0, nm, two)

def E_area(radiance, scale=1.0):
    r = radiance if isinstance(radiance, dict) else lin_rgb([v * scale for v in (rgb(radiance) if isinstance(radiance, str) else radiance)])
    return {'type': 'area', 'radiance': r}

# ---------------------------------------------------------------------------------------------------------------- geometry (trimesh) -> PLY with UV in metres
def _rot(axis, deg):
    return trimesh.transformations.rotation_matrix(math.radians(deg), axis)
def _mov(x, y, z): return trimesh.transformations.translation_matrix([x, y, z])

def box(size, center=(0, 0, 0)):
    m = trimesh.creation.box(extents=size); m.apply_translation(center); return m
def cyl(r, h, center=(0, 0, 0), axis='y', seg=40, r2=None):
    if r2 is None: m = trimesh.creation.cylinder(radius=r, height=h, sections=seg)
    else:
        m = trimesh.creation.cone(radius=r, height=h, sections=seg) if r2 == 0 else trimesh.creation.cylinder(radius=r, height=h, sections=seg)
        if r2 not in (0, None):
            v = m.vertices.copy(); top = v[:, 2] > 0; v[top, :2] *= (r2 / r); m = trimesh.Trimesh(v, m.faces, process=False)
    if axis == 'y': m.apply_transform(_rot([1, 0, 0], -90))
    elif axis == 'x': m.apply_transform(_rot([0, 1, 0], 90))
    m.apply_translation(center); return m
def sphere(r, center=(0, 0, 0), sub=3, scale=(1, 1, 1)):
    m = trimesh.creation.icosphere(subdivisions=sub, radius=1.0)
    v = m.vertices * np.array(scale) * r; m = trimesh.Trimesh(v, m.faces, process=False); m.apply_translation(center); return m
def capsule(r, h, center=(0, 0, 0), axis='y', seg=24):
    m = trimesh.creation.capsule(radius=r, height=h, count=[seg, seg])
    if axis == 'y': m.apply_transform(_rot([1, 0, 0], -90))
    elif axis == 'x': m.apply_transform(_rot([0, 1, 0], 90))
    m.apply_translation(center); return m
def quad(p0, p1, p2, p3):
    """a quad from four corners (counter-clockwise seen from the front)"""
    return trimesh.Trimesh(np.array([p0, p1, p2, p3], np.float32), np.array([[0, 1, 2], [0, 2, 3]]), process=False)
def lathe(profile, seg=48, center=(0, 0, 0)):
    """surface of revolution about the y axis; profile = [(radius, y), ...] from bottom to top"""
    prof = np.array(profile, np.float32)
    ang = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    V = np.array([[r * math.cos(a), y, r * math.sin(a)] for (r, y) in prof for a in ang], np.float32)
    F = []
    n = len(prof)
    for i in range(n - 1):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg; c = (i + 1) * seg + (j + 1) % seg; d = (i + 1) * seg + j
            F += [[a, b, c], [a, c, d]]
    m = trimesh.Trimesh(V, np.array(F), process=False); m.apply_translation(center)
    m.fix_normals(); return m
def extrude(poly_xy, h, z0=0.0, holes=None):
    """a prism of the polygon (x, y) with the height h along +z, starting at z0"""
    from shapely.geometry import Polygon
    pg = Polygon(poly_xy, holes or [])
    m = trimesh.creation.extrude_polygon(pg, h); m.apply_translation([0, 0, z0]); return m
def tube(path, r, seg=16):
    """a round pipe along a polyline path"""
    path = np.asarray(path, np.float32)
    parts = []
    for a, b in zip(path[:-1], path[1:]):
        d = b - a; L = float(np.linalg.norm(d))
        if L < 1e-6: continue
        c = trimesh.creation.cylinder(radius=r, height=L, sections=seg)
        z = np.array([0, 0, 1.0]); dn = d / L
        ax = np.cross(z, dn); s = np.linalg.norm(ax); ang = math.atan2(s, float(np.dot(z, dn)))
        if s > 1e-6: c.apply_transform(trimesh.transformations.rotation_matrix(ang, ax / s))
        c.apply_translation((a + b) / 2); parts.append(c)
        sp = trimesh.creation.icosphere(subdivisions=2, radius=r); sp.apply_translation(b); parts.append(sp)
    return trimesh.util.concatenate(parts)
def union(ms): return trimesh.util.concatenate([m for m in ms if m is not None])
def bool_diff(a, b): return trimesh.boolean.difference([a, b], engine='manifold')
def bool_union(ms): return trimesh.boolean.union(ms, engine='manifold')
def moved(m, x=0, y=0, z=0, rx=0, ry=0, rz=0, s=None):
    m = m.copy()
    if s is not None: m.apply_scale(s)
    if rx: m.apply_transform(_rot([1, 0, 0], rx))
    if ry: m.apply_transform(_rot([0, 1, 0], ry))
    if rz: m.apply_transform(_rot([0, 0, 1], rz))
    m.apply_translation([x, y, z]); return m

def _uv_planar(tris_n, tris_v, rot=False, mode='tri'):
    ax = np.argmax(np.abs(tris_n), axis=1)[:, None]
    u = np.where(ax == 0, tris_v[:, :, 2], tris_v[:, :, 0]); v = np.where(ax == 1, tris_v[:, :, 2], tris_v[:, :, 1])
    if rot: u, v = v, u
    return np.stack([u, v], -1)

def write_ply(path, P, F, N=None, UV=None, C=None):
    n = len(P); props = [('x', '<f4'), ('y', '<f4'), ('z', '<f4')]
    if N is not None: props += [('nx', '<f4'), ('ny', '<f4'), ('nz', '<f4')]
    if UV is not None: props += [('u', '<f4'), ('v', '<f4')]
    if C is not None: props += [('r', '<f4'), ('g', '<f4'), ('b', '<f4')]
    a = np.empty(n, np.dtype(props))
    a['x'], a['y'], a['z'] = P[:, 0], P[:, 1], P[:, 2]
    if N is not None: a['nx'], a['ny'], a['nz'] = N[:, 0], N[:, 1], N[:, 2]
    if UV is not None: a['u'], a['v'] = UV[:, 0], UV[:, 1]
    if C is not None: a['r'], a['g'], a['b'] = C[:, 0], C[:, 1], C[:, 2]
    hdr = 'ply\nformat binary_little_endian 1.0\nelement vertex %d\n' % n + ''.join('property float %s\n' % p[0] for p in props) + 'element face %d\nproperty list uchar uint vertex_indices\nend_header\n' % len(F)
    fd = np.empty(len(F), np.dtype([('c', 'u1'), ('i', '<u4', (3,))])); fd['c'] = 3; fd['i'] = F
    with open(path, 'wb') as f:
        f.write(hdr.encode()); f.write(a.tobytes()); f.write(fd.tobytes())

# ---------------------------------------------------------------------------------------------------------------- scene builder
class SceneBuilder:
    def __init__(self, name):
        self.name = name; self.d = {'type': 'scene'}; self.n = 0
        self.tmp = tempfile.mkdtemp(prefix='stage_' + name + '_')
        self.stats = {'tris': 0}
    def _key(self, k=None):
        self.n += 1; return '%s_%d' % (k or 's', self.n)
    def B(self, name, bsdf):
        """a named BSDF that many meshes share (a reference, so that textures are not loaded twice)"""
        self.d['bsdf_' + name] = bsdf
        return {'type': 'ref', 'id': 'bsdf_' + name}
    def mesh(self, m, bsdf, emitter=None, uv='planar', smooth=False, rot_uv=False, colors=None, key=None, uv_center=None, uv_arr=None):
        """add a trimesh. uv: 'planar' = projection in metres along the dominant axis of each face, 'cyl' = round the vertical axis (columns), None/False = no UV;
        colors: per-vertex colours (n_vertices x 3, linear) for a mesh_attribute BSDF"""
        if m is None or len(m.faces) == 0: return None
        tri = m.triangles.astype(np.float32); nf = len(tri)
        if smooth:
            vn = m.vertex_normals.astype(np.float32); N = vn[m.faces].reshape(-1, 3)
        else:
            N = np.repeat(m.face_normals.astype(np.float32), 3, axis=0)
        fn = m.face_normals.astype(np.float32)
        if uv is True: uv = 'planar'
        UV = None
        if uv == 'planar': UV = _uv_planar(fn, tri, rot_uv).reshape(-1, 2).astype(np.float32)
        elif uv == 'given':
            ua = np.asarray(uv_arr, np.float32); UV = ua[m.faces].reshape(-1, 2)
        elif uv == 'cyl':
            c = np.asarray(uv_center, np.float32) if uv_center is not None else (m.bounds[0] + m.bounds[1]) / 2
            ang = np.arctan2(tri[:, :, 2] - c[2], tri[:, :, 0] - c[0])
            d = ang - ang[:, :1]; d = (d + np.pi) % (2 * np.pi) - np.pi; ang = ang[:, :1] + d
            rad = np.sqrt((tri[:, :, 0] - c[0]) ** 2 + (tri[:, :, 2] - c[2]) ** 2).mean(axis=1, keepdims=True)
            u = ang * rad; v = tri[:, :, 1]
            UV = (np.stack([v, u], -1) if rot_uv else np.stack([u, v], -1)).reshape(-1, 2).astype(np.float32)
        P = tri.reshape(-1, 3); F = np.arange(nf * 3, dtype=np.uint32).reshape(nf, 3)
        C = None
        if colors is not None:
            colors = np.asarray(colors, np.float32)
            C = colors[m.faces].reshape(-1, 3) if colors.shape[0] == len(m.vertices) else np.repeat(colors, 3, axis=0)
        path = os.path.join(self.tmp, '%s.ply' % self._key(key))
        write_ply(path, P, F, N, UV, C)
        d = {'type': 'ply', 'filename': path, 'bsdf': bsdf}
        if emitter is not None: d['emitter'] = emitter
        self.d[os.path.basename(path).replace('.', '_')] = d; self.stats['tris'] += nf
        return d
    def shape(self, d, key=None):
        self.d[self._key(key)] = d
    def cleanup(self): shutil.rmtree(self.tmp, ignore_errors=True)

# ---------------------------------------------------------------------------------------------------------------- lights
def L_rect(center, normal, w, h, radiance, up=(0, 0, 1)):
    """an area light: a w x h rectangle at 'center' emitting towards 'normal'"""
    n = np.asarray(normal, np.float32); n = n / np.linalg.norm(n)
    tf = mi.ScalarTransform4f().look_at(origin=list(center), target=list(np.asarray(center) + n), up=list(up)) @ mi.ScalarTransform4f().scale([w / 2, h / 2, 1])
    return {'type': 'rectangle', 'to_world': tf, 'bsdf': B_black(), 'emitter': E_area(radiance)}

def L_disk(center, normal, r, radiance, up=(0, 0, 1)):
    n = np.asarray(normal, np.float32); n = n / np.linalg.norm(n)
    tf = mi.ScalarTransform4f().look_at(origin=list(center), target=list(np.asarray(center) + n), up=list(up)) @ mi.ScalarTransform4f().scale([r, r, 1])
    return {'type': 'disk', 'to_world': tf, 'bsdf': B_black(), 'emitter': E_area(radiance)}

def L_spot(origin, target, intensity, cutoff=30.0, beam=20.0):
    return {'type': 'spot', 'to_world': mi.ScalarTransform4f().look_at(origin=list(origin), target=list(target), up=[0, 1, 0]), 'intensity': lin_rgb(intensity), 'cutoff_angle': float(cutoff), 'beam_width': float(beam)}

def L_point(pos, intensity): return {'type': 'point', 'position': list(pos), 'intensity': lin_rgb(intensity)}

def L_sun(direction_to_sun, radiance_scale=1.0, color=(1.0, 0.95, 0.85)):
    d = np.asarray(direction_to_sun, np.float32); d = d / np.linalg.norm(d)
    return {'type': 'directional', 'direction': list(-d), 'irradiance': lin_rgb([c * radiance_scale for c in color])}

def L_constant(c, scale=1.0): return {'type': 'constant', 'radiance': lin_rgb([v * scale for v in (rgb(c) if isinstance(c, str) else c)])}

def L_env(arr, scale=1.0, rot_y=0.0):
    """an equirectangular HDR environment (linear float array, +y up, the centre of the picture looks along +z)"""
    tf = mi.ScalarTransform4f().rotate([0, 1, 0], rot_y)
    return {'type': 'envmap', 'bitmap': mi.Bitmap(np.ascontiguousarray(arr, np.float32)), 'scale': float(scale), 'to_world': tf}

# ---------------------------------------------------------------------------------------------------------------- the camera and the render
def horizon_row(h_cam):
    return GROUND_Y - K * h_cam

def sensor_dict(width, height, fov_x, h_cam, aperture, spp, thin=True, mirror_y=False):
    yc = -h_cam if mirror_y else h_cam
    to_world = mi.ScalarTransform4f().look_at(origin=[0, yc, -D_CAM], target=[0, yc, 0], up=[0, 1, 0]) @ mi.ScalarTransform4f().scale([-1, 1, 1])
    film = {'type': 'hdrfilm', 'width': int(width), 'height': int(height), 'pixel_format': 'rgba', 'component_format': 'float32', 'rfilter': {'type': 'box'}}
    s = {'type': 'thinlens' if (aperture > 0 and thin) else 'perspective', 'fov': float(fov_x), 'fov_axis': 'x', 'to_world': to_world, 'film': film,
         'sampler': {'type': 'multijitter', 'sample_count': int(spp)}}
    if aperture > 0 and thin: s['aperture_radius'] = float(aperture); s['focus_distance'] = float(D_CAM)
    return s

def render_layer(builder, z_lo, z_hi, f, scale=1.0, h_cam=1.5, aperture=0.03, spp=64, pass_spp=16, max_depth=8, seed=0, kind='path', verbose=True, ramp=0.0, bg=False, clamp=25.0, floor=False, y_cut=0.0, width_px=None, reflect=False):
    """renders the surfaces between z_lo and z_hi metres behind the fighters' plane as the picture of a parallax layer of factor f.
    returns dict(rgb premultiplied linear (h, w, 3), alpha (h, w), albedo, normal) of size (H*scale, layer_width(f)*scale)"""
    Wl = (width_px if width_px else layer_width(f)); fw = int(round(Wl * scale))
    yh = horizon_row(h_cam); half = max(yh, H - yh) + 4
    fh = int(round(2 * half * scale)); fh += fh % 2
    fov = 2 * math.degrees(math.atan((fw / scale / 2.0) / F_PX))
    d = dict(builder.d)
    pass_spp = int(round(math.sqrt(pass_spp))) ** 2
    d['sensor'] = sensor_dict(fw, fh, fov, h_cam, aperture, pass_spp, mirror_y=reflect)
    d['integrator'] = {'type': 'layerpath', 'z_lo': float(z_lo + D_CAM), 'z_hi': float(z_hi + D_CAM), 'ramp': float(ramp), 'bg': 1.0 if bg else 0.0, 'clamp': float(clamp), 'floor': 1.0 if floor else 0.0, 'y_cut': float(y_cut), 'refl': 1.0 if reflect else 0.0, 'max_depth': int(max_depth), 'kind': kind}
    t0 = time.time()
    scene = mi.load_dict(d)
    if verbose: print('  scene loaded %.1fs (%d triangles)' % (time.time() - t0, builder.stats['tris']), flush=True)
    acc = None; passes = max(1, int(round(spp / pass_spp)))
    for i in range(passes):
        t1 = time.time()
        img = mi.render(scene, spp=pass_spp, seed=seed * 1000 + i); dr.eval(img)
        a = np.array(img, np.float64)
        acc = a if acc is None else acc + a
        if verbose: print('  pass %d/%d %.1fs' % (i + 1, passes, time.time() - t1), flush=True)
        del img
    acc /= passes
    top = int(round(fh / 2 - yh * scale)); hh = int(round(H * scale))
    if reflect:                                   # the picture seen from the mirrored camera, turned upside down about the horizon: the reflection that the floor shows
        c0 = int(round(yh * scale)); c = fh // 2; n = hh - c0
        out = np.zeros((hh,) + acc.shape[1:], acc.dtype)
        if n > 0: out[c0:c0 + n] = acc[c - n:c][::-1]
        acc = out
    else:
        acc = acc[top:top + hh]
    return {'rgb': acc[..., 0:3].astype(np.float32), 'alpha': acc[..., 3].astype(np.float32), 'albedo': acc[..., 4:7].astype(np.float32), 'normal': acc[..., 7:10].astype(np.float32), 'scale': scale, 'f': f, 'floor': 1.0 if floor else 0.0, 'width': Wl}

# ---------------------------------------------------------------------------------------------------------------- denoise, bloom, tone mapping
def denoise(rgb_img, albedo=None, normal=None, hdr=True):
    """Open Image Denoise. The images are shared with the library (it keeps pointers, not copies), so every array must stay alive until execute() has returned"""
    import pyoidn
    h, w, _ = rgb_img.shape
    col = np.ascontiguousarray(np.maximum(rgb_img, 0), np.float32); out = np.zeros_like(col)
    alb = np.ascontiguousarray(np.clip(albedo, 0, 1), np.float32) if albedo is not None else None
    nrm = np.ascontiguousarray(np.clip(normal, -1, 1), np.float32) if (normal is not None and albedo is not None) else None
    with pyoidn.Device() as dev:
        dev.commit()
        with pyoidn.Filter(dev, pyoidn.OIDN_FILTER_TYPE_RT) as flt:
            flt.set_image(pyoidn.OIDN_IMAGE_COLOR, col, pyoidn.OIDN_FORMAT_FLOAT3)
            if alb is not None: flt.set_image(pyoidn.OIDN_IMAGE_ALBEDO, alb, pyoidn.OIDN_FORMAT_FLOAT3)
            if nrm is not None: flt.set_image(pyoidn.OIDN_IMAGE_NORMAL, nrm, pyoidn.OIDN_FORMAT_FLOAT3)
            flt.set_image(pyoidn.OIDN_IMAGE_OUTPUT, out, pyoidn.OIDN_FORMAT_FLOAT3)
            flt.set_bool('hdr', bool(hdr)); flt.set_quality(pyoidn.OIDN_QUALITY_HIGH)
            flt.commit(); flt.execute()
        err = dev.get_error()
        if err and err[0]: print('oidn error', err)
    del col, alb, nrm
    return out

def bloom(img, thresh=1.0, strength=0.15, radii=(4, 12, 32, 80)):
    """glow round bright light sources (halation): the energy above thresh is blurred at several scales and added back"""
    br = np.maximum(img - thresh, 0)
    if br.max() <= 0: return img
    g = np.zeros_like(img)
    for r in radii: g += cv2.GaussianBlur(br, (0, 0), r) / len(radii)
    return img + strength * g

def filmic(x):
    """a filmic S curve (Narkowicz ACES fit), x in linear light"""
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)

def tonemap(rgb_lin, exposure=1.0, sat=1.0, contrast=1.0, lift=(0, 0, 0), gain=(1, 1, 1), curve='filmic'):
    x = np.maximum(rgb_lin, 0) * exposure * np.array(gain, np.float32)[None, None, :]
    y = filmic(x) if curve == 'filmic' else np.clip(x, 0, 1)
    lum = (0.2126 * y[..., 0] + 0.7152 * y[..., 1] + 0.0722 * y[..., 2])[..., None]
    y = np.clip(lum + (y - lum) * sat, 0, 1)
    if contrast != 1.0: y = np.clip(0.5 + (y - 0.5) * contrast, 0, 1)
    y = np.clip(y + np.array(lift, np.float32)[None, None, :] * (1 - y), 0, 1)
    return l2s(y)

def despeckle(rgbp, k=3.0, size=5, floor=0.35):
    """fireflies: single pixels far brighter than the median of their neighbours are scaled down to a few times that median"""
    lum = 0.2126 * rgbp[..., 0] + 0.7152 * rgbp[..., 1] + 0.0722 * rgbp[..., 2]
    l8 = lum.astype(np.float32)
    med = cv2.medianBlur(np.clip(l8 / (l8.max() + 1e-9) * 65535, 0, 65535).astype(np.uint16), size).astype(np.float32) / 65535.0 * (l8.max() + 1e-9)
    mx = np.maximum(med * k, med + floor)
    over = lum > mx
    scale = np.where(over, mx / np.maximum(lum, 1e-9), 1.0)
    return rgbp * scale[..., None]

def denoise_alpha(a):
    return np.clip(denoise(np.dstack([a, a, a]).astype(np.float32), None, None, hdr=False)[..., 0], 0, 1)

def unsharp(img, radius=1.0, amount=0.3):
    if amount <= 0: return img
    bl = cv2.GaussianBlur(img, (0, 0), radius)
    return np.clip(img + amount * (img - bl), 0, 1)

def finish_layer(L, exposure=1.0, bloom_strength=0.0, bloom_thresh=1.2, sat=1.0, contrast=1.0, gain=(1, 1, 1), lift=(0, 0, 0), denoise_it=True, sharp=0.3, sharp_r=1.0, curve='filmic', despeckle_k=3.0):
    """premultiplied linear render -> straight-colour RGBA (float 0..1, display encoded)"""
    rgbp = L['rgb'].astype(np.float32); a = np.clip(L['alpha'].astype(np.float32), 0, 1)
    if despeckle_k > 0: rgbp = despeckle(rgbp, despeckle_k)
    if denoise_it:
        rgbp = denoise(rgbp, L['albedo'].astype(np.float32), L['normal'].astype(np.float32))
        if a.min() < 0.999: a = denoise_alpha(a)
    if bloom_strength > 0: rgbp = bloom(rgbp, bloom_thresh, bloom_strength)
    straight = np.where(a[..., None] > 0.004, rgbp / np.maximum(a[..., None], 0.004), 0)
    c8 = tonemap(straight, exposure, sat, contrast, lift, gain, curve)
    c8 = unsharp(c8, sharp_r, sharp)
    a = np.where(a < 0.004, 0, a)
    return np.dstack([c8, a]).astype(np.float32)

def to_uint8(rgba): return (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)

def composite(layers, cx=800.0, h_cam=1.5):
    """what the game shows at the camera position cx (480 .. 1120): the layers (list of dict(img = float RGBA straight, f, scale, floor, width)) ordered from far to near, as a 960 x 540 float rgb picture.
    A floor layer is the picture of the floor at the neutral camera, sheared: its rows move with the parallax factor of their depth, f(y) = (y - yh) / (K * h_cam)."""
    out = np.zeros((H, W, 3), np.float32)
    yh = horizon_row(h_cam); kh = K * h_cam
    for Ly in layers:
        f = Ly['f']; s = Ly['scale']; img = Ly['img']
        if Ly.get('floor'):
            m = (Ly['width'] - W) / 2.0                               # margin of the floor picture on each side (logical px)
            d = cx - 800.0
            # source px (u, v) -> screen: x = u / s - m - d * (v / s - yh) / kh,  y = v / s
            M = np.float32([[1.0 / s, -d / (s * kh), -m + d * yh / kh], [0, 1.0 / s, 0]])
            crop = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_AREA if s > 1.01 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        else:
            x0 = f * (W / 2.0 - cx)                              # screen x of the left edge of the bitmap
            sx = -x0 * s
            x_a = sx; x_b = sx + W * s
            ia = int(math.floor(x_a)); ib = int(math.ceil(x_b)); crop = img[:, max(ia, 0):max(min(ib, img.shape[1]), 0)]
            if crop.shape[1] == 0: continue
            pad_l = max(0, -ia); pad_r = max(0, ib - img.shape[1])
            if pad_l or pad_r: crop = np.pad(crop, ((0, 0), (pad_l, pad_r), (0, 0)))
            M = np.float32([[1.0 / s, 0, -(x_a - ia) / s], [0, 1.0 / s, 0]])
            crop = cv2.warpAffine(crop, M, (W, H), flags=cv2.INTER_AREA if s > 1.01 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT) if s != 1.0 else crop[:, :W]
        a = crop[..., 3:4]; c = crop[..., :3]
        if Ly.get('blend') == 'add': out = np.clip(out + c * a, 0, 1)
        else: out = out * (1 - a) + c * a
    return out

def composite_neutral(layers, cx=800.0): return composite(layers, cx)

def save_png(path, rgb_float):
    cv2.imwrite(path, cv2.cvtColor((np.clip(rgb_float, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGB2BGR))


# ---------------------------------------------------------------------------------------------------------------- the stage driver: raw renders are cached, so the grade can be changed without rendering again
def render_stage_raw(builder, slabs, cache_dir, h_cam=1.5, aperture=0.04, seed=0, only=None, verbose=True, spp_mul=1.0, scale_mul=1.0, pass_spp=None):
    os.makedirs(cache_dir, exist_ok=True)
    for sl in slabs:
        if only and sl['name'] not in only: continue
        t0 = time.time()
        if verbose: print('layer %s  z %.1f..%.1f  f=%.3f' % (sl['name'], sl['z0'], sl['z1'], sl['f']), flush=True)
        L = render_layer(builder, sl['z0'], sl['z1'], sl['f'], scale=sl.get('scale', 1.0) * scale_mul, h_cam=h_cam, aperture=sl.get('aperture', aperture), spp=int(sl.get('spp', 64) * spp_mul),
                         pass_spp=(pass_spp or sl.get('pass_spp', 8)), max_depth=sl.get('depth', 8), seed=seed, ramp=sl.get('ramp', 0.0), bg=sl.get('bg', False), verbose=verbose,
                         floor=sl.get('floor', False), y_cut=sl.get('ycut', 0.03 if not sl.get('noycut') else 0.0) if not sl.get('floor', False) else 0.06, width_px=sl.get('width'), reflect=sl.get('reflect', False))
        np.savez_compressed(os.path.join(cache_dir, sl['name'] + '.npz'), rgb=L['rgb'].astype(np.float16), alpha=L['alpha'].astype(np.float16), albedo=L['albedo'].astype(np.float16),
                            normal=L['normal'].astype(np.float16), scale=L['scale'], f=L['f'], floor=L['floor'], width=L['width'])
        if verbose: print('  -> %s  %.1fs' % (sl['name'], time.time() - t0), flush=True)

def load_raw(cache_dir, name):
    z = np.load(os.path.join(cache_dir, name + '.npz'))
    return {'rgb': z['rgb'].astype(np.float32), 'alpha': z['alpha'].astype(np.float32), 'albedo': z['albedo'].astype(np.float32), 'normal': z['normal'].astype(np.float32), 'scale': float(z['scale']), 'f': float(z['f']), 'floor': float(z['floor']) if 'floor' in z.files else 0.0, 'width': float(z['width']) if 'width' in z.files else 0.0}

def post_stage(cache_dir, slabs, tone, denoise_it=True, only=None):
    """-> list of dict(name, f, scale, img RGBA float) ordered from FAR to NEAR (the order of drawing)"""
    out = []
    for sl in slabs:
        if only and sl['name'] not in only: continue
        L = load_raw(cache_dir, sl['name'])
        t = dict(tone); t.update(sl.get('tone', {}))
        img = finish_layer(L, denoise_it=denoise_it, **t)
        if sl.get('post_blur'):                            # a little softness (the grain of a glossy floor is not wanted at this size)
            sx, sy = sl['post_blur'] if isinstance(sl['post_blur'], (tuple, list)) else (sl['post_blur'], sl['post_blur'])
            prem = np.dstack([img[..., :3] * img[..., 3:4], img[..., 3:4]]); prem = cv2.GaussianBlur(prem, (0, 0), sigmaX=sx * L['scale'], sigmaY=sy * L['scale'])
            img = np.dstack([np.where(prem[..., 3:4] > 1e-4, prem[..., :3] / np.maximum(prem[..., 3:4], 1e-4), 0), prem[..., 3]]).astype(np.float32)
        if sl.get('reflect'): img = reflect_fade(img, L['scale'], sl.get('zref', 5.0), a0=sl.get('refl_a', 0.35), h0=sl.get('refl_h', 1.8), blur=sl.get('refl_blur', 2.0))
        out.append({'name': sl['name'], 'f': L['f'], 'scale': L['scale'], 'img': img, 'floor': L['floor'] > 0.5, 'width': L['width'], 'order': sl.get('order'), 'blend': sl.get('blend')})
    if any(L['order'] is not None for L in out): out.sort(key=lambda L: L['order'] if L['order'] is not None else 99)
    else: out = out[::-1]
    return out

def reflect_fade(img, scale, z_ref, h_cam=1.5, a0=0.35, h0=1.8, blur=2.0, blur_up=3.0):
    """a reflection picture (straight RGBA): weaker and blurrier the higher the reflected point is above the floor (z_ref: the depth of the reflected object)"""
    h, w, _ = img.shape
    prem = np.dstack([img[..., :3] * img[..., 3:4], img[..., 3:4]]).astype(np.float32)
    prem = cv2.GaussianBlur(prem, (0, 0), sigmaX=blur * scale, sigmaY=(blur + blur_up) * scale)
    yh = horizon_row(h_cam)
    rows = (np.arange(h) / scale - yh)
    hh = np.maximum(rows * (D_CAM + z_ref) / F_PX - h_cam, 0.0)
    fade = (a0 * np.exp(-hh / h0)).astype(np.float32)
    fade[rows < 0] = 0
    a = prem[..., 3] * fade[:, None]
    col = np.where(prem[..., 3:4] > 1e-4, prem[..., :3] / np.maximum(prem[..., 3:4], 1e-4), 0)
    return np.dstack([col, a]).astype(np.float32)

def preview(layers, path, cxs=(480, 800, 1120), mark=True):
    ims = []
    for cx in cxs:
        im = composite(layers, cx)
        ims.append(im)
    out = np.hstack(ims) if len(ims) > 1 else ims[0]
    save_png(path, out)
    return out

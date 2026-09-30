// ===== 3D fighters, part 2: mesh building blocks (grids, tubes, ellipsoids, lofts) =====

const WHITE_UV = [0.5, 0.5];        // any texel of the all-white layer

// Smooth-shaded surface from a grid of points P[j * nu + i]. Normals come from the grid itself. `wrapU` closes the seam.
// `hint` is a point inside the shape: normals are flipped to face away from it.
// vf(i, j, side) -> { uv:[u,v], col, mat }, or a constant object. `cuts` lists columns whose vertices are duplicated so the
// two sides can differ (side = -1 for the copy used by the quads to the left, +1 for the right); everything else gets side = 0.
function gridSurface(mesh, P, nu, nv, wrapU, hint, vf, cuts) {
  const N = new Array(nu * nv);
  const at = (i, j) => P[Math.max(0, Math.min(nv - 1, j)) * nu + (wrapU ? (i + nu) % nu : Math.max(0, Math.min(nu - 1, i)))];
  let flip = 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const du = V3.sub(at(i + 1, j), at(i - 1, j)), dv = V3.sub(at(i, j + 1), at(i, j - 1));
    let n = V3.cross(du, dv);
    let l = V3.len(n);
    if (l < 1e-6) { n = V3.sub(P[j * nu + i], hint); l = V3.len(n) || 1; }      // pole: fall back to the radial direction
    n = V3.mul(n, 1 / l);
    N[j * nu + i] = n;
    if (!flip && j > 0 && j < nv - 1) flip = V3.dot(n, V3.sub(P[j * nu + i], hint)) < 0 ? -1 : 1;
  }
  if (!flip) flip = 1;
  const L = new Int32Array(nu * nv), R = new Int32Array(nu * nv);
  const isCut = (i) => !!cuts && cuts.indexOf(i) >= 0;
  const put = (k, side) => {
    const p = P[k], n = N[k], d = typeof vf === 'function' ? vf(k % nu, (k / nu) | 0, side) : vf;
    return mesh.vert(p[0], p[1], p[2], n[0] * flip, n[1] * flip, n[2] * flip, d.uv[0], d.uv[1], d.col, d.mat);
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * nu + i;
    if (isCut(i)) { L[k] = put(k, -1); R[k] = put(k, 1); } else L[k] = R[k] = put(k, 0);
  }
  const nuq = wrapU ? nu : nu - 1;
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nuq; i++) {
    const i2 = (i + 1) % nu;
    const a = R[j * nu + i], b = L[j * nu + i2], c = L[(j + 1) * nu + i2], d = R[(j + 1) * nu + i];
    if (flip > 0) { mesh.tri(a, b, c); mesh.tri(a, c, d); } else { mesh.tri(a, c, b); mesh.tri(a, d, c); }
  }
}

// A tapered tube from a to b (radii r0 -> r1) with a slight muscle bulge. Round caps are added by ellipsoids at the joints.
// (hand-rolled maths, no temporary arrays: this runs for every limb of every fighter every frame)
const TRIG = {};
function trig(n) { let t = TRIG[n]; if (!t) { t = TRIG[n] = { c: new Float32Array(n), s: new Float32Array(n) }; for (let i = 0; i < n; i++) { t.c[i] = Math.cos((i / n) * TAU); t.s[i] = Math.sin((i / n) * TAU); } } return t; }
function emitTube(mesh, a, b, r0, r1, col, mat, o = {}) {
  const sides = o.sides || 10, rings = o.rings || 4, bulge = o.bulge === undefined ? 0.07 : o.bulge;
  let wx = b[0] - a[0], wy = b[1] - a[1], wz = b[2] - a[2];
  const len = Math.hypot(wx, wy, wz) || 1e-3; wx /= len; wy /= len; wz /= len;
  // u = normalize(w x ref)
  let rx = 0, ry = 0, rz = 1; if (Math.abs(wz) > 0.85) { rx = 1; rz = 0; }
  let ux = wy * rz - wz * ry, uy = wz * rx - wx * rz, uz = wx * ry - wy * rx; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const vx = wy * uz - wz * uy, vy = wz * ux - wx * uz, vz = wx * uy - wy * ux;
  const slope = (r0 - r1) / len, uv = o.uv || WHITE_UV, T = trig(sides), base = mesh.nv;
  for (let k = 0; k < rings; k++) {
    const t = k / (rings - 1), r = (r0 + (r1 - r0) * t) * (1 + bulge * Math.sin(Math.PI * t));
    const cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t, cz = a[2] + (b[2] - a[2]) * t;
    for (let s = 0; s < sides; s++) {
      const cp = T.c[s], sp = T.s[s];
      const dx = ux * cp + vx * sp, dy = uy * cp + vy * sp, dz = uz * cp + vz * sp;
      let nx = dx + wx * slope, ny = dy + wy * slope, nz = dz + wz * slope; const nl = Math.hypot(nx, ny, nz) || 1;
      mesh.vert(cx + dx * r, cy + dy * r, cz + dz * r, nx / nl, ny / nl, nz / nl, uv[0], uv[1], col, mat);
    }
  }
  for (let k = 0; k < rings - 1; k++) for (let s = 0; s < sides; s++) {
    const s2 = (s + 1) % sides, i00 = base + k * sides + s, i10 = base + k * sides + s2, i11 = base + (k + 1) * sides + s2, i01 = base + (k + 1) * sides + s;
    mesh.tri(i00, i10, i01); mesh.tri(i10, i11, i01);
  }
}

// Ellipsoid with three (scaled) axis vectors. Good for joints, hands, feet, ears.
function emitEllipsoid(mesh, c, ax, ay, az, col, mat, o = {}) {
  const nu = o.nu || 10, nv = o.nv || 7, uv = o.uv || WHITE_UV, T = trig(nu), base = mesh.nv;
  const la = Math.hypot(ax[0], ax[1], ax[2]) || 1e-3, lb = Math.hypot(ay[0], ay[1], ay[2]) || 1e-3, lc = Math.hypot(az[0], az[1], az[2]) || 1e-3;
  const hand = (ax[1] * ay[2] - ax[2] * ay[1]) * az[0] + (ax[2] * ay[0] - ax[0] * ay[2]) * az[1] + (ax[0] * ay[1] - ax[1] * ay[0]) * az[2] >= 0;
  for (let j = 0; j < nv; j++) {
    const lat = -Math.PI / 2 + (j / (nv - 1)) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < nu; i++) {
      const x = cl * T.c[i], z = cl * T.s[i];
      const px = c[0] + ax[0] * x + ay[0] * sl + az[0] * z, py = c[1] + ax[1] * x + ay[1] * sl + az[1] * z, pz = c[2] + ax[2] * x + ay[2] * sl + az[2] * z;
      const fx = x / la, fy = sl / lb, fz = z / lc;
      let nx = ax[0] / la * fx + ay[0] / lb * fy + az[0] / lc * fz, ny = ax[1] / la * fx + ay[1] / lb * fy + az[1] / lc * fz, nz = ax[2] / la * fx + ay[2] / lb * fy + az[2] / lc * fz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      mesh.vert(px, py, pz, nx / nl, ny / nl, nz / nl, uv[0], uv[1], col, mat);
    }
  }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) {
    const i2 = (i + 1) % nu, a = base + j * nu + i, b = base + j * nu + i2, cc = base + (j + 1) * nu + i2, d = base + (j + 1) * nu + i;
    if (hand) { mesh.tri(a, cc, b); mesh.tri(a, d, cc); } else { mesh.tri(a, b, cc); mesh.tri(a, cc, d); }
  }
}
const sphere = (mesh, c, r, col, mat, o) => emitEllipsoid(mesh, c, [r, 0, 0], [0, r, 0], [0, 0, r], col, mat, o);

// Cross-section ring parametrisation used by the torso: point(theta) = c + fw * cos(theta) + ax * sin(theta)
function ringPts(c, fw, ax, n, t0 = 0, t1 = TAU) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = t0 + (t1 - t0) * (i / (n - (t1 - t0 >= TAU - 1e-6 ? 0 : 1))), cs = Math.cos(th), sn = Math.sin(th);
    out.push([c[0] + fw[0] * cs + ax[0] * sn, c[1] + fw[1] * cs + ax[1] * sn, c[2] + fw[2] * cs + ax[2] * sn]);
  }
  return out;
}

// Flat disc / fan closing an open ring. `up` is the outward direction.
function emitCap(mesh, ring, center, up, col, mat, uv = WHITE_UV) {
  const b0 = mesh.vert(center[0], center[1], center[2], up[0], up[1], up[2], uv[0], uv[1], col, mat);
  const base = mesh.nv, n = ring.length;
  for (const p of ring) mesh.vert(p[0], p[1], p[2], up[0], up[1], up[2], uv[0], uv[1], col, mat);
  for (let i = 0; i < n; i++) {
    const a = base + i, b = base + (i + 1) % n;
    // choose the winding that faces `up`
    const pa = ring[i], pb = ring[(i + 1) % n];
    const nn = V3.cross(V3.sub(pa, center), V3.sub(pb, center));
    if (V3.dot(nn, up) >= 0) mesh.tri(b0, a, b); else mesh.tri(b0, b, a);
  }
}

// Transform a static mesh into another mesh (used to stamp shoes, hands, ... with a matrix). Colours can be overridden.
function stamp(dst, src, m, nm, col, mat) {
  const base = dst.nv, sf = src.f;
  for (let k = 0; k < src.nv; k++) {
    const o = k * VW;
    const x = sf[o], y = sf[o + 1], z = sf[o + 2], nx = sf[o + 3], ny = sf[o + 4], nz = sf[o + 5];
    const px = m[0] * x + m[4] * y + m[8] * z + m[12], py = m[1] * x + m[5] * y + m[9] * z + m[13], pz = m[2] * x + m[6] * y + m[10] * z + m[14];
    let qx = nm[0] * nx + nm[3] * ny + nm[6] * nz, qy = nm[1] * nx + nm[4] * ny + nm[7] * nz, qz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
    const l = Math.hypot(qx, qy, qz) || 1;
    dst.vert(px, py, pz, qx / l, qy / l, qz / l, sf[o + 6], sf[o + 7], col === undefined ? src.u[o + 8] : col, mat === undefined ? src.u[o + 9] : mat);
  }
  for (let k = 0; k + 2 < src.ni; k += 3) dst.tri(base + src.i[k], base + src.i[k + 1], base + src.i[k + 2]);
}

// Smoothstep helper
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

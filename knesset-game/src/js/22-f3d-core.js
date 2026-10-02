// ===== 3D fighters, part 1: WebGL2 context, shader, vertex emitter and the sprite pipeline =====
// The fighters are real 3D models (procedural meshes, lit in a shader) that are rendered into an off-screen WebGL canvas
// and copied into a small "sprite" canvas that the normal 2D scene draws with drawImage(). Everything else (arenas, effects,
// HUD) stays 2D, so hit boxes, camera, reflections and shake behave exactly as before. If WebGL2 is missing or slow, the
// 2D cartoon renderer (21-fighter-render.js) is used instead.
//
// Model space: x forward (the way the fighter faces), y up, z towards the camera. One unit = one "rig unit" of the 2D skeleton.

const F3D = {
  ok: false,              // WebGL2 is up
  failed: false,          // could not start, or the context was lost: stay on the 2D renderer
  off: false,             // switched off by the player / by the adaptive quality
  stamp: 0,               // bumped once per rendered frame
  good: 0,                // sprites rendered so far (the first few are checked for blank output)
  stats: { renders: 0, sprites: 0, ms: 0, verts: 0 },
  light: { key: [1, 0.93, 0.84], fill: [0.42, 0.5, 0.7], top: [0.5, 0.5, 0.56], bot: [0.24, 0.2, 0.24], rim: [0.55, 0.62, 0.9] },
  noPortrait: /[?&]head3d\b/.test(location.search),       // ?head3d: the modelled 3D heads instead of the portraits (to compare)
};

// ---------------------------------------------------------------------------------------------------------------
// tiny 3D math (column-major mat4 as Float32Array(16), mat3 as Float32Array(9))
// ---------------------------------------------------------------------------------------------------------------
const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {          // a * b
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  translate(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotZ(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  rotY(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotX(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  // basis (columns = x,y,z axes) + origin
  basis(ex, ey, ez, o) { const m = M4.ident(); m[0] = ex[0]; m[1] = ex[1]; m[2] = ex[2]; m[4] = ey[0]; m[5] = ey[1]; m[6] = ey[2]; m[8] = ez[0]; m[9] = ez[1]; m[10] = ez[2]; m[12] = o[0]; m[13] = o[1]; m[14] = o[2]; return m; },
  pt(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
  // inverse-transpose of the upper 3x3 (normal matrix), column-major so it can go straight into uniformMatrix3fv / stamp()
  normalMat(m) {
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    const c00 = e * i - f * h, c01 = -(d * i - f * g), c02 = d * h - e * g;
    const c10 = -(b * i - c * h), c11 = a * i - c * g, c12 = -(a * h - b * g);
    const c20 = b * f - c * e, c21 = -(a * f - c * d), c22 = a * e - b * d;
    const det = a * c00 + b * c01 + c * c02 || 1e-9, id = 1 / det;
    // cofactor matrix / det is the inverse transpose (row-major); store it column-major
    return new Float32Array([c00 * id, c10 * id, c20 * id, c01 * id, c11 * id, c21 * id, c02 * id, c12 * id, c22 * id]);
  },
  det3(m) { return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]); },
};

const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  madd: (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
};

// ---------------------------------------------------------------------------------------------------------------
// vertex format (40 bytes): pos.xyz nrm.xyz uv | rgba8 (tint, coverage) | rgba8 (specular, shininess, rim, texture layer)
// ---------------------------------------------------------------------------------------------------------------
const VW = 10;                               // 32-bit words per vertex
const q8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
const packRGBA = (r, g, b, a) => ((q8(a) << 24) | (q8(b) << 16) | (q8(g) << 8) | q8(r)) >>> 0;
const CLS = { GEN: 0, SKIN: 1, CLOTH: 2, HAIR: 3, SHOE: 4, METAL: 5 };      // material class: picks the shading model in the fragment shader
const packMat = (spec, shine, rim, layer, cls = 0) => ((((cls & 7) << 5) | (layer & 31)) << 24 | q8(rim) << 16 | q8(shine) << 8 | q8(spec)) >>> 0;
function hexRGB(c) {                          // '#rrggbb' or 'rgb(...)' -> [0..1]x3
  if (c[0] === '#') { const v = rgb(c); return [v[0] / 255, v[1] / 255, v[2] / 255]; }
  const m = c.match(/[\d.]+/g); return [m[0] / 255, m[1] / 255, m[2] / 255];
}

// A growable mesh; used both for static meshes (heads: built once and uploaded to the GPU) and for the per-frame body.
class Mesh {
  constructor(cap = 2048, icap = 8192) {
    this.f = new Float32Array(cap * VW); this.u = new Uint32Array(this.f.buffer); this.i = new Uint16Array(icap); this.nv = 0; this.ni = 0; this.mid = 0;
  }
  reset() { this.nv = 0; this.ni = 0; this.mid = 0; }
  grow() {
    const nf = new Float32Array(this.f.length * 2); nf.set(this.f); this.f = nf; this.u = new Uint32Array(nf.buffer);
  }
  growI() { const ni = new Uint16Array(this.i.length * 2); ni.set(this.i); this.i = ni; }
  vert(x, y, z, nx, ny, nz, u, v, col, mat) {
    if ((this.nv + 1) * VW > this.f.length) this.grow();
    const o = this.nv * VW, f = this.f;
    f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = nx; f[o + 4] = ny; f[o + 5] = nz; f[o + 6] = u; f[o + 7] = v; this.u[o + 8] = col; this.u[o + 9] = mat;
    return this.nv++;
  }
  tri(a, b, c) { if (this.ni + 3 > this.i.length) this.growI(); this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c; }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
}

// ---------------------------------------------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------------------------------------------
const F3D_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aMat;
uniform mat4 uMVP;
uniform mat4 uM;
uniform mat3 uNM;
out vec3 vN; out vec3 vP; out vec2 vUV; out vec4 vCol; out vec4 vMat;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  vec4 w = uM * vec4(aPos, 1.0);
  vP = vec3(w.x, -w.y, w.z);                                     // view space like the normals: x right, y up, z to the camera
  vN = uNM * aNrm; vUV = aUV; vCol = aCol; vMat = aMat;
}`;

// Lighting: wrapped diffuse from a warm key + cool fill + hemispheric ambient. On top of that, per material class:
//  skin  - light scattering near the shadow line, two-lobe oily highlight, pore relief
//  cloth - woven fabric relief + soft sheen at grazing angles
//  hair  - strand relief + anisotropic (Kajiya-Kay) highlights
// Relief comes from screen-space bump mapping of a height taken from the texture (its brightness) plus procedural noise.
const F3D_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uTop, uBot, uRim, uNorm;
uniform vec4 uTint;
uniform float uFlash, uAlpha, uCover;
in vec3 vN; in vec3 vP; in vec2 vUV; in vec4 vCol; in vec4 vMat;
out vec4 outColor;

float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float lw = floor(vMat.w * 255.0 + 0.5);
  float cls = floor(lw / 32.0);
  float layer = lw - cls * 32.0;
  float real = step(7.5, layer);                                    // layers 8+: the same textures, but the realistic face (already has its own pores)
  layer -= real * 8.0;
  vec3 dpx = dFdx(vP), dpy = dFdy(vP);
  vec2 dux = dFdx(vUV), duy = dFdy(vUV);
  float px = max(length(dpx), length(dpy));                         // world units per pixel
  float near = 1.0 - smoothstep(0.10, 0.42, px);                    // fine detail only when the character is big on screen
  bool skin = cls > 0.5 && cls < 1.5, cloth = cls > 1.5 && cls < 2.5, hair = cls > 2.5 && cls < 3.5;

  vec4 t = texture(uTex, vec3(vUV, layer));
  float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  float h = 0.0, amp = 0.0;
  vec3 mul = vec3(1.0);
  float face = (1.0 - step(0.5, layer)) * (1.0 - 0.8 * real);       // 1 on the painted face layer
  if (skin) {
    float pore = vnoise(vUV * 300.0) * 0.6 + vnoise(vUV * 120.0) * 0.4;
    h = lum + pore * 0.16 * near * face; amp = 0.7;
    mul = vec3(1.0 + (pore - 0.5) * 0.04 * near * face);
  } else if (cloth) {
    bool jacket = layer == 1.0 || layer == 6.0;
    vec2 cuv = vUV * (jacket ? 3.5 : 1.0);
    float w = texture(uTex, vec3(cuv, 7.0)).r;
    // the drape: soft folds that run along a sleeve or a trouser leg (and down the jacket), and a finer crumple across them
    vec2 fuv = jacket ? vec2(vUV.x * 5.0, vUV.y * 1.3) : vec2(vUV.x * 3.0, vUV.y * 0.5);
    float fold = vnoise(fuv + 3.1) * 0.62 + vnoise(fuv * vec2(2.4, 1.9) + 9.7) * 0.38;
    h = w + lum * 0.15 + fold * 18.0 * (0.4 + 0.6 * near); amp = 0.28 * (0.25 + 0.75 * near);
    // a faint woven stripe along the cloth, as in a suit; it fades out when the stripes get thinner than a pixel or two
    float sx = vUV.x * (jacket ? 30.0 : 28.0), stripe = smoothstep(0.38, 0.46, abs(fract(sx) - 0.5)) * (1.0 - smoothstep(0.25, 0.55, fwidth(sx)));
    mul = vec3(0.86 + 0.3 * w) * (0.93 + 0.14 * fold) * (1.0 + 0.16 * stripe);
  } else if (hair) {
    h = lum; amp = 0.4;
  }
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 Ng = normalize(vN), N = Ng;
  if (amp > 0.0) {
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
    float det = dot(dpx, r1);
    vec3 pert = amp * (sign(det) * (dhx * r1 + dhy * r2)) / max(abs(det), 1e-7);
    float pl = length(pert); if (pl > 0.6) pert *= 0.6 / pl;
    N = normalize(N - pert);
  }
  vec3 alb = t.rgb * vCol.rgb * mul; alb *= alb;                      // sRGB-ish -> linear-ish
  float spec = vMat.x, shin = 2.0 + vMat.y * 126.0, rim = vMat.z;
  vec3 V = vec3(0.0, 0.0, 1.0), H = normalize(uKeyDir + V);
  float ndl = dot(N, uKeyDir);
  float wrap = clamp((ndl + 0.3) / 1.3, 0.0, 1.0); wrap *= wrap * (3.0 - 2.0 * wrap) * 0.6 + wrap * 0.4;
  vec3 diff = (uKeyCol * wrap + uFillCol * max(dot(N, uFillDir), 0.0) + mix(uBot, uTop, N.y * 0.5 + 0.5)) * uNorm;   // uNorm: a well-lit face shows the colour the look asks for
  float ndh = max(dot(N, H), 0.0), lit = smoothstep(-0.05, 0.25, ndl);
  vec3 add = vec3(0.0), spc;
  if (skin) {
    float band = exp(-pow((ndl - 0.0) * 4.2, 2.0));
    add = uKeyCol * vec3(0.5, 0.13, 0.06) * band * 0.3;                // light scattering under the skin near the shadow line
    float oil = 0.55 + 0.45 * vnoise(vUV * 34.0);
    spc = uKeyCol * (pow(ndh, 9.0) * 0.06 + pow(ndh, 60.0) * 0.32 * oil) * (0.5 + spec * 2.0) * lit;
  } else if (hair) {
    float dd = dux.x * duy.y - dux.y * duy.x;
    vec3 T = abs(dd) > 1e-10 ? (dpy * dux.x - dpx * duy.x) / dd : vec3(0.0, 1.0, 0.0);
    T = normalize(T + vec3(0.0, 1e-4, 0.0));                        // strand direction on the surface
    vec3 T1 = normalize(T + N * 0.12), T2 = normalize(T - N * 0.3);
    float d1 = dot(T1, H), d2 = dot(T2, H);
    float s1 = pow(sqrt(max(1.0 - d1 * d1, 0.0)), 80.0), s2 = pow(sqrt(max(1.0 - d2 * d2, 0.0)), 36.0);
    spc = uKeyCol * (vec3(s1 * 0.22) + s2 * 0.09 * (vec3(0.3) + alb * 2.0)) * (0.5 + spec) * lit;
  } else if (cloth) {
    float fr = 1.0 - clamp(N.z, 0.0, 1.0);
    add = (uFillCol * 0.9 + uKeyCol * 0.25) * pow(fr, 3.0) * 0.2;      // soft sheen where the fabric turns away
    spc = uKeyCol * pow(ndh, shin) * spec * lit;
  } else {
    spc = uKeyCol * pow(ndh, shin) * spec * lit;
  }
  float nz = clamp(Ng.z, -1.0, 1.0);
  float fres = pow(1.0 - clamp(abs(nz), 0.0, 1.0), 3.0);
  float rl = clamp(sqrt(dot(alb, vec3(0.3, 0.59, 0.11))) * 1.3, 0.12, 1.0);      // a rim light bounces off the surface colour: dark hair must stay dark
  vec3 col = alb * (diff + add) + spc + uRim * fres * rim * rl * (0.4 + 0.6 * clamp(-dot(N, uKeyDir) * 0.5 + 0.6, 0.0, 1.0));
  col *= 1.0 - 0.38 * pow(1.0 - clamp(abs(nz), 0.0, 1.0), 5.0);       // soft dark contour
  float mx = max(col.r, max(col.g, col.b));
  if (mx > 0.92) col *= (0.92 + 0.3 * (1.0 - exp(-(mx - 0.92) * 2.2))) / mx;   // roll off highlights without shifting the hue
  col = sqrt(max(col, 0.0));
  col = mix(col, uTint.rgb, uTint.a);
  col = mix(col, vec3(1.0), uFlash);
  float a = vCol.a * uAlpha;
  if (hair) a += (vnoise(vUV * 210.0) - 0.5) * 0.36;                  // ragged, hairy edges instead of the mesh's straight steps
  if (uCover > 0.5) outColor = vec4(col, smoothstep(0.44, 0.56, a));   // alpha-to-coverage pass (hair, beard): straight colour, crisp edge
  else outColor = vec4(col * a, a);                                   // premultiplied
}`;

// The portrait head: the realistic face of the person as a flat picture that stands in the place of the 3D head (a textured quad with no lighting of its own).
// It is drawn between the body and the near arm, so the arm still passes in front of the face and the far arm behind it.
const Q_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
uniform mat4 uMVP;
out vec2 vUV;
void main() { gl_Position = uMVP * vec4(aPos, 0.0, 1.0); vUV = aUV; }`;
const Q_FS = `#version 300 es
precision highp float;
uniform sampler2D uPic;
uniform vec3 uShade;
uniform vec4 uTint;
uniform float uFlash, uAlpha;
in vec2 vUV;
out vec4 outColor;
void main() {
  vec4 t = texture(uPic, vUV);                                    // premultiplied
  vec3 c = t.a > 0.002 ? t.rgb / t.a : vec3(0.0);
  c = mix(c * uShade, uTint.rgb, uTint.a);
  c = mix(c, vec3(1.0), uFlash);
  float a = t.a * uAlpha;
  outColor = vec4(c * a, a);
}`;

// ---------------------------------------------------------------------------------------------------------------
// context
// ---------------------------------------------------------------------------------------------------------------
const G3 = { gl: null, cv: null, prog: null, U: {}, dyn: new Mesh(6000, 24000), vbo: null, ibo: null, vao: null, size: 1024, white: null, cache: new Map(), a2c: false, qprog: null, QU: {}, qvao: null, qvbo: null, ptex: new Map() };

F3D.init = function () {
  if (G3.gl || F3D.failed) return F3D.ok;
  try {
    if (/[?&](flat|safe)\b/.test(location.search)) throw new Error('flat requested');
    try { localStorage.setItem('ks_3d', '1'); } catch (e) { /* storage blocked */ }     // cleared again once a few frames were drawn fine (see Game.loop)
    const cv = document.createElement('canvas');
    cv.width = cv.height = G3.size;
    const gl = cv.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); F3D.ok = false; F3D.failed = true; G3.gl = null; G3.cache.clear(); G3.ptex.clear(); });
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, F3D_VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, F3D_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    G3.gl = gl; G3.cv = cv; G3.prog = prog;
    for (const n of ['uMVP', 'uM', 'uNM', 'uTex', 'uKeyDir', 'uKeyCol', 'uFillDir', 'uFillCol', 'uTop', 'uBot', 'uRim', 'uNorm', 'uTint', 'uFlash', 'uAlpha', 'uCover']) G3.U[n] = gl.getUniformLocation(prog, n);
    G3.vbo = gl.createBuffer(); G3.ibo = gl.createBuffer();
    G3.a2c = !!gl.getParameter(gl.SAMPLE_BUFFERS);
    try {                                                                 // the portrait heads are optional: without this program the modelled 3D heads stay
      const qp = gl.createProgram();
      gl.attachShader(qp, sh(gl.VERTEX_SHADER, Q_VS)); gl.attachShader(qp, sh(gl.FRAGMENT_SHADER, Q_FS));
      gl.linkProgram(qp);
      if (!gl.getProgramParameter(qp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(qp));
      for (const n of ['uMVP', 'uPic', 'uShade', 'uTint', 'uFlash', 'uAlpha']) G3.QU[n] = gl.getUniformLocation(qp, n);
      G3.qvao = gl.createVertexArray(); G3.qvbo = gl.createBuffer();
      gl.bindVertexArray(G3.qvao); gl.bindBuffer(gl.ARRAY_BUFFER, G3.qvbo); gl.bufferData(gl.ARRAY_BUFFER, 64, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindVertexArray(null);
      G3.qprog = qp;
    } catch (e) { G3.qprog = null; }
    F3D.ok = true;
  } catch (e) {
    F3D.failed = true; F3D.ok = false; G3.gl = null;
    F3D.err = String(e && e.message || e);
  }
  return F3D.ok;
};

F3D.active = function () { return !F3D.off && !F3D.failed && (F3D.ok || F3D.init()); };
F3D.beginFrame = function () { F3D.stamp++; };

// Vertex array for a mesh that lives on the GPU (static heads etc.) or for the streaming body buffer
function bindLayout(gl, vbo, ibo) {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  const S = VW * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, S, 32);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, S, 36);
}
function uploadStatic(gl, mesh) {
  const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, mesh.f.subarray(0, mesh.nv * VW), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.i.subarray(0, mesh.ni), gl.STATIC_DRAW);
  bindLayout(gl, vbo, ibo);
  gl.bindVertexArray(null);
  return { vao, vbo, ibo, n: mesh.ni };
}

// ---------------------------------------------------------------------------------------------------------------
// texture array (one per look): FACE, TORSO, HAIR, BEARD, KNIT, WHITE ... each layer TEXN x TEXN
// ---------------------------------------------------------------------------------------------------------------
const TEXN = 256;
const LAYER = { FACE: 0, TORSO: 1, HAIR: 2, BEARD: 3, KNIT: 4, WHITE: 5, TORSO2: 6, CLOTH: 7, N: 8 };
function makeTexArray(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 6, gl.RGBA8, TEXN, TEXN, LAYER.N);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return t;
}
F3D.uploadLayer = function (tex, layer, canvas, mips = true) {
  const gl = G3.gl;
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, TEXN, TEXN, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
};
F3D.newTexArray = function () { return makeTexArray(G3.gl); };

// a portrait head (a canvas) as a texture, premultiplied and mipmapped; the least recently used ones are dropped
F3D.portraitTex = function (canvas) {
  const gl = G3.gl, m = G3.ptex;
  let e = m.get(canvas);
  if (e) { m.delete(canvas); m.set(canvas, e); return e.tex; }
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE0);
  m.set(canvas, { tex });
  if (m.size > 40) { const [k, v] = m.entries().next().value; gl.deleteTexture(v.tex); m.delete(k); }
  return tex;
};

// ---------------------------------------------------------------------------------------------------------------
// stage lighting: a warm key from the front-left, cool fill, and a coloured rim from behind
// ---------------------------------------------------------------------------------------------------------------
const STAGE_LIGHT = {
  plenum:   { key: [1.0, 0.92, 0.8], fill: [0.36, 0.44, 0.62], top: [0.5, 0.46, 0.44], bot: [0.26, 0.2, 0.18], rim: [1.0, 0.8, 0.5] },
  studio:   { key: [0.86, 0.92, 1.0], fill: [0.5, 0.36, 0.62], top: [0.42, 0.48, 0.62], bot: [0.2, 0.16, 0.28], rim: [0.6, 0.72, 1.0] },
  cafe:     { key: [1.0, 0.94, 0.82], fill: [0.44, 0.4, 0.36], top: [0.55, 0.5, 0.44], bot: [0.3, 0.24, 0.2], rim: [1.0, 0.86, 0.6] },
  election: { key: [1.0, 0.9, 0.95], fill: [0.34, 0.4, 0.8], top: [0.4, 0.36, 0.56], bot: [0.24, 0.16, 0.3], rim: [0.7, 0.55, 1.0] },
  office:   { key: [1.0, 0.9, 0.76], fill: [0.4, 0.38, 0.34], top: [0.5, 0.44, 0.38], bot: [0.28, 0.2, 0.16], rim: [1.0, 0.78, 0.5] },
};
F3D.setStage = function (id) { F3D.light = STAGE_LIGHT[id] || STAGE_LIGHT.plenum; };

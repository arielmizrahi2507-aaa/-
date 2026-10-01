// ===== Character looks: caricatures. Everyone is identified by hair, build, clothes and a clearly personal face. =====
// Face structure (1 = the average face, each number is multiplied by its gain in FG below; both the drawn portraits and the 3D head use them):
//   fw head width, len face length (chin end), fore forehead, ridge brow ridge, cheek fullness, jowl (0..1 sagging lower cheeks), chin size, jaw width,
//   nose (size), noseL (length / how far it sticks out), noseW (width), bridge (bump), noseT (> 0 drooping tip, < 0 turned up), lips, mouthW, ear, earOut (sticking out),
//   eyeSize, eyeGap, lid (0..1 heavy upper lids), bags (0..1 under the eyes), brow (thickness in px), browArch, browTilt (> 0 stern), browLen, neck.
// Other: skin, iris, age (lines, 0..1), stubble (0..1), beard {color}, stache, glasses {shape, color}, kippah {color, knit}, hat {color}, female, earring, mood (the usual expression of the closed mouth, -1 stern .. +1 smiling, front portraits),
//   hair {style: crop | buzz | curly | comb | swoop | part | thin | sides | wavy | layered | bob | spiky | none, color, mix (grey strands), vol (thickness), hl (receding hairline), len (long hair)}.
//   beard {color, chin (colour of the lower part), mix (grey strands), len (longer), flare (wider), style: 'goatee' for a moustache + chin patch}, glasses {shape, color, lw (frame thickness)}, kippah {color, knit, s (size)}, lip (lip colour).
// Build: h height, w width, head (head size), belly (0..1), shoulders (-1..1). Clothes: suit, shirt, tie, pin, open.
// How strongly each personal face-structure number is drawn. A raw value of 1 is the average face; the gain multiplies the distance from 1
// (this is a caricature, so the differences between people are exaggerated on purpose, and some more than others).
const FG = { fw: 1.25, cheek: 1.6, chin: 2.0, jaw: 1.6, fore: 2.2, ridge: 2.4, lips: 2.0, nose: 1.7, noseL: 2.0, noseW: 1.7, ear: 1.5, eye: 1.8, neck: 1.6 };
const FACE_GAIN = 2.0;
const faceK = (v, f) => Math.max(0.5, Math.min(1.9, 1 + ((v || 1) - 1) * (FG[f] || FACE_GAIN)));
const LOOKS = {
  bibi: {
    fw: 1, len: 1.12, fore: 1.25, ridge: 1.5, cheek: 0.9, jowl: 0.35, chin: 1.2, jaw: 1.1, nose: 1.22, noseL: 1.3, noseW: 1.05, bridge: 0.15, noseT: 0.4, lips: 0.7, eyeSize: 0.9, lid: 0.85, bags: 0.7, browArch: 0.1, browTilt: 0.5, ear: 1.3, neck: 1.1,
    skin: '#ecbb9b', hair: { style: 'swoop', color: '#c9c8cc', vol: 1.2, hl: 0.1, dt: -2.4, ds: -0.8, dd: -2.6, de: 1.5 }, browColor: '#4d4b52', brow: 4.6, age: 0.8, iris: '#5a4a3c', suit: '#1b2236', shirt: '#ffffff', tie: '#c1272d', pin: '#2155e0', h: 1.05, w: 1, shoulders: 0.3, mood: -0.8,
  },
  bengvir: {
    fw: 1.18, len: 0.95, ridge: 1.1, cheek: 1.55, jowl: 0.55, chin: 0.9, jaw: 1.15, nose: 1, noseL: 0.9, noseW: 1.3, lips: 0.95, mouthW: 1.05, eyeSize: 0.85, lid: 0.55, bags: 0.5, browTilt: 0.3, ear: 1.3, earOut: 0.3, neck: 1.35,
    skin: '#e4a98f', hair: { style: 'crop', color: '#8a8d95', vol: 1.1, hl: 0.02, mix: '#d6d8de', dt: -1.8, dh: -2.4, dd: -2.4, ds: -0.2 }, kippah: { color: '#f2f2f4', knit: '#cfd2da', s: 1.05 }, glasses: { shape: 'rect', color: '#aab0c2', lw: 0.9 }, browColor: '#6b6c74', brow: 3.8, age: 0.4, iris: '#3b2a1e', suit: '#262633', shirt: '#f2f2f2', open: true, pin: '#8a4fe0', h: 0.96, w: 1.14, head: 1.04, belly: 0.45, mood: -0.5,
  },
  smotrich: {
    fw: 1, len: 1.08, fore: 1.15, ridge: 1.25, cheek: 1, jaw: 1.05, nose: 1.1, noseL: 1.05, bridge: 0.15, lips: 0.95, lid: 0.3, bags: 0.25, browArch: 0.1, ear: 1.1, neck: 1.1,
    skin: '#edc3a3', hair: { style: 'crop', color: '#463c37', vol: 1.15, hl: 0.03, mix: '#9c9692', dt: 0.8, dd: 0.4, dh: 0.4 }, beard: { color: '#4a4748', chin: '#9a9797', mix: '#c9c6c4' }, browColor: '#3b312b', brow: 4, age: 0.4, iris: '#5f8db0', suit: '#1c1d24', shirt: '#ffffff', open: true, pin: '#f28a1e', h: 1, w: 1.05, belly: 0.2, shoulders: 0.1, mood: 0.3,
  },
  deri: {
    fw: 0.9, len: 1.15, fore: 1.1, ridge: 1.3, cheek: 0.7, jowl: 0.1, chin: 1.05, jaw: 0.95, nose: 1.2, noseL: 1.25, noseW: 1, lips: 0.85, eyeSize: 0.9, lid: 0.65, bags: 0.7, browTilt: 0.2, ear: 1.15, neck: 1,
    skin: '#d6a584', hair: { style: 'comb', color: '#d5d7da', vol: 1.05, hl: 0.06, mix: '#ffffff', dt: -1.8, dd: -3.4, ds: -1.2 }, beard: { color: '#d8dade', chin: '#e9ebee', mix: '#9a9ca2' }, browColor: '#4a4a52', brow: 3.8, age: 0.75, iris: '#2e2119', suit: '#3b4f66', shirt: '#ffffff', tie: '#2a7fd0', pin: '#f4c81d', h: 0.95, w: 0.98, belly: 0.25, mood: -0.5,
  },
  liberman: {
    fw: 1.2, fore: 1.2, ridge: 1.5, cheek: 1.55, jowl: 0.9, chin: 1.1, jaw: 1.25, nose: 1.2, noseL: 1, noseW: 1.4, bridge: 0.1, noseT: 0.3, lips: 0.75, eyeSize: 0.82, lid: 0.7, bags: 0.6, browTilt: 0.5, ear: 1.1, neck: 1.5,
    skin: '#e2a98c', hair: { style: 'sides', color: '#b4b7bd' }, beard: { style: 'goatee', color: '#bdbab5', chin: '#d8d5d0', mix: '#f1efec' }, browColor: '#5f5a58', brow: 4.6, age: 0.6, iris: '#4a5560', suit: '#2c5aa0', shirt: '#ffffff', tie: '#1d3d86', pin: '#b3562a', h: 0.97, w: 1.2, head: 1.06, belly: 0.8, shoulders: 0.2, mood: -0.6,
  },
  lapid: {
    fw: 1, len: 1.15, fore: 1.15, ridge: 1.3, cheek: 0.95, chin: 1.1, jaw: 1.1, nose: 1.1, noseL: 1.2, noseW: 0.95, lips: 1.1, mouthW: 1.2, eyeSize: 0.9, lid: 0.45, bags: 0.4, browArch: 0.15, ear: 1.4, earOut: 0.35, neck: 1.1,
    skin: '#dca889', hair: { style: 'spiky', color: '#8e8b88', vol: 1.1, hl: 0.04, mix: '#c9c7c4', dt: -0.6, dd: -3.2 }, browColor: '#4f4c4a', brow: 4.2, age: 0.6, iris: '#4a4a45', suit: '#1d2230', shirt: '#e7ebf2', open: true, pin: '#19c6b7', h: 1.06, w: 0.95, shoulders: 0.2, mood: 1.3,
  },
  gantz: {
    fw: 1.08, len: 1.18, fore: 1.2, ridge: 1.3, cheek: 1, jowl: 0.25, chin: 1.4, jaw: 1.25, nose: 1.2, noseL: 1.2, noseW: 1.1, lips: 0.8, eyeSize: 0.9, lid: 0.75, bags: 0.55, ear: 1.5, earOut: 0.55, neck: 1.25,
    skin: '#dfa688', hair: { style: 'comb', color: '#e4e1da', vol: 1.3, hl: 0.04, mix: '#ffffff', dt: -0.6, dd: -3.2, ds: -0.8 }, browColor: '#a5a39f', brow: 3.6, age: 0.8, iris: '#6a8296', suit: '#1d2d52', shirt: '#ffffff', open: true, pin: '#6ec6ff', h: 1.13, w: 1.04, head: 1.05, shoulders: 0.6, mood: -0.45,
  },
  golan: {
    fw: 1.05, fore: 1.15, ridge: 1.2, cheek: 1.1, jowl: 0.15, chin: 1.1, jaw: 1.15, nose: 1.1, noseW: 1.05, lips: 1.1, mouthW: 1.15, eyeSize: 0.9, lid: 0.4, bags: 0.4, ear: 1.1, neck: 1.2,
    skin: '#dcaa8a', hair: { style: 'spiky', color: '#a8a7a5', vol: 1, hl: 0.03, mix: '#e0dfdd', dt: -1.4, dd: -3.4 }, browColor: '#8a8985', brow: 3.4, age: 0.6, iris: '#5a4a3c', suit: '#1b2132', shirt: '#f4f6fa', open: true, pin: '#38b56a', h: 1, w: 1.06, belly: 0.25, mood: 1.2,
  },
  odeh: {
    fw: 1.05, fore: 1.1, ridge: 1.35, cheek: 1.05, jaw: 1.1, nose: 1.1, noseW: 1.3, lips: 1, mouthW: 1.05, lid: 0.4, bags: 0.4, browArch: 0.1, browTilt: 0.4, ear: 1.05, neck: 1.3,
    skin: '#c58f70', hair: { style: 'crop', color: '#2c2220', vol: 1.3, hl: 0.02, dt: 1.0, dh: 1.2, dd: -1.6 }, browColor: '#241b19', brow: 4.6, age: 0.35, iris: '#2e2119', suit: '#3a3d4c', shirt: '#cdd2ee', open: true, pin: '#e23b52', h: 1, w: 1.02, mood: 0,
  },
  abbas: {
    fw: 1.15, len: 0.98, fore: 1.2, ridge: 1.15, cheek: 1.35, jowl: 0.3, chin: 0.95, jaw: 1.15, nose: 1.05, noseW: 1.25, lips: 0.95, mouthW: 1.1, eyeSize: 0.88, lid: 0.6, bags: 0.4, ear: 1.1, neck: 1.3,
    skin: '#c8987a', hair: { style: 'crop', color: '#1d1817', vol: 0.9, hl: 0.22, mix: '#6a6562', dt: -1.2, dd: -3.4 }, stubble: 0.8, stache: '#1b1716', stacheW: 1.15, browColor: '#1d1817', brow: 4, age: 0.45, iris: '#2e2119', suit: '#1d1d20', shirt: '#f0f2f4', open: true, pin: '#a5d63c', h: 0.99, w: 1.1, belly: 0.3, mood: 0.3,
  },
  tibi: {
    fw: 1.12, fore: 1.2, ridge: 1.15, cheek: 1.25, jowl: 0.45, jaw: 1.1, nose: 1.15, noseW: 1.2, bridge: 0.15, lips: 0.9, mouthW: 1.05, eyeSize: 0.85, lid: 0.6, bags: 0.6, browArch: 0.1, ear: 1.2, neck: 1.25,
    skin: '#d9a98a', hair: { style: 'sides', color: '#b8b8bc' }, stache: '#9b9996', stacheW: 1.15, glasses: { shape: 'rect', color: '#a8b3c6', lw: 0.85 }, browColor: '#66646a', brow: 3.4, age: 0.6, iris: '#3a2c20', suit: '#1d2c55', shirt: '#ffffff', tie: '#6f8fc0', pin: '#e05fb4', h: 0.98, w: 1.08, belly: 0.3, mood: 0.8,
  },
  regev: {
    fw: 0.95, len: 1.08, cheek: 0.85, chin: 0.92, jaw: 0.92, nose: 0.95, noseW: 0.9, lips: 1.2, eyeSize: 1.1, lid: 0.3, browArch: 0.4, neck: 0.95,
    skin: '#e0b090', hair: { style: 'layered', color: '#2a1b15', vol: 1.1, len: 46, sweep: 1, dt: -1.6, ds: -0.4, dw: 0.9, dh: -1.2 }, browColor: '#241812', brow: 2.8, female: true, age: 0.45, iris: '#4a3020', suit: '#1d6fe0', shirt: '#1d6fe0', pin: '#ffd24a', h: 0.98, w: 0.97, open: true, head: 1, shoulders: 0.05, mood: -0.3,
  },
  ohana: {
    fw: 0.98, len: 1.15, fore: 1.15, ridge: 1.35, cheek: 0.9, chin: 1.15, jaw: 1.2, nose: 1.05, noseL: 1.1, noseW: 0.95, lips: 0.85, eyeSize: 1, lid: 0.35, bags: 0.4, browTilt: 0.6, ear: 1.25, earOut: 0.3, neck: 1.25,
    skin: '#e6bfa4', hair: { style: 'none', color: '#7a746e' }, beard: { color: '#867d76', chin: '#b4b0aa', mix: '#d9d6d2' }, browColor: '#4a3a30', brow: 3.8, age: 0.45, iris: '#6f8da6', suit: '#17202f', shirt: '#ffffff', tie: '#5a9ae6', pin: '#2155e0', h: 1.02, w: 1.02, shoulders: 0.15, mood: -0.2,
  },
  gotliv: {
    fw: 1.05, len: 0.98, cheek: 1.45, chin: 0.95, jaw: 0.95, noseW: 0.95, lips: 1.35, mouthW: 1.15, eyeSize: 1.1, lid: 0.3, browArch: 0.5, neck: 0.95,
    skin: '#f0cdb9', hair: { style: 'bob', color: '#2e211c', vol: 1.1, len: 26, dt: -0.6 }, browColor: '#2a1c16', brow: 3.2, female: true, lip: '#c6283f', age: 0.35, iris: '#4a3220', suit: '#15151b', shirt: '#15151b', open: true, earring: '#cfcfdc', h: 0.94, w: 0.95, shoulders: -0.2, mood: 1.2,
  },
  bennett: {
    fw: 0.98, len: 1.05, fore: 1.15, ridge: 1.2, cheek: 0.9, noseW: 0.95, eyeSize: 1, lid: 0.3, bags: 0.3, ear: 1.2, earOut: 0.35,
    skin: '#dcaa88', hair: { style: 'crop', color: '#33281f', vol: 0.8, hl: 0.28, dt: -1.4, dd: -3.6, dh: -0.4 }, browColor: '#2c221b', brow: 3.6, age: 0.35, iris: '#4a3c2c', suit: '#16171c', shirt: '#f4f6fa', open: true, pin: '#19c6b7', h: 0.99, w: 0.97, shoulders: 0.15, mood: 0.6,
  },
  eisenkot: {
    fw: 1.2, fore: 1.3, ridge: 1.5, cheek: 1.1, jowl: 0.3, chin: 1.25, jaw: 1.4, nose: 1.15, noseW: 1.3, lips: 0.85, mouthW: 1.05, eyeSize: 0.88, lid: 0.55, bags: 0.6, browTilt: 0.2, ear: 1.15, neck: 1.5,
    skin: '#dcaa88', hair: { style: 'crop', color: '#9a9a9c', vol: 0.9, hl: 0.03, mix: '#d0d0d2', dt: -1.4, dd: -3.6, dh: -0.6 }, browColor: '#55525a', brow: 4.2, age: 0.75, iris: '#6b5642', suit: '#1d2a52', shirt: '#14151a', open: true, pin: '#18b0e0', h: 1.06, w: 1.1, shoulders: 0.6, mood: -0.4,
  },
  asher: {
    fw: 1.12, fore: 1.3, ridge: 1.3, cheek: 1.15, jowl: 0.2, jaw: 1.05, nose: 1.2, noseL: 1.1, noseW: 1.15, lips: 0.8, eyeSize: 0.95, lid: 0.4, bags: 0.4, ear: 1.4, earOut: 0.3, neck: 1.2,
    skin: '#dca682', hair: { style: 'sides', color: '#9c9892' }, kippah: { color: '#121118', s: 1.15 }, beard: { color: '#9d9892', chin: '#c9c5bf', mix: '#e6e3de', len: 0.7 }, stache: '#8d857d', glasses: { shape: 'round', color: '#c9a84c', lw: 1.1 }, browColor: '#6a625b', brow: 4.2, age: 0.6, iris: '#4a6a5a', suit: '#14141b', shirt: '#ffffff', tie: '#3a3d44', h: 0.99, w: 1.08, belly: 0.4, mood: -0.4,
  },
  maoz: {
    fw: 0.98, len: 1.05, fore: 1.1, ridge: 1.1, cheek: 1.1, nose: 1.1, noseW: 1.1, mouthW: 1.1, lid: 0.3, bags: 0.3, ear: 1.3, earOut: 0.25,
    skin: '#e8b9a0', hair: { style: 'crop', color: '#8d877d', vol: 0.8, hl: 0.02, dt: -2, dd: -3.4, dh: -1 }, kippah: { color: '#1c2347', knit: '#aab8de' }, beard: { color: '#aaa090', chin: '#bdb4a5', mix: '#6f675c', len: 2.5, flare: 2.2 }, browColor: '#8a8378', brow: 3.6, age: 0.5, iris: '#7fa3b8', suit: '#f1f1f2', shirt: '#ffffff', h: 1, w: 1.04, belly: 0.35, mood: 1.1,
  },
  abushehadeh: {
    fw: 1.1, len: 0.98, fore: 1.3, cheek: 1.35, jowl: 0.25, nose: 1, noseW: 1.05, lips: 1, mouthW: 1.05, eyeSize: 0.95, lid: 0.35, bags: 0.4, ear: 1.1, neck: 1.1,
    skin: '#e2b698', hair: { style: 'sides', color: '#2e2724' }, stache: '#4a3b36', stacheW: 0.85, stubble: 0.35, glasses: { shape: 'rect', color: '#101014', lw: 2.1 }, browColor: '#241d1b', brow: 3.8, age: 0.3, iris: '#3a2a1e', suit: '#1d3262', shirt: '#f1ece2', tie: '#6f94cc', pin: '#1f8f63', h: 1, w: 1.04, belly: 0.3, mood: 0.5,
  },
  hendel: {
    fw: 0.96, len: 1.05, ridge: 1.1, cheek: 0.9, jaw: 1.05, nose: 1.1, noseL: 1.05, noseW: 0.95, mouthW: 1.2, lid: 0.3, bags: 0.3, ear: 1.2, earOut: 0.3, neck: 1.1,
    skin: '#d8a782', hair: { style: 'spiky', color: '#77746f', vol: 1.1, hl: 0.04, mix: '#bdbab4', dt: -0.8, dd: -3.2 }, stubble: 0.2, browColor: '#55504a', brow: 3.4, age: 0.5, iris: '#6f8a96', suit: '#4b5a3a', shirt: '#3c4a2e', open: true, pin: '#b59f5a', h: 1.03, w: 1, shoulders: 0.1, mood: 1.4,
  },
  winter: {
    fw: 1.18, ridge: 1.3, cheek: 1.2, jowl: 0.25, chin: 1.3, jaw: 1.3, nose: 1.05, noseW: 1.2, mouthW: 1.1, eyeSize: 0.8, lid: 0.55, bags: 0.4, browTilt: 0.1, ear: 1.1, neck: 1.5,
    skin: '#d89f7c', hair: { style: 'buzz', color: '#6b6670', vol: 1, mix: '#b8b4bc', dd: -2.6 }, kippah: { color: '#cfc8d6', s: 0.62 }, beard: { color: '#5a5656', chin: '#c4c1c1', mix: '#e4e2e2', flare: 0.3 }, browColor: '#3d3835', brow: 3.8, age: 0.5, iris: '#4a3a2c', suit: '#1b2a4a', shirt: '#1b2a4a', open: true, pin: '#e0a82e', h: 1.08, w: 1.2, shoulders: 0.85, belly: 0.2, mood: 0.1,
  },
};

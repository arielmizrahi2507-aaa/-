// ===== Character looks: caricatures. Everyone is identified by hair, build, clothes and a clearly personal face. =====
// Face structure (1 = the average face, each number is multiplied by its gain in FG below; both the drawn portraits and the 3D head use them):
//   fw head width, len face length (chin end), fore forehead, ridge brow ridge, cheek fullness, jowl (0..1 sagging lower cheeks), chin size, jaw width,
//   nose (size), noseL (length / how far it sticks out), noseW (width), bridge (bump), noseT (> 0 drooping tip, < 0 turned up), lips, mouthW, ear, earOut (sticking out),
//   eyeSize, eyeGap, lid (0..1 heavy upper lids), bags (0..1 under the eyes), brow (thickness in px), browArch, browTilt (> 0 stern), browLen, neck.
// Other: skin, iris, age (lines, 0..1), stubble (0..1), beard {color}, stache, glasses {shape, color}, kippah {color, knit}, hat {color}, female, earring,
//   hair {style: crop | buzz | curly | comb | swoop | part | thin | sides | wavy | none, color, vol (thickness), hl (receding hairline, radians), len (long hair)}.
// Build: h height, w width, head (head size), belly (0..1), shoulders (-1..1). Clothes: suit, shirt, tie, pin, open.
// How strongly each personal face-structure number is drawn. A raw value of 1 is the average face; the gain multiplies the distance from 1
// (this is a caricature, so the differences between people are exaggerated on purpose, and some more than others).
const FG = { fw: 1.25, cheek: 1.6, chin: 2.0, jaw: 1.6, fore: 2.2, ridge: 2.4, lips: 2.0, nose: 1.7, noseL: 2.0, noseW: 1.7, ear: 1.5, eye: 1.8, neck: 1.6 };
const FACE_GAIN = 2.0;
const faceK = (v, f) => Math.max(0.5, Math.min(1.9, 1 + ((v || 1) - 1) * (FG[f] || FACE_GAIN)));
const LOOKS = {
  bibi: {
    fw: 0.95, len: 1.14, fore: 1.22, ridge: 1.2, cheek: 0.85, chin: 1.22, jaw: 1, nose: 1.14, noseL: 1.22, noseW: 0.95, bridge: 0.1, noseT: 0.35, lips: 0.78, eyeSize: 0.92, lid: 0.7, bags: 0.55, browArch: 0.3,
    skin: '#f0c7a3', hair: { style: 'swoop', color: '#dfe3ea', vol: 1.1, hl: 0.09 }, browColor: '#6f6e75', brow: 3.2, age: 0.7, iris: '#5b5648', suit: '#1f2a44', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 1.05, w: 1, shoulders: 0.3,
  },
  bengvir: {
    fw: 1.14, len: 0.92, cheek: 1.4, jowl: 0.3, chin: 0.86, jaw: 1.12, ridge: 1.25, nose: 0.95, noseL: 0.92, noseW: 1.25, lips: 1.2, eyeSize: 0.88, lid: 0.3, bags: 0.2, browTilt: 0.6, ear: 1.15, neck: 1.3,
    skin: '#e3b48b', hair: { style: 'curly', color: '#241d1a', vol: 1, hl: 0.1 }, kippah: { color: '#2b3a8f', knit: '#f2d24a' }, stubble: 0.4, age: 0.25, brow: 4.4, iris: '#3b2a1e', suit: '#262633', shirt: '#f2f2f2', open: true, pin: '#8a4fe0', h: 0.96, w: 1.12, head: 1.04, belly: 0.4,
  },
  smotrich: {
    fw: 1, len: 1.02, fore: 1.1, ridge: 1.3, cheek: 1.15, jaw: 1.02, nose: 1.14, noseL: 1.05, bridge: 0.25, lips: 0.95, eyeSize: 0.9, lid: 0.35, browArch: 0.1, ear: 1.1, neck: 1.05,
    skin: '#eec39b', hair: { style: 'crop', color: '#33261d', vol: 0.8 }, kippah: { color: '#f28a1e', knit: '#ffffff' }, beard: { color: '#2a211c' }, age: 0.3, brow: 4.2, iris: '#3d2c1e', suit: '#2a2f4a', shirt: '#ffffff', tie: '#f28a1e', pin: '#f28a1e', h: 1, w: 1.05, belly: 0.2, shoulders: 0.1,
  },
  deri: {
    fw: 1.2, len: 0.88, fore: 1.15, ridge: 1.15, cheek: 1.6, jowl: 0.6, chin: 0.8, jaw: 1.2, nose: 0.9, noseL: 0.85, noseW: 1.25, noseT: -0.2, lips: 1.1, eyeSize: 0.8, lid: 0.55, bags: 0.5, neck: 1.25,
    skin: '#e0b088', hair: { style: 'sides', color: '#8a8f9a' }, kippah: { color: '#15141d' }, browColor: '#6a6a75', brow: 4, age: 0.55, iris: '#3b2a1e', suit: '#191922', shirt: '#ffffff', tie: '#f4c81d', pin: '#f4c81d', h: 0.92, w: 1.16, head: 1.04, belly: 0.75,
  },
  liberman: {
    fw: 1.18, fore: 1.3, ridge: 1.5, cheek: 1.3, jowl: 0.7, chin: 1.15, jaw: 1.2, nose: 1.25, noseL: 1.1, noseW: 1.35, bridge: 0.3, noseT: 0.2, lips: 0.75, eyeSize: 0.82, lid: 0.5, bags: 0.4, browTilt: 0.8, ear: 1.15, neck: 1.4,
    skin: '#efc4a2', hair: { style: 'sides', color: '#b8bcc6' }, browColor: '#5b5f6b', brow: 4.6, age: 0.6, iris: '#4a5560', suit: '#2d3542', shirt: '#ffffff', tie: '#b3562a', pin: '#b3562a', h: 0.97, w: 1.2, head: 1.06, belly: 0.8, shoulders: 0.2,
  },
  lapid: {
    fw: 0.92, len: 1.22, fore: 1.2, ridge: 1.15, cheek: 0.72, chin: 1.08, jaw: 0.98, nose: 1.1, noseL: 1.3, noseW: 0.85, lips: 0.9, lid: 0.4, bags: 0.35, browArch: 0.2,
    skin: '#f0caa7', hair: { style: 'comb', color: '#a9a59d', vol: 1, hl: 0.06 }, browColor: '#5a5650', brow: 3.7, stubble: 0.35, age: 0.5, iris: '#55605a', suit: '#20242e', shirt: '#e7ebf2', open: true, pin: '#19c6b7', h: 1.06, w: 0.92, shoulders: 0.2,
  },
  gantz: {
    fw: 1.08, len: 1.18, fore: 1.2, ridge: 1.25, cheek: 0.95, chin: 1.45, jaw: 1.2, nose: 1.15, noseL: 1.2, noseW: 1.05, lips: 0.85, eyeSize: 0.95, lid: 0.4, bags: 0.3, ear: 1.35, earOut: 0.4, neck: 1.2,
    skin: '#e8bd96', hair: { style: 'buzz', color: '#c5c9d2', vol: 1, hl: 0.05 }, browColor: '#7a7f8a', brow: 4, age: 0.5, iris: '#4f5a63', suit: '#22355a', shirt: '#ffffff', tie: '#6ec6ff', pin: '#6ec6ff', h: 1.13, w: 1.04, head: 1.05, shoulders: 0.6,
  },
  golan: {
    fw: 1.12, fore: 1.35, ridge: 1.2, cheek: 1.2, jowl: 0.3, jaw: 1.1, nose: 1.15, noseW: 1.15, lips: 0.95, eyeSize: 0.95, lid: 0.35, bags: 0.4, ear: 1.25, neck: 1.1,
    skin: '#e4b48c', hair: { style: 'none', color: '#aab0ba' }, beard: { color: '#b4bac4' }, browColor: '#8b919c', brow: 3.6, age: 0.6, iris: '#4a3a2c', suit: '#1f3a2c', shirt: '#e8efe6', open: true, pin: '#38b56a', h: 1, w: 1.08, belly: 0.35,
  },
  odeh: {
    fw: 0.95, cheek: 0.9, fore: 1.12, chin: 0.95, jaw: 0.98, noseL: 0.95, lips: 1.1, mouthW: 1.12, eyeSize: 1.25, browArch: 0.5,
    skin: '#c79770', hair: { style: 'part', color: '#1f1a1a', vol: 0.8, hl: 0.12 }, stache: '#1f1a1a', age: 0.3, brow: 3.2, iris: '#2e2119', suit: '#2b2e3b', shirt: '#cfe3ff', tie: '#e23b52', pin: '#e23b52', h: 1, w: 0.97, head: 0.98,
  },
  abbas: {
    fw: 1.12, len: 0.96, cheek: 1.4, jowl: 0.3, chin: 0.95, jaw: 1.08, noseW: 1.15, ridge: 0.95, lips: 1.15, lid: 0.3, ear: 1.1, neck: 1.15,
    skin: '#c39670', hair: { style: 'thin', color: '#241d1a', vol: 0.9, hl: 0.06 }, beard: { color: '#3a2f28' }, age: 0.3, brow: 3.2, iris: '#2e2119', suit: '#233a34', shirt: '#f0f4ef', tie: '#a5d63c', pin: '#a5d63c', h: 0.98, w: 1.06, belly: 0.3,
  },
  tibi: {
    len: 1.05, fore: 1.1, ridge: 1.35, cheek: 0.95, chin: 1.1, nose: 1.4, noseL: 1.25, noseW: 1.3, bridge: 0.5, noseT: 0.4, lid: 0.5, bags: 0.55, browArch: 0.3, ear: 1.1,
    skin: '#c79770', hair: { style: 'thin', color: '#3a3a44', vol: 1, hl: 0.1 }, stache: '#33302e', glasses: { shape: 'rect', color: '#2a2a33' }, age: 0.55, brow: 4, iris: '#2e2119', suit: '#3a2f4a', shirt: '#ffffff', tie: '#e05fb4', pin: '#e05fb4', h: 0.96, w: 1.02, belly: 0.2,
  },
  regev: {
    fw: 1.06, cheek: 1.3, chin: 0.98, jaw: 1, nose: 0.9, noseL: 0.92, noseW: 0.98, lips: 1.35, eyeSize: 1.2, ridge: 1.05, browArch: 0.75, neck: 1,
    skin: '#e8b88c', hair: { style: 'layered', color: '#b08650', vol: 1.3, len: 40, sweep: 1 }, browColor: '#4e3522', brow: 3.4, earring: '#ffd24a', female: true, age: 0.4, iris: '#5a4028', suit: '#8b1e3f', shirt: '#fff4f6', pin: '#ffd24a', h: 0.98, w: 0.97, open: true, head: 1, shoulders: 0.05,
  },
  ohana: {
    fw: 0.95, len: 1.1, fore: 1.1, ridge: 1.1, cheek: 0.88, chin: 1.1, nose: 1.05, noseL: 1.1, noseW: 0.95, lips: 0.95, lid: 0.2,
    skin: '#e6bb95', hair: { style: 'crop', color: '#332a24', vol: 0.9, hl: 0.14 }, stubble: 0.4, browColor: '#3b302a', brow: 3.4, age: 0.3, iris: '#3c2a1e', suit: '#1c2436', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 1.02, w: 1, shoulders: 0.1,
  },
  gotliv: {
    fw: 0.92, len: 1.08, cheek: 1.15, ridge: 1.25, chin: 0.92, jaw: 0.92, nose: 1.15, noseL: 1.2, noseW: 0.85, noseT: -0.15, lips: 1.3, eyeSize: 1.05, lid: 0.3, browArch: 0.5, browTilt: 0.3, neck: 0.9,
    skin: '#efc6a2', hair: { style: 'wavy', color: '#3a2820', len: 46 }, browColor: '#3a2820', brow: 3.4, female: true, age: 0.35, iris: '#4a3220', suit: '#221a33', shirt: '#efe6ff', open: true, pin: '#8a4fe0', earring: '#d8d8e6', h: 0.94, w: 0.9, head: 0.97, shoulders: -0.3,
  },
  bennett: {
    fw: 1.1, len: 0.93, cheek: 1.35, jowl: 0.15, chin: 0.9, jaw: 1.02, nose: 0.85, noseL: 0.85, noseW: 0.95, noseT: -0.3, eyeSize: 1.1, ear: 1.15,
    skin: '#efc8a3', hair: { style: 'crop', color: '#3b2e26', vol: 0.8, hl: 0.14 }, kippah: { color: '#2b3a6b', knit: '#e9eef8' }, stubble: 0.15, browColor: '#3b2e26', brow: 3, age: 0.35, iris: '#4a5a4a', suit: '#2a3245', shirt: '#dbe6f7', open: true, pin: '#19c6b7', h: 0.98, w: 0.98, shoulders: 0.2,
  },
  eisenkot: {
    fw: 1.08, len: 1.08, fore: 1.05, ridge: 1.45, cheek: 0.95, chin: 1.4, jaw: 1.25, nose: 1.2, noseL: 1.05, noseW: 1.2, lips: 0.8, eyeSize: 0.9, lid: 0.4, browTilt: 0.5, ear: 1.15, neck: 1.3,
    skin: '#e7bd97', hair: { style: 'buzz', color: '#babfc9', vol: 1, hl: 0.04 }, browColor: '#5f6473', brow: 4.4, age: 0.65, iris: '#54606a', suit: '#1d2a3c', shirt: '#e9eef7', open: true, pin: '#18b0e0', h: 1.06, w: 1.1, shoulders: 0.6,
  },
  asher: {
    fw: 0.94, len: 1.1, fore: 1.1, ridge: 1.15, cheek: 0.85, nose: 1.25, noseL: 1.1, lips: 0.85, eyeSize: 0.92, lid: 0.45, bags: 0.4, ear: 1.1,
    skin: '#e5bd98', hair: { style: 'none', color: '#5a5350' }, beard: { color: '#6d6660' }, hat: { color: '#121118' }, browColor: '#4c4642', brow: 3.6, age: 0.6, iris: '#3b2a1e', suit: '#14141b', shirt: '#ffffff', h: 0.97, w: 1.08, belly: 0.45,
  },
  maoz: {
    fw: 0.97, len: 1.05, ridge: 1.25, cheek: 0.9, jaw: 1.05, nose: 1.25, noseW: 1.15, lips: 0.85, eyeSize: 0.95, lid: 0.5, bags: 0.5, ear: 1.2,
    skin: '#e0b48c', hair: { style: 'none', color: '#a9adb5' }, beard: { color: '#a9adb5' }, kippah: { color: '#15141d' }, browColor: '#7a7f8a', brow: 4, age: 0.7, iris: '#3f3428', suit: '#2a2732', shirt: '#f2f2f2', h: 1, w: 1.04, belly: 0.35,
  },
  abushehadeh: {
    ridge: 1.15, jaw: 1.1, lips: 1.1, eyeSize: 1.05,
    skin: '#c99872', hair: { style: 'curly', color: '#211a17', vol: 1 }, stubble: 0.55, stache: '#211a17', browColor: '#211a17', brow: 3.9, age: 0.3, iris: '#2e2119', suit: '#22303a', shirt: '#eaf3f2', open: true, pin: '#1f8f63', h: 1.01, w: 1,
  },
  hendel: {
    fw: 0.92, len: 1.1, cheek: 0.8, chin: 0.95, jaw: 0.95, nose: 1.1, noseL: 1.1, noseW: 0.9, ridge: 0.9, eyeSize: 1.1, ear: 1.05,
    skin: '#efc5a1', hair: { style: 'part', color: '#5a4232' }, stubble: 0.3, browColor: '#4c382a', brow: 2.8, age: 0.3, iris: '#4a5a52', suit: '#4c5a34', shirt: '#f1efe6', open: true, pin: '#b59f5a', h: 1.03, w: 0.94, head: 0.97, shoulders: -0.1,
  },
  winter: {
    fw: 1.14, len: 1.05, ridge: 1.4, cheek: 1.1, chin: 1.45, jaw: 1.25, nose: 1.05, noseW: 1.15, lips: 0.95, eyeSize: 0.9, lid: 0.3, ear: 1.1, neck: 1.45,
    skin: '#e6b990', hair: { style: 'buzz', color: '#514c48', vol: 1 }, kippah: { color: '#222b3d', knit: '#c9a959' }, stubble: 0.22, browColor: '#3d3835', brow: 4.2, age: 0.4, iris: '#3f4a52', suit: '#2a3a2c', shirt: '#f2f2f2', open: true, pin: '#e0a82e', h: 1.08, w: 1.2, shoulders: 0.85, belly: 0.2,
  },
};

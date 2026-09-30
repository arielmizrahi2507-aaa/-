// ===== Character looks: semi-realistic caricatures. Everyone is identified by hair, build, clothes and a few facial traits. =====
// Optional face fields (all subtle, 0.9 - 1.15 is the useful range): jaw width, nose size, brow thickness, age (lines), stubble (0-1),
// beard {color}, stache, glasses, kippah, hat {color} (black brimmed hat), female (lips + lashes), iris colour.
// hair {style, color, vol (thickness), hl (receding hairline, radians), len (length of long hair)}.
const LOOKS = {
  bibi: {
    skin: '#f0c7a3', hair: { style: 'swoop', color: '#dfe3ea', vol: 1.1, hl: 0.05 }, browColor: '#6f6e75', brow: 2.7, age: 0.7, iris: '#5b5648',
    suit: '#1f2a44', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 1.0, w: 1.0, jaw: 1.0,
  },
  bengvir: {
    skin: '#e3b48b', hair: { style: 'crop', color: '#241d1a', vol: 0.8, hl: 0.1 }, kippah: { color: '#2b3a8f', knit: '#f2d24a' }, stubble: 0.4, age: 0.25, brow: 3.3, iris: '#3b2a1e',
    suit: '#262633', shirt: '#f2f2f2', open: true, pin: '#8a4fe0', h: 0.98, w: 1.1, jaw: 1.08,
  },
  smotrich: {
    skin: '#eec39b', hair: { style: 'crop', color: '#33261d', vol: 0.8 }, kippah: { color: '#f28a1e', knit: '#ffffff' }, beard: { color: '#2a211c' }, age: 0.3, brow: 2.9, iris: '#3d2c1e',
    suit: '#2a2f4a', shirt: '#ffffff', tie: '#f28a1e', pin: '#f28a1e', h: 1.0, w: 1.0, jaw: 1.02,
  },
  deri: {
    skin: '#e0b088', hair: { style: 'sides', color: '#8a8f9a' }, kippah: { color: '#15141d' }, browColor: '#4a4a55', brow: 3.4, age: 0.55, iris: '#3b2a1e',
    suit: '#191922', shirt: '#ffffff', tie: '#f4c81d', pin: '#f4c81d', h: 0.96, w: 1.14, jaw: 1.12,
  },
  liberman: {
    skin: '#efc4a2', hair: { style: 'sides', color: '#b8bcc6' }, browColor: '#5b5f6b', brow: 3.6, age: 0.6, iris: '#4a5560',
    suit: '#2d3542', shirt: '#ffffff', tie: '#b3562a', pin: '#b3562a', h: 1.0, w: 1.14, nose: 1.08, jaw: 1.1,
  },
  lapid: {
    skin: '#f0caa7', hair: { style: 'part', color: '#a9a59d', vol: 0.9, hl: 0.1 }, browColor: '#6f6b64', stubble: 0.35, age: 0.5, iris: '#55605a',
    suit: '#20242e', shirt: '#e7ebf2', open: true, pin: '#19c6b7', h: 1.03, w: 0.96, jaw: 0.98,
  },
  gantz: {
    skin: '#e8bd96', hair: { style: 'crop', color: '#c5c9d2', vol: 0.85 }, browColor: '#7a7f8a', brow: 3.0, age: 0.5, iris: '#4f5a63',
    suit: '#22355a', shirt: '#ffffff', tie: '#6ec6ff', pin: '#6ec6ff', h: 1.09, w: 1.02, jaw: 1.08,
  },
  golan: {
    skin: '#e4b48c', hair: { style: 'none', color: '#aab0ba' }, beard: { color: '#b4bac4' }, browColor: '#8b919c', brow: 3.0, age: 0.6, iris: '#4a3a2c',
    suit: '#1f3a2c', shirt: '#e8efe6', open: true, pin: '#38b56a', h: 1.0, w: 1.06, jaw: 1.08,
  },
  odeh: {
    skin: '#c79770', hair: { style: 'part', color: '#1f1a1a', vol: 0.8, hl: 0.12 }, stache: '#1f1a1a', age: 0.3, brow: 3.0, iris: '#2e2119',
    suit: '#2b2e3b', shirt: '#cfe3ff', tie: '#e23b52', pin: '#e23b52', h: 1.02, w: 0.98,
  },
  abbas: {
    skin: '#c39670', hair: { style: 'crop', color: '#241d1a', vol: 0.7 }, beard: { color: '#3a2f28' }, age: 0.3, iris: '#2e2119',
    suit: '#233a34', shirt: '#f0f4ef', tie: '#a5d63c', pin: '#a5d63c', h: 1.0, w: 1.03,
  },
  tibi: {
    skin: '#c79770', hair: { style: 'part', color: '#3a3a44', vol: 0.8, hl: 0.15 }, stache: '#33302e', glasses: { shape: 'rect', color: '#2a2a33' }, age: 0.55, iris: '#2e2119',
    suit: '#3a2f4a', shirt: '#ffffff', tie: '#e05fb4', pin: '#e05fb4', h: 0.98, w: 1.0,
  },
  regev: {
    skin: '#f0c5a0', hair: { style: 'wavy', color: '#c49a62', len: 30 }, browColor: '#7a5a30', earring: '#ffd24a', female: true, age: 0.3, jaw: 0.92, nose: 0.95, iris: '#5a4028',
    suit: '#8b1e3f', shirt: '#fff4f6', pin: '#ffd24a', h: 0.97, w: 0.92, open: true, head: 1.0,
  },
  ohana: {
    skin: '#e6bb95', hair: { style: 'crop', color: '#332a24', vol: 0.9 }, stubble: 0.4, browColor: '#3b302a', brow: 2.9, age: 0.3, iris: '#3c2a1e',
    suit: '#1c2436', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 1.02, w: 1.02, jaw: 1.04,
  },
  gotliv: {
    skin: '#efc6a2', hair: { style: 'wavy', color: '#3a2820', len: 46 }, browColor: '#3a2820', female: true, age: 0.35, jaw: 0.94, nose: 1.0, iris: '#4a3220',
    suit: '#221a33', shirt: '#efe6ff', open: true, pin: '#8a4fe0', earring: '#d8d8e6', h: 0.97, w: 0.93, head: 1.0,
  },
  bennett: {
    skin: '#efc8a3', hair: { style: 'crop', color: '#3b2e26', vol: 0.8, hl: 0.1 }, kippah: { color: '#2b3a6b', knit: '#e9eef8' }, stubble: 0.15, browColor: '#3b2e26', brow: 2.7, age: 0.35, iris: '#4a5a4a',
    suit: '#2a3245', shirt: '#dbe6f7', open: true, pin: '#19c6b7', h: 1.0, w: 0.99, jaw: 1.0,
  },
  eisenkot: {
    skin: '#e7bd97', hair: { style: 'crop', color: '#babfc9', vol: 0.85 }, browColor: '#5f6473', brow: 3.6, age: 0.65, iris: '#54606a',
    suit: '#1d2a3c', shirt: '#e9eef7', open: true, pin: '#18b0e0', h: 1.04, w: 1.06, jaw: 1.1, nose: 1.05,
  },
  asher: {
    skin: '#e5bd98', hair: { style: 'none', color: '#5a5350' }, beard: { color: '#6d6660' }, hat: { color: '#121118' }, browColor: '#4c4642', brow: 3.0, age: 0.6, iris: '#3b2a1e',
    suit: '#14141b', shirt: '#ffffff', h: 0.98, w: 1.06, jaw: 1.05,
  },
  maoz: {
    skin: '#e0b48c', hair: { style: 'none', color: '#a9adb5' }, beard: { color: '#a9adb5' }, kippah: { color: '#15141d' }, browColor: '#7a7f8a', brow: 3.1, age: 0.7, iris: '#3f3428',
    suit: '#2a2732', shirt: '#f2f2f2', h: 0.99, w: 1.03, jaw: 1.06,
  },
  abushehadeh: {
    skin: '#c99872', hair: { style: 'crop', color: '#211a17', vol: 0.85 }, stubble: 0.55, stache: '#211a17', browColor: '#211a17', brow: 3.1, age: 0.3, iris: '#2e2119',
    suit: '#22303a', shirt: '#eaf3f2', open: true, pin: '#1f8f63', h: 1.01, w: 1.0, jaw: 1.04,
  },
  hendel: {
    skin: '#efc5a1', hair: { style: 'part', color: '#5a4232' }, stubble: 0.3, browColor: '#4c382a', brow: 2.8, age: 0.3, iris: '#4a5a52',
    suit: '#4c5a34', shirt: '#f1efe6', open: true, pin: '#b59f5a', h: 1.0, w: 0.98, jaw: 1.0,
  },
  winter: {
    skin: '#e6b990', hair: { style: 'crop', color: '#514c48', vol: 0.7 }, kippah: { color: '#222b3d', knit: '#c9a959' }, stubble: 0.22, browColor: '#3d3835', brow: 3.6, age: 0.4, iris: '#3f4a52',
    suit: '#2a3a2c', shirt: '#f2f2f2', open: true, pin: '#e0a82e', h: 1.06, w: 1.1, jaw: 1.14, nose: 1.02,
  },
};

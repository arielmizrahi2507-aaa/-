// ===== Character looks (cartoon caricatures: generic proportions, identified by hair / accessories / colours) =====
const LOOKS = {
  bibi: {
    skin: '#f3c9a3', hair: { style: 'swoop', color: '#dfe3ea' }, browColor: '#8d95a3',
    suit: '#1f2a44', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 1.0, w: 1.0,
  },
  bengvir: {
    skin: '#e9b98f', hair: { style: 'crop', color: '#2a2320' }, kippah: { color: '#2b3a8f', knit: '#f2d24a' },
    beard: { color: '#5a4a40' }, suit: '#262633', shirt: '#f2f2f2', open: true, pin: '#8a4fe0', h: 0.98, w: 1.1, brow: 4.2,
  },
  smotrich: {
    skin: '#efc39b', hair: { style: 'crop', color: '#3b2a20' }, kippah: { color: '#f28a1e', knit: '#ffffff' },
    beard: { color: '#2c2320' }, suit: '#2a2f4a', shirt: '#ffffff', tie: '#f28a1e', pin: '#f28a1e', h: 1.0, w: 1.0,
  },
  deri: {
    skin: '#e3b48c', hair: { style: 'sides', color: '#8a8f9a' }, kippah: { color: '#15141d' }, browColor: '#4a4a55',
    suit: '#191922', shirt: '#ffffff', tie: '#f4c81d', pin: '#f4c81d', h: 0.96, w: 1.14, brow: 4.4,
  },
  liberman: {
    skin: '#f0c7a6', hair: { style: 'sides', color: '#b8bcc6' }, browColor: '#5b5f6b', brow: 4.6,
    suit: '#2d3542', shirt: '#ffffff', tie: '#b3562a', pin: '#b3562a', h: 1.0, w: 1.14, nose: 1.15,
  },
  lapid: {
    skin: '#f2cba8', hair: { style: 'part', color: '#a9a59d' }, browColor: '#6f6b64',
    suit: '#20242e', shirt: '#e7ebf2', open: true, pin: '#19c6b7', h: 1.03, w: 0.96,
  },
  gantz: {
    skin: '#eabf98', hair: { style: 'crop', color: '#c5c9d2' }, browColor: '#7a7f8a',
    suit: '#22355a', shirt: '#ffffff', tie: '#6ec6ff', pin: '#6ec6ff', h: 1.09, w: 1.02,
  },
  golan: {
    skin: '#e6b78f', hair: { style: 'none', color: '#aab0ba' }, beard: { color: '#b4bac4' }, browColor: '#8b919c',
    suit: '#1f3a2c', shirt: '#e8efe6', open: true, pin: '#38b56a', h: 1.0, w: 1.06,
  },
  odeh: {
    skin: '#c99870', hair: { style: 'part', color: '#1f1a1a' }, stache: '#1f1a1a',
    suit: '#2b2e3b', shirt: '#cfe3ff', tie: '#e23b52', pin: '#e23b52', h: 1.02, w: 0.98,
  },
  abbas: {
    skin: '#c79a72', hair: { style: 'crop', color: '#2a2320' }, beard: { color: '#40352e' },
    suit: '#233a34', shirt: '#f0f4ef', tie: '#a5d63c', pin: '#a5d63c', h: 1.0, w: 1.03,
  },
  tibi: {
    skin: '#c99870', hair: { style: 'part', color: '#3a3a44' }, stache: '#2a2320', glasses: { shape: 'rect', color: '#2a2a33' },
    suit: '#3a2f4a', shirt: '#ffffff', tie: '#e05fb4', pin: '#e05fb4', h: 0.98, w: 1.0,
  },
  regev: {
    skin: '#f2c6a0', hair: { style: 'wavy', color: '#c9a26a' }, browColor: '#7a5a30', earring: '#ffd24a',
    suit: '#8b1e3f', shirt: '#fff4f6', pin: '#ffd24a', h: 0.97, w: 0.92, open: true, head: 1.0,
  },
  edelstein: {
    skin: '#eec2a0', hair: { style: 'sides', color: '#b7bcc7' }, glasses: { shape: 'round', color: '#3a3a44' }, browColor: '#7d828d',
    suit: '#2b3f66', shirt: '#ffffff', tie: '#2155e0', pin: '#2155e0', h: 0.98, w: 1.0,
  },
};

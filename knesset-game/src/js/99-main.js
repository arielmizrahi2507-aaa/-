// ===== Bootstrap =====
function simMatch(idA, idB, opt = {}) {
  const seed = opt.seed || 1;
  const fa = new Fighter(ROSTER_BY_ID[idA], 0, { ctrl: makeCtrl(opt.la === undefined ? 0.7 : opt.la, seed * 2 + 1) });
  const fb = new Fighter(ROSTER_BY_ID[idB], 1, { ctrl: makeCtrl(opt.lb === undefined ? 0.7 : opt.lb, seed * 2 + 2) });
  const dmg = {}, cnt = {}, starts = {};
  const tally = (id, key, d) => { const k = id + ':' + key; dmg[k] = (dmg[k] || 0) + d; cnt[k] = (cnt[k] || 0) + 1; };
  const B = new Battle({ fighters: [fa, fb], stage: opt.stage || 'plenum', rounds: 2, time: opt.time || 60, seed, attract: true, noHud: true,
    onEvent: (n, a, b, c, d, e) => { if (n === 'hit') tally(a.def.id, e || 'x', d); } });
  for (const f of [fa, fb]) {
    const orig = f.startMove.bind(f);
    f.startMove = (mv, key) => { const k = f.def.id + ':' + key; starts[k] = (starts[k] || 0) + 1; return orig(mv, key); };
    const origSuper = null;
  }
  let frames = 0;
  const issues = [];
  while (!B.over && frames < 60 * 60 * 5) {
    B.update(); frames++;
    for (const f of B.f) {
      if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.hp) || !isFinite(f.meter)) { issues.push('NaN ' + f.def.id + ' f' + frames + ' st=' + f.st); return { issues, frames, winner: -2 }; }
    }
  }
  return { winner: B.matchWinner, frames, wins: B.wins.slice(), hp: [Math.round(fa.hp), Math.round(fb.hp)], issues, over: B.over, stats: B.stats, dmg, cnt, starts };
}

if (/[?&]debug/.test(location.search)) {
  window.KS = { SFX, TRACKS, Brain, ROSTER, EXTRA, ROSTER_BY_ID, Battle, Fighter, makeCtrl, simMatch, STAGES, Stages, Snd, Fx, IN, drawFighter, poseOf, Game, UI, Save, W, H };
  // deterministic screenshot helpers
  KS.mk = (a, b, stage, opt = {}) => {
    const fa = new Fighter(ROSTER_BY_ID[a], 0, { ctrl: opt.ca || makeCtrl(0.7, 11) });
    const fb = new Fighter(ROSTER_BY_ID[b], 1, { ctrl: opt.cb || makeCtrl(0.7, 12) });
    KS.B = new Battle({ fighters: [fa, fb], stage, rounds: 2, time: 60, seed: opt.seed || 7 });
    return KS.B;
  };
  KS.cv = document.getElementById('cv');
  KS.run = (n) => { for (let i = 0; i < n; i++) KS.B.update(); };
  KS.draw = () => { const c = KS.cv.getContext('2d'); c.setTransform(KS.cv.width / W, 0, 0, KS.cv.height / H, 0, 0); c.clearRect(0, 0, W, H); KS.B.render(c); Stages.vignette(c); };
}

Game.init();

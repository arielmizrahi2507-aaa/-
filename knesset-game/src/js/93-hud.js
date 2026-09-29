// ===== HUD: mandate bars, hype meter, cooldowns, timer, combo counter, announcer =====
const Hud = {
  draw(ctx, B, cine) {
    const [a, b] = B.f;
    this.bar(ctx, B, a, 0);
    this.bar(ctx, B, b, 1);
    this.timer(ctx, B);
    this.combos(ctx, B);
    if (!cine) this.announce(ctx, B);
    this.hint(ctx, B);
  },

  bar(ctx, B, f, s) {
    const dir = s === 0 ? 1 : -1;
    const x0 = s === 0 ? 92 : W - 92, y = 24, len = 350, h = 24, sl = 16;
    const pct = clamp(f.hp / f.maxHp, 0, 1), ghost = clamp(B.dmgGhost[s], 0, 1);
    const party = PARTIES[f.def.party];
    const col = f.def.color;

    // frame
    ctx.save();
    const poly = (frac) => {
      const L = len * frac;
      ctx.beginPath();
      ctx.moveTo(x0, y); ctx.lineTo(x0 + dir * L, y); ctx.lineTo(x0 + dir * (L - sl * Math.min(1, frac * 6)), y + h); ctx.lineTo(x0, y + h); ctx.closePath();
    };
    poly(1); ctx.fillStyle = 'rgba(12,6,32,.78)'; ctx.fill();
    ctx.save(); poly(1); ctx.clip();
    poly(ghost); ctx.fillStyle = '#ffffff'; ctx.fill();
    const hue = 8 + 112 * Math.pow(pct, 0.85);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `hsl(${hue},95%,68%)`); g.addColorStop(1, `hsl(${hue},85%,42%)`);
    poly(pct); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(Math.min(x0, x0 + dir * len), y + 2, len, 5);
    ctx.restore();
    poly(1); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    poly(1); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
    // numeric mandates
    T(ctx, String(Math.ceil(f.hp)), x0 + dir * 22, y + h / 2 + 1, { size: 16, fill: '#fff', stroke: OUT, lw: 4, align: s === 0 ? 'left' : 'right', font: 'disp' });
    T(ctx, 'מנדטים', x0 + dir * (len - 34), y + h / 2 + 1, { size: 11, fill: 'rgba(255,255,255,.75)', align: s === 0 ? 'right' : 'left', weight: 800 });
    ctx.restore();

    // portrait
    const px = s === 0 ? 46 : W - 46;
    const low = f.hurtPct < 0.3;
    drawPortrait(ctx, f.def, px, 46, 34, { bg: darken(col, 0.5), ring: col, lw: 5, eyes: f.st === 'ko' ? 'ko' : low ? 'hurt' : (f.st === 'hit' || f.st === 'airhit' ? 'hurt' : 'open'), mouth: f.st === 'hit' || f.st === 'airhit' ? 'shout' : (low ? 'sad' : 'smile'), flip: s === 1, zoom: 1.05 });

    // name + party
    const nx = x0, ny = y + h + 16;
    const align = s === 0 ? 'left' : 'right';
    T(ctx, f.def.name, nx, ny, { size: 17, fill: '#fff', stroke: OUT, lw: 5, align, font: 'disp' });
    ctx.font = `700 17px ${FONT.disp}`;
    ctx.direction = 'rtl';
    const nameW = ctx.measureText(f.def.name).width;
    const cxp = nx + dir * (nameW + 14);
    rr(ctx, s === 0 ? cxp : cxp - 76, ny - 10, 76, 18, 9);
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    T(ctx, f.def.partyName, s === 0 ? cxp + 38 : cxp - 38, ny - 1, { size: 11, fill: '#fff', stroke: OUT, lw: 3, weight: 800 });

    // hype meter
    const my = ny + 14, mw = 230, mh = 11;
    const full = f.meter >= 99.9;
    ctx.save();
    ctx.beginPath(); if (s === 0) rr(ctx, x0, my, mw, mh, 5); else rr(ctx, x0 - mw, my, mw, mh, 5);
    ctx.fillStyle = 'rgba(12,6,32,.8)'; ctx.fill();
    ctx.clip();
    const fx = s === 0 ? x0 : x0 - mw * f.meter / 100;
    const mg = ctx.createLinearGradient(0, my, 0, my + mh);
    if (full) { const p = 0.5 + 0.5 * Math.sin(B.frame * 0.25); mg.addColorStop(0, lighten('#ffd23d', p * 0.5)); mg.addColorStop(1, '#ff9a1f'); }
    else { mg.addColorStop(0, '#7ce8ff'); mg.addColorStop(1, '#2f7bff'); }
    ctx.fillStyle = mg; ctx.fillRect(fx, my, mw * f.meter / 100, mh);
    ctx.restore();
    ctx.beginPath(); if (s === 0) rr(ctx, x0, my, mw, mh, 5); else rr(ctx, x0 - mw, my, mw, mh, 5);
    ctx.lineWidth = 2.5; ctx.strokeStyle = full ? '#ffe14a' : OUT; ctx.stroke();
    if (full) T(ctx, '!סופר מוכן', s === 0 ? x0 + mw + 8 : x0 - mw - 8, my + mh / 2 + 1, { size: 13, fill: '#ffe14a', stroke: OUT, lw: 4, align: s === 0 ? 'left' : 'right', font: 'disp' });

    // cooldown icons
    const cy = my + 20;
    [['sp1', f.moves.sp1], ['sp2', f.moves.sp2]].forEach(([k, m], i) => {
      if (!m) return;
      const ix = x0 + dir * (i * 36) + (s === 0 ? 0 : -30);
      const ready = f.cd[k] <= 0 && f.tm.silence <= 0;
      ctx.save();
      rr(ctx, ix, cy, 30, 30, 7); ctx.fillStyle = ready ? 'rgba(255,255,255,.92)' : 'rgba(60,50,90,.85)'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(ix, cy, 30, 30); ctx.clip();
      ctx.globalAlpha = ready ? 1 : 0.45;
      drawEnt(ctx, m.icon || 'star', ix + 15, cy + 15, { sc: (ICON_SC[m.icon] || 0.5) * 0.85, t: B.frame, h: 70, r: 70 });
      ctx.globalAlpha = 1;
      if (!ready && f.cd[k] > 0) { const fr = clamp(f.cd[k] / (m.cd * (f.mods.cd || 1)), 0, 1); ctx.fillStyle = 'rgba(10,5,30,.6)'; ctx.fillRect(ix, cy, 30, 30 * fr); }
      ctx.restore();
      rr(ctx, ix, cy, 30, 30, 7); ctx.lineWidth = 3; ctx.strokeStyle = ready ? col : OUT; ctx.stroke();
      if (f.tm.silence > 0) { ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ix + 5, cy + 5); ctx.lineTo(ix + 25, cy + 25); ctx.moveTo(ix + 25, cy + 5); ctx.lineTo(ix + 5, cy + 25); ctx.stroke(); }
      ctx.restore();
    });
    // status pips
    const st = [];
    if (f.tm.slow > 0) st.push(['#7fb6ff', 'איטי']);
    if (f.tm.silence > 0) st.push(['#ff8aa0', 'שקט']);
    if (f.tm.dmgUp > 0) st.push(['#ff8a3d', 'כוח']);
    if (f.tm.defUp > 0 || f.tm.iron > 0) st.push(['#c3ccd9', 'שריון']);
    if (f.tm.haste > 0) st.push(['#7dff9a', 'זריז']);
    if (f.val.shield > 0) st.push(['#ffd94a', 'מגן']);
    st.forEach(([c2, label], i) => {
      const sx = x0 + dir * (86 + i * 50) + (s === 0 ? 0 : -46);
      rr(ctx, sx, cy + 6, 46, 18, 9); ctx.fillStyle = c2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      T(ctx, label, sx + 23, cy + 15.5, { size: 11, fill: '#1b1330', weight: 900 });
    });
    // passive-specific gauge (e.g. stacks)
    if (f.passive.hud) f.passive.hud(ctx, f, x0, cy + 38, dir, s);
  },

  timer(ctx, B) {
    const cx = W / 2, cy = 46;
    const secs = B.training ? '∞' : String(Math.max(0, Math.ceil(B.timeLeft / 60)));
    const low = !B.training && B.timeLeft < 600 && B.phase === 'fight';
    const p = low ? 1 + Math.sin(B.frame * 0.3) * 0.06 : 1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(p, p);
    ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU);
    const g = ctx.createRadialGradient(0, -8, 4, 0, 0, 34); g.addColorStop(0, '#3a2a7a'); g.addColorStop(1, '#150c38');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = low ? '#ff5a5a' : '#ffd23d'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
    if (!B.training) {
      const fr = B.timeLeft / B.timeMax;
      ctx.lineWidth = 4; ctx.strokeStyle = low ? '#ff5a5a' : '#fff'; ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + TAU * fr); ctx.stroke();
    }
    T(ctx, secs, 0, 2, { size: 30, font: 'disp', fill: low ? '#ff8a8a' : '#fff', stroke: OUT, lw: 6 });
    ctx.restore();
    // round pips
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < B.rtw; i++) {
        const px = W / 2 + (s === 0 ? -1 : 1) * (52 + i * 18), py = 82;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU);
        ctx.fillStyle = B.wins[s] > i ? '#ffd23d' : 'rgba(12,6,32,.7)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
      }
    }
  },

  combos(ctx, B) {
    B.combo.forEach((c, i) => {
      if (c.hits < 2 || c.show <= 0) return;
      const left = i === 0;
      const x = left ? 110 : W - 110, y = 190;
      const k = Math.min(1, (100 - c.show) / 6);
      const sc = 1 + (1 - k) * 0.7;
      const col = c.hits >= 8 ? '#ff5a5a' : c.hits >= 5 ? '#ffa03d' : '#ffe14a';
      const a = c.show < 20 ? c.show / 20 : 1;
      ctx.save(); ctx.globalAlpha = a;
      T(ctx, String(c.hits), x, y, { size: 74, font: 'disp', fill: col, stroke: OUT, lw: 14, scale: sc, rot: left ? -0.08 : 0.08 });
      T(ctx, 'קומבו', x, y + 42, { size: 26, font: 'disp', fill: '#fff', stroke: OUT, lw: 8, rot: left ? -0.08 : 0.08 });
      T(ctx, 'נזק ' + Math.ceil(c.dmg), x, y + 68, { size: 16, fill: '#fff', stroke: OUT, lw: 5 });
      ctx.restore();
    });
  },

  // First-run key reminder (keyboard players only)
  hint(ctx, B) {
    if (!B.cfg.hint || B.phase !== 'fight' || B.phaseT > 60 * 16) return;
    const a = Math.min(1, (60 * 16 - B.phaseT) / 40);
    ctx.save();
    ctx.globalAlpha = 0.92 * a;
    rr(ctx, W / 2 - 390, H - 86, 780, 64, 14); ctx.fillStyle = 'rgba(10,5,30,.78)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    T(ctx, 'תנועה: A D · קפיצה: W · התכופפות: S · חסימה: I', W / 2, H - 66, { size: 16, fill: '#ffffff', weight: 700 });
    T(ctx, 'אגרוף: J · בעיטה: K · מיוחד 1: L · מיוחד 2: U · סופר: O · זריקה: E', W / 2, H - 42, { size: 16, fill: '#ffe14a', weight: 700 });
    ctx.restore();
  },

  announce(ctx, B) {
    const a = B.announce;
    if (!a || !a.text) return;
    const k = a.t / a.max;
    const sc = a.t < 8 ? 1.7 - 0.7 * Ease.outBack(a.t / 8) : 1;
    const al = k > 0.85 ? (1 - k) / 0.15 : 1;
    T(ctx, a.text, W / 2, 152, { size: a.size, font: 'disp', fill: a.col, stroke: OUT, lw: a.size * 0.2, alpha: al, scale: sc, shadow: 'rgba(0,0,0,.35)', shadowY: a.size * 0.1 });
  },
};

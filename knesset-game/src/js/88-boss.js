// ===== The secret boss (the electoral threshold, a walking ballot box) + roster registry =====
LOOKS.threshold = { robot: true, skin: '#eef2fb', hair: { style: 'none', color: '#888' }, suit: '#2a5cd0', pants: '#4b5468', shirt: '#dfe6f5', shoes: '#2b2f3d', h: 1.0, w: 1.3 };

const EXTRA = [
  fighterDef({
    id: 'threshold', boss: true, name: 'אחוז החסימה', short: 'אחוז החסימה', party: 'neutral', title: '3.25%', arch: 'בוס', role: 'הסף שכל רשימה צריכה לעבור (3.25%)', scale: 1.22, unlock: { arcade: true, text: 'סיימו מסע שלם' },
    blurb: 'קלפי מהלכת. מתעלמת ממכות קטנות: מתחת לסף, כלומר בלי השפעה.',
    stats: { hp: 160, spd: 0.86, pow: 1.05, meter: 0.7 }, rating: { pow: 5, spd: 2, def: 5, rng: 3, dif: 3 },
    ai: { style: 'tank', space: 170 },
    passive: {
      id: 'threshold', name: 'מתחת לסף', desc: 'מכות של פחות מ-4.5 נזק נספגות ב-65%.',
      dmgIn(f, info) { return (info.dmg || 0) < 4.5 ? 0.35 : 1; },
    },
    normals: {
      L: ['נגיחת קלפי', 'jab', { dmg: 5, hb: [26, -150, 84, 46] }],
      H: ['מכת פנקס', 'cross', { dmg: 11, startup: 12, hb: [26, -136, 100, 56] }],
      FH: ['ריסוק תיבה', 'slam', { dmg: 12 }],
      DL: ['סחיפה', 'lowkick'],
      DH: ['הרמה', 'uppercut'],
    },
    sp1: SP({
      name: 'גשם פתקים', desc: 'שבעה פתקי הצבעה נופלים סביב היריב.', icon: 'ballot', frames: 60, anim: 'summon', cd: 220, ai: { min: 120, max: 700, kind: 'zone' },
      tick(f, t, B) {
        if (t >= 12 && t < 40 && t % 4 === 0) {
          const o = f.opp;
          B.ent({ kind: 'ballot', owner: f, dir: f.face, x: clamp(o.x + (B.rng() * 2 - 1) * 240, WALL_L, WALL_R), y: -40, vy: 8.5 + B.rng() * 3, w: 44, h: 54, dmg: 5, hitstun: 20, blockstun: 10, kx: 3, life: 90, clash: false, z: 1 });
        }
      },
    }),
    sp2: spDash({
      name: 'טעינה', desc: 'דהירה עם שריון ומכה שמפילה.', icon: 'fist', startup: 10, dashFrames: 18, recovery: 18, vx: 9.5, cd: 230, dmg: 12, hitstun: 30, kx: 9, knockdown: true, armor: 1, armorUntil: 28, hb: [-6, -170, 130, 170],
      ai: { min: 120, max: 460, kind: 'gap' },
    }),
    sup: SP({
      name: 'מתחת לאחוז החסימה', desc: 'חומת קלפיות שוטפת את כל המסך ומועכת את כולם.', icon: 'ballot', frames: 100, anim: 'buff', glow: '#4a8bff', invAfter: 30,
      ai: { min: 0, max: 900, kind: 'zone' },
      tick(f, t, B) {
        if (t < 50) f.inv = Math.max(f.inv, 2);
        if (t === 14) {
          Snd.play('boom'); Fx.text(f.x, f.y - 250, '!מתחת לסף', { size: 30, col: '#8fc4ff', life: 60 });
          B.ent({ kind: 'shadow', owner: f, dir: f.face, x: f.x - f.face * 260, y: GROUND - 130, vx: f.face * 9, w: 240, h: 270, dmg: 34, hitstun: 54, blockstun: 22, kx: 9, ky: -10, knockdown: true, life: 220, pierce: true, interval: 999, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 12,
            onTick(e) { if (e.t % 5 === 0) Fx.shake(4); },
            draw(ctx, e) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = -78 + c * 78, y = -110 + r * 88; rr(ctx, x - 32, y - 34, 64, 68, 8); ctx.fillStyle = '#2a5cd0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); rr(ctx, x - 22, y - 30, 44, 8, 3); ctx.fillStyle = '#eef2fb'; ctx.fill(); T(ctx, '3.25', x, y + 8, { size: 16, font: 'disp', fill: '#fff', stroke: OUT, lw: 4 }); } } });
        }
      },
    }),
    quotes: { intro: ['!אף אחד לא עובר אותי', '!מתחת לסף? החוצה'], win: ['!הקולות שלך הלכו לפח'], lose: ['!שוב ירדתי מתחת לסף'] },
    ending: 'כל הקולות נספרו, וסוף סוף מישהו עבר את הסף.',
  }),
];

ROSTER.forEach((d) => { ROSTER_BY_ID[d.id] = d; });
EXTRA.forEach((d) => { ROSTER_BY_ID[d.id] = d; });

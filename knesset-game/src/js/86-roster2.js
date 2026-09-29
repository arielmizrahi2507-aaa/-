// ===== Unlockables: the Speaker + the secret boss (the electoral threshold, a walking ballot box) =====
LOOKS.threshold = { robot: true, skin: '#eef2fb', hair: { style: 'none', color: '#888' }, suit: '#2a5cd0', pants: '#4b5468', shirt: '#dfe6f5', shoes: '#2b2f3d', h: 1.0, w: 1.3 };

const EXTRA = [
  fighterDef({
    id: 'edelstein', name: 'יולי אדלשטיין', short: 'אדלשטיין', party: 'likud', title: 'יושב הראש', arch: 'שופט', unlock: { wins: 10, text: 'נצחו 10 קרבות' },
    blurb: 'שולט באולם. כל פגיעה חמישית מסמנת "לסדר!" ומשתיקה את היכולות של היריב.',
    stats: { hp: 128, spd: 0.98, pow: 1.09 }, rating: { pow: 3, spd: 3, def: 3, rng: 3, dif: 3 },
    ai: { style: 'balanced', space: 220 },
    passive: {
      id: 'order', name: 'קורא לסדר', desc: 'כל פגיעה חמישית משתיקה את יכולות היריב לשלוש שניות.',
      onDealt(f, def) {
        f.pv.n = (f.pv.n || 0) + 1;
        if (f.pv.n >= 5) {
          f.pv.n = 0; def.tm.silence = Math.max(def.tm.silence, 180);
          Fx.text(def.x, def.y - 215, '!לסדר', { size: 32, col: '#ffe14a', life: 60 }); Fx.ring(def.x, def.y - 100, 10, 110, 'rgba(255,225,74,.9)', 20, 6); Snd.play('toast');
        }
      },
      hud(ctx, f, x, y, dir, s) { hudPips(ctx, f, x, y, dir, s, f.pv.n || 0, 5, '#ffe14a', 'סדר'); },
    },
    normals: {
      L: ['מכת פטיש קטנה', 'jab', { prop: 'gavel' }],
      H: ['בעיטה פרוצדורלית', 'kick'],
      FH: ['הצבעה בקול', 'swing', { prop: 'gavel', dmg: 10, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['הערת ביניים', 'lowkick'],
      DH: ['תקנון', 'uppercut'],
    },
    sp1: spCast({
      name: 'הכרעה בפטיש', desc: 'גל פטיש שנע על הרצפה ומעיף את מי שבדרכו.', icon: 'gavel', frames: 34, release: 13, cd: 190,
      ai: { min: 140, max: 640, kind: 'zone' },
      shots: [{ kind: 'horn', ox: 40, oy: -70, vx: 8.5, w: 72, h: 120, dmg: 9, hitstun: 24, blockstun: 14, kx: 8, ky: -5, life: 80, height: 'mid', dur: 2 }],
    }),
    sp2: SP({
      name: 'קריאה לסדר', desc: 'פטיש על השולחן: דוחף את היריב ומשתיק את היכולות שלו לארבע שניות.', icon: 'hand', frames: 36, release: 13, cd: 320, anim: 'slam', ai: { min: 0, max: 230, kind: 'close' },
      tick(f, t, B) {
        if (t !== 13) return;
        Snd.play('boom'); Fx.shake(7); Fx.ring(f.x + f.face * 40, GROUND - 6, 10, 170, 'rgba(255,225,74,.95)', 18, 8);
        Fx.text(f.x + f.face * 90, f.y - 205, '!לסדר', { size: 34, col: '#ffe14a', life: 46 });
        const o = f.opp, dx = (o.x - f.x) * f.face;
        if (dx > -30 && dx < 240) B.hit(f, o, { dmg: 5, hitstun: 24, blockstun: 12, kx: 9, silence: 240, hitstop: 7, height: 'mid', chip: 0.1 }, { x: f.x + f.face * 60, y: f.y - 100, vx: 0 }, null);
      },
    }),
    sup: SP({
      name: 'סגירת מליאה', desc: 'שני שערי עץ ענקיים נטרקים מהצדדים ומועכים את מי שבאמצע.', icon: 'gavel', frames: 100, anim: 'slam', glow: '#c98a4a', invAfter: 30,
      ai: { min: 0, max: 700, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 60) f.inv = Math.max(f.inv, 2);
        if (t === 8) f.mi.cx = clamp(o.x, WALL_L + 130, WALL_R - 130);
        if (t === 10) {
          Snd.play('boom');
          const cx = f.mi.cx;
          [-1, 1].forEach((sd) => B.ent({ kind: 'door', owner: f, dir: f.face, x: cx + sd * 620, y: GROUND - 150, vx: -sd * 30, w: 120, h: 300, dmg: 0, noHit: true, life: 44, z: 1, isProj: false, clash: false, noFlip: true,
            onTick(e) { if (Math.abs(e.x - cx) <= 64) { e.vx = 0; e.x = cx + sd * 64; } },
            draw(ctx) { rr(ctx, -60, -150, 120, 300, 8); ctx.fillStyle = '#8a5a34'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -140); ctx.lineTo(-20, 140); ctx.moveTo(20, -140); ctx.lineTo(20, 140); ctx.stroke(); ctx.fillStyle = '#e2b84a'; ctx.beginPath(); ctx.arc(-sd * 40, 0, 9, 0, TAU); ctx.fill(); ctx.stroke(); } }));
        }
        if (t === 31) {
          const cx = f.mi.cx;
          Fx.shake(16); Fx.flash('#ffe6b0', 0.5); Snd.play('superHit'); Fx.dust(cx, GROUND, 0, 12);
          if (Math.abs(o.x - cx) < 140 && o.hurtable()) B.hit(f, o, superInfo({ dmg: 33, hitstun: 50, kx: 3, ky: -9, knockdown: true, hitstop: 14, chip: 0.3 }), { x: cx, y: o.y - 90, vx: 0 }, null);
          else Fx.text(cx, GROUND - 200, '!לא נתפס', { size: 26, col: '#ffe6b0', life: 50 });
        }
      },
    }),
    quotes: { intro: ['!אני מבקש סדר באולם', '!ההצבעה נפתחת'], win: ['!הישיבה ננעלה'], lose: ['!אבקש הפסקה'] },
    ending: 'הפטיש יורד, הישיבה ננעלת, ואפילו הרמקולים מבקשים רשות דיבור.',
  }),

  fighterDef({
    id: 'threshold', boss: true, name: 'אחוז החסימה', short: 'אחוז החסימה', party: 'neutral', title: '3.25%', arch: 'בוס', scale: 1.22, unlock: { arcade: true, text: 'סיימו מסע שלם' },
    blurb: 'קלפי מהלכת. מתעלמת ממכות קטנות: מתחת לסף, כלומר בלי השפעה.',
    stats: { hp: 175, spd: 0.86, pow: 1.1, meter: 0.7 }, rating: { pow: 5, spd: 2, def: 5, rng: 3, dif: 3 },
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
EXTRA.forEach((d) => { ROSTER_BY_ID[d.id] = d; });

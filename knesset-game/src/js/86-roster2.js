// ===== Roster, part 2: the Speaker, Gotliv, Bennett, Eisenkot and Asher =====
// Same rules as 85-roster.js: invented moves and nicknames, factual party and role lines only.

ROSTER.push(
  // ============================================================================ אוחנה
  fighterDef({
    id: 'ohana', name: 'אמיר אוחנה', short: 'אוחנה', party: 'likud', title: 'יושב הראש', arch: 'שופט', role: 'יושב ראש הכנסת · הליכוד',
    blurb: 'שולט באולם. כל פגיעה חמישית מסמנת "לסדר!" ומשתיקה את היכולות של היריב.',
    stats: { hp: 132, spd: 0.98, pow: 1.08 }, rating: { pow: 3, spd: 3, def: 3, rng: 3, dif: 3 },
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

  // ============================================================================ גוטליב
  fighterDef({
    id: 'gotliv', name: 'טלי גוטליב', short: 'גוטליב', party: 'otzma', title: 'הלהבה', arch: 'לוהטת', role: 'חברת כנסת · מס׳ 2 ברשימת עוצמה יהודית (עברה מהליכוד)',
    blurb: 'נאום בוער ולשון שמדליקה את המליאה. כל יכולת מיוחדת שפוגעת מציתה את היריב.',
    stats: { hp: 118, spd: 1.06, pow: 1.03 }, rating: { pow: 3, spd: 4, def: 2, rng: 3, dif: 3 },
    ai: { style: 'rush', space: 180 },
    passive: {
      id: 'blaze', name: 'להבה', desc: 'יכולת מיוחדת שפוגעת מציתה את היריב לארבע שניות: הוא מאבד מנדטים בכל שנייה (לא מספיק כדי להפיל).',
      onDealt(f, def, info) {
        const key = info.srcKey || f.mk;
        if (key === 'sp1' || key === 'sp2' || key === 'sup') {
          if (def.burnT <= 0) Fx.text(def.x, def.y - 215, '!בוער', { size: 22, col: '#ff8a3d', life: 40 });
          def.burnT = 240; Fx.glowDots(def.x, def.y - 110, 8, '#ff7a2a', 4);
        }
      },
    },
    normals: {
      L: ['סטירה מילולית', 'jab', { startup: 4, dmg: 3.9 }],
      H: ['בעיטת ביקורת', 'kick', { dmg: 9.2 }],
      FH: ['אצבע מאשימה', 'point', { dmg: 10, startup: 16, hb: [24, -196, 96, 130] }],
      DL: ['הערה נמוכה', 'lowkick'],
      DH: ['נאום פתיחה', 'uppercut'],
    },
    sp1: spCast({
      name: 'ציוץ בוער', desc: 'כדור להבות מהיר. מדליק את מי שנפגע.', icon: 'flame', frames: 30, release: 11, cd: 170, sfx: 'zap',
      ai: { min: 160, max: 760, kind: 'zone' },
      shots: [{ kind: 'flame', ox: 44, oy: -128, vx: 10.5, w: 58, h: 42, dmg: 7.4, hitstun: 18, blockstun: 11, kx: 4, life: 80, chip: 0.1,
        onTick(e) { if (e.t % 3 === 0) Fx.glowDots(e.x - e.dir * 22, e.y, 1, '#ff7a2a', 2); } }],
    }),
    sp2: spBuff({
      name: 'הרמת קול', desc: 'צעקה שמציתה את המליאה: שש שניות של +24% נזק ומהירות גבוהה יותר.', icon: 'horn', frames: 32, release: 12, cd: 460, glow: '#ff7a2a', label: '!הרמת קול',
      apply(f) { f.tm.dmgUp = 360; f.val.dmgUpMul = 1.24; f.tm.haste = 360; },
    }),
    sup: SP({
      name: 'נאום הבערה', desc: 'גל עמודי אש דוהר על הרצפה קדימה, ולבסוף עמוד ענק על היריב. מדליק.', icon: 'flame', frames: 122, anim: 'summon', glow: '#ff7a2a', invAfter: 40,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 66) f.inv = Math.max(f.inv, 2);
        if (t === 8) { Snd.play('boom'); Fx.text(f.x, f.y - 240, '!נאום בוער', { size: 28, col: '#ffb14a', life: 60 }); Fx.flash('#ff9a4a', 0.4); }
        for (let i = 0; i < 7; i++) {
          if (t !== 14 + i * 5) continue;
          const x = clamp(f.x + f.face * (100 + i * 105), WALL_L, WALL_R);
          B.ent({ kind: 'firepillar', owner: f, dir: f.face, x, y: GROUND - 110, w: 84, h: 220, dmg: 5.5, hitstun: 22, blockstun: 12, kx: 2, life: 26, isSuper: true, chip: 0.25, clash: false, z: 1, hitstop: 4, noFlip: true });
          Fx.dust(x, GROUND, 0, 3); if (i % 2 === 0) Snd.play('zap');
        }
        if (t === 46) {
          f.mi.fx = clamp(o.x, WALL_L, WALL_R);
          Fx.ring(f.mi.fx, GROUND - 4, 10, 100, 'rgba(255,120,40,.95)', 22, 7); Fx.text(f.mi.fx, GROUND - 190, '!זזו', { size: 24, col: '#ff8a3d', life: 30 });
        }
        if (t === 66) {
          B.ent({ kind: 'firepillar', owner: f, dir: f.face, x: f.mi.fx, y: GROUND - 200, w: 120, h: 400, dmg: 14, hitstun: 44, blockstun: 18, kx: 6, ky: -10, knockdown: true, life: 30, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 10, noFlip: true });
          Snd.play('boom'); Fx.shake(9);
        }
      },
    }),
    quotes: { intro: ['!עכשיו זה יישרף', '!הקול שלי חוצה קירות'], win: ['!נשרף להם הפיוז'], lose: ['!אחזור בקול רם יותר'] },
    ending: 'הנאום נגמר, המליאה עדיין מעשנת, והמטפים בפינה כבר ביקשו חופשה.',
  }),

  // ============================================================================ בנט
  fighterDef({
    id: 'bennett', name: 'נפתלי בנט', short: 'בנט', party: 'byachad', title: 'האקזיט', arch: 'יזם', role: 'יו״ר ביחד · ראש ממשלה לשעבר',
    blurb: 'מפתח מהר וטוען יכולות מהר. סטארט־אפ אחד אחרי השני, ורק האקזיט לא מתמהמה.',
    stats: { hp: 114, spd: 1.05, pow: 0.98 }, rating: { pow: 3, spd: 4, def: 2, rng: 4, dif: 3 },
    ai: { style: 'zone', space: 300 },
    passive: { id: 'sprint', name: 'קצב פיתוח', desc: 'היכולות המיוחדות שלו נטענות 35% מהר יותר.', cdRate() { return 1.35; } },
    normals: {
      L: ['ג׳אב קומנדו', 'jab', { startup: 4, dmg: 3.9 }],
      H: ['בעיטת סיירת', 'highkick', { dmg: 8.8, startup: 10 }],
      FH: ['מכת מצגת', 'swing', { prop: 'folder', dmg: 9.6, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['זחילה קרבית', 'lowkick'],
      DH: ['זינוק לאקזיט', 'uppercut'],
    },
    sp1: spCast({
      name: 'מצגת משקיעים', desc: 'שתי שקופיות מהירות ברצף: אחת גבוהה ואחת בגובה החזה.', icon: 'slide', frames: 36, cd: 150,
      ai: { min: 170, max: 780, kind: 'zone' },
      shots: [
        { kind: 'slide', ox: 40, oy: -150, vx: 12, w: 52, h: 38, dmg: 5.4, hitstun: 17, blockstun: 10, kx: 3, life: 70, at: 11 },
        { kind: 'slide', ox: 40, oy: -108, vx: 12, w: 52, h: 38, dmg: 5.4, hitstun: 17, blockstun: 10, kx: 3, life: 70, n: 1, at: 21 },
      ],
    }),
    sp2: spBuff({
      name: 'סבב גיוס', desc: 'מגייס הון: ממלא 35 הייפ ומרפא מעט.', icon: 'bill', frames: 34, release: 12, cd: 520, glow: '#19c6b7', label: '!סבב גיוס',
      apply(f) { f.gain(35); f.heal(9); },
    }),
    sup: SP({
      name: 'עדר יוניקורנים', desc: 'חמישה יוניקורנים דוהרים דרך האולם בזה אחר זה. האחרון מעיף.', icon: 'unicorn', frames: 116, anim: 'summon', glow: '#a06bff', invAfter: 40,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 66) f.inv = Math.max(f.inv, 2);
        if (t === 6) Fx.text(f.x, f.y - 235, '!יוניקורן', { size: 28, col: '#e6d4ff', life: 60 });
        [12, 22, 32, 42, 54].forEach((at, i) => {
          if (t !== at) return;
          const last = i === 4;
          B.ent({ kind: 'unicorn', owner: f, dir: f.face, x: f.x - f.face * 560, y: GROUND - 58 - (i % 2) * 8, vx: f.face * (15 + i), w: 150, h: 112, sc: last ? 1.15 : 0.88, dmg: last ? 12 : 7, hitstun: 26, blockstun: 14, kx: 5, ky: last ? -9 : 0, knockdown: last, life: 200, pierce: true, interval: 999, isSuper: true, chip: 0.25, clash: false, z: 1, hitstop: 6,
            onTick(e) { if (e.t % 4 === 0) Fx.stars(e.x - e.dir * 60, e.y - 6, 1, ['#ff5a7a', '#ffe14a', '#5cd67a', '#4aa8ff'][(e.t >> 2) % 4], 2); } });
          if (i === 0) Snd.play('dash');
        });
      },
    }),
    quotes: { intro: ['!בואו נעשה אקזיט', '!יש לי תוכנית לתשעים יום'], win: ['!האקזיט הושלם'], lose: ['!נגייס עוד סבב'] },
    ending: 'החברה נמכרה, הכסף הועבר, והיוניקורנים כבר מבקשים את הסבב הבא.',
  }),

  // ============================================================================ איזנקוט
  fighterDef({
    id: 'eisenkot', name: 'גדי איזנקוט', short: 'איזנקוט', party: 'yashar', title: 'הקו הישר', arch: 'מתכנן', role: 'יו״ר ישר! · הרמטכ״ל לשעבר',
    blurb: 'סבלני, מדויק ולא ממהר. כשהוא נותן לקרב לנשום, המנדטים חוזרים אליו.',
    stats: { hp: 126, spd: 0.98, pow: 1.03, def: 0.98 }, rating: { pow: 3, spd: 3, def: 4, rng: 3, dif: 3 },
    ai: { style: 'balanced', space: 220 },
    passive: {
      id: 'calm', name: 'קור רוח', desc: 'אחרי שתי שניות וחצי בלי לספוג מכה הוא מחלים לאט, עד שיחזור להיפגע.',
      tick(f) {
        f.pv.calm = (f.pv.calm || 0) + 1;
        if (f.pv.calm > 150 && f.hp > 0 && f.hp < f.maxHp && f.B.phase === 'fight') f.hp = Math.min(f.maxHp, f.hp + 0.05);
      },
      onTaken(f) { f.pv.calm = 0; },
      aura(f) { return (f.pv.calm || 0) > 150 && f.hp > 0 && f.hp < f.maxHp ? '#7dff9a' : null; },
    },
    normals: {
      L: ['דחיפת מפקד', 'jab'],
      H: ['בעיטת מטה', 'kick', { dmg: 9.4 }],
      FH: ['מכת תוכנית', 'swing', { prop: 'map', dmg: 9.6, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['סחיפה עוקפת', 'lowkick'],
      DH: ['זינוק קדימה', 'uppercut'],
    },
    sp1: spCast({
      name: 'חץ על המפה', desc: 'חץ תנועה נמוך שסוחף את הרצפה. דורש חסימה מכופפת.', icon: 'arrow', frames: 34, release: 13, cd: 190,
      ai: { min: 160, max: 700, kind: 'zone' },
      shots: [{ kind: 'arrow', ox: 44, oy: -34, vx: 8.6, w: 110, h: 44, dmg: 8.5, hitstun: 22, blockstun: 13, kx: 8, life: 96, height: 'low', dur: 2, power: 1 }],
    }),
    sp2: spBuff({
      name: 'תדריך מפקדים', desc: 'חמש שניות של -30% נזק שנספג, ומרפא מעט.', icon: 'shieldIcon', frames: 32, release: 12, cd: 440, glow: '#18b0e0', label: '!תדריך',
      apply(f) { f.tm.defUp = 300; f.val.defUpMul = 0.7; f.heal(8); },
    }),
    sup: SP({
      name: 'תמרון מלקחיים', desc: 'שני חיצים ענקיים נסגרים על היריב מהצדדים. אי אפשר לחסום, רק לברוח.', icon: 'arrow', frames: 104, anim: 'point', glow: '#18b0e0', invAfter: 30,
      ai: { min: 0, max: 700, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 60) f.inv = Math.max(f.inv, 2);
        if (t === 8) f.mi.cx = clamp(o.x, WALL_L + 150, WALL_R - 150);
        if (t === 10) {
          Snd.play('cast');
          const cx = f.mi.cx;
          [-1, 1].forEach((sd) => B.ent({ kind: 'arrow', owner: f, dir: -sd, x: cx + sd * 640, y: GROUND - 96, vx: -sd * 27, w: 250, h: 92, col: sd < 0 ? '#e4483d' : '#3d7be4', noHit: true, dmg: 0, life: 40, z: 1, isProj: false, clash: false,
            onTick(e) { if (Math.abs(e.x - cx) <= 130) { e.vx = 0; e.x = cx + sd * 130; } } }));
        }
        if (t === 32) {
          const cx = f.mi.cx;
          Fx.shake(15); Fx.flash('#bfeaff', 0.5); Snd.play('superHit'); Fx.dust(cx, GROUND, 0, 12);
          if (Math.abs(o.x - cx) < 150 && o.hurtable()) B.hit(f, o, superInfo({ dmg: 33, hitstun: 50, kx: 3, ky: -9, knockdown: true, unblockable: true, hitstop: 14, chip: 0.3 }), { x: cx, y: o.y - 90, vx: 0 }, null);
          else Fx.text(cx, GROUND - 200, '!התמרון פוספס', { size: 24, col: '#bfeaff', life: 50 });
        }
      },
    }),
    quotes: { intro: ['!קודם תוכנית', '!נלך בקו ישר'], win: ['!המבצע הושלם'], lose: ['!נערך תחקיר'] },
    ending: 'התוכנית יצאה לפועל בדיוק לפי התדריך, כולל ההפתעות שתוכננו מראש.',
  }),

  // ============================================================================ אשר
  fighterDef({
    id: 'asher', name: 'יעקב אשר', short: 'אשר', party: 'utj', title: 'המתמיד', arch: 'סבלן', role: 'יו״ר יהדות התורה',
    blurb: 'שקדן וסבלני. בזמן שהוא מתגונן הריכוז שלו מצטבר, ובמכה הבאה הוא משחרר הכול.',
    stats: { hp: 128, spd: 0.96, pow: 1.06, def: 0.97 }, rating: { pow: 3, spd: 2, def: 4, rng: 3, dif: 3 },
    ai: { style: 'tank', space: 150 },
    passive: {
      id: 'diligence', name: 'שקידה', desc: 'כל חצי שנייה של חסימה או התכופפות מוסיפה ריכוז (עד 5). המכה הבאה שפוגעת חזקה ב-11% לכל רמה.',
      tick(f) { if (f.st === 'block' || f.st === 'blockstun' || f.st === 'crouch') f.pv.c = Math.min(5, (f.pv.c || 0) + 1 / 30); },
      dmgOut(f) { return 1 + 0.11 * Math.floor(f.pv.c || 0); },
      onDealt(f) { f.pv.c = 0; },
      aura(f) { return (f.pv.c || 0) >= 3 ? '#c9d2ff' : null; },
      hud(ctx, f, x, y, dir, s) { hudPips(ctx, f, x, y, dir, s, Math.floor(f.pv.c || 0), 5, '#c9d2ff', 'ריכוז'); },
    },
    normals: {
      L: ['טפיחה על השכם', 'jab'],
      H: ['בעיטת הפסקה', 'kick'],
      FH: ['מכת מצביע', 'chop', { dmg: 10 }],
      DL: ['הערה בשקט', 'lowkick'],
      DH: ['התרוממות', 'uppercut'],
    },
    sp1: spCast({
      name: 'הצעת חוק', desc: 'הצעה כבדה ואיטית שנשארת באוויר ופוגעת חזק. עמידה בפני קליעים קטנים.', icon: 'law', frames: 36, release: 14, cd: 200,
      ai: { min: 180, max: 720, kind: 'zone' },
      shots: [{ kind: 'law', ox: 40, oy: -125, vx: 6.6, w: 54, h: 66, dmg: 10.5, hitstun: 24, blockstun: 14, kx: 6, life: 130, dur: 2, power: 1, chip: 0.15 }],
    }),
    sp2: SP({
      name: 'שטנדר', desc: 'עמדת קריאה נטועה שחוסמת עד שלושה קליעים במשך חמש שניות.', icon: 'lectern', frames: 34, release: 12, cd: 360, anim: 'summon', glow: '#c9d2ff', ai: { min: 200, max: 760, kind: 'trap' },
      tick(f, t, B) {
        if (t !== 12) return;
        B.ents.forEach((e) => { if (e.tag === 'lectern' && e.owner === f) e.dead = true; });
        const x = clamp(f.x + f.face * 120, WALL_L + 30, WALL_R - 30);
        B.ent({ kind: 'lectern', tag: 'lectern', owner: f, dir: f.face, x, y: GROUND - 62, w: 60, h: 124, noHit: true, dmg: 0.01, life: 300, dur: 3, power: 9, isProj: true, clash: true, z: 0, noFlip: true });
        Snd.play('land'); Fx.dust(x, GROUND, 0, 6); Fx.shake(3);
      },
    }),
    sup: SP({
      name: 'אולטימטום', desc: 'ספירה לאחור: 3, 2, 1. מי שעומד על הרצפה בסוף הספירה סופג מכה שאי אפשר לחסום. אפשר לקפוץ.', icon: 'law', frames: 110, anim: 'point', glow: '#c9d2ff', invAfter: 30,
      ai: { min: 0, max: 900, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 74) f.inv = Math.max(f.inv, 2);
        const say = (n, col) => { Snd.play('tick'); Fx.text(o.x, o.y - 235, String(n), { size: 66, col, life: 22 }); Fx.ring(o.x, GROUND - 4, 12, 90, rgba(col, 0.9), 16, 5); };
        if (t === 8) say(3, '#c9d2ff');
        if (t === 26) say(2, '#ffe14a');
        if (t === 44) say(1, '#ff6a5a');
        if (t === 62) {
          Snd.play('boom'); Fx.shake(14); Fx.flash('#ffffff', 0.4);
          Fx.text(o.x, o.y - 150, '!דחוף', { size: 54, col: '#ff5a5a', life: 46, rot: -0.12 });
          if (o.grounded && o.hurtable()) B.hit(f, o, superInfo({ dmg: 32, hitstun: 50, kx: 6, ky: -9, knockdown: true, unblockable: true, hitstop: 14 }), { x: o.x, y: o.y - 100, vx: 0 }, null);
          else Fx.text(o.x, o.y - 200, '!פספסת', { size: 26, col: '#c9d2ff', life: 50 });
        }
      },
    }),
    quotes: { intro: ['!בסבלנות', '!אין מה למהר'], win: ['!הכול בא בעיתו'], lose: ['!נחזור לשולחן'] },
    ending: 'הריכוז שוחרר במכה אחת, הספסלים חיכו בסבלנות, ולראשונה אף אחד לא איחר לסגירה.',
  }),
);

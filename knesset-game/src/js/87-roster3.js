// ===== Roster, part 3: Maoz, Abu Shehadeh, Hendel and Winter =====
// Same rules as 85-roster.js: invented moves and nicknames, factual party and role lines only.

ROSTER.push(
  // ============================================================================ מעוז
  fighterDef({
    id: 'maoz', name: 'אבי מעוז', short: 'מעוז', party: 'noam', title: 'הסירוב', arch: 'עקשן', role: 'יו״ר נעם לישראל',
    blurb: 'לא זז מהעמדה. כל חסימה מחזירה לו כוח, ומקרוב הוא לוחץ יד שאי אפשר להשתחרר ממנה.',
    stats: { hp: 138, spd: 0.97, pow: 1.1, def: 0.94 }, rating: { pow: 4, spd: 2, def: 4, rng: 2, dif: 3 },
    ai: { style: 'rush', space: 110 },
    passive: {
      id: 'refusal', name: 'עמידה בסירוב', desc: 'כל חסימה מרפאה 2 מנדטים ומטעינה 4 הייפ. בלוק מושלם מרפא 5.',
      onBlock(def, att, info, perfect) { def.heal(perfect ? 5 : 2, false); def.gain(perfect ? 12 : 4); },
    },
    normals: {
      L: ['ג׳אב עיקש', 'jab', { dmg: 4.2 }],
      H: ['בעיטת סירוב', 'kick', { dmg: 9.8 }],
      FH: ['מכת הכרעה', 'slam', { dmg: 10.6 }],
      DL: ['חסימת מעבר', 'lowkick'],
      DH: ['הצהרת עקרונות', 'uppercut'],
    },
    sp1: SP({
      name: 'לחיצת יד נעימה', desc: 'זינוק קצר ותפיסה שאי אפשר לחסום: לחיצה ואז השלכה. מי שמחוץ לטווח מקבל רק אוויר.', icon: 'hand', frames: 42, release: 8, cd: 230, anim: 'shove',
      ai: { min: 0, max: 250, kind: 'close' },
      tick(f, t, B) {
        if (t < 8) { f.vx = f.face * 8.5; f.trailOn = t > 1; }
        if (t !== 8) return;
        f.vx *= 0.2;
        const o = f.opp, dx = (o.x - f.x) * f.face;
        if (dx > -20 && dx < 150 && o.grounded && o.hurtable() && o.solid()) {
          Snd.play('swingH'); Fx.text(o.x, o.y - 215, '!נעים מאוד', { size: 26, col: '#ffd7a0', life: 44 });
          B.hit(f, o, { dmg: 15, hitstun: 34, blockstun: 0, kx: 8, ky: -7, knockdown: true, unblockable: true, hitstop: 10, height: 'mid', chip: 0, isThrow: true }, { x: f.x + f.face * 60, y: f.y - 100, vx: 0 }, null);
        } else Fx.text(f.x + f.face * 70, f.y - 190, '!ידיים ריקות', { size: 20, col: '#d8c8b8', life: 34 });
      },
    }),
    sp2: SP({
      name: 'שיחה נעימה', desc: 'גל רגיעה שמאט את היריב לשלוש שניות ומרפא מעט.', icon: 'heart', frames: 36, release: 12, cd: 300, anim: 'cast', ai: { min: 80, max: 340, kind: 'zone' },
      tick(f, t, B) {
        if (t !== 12) return;
        const o = f.opp; Snd.play('heal');
        Fx.ring(f.x, f.y - 90, 10, 320, 'rgba(255,215,160,.9)', 22, 8); Fx.ring(f.x, f.y - 90, 4, 240, 'rgba(255,255,255,.8)', 18, 4);
        f.heal(5, true);
        if (Math.abs(o.x - f.x) < 340) B.hit(f, o, { dmg: 2, hitstun: 12, blockstun: 6, kx: 0, slow: 200, hitstop: 4, chip: 0, height: 'mid', isProj: true }, { x: f.x + f.face * 40, y: f.y - 100, vx: 0 }, null);
      },
    }),
    sup: SP({
      name: 'ניתוק התקע', desc: 'תקע ענק נוחת על היריב ומכבה הכול. הנחיתה מסומנת בצל, אז אפשר לברוח.', icon: 'plug', frames: 108, anim: 'summon', glow: '#ffe14a', invAfter: 30,
      ai: { min: 0, max: 600, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 66) f.inv = Math.max(f.inv, 2);
        if (t === 4) {
          f.mi.tx = o.x + o.vx * 8;
          B.ent({ kind: 'shadow', owner: f, dir: f.face, x: clamp(f.mi.tx, WALL_L, WALL_R), y: GROUND - 3, w: 200, h: 20, noHit: true, dmg: 0, life: 44, z: -1, isProj: false, clash: false, draw: warnShadow(44, 200) });
        }
        if (t === 46) {
          B.ent({ kind: 'plug', owner: f, dir: f.face, x: clamp(f.mi.tx, WALL_L, WALL_R), y: -260, vy: 28, w: 80, h: 150, dmg: 33, hitstun: 52, blockstun: 22, kx: 5, ky: -8, knockdown: true, life: 90, isSuper: true, chip: 0.3, clash: false, z: 1, ground: true, hitstop: 12, noFlip: true,
            onLand(e) { Fx.shake(16); Fx.flash('#fff4a0', 0.6); Fx.ring(e.x, GROUND - 4, 20, 190, 'rgba(255,225,74,.9)', 20, 7); Snd.play('zap'); Snd.play('boom'); e.life = 10; e.pierce = true; } });
        }
      },
    }),
    quotes: { intro: ['!זה לא עומד על הפרק', '!אני לא זז מהעקרונות'], win: ['!נשארתי בעמדה'], lose: ['!אני מתפטר מהסיבוב'] },
    ending: 'נשאר בעמדה עד הסוף, לחץ יד לכולם, ורק התקע נשאר מונח על הרצפה.',
  }),

  // ============================================================================ אבו שחאדה
  fighterDef({
    id: 'abushehadeh', name: 'סאמי אבו שחאדה', short: 'אבו שחאדה', party: 'balad', title: 'הגאות', arch: 'זורם', role: 'יו״ר בל״ד · מס׳ 3 ברשימה המשותפת · נפסל בוועדת הבחירות, ממתין לבג״ץ',
    blurb: 'לפעמים גאות ולפעמים שפל. בגאות הוא מהיר יותר, בשפל הוא מכה חזק יותר, ותמיד יש תפוז בכיס.',
    stats: { hp: 122, spd: 1.04, pow: 1.0, jump: 1.05 }, rating: { pow: 3, spd: 4, def: 2, rng: 3, dif: 4 },
    ai: { style: 'balanced', space: 200 },
    passive: {
      id: 'tide', name: 'גאות ושפל', desc: 'מתחלף כל חמש שניות: בגאות הוא מהיר ב-12%, בשפל הוא מכה חזק ב-15%.',
      spd(f) { return Math.floor(f.clock / 300) % 2 === 0 ? 1.12 : 1; },
      dmgOut(f) { return Math.floor(f.clock / 300) % 2 === 1 ? 1.15 : 1; },
      aura(f) { return f.hp > 0 && f.st !== 'ko' ? (Math.floor(f.clock / 300) % 2 === 0 ? '#4aa8ff' : '#ffb14a') : null; },
      hud(ctx, f, x, y, dir, s) {
        const hi = Math.floor(f.clock / 300) % 2 === 0;
        T(ctx, hi ? 'גאות · מהיר' : 'שפל · חזק', x + (s === 0 ? 0 : -2), y + 4, { size: 12, fill: hi ? '#7fc4ff' : '#ffc27a', stroke: OUT, lw: 3, align: s === 0 ? 'left' : 'right', weight: 800 });
      },
    },
    normals: {
      L: ['ג׳אב חוף', 'jab', { startup: 4, dmg: 3.9 }],
      H: ['בעיטת גל', 'highkick', { dmg: 8.8, startup: 10 }],
      FH: ['מכת משוט', 'chop', { dmg: 10 }],
      DL: ['סחיפת גאות', 'lowkick'],
      DH: ['שפל עולה', 'uppercut'],
    },
    sp1: spCast({
      name: 'תפוז יפו', desc: 'תפוז מקפץ שמאט את מי שנפגע לשתי שניות.', icon: 'orange', frames: 32, release: 12, cd: 190,
      ai: { min: 150, max: 640, kind: 'zone' },
      shots: [{ kind: 'orange', ox: 40, oy: -140, vx: 6.6, vy: -6.2, g: 0.34, bounce: 0.72, w: 42, h: 42, dmg: 7, hitstun: 20, blockstun: 12, kx: 4, slow: 120, life: 150 }],
    }),
    sp2: spCast({
      name: 'גל', desc: 'גל נמוך שחוצה את הרצפה. דורש חסימה מכופפת.', icon: 'wave', frames: 34, release: 13, cd: 250,
      ai: { min: 130, max: 560, kind: 'zone' },
      shots: [{ kind: 'wave', ox: 30, oy: -40, vx: 7.4, w: 90, h: 80, sc: 0.9, dmg: 9.5, hitstun: 24, blockstun: 14, kx: 9, life: 80, height: 'low', dur: 2 }],
    }),
    sup: SP({
      name: 'גאות עצומה', desc: 'גל ענק שוטף את כל האולם מקצה לקצה וגורף את מי שעל הרצפה.', icon: 'wave', frames: 104, anim: 'summon', glow: '#4aa8ff', invAfter: 34,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 56) f.inv = Math.max(f.inv, 2);
        if (t === 14) {
          Snd.play('crowd'); Fx.flash('#bfe6ff', 0.4);
          B.ent({ kind: 'wave', owner: f, dir: f.face, x: f.x - f.face * 360, y: GROUND - 150, vx: f.face * 12, w: 250, h: 300, sc: 3.1, dmg: 30, hitstun: 50, blockstun: 22, kx: 10, ky: -9, knockdown: true, life: 200, pierce: true, interval: 999, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 12,
            onTick(e) { if (e.t % 3 === 0) { Fx.shake(4); Fx.sparks(e.x + e.dir * 60, GROUND - rnd(20, 240), 1, '#bfe6ff', 6); } } });
        }
      },
    }),
    quotes: { intro: ['!רוח הים איתי', '!זורמים'], win: ['!הגל שטף הכול'], lose: ['!אחרי כל שפל יש גאות'] },
    ending: 'הגל נסוג, נשארו פירורי קצף, וריח של תפוזים על החוף.',
  }),

  // ============================================================================ הנדל
  fighterDef({
    id: 'hendel', name: 'יועז הנדל', short: 'הנדל', party: 'reservists', title: 'צו 8', arch: 'מגייס', role: 'יו״ר המילואימניקים · שר התקשורת לשעבר',
    blurb: 'תמיד מוכן מראש. מתחיל כל סיבוב עם הייפ, מציב חיילים בעמדה ושולח צווים שמאטים את היריב.',
    stats: { hp: 114, spd: 1.02, pow: 1.0, meter: 1.05 }, rating: { pow: 3, spd: 3, def: 3, rng: 4, dif: 3 },
    ai: { style: 'zone', space: 280 },
    passive: {
      id: 'prepared', name: 'מוכן מראש', desc: 'מתחיל כל סיבוב עם 30 הייפ.',
      roundStart(f) { f.meter = Math.max(f.meter, 30); },
    },
    normals: {
      L: ['סטירת עדכון', 'jab'],
      H: ['בעיטת מגף', 'kick', { dmg: 9.4 }],
      FH: ['מכת קלסר', 'swing', { prop: 'folder', dmg: 9.6, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['סחיפת שטח', 'lowkick'],
      DH: ['הצדעה עולה', 'uppercut'],
    },
    sp1: spCast({
      name: 'צו 8', desc: 'צו גיוס שנוטה אחרי היריב ומאט אותו לשלוש שניות.', icon: 'notice', frames: 32, release: 12, cd: 210,
      ai: { min: 170, max: 720, kind: 'zone' },
      shots: [{ kind: 'notice', ox: 42, oy: -130, vx: 7.4, w: 50, h: 40, dmg: 4.6, hitstun: 16, blockstun: 10, kx: 2, slow: 200, home: 0.06, homeMax: 3, life: 120 }],
    }),
    sp2: SP({
      name: 'כיתת מילואים', desc: 'שני חיילי מילואים נוצבים בעמדה לשש שניות ומכים כל מי שמתקרב.', icon: 'crowd', frames: 46, release: 14, cd: 480, anim: 'summon', glow: '#b59f5a', ai: { min: 100, max: 520, kind: 'trap' },
      tick(f, t, B) {
        if (t !== 14) return;
        B.ents.forEach((e) => { if (e.tag === 'guard' && e.owner === f) e.dead = true; });
        [110, 215].forEach((d, i) => {
          const m = minion(B, f, { lookId: RES[i % 2], vx: 0.01, sc: 0.78, dmg: 6, x: clamp(f.x + f.face * d, WALL_L, WALL_R), hitstun: 22, kx: 6, life: 380, tag: 'guard', pierce: true, interval: 40, maxHits: 99 });
          m.pose = (p) => { p.footF = [26, 0]; p.footB = [-22, 0]; p.handF = [46, -138]; p.handB = [20, -128]; p.hy = -71; p.lean = 0.05; p.eyes = 'angry'; };
          Fx.dust(m.x, GROUND, 0, 4);
        });
        Snd.play('cast');
      },
    }),
    sup: SP({
      name: 'סגירת מעגל', desc: 'שני טורים של חיילי מילואים רצים אל היריב משני הצדדים. מי שמתגונן מקדימה נפגע מאחור.', icon: 'crowd', frames: 110, anim: 'summon', glow: '#b59f5a', invAfter: 36,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 60) f.inv = Math.max(f.inv, 2);
        if (t === 6) Fx.text(f.x, f.y - 235, '!צו 8 כללי', { size: 28, col: '#e6d8a0', life: 60 });
        [12, 20, 28].forEach((at, i) => {
          if (t !== at) return;
          const last = i === 2;
          [-1, 1].forEach((sd) => {
            const m = minion(B, f, Object.assign({ lookId: RES[(i + (sd > 0 ? 1 : 0)) % 3], vx: 13, sc: last ? 0.9 : 0.74, dmg: last ? 9 : 5.5, x: clamp(o.x + sd * (470 + i * 60), 20, STAGE_W - 20), hitstun: 24, isSuper: true, chip: 0.25 }, last ? { knockdown: true, ky: -8, kx: 8, hitstun: 40 } : {}));
            m.dir = -sd; m.vx = -sd * 13;
          });
          if (i === 0) Snd.play('dash');
        });
      },
    }),
    quotes: { intro: ['!כולם מגויסים', '!אני חוזר למילואים'], win: ['!המשימה בוצעה'], lose: ['!אשוחרר בסבב הבא'] },
    ending: 'הצו נשלח, הטור התייצב, ולראשונה מישהו הגיע לפני הזמן.',
  }),

  // ============================================================================ וינטר
  fighterDef({
    id: 'winter', name: 'עופר וינטר', short: 'וינטר', party: 'amcha', title: 'רוח לחימה', arch: 'לוחם', role: 'יו״ר עמך ישראל · מפקד חטיבת גבעתי לשעבר',
    blurb: 'לוחם קשוח שמוביל מהחזית. כל יכולת מיוחדת שפוגעת מחזקת אותו, ומי שתוקף אותו בעמדה חוטף מכה חוזרת.',
    stats: { hp: 130, spd: 1.0, pow: 1.05, def: 0.98 }, rating: { pow: 4, spd: 3, def: 3, rng: 3, dif: 3 },
    ai: { style: 'balanced', space: 170 },
    passive: {
      id: 'lead', name: 'מוביל מהחזית', desc: 'כל יכולת מיוחדת שפוגעת מוסיפה +8% נזק לחמש שניות (עד שלוש פעמים).',
      onDealt(f, def, info) {
        const key = info.srcKey || f.mk;
        if (key === 'sp1' || key === 'sp2' || key === 'sup') { f.pv.lead = Math.min(3, (f.pv.lead || 0) + 1); f.pv.leadT = 300; }
      },
      tick(f) { if (f.pv.leadT > 0 && --f.pv.leadT === 0) f.pv.lead = 0; },
      dmgOut(f) { return 1 + 0.08 * (f.pv.lead || 0); },
      aura(f) { return (f.pv.lead || 0) >= 2 ? '#e0a82e' : null; },
      hud(ctx, f, x, y, dir, s) { hudPips(ctx, f, x, y, dir, s, f.pv.lead || 0, 3, '#e0a82e', 'פיקוד'); },
    },
    normals: {
      L: ['אגרוף שדה', 'jab'],
      H: ['בעיטת מגף', 'kick', { dmg: 9.6 }],
      FH: ['מכת פיקוד', 'slam', { dmg: 10.4 }],
      DL: ['סחיפת שטח', 'lowkick'],
      DH: ['זינוק חטיבתי', 'uppercut'],
    },
    sp1: spCast({
      name: 'פקודה', desc: 'שאגת פיקוד שדוחפת את היריב חזק אחורה.', icon: 'horn', frames: 32, release: 12, cd: 190,
      ai: { min: 100, max: 620, kind: 'zone' },
      shots: [{ kind: 'horn', col: '#e0a82e', col2: '#fff0c0', ox: 36, oy: -112, vx: 9, w: 68, h: 132, dmg: 8, hitstun: 20, blockstun: 14, kx: 12, life: 76, dur: 2 }],
    }),
    sp2: SP({
      name: 'עמדת המתנה', desc: 'עומד בשריון. אם מכים אותו בזמן העמידה, הוא מחזיר מכה חזקה ומפילה.', icon: 'shieldIcon', frames: 46, release: 6, cd: 330, anim: 'buff', glow: '#e0a82e', armor: 1, armorUntil: 32,
      ai: { min: 0, max: 210, kind: 'close' },
      tick(f, t, B) {
        if (!f.mi.countered && f.mi.armor < 1) {
          f.mi.countered = true; f.mt = Math.max(f.mt, 33);
          Snd.play('boom'); Fx.text(f.x + f.face * 60, f.y - 210, '!תגובה', { size: 28, col: '#ffd66a', life: 40 });
          f.strike([0, -168, 135, 168], { dmg: 13, hitstun: 30, blockstun: 16, kx: 9, ky: -7, knockdown: true, hitstop: 10, height: 'mid', chip: 0.1, unblockable: true }, 'counter');
        }
      },
    }),
    sup: SP({
      name: 'פקודת קרב', desc: 'גל הלם דוחף את היריב, ואז שמונה שניות של +30% נזק, מהירות גבוהה יותר ו-15% פחות נזק שנספג.', icon: 'star', frames: 66, anim: 'buff', glow: '#e0a82e', invAfter: 20,
      ai: { min: 0, max: 380, kind: 'close' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 44) f.inv = Math.max(f.inv, 2);
        if (t === 12) {
          Snd.play('boom'); Fx.flash('#ffe6a0', 0.5); Fx.shake(9);
          Fx.ring(f.x, f.y - 90, 12, 300, 'rgba(255,214,106,.95)', 22, 10); Fx.ring(f.x, f.y - 90, 4, 210, 'rgba(255,255,255,.9)', 18, 5);
          Fx.text(f.x, f.y - 235, '!אחריי', { size: 32, col: '#ffd66a', life: 60 });
          f.tm.dmgUp = 480; f.val.dmgUpMul = 1.3; f.tm.haste = 480; f.tm.defUp = 480; f.val.defUpMul = 0.85; f.heal(12);
          if (Math.abs(o.x - f.x) < 320 && o.hurtable()) B.hit(f, o, superInfo({ dmg: 14, hitstun: 36, kx: 10, ky: -8, knockdown: true, hitstop: 12 }), { x: f.x, y: f.y - 100, vx: 0 }, null);
        }
      },
    }),
    quotes: { intro: ['!אחריי', '!אני מוביל, אתם אחריי'], win: ['!המשימה מעל הכול'], lose: ['!נתקדם בכוחות מתוגברים'] },
    ending: 'הוא הוביל מהחזית, כולם הלכו אחריו, ורק הרמקול בעמדה האחורית לא הבין את הפקודה.',
  }),
);

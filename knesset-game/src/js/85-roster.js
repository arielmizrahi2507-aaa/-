// ===== Roster =====
// Cartoon caricatures of Knesset members and party leaders for a satire / parody game. Moves, quotes, abilities and
// nicknames are invented for fun. The only factual claims are the party and the `role` line; both were checked against
// news reports on VERIFIED_ON (see ../DATA.md for the sources) and are trivial to update here.
const VERIFIED_ON = '30.9.2026';

const PARTIES = {
  likud:      { name: 'הליכוד', color: '#2155e0' },
  otzma:      { name: 'עוצמה יהודית', color: '#8a4fe0' },
  rz:         { name: 'הציונות הדתית', color: '#f28a1e' },
  noam:       { name: 'נעם לישראל', color: '#c76a1f' },
  shas:       { name: 'ש״ס', color: '#f4c81d' },
  utj:        { name: 'יהדות התורה', color: '#7c86c8' },
  yb:         { name: 'ישראל ביתנו', color: '#b3562a' },
  byachad:    { name: 'ביחד', color: '#19c6b7' },            // Bennett + Lapid (Yesh Atid) joint list
  yashar:     { name: 'ישר!', color: '#18b0e0' },
  bw:         { name: 'כחול לבן', color: '#6ec6ff' },
  dem:        { name: 'הדמוקרטים', color: '#38b56a' },
  hadash:     { name: 'חד״ש', color: '#e23b52', bloc: 'הרשימה המשותפת' },
  taal:       { name: 'תע״ל', color: '#e05fb4', bloc: 'הרשימה המשותפת' },
  balad:      { name: 'בל״ד', color: '#1f8f63', bloc: 'הרשימה המשותפת' },
  raam:       { name: 'רע״מ', color: '#a5d63c' },
  reservists: { name: 'המילואימניקים', color: '#b59f5a' },
  amcha:      { name: 'עמך ישראל', color: '#e0a82e' },
  neutral:    { name: 'עצמאי', color: '#c9ced8' },
};

function fighterDef(d) {
  const p = PARTIES[d.party];
  d.color = p.color; d.partyName = p.name; d.bloc = p.bloc || ''; d.look = LOOKS[d.id];
  d.moves = Object.assign(normals(d.normals), { sp1: d.sp1, sp2: d.sp2, sup: d.sup });
  d.stats = Object.assign({ hp: 118, spd: 1, pow: 1, def: 1, jump: 1, meter: 1 }, d.stats);
  d.passive = d.passive || {};
  return d;
}

const hudPips = (ctx, f, x, y, dir, s, n, max, col, label) => {
  for (let i = 0; i < max; i++) {
    const px = x + dir * i * 12 + (s === 0 ? 0 : -10);
    rr(ctx, px, y, 10, 8, 3); ctx.fillStyle = i < n ? col : 'rgba(12,6,32,.7)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  }
  if (label) T(ctx, label, x + dir * (max * 12 + 8) + (s === 0 ? 0 : -8), y + 4.5, { size: 11, fill: '#fff', stroke: OUT, lw: 3, align: s === 0 ? 'left' : 'right', weight: 800 });
};

const ROSTER = [
  // ============================================================================ נתניהו
  fighterDef({
    id: 'bibi', name: 'בנימין נתניהו', short: 'נתניהו', party: 'likud', title: 'הקוסם', arch: 'שרדן', role: 'ראש הממשלה · יו״ר הליכוד',
    blurb: 'כל קרב אצלו הוא הצגה של קוסם. כשכבר נראה שנגמר, מגיע קלף מהשרוול.',
    stats: { hp: 112 }, rating: { pow: 3, spd: 3, def: 3, rng: 4, dif: 2 },
    ai: { style: 'zone', space: 320 },
    passive: {
      id: 'survive', name: 'הקוסם', desc: 'פעם בסיבוב: מכה קטלנית משאירה מנדט אחד, חסינות לשתי שניות, והיכולות מתאפסות.',
      survive(f) {
        if (f.pv.used) return false;
        f.pv.used = true; f.inv = 70; f.cd.sp1 = 0; f.cd.sp2 = 0; f.gain(15);
        Fx.text(f.x, f.y - 225, '!קלף מהשרוול', { size: 30, col: '#ffe14a', life: 70 });
        Fx.stars(f.x, f.y - 100, 14, '#ffe14a', 7); Fx.ring(f.x, f.y - 90, 20, 140, 'rgba(255,225,74,.9)', 24, 7);
        Snd.play('buff'); Fx.flash('#fff2b0', 0.4);
        return true;
      },
      hud(ctx, f, x, y, dir, s) { T(ctx, f.pv.used ? 'הקלף נוצל' : 'קלף בשרוול ✓', x + (s === 0 ? 0 : -2), y + 4, { size: 12, fill: f.pv.used ? '#9a90b8' : '#ffe14a', stroke: OUT, lw: 3, align: s === 0 ? 'left' : 'right', weight: 800 }); },
    },
    normals: {
      L: ['ג׳אב דיפלומטי', 'jab'],
      H: ['בעיטת הסברה', 'kick', { dmg: 9.5 }],
      FH: ['אצבע מדגישה', 'point', { dmg: 10, startup: 17, hb: [24, -196, 96, 130] }],
      DL: ['בעיטת ספסל', 'lowkick'],
      DH: ['הצהרה מסעירה', 'uppercut'],
    },
    sp1: spCast({
      name: 'נאום ארוך', desc: 'בועת נאום ענקית ואיטית. סופגת קליעים ודוחפת לאחור.', icon: 'bubble', frames: 40, release: 16, cd: 200,
      ai: { min: 200, max: 800, kind: 'zone' },
      shots: [{
        kind: 'bubble', ox: 60, oy: -122, vx: 3.6, w: 96, h: 76, life: 190, dmg: 9.5, hitstun: 26, blockstun: 16, kx: 7, dur: 3, power: 1, chip: 0.25,
        onTick(e) { const g = 1 + Math.min(0.55, e.t / 160); e.sc = g; e.w = 96 * g; e.h = 76 * g; },
      }],
    }),
    sp2: SP({
      name: 'הקו האדום', desc: 'מצייר קו אדום על הרצפה. מי שחוצה אותו נדהם ומסתחרר.', icon: 'redline', frames: 36, anim: 'point', release: 14, cd: 330,
      ai: { min: 180, max: 620, kind: 'trap' },
      tick(f, t, B) {
        if (t !== 14) return;
        B.ents.forEach((e) => { if (e.tag === 'redline' && e.owner === f) e.dead = true; });
        const x = clamp(f.x + f.face * 250, WALL_L + 40, WALL_R - 40);
        B.ent({ kind: 'redline', tag: 'redline', owner: f, dir: f.face, x, y: GROUND - 85, w: 30, h: 170, life: 460, dmg: 8, hitstun: 0, stun: 48, kx: 0, blockstun: 12, z: -1, isProj: false, clash: false, chip: 0.1, hitstop: 8 });
        Fx.ring(x, GROUND - 4, 10, 60, 'rgba(255,60,80,.9)', 18, 5); Snd.play('zap');
        Fx.text(x, GROUND - 190, '!קו אדום', { size: 22, col: '#ff6a7a', life: 50 });
      },
    }),
    sup: SP({
      name: 'ממשלת אחדות', desc: 'מזמן חמישה שרים בריצה מבוהלת אחרי היריב. האחרון מטיח.', icon: 'star', frames: 112, anim: 'summon', glow: '#5aa2ff', invAfter: 50,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 66) f.inv = Math.max(f.inv, 2);
        [12, 22, 32, 42, 54].forEach((at, i) => {
          if (t !== at) return;
          const last = i === 4;
          minion(B, f, Object.assign({ lookId: MINIONS[i], vx: 11 + i * 0.6, sc: last ? 0.95 : 0.72, dmg: last ? 10 : 6, x: f.x - f.face * 70 }, last ? { knockdown: true, ky: -8, kx: 9, hitstun: 40 } : {}, { isSuper: true, chip: 0.25 }));
          Snd.play('dash');
        });
        if (t === 12) Fx.text(f.x, f.y - 225, '!ממשלה חדשה', { size: 30, col: '#8fc4ff', life: 60 });
      },
    }),
    quotes: { intro: ['!יש לי עוד קלף בשרוול', '!אתם עוד תראו מה זה ניסיון'], win: ['!כמו שאמרתי', '!פעם נוספת'], lose: ['!זה עוד לא נגמר'] },
    ending: 'אחרי כל הקרבות, הקוסם מוציא מהכובע עוד קדנציה. הקהל מוחא כפיים והמתנגדים עדיין מחפשים איפה הקלף.',
  }),

  // ============================================================================ בן גביר
  fighterDef({
    id: 'bengvir', name: 'איתמר בן גביר', short: 'בן גביר', party: 'otzma', title: 'האדרנלין', arch: 'מסתער', role: 'השר לביטחון לאומי · יו״ר עוצמה יהודית',
    blurb: 'לא מחכה לתור. נכנס למכה, ועם כל פגיעה נהיה מהיר וחזק יותר.',
    stats: { hp: 114, spd: 1.1, pow: 1.04 }, rating: { pow: 4, spd: 4, def: 2, rng: 2, dif: 3 },
    ai: { style: 'rush', space: 110 },
    passive: {
      id: 'adrenaline', name: 'גל אדרנלין', desc: 'כל פגיעה מוסיפה 4% נזק (עד שמונה פעמים). מתאפס אחרי ארבע שניות בלי פגיעה.',
      onDealt(f) { f.pv.st = Math.min(8, (f.pv.st || 0) + 1); f.pv.stT = 240; },
      tick(f) { if (f.pv.stT > 0 && --f.pv.stT === 0) f.pv.st = 0; },
      dmgOut(f) { return 1 + 0.04 * (f.pv.st || 0); },
      aura(f) { return (f.pv.st || 0) >= 5 ? '#ff5a5a' : null; },
      hud(ctx, f, x, y, dir, s) { hudPips(ctx, f, x, y, dir, s, f.pv.st || 0, 8, '#ff5a5a', 'אדרנלין'); },
    },
    normals: {
      L: ['אגרוף לוחם', 'jab', { startup: 4, dmg: 4.2 }],
      H: ['בעיטת סמכות', 'cross', { dmg: 10, startup: 11, hb: [24, -136, 90, 44], lunge: { at: 4, len: 7, vx: 3.4 } }],
      FH: ['מכת הכרעה', 'slam'],
      DL: ['מארב נמוך', 'lowkick', { startup: 5 }],
      DH: ['התפרצות', 'uppercut'],
    },
    sp1: spCast({
      name: 'סירנה', desc: 'גל סירנה מסחרר. מי שנפגע מסתחרר לרגע.', icon: 'siren', frames: 30, release: 12, cd: 190, sfx: 'siren',
      ai: { min: 160, max: 700, kind: 'zone' },
      shots: [{ kind: 'siren', ox: 46, oy: -112, vx: 8.5, w: 74, h: 118, dmg: 5, stun: 40, hitstun: 0, blockstun: 12, kx: 2, life: 90, chip: 0.15 }],
    }),
    sp2: spDash({
      name: 'הסתערות', desc: 'כתף קדימה, עם שריון בתחילת הריצה. מפיל את מי שנתקל בו.', icon: 'fist', startup: 8, dashFrames: 17, recovery: 15, vx: 10.5, cd: 250,
      dmg: 11, hitstun: 28, kx: 9, knockdown: true, armor: 1, armorUntil: 24, hb: [-6, -156, 120, 156],
      ai: { min: 130, max: 460, kind: 'gap' },
    }),
    sup: SP({
      name: 'כוח מיוחד', desc: 'מסתער בברק. אם פוגע, פותח סדרה של פגיעות מהירות וסיום מטלטל.', icon: 'bolt', frames: 120, anim: 'dash', invAfter: 20,
      ai: { min: 60, max: 420, kind: 'gap' },
      tick(f, t, B) {
        const s = f.mi.sv || (f.mi.sv = { phase: 'rush', n: 0, t: 0 });
        const o = f.opp;
        if (s.phase === 'rush') {
          f.vx = f.face * 18; f.trailOn = true; f.inv = Math.max(f.inv, 2);
          if (t % 2 === 0) Fx.speedLines(f.x, f.y - 60, f.face, 2);
          const r = f.strike([-10, -156, 130, 156], superInfo({ dmg: 4, hitstun: 26, kx: 0.5, hitstop: 4, chip: 0.3 }), 'rush');
          if (r === 'hit') { s.phase = 'blitz'; s.t = 0; f.vx = 0; Snd.play('siren'); }
          else if (r === 'block' || r === 'perfect' || r === 'armor' || t > 26) { s.phase = 'end'; f.vx *= 0.2; f.mt = Math.max(f.mt, f.mv.frames - 30); }
        } else if (s.phase === 'blitz') {
          s.t++; f.vx = 0; f.inv = Math.max(f.inv, 2); f.trailOn = false;
          o.x = clamp(f.x + f.face * 62, WALL_L, WALL_R);
          if (s.t % 5 === 0 && s.n < 9) {
            s.n++;
            const last = s.n === 9;
            B.hit(f, o, superInfo(last ? { dmg: 11, hitstun: 44, kx: 11, ky: -9, knockdown: true, hitstop: 12, unblockable: true } : { dmg: 2.6, hitstun: 22, kx: 0.4, hitstop: 3, unblockable: true }), null, null);
            Fx.sparks(o.x, o.y - 100, 6, '#ff5a5a', 8); Fx.sparks(o.x, o.y - 100, 6, '#5a8bff', 8);
            if (last) { s.phase = 'end'; f.mt = Math.max(f.mt, f.mv.frames - 26); }
          }
        }
      },
    }),
    quotes: { intro: ['!אין פה דיון', '!תתכוננו'], win: ['!סוף הדיון'], lose: ['!נתראה בסיבוב הבא'] },
    ending: 'הצעקות נעלמות, הסירנה נשארת ברקע, ומאחורי הקלעים כולם מסכימים: היה אינטנסיבי.',
  }),

  // ============================================================================ סמוטריץ'
  fighterDef({
    id: 'smotrich', name: 'בצלאל סמוטריץ׳', short: 'סמוטריץ׳', party: 'rz', title: 'שר האוצר', arch: 'חשב', role: 'שר האוצר · יו״ר הציונות הדתית',
    blurb: 'לא רק מנצח בנקודות: גוזל מהיריב את ההייפ ומשלם בו את החשבון.',
    stats: { hp: 110, spd: 0.96 }, rating: { pow: 3, spd: 3, def: 2, rng: 4, dif: 3 },
    ai: { style: 'zone', space: 300 },
    passive: {
      id: 'tax', name: 'שר האוצר', desc: 'כל פגיעה גוזלת 8 נקודות הייפ מהיריב ומעבירה חלק אליך.',
      onDealt(f, def) { if (def.meter > 0) { def.meter = Math.max(0, def.meter - 8); f.gain(3); Fx.coins(def.x, def.y - 100, 3, f.face); } },
    },
    normals: {
      L: ['מכת מחשבון', 'jab', { prop: 'calc' }],
      H: ['בעיטת מע״מ', 'kick'],
      FH: ['מכת תיק אוצר', 'swing', { prop: 'briefcase', dmg: 10, startup: 19, hb: [30, -200, 90, 140] }],
      DL: ['קיצוץ בשוקיים', 'lowkick'],
      DH: ['עליית מדרגה', 'uppercut'],
    },
    sp1: spCast({
      name: 'גזירת תקציב', desc: 'מספריים מהירות. פוגעות וגוזרות 15 מההייפ של היריב.', icon: 'scissors', frames: 28, release: 11, cd: 170,
      ai: { min: 200, max: 800, kind: 'zone' },
      shots: [{ kind: 'scissors', ox: 46, oy: -108, vx: 12.5, w: 66, h: 46, dmg: 8, hitstun: 22, blockstun: 13, kx: 5, meterDrain: 15, life: 70 }],
    }),
    sp2: spCast({
      name: 'מטבעות לכולם', desc: 'חמישה מטבעות מקפצים בקשת. שוברים הגנה עצלה.', icon: 'coin', frames: 38, release: 14, cd: 260,
      ai: { min: 140, max: 560, kind: 'zone' },
      shots: [0, 1, 2, 3, 4].map((i) => ({ kind: 'coin', ox: 40, oy: -140, vx: 3.2 + i * 1.5, vy: -8.5 + i * 0.4, g: 0.5, bounce: 0.55, w: 36, h: 36, dmg: 2.8, hitstun: 14, blockstun: 9, kx: 2, life: 130, n: i, at: 14 + i * 2 })),
    }),
    sup: SP({
      name: 'תקציב חירום', desc: 'מרוקן את קופת ההייפ של היריב וממטיר מטבעות ושטרות מהשמיים.', icon: 'bill', frames: 170, anim: 'summon', glow: '#ffd23d', invAfter: 40,
      ai: { min: 0, max: 700, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 40) f.inv = Math.max(f.inv, 2);
        if (t === 6) { o.meter = 0; Fx.text(o.x, o.y - 210, '!הקופה ריקה', { size: 26, col: '#ffd23d', life: 60 }); Snd.play('coin'); Fx.coins(f.x, f.y - 160, 20, f.face); }
        if (t >= 16 && t < 130 && t % 4 === 0) {
          const bill = B.rng() < 0.4;
          const x = clamp(o.x + (B.rng() * 2 - 1) * 250, WALL_L, WALL_R);
          B.ent({ kind: bill ? 'bill' : 'coin', owner: f, dir: f.face, x, y: -40, vx: 0, vy: 9 + B.rng() * 2, w: 44, h: 44, dmg: 3.6, hitstun: 20, blockstun: 10, kx: 1.5, life: 90, isSuper: true, chip: 0.3, hitstop: 4, n: t, clash: false, z: 1 });
          if (t % 8 === 0) Snd.play('coin');
        }
        if (t === 136) {
          B.ent({ kind: 'coin', owner: f, dir: f.face, x: o.x, y: -60, vy: 24, w: 110, h: 110, sc: 3.2, dmg: 11, hitstun: 44, blockstun: 18, kx: 8, ky: -9, knockdown: true, life: 60, isSuper: true, chip: 0.3, clash: false, z: 1, ground: true, onLand(e) { Fx.shake(14); Fx.coins(e.x, GROUND - 20, 22, 1); Fx.coins(e.x, GROUND - 20, 22, -1); e.life = 8; } });
        }
      },
    }),
    quotes: { intro: ['!הכול שאלה של תקציב', '!אני גוזר מכאן'], win: ['!הגרעון נסגר'], lose: ['!נפלנו על סעיף'] },
    ending: 'התקציב אוזן, הקופה מבריקה, ורק הגרעון מנסה להסתתר מתחת לשולחן.',
  }),

  // ============================================================================ דרעי
  fighterDef({
    id: 'deri', name: 'אריה דרעי', short: 'דרעי', party: 'shas', title: 'קלף המיקוח', arch: 'עוגן', role: 'יו״ר ש״ס',
    blurb: 'מתאמן על סבלנות. סוגר עסקה בכל סיבוב ויוצא עם רווח.',
    stats: { hp: 118, spd: 0.9, pow: 1, def: 0.97 }, rating: { pow: 3, spd: 2, def: 5, rng: 3, dif: 2 },
    ai: { style: 'tank', space: 150 },
    passive: {
      id: 'deal', name: 'עסקה טובה', desc: 'מחזיר לעצמו 8% מכל נזק שהוא גורם.',
      onDealt(f, def, info, dmg) { f.heal(dmg * 0.08, dmg * 0.08 >= 1); },
    },
    normals: {
      L: ['משא ומתן', 'jab', { startup: 5, dmg: 4.4 }],
      H: ['שכר טרחה', 'hook', { dmg: 9.5, startup: 13, hb: [24, -132, 96, 52], lunge: null }],
      FH: ['חתימה על הסכם', 'chop', { prop: 'pen' }],
      DL: ['בעיטת כיסא', 'lowkick'],
      DH: ['הצעה מפתיעה', 'uppercut'],
    },
    sp1: spCast({
      name: 'הזמנה לשיחה', desc: 'מכתב הזמנה שמושך את היריב אליו ומסחרר אותו.', icon: 'letter', frames: 32, release: 12, cd: 240,
      ai: { min: 220, max: 700, kind: 'zone' },
      shots: [{ kind: 'letter', ox: 46, oy: -120, vx: 9.5, w: 58, h: 42, dmg: 4, hitstun: 0, stun: 28, blockstun: 10, kx: 1, pull: 92, life: 80 }],
    }),
    sp2: spBuff({
      name: 'ערבות בנקאית', desc: 'מגן זהב שסופג 22 נזק במשך שמונה שניות, ומרפא מעט.', icon: 'shieldIcon', frames: 32, release: 12, cd: 420, glow: '#ffd94a', label: '!ערבות',
      apply(f) { f.val.shield = 22; f.tm.shieldT = 480; f.heal(5); },
    }),
    sup: SP({
      name: 'שולחן המשא ומתן', desc: 'שולחן ענק נוחת על היריב. מסומן בצל, אז אפשר לברוח. מרפא בפגיעה.', icon: 'table', frames: 100, anim: 'summon', glow: '#c98a4a', invAfter: 30,
      ai: { min: 0, max: 600, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 60) f.inv = Math.max(f.inv, 2);
        if (t === 4) f.mi.tx = o.x + o.vx * 8;
        if (t === 4) B.ent({ kind: 'shadow', owner: f, dir: f.face, x: clamp(f.mi.tx, WALL_L, WALL_R), y: GROUND - 3, w: 230, h: 20, noHit: true, dmg: 0, life: 44, z: -1, isProj: false, clash: false, draw(ctx, e) { const k = e.t / 44; ctx.fillStyle = `rgba(20,8,40,${0.15 + 0.45 * k})`; ctx.beginPath(); ctx.ellipse(0, 0, 130 * (0.4 + k * 0.6), 20 * (0.4 + k * 0.6), 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(255,90,90,${0.3 + 0.6 * k})`; ctx.lineWidth = 3; ctx.stroke(); } });
        if (t === 44) {
          B.ent({ kind: 'table', owner: f, dir: f.face, x: clamp(f.mi.tx, WALL_L, WALL_R), y: -240, vy: 26, w: 210, h: 90, dmg: 34, hitstun: 52, blockstun: 22, kx: 5, ky: -8, knockdown: true, life: 90, isSuper: true, chip: 0.3, clash: false, z: 1, ground: true, hitstop: 12,
            onHit(e, def, r) { if (r === 'hit') { e.owner.heal(6); } },
            onLand(e) { Fx.shake(16); Fx.dust(e.x, GROUND, -1, 8); Fx.dust(e.x, GROUND, 1, 8); Fx.ring(e.x, GROUND - 4, 20, 160, 'rgba(255,255,255,.8)', 18, 6); Snd.play('boom'); e.life = 10; e.pierce = true; } });
        }
      },
    }),
    quotes: { intro: ['!בואו נעשה עסקה', '!כל דבר בר משא ומתן'], win: ['!אני תמיד יוצא ברווח'], lose: ['!בסדר, נחזור לשולחן'] },
    ending: 'עסקה טובה סוגרת עסקה טובה. בסוף גם השולחן מבין שכדאי להסכים.',
  }),

  // ============================================================================ ליברמן
  fighterDef({
    id: 'liberman', name: 'אביגדור ליברמן', short: 'ליברמן', party: 'yb', title: 'אין פשרות', arch: 'טנק', role: 'יו״ר ישראל ביתנו',
    blurb: 'מכות כבדות שלא מוותרות. מתי שכבר התחיל, אף אחד לא עוצר אותו.',
    stats: { hp: 116, spd: 0.92, pow: 1.04 }, rating: { pow: 4, spd: 2, def: 4, rng: 2, dif: 2 },
    ai: { style: 'tank', space: 130 },
    passive: {
      id: 'armor', name: 'ללא פשרות', desc: 'מכת הברזל וכדור הברזל מגיעים עם שריון שמתעלם מפגיעה אחת.',
      armorKeys: ['H', 'sp1'],
    },
    normals: {
      L: ['אגרוף גרניט', 'jab', { startup: 5, dmg: 4.4 }],
      H: ['מכת ברזל', 'cross', { dmg: 9.5, startup: 13, recovery: 20, hb: [24, -134, 92, 46] }],
      FH: ['פטיש כבד', 'slam', { dmg: 10.5 }],
      DL: ['טאטוא', 'lowkick'],
      DH: ['עלייה חדה', 'uppercut'],
    },
    sp1: spCast({
      name: 'כדור ברזל', desc: 'כדור ברזל מקפץ שמפיל. שריון בזמן ההטלה.', icon: 'ironball', frames: 42, release: 18, cd: 230, armor: 1, armorUntil: 22,
      ai: { min: 180, max: 640, kind: 'zone' },
      shots: [{ kind: 'ironball', ox: 42, oy: -132, vx: 5.8, vy: -6, g: 0.5, bounce: 0.6, w: 54, h: 54, dmg: 9, hitstun: 32, blockstun: 16, kx: 7, ky: -8, knockdown: true, life: 210, dur: 3, power: 2, onBounce(e) { e.vx *= 0.9; } }],
    }),
    sp2: spBuff({
      name: 'עור ברזל', desc: 'חמש שניות של עור ברזל: פחות נזק, שריון לכל מכה, אבל איטי יותר.', icon: 'shieldIcon', frames: 34, release: 12, cd: 460, glow: '#c3ccd9', label: '!עור ברזל',
      apply(f) { f.tm.iron = 300; },
    }),
    sup: SP({
      name: 'המכבש', desc: 'מכבש כבישים ענק דוהר על כל המסך ומעיף את כל מי שבדרך.', icon: 'roller', frames: 100, anim: 'buff', glow: '#f4b400', invAfter: 30,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 50) f.inv = Math.max(f.inv, 2);
        if (t === 16) {
          Snd.play('honk');
          B.ent({ kind: 'roller', owner: f, dir: f.face, x: f.x - f.face * 620, y: GROUND - 80, vx: f.face * 13.5, w: 200, h: 160, dmg: 33, hitstun: 54, blockstun: 22, kx: 9, ky: -9, knockdown: true, life: 240, pierce: true, interval: 999, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 12,
            onTick(e) { if (e.t % 4 === 0) { Fx.shake(4); Fx.dust(e.x - e.dir * 90, GROUND, -e.dir, 2); } } });
        }
      },
    }),
    quotes: { intro: ['!אין פשרות', '!אני לא זז'], win: ['!אמרתי שלא אזוז'], lose: ['!עוד לא הסכמתי לכלום'] },
    ending: 'לא זז, לא נסוג, לא התפשר. אפילו הקיר שמאחוריו בדק אם הוא צריך לזוז.',
  }),

  // ============================================================================ לפיד
  fighterDef({
    id: 'lapid', name: 'יאיר לפיד', short: 'לפיד', party: 'byachad', title: 'הרייטינג', arch: 'תקשורתי', role: 'ראש האופוזיציה · יו״ר יש עתיד · מס׳ 2 ברשימת ביחד',
    blurb: 'קליעים ויראליים והייפ שמתמלא מהר. כל פגיעה היא עוד כותרת.',
    stats: { hp: 104, spd: 1.06, pow: 0.96, meter: 1.3 }, rating: { pow: 2, spd: 4, def: 2, rng: 5, dif: 3 },
    ai: { style: 'zone', space: 360 },
    passive: {
      id: 'rating', name: 'רייטינג', desc: 'ההייפ מתמלא מהר ב-30%, ופגיעה בקליע מוסיפה עוד.',
      onDealt(f, def, info) { if (info.isProj) f.gain(4); },
    },
    normals: {
      L: ['פוסט קצר', 'jab', { startup: 4, dmg: 3.6, hb: [24, -142, 76, 34] }],
      H: ['בעיטת כותרת', 'highkick', { dmg: 8.6, startup: 10, hb: [24, -160, 90, 60] }],
      FH: ['מאמר מערכת', 'swing', { prop: 'news', dmg: 9.5, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['סקירה נמוכה', 'lowkick'],
      DH: ['סקופ', 'uppercut'],
    },
    sp1: SP({
      name: 'פוסט ויראלי', desc: 'לייק שמתפצל לשלושה שיתופים אחרי רגע.', icon: 'like', frames: 30, release: 11, cd: 190, ai: { min: 200, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t !== 11) return;
        Snd.play('cast');
        B.proj(f, {
          kind: 'like', ox: 46, oy: -122, vx: 8.5, w: 46, h: 46, dmg: 3.4, hitstun: 16, blockstun: 10, kx: 3, life: 60,
          onTick(e, B2) {
            if (e.t === 13 && !e.split) {
              e.split = true; e.dead = true;
              [-2.6, 0, 2.6].forEach((vy) => B2.ent({ kind: 'share', owner: e.owner, dir: e.dir, x: e.x, y: e.y, vx: e.dir * 8.5, vy, w: 34, h: 34, dmg: 3.4, hitstun: 16, blockstun: 10, kx: 3, life: 60 }));
              Fx.sparks(e.x, e.y, 8, '#8ad0ff', 6);
            }
          },
        });
      },
    }),
    sp2: SP({
      name: 'פלאש', desc: 'הבזק מצלמה שמסנוור וממטיל. מי שחוסם מצליח להסתיר את העיניים.', icon: 'flash', frames: 36, release: 12, cd: 290, anim: 'cast',
      ai: { min: 0, max: 400, kind: 'zone' },
      tick(f, t, B) {
        if (t !== 12) return;
        const o = f.opp;
        Snd.play('flash'); Fx.flash('#ffffff', 0.55);
        B.ent({ kind: 'flash', owner: f, dir: f.face, x: f.x + f.face * 70, y: f.y - 120, noHit: true, dmg: 0, life: 12, z: 1, isProj: false, clash: false });
        const dx = (o.x - f.x) * f.face;
        if (dx > 0 && dx < 430) B.hit(f, o, { dmg: 2.5, stun: 50, hitstun: 0, blockstun: 8, kx: 0, hitstop: 5, chip: 0, height: 'mid', isProj: true }, { x: f.x + f.face * 60, y: f.y - 120, vx: 0 }, null);
      },
    }),
    sup: SP({
      name: 'שידור חי', desc: 'קרן שידור ענקית שסורקת את כל האולפן. עשר פגיעות ומכה מסכמת.', icon: 'beam', frames: 110, anim: 'cast', release: 26, glow: '#7ad7ff', invAfter: 26,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 30) f.inv = Math.max(f.inv, 2);
        if (t === 24) {
          Snd.play('zap');
          B.ent({ kind: 'beam', owner: f, dir: f.face, x: f.x + f.face * 380, y: f.y - 100, w: 700, h: 96, dmg: 3.1, hitstun: 20, blockstun: 8, kx: 0.5, life: 50, pierce: true, interval: 4, maxHits: 99, isSuper: true, chip: 0.25, clash: false, hitstop: 3, z: 1,
            onTick(e) { e.x = e.owner.x + e.dir * 380; e.y = e.owner.y - 100; Fx.shake(3); if (e.life <= 6) { e.dmg = 8; e.kx = 10; e.ky = -9; e.knockdown = true; e.hitstun = 40; e.interval = 999; } },
            draw(ctx, e) { ctx.translate(-e.w / 2 + 30, 0); const g = Math.min(1, e.t / 5) * (e.life < 8 ? e.life / 8 : 1); ENT.beam(ctx, { len: e.w, h: e.h, col: '#7ad7ff', grow: g }); ENT.flash(ctx, { t: e.t }); } });
        }
      },
    }),
    quotes: { intro: ['!תכתבו את זה בפוסט', '!הקהל רוצה כותרת'], win: ['!הרייטינג שלי הרקיע'], lose: ['!אני מעלה על זה פוסט'] },
    ending: 'הפוסט הפך ויראלי, הרייטינג התפוצץ, והאולפן מבקש עוד עונה.',
  }),

  // ============================================================================ גנץ
  fighterDef({
    id: 'gantz', name: 'בני גנץ', short: 'גנץ', party: 'bw', title: 'משמעת', arch: 'מפקד', role: 'יו״ר כחול לבן',
    blurb: 'מגן קודם, מכה אחר כך. בלוק מושלם אצלו מסתיים בתגובה מיידית.',
    stats: { hp: 136, spd: 1, pow: 1.08, def: 0.96 }, rating: { pow: 3, spd: 3, def: 4, rng: 3, dif: 3 },
    ai: { style: 'balanced', space: 200 },
    passive: {
      id: 'discipline', name: 'משמעת צבאית', desc: 'בלוק מושלם מפעיל מכת נגד אוטומטית ומטעין 12 הייפ.',
      onPerfect(def, att, info, B) {
        def.gain(12);
        if (info.isProj || Math.abs(att.x - def.x) > 175) return;
        Fx.text(def.x, def.y - 230, '!תגובה', { size: 24, col: '#8fc4ff', life: 40 });
        B.hit(def, att, { dmg: 9, hitstun: 22, blockstun: 10, kx: 6, hitstop: 8, height: 'mid', chip: 0, ky: -3 }, null, null);
      },
    },
    normals: {
      L: ['ג׳אב מדויק', 'jab', { dmg: 4.4 }],
      H: ['בעיטת מגף', 'kick', { dmg: 9.6 }],
      FH: ['מכת סמל', 'chop'],
      DL: ['זחילה קרבית', 'lowkick'],
      DH: ['קפיצת צניחה', 'uppercut'],
    },
    sp1: SP({
      name: 'מטח חבילות', desc: 'שלוש חבילות אספקה בצנחים נופלות מהשמיים לפניו.', icon: 'crate', frames: 44, release: 12, cd: 250, anim: 'summon', ai: { min: 180, max: 620, kind: 'trap' },
      tick(f, t, B) {
        if (t !== 12) return;
        Snd.play('cast');
        [170, 290, 410].forEach((d, i) => {
          B.ent({ kind: 'crate', owner: f, dir: f.face, x: clamp(f.x + f.face * d, WALL_L, WALL_R), y: -300 - i * 60, vy: 4.5, w: 54, h: 54, dmg: 11.5, hitstun: 26, blockstun: 14, kx: 4, life: 200, delay: i * 9, ground: true, clash: false, n: i, z: 1, hitstop: 6, falling: true,
            onTick(e) { e.falling = !e.landed; e.vy = e.landed ? 0 : 4.5 + e.t * 0.05; },
            onLand(e) { Fx.confetti(e.x, e.y, 16, 6); Fx.dust(e.x, GROUND, 0, 5); Fx.shake(5); Snd.play('land'); e.life = 8; } });
        });
      },
    }),
    sp2: SP({
      name: 'פקודת עצור', desc: 'צעקה עם הצדעה. מקפיאה את היריב לרגע אם לא חוסם.', icon: 'hand', frames: 34, release: 12, cd: 330, anim: 'point', ai: { min: 0, max: 300, kind: 'close' },
      tick(f, t, B) {
        if (t !== 12) return;
        const o = f.opp;
        Snd.play('zap');
        Fx.ring(f.x + f.face * 60, f.y - 120, 10, 150, 'rgba(120,190,255,.95)', 18, 8); Fx.ring(f.x + f.face * 60, f.y - 120, 4, 110, 'rgba(255,255,255,.95)', 16, 4);
        Fx.text(f.x + f.face * 90, f.y - 205, '!עצור', { size: 32, col: '#8fc4ff', life: 40 });
        const dx = (o.x - f.x) * f.face;
        if (dx > 0 && dx < 300) B.hit(f, o, { dmg: 3, stun: 62, hitstun: 0, blockstun: 10, kx: 0, hitstop: 6, chip: 0, height: 'mid', isProj: true }, { x: f.x + f.face * 60, y: f.y - 120, vx: 0 }, null);
      },
    }),
    sup: SP({
      name: 'הצדעה כחולה־לבנה', desc: 'גל הצדעה ענק פורץ לשני הכיוונים ומעיף את כל מי שבטווח.', icon: 'nova', frames: 90, anim: 'summon', glow: '#6ec6ff', invAfter: 24,
      ai: { min: 0, max: 460, kind: 'close' },
      tick(f, t, B) {
        if (t < 36) f.inv = Math.max(f.inv, 2);
        if (t === 14) {
          Snd.play('boom');
          B.ent({ kind: 'nova', owner: f, dir: f.face, x: f.x, y: f.y - 100, w: 40, h: 230, r: 30, dmg: 36, hitstun: 50, blockstun: 22, kx: 11, ky: -10, knockdown: true, life: 30, pierce: true, interval: 999, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 12,
            onTick(e) { e.r += 20; e.w = e.r * 2; e.x = e.owner.x; Fx.shake(4); },
            draw(ctx, e) { ctx.save(); ENT.nova(ctx, { r: e.r, col: '#4a8bff', col2: '#ffffff' }); ctx.scale(-1, 1); ENT.nova(ctx, { r: e.r, col: '#4a8bff', col2: '#ffffff' }); ctx.restore(); } });
          Fx.flash('#bfe0ff', 0.5);
        }
      },
    }),
    quotes: { intro: ['!מתקדמים בשורות', '!כל היחידה ערוכה'], win: ['!המשימה הושלמה'], lose: ['!נסיגה טקטית'] },
    ending: 'המשימה הושלמה. מסדר מפקד קצר, ואז הביתה בזמן ובלי קומבינות.',
  }),

  // ============================================================================ גולן
  fighterDef({
    id: 'golan', name: 'יאיר גולן', short: 'גולן', party: 'dem', title: 'רוח המחאה', arch: 'מתאושש', role: 'יו״ר הדמוקרטים',
    blurb: 'ככל שהוא נדחק לפינה, הוא נעשה מסוכן יותר. הרחוב תמיד איתו.',
    stats: { hp: 125, spd: 0.95, pow: 1.04 }, rating: { pow: 4, spd: 3, def: 3, rng: 3, dif: 2 },
    ai: { style: 'balanced', space: 170 },
    passive: {
      id: 'protest', name: 'רוח המחאה', desc: 'מתחת ל-40% חיים: +25% נזק, +15% מהירות, וההייפ נטען מעצמו.',
      dmgOut(f) { return f.hp / f.maxHp < 0.4 ? 1.25 : 1; },
      spd(f) { return f.hp / f.maxHp < 0.4 ? 1.15 : 1; },
      tick(f) { if (f.hp / f.maxHp < 0.4 && f.hp > 0) f.gain(0.012); },
      aura(f) { return f.hp / f.maxHp < 0.4 && f.hp > 0 ? '#38b56a' : null; },
    },
    normals: {
      L: ['אגרוף מחאה', 'jab'],
      H: ['מכת שלט', 'swing', { prop: 'sign', dmg: 10, startup: 14, hb: [26, -170, 104, 100] }],
      FH: ['שלט מלמעלה', 'slam', { dmg: 10.5 }],
      DL: ['בעיטת מדרכה', 'lowkick'],
      DH: ['קפיצת מחאה', 'uppercut'],
    },
    sp1: spCast({
      name: 'שלט מחאה', desc: 'שלט בומרנג: פוגע בדרך החוצה ושוב בדרך חזרה.', icon: 'sign', frames: 32, release: 12, cd: 210,
      ai: { min: 150, max: 560, kind: 'zone' },
      shots: [{ kind: 'sign', ox: 40, oy: -140, vx: 8.5, w: 84, h: 70, dmg: 6, hitstun: 18, blockstun: 11, kx: 4, life: 100, maxHits: 2, interval: 22, clash: false,
        onTick(e) { e.spin = e.t * 0.32; if (e.t === 34) e.vx = -e.vx * 1.05; if (e.t > 34 && (e.x - e.owner.x) * e.dir < 0) e.dead = true; } }],
    }),
    sp2: SP({
      name: 'קריאה לרחוב', desc: 'שלושה מפגינים רצים קדימה, כל אחד בועט פעם אחת.', icon: 'crowd', frames: 46, release: 14, cd: 380, anim: 'summon', ai: { min: 150, max: 600, kind: 'zone' },
      tick(f, t, B) {
        if (t >= 14 && t <= 34 && (t - 14) % 10 === 0) { minion(B, f, { lookId: pick(CROWD), vx: 9.5, sc: 0.62, dmg: 4.4, x: f.x - f.face * 50, hitstun: 20 }); if (t === 14) Snd.play('dash'); }
      },
    }),
    sup: SP({
      name: 'הפגנה המונית', desc: 'גל אנושי עצום שוטף את המסך ומרסק כל מה שבדרכו.', icon: 'crowd', frames: 100, anim: 'summon', glow: '#38b56a', invAfter: 30,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 50) f.inv = Math.max(f.inv, 2);
        if (t === 14) {
          Snd.play('crowd');
          B.ent({ kind: 'shadow', owner: f, dir: f.face, x: f.x - f.face * 200, y: GROUND - 90, vx: f.face * 9.5, w: 280, h: 210, dmg: 31, hitstun: 52, blockstun: 22, kx: 9, ky: -9, knockdown: true, life: 210, pierce: true, interval: 999, isSuper: true, chip: 0.3, clash: false, z: 1, hitstop: 12, noDraw: true,
            onTick(e) { if (e.t % 6 === 0) Fx.shake(3); }, draw() {} });
          for (let i = 0; i < 16; i++) {
            const m = minion(B, f, { lookId: pick(CROWD), vx: 9.5, sc: 0.6 + (i % 3) * 0.08, dmg: 0, x: f.x - f.face * (120 + (i % 8) * 30), noHit: true, life: 210 });
            m.z = i % 2 ? 1 : 0; m.y += (i % 2) * 6; m.dmg = 0; m.noHit = true;
          }
        }
      },
    }),
    quotes: { intro: ['!עומדים ונלחמים', '!הרחוב איתי'], win: ['!ניצחון לרחוב'], lose: ['!נחזור בעוד הפגנה'] },
    ending: 'הרחוב מריע, השלטים מתנופפים, ואף אחד לא זוכר מי התחיל את המכות.',
  }),

  // ============================================================================ עודה
  fighterDef({
    id: 'odeh', name: 'איימן עודה', short: 'עודה', party: 'hadash', title: 'גשר', arch: 'זריז', role: 'חבר כנסת · יו״ר חד״ש היוצא (לא מתמודד ב-2026)',
    blurb: 'קופץ פעמיים, חוצה פערים וממשיך לדבר. קשה לתפוס אותו במקום אחד.',
    stats: { hp: 124, spd: 1.1, pow: 1.07, jump: 1.05 }, rating: { pow: 2, spd: 5, def: 2, rng: 3, dif: 4 },
    ai: { style: 'rush', space: 150 },
    passive: { id: 'bridge', name: 'גשר', desc: 'קפיצה כפולה באוויר.', airJumps: 1 },
    normals: {
      L: ['לחיצת יד', 'jab', { startup: 4, dmg: 3.8 }],
      H: ['בעיטת גשר', 'highkick', { dmg: 8.8, startup: 10 }],
      FH: ['נאום מרגש', 'chop'],
      DL: ['מכה נמוכה', 'lowkick'],
      DH: ['הרמת ידיים', 'uppercut'],
    },
    sp1: spCast({
      name: 'יונת שלום', desc: 'יונה שמחפשת את היריב בדרך מתנופפת.', icon: 'dove', frames: 34, release: 13, cd: 200,
      ai: { min: 200, max: 800, kind: 'zone' },
      shots: [{ kind: 'dove', ox: 44, oy: -150, vx: 6.5, w: 56, h: 44, dmg: 8.5, hitstun: 20, blockstun: 12, kx: 4, life: 130, home: 0.1, homeMax: 3.4, wave: { f: 0.3, a: 0.5 },
        onTick(e) { if (e.t % 5 === 0) Fx.feathers(e.x, e.y, 1); } }],
    }),
    sp2: SP({
      name: 'גשר מעל הפער', desc: 'חוצה את היריב במהירות, פוגע בדרך ונוחת מאחוריו.', icon: 'wind', frames: 40, release: 6, cd: 250, anim: 'dash', ai: { min: 100, max: 420, kind: 'gap' },
      tick(f, t, B) {
        const o = f.opp;
        if (t === 0) { f.mi.start = f.face; Snd.play('dash'); }
        f.noPush = true;
        if (t >= 6 && t < 26) {
          f.vx = f.mi.start * 15; f.trailOn = true; f.inv = Math.max(f.inv, 2);
          if (!f.mi.crossed) {
            const r = f.strike([-20, -156, 90, 156], { dmg: 8.5, hitstun: 24, blockstun: 10, kx: 3, hitstop: 5, height: 'mid', chip: 0.1 }, 'cross');
            if (r !== 'miss') f.mi.crossed = true;
          }
          if ((o.x - f.x) * f.mi.start < -90) { f.vx *= 0.3; f.mt = Math.max(f.mt, 27); }
        }
        if (t >= 26) f.vx *= 0.6;
      },
    }),
    sup: SP({
      name: 'להקת יונים', desc: 'תשע יונים מסתחררות סביבו ואז יורדות על היריב בזו אחר זו.', icon: 'dove', frames: 110, anim: 'summon', glow: '#ffffff', invAfter: 40,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 70) f.inv = Math.max(f.inv, 2);
        if (t === 8) { Snd.play('heal'); Fx.feathers(f.x, f.y - 120, 24); }
        for (let i = 0; i < 9; i++) {
          if (t === 12 + i * 6) {
            const ang = (i / 9) * TAU;
            B.ent({ kind: 'dove', owner: f, dir: f.face, x: f.x + Math.cos(ang) * 110, y: f.y - 150 + Math.sin(ang) * 70, vx: f.face * 1.5, vy: -1.5, w: 60, h: 48, dmg: 5, hitstun: 20, blockstun: 10, kx: 2, life: 110, home: 0.14, homeMax: 6, isSuper: true, chip: 0.25, clash: false, hitstop: 4,
              onTick(e) { e.vx += e.dir * 0.42; e.vx = clamp(e.vx, -9, 9); if (e.t % 4 === 0) Fx.feathers(e.x, e.y, 1); } });
          }
        }
      },
    }),
    quotes: { intro: ['!ביחד ננצח', '!תנו לי במה'], win: ['!שותפות מנצחת'], lose: ['!נמשיך לדבר'] },
    ending: 'בסוף כולם יושבים סביב אותו שולחן ומגלים שיש מספיק בורקס לכולם.',
  }),

  // ============================================================================ עבאס
  fighterDef({
    id: 'abbas', name: 'מנסור עבאס', short: 'עבאס', party: 'raam', title: 'לשון המאזניים', arch: 'מכריע', role: 'יו״ר רע״מ · ועדת הבחירות פסלה את הרשימה, ממתין לבג״ץ',
    blurb: 'כשהקרב צמוד, הוא זה שמטה את הכף. אוהב לחכות עד הרגע הנכון.',
    stats: { hp: 124, spd: 1, pow: 1.05 }, rating: { pow: 3, spd: 3, def: 3, rng: 3, dif: 3 },
    ai: { style: 'balanced', space: 200 },
    passive: {
      id: 'kingmaker', name: 'לשון המאזניים', desc: 'כשהתוצאה צמודה (הפרש עד 18% חיים): +22% נזק ו-10% מהירות.',
      dmgOut(f) { return Math.abs(f.hp / f.maxHp - f.opp.hp / f.opp.maxHp) <= 0.18 ? 1.22 : 1; },
      spd(f) { return Math.abs(f.hp / f.maxHp - f.opp.hp / f.opp.maxHp) <= 0.18 ? 1.1 : 1; },
      aura(f) { return f.hp > 0 && Math.abs(f.hp / f.maxHp - f.opp.hp / f.opp.maxHp) <= 0.18 ? '#a5d63c' : null; },
    },
    normals: {
      L: ['אגרוף מאוזן', 'jab'],
      H: ['בעיטה מכריעה', 'cross', { dmg: 9.6 }],
      FH: ['הכרעה מלמעלה', 'point'],
      DL: ['מכה נמוכה', 'lowkick'],
      DH: ['שלושה קולות', 'uppercut'],
    },
    sp1: spCast({
      name: 'פתק הצבעה', desc: 'פתק שנזרק בקשת ומקפץ על הרצפה.', icon: 'ballot', frames: 32, release: 12, cd: 190,
      ai: { min: 180, max: 700, kind: 'zone' },
      shots: [{ kind: 'ballot', ox: 40, oy: -142, vx: 7.5, vy: -6.5, g: 0.34, bounce: 0.38, w: 42, h: 52, dmg: 9, hitstun: 22, blockstun: 13, kx: 5, life: 120 }],
    }),
    sp2: SP({
      name: 'החלפת צדדים', desc: 'נעלם ונוחת מאחורי היריב עם מכה מהירה.', icon: 'swap', frames: 38, release: 8, cd: 300, anim: 'dash', ai: { min: 60, max: 480, kind: 'gap' },
      tick(f, t, B) {
        const o = f.opp;
        if (t === 8) {
          Fx.dust(f.x, GROUND, 0, 8); Fx.stars(f.x, f.y - 90, 8, '#a5d63c', 5); Snd.play('flash');
          const side = o.x >= f.x ? 1 : -1;
          let nx = o.x + side * 76;
          if (nx < WALL_L + 20 || nx > WALL_R - 20) nx = o.x - side * 76;
          f.x = clamp(nx, WALL_L, WALL_R); f.face = o.x >= f.x ? 1 : -1; f.vx = 0;
          Fx.dust(f.x, GROUND, 0, 8); Fx.stars(f.x, f.y - 90, 8, '#a5d63c', 5);
          f.inv = Math.max(f.inv, 6);
        }
        if (t === 16) f.strike([10, -152, 92, 80], { dmg: 6.5, hitstun: 22, blockstun: 12, kx: 5, hitstop: 6, height: 'mid', chip: 0.1 }, 'swap');
      },
    }),
    sup: SP({
      name: 'מנדט מכריע', desc: 'שיפוט מהשמיים: פוגע במי שעל הקרקע ומאזן את החיים לטובתו.', icon: 'scales', frames: 96, anim: 'summon', glow: '#a5d63c', invAfter: 30,
      ai: { min: 0, max: 900, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 44) f.inv = Math.max(f.inv, 2);
        if (t === 6) B.ent({ kind: 'scales', owner: f, dir: f.face, x: o.x, y: 130, noHit: true, dmg: 0, life: 44, tilt: 0, isProj: false, clash: false, z: 1,
          onTick(e) { e.x = e.owner.opp.x; e.tilt = Math.sin(e.t * 0.3) * 0.3; }, draw(ctx, e) { ctx.scale(1.2, 1.2); ENT.scales(ctx, e); } });
        if (t === 36) {
          Snd.play('boom'); Fx.flash('#eaffb8', 0.6);
          if (o.grounded && o.hurtable()) {
            B.hit(f, o, superInfo({ dmg: 27, hitstun: 44, kx: 4, ky: -9, knockdown: true, unblockable: true, hitstop: 14,
              onHit(att, def) { const diff = def.hp - att.hp; if (diff > 0) att.heal(diff * 0.5); } }), null, null);
          } else Fx.text(o.x, o.y - 200, '!פספסת', { size: 26, col: '#eaffb8', life: 50 });
        }
      },
    }),
    quotes: { intro: ['!הקול שלי מכריע', '!אני זה שמטה את הכף'], win: ['!המאזניים הכריעו'], lose: ['!נחזור למשא ומתן'] },
    ending: 'המאזניים נחו סוף סוף באמצע. כל הצדדים מודים שהכול נשאר פתוח.',
  }),

  // ============================================================================ טיבי
  fighterDef({
    id: 'tibi', name: 'אחמד טיבי', short: 'טיבי', party: 'taal', title: 'שנינות', arch: 'חד לשון', role: 'יו״ר תע״ל · מס׳ 2 ברשימה המשותפת · הרשימה נפסלה בוועדת הבחירות, ממתין לבג״ץ',
    blurb: 'מחזיר כל קליע לשולח. הפאנץ׳ליין תמיד מגיע בזמן.',
    stats: { hp: 116, spd: 1.05, pow: 1.02 }, rating: { pow: 3, spd: 4, def: 2, rng: 4, dif: 4 },
    ai: { style: 'zone', space: 260 },
    passive: { id: 'wit', name: 'שנינות', desc: 'חסימה של קליע מחזירה אותו לשולח, מהר יותר.', reflect: true },
    normals: {
      L: ['עקיצה', 'jab', { startup: 4, dmg: 3.8 }],
      H: ['פאנץ׳ליין', 'kick'],
      FH: ['הערת שוליים', 'swing', { prop: 'mic', dmg: 9.8, startup: 17, hb: [30, -200, 96, 140] }],
      DL: ['הערה נמוכה', 'lowkick'],
      DH: ['תשובה מנצחת', 'uppercut'],
    },
    sp1: spCast({
      name: 'חץ שנון', desc: 'שתי עקיצות מהירות, אחת גבוהה ואחת נמוכה.', icon: 'quip', frames: 36, cd: 160,
      ai: { min: 160, max: 800, kind: 'zone' },
      shots: [
        { kind: 'quip', ox: 40, oy: -140, vx: 14, w: 52, h: 30, dmg: 6.5, hitstun: 18, blockstun: 10, kx: 3, life: 60, at: 10 },
        { kind: 'quip', ox: 40, oy: -60, vx: 14, w: 52, h: 30, dmg: 6.5, hitstun: 18, blockstun: 10, kx: 3, life: 60, n: 1, at: 20, height: 'low' },
      ],
    }),
    sp2: spCast({
      name: 'הפלת מיקרופון', desc: 'זורק מיקרופון שנוחת ומפוצץ גל הלם על הרצפה.', icon: 'mic', frames: 40, release: 15, cd: 270,
      ai: { min: 150, max: 560, kind: 'zone' },
      shots: [{ kind: 'mic', ox: 30, oy: -170, vx: 6.4, vy: -3, g: 0.5, ground: true, w: 34, h: 66, dmg: 4, hitstun: 12, blockstun: 8, kx: 2, life: 130, clash: true,
        onHit(e, def, r, B) { if (r === 'hit') tibiShock(e, B); },
        onLand(e, B) { if (!e.shocked) tibiShock(e, B); } }],
    }),
    sup: SP({
      name: 'מופע סולו', desc: 'זרקור נועל את היריב במקום, ואז שורה של הכרזות מטלטלות.', icon: 'spot', frames: 120, anim: 'cast', release: 14, glow: '#fff2a0', invAfter: 30,
      ai: { min: 0, max: 520, kind: 'zone' },
      tick(f, t, B) {
        const o = f.opp;
        if (t < 90) f.inv = Math.max(f.inv, 2);
        if (t === 14) {
          if (Math.abs(o.x - f.x) < 560 && o.grounded && o.hurtable()) {
            f.mi.cage = true; o.applyStun(96); o.vx = 0;
            B.ent({ kind: 'spot', owner: f, dir: f.face, x: o.x, y: GROUND, noHit: true, dmg: 0, life: 92, h: 380, top: 60, bot: 170, z: 1, isProj: false, clash: false, onTick(e) { e.x = e.owner.opp.x; } });
            Snd.play('flash');
          } else Fx.text(f.x, f.y - 215, '!הקהל לא הגיע', { size: 22, col: '#fff2a0', life: 50 });
        }
        if (f.mi.cage && t >= 26 && t < 86 && (t - 26) % 7 === 0) {
          const last = t >= 82;
          o.x = o.x;
          B.hit(f, o, superInfo(last ? { dmg: 12, hitstun: 46, kx: 9, ky: -10, knockdown: true, unblockable: true, hitstop: 12 } : { dmg: 3.2, hitstun: 24, kx: 0.5, hitstop: 3, unblockable: true }), null, null);
          Fx.text(o.x + rnd(-40, 40), o.y - 160 + rnd(-30, 30), pick(['!חה', '!הא', '!בום', '!וואו']), { size: 26, col: '#fff2a0', life: 30 });
        }
      },
    }),
    quotes: { intro: ['!יש לי משפט אחד בשבילך', '!תחזיקו את הכיסאות'], win: ['!הפאנץ׳ליין הגיע'], lose: ['!אני מכין הערת שוליים'] },
    ending: 'הפאנץ׳ליין הגיע, האולם התפוצץ מצחוק, וגם היריבים צריכים להודות שזה היה טוב.',
  }),

  // ============================================================================ רגב
  fighterDef({
    id: 'regev', name: 'מירי רגב', short: 'רגב', party: 'likud', title: 'על הפסים', arch: 'קטר', role: 'שרת התחבורה · הליכוד',
    blurb: 'ככל שהיא רצה קדימה היא מגיעה למהירות שאי אפשר לעצור. פגיעה מחזירה אותה לתחנה.',
    stats: { hp: 132, spd: 1.06, pow: 1.06 }, rating: { pow: 4, spd: 4, def: 2, rng: 3, dif: 3 },
    ai: { style: 'rush', space: 140 },
    passive: {
      id: 'momentum', name: 'על הפסים', desc: 'ריצה קדימה בונה מומנטום: עד +40% מהירות ו-15% נזק. פגיעה מאפסת.',
      tick(f) {
        const fwd = (f.st === 'walk' && f.moveDir === f.face) || (f.st === 'dash' && f.dashDir === f.face);
        if (fwd) f.pv.m = Math.min(1, (f.pv.m || 0) + 0.02);
        else if (f.st === 'idle' || f.st === 'crouch' || f.st === 'block') f.pv.m = Math.max(0, (f.pv.m || 0) - 0.008);
      },
      spd(f) { return 1 + 0.4 * (f.pv.m || 0); },
      dmgOut(f) { return 1 + 0.15 * (f.pv.m || 0); },
      dmgIn(f) { return 1 - 0.12 * (f.pv.m || 0); },
      onTaken(f) { f.pv.m = 0; },
      aura(f) { return (f.pv.m || 0) > 0.7 ? '#ffd24a' : null; },
      hud(ctx, f, x, y, dir, s) { hudPips(ctx, f, x, y, dir, s, Math.round((f.pv.m || 0) * 8), 8, '#ffd24a', 'מומנטום'); },
    },
    normals: {
      L: ['דחיפת קרון', 'jab'],
      H: ['בעיטת פסים', 'kick', { lunge: { at: 3, len: 8, vx: 3.6 } }],
      FH: ['מכת רמזור', 'slam'],
      DL: ['מחסום', 'lowkick'],
      DH: ['מסילה עולה', 'uppercut'],
    },
    sp1: spCast({
      name: 'צופר רכבת', desc: 'גל צופר מתפוצץ שדוחף את היריב חזק אחורה.', icon: 'horn', frames: 32, release: 12, cd: 180, sfx: 'honk',
      ai: { min: 100, max: 620, kind: 'zone' },
      shots: [{ kind: 'horn', ox: 36, oy: -110, vx: 9.5, w: 70, h: 136, dmg: 8.5, hitstun: 20, blockstun: 14, kx: 13, life: 80, dur: 2 }],
    }),
    sp2: SP({
      name: 'רכבת קלה', desc: 'רכבת קלה עוברת על הקרקע אחרי אזהרה קצרה. אפשר לקפוץ מעליה.', icon: 'tram', frames: 44, release: 12, cd: 400, anim: 'summon', glow: '#e2323f', ai: { min: 0, max: 700, kind: 'trap' },
      tick(f, t, B) {
        if (t === 12) {
          const dir = f.face;
          B.ent({ kind: 'sign', owner: f, dir, x: f.x - dir * 90, y: GROUND - 250, noHit: true, dmg: 0, life: 42, z: 1, isProj: false, clash: false, noFlip: true, draw(ctx, e) { ctx.scale(0.8, 0.8); const bl = Math.floor(e.t / 5) % 2; ctx.fillStyle = bl ? '#ff5a5a' : '#ffe14a'; rr(ctx, -70, -30, 140, 60, 8); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); T(ctx, 'מגיעה בעוד 3 דק׳', 0, 0, { size: 16, fill: '#1b1330', weight: 900 }); } });
          Snd.play('siren');
        }
        if (t === 34) {
          const dir = f.face;
          B.ent({ kind: 'tram', owner: f, dir, x: f.x - dir * 560, y: GROUND - 55, vx: dir * 17, w: 230, h: 112, dmg: 21, hitstun: 42, blockstun: 18, kx: 10, ky: -8, knockdown: true, life: 200, pierce: true, interval: 999, isProj: true, clash: false, chip: 0.2, z: 1, hitstop: 9,
            onTick(e) { if (e.t % 3 === 0) Fx.shake(3); } });
          Snd.play('honk');
        }
      },
    }),
    sup: SP({
      name: 'קו ישיר', desc: 'רכבת שלמה בארבע קרונות דוהרת דרך האולם, פוגעת שוב ושוב.', icon: 'train', frames: 100, anim: 'summon', glow: '#ffd24a', invAfter: 30,
      ai: { min: 0, max: 800, kind: 'zone' },
      tick(f, t, B) {
        if (t < 60) f.inv = Math.max(f.inv, 2);
        [14, 22, 30, 38].forEach((at, i) => {
          if (t !== at) return;
          if (i === 0) Snd.play('honk');
          B.ent({ kind: 'train', n: i, owner: f, dir: f.face, x: f.x - f.face * 480, y: GROUND - 52, vx: f.face * 19, w: 200, h: 104, dmg: i === 3 ? 13 : 8.8, hitstun: 30, blockstun: 16, kx: 6, ky: i === 3 ? -9 : 0, knockdown: i === 3, life: 200, pierce: true, interval: 999, isSuper: true, chip: 0.25, clash: false, z: 1, hitstop: 6,
            onTick(e) { if (e.t % 3 === 0) Fx.shake(4); } });
        });
      },
    }),
    quotes: { intro: ['!הרכבת יוצאת', '!תעלו על המסלול'], win: ['!הגעתי בזמן... בערך'], lose: ['!עיכוב בקו'] },
    ending: 'הרכבת הגיעה בדיוק בזמן. כלומר, באיחור אופנתי של שלוש דקות.',
  }),
];

function tibiShock(e, B) {
  if (e.shocked) return;
  e.shocked = true; e.dead = true;
  Snd.play('boom'); Fx.shake(9); Fx.ring(e.x, GROUND - 4, 10, 150, 'rgba(255,255,255,.9)', 16, 6);
  B.ent({ kind: 'shadow', owner: e.owner, dir: e.dir, x: e.x, y: GROUND - 34, w: 260, h: 70, noHit: false, dmg: 11, hitstun: 32, blockstun: 14, kx: 8, ky: -8, knockdown: true, life: 6, pierce: false, isProj: true, clash: false, z: 1, chip: 0.2, draw() {}, hitstop: 8, height: 'mid' });
}

const ROSTER_BY_ID = {};
ROSTER.forEach((d) => { ROSTER_BY_ID[d.id] = d; });

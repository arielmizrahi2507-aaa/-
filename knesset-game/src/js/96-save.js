// ===== Persistence, statistics, achievements =====
const ACHIEVEMENTS = [
  { id: 'first_win', name: 'ניצחון ראשון', desc: 'נצחו קרב אחד.', test: (d) => d.wins >= 1 },
  { id: 'wins10', name: 'חבר כנסת ותיק', desc: 'נצחו 10 קרבות.', test: (d) => d.wins >= 10 },
  { id: 'combo10', name: 'קומבו של 10', desc: 'חבטו עשר פעמים ברצף.', test: (d) => d.bestCombo >= 10 },
  { id: 'flawless', name: 'ניצחון מוחלט', desc: 'נצחו סיבוב בלי לספוג פגיעה.', test: (d) => d.flawless >= 1 },
  { id: 'perfect5', name: 'בלוק מושלם ×5', desc: 'בצעו חמישה בלוקים מושלמים.', test: (d) => d.perfects >= 5 },
  { id: 'supers20', name: 'מלך הסופרים', desc: 'הפעילו 20 סופרים.', test: (d) => d.supers >= 20 },
  { id: 'arcade', name: 'ראש הממשלה', desc: 'סיימו מסע לראשות הממשלה.', test: (d) => Object.keys(d.arcadeClears).length >= 1 },
  { id: 'arcade_hard', name: 'הבחירות הקשות', desc: 'סיימו מסע בקושי הגבוה.', test: (d) => d.hardClear >= 1 },
  { id: 'boss', name: 'מעל האחוז', desc: 'הביסו את אחוז החסימה.', test: (d) => d.bossBeaten >= 1 },
  { id: 'wave10', name: 'מרתון חקיקה: גל 10', desc: 'הגיעו לגל 10 במרתון.', test: (d) => d.survivalBest >= 10 },
  { id: 'comeback', name: 'המהפך', desc: 'נצחו קרב כשנשארו לכם פחות מ-10% חיים.', test: (d) => d.comebacks >= 1 },
  { id: 'allchars', name: 'כל הבית', desc: 'נצחו עם כל הלוחמים בסגל.', test: (d) => ROSTER.every((r) => (d.winsBy[r.id] || 0) >= 1) },
  { id: 'throws10', name: 'זריקה לחדר', desc: 'בצעו 10 זריקות.', test: (d) => d.throws >= 10 },
  { id: 'burekas', name: '!בורקס', desc: 'ראו את הבורקס הסודי מציץ בפינה.', test: (d) => d.burekas >= 1 },
  { id: 'daily3', name: 'רצף יומי', desc: 'סיימו אתגר יומי 3 ימים ברצף.', test: (d) => d.daily.best >= 3 },
];

const RANKS = [
  [0, 'מתמחה בלשכה'], [3, 'עוזר פרלמנטרי'], [8, 'חבר כנסת מתחיל'], [15, 'יושב ראש ועדה'], [30, 'שר בממשלה'],
  [50, 'סגן ראש הממשלה'], [80, 'ראש הממשלה'], [130, 'ראש ממשלה לכל החיים'], [220, 'מלך המנדטים'],
];
function rankOf(wins) {
  let r = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) { if (wins >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } }
  return { name: r[1], next: next ? next[0] - wins : 0, nextName: next ? next[1] : '' };
}

const Save = {
  key: 'ks_smackdown_v1',
  d: null,

  defaults() {
    return {
      v: 1, wins: 0, losses: 0, matches: 0, ko: 0, supers: 0, perfects: 0, throws: 0, bestCombo: 0, flawless: 0, comebacks: 0,
      burekas: 0, hardClear: 0, bossBeaten: 0, winsBy: {}, arcadeClears: {}, survivalBest: 0, unlocked: {}, ach: {},
      daily: { date: '', streak: 0, best: 0, done: {} },
      settings: { sfx: 0.8, music: 0.5, shake: true, calm: false, touch: 'auto', muted: false, rounds: 2, timer: 60, rotate: 'auto', rotateSet: false, gfx3d: true },
    };
  },

  load() {
    const def = this.defaults();
    try {
      const raw = localStorage.getItem(this.key);
      const got = raw ? JSON.parse(raw) : {};
      this.d = Object.assign(def, got);
      this.d.settings = Object.assign(def.settings, got.settings || {});
      if (!this.d.settings.rotateSet) this.d.settings.rotate = 'auto';       // the old default was 'off'; landscape-first is the new default
      this.d.daily = Object.assign(this.defaults().daily, got.daily || {});
    } catch (e) { this.d = def; }
    return this.d;
  },

  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { /* storage may be blocked */ } },

  isUnlocked(def) {
    if (!def.unlock) return true;
    if (this.d.unlocked[def.id]) return true;
    if (def.unlock.wins && this.d.wins >= def.unlock.wins) return true;
    if (def.unlock.arcade && Object.keys(this.d.arcadeClears).length > 0) return true;
    return false;
  },

  // Returns the list of newly earned achievement definitions
  checkAchievements() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.d.ach[a.id] && a.test(this.d)) { this.d.ach[a.id] = Date.now(); fresh.push(a); }
    }
    if (fresh.length) this.save();
    return fresh;
  },
};

function todayKey() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- Survival "bills" (roguelite upgrades) ----
const BILLS = [
  { id: 'omnibus', name: 'חוק ההסדרים', desc: '+30 חיים מקסימליים, ומרפא 30 מיד.', icon: 'heart', col: '#7dff9a', apply: (m) => { m.hp = (m.hp || 0) + 30; m.healNow = (m.healNow || 0) + 30; } },
  { id: 'amend', name: 'תיקון לחוק היסוד', desc: '+12% נזק לכל המכות.', icon: 'fist', col: '#ff8a3d', apply: (m) => { m.dmg = (m.dmg || 1) * 1.12; } },
  { id: 'shorten', name: 'חוק הקיצור', desc: 'יכולות מיוחדות נטענות מהר ב-25%.', icon: 'bolt', col: '#ffe14a', apply: (m) => { m.cd = (m.cd || 1) * 0.75; } },
  { id: 'noise', name: 'חוק הרעש', desc: 'ההייפ מתמלא מהר ב-40%.', icon: 'bolt', col: '#5ad7ff', apply: (m) => { m.meter = (m.meter || 1) * 1.4; } },
  { id: 'freepass', name: 'חוק המעבר החופשי', desc: '+10% מהירות ריצה.', icon: 'wind', col: '#a5d63c', apply: (m) => { m.spd = (m.spd || 1) * 1.1; } },
  { id: 'rescue', name: 'חוק ההצלה', desc: 'בכל קרב: שורדים מכה קטלנית אחת עם מנדט אחד.', icon: 'shieldIcon', col: '#ffd94a', apply: (m) => { m.saveOnce = true; } },
  { id: 'immunity', name: 'חוק החסינות', desc: '-15% נזק נכנס.', icon: 'shieldIcon', col: '#c3ccd9', apply: (m) => { m.taken = (m.taken || 1) * 0.85; } },
  { id: 'squeeze', name: 'חוק הסחיטה', desc: '8% מהנזק שגורמים חוזר כחיים.', icon: 'heart', col: '#ff8ac0', apply: (m) => { m.lifesteal = (m.lifesteal || 0) + 0.08; } },
  { id: 'corridor', name: 'חוק המסדרון', desc: 'כל קרב מתחיל עם 40 הייפ.', icon: 'star', col: '#8fc4ff', apply: (m) => { m.startMeter = (m.startMeter || 0) + 40; } },
  { id: 'dismiss', name: 'חוק ההדחה', desc: '+15% נזק ליריב שנמצא מתחת ל-50% חיים.', icon: 'scissors', col: '#e23b52', apply: (m) => { m.execute = true; } },
];

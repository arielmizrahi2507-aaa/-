// ============================================================================
// storage.js
// ----------------------------------------------------------------------------
// היסטוריית זריקות: תמיד נשמרת מקומית (localStorage), לפי משתמש מחובר או
// כאורח, כדי ש"שמירת המידע" תעבוד גם בלי שום הגדרה. אם הוגדר
// FIREBASE_CONFIG (ראו authConfig.js) ההיסטוריה גם מסתנכרנת ל-Firestore
// כדי לעבוד בין מכשירים - שכבה נוספת מעל האחסון המקומי, לא תחליף לו: כשל
// ברשת/בענן לעולם לא מפיל את השמירה המקומית.
// ============================================================================

import { FIREBASE_CONFIG } from "./authConfig.js";

const MAX_HISTORY = 50;
const FIREBASE_SDK_VERSION = "10.14.1";

function keyFor(userId) {
  return `shotiq_history_${userId || "guest"}`;
}

function summarize(report) {
  const categories = {};
  for (const [k, c] of Object.entries(report.categories || {})) {
    categories[k] = c.score;
  }
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    overallScore: report.overallScore,
    shootingSide: report.shootingSide,
    categories,
    topFlawIds: (report.topFlaws || []).map((f) => f.id),
    location: null, // { xPct, yPct, distanceM, zone } - נקבע אחר כך ע"י courtMap.js
    takenAt: null, // מתי הזריקה בפועל בוצעה (ms) - נפרד מ-ts שהוא זמן השמירה
  };
}

export class ShotHistory {
  constructor() {
    this.cloud = null;
    this.cloudReady = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey ? this._initCloud() : Promise.resolve(false);
  }

  async _initCloud() {
    try {
      const [{ initializeApp }, firestore] = await Promise.all([
        import(/* webpackIgnore: true */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
        import(/* webpackIgnore: true */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = initializeApp(FIREBASE_CONFIG);
      this.cloud = { db: firestore.getFirestore(app), ...firestore };
      return true;
    } catch (e) {
      this.cloud = null;
      return false;
    }
  }

  getLocal(userId) {
    try {
      const raw = localStorage.getItem(keyFor(userId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  async save(userId, report) {
    const entry = summarize(report);
    const list = this.getLocal(userId);
    list.push(entry);
    while (list.length > MAX_HISTORY) list.shift();
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(list));
    } catch (e) {
      /* localStorage מלא/חסום - ההיסטוריה בזיכרון עדיין תוצג בסשן הנוכחי */
    }
    await this.cloudReady;
    if (this.cloud && userId) {
      try {
        const ref = this.cloud.doc(this.cloud.db, "users", userId, "shots", entry.id);
        await this.cloud.setDoc(ref, entry);
      } catch (e) {
        // כשל בסנכרון ענן לא אמור לשבור את השמירה המקומית שכבר הצליחה
      }
    }
    return { entry, list };
  }

  async updateLocation(userId, entryId, { location, takenAt }) {
    const list = this.getLocal(userId);
    const entry = list.find((e) => e.id === entryId);
    if (!entry) return null;
    entry.location = location;
    entry.takenAt = takenAt;
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(list));
    } catch (e) {
      /* localStorage מלא/חסום - העדכון עדיין ישמש בסשן הנוכחי */
    }
    await this.cloudReady;
    if (this.cloud && userId) {
      try {
        const ref = this.cloud.doc(this.cloud.db, "users", userId, "shots", entryId);
        await this.cloud.setDoc(ref, entry);
      } catch (e) {
        // כשל בסנכרון ענן לא אמור לשבור את העדכון המקומי שכבר הצליח
      }
    }
    return entry;
  }

  async pullCloud(userId) {
    await this.cloudReady;
    if (!this.cloud || !userId) return null;
    try {
      const q = this.cloud.query(
        this.cloud.collection(this.cloud.db, "users", userId, "shots"),
        this.cloud.orderBy("ts", "asc")
      );
      const snap = await this.cloud.getDocs(q);
      const list = snap.docs.map((d) => d.data());
      if (list.length) {
        localStorage.setItem(keyFor(userId), JSON.stringify(list.slice(-MAX_HISTORY)));
      }
      return list;
    } catch (e) {
      return null;
    }
  }

  clear(userId) {
    try {
      localStorage.removeItem(keyFor(userId));
    } catch (e) {}
  }
}

// ============================================================================
// storage.js
// ----------------------------------------------------------------------------
// היסטוריית זריקות: תמיד נשמרת מקומית (localStorage), לפי משתמש מחובר או
// כאורח, כדי ש"שמירת המידע" תעבוד גם בלי שום הגדרה. אם הוגדר
// FIREBASE_CONFIG (ראו authConfig.js) ההיסטוריה גם מסתנכרנת ל-Firestore
// כדי לעבוד בין מכשירים - שכבה נוספת מעל האחסון המקומי, לא תחליף לו: כשל
// ברשת/בענן לעולם לא מפיל את השמירה המקומית.
//
// שני סוגי שמירה שונים בכוונה:
// - סיכום (localStorage, keyFor/summarize) - קל, עד MAX_HISTORY זריקות,
//   מספיק לגרף המגמה ולרשימת ההיסטוריה הקומפקטית.
// - פרטים מלאים (IndexedDB, saveDetail/getDetail) - הדוח המלא, פריימי השלד
//   (ל-3D replay) והסרטון המקורי עצמו (Blob) - כבד מדי ל-localStorage, ולכן
//   נשמר רק לעד MAX_FULL_DETAIL הזריקות האחרונות, כדי "להיכנס" לזריקה ישנה
//   ולראות שוב את כל מה שנראה בזמן הניתוח המקורי.
// ============================================================================

import { FIREBASE_CONFIG } from "./authConfig.js";

const MAX_HISTORY = 50;
const MAX_FULL_DETAIL = 15;
const FIREBASE_SDK_VERSION = "10.14.1";
const DETAIL_DB_NAME = "shotiq_details";
const DETAIL_STORE = "shots";

function keyFor(userId) {
  return `shotiq_history_${userId || "guest"}`;
}

// ------------------------------------------------------- IndexedDB details --
let detailDbPromise = null;
function openDetailDB() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (!detailDbPromise) {
    detailDbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DETAIL_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DETAIL_STORE)) {
          req.result.createObjectStore(DETAIL_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
  return detailDbPromise;
}

async function saveDetailRecord(record) {
  const db = await openDetailDB();
  if (!db) return false;
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DETAIL_STORE, "readwrite");
      tx.objectStore(DETAIL_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    await pruneDetailRecords(db);
    return true;
  } catch (e) {
    return false;
  }
}

async function pruneDetailRecords(db) {
  try {
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(DETAIL_STORE, "readonly");
      const req = tx.objectStore(DETAIL_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (all.length <= MAX_FULL_DETAIL) return;
    const toDelete = all.sort((a, b) => a.ts - b.ts).slice(0, all.length - MAX_FULL_DETAIL);
    const tx = db.transaction(DETAIL_STORE, "readwrite");
    for (const rec of toDelete) tx.objectStore(DETAIL_STORE).delete(rec.id);
  } catch (e) {
    // ניקוי רשומות ישנות הוא best-effort - כשל בו לא אמור לשבור שמירה
  }
}

async function getDetailRecord(id) {
  const db = await openDetailDB();
  if (!db) return null;
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DETAIL_STORE, "readonly");
      const req = tx.objectStore(DETAIL_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
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

  // extra: { frames, videoBlob } (אופציונלי) - נשמר בנפרד ב-IndexedDB כדי
  // לאפשר "להיכנס" לזריקה ישנה ולראות שוב את הסרטון והאנימציה, לא רק הציון.
  async save(userId, report, extra) {
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
    if (extra && (extra.frames || extra.videoBlob)) {
      saveDetailRecord({ id: entry.id, ts: entry.ts, report, frames: extra.frames || null, videoBlob: extra.videoBlob || null });
    }
    return { entry, list };
  }

  // מחזיר { report, frames, videoBlob } לזריקה שנשמרה לאחרונה (עד
  // MAX_FULL_DETAIL האחרונות), או null אם לא נמצאה/פגה (למשל זריקה ישנה
  // שרק הסיכום שלה עדיין קיים ב-localStorage).
  async getDetail(id) {
    return getDetailRecord(id);
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

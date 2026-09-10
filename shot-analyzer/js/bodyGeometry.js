// ============================================================================
// bodyGeometry.js
// ----------------------------------------------------------------------------
// מתמטיקת וקטורים תלת-ממדית ובניית "מערכת צירים אנטומית" (ימין הגוף / למעלה /
// קדימה) מתוך נקודות הציון התלת-ממדיות (worldLandmarks). משותף בין
// shotAnalyzer.js (מדידות ביומכניות שלא תלויות בזווית המצלמה) ו-shotReplay.js
// (רינדור האנימציה התלת-ממדית) - שני הצרכנים צריכים בדיוק את אותה מערכת צירים
// כדי שהזוויות/מיקומים יהיו עקביים בין הניתוח לתצוגה.
// ============================================================================

import { LM } from "./poseEngine.js";

export const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const mid3 = (a, b) => scale3(add3(a, b), 0.5);
export const len3 = (a) => Math.hypot(a.x, a.y, a.z);
export const dist3 = (a, b) => len3(sub3(a, b));
export const normalize3 = (a) => {
  const l = len3(a);
  return l > 1e-9 ? scale3(a, 1 / l) : { x: 0, y: 1, z: 0 };
};
export const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export function meanVec3(list) {
  let acc = { x: 0, y: 0, z: 0 };
  for (const v of list) acc = add3(acc, v);
  return scale3(acc, 1 / (list.length || 1));
}

// הזווית (במעלות) בנקודה b, בין הקטעים b->a ו-b->c - חישוב תלת-ממדי אמיתי,
// ולכן בלתי תלוי בזווית שממנה צולם הסרטון (בשונה מזווית שנמדדת על השלכה
// דו-ממדית של התמונה, שמתעוותת כשהתנועה לא מקבילה למישור המצלמה).
export function angleAt3D(a, b, c) {
  const v1 = sub3(a, b);
  const v2 = sub3(c, b);
  const mag = len3(v1) * len3(v2);
  if (mag === 0) return null;
  const cosv = Math.max(-1, Math.min(1, dot3(v1, v2) / mag));
  return (Math.acos(cosv) * 180) / Math.PI;
}

// ---------------------------------------------------- anatomical basis --
// בונה מערכת צירים משלנו (ימין הגוף / למעלה / קדימה) מתוך וקטורים אנטומיים
// יחסיים בלבד (כתפיים, ירכיים, כיוון האף) - כך שהיא לא תלויה במוסכמת הצירים
// הפנימית של MediaPipe, ולא בזווית/כיוון שממנו צולם הסרטון.
export function computeBodyBasis(frames, fromIdx = 0, toIdx = frames.length - 1) {
  const ups = [];
  const rights = [];
  const noseDirs = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    const wl = frames[i]?.worldLandmarks;
    if (!wl) continue;
    const lS = wl[LM.LEFT_SHOULDER], rS = wl[LM.RIGHT_SHOULDER];
    const lH = wl[LM.LEFT_HIP], rH = wl[LM.RIGHT_HIP];
    if (!lS || !rS || !lH || !rH) continue;
    const shoulderMid = mid3(lS, rS);
    const hipMid = mid3(lH, rH);
    ups.push(sub3(shoulderMid, hipMid));
    rights.push(sub3(rS, lS));
    const nose = wl[LM.NOSE];
    if (nose) noseDirs.push(sub3(nose, shoulderMid));
  }
  if (!ups.length) return null;
  const up = normalize3(meanVec3(ups));
  const rightRaw = meanVec3(rights);
  const right = normalize3(sub3(rightRaw, scale3(up, dot3(rightRaw, up))));
  let forward = normalize3(cross3(up, right));
  if (noseDirs.length) {
    const noseDir = meanVec3(noseDirs);
    if (dot3(forward, noseDir) < 0) forward = scale3(forward, -1);
  }
  return { up, right, forward };
}

const ALL_INDICES = [...new Set(Object.values(LM))];

// פורש כל פריים גולמי (worldLandmarks) למערכת הצירים האנטומית המשותפת -
// {x: ימין-הגוף, y: למעלה, z: קדימה}, במטרים, עם "החזקת" הערך האחרון הידוע
// לכל נקודה שנעלמה זמנית (חסימה/זיהוי חלקי) כדי למנוע קפיצות/חורים.
export function buildTransformedFrames(rawFrames, basis, indices = ALL_INDICES) {
  const last = {};
  const out = [];
  for (const f of rawFrames) {
    const wl = f.worldLandmarks;
    const lH = wl?.[LM.LEFT_HIP];
    const rH = wl?.[LM.RIGHT_HIP];
    const hipMid = lH && rH ? mid3(lH, rH) : null;
    const points = {};
    for (const idx of indices) {
      const p = wl?.[idx];
      if (p && hipMid) {
        const rel = sub3(p, hipMid);
        const transformed = { x: dot3(rel, basis.right), y: dot3(rel, basis.up), z: dot3(rel, basis.forward) };
        points[idx] = transformed;
        last[idx] = transformed;
      } else if (last[idx]) {
        points[idx] = last[idx];
      }
    }
    out.push({ t: f.t, points });
  }
  return out;
}

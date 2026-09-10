// ============================================================================
// shotAnalyzer.js
// ----------------------------------------------------------------------------
// מנוע הביומכניקה: לוקח סדרת פריימים עם worldLandmarks (נקודות שלד
// תלת-ממדיות, ראו poseEngine.js) ומחשב מדדים אמיתיים - זוויות מרפק וברך,
// יישור, בסיס, קצב, אומדן זווית שחרור וכו' - וממפה אותם לציונים ולטעויות
// מתוך knowledgeBase.js.
//
// חשוב: כל המדידות הגיאומטריות מחושבות בתלת-ממד אמיתי (מטרים, במערכת צירים
// אנטומית של הגוף - ראו bodyGeometry.js), ולא כהשלכה דו-ממדית על מישור
// התמונה. לכן הניתוח לא תלוי בזווית שממנה צולם הסרטון (מהצד, מלפנים, וכו') -
// בשונה מגרסה מוקדמת יותר של הכלי שמדדה זוויות/מרחקים על פיקסלים של התמונה,
// ולכן דייקה בעיקר בצילום מהצד.
//
// חשוב לשקיפות: לא כל היבט של הזריקה ניתן למדידה מהימנה מווידאו של שלד
// גוף בלבד (בלי מעקב אחרי הכדור עצמו ובלי נקודות ציון של האצבעות). לכן כל
// מדד מסומן ברמת ביטחון (confidence): "measured" (נמדד ישירות), "estimated"
// (אומדן/פרוקסי סביר) או "reference" (ידע מקצועי כללי, לא נמדד מהווידאו
// הספציפי הזה).
// ============================================================================

import { LM } from "./poseEngine.js";
import { computeBodyBasis, buildTransformedFrames, angleAt3D, dist3, mid3 } from "./bodyGeometry.js";

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// smooth "how close to target range" scoring: 100 inside [lo,hi], decays
// outside it proportional to `tolerance` (units of the same metric).
function rangeScore(value, lo, hi, tolerance) {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= lo && value <= hi) return 100;
  const d = value < lo ? lo - value : value - hi;
  return clamp(100 - (d / tolerance) * 100, 0, 100);
}

// ---------------------------------------------------------- frame decoding --
// פורש נקודות ציון תלת-ממדיות בסיסיות (worldLandmarks) לפי מערכת הצירים
// האנטומית המשותפת (x=ימין הגוף, y=למעלה, z=קדימה, במטרים) - ראו
// bodyGeometry.js. שים לב: y חיובי = למעלה (בשונה מקואורדינטות פיקסלים
// שבהן y חיובי = למטה).
function decode3DFrames(rawFrames) {
  const basis = computeBodyBasis(rawFrames);
  if (!basis) return null;
  const transformed = buildTransformedFrames(rawFrames, basis);
  const pick = (points, idx) => points[idx] || null;
  return transformed.map((f) => ({
    t: f.t,
    nose: pick(f.points, LM.NOSE),
    lShoulder: pick(f.points, LM.LEFT_SHOULDER),
    rShoulder: pick(f.points, LM.RIGHT_SHOULDER),
    lElbow: pick(f.points, LM.LEFT_ELBOW),
    rElbow: pick(f.points, LM.RIGHT_ELBOW),
    lWrist: pick(f.points, LM.LEFT_WRIST),
    rWrist: pick(f.points, LM.RIGHT_WRIST),
    lHip: pick(f.points, LM.LEFT_HIP),
    rHip: pick(f.points, LM.RIGHT_HIP),
    lKnee: pick(f.points, LM.LEFT_KNEE),
    rKnee: pick(f.points, LM.RIGHT_KNEE),
    lAnkle: pick(f.points, LM.LEFT_ANKLE),
    rAnkle: pick(f.points, LM.RIGHT_ANKLE),
  }));
}

function isFrameUsable(fr) {
  return (
    fr.lShoulder &&
    fr.rShoulder &&
    fr.lWrist &&
    fr.rWrist &&
    fr.lElbow &&
    fr.rElbow &&
    fr.lHip &&
    fr.rHip
  );
}

// -------------------------------------------------------- shooting side ID --
function detectShootingSide(frames) {
  const lY = frames.map((f) => f.lWrist?.y).filter((v) => v != null);
  const rY = frames.map((f) => f.rWrist?.y).filter((v) => v != null);
  if (!lY.length || !rY.length) return "right";
  const rangeL = Math.max(...lY) - Math.min(...lY);
  const rangeR = Math.max(...rY) - Math.min(...rY);
  return rangeR >= rangeL ? "right" : "left";
}

function side(fr, s) {
  return s === "right"
    ? { shoulder: fr.rShoulder, elbow: fr.rElbow, wrist: fr.rWrist, ankle: fr.rAnkle, knee: fr.rKnee, hip: fr.rHip }
    : { shoulder: fr.lShoulder, elbow: fr.lElbow, wrist: fr.lWrist, ankle: fr.lAnkle, knee: fr.lKnee, hip: fr.lHip };
}
function otherSide(fr, s) {
  return side(fr, s === "right" ? "left" : "right");
}

// -------------------------------------------------------- two-handed check --
// זריקה/הטלה בשתי ידיים (למשל heave מהחזה) לא תואמת את ההנחה של המנוע
// (יד זורקת אחת + יד מכוונת אחת): בזריקה רגילה היד המכוונת נשארת קרוב לגוף
// עם טווח תנועה אנכי קטן בהרבה מיד הזריקה, בעוד שבהטלה דו-ידנית שתי הידיים
// עולות יחד באותו טווח בערך. זה הסימן העיקרי - המרחק בין הידיים לא נבדק
// (יכול להיות צר או רחב כאחד בהטלה דו-ידנית, תלוי איך אוחזים בכדור).
function detectTwoHanded(decoded, phases) {
  const win = decoded.slice(phases.dipIdx, phases.releaseIdx + 1);
  if (win.length < 3) return false;

  const lY = win.map((f) => f.lWrist?.y).filter((v) => v != null);
  const rY = win.map((f) => f.rWrist?.y).filter((v) => v != null);
  if (lY.length < 3 || rY.length < 3) return false;
  const lRange = Math.max(...lY) - Math.min(...lY);
  const rRange = Math.max(...rY) - Math.min(...rY);
  const rangeRatio = Math.min(lRange, rRange) / (Math.max(lRange, rRange) || 1);

  return rangeRatio > 0.6;
}

// ----------------------------------------------------------- phase finding --
// מוצא את פריים ה"טעינה/איסוף" (הנקודה הנמוכה ביותר של שורש כף היד לפני
// העלייה הסופית) ואת פריים ה"שחרור" (שיא הגובה לפני הירידה). y חיובי=למעלה.
function findPhases(frames, shootingSide) {
  const n = frames.length;
  const wristY = frames.map((f) => side(f, shootingSide).wrist?.y ?? null);

  let firstValid = 0;
  while (firstValid < n && wristY[firstValid] == null) firstValid++;
  let lastValid = n - 1;
  while (lastValid >= 0 && wristY[lastValid] == null) lastValid--;
  if (firstValid >= lastValid) return null;

  // פריים ה"שחרור" המועמד: הגובה המרבי (y מקסימלי) של שורש כף היד בכל הקליפ
  let releaseIdx = firstValid;
  for (let i = firstValid; i <= lastValid; i++) {
    if (wristY[i] != null && wristY[i] > wristY[releaseIdx]) releaseIdx = i;
  }

  // פריים ה"טעינה" (dip): נקודת ה-y המינימלי (הכי נמוך) של שורש כף היד,
  // שמופיעה *לפני* פריים השחרור
  let dipIdx = firstValid;
  for (let i = firstValid; i <= releaseIdx; i++) {
    if (wristY[i] != null && wristY[i] < wristY[dipIdx]) dipIdx = i;
  }

  if (dipIdx === releaseIdx) dipIdx = firstValid;

  return {
    setupIdx: firstValid,
    dipIdx,
    releaseIdx,
    endIdx: lastValid,
  };
}

// -------------------------------------------------------------- main entry --
export function analyzeShot(rawFrames) {
  const basisUsable = rawFrames.filter((f) => f.worldLandmarks);
  const decodedAll = basisUsable.length ? decode3DFrames(basisUsable) : null;
  const decoded = (decodedAll || []).filter(isFrameUsable);

  if (!decodedAll || decoded.length < 8) {
    return {
      confidence: "low",
      confidenceNote:
        "זוהו מעט מדי פריימים עם שלד גוף תלת-ממדי ברור. ודאו שהשחקן נראה בבירור " +
        "(גוף מלא, תאורה טובה) ונסו שוב עם סרטון יציב יותר.",
      overallScore: null,
      categories: {},
      topFlaws: [],
      strengths: [],
      drills: [],
    };
  }

  const shootingSide = detectShootingSide(decoded);
  const phases = findPhases(decoded, shootingSide);

  if (!phases || phases.releaseIdx === phases.setupIdx) {
    return {
      confidence: "low",
      confidenceNote:
        "לא הצלחנו לזהות בבירור את שלב השחרור בתנועה. נסו סרטון שמתחיל " +
        "לפני קבלת/איסוף הכדור ומסתיים אחרי שהכדור עוזב את היד.",
      overallScore: null,
      categories: {},
      topFlaws: [],
      strengths: [],
      drills: [],
    };
  }

  const setup = decoded[phases.setupIdx];
  const dip = decoded[phases.dipIdx];
  const release = decoded[phases.releaseIdx];

  // יחידת נרמול לגודל הגוף, במטרים: רוחב כתפיים או אורך גו (הגבוה מביניהם),
  // עם רצפה קבועה כדי להימנע מרגישות קיצונית אם מדד אחד יוצא כמעט אפס.
  const shoulderWidthSetup = dist3(setup.lShoulder, setup.rShoulder);
  const shoulderMidSetup = mid3(setup.lShoulder, setup.rShoulder);
  const hipMidSetup = mid3(setup.lHip, setup.rHip);
  const torsoLenSetup = dist3(shoulderMidSetup, hipMidSetup);
  const scale = Math.max(shoulderWidthSetup, torsoLenSetup * 0.55, 0.25);

  const twoHanded = detectTwoHanded(decoded, phases);

  const categories = {};
  const allFlaws = [];
  const allStrengths = [];

  const pushFlaw = (categoryKey, flawId, evidence, severity) => {
    allFlaws.push({ id: flawId, category: categoryKey, evidence, severity });
  };
  const pushStrength = (categoryKey, text) => {
    allStrengths.push({ category: categoryKey, text });
  };

  // ------------------------------------------------------------ BALANCE --
  {
    const baseWidth = dist3(setup.lAnkle || setup.lHip, setup.rAnkle || setup.rHip);
    const baseRatio = baseWidth / scale;
    const baseScore = rangeScore(baseRatio, 0.85, 1.45, 0.6);

    const kneeAngles = [
      dip.lKnee && dip.lHip && dip.lAnkle ? angleAt3D(dip.lHip, dip.lKnee, dip.lAnkle) : null,
      dip.rKnee && dip.rHip && dip.rAnkle ? angleAt3D(dip.rHip, dip.rKnee, dip.rAnkle) : null,
    ].filter((v) => v != null);
    const kneeAngle = kneeAngles.length ? mean(kneeAngles) : null;
    const kneeScore = rangeScore(kneeAngle, 100, 155, 35);

    const shoulderMidRelease = mid3(release.lShoulder, release.rShoulder);
    const hipMidRelease = mid3(release.lHip, release.rHip);
    // נטייה אופקית אמיתית (לכל כיוון - קדימה/אחורה/צד) של פלג הגוף העליון,
    // ולא רק לאורך ציר אחד של התמונה כמו בגרסה דו-ממדית.
    const torsoLeanDist = Math.hypot(shoulderMidRelease.x - hipMidRelease.x, shoulderMidRelease.z - hipMidRelease.z);
    const torsoLeanRatio = torsoLeanDist / scale;
    const leanScore = rangeScore(torsoLeanRatio, 0, 0.22, 0.55);

    const ankleCenterSetup = mid3(setup.lAnkle || setup.lHip, setup.rAnkle || setup.rHip);
    const endFr = decoded[Math.min(phases.releaseIdx + 3, decoded.length - 1)];
    const ankleCenterEnd = mid3(endFr.lAnkle || endFr.lHip, endFr.rAnkle || endFr.rHip);
    const driftDist = Math.hypot(ankleCenterEnd.x - ankleCenterSetup.x, ankleCenterEnd.z - ankleCenterSetup.z);
    const driftRatio = driftDist / scale;
    const driftScore = rangeScore(driftRatio, 0, 0.35, 0.7);

    const metrics = [
      { label: "רוחב בסיס יחסית לכתפיים", value: baseRatio, unit: "×", score: baseScore },
      { label: "כיפוף ברכיים בטעינה", value: kneeAngle, unit: "°", score: kneeScore },
      { label: "נטיית פלג גוף עליון בשחרור", value: torsoLeanRatio, unit: "יחס", score: leanScore },
      { label: "סחיפה אופקית מהקפיצה לנחיתה", value: driftRatio, unit: "יחס", score: driftScore },
    ];
    const validScores = metrics.map((m) => m.score).filter((s) => s != null);
    const score = Math.round(mean(validScores));
    categories.balance = { score, confidence: "measured", metrics, flaws: [] };

    if (baseScore != null && baseScore < 60) {
      pushFlaw("balance", "narrow_or_wide_base", `רוחב הבסיס נמדד כ-${baseRatio.toFixed(2)}× רוחב הכתפיים`, "common");
      categories.balance.flaws.push("narrow_or_wide_base");
    }
    if (kneeScore != null && kneeScore < 55) {
      pushFlaw("balance", "insufficient_knee_bend", `זווית הברך בטעינה נמדדה כ-${Math.round(kneeAngle)}° (כיפוף רדוד)`, "common");
      categories.balance.flaws.push("insufficient_knee_bend");
    }
    if (leanScore != null && leanScore < 55) {
      pushFlaw("balance", "leaning_back", `נמדדה נטייה אופקית של פלג הגוף העליון בזמן השחרור`, "common");
      categories.balance.flaws.push("leaning_back");
    }
    if (driftScore != null && driftScore < 60) {
      pushFlaw("balance", "landing_drift", `זוהתה סחיפה של כ-${(driftRatio * 100).toFixed(0)}% מרוחב הכתפיים בין הקפיצה לנחיתה`, "subtle");
      categories.balance.flaws.push("landing_drift");
    }
    if (score >= 78 && categories.balance.flaws.length === 0) {
      pushStrength("balance", "בסיס ויציבה טובים - רוחב הרגליים, כיפוף הברכיים ויציבות הנחיתה כולם בטווח בריא.");
    }
  }

  // ---------------------------------------------------------- ALIGNMENT --
  {
    const s = side(dip, shootingSide);
    const upperArmLen = s.shoulder && s.elbow ? dist3(s.shoulder, s.elbow) : scale * 0.5;
    // "יישור" נבדק במישור האופקי (ימין-שמאל + קדימה-אחורה) ביחס לקו האנכי -
    // כלומר האם המרפק ממש מתחת לשורש כף היד/לכתף, מכל זווית שהיא.
    const elbowOffset = s.elbow && s.wrist ? Math.hypot(s.elbow.x - s.wrist.x, s.elbow.z - s.wrist.z) : null;
    const elbowStackRatio = elbowOffset != null ? elbowOffset / (upperArmLen || 1) : null;
    const stackScore = rangeScore(elbowStackRatio, 0, 0.35, 0.7);

    const elbowFromShoulder = s.elbow && s.shoulder ? Math.hypot(s.elbow.x - s.shoulder.x, s.elbow.z - s.shoulder.z) : null;
    const flareRatio = elbowFromShoulder != null ? elbowFromShoulder / (upperArmLen || 1) : null;
    const flareScore = rangeScore(flareRatio, 0, 0.5, 0.8);

    // יציבות קו הכתפיים (סיבוב סביב הציר האנכי) לאורך הפאזה - האם השחקן
    // נשאר "מרובע" מול המטרה, נמדד במישור האופקי האמיתי (לא בהשלכת תמונה).
    const windowFrames = decoded.slice(phases.dipIdx, phases.releaseIdx + 1);
    const shoulderAngles = windowFrames
      .map((f) => (f.lShoulder && f.rShoulder ? Math.atan2(f.rShoulder.z - f.lShoulder.z, f.rShoulder.x - f.lShoulder.x) * (180 / Math.PI) : null))
      .filter((v) => v != null);
    const shoulderStability = shoulderAngles.length > 1 ? stdev(shoulderAngles) : 0;
    const stabilityScore = rangeScore(shoulderStability, 0, 6, 10);

    const metrics = [
      { label: "יישור מרפק-שורש כף יד", value: elbowStackRatio, unit: "יחס", score: stackScore },
      { label: "פתיחת מרפק מהכתף (Flare)", value: flareRatio, unit: "יחס", score: flareScore },
      { label: "יציבות קו כתפיים לאורך התנועה", value: shoulderStability, unit: "° סטיית תקן", score: stabilityScore },
    ];
    const score = Math.round(mean(metrics.map((m) => m.score).filter((s) => s != null)));
    categories.alignment = { score, confidence: "measured", metrics, flaws: [] };

    if (flareScore != null && flareScore < 55) {
      pushFlaw("alignment", "elbow_flare", `המרפק נמדד רחוק מקו הכתף-שורש כף יד - סימן ל\"כנף עוף\"`, "common");
      categories.alignment.flaws.push("elbow_flare");
    } else if (stackScore != null && stackScore < 55) {
      pushFlaw("alignment", "across_body_release", `המרפק ושורש כף היד אינם מיושרים אנכית באיסוף`, "common");
      categories.alignment.flaws.push("across_body_release");
    }
    if (stabilityScore != null && stabilityScore < 55) {
      pushFlaw("alignment", "shoulders_not_square", `נמדדה תזוזה בקו הכתפיים לאורך התנועה (סטיית תקן ${shoulderStability.toFixed(1)}°)`, "common");
      categories.alignment.flaws.push("shoulders_not_square");
    }
    if (score >= 78 && categories.alignment.flaws.length === 0) {
      pushStrength("alignment", "יישור המרפק וקו הכתפיים יציבים ועקביים לאורך התנועה - בסיס מצוין לזריקה בקו ישר.");
    }
  }

  // -------------------------------------------------------- POCKET/RHYTHM --
  let hitchInfo = null;
  {
    const s = side(dip, shootingSide);
    // 0 = בגובה המותן, 1 = בגובה הכתף (y חיובי = למעלה)
    const pocketRel = s.wrist && s.hip && s.shoulder ? (s.wrist.y - s.hip.y) / (s.shoulder.y - s.hip.y || 1) : null;
    const pocketScore = rangeScore(pocketRel, 0.15, 1.05, 0.6);

    const win = decoded.slice(phases.dipIdx, phases.releaseIdx + 1);
    const vy = [];
    for (let i = 1; i < win.length; i++) {
      const wA = side(win[i - 1], shootingSide).wrist;
      const wB = side(win[i], shootingSide).wrist;
      const dt = (win[i].t - win[i - 1].t) / 1000 || 1 / 30;
      if (wA && wB) vy.push((wB.y - wA.y) / dt); // חיובי = עולה
    }
    let plateauFrames = 0;
    let maxPlateau = 0;
    const vyPeak = Math.max(1, ...vy.map((v) => Math.abs(v)));
    for (const v of vy) {
      if (v < vyPeak * 0.12) {
        plateauFrames++;
        maxPlateau = Math.max(maxPlateau, plateauFrames);
      } else {
        plateauFrames = 0;
      }
    }
    const tempoMs = release.t - dip.t;
    hitchInfo = { maxPlateau, tempoMs };
    const hitchScore = rangeScore(maxPlateau, 0, 2, 4);

    const metrics = [
      { label: "גובה נקודת איסוף (0=מותן, 1=כתף)", value: pocketRel, unit: "", score: pocketScore },
      { label: "עצירה/פלטו באמצע התנועה", value: maxPlateau, unit: "פריימים", score: hitchScore },
      { label: "זמן טעינה-לשחרור (טמפו)", value: tempoMs, unit: "מ\"ש", score: null },
    ];
    const score = Math.round(mean([pocketScore, hitchScore].filter((s) => s != null)));
    categories.pocket = { score, confidence: "measured", metrics, flaws: [] };

    if (pocketScore != null && pocketScore < 55 && pocketRel < 0.15) {
      pushFlaw("pocket", "pocket_too_low", `נקודת האיסוף נמדדה נמוכה - כ-${(pocketRel * 100).toFixed(0)}% מגובה המותן-כתף`, "common");
      categories.pocket.flaws.push("pocket_too_low");
    }
    if (maxPlateau >= 4) {
      pushFlaw("rhythm", "visible_hitch", `זוהתה עצירה ברורה של כ-${maxPlateau} פריימים בעליית שורש כף היד`, "common");
    } else if (maxPlateau >= 2) {
      pushFlaw("rhythm", "micro_hitch", `זוהתה עצירה קצרה (מיקרו-היצ') של ${maxPlateau} פריימים בעליית שורש כף היד`, "subtle");
    }
    if (score >= 78 && categories.pocket.flaws.length === 0) {
      pushStrength("pocket", "נקודת האיסוף וזרימת התנועה מהאיסוף לשחרור נראות רציפות ועקביות.");
    }
  }

  // ----------------------------------------------------- RELEASE/FOLLOW-THRU --
  {
    const sRelease = side(release, shootingSide);
    const elbowExt = sRelease.shoulder && sRelease.elbow && sRelease.wrist ? angleAt3D(sRelease.shoulder, sRelease.elbow, sRelease.wrist) : null;
    const extScore = rangeScore(elbowExt, 155, 180, 30);

    let holdMs = 0;
    for (let i = phases.releaseIdx; i < decoded.length - 1; i++) {
      const fr = decoded[i];
      const sFr = side(fr, shootingSide);
      const ang = sFr.shoulder && sFr.elbow && sFr.wrist ? angleAt3D(sFr.shoulder, sFr.elbow, sFr.wrist) : null;
      if (ang != null && ang > 140) {
        holdMs = fr.t - release.t;
      } else {
        break;
      }
    }
    const clipTailMs = decoded[decoded.length - 1].t - release.t;
    const holdMeasurable = clipTailMs >= 250;
    const holdScore = holdMeasurable ? rangeScore(holdMs, 220, 100000, 220) : null;

    const metrics = [
      { label: "יישור מרפק ברגע השחרור", value: elbowExt, unit: "°", score: extScore },
      ...(holdMeasurable
        ? [{ label: "משך החזקת הליווי אחרי השחרור", value: holdMs, unit: "מ\"ש", score: holdScore }]
        : []),
    ];
    const scores = metrics.map((m) => m.score).filter((s) => s != null);
    const score = scores.length ? Math.round(mean(scores)) : null;
    categories.release = {
      score,
      confidence: "measured",
      metrics,
      flaws: [],
      note: holdMeasurable ? null : "הסרטון מסתיים זמן קצר מדי אחרי השחרור כדי למדוד ליווי - הוסיפו כ-1 שנייה בסוף הצילום.",
    };

    if (extScore != null && extScore < 55) {
      pushFlaw("release", "short_arming", `זווית המרפק בשחרור נמדדה כ-${Math.round(elbowExt)}° בלבד (יישור חלקי)`, "common");
      categories.release.flaws.push("short_arming");
    }
    if (holdMeasurable && holdScore != null && holdScore < 45) {
      pushFlaw("release", "dropping_follow_through_early", `יד הזריקה ירדה מהר מאוד אחרי השחרור (כ-${holdMs}מ\"ש בלבד)`, "common");
      categories.release.flaws.push("dropping_follow_through_early");
    }
    if (score != null && score >= 78 && categories.release.flaws.length === 0) {
      pushStrength("release", "יישור הזרוע והחזקת הליווי אחרי השחרור נראים מלאים ועקביים.");
    }
  }

  // ------------------------------------------------------------------ ARC --
  {
    const idxBefore = Math.max(phases.dipIdx, phases.releaseIdx - 4);
    const before = decoded[idxBefore];
    const wB = side(before, shootingSide).wrist;
    const wR = side(release, shootingSide).wrist;
    let launchAngle = null;
    if (wB && wR && release.t - before.t > 0) {
      // כיוון השחרור האמיתי במרחב (למעלה מול קדימה), ולא רק תזוזה על ציר
      // אחד של התמונה - עובד מכל זווית צילום.
      const dUp = wR.y - wB.y;
      const dForward = Math.abs(wR.z - wB.z);
      launchAngle = (Math.atan2(Math.max(dUp, 0.001), Math.max(dForward, 0.001)) * 180) / Math.PI;
    }
    const arcScore = rangeScore(launchAngle, 40, 58, 20);
    const metrics = [{ label: "אומדן זווית שחרור (מבוסס מסלול שורש כף היד, תלת-ממדי)", value: launchAngle, unit: "°", score: arcScore }];
    const score = arcScore != null ? Math.round(arcScore) : null;
    categories.arc = { score, confidence: "estimated", metrics, flaws: [] };

    if (arcScore != null && arcScore < 55) {
      if (launchAngle < 40) {
        pushFlaw("arc", "flat_arc", `אומדן זווית השחרור נמוך - כ-${Math.round(launchAngle)}° (יעד: 43-55°)`, "common");
        categories.arc.flaws.push("flat_arc");
      } else {
        pushFlaw("arc", "over_arced", `אומדן זווית השחרור גבוה מאוד - כ-${Math.round(launchAngle)}°`, "subtle");
        categories.arc.flaws.push("over_arced");
      }
    }
    if (score != null && score >= 78) {
      pushStrength("arc", "אומדן הקשת קרוב לטווח האידיאלי (כ-43-55 מעלות) שנמצא במחקרי הפיזיקה של הזריקה כבעל שולי הטעות הגדולים ביותר.");
    }
  }

  // ------------------------------------------------------------ GUIDE HAND --
  {
    const sGuide = otherSide(dip, shootingSide);
    const sShoot = side(dip, shootingSide);
    const handsDistDip = sGuide.wrist && sShoot.wrist ? dist3(sGuide.wrist, sShoot.wrist) / scale : null;
    const proximityScore = rangeScore(handsDistDip, 0.1, 0.55, 0.6);

    const guideAtRelease = otherSide(release, shootingSide).wrist;
    const guideAtDip = sGuide.wrist;
    let detachRatio = null;
    if (guideAtRelease && guideAtDip) {
      detachRatio = dist3(guideAtRelease, guideAtDip) / scale;
    }

    const metrics = [
      { label: "קרבת יד מכוונת לכדור באיסוף", value: handsDistDip, unit: "יחס", score: proximityScore },
      { label: "תזוזת יד מכוונת עד לרגע השחרור", value: detachRatio, unit: "יחס", score: null },
    ];
    const score = proximityScore != null ? Math.round(proximityScore) : null;
    categories.guideHand = { score, confidence: "estimated", metrics, flaws: [] };

    if (proximityScore != null && proximityScore < 50 && handsDistDip < 0.1) {
      pushFlaw("guideHand", "guide_hand_under_ball", "היד המכוונת נמדדה קרובה מאוד/מתחת ליד הזריקה באיסוף", "subtle");
      categories.guideHand.flaws.push("guide_hand_under_ball");
    }
    categories.guideHand.note =
      "מדד זה מבוסס על מיקום שורש כף היד בלבד (ללא נקודות ציון של האצבעות/האגודל), ולכן רמת הביטחון נמוכה יותר - " +
      "לזיהוי מדויק של \"הברשת אגודל\" מומלץ צילום איטי (סלואו-מושן) וסקירה ידנית לפי המדריך למטה.";
  }

  // -------------------------------------------------------------------- HEAD --
  {
    const win = decoded.slice(phases.dipIdx, Math.min(phases.releaseIdx + 3, decoded.length - 1));
    const noses = win.map((f) => f.nose).filter((v) => v != null);
    let headStability = null;
    if (noses.length > 1) {
      const noseMean = { x: mean(noses.map((p) => p.x)), y: mean(noses.map((p) => p.y)), z: mean(noses.map((p) => p.z)) };
      headStability = mean(noses.map((p) => dist3(p, noseMean))) / scale;
    }
    const headScore = rangeScore(headStability, 0, 0.05, 0.12);
    const metrics = [{ label: "יציבות ראש לאורך התנועה", value: headStability, unit: "יחס", score: headScore }];
    const score = headScore != null ? Math.round(headScore) : null;
    categories.head = { score, confidence: "estimated", metrics, flaws: [] };

    if (headScore != null && headScore < 55) {
      pushFlaw("head", "head_movement", "זוהתה תזוזה ניכרת של הראש בין הטעינה לשחרור", "subtle");
      categories.head.flaws.push("head_movement");
    }
    if (score != null && score >= 78) {
      pushStrength("head", "הראש יציב מאוד לאורך התנועה - סימן טוב לעקביות ולריכוז חזותי על המטרה.");
    }
  }

  // ------------------------------------------------------------- OVERALL --
  const weights = { balance: 1, alignment: 1.2, pocket: 1, release: 1.2, arc: 0.7, guideHand: 0.5, head: 0.5 };
  let wSum = 0;
  let scoreSum = 0;
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.score == null) continue;
    const w = weights[key] ?? 1;
    wSum += w;
    scoreSum += cat.score * w;
  }
  const overallScore = wSum ? Math.round(scoreSum / wSum) : null;

  const severityRank = { common: 2, subtle: 1 };
  const topFlaws = [...allFlaws].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)).slice(0, 8);

  const usableRatio = decoded.length / rawFrames.length;
  let confidence = "high";
  if (usableRatio < 0.5 || decoded.length < 20) confidence = "medium";
  if (usableRatio < 0.25 || decoded.length < 12) confidence = "low";

  return {
    confidence,
    confidenceNote:
      confidence !== "high"
        ? "חלק מהפריימים בסרטון לא אפשרו זיהוי שלד ברור (תאורה/חסימה/חלק מהגוף מחוץ לפריים). התוצאות עדיין " +
          "רלוונטיות, אך מומלץ לצלם שוב עם כל הגוף בפריים, לתוצאה מדויקת יותר."
        : null,
    shootingSide,
    twoHanded,
    twoHandedWarning: twoHanded
      ? "⚠️ נראה שזו זריקה/הטלה בשתי ידיים - המנוע בנוי לנתח זריקת יד אחת עם יד מכוונת (guide hand), ולכן התוצאות עשויות שלא לשקף נכון את התנועה הזו."
      : null,
    overallScore,
    categories,
    phases: { setupT: setup.t, dipT: dip.t, releaseT: release.t },
    hitchInfo,
    topFlaws,
    strengths: allStrengths,
  };
}

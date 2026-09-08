// ============================================================================
// demoData.js
// ----------------------------------------------------------------------------
// דוח ניתוח לדוגמה, באותו מבנה בדיוק שמייצר shotAnalyzer.js, כדי לאפשר
// תצוגה מקדימה מיידית של כל ה-UI בלי להעלות סרטון (ולשמש גם לבדיקות QA).
// ============================================================================

export const DEMO_REPORT = {
  confidence: "high",
  confidenceNote: null,
  shootingSide: "right",
  overallScore: 71,
  hitchInfo: { maxPlateau: 2, tempoMs: 430 },
  phases: { setupT: 0, dipT: 180, releaseT: 610 },
  categories: {
    balance: {
      score: 86,
      confidence: "measured",
      metrics: [
        { label: "רוחב בסיס יחסית לכתפיים", value: 1.05, unit: "×", score: 92 },
        { label: "כיפוף ברכיים בטעינה", value: 122, unit: "°", score: 88 },
        { label: "נטיית פלג גוף עליון בשחרור", value: 0.09, unit: "יחס", score: 84 },
        { label: "סחיפה אופקית מהקפיצה לנחיתה", value: 0.12, unit: "יחס", score: 82 },
      ],
      flaws: [],
    },
    alignment: {
      score: 54,
      confidence: "measured",
      metrics: [
        { label: "יישור מרפק-שורש כף יד (אנכי)", value: 0.31, unit: "יחס", score: 61 },
        { label: "פתיחת מרפק מהכתף (Flare)", value: 0.71, unit: "יחס", score: 46 },
        { label: "יציבות קו כתפיים לאורך התנועה", value: 5.1, unit: "° סטיית תקן", score: 62 },
      ],
      flaws: ["elbow_flare"],
    },
    pocket: {
      score: 74,
      confidence: "measured",
      metrics: [
        { label: "גובה נקודת איסוף (0=מותן, 1=כתף)", value: 0.62, unit: "", score: 88 },
        { label: "עצירה/פלטו באמצע התנועה", value: 2, unit: "פריימים", score: 61 },
        { label: "זמן טעינה-לשחרור (טמפו)", value: 430, unit: "מ\"ש", score: null },
      ],
      flaws: [],
    },
    release: {
      score: 81,
      confidence: "measured",
      metrics: [
        { label: "יישור מרפק ברגע השחרור", value: 171, unit: "°", score: 92 },
        { label: "משך החזקת הליווי אחרי השחרור", value: 260, unit: "מ\"ש", score: 70 },
      ],
      flaws: [],
      note: null,
    },
    arc: {
      score: 47,
      confidence: "estimated",
      metrics: [{ label: "אומדן זווית שחרור (מבוסס מסלול שורש כף היד)", value: 36, unit: "°", score: 47 }],
      flaws: ["flat_arc"],
    },
    guideHand: {
      score: 63,
      confidence: "estimated",
      metrics: [
        { label: "קרבת יד מכוונת לכדור באיסוף", value: 0.28, unit: "יחס", score: 71 },
        { label: "תזוזת יד מכוונת עד לרגע השחרור", value: 0.4, unit: "יחס", score: null },
      ],
      flaws: [],
      note: "מדד זה מבוסס על מיקום שורש כף היד בלבד (ללא נקודות ציון של האצבעות/האגודל), ולכן רמת הביטחון נמוכה יותר - לזיהוי מדויק של \"הברשת אגודל\" מומלץ צילום איטי (סלואו-מושן) וסקירה ידנית לפי המדריך למטה.",
    },
    head: {
      score: 89,
      confidence: "estimated",
      metrics: [{ label: "יציבות ראש לאורך התנועה", value: 0.02, unit: "יחס", score: 89 }],
      flaws: [],
    },
  },
  topFlaws: [
    { id: "elbow_flare", category: "alignment", severity: "common", evidence: "המרפק נמדד רחוק מקו הכתף-שורש כף יד - סימן ל\"כנף עוף\" (יחס 0.71)" },
    { id: "flat_arc", category: "arc", severity: "common", evidence: "אומדן זווית השחרור נמוך - כ-36° (יעד: 43-55°)" },
    { id: "double_motion_hitch", category: "pocket", severity: "common", evidence: "זוהתה עצירה קלה בעליית שורש כף היד סביב נקודת האיסוף" },
  ],
  strengths: [
    { category: "balance", text: "בסיס ויציבה טובים - רוחב הרגליים, כיפוף הברכיים ויציבות הנחיתה כולם בטווח בריא." },
    { category: "release", text: "יישור הזרוע והחזקת הליווי אחרי השחרור נראים מלאים ועקביים." },
    { category: "head", text: "הראש יציב מאוד לאורך התנועה - סימן טוב לעקביות ולריכוז חזותי על המטרה." },
  ],
};

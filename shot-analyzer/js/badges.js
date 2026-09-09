// ============================================================================
// badges.js
// ----------------------------------------------------------------------------
// תגי הישג בסגנון 2K MyPlayer, עם דירוג Bronze / Silver / Gold / Hall of
// Fame בדיוק כמו במשחק - מוערכים אוטומטית מתוך תוצאות הניתוח.
// ============================================================================

const TIERS = [
  { key: "hof", min: 93, label: "Hall of Fame" },
  { key: "gold", min: 85, label: "זהב" },
  { key: "silver", min: 75, label: "כסף" },
  { key: "bronze", min: 60, label: "ארד" },
];

function tierFor(score) {
  if (score == null) return null;
  return TIERS.find((t) => score >= t.min) || null;
}

export const BADGE_DEFS = [
  {
    id: "sniper",
    name: "צלף (Sniper)",
    icon: "🎯",
    desc: "קשת ושחרור ברמה גבוהה יחד",
    evaluate: (r) => {
      const a = r.categories.arc?.score;
      const rel = r.categories.release?.score;
      if (a == null || rel == null) return null;
      return tierFor(Math.min(a, rel));
    },
  },
  {
    id: "iron_base",
    name: "בסיס ברזל",
    icon: "🦵",
    desc: "יציבות ובסיס יוצאי דופן",
    evaluate: (r) => tierFor(r.categories.balance?.score),
  },
  {
    id: "laser_aligned",
    name: "מיושר בלייזר",
    icon: "📐",
    desc: "יישור מרפק וכתפיים נקי",
    evaluate: (r) => tierFor(r.categories.alignment?.score),
  },
  {
    id: "one_motion",
    name: "תנועה אחת",
    icon: "🌊",
    desc: "זרימה חלקה מאיסוף לשחרור, בלי היצ'",
    evaluate: (r) => {
      const flaws = new Set((r.topFlaws || []).map((f) => f.id));
      if (flaws.has("visible_hitch") || flaws.has("double_motion_hitch")) return null;
      return tierFor(r.categories.pocket?.score);
    },
  },
  {
    id: "full_extension",
    name: "יישור מלא",
    icon: "🙌",
    desc: "שחרור וליווי מלאים ועקביים",
    evaluate: (r) => tierFor(r.categories.release?.score),
  },
  {
    id: "ice_veins",
    name: "קרח בעורקים",
    icon: "🧊",
    desc: "יציבות ראש ומבט קבוע לאורך הזריקה",
    evaluate: (r) => tierFor(r.categories.head?.score),
  },
  {
    id: "quick_trigger",
    name: "טריגר מהיר",
    icon: "⚡",
    desc: "זמן טעינה-לשחרור קצר",
    evaluate: (r) => {
      const ms = r.hitchInfo?.tempoMs;
      if (ms == null) return null;
      if (ms <= 350) return TIERS[0];
      if (ms <= 450) return TIERS[1];
      if (ms <= 600) return TIERS[2];
      if (ms <= 800) return TIERS[3];
      return null;
    },
  },
  {
    id: "shot_iq",
    name: "Shot IQ עילית",
    icon: "🧠",
    desc: "ציון כולל גבוה על פני כל הקטגוריות",
    evaluate: (r) => tierFor(r.overallScore),
  },
];

export function evaluateBadges(report) {
  return BADGE_DEFS.map((def) => {
    const tier = def.evaluate(report);
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      desc: def.desc,
      tier: tier?.key ?? null,
      tierLabel: tier?.label ?? null,
    };
  });
}

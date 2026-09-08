// ============================================================================
// uiRenderer.js
// ----------------------------------------------------------------------------
// מרנדר את דוח הניתוח (מ-shotAnalyzer.js) לתוך ה-DOM בסגנון "כרטיס שחקן" /
// 2K, וכן מרנדר את המדריך המקצועי המלא מתוך knowledgeBase.js.
// ============================================================================

import { CATEGORIES, FLAW_LIBRARY, getDrillsForCategory } from "./knowledgeBase.js";
import { SKELETON_CONNECTIONS } from "./poseEngine.js";

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

export function tierOf(score) {
  if (score == null) return { key: "unknown", label: "אין מספיק נתונים", cls: "avg" };
  if (score >= 85) return { key: "elite", label: "עלית", cls: "elite" };
  if (score >= 70) return { key: "good", label: "טוב", cls: "good" };
  if (score >= 50) return { key: "avg", label: "בינוני", cls: "avg" };
  return { key: "weak", label: "טעון עבודה", cls: "weak" };
}

// מסיר סוגריים עם טקסט אנגלי מהסוף לתצוגה קומפקטית (נמנע משבירת שורה
// באמצע ביטוי אנגלי-עם-מקף בתוך זרימת טקסט RTL, שנראית שבורה ויזואלית)
function compactTitle(text) {
  return text.replace(/\s*\([a-zA-Z0-9 /&'"-]+\)\s*$/, "").trim();
}

function formatValue(m) {
  if (m.value == null || Number.isNaN(m.value)) return "—";
  if (m.unit === "°") return `${m.value.toFixed(0)}°`;
  if (m.unit === "מ\"ש") return `${Math.round(m.value)} מ"ש`;
  if (m.unit === "×") return `${m.value.toFixed(2)}×`;
  if (m.unit === "פריימים") return `${m.value}`;
  if (m.unit) return `${m.value.toFixed(2)} ${m.unit}`;
  return `${m.value.toFixed(2)}`;
}

// ------------------------------------------------------------- skeleton --
export function drawSkeleton(ctx, landmarks, width, height) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.strokeStyle = "rgba(41,197,255,0.85)";
  ctx.beginPath();
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255,122,26,0.95)";
  for (const p of landmarks) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, Math.max(2.5, width * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------ main card --
function renderPlayerCard(report) {
  const gauge = document.getElementById("gauge");
  const gaugeValue = document.getElementById("gaugeValue");
  const chips = document.getElementById("metaChips");
  const sub = document.getElementById("resultSub");
  const note = document.getElementById("confidenceNote");

  const score = report.overallScore;
  const tier = tierOf(score);
  const colorMap = { elite: "var(--green)", good: "var(--blue)", avg: "var(--yellow)", weak: "var(--red)", unknown: "var(--ink-faint)" };

  requestAnimationFrame(() => {
    gauge.style.setProperty("--pct", score ?? 0);
    gauge.style.setProperty("--gauge-color", colorMap[tier.cls] || colorMap[tier.key] || "var(--orange)");
  });
  gaugeValue.textContent = score != null ? Math.round(score) : "--";

  const sideLabel = report.shootingSide === "left" ? "שמאל" : "ימין";
  sub.textContent =
    score != null
      ? `יד זריקה מזוהה: ${sideLabel} · רמת ביטחון בניתוח: ${confidenceLabel(report.confidence)}`
      : "לא הצלחנו לחשב ציון אמין מהסרטון הזה.";

  chips.innerHTML = "";
  chips.appendChild(el("span", `chip tier-${tier.cls}`, `דירוג כולל: ${tier.label}`));
  if (report.hitchInfo) {
    chips.appendChild(el("span", "chip", `טמפו איסוף→שחרור: ${Math.round(report.hitchInfo.tempoMs)} מ"ש`));
  }
  chips.appendChild(el("span", "chip", `${report.topFlaws.length} נקודות לשיפור זוהו`));

  if (report.confidenceNote) {
    note.style.display = "block";
    note.textContent = "ℹ️ " + report.confidenceNote;
  } else {
    note.style.display = "none";
  }
}

function confidenceLabel(c) {
  return { high: "גבוהה", medium: "בינונית", low: "נמוכה" }[c] || c;
}

// -------------------------------------------------------------- attrs --
function renderAttrs(report) {
  const grid = document.getElementById("attrsGrid");
  grid.innerHTML = "";
  for (const [key, cat] of Object.entries(report.categories)) {
    const meta = CATEGORIES[key];
    if (!meta) continue;
    const tier = tierOf(cat.score);
    const card = el("div", "attr-card");
    card.appendChild(
      el(
        "div",
        "attr-card__top",
        `<div class="attr-card__name">${meta.icon} ${meta.shortLabel} ${
          cat.confidence !== "measured" ? '<span class="tag tag-cat">אומדן</span>' : ""
        }</div><div class="attr-card__score score-${tier.cls}">${cat.score != null ? Math.round(cat.score) : "--"}</div>`
      )
    );
    const bar = el("div", "attr-bar");
    const fill = el("div", `attr-bar__fill fill-${tier.cls}`);
    bar.appendChild(fill);
    card.appendChild(bar);
    requestAnimationFrame(() => {
      fill.style.width = `${cat.score ?? 0}%`;
    });
    const subText = (cat.metrics || [])
      .filter((m) => m.value != null)
      .map((m) => `${m.label}: ${formatValue(m)}`)
      .join(" · ");
    if (subText) card.appendChild(el("div", "attr-card__sub", subText));
    if (cat.note) card.appendChild(el("div", "attr-card__sub", "💡 " + cat.note));
    grid.appendChild(card);
  }
}

// --------------------------------------------------------- strengths --
function renderStrengths(report) {
  const list = document.getElementById("strengthList");
  list.innerHTML = "";
  if (!report.strengths.length) {
    list.appendChild(
      el(
        "div",
        "strength-item",
        `<span class="ico">ℹ️</span><span>עדיין לא זוהו קטגוריות בציון גבוה מספיק כדי לסמן כ"חוזקה בולטת" - התמקדו קודם בנקודות התיקון למטה, ובדקו שוב אחרי אימון.</span>`
      )
    );
    return;
  }
  for (const s of report.strengths) {
    const meta = CATEGORIES[s.category];
    list.appendChild(el("div", "strength-item", `<span class="ico">✅</span><span><b>${meta?.label ?? ""}:</b> ${s.text}</span>`));
  }
}

// -------------------------------------------------------------- flaws --
function renderFlaws(report) {
  const list = document.getElementById("flawList");
  list.innerHTML = "";
  if (!report.topFlaws.length) {
    list.appendChild(el("div", "strength-item", `<span class="ico">🎉</span><span>לא זוהו טעויות בולטות במדדים שנמדדו! המשיכו לתחזק את המכניקה עם תרגילי הצילום העצמי במדריך המלא למטה.</span>`));
    return;
  }
  for (const flaw of report.topFlaws) {
    const info = FLAW_LIBRARY[flaw.id];
    if (!info) continue;
    const meta = CATEGORIES[flaw.category];
    const card = el("div", `flaw-card ${flaw.severity === "subtle" ? "subtle" : ""}`);
    card.appendChild(
      el(
        "div",
        "flaw-card__top",
        `<div class="flaw-card__title">${compactTitle(info.title)}</div>
         <div style="display:flex;gap:6px;">
           <span class="tag ${flaw.severity === "subtle" ? "tag-subtle" : "tag-common"}">${flaw.severity === "subtle" ? "טעות עדינה" : "טעות נפוצה"}</span>
           <span class="tag tag-cat">${meta?.icon ?? ""} ${meta?.shortLabel ?? ""}</span>
         </div>`
      )
    );
    card.appendChild(el("div", "flaw-card__desc", info.description));
    if (flaw.evidence) card.appendChild(el("div", "flaw-card__evidence", "📹 " + flaw.evidence));
    card.appendChild(
      el(
        "div",
        "flaw-card__grid",
        `<div class="flaw-card__box"><b>❓ למה זה קורה / למה זה פוגע</b>${info.why}</div>
         <div class="flaw-card__box"><b>🛠️ איך לתקן</b>${info.fix}</div>`
      )
    );
    if (info.cues?.length) {
      const cuesWrap = el("div", "flaw-card__cues");
      for (const c of info.cues) cuesWrap.appendChild(el("span", "cue-pill", c));
      card.appendChild(cuesWrap);
    }
    list.appendChild(card);
  }
}

// ------------------------------------------------------------- drills --
function renderDrills(report) {
  const grid = document.getElementById("drillGrid");
  grid.innerHTML = "";
  const categoriesNeeded = new Set(report.topFlaws.map((f) => f.category));
  const seen = new Set();
  const drills = [];
  for (const cat of categoriesNeeded) {
    for (const d of getDrillsForCategory(cat)) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        drills.push(d);
      }
    }
  }
  const finalDrills = drills.length ? drills.slice(0, 8) : getDrillsForCategory("balance").concat(getDrillsForCategory("release")).slice(0, 4);

  finalDrills.forEach((d, i) => {
    const card = el("div", "drill-card");
    card.appendChild(el("div", "drill-card__name", `<span class="drill-card__num">${i + 1}</span> ${compactTitle(d.name)}`));
    card.appendChild(el("div", "drill-card__desc", d.description));
    card.appendChild(el("div", "drill-card__dosage", "📅 " + d.dosage));
    const tags = el("div", "drill-card__tags");
    for (const c of d.categories) {
      const m = CATEGORIES[c];
      if (m) tags.appendChild(el("span", "drill-tag", `${m.icon} ${m.shortLabel}`));
    }
    card.appendChild(tags);
    grid.appendChild(card);
  });
}

// ---------------------------------------------------- full reference --
export function renderFullReference(highlightIds = []) {
  const wrap = document.getElementById("fullReference");
  wrap.innerHTML = "";
  const highlighted = new Set(highlightIds);

  for (const [key, meta] of Object.entries(CATEGORIES)) {
    const flaws = Object.entries(FLAW_LIBRARY).filter(([, f]) => f.category === key);
    const item = el("div", "acc-item");
    const head = el("div", "acc-head", `<span>${meta.icon} ${meta.label} <span style="color:var(--ink-faint);font-weight:400;">(${meta.beef})</span></span><span class="chev">▾</span>`);
    const body = el("div", "acc-body");
    body.appendChild(el("p", "", `<b style="color:var(--ink)">${meta.summary}</b>`));
    for (const [id, f] of flaws) {
      const isHit = highlighted.has(id);
      const block = el(
        "div",
        "ref-flaw",
        `<b>${isHit ? "🔴 " : ""}${compactTitle(f.title)}</b> <span class="tag ${f.severity === "subtle" ? "tag-subtle" : "tag-common"}" style="margin-inline-start:6px;">${
          f.severity === "subtle" ? "עדינה" : "נפוצה"
        }</span>
         <p>${f.description}</p>
         <p><b style="color:var(--ink)">למה זה משפיע:</b> ${f.why}</p>
         <p><b style="color:var(--ink)">תיקון:</b> ${f.fix}</p>`
      );
      body.appendChild(block);
    }
    head.addEventListener("click", () => item.classList.toggle("open"));
    item.appendChild(head);
    item.appendChild(body);
    wrap.appendChild(item);
  }

  // פותח אוטומטית את הקטגוריות שיש בהן ממצא בניתוח הנוכחי
  if (highlightIds.length) {
    const cats = new Set(Object.values(FLAW_LIBRARY).filter((f) => highlightIds.includes(f.id)).map((f) => f.category));
    [...wrap.children].forEach((item, i) => {
      const key = Object.keys(CATEGORIES)[i];
      if (cats.has(key)) item.classList.add("open");
    });
  }
}

// -------------------------------------------------------------- entry --
export function renderReport(report) {
  const results = document.getElementById("results");
  renderPlayerCard(report);
  renderAttrs(report);
  renderStrengths(report);
  renderFlaws(report);
  renderDrills(report);
  renderFullReference(report.topFlaws.map((f) => f.id));
  results.classList.add("active");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function showLowConfidence(report) {
  const results = document.getElementById("results");
  document.getElementById("gaugeValue").textContent = "--";
  document.getElementById("resultSub").textContent = report.confidenceNote || "לא הצלחנו לנתח את הסרטון.";
  document.getElementById("metaChips").innerHTML = "";
  const note = document.getElementById("confidenceNote");
  note.style.display = "block";
  note.textContent = "⚠️ " + (report.confidenceNote || "");
  document.getElementById("attrsGrid").innerHTML = "";
  document.getElementById("strengthList").innerHTML = "";
  document.getElementById("flawList").innerHTML = "";
  document.getElementById("drillGrid").innerHTML = "";
  renderFullReference([]);
  results.classList.add("active");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

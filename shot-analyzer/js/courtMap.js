// ============================================================================
// courtMap.js
// ----------------------------------------------------------------------------
// מפת חצי מגרש (מידות FIBA, במטרים) לסימון איפה ומתי בוצעה הזריקה שנותחה.
// המשתמש לוחץ/נוגע במקום על המגרש כדי לסמן את נקודת הזריקה, בוחר תאריך
// ושעה, ושומר - הנתון מצטרף לרשומת ההיסטוריה של הזריקה הזו (ראו storage.js).
// ============================================================================

const COURT_W = 15; // רוחב המגרש (מטר, FIBA)
const COURT_L = 14; // אורך חצי המגרש מהקו האחורי לקו האמצע (מטר)
const HOOP = { x: COURT_W / 2, y: 1.575 };
const PAINT = { x0: COURT_W / 2 - 2.45, x1: COURT_W / 2 + 2.45, y0: 0, y1: 5.8 };
const FT_CIRCLE_R = 1.8;
const RESTRICTED_R = 1.25;
const THREE_PT_R = 6.75;

function el(tag, attrs = {}, ns) {
  const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
const SVG_NS = "http://www.w3.org/2000/svg";

// y מוצג הפוך (הסל למעלה בציור) - ממירים קואורדינטת-מגרש (0=קו אחורי) לקואורדינטת-מסך
const toSvgY = (courtY) => COURT_L - courtY;

function arcPolylinePoints(cx, cy, r, steps = 24) {
  const apexY = cy + r;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * apexY;
    const inner = Math.max(0, r * r - (y - cy) * (y - cy));
    const dx = Math.sqrt(inner);
    left.push([cx - dx, y]);
    right.push([cx + dx, y]);
  }
  return [...left, ...right.reverse()];
}

function pointsToSvg(points) {
  return points.map(([x, y]) => `${x.toFixed(2)},${toSvgY(y).toFixed(2)}`).join(" ");
}

function buildCourtSvg() {
  const svg = el(
    "svg",
    { viewBox: `0 0 ${COURT_W} ${COURT_L}`, class: "court-svg", role: "img", "aria-label": "מפת חצי מגרש כדורסל לסימון מיקום הזריקה" },
    SVG_NS
  );

  const bg = el("rect", { x: 0, y: 0, width: COURT_W, height: COURT_L, class: "court-floor" }, SVG_NS);
  svg.appendChild(bg);

  const paint = el(
    "rect",
    { x: PAINT.x0, y: toSvgY(PAINT.y1), width: PAINT.x1 - PAINT.x0, height: PAINT.y1 - PAINT.y0, class: "court-line court-line--fill" },
    SVG_NS
  );
  svg.appendChild(paint);

  const ft = el("circle", { cx: HOOP.x, cy: toSvgY(PAINT.y1), r: FT_CIRCLE_R, class: "court-line" }, SVG_NS);
  svg.appendChild(ft);

  const restricted = el(
    "polyline",
    { points: pointsToSvg(arcPolylinePoints(HOOP.x, HOOP.y, RESTRICTED_R, 16)), class: "court-line" },
    SVG_NS
  );
  svg.appendChild(restricted);

  const threePt = el(
    "polyline",
    { points: pointsToSvg(arcPolylinePoints(HOOP.x, HOOP.y, THREE_PT_R, 40)), class: "court-line court-line--three" },
    SVG_NS
  );
  svg.appendChild(threePt);

  const backboard = el(
    "line",
    { x1: HOOP.x - 0.9, x2: HOOP.x + 0.9, y1: toSvgY(1.2), y2: toSvgY(1.2), class: "court-backboard" },
    SVG_NS
  );
  svg.appendChild(backboard);
  const rim = el("circle", { cx: HOOP.x, cy: toSvgY(HOOP.y), r: 0.23, class: "court-rim" }, SVG_NS);
  svg.appendChild(rim);

  return svg;
}

function zoneFor(courtX, courtY) {
  const dx = courtX - HOOP.x;
  const dy = courtY - HOOP.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= RESTRICTED_R) return { label: "ממש מתחת לסל", distM: dist };
  if (courtX >= PAINT.x0 && courtX <= PAINT.x1 && courtY <= PAINT.y1) return { label: "מהצבע (הקי)", distM: dist };
  if (dist >= THREE_PT_R) return { label: "משלוש (3PT)", distM: dist };
  return { label: "מהטווח הבינוני (2PT)", distM: dist };
}

function nowForDatetimeInput() {
  return isoForDatetimeInput(Date.now());
}
function isoForDatetimeInput(ms) {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * מרנדר את בורר "איפה ומתי" לתוך container, וקורא ל-onSave({location, takenAt})
 * כשהמשתמש שומר. מחזיר { destroy() }.
 */
export function renderCourtPicker(container, { onSave, initialLocation, initialTakenAt } = {}) {
  container.innerHTML = "";
  const wrap = el("div", { class: "court-picker" });

  const svg = buildCourtSvg();
  const svgBox = el("div", { class: "court-svg-box" });
  svgBox.appendChild(svg);
  wrap.appendChild(svgBox);

  const marker = el("circle", { r: 0.42, class: "court-marker", style: "display:none;" }, SVG_NS);
  svg.appendChild(marker);

  const infoBox = document.createElement("div");
  infoBox.className = "court-picker__info";
  infoBox.textContent = "הקישו במקום על המגרש שממנו זרקתם.";
  wrap.appendChild(infoBox);

  const controls = document.createElement("div");
  controls.className = "court-picker__controls";

  const timeLabel = document.createElement("label");
  timeLabel.className = "court-picker__time-label";
  timeLabel.textContent = "מתי זרקת?";
  const timeInput = document.createElement("input");
  timeInput.type = "datetime-local";
  timeInput.className = "court-picker__time";
  timeInput.value = initialTakenAt ? isoForDatetimeInput(initialTakenAt) : nowForDatetimeInput();
  timeLabel.appendChild(timeInput);
  controls.appendChild(timeLabel);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "💾 שמור מיקום וזמן";
  saveBtn.disabled = true;
  controls.appendChild(saveBtn);

  const savedNote = document.createElement("span");
  savedNote.className = "court-picker__saved";
  controls.appendChild(savedNote);

  wrap.appendChild(controls);
  container.appendChild(wrap);

  let currentLocation = null;

  if (initialLocation) {
    const courtX = initialLocation.xPct * COURT_W;
    const courtY = initialLocation.yPct * COURT_L;
    marker.setAttribute("cx", courtX);
    marker.setAttribute("cy", toSvgY(courtY));
    marker.style.display = "";
    infoBox.textContent = `📍 ${initialLocation.zone} · כ-${initialLocation.distanceM.toFixed(1)} מ' מהסל`;
    currentLocation = initialLocation;
    saveBtn.disabled = false;
  }

  function pickAt(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const courtX = Math.max(0, Math.min(COURT_W, loc.x));
    const courtY = Math.max(0, Math.min(COURT_L, COURT_L - loc.y));

    marker.setAttribute("cx", courtX);
    marker.setAttribute("cy", toSvgY(courtY));
    marker.style.display = "";

    const zone = zoneFor(courtX, courtY);
    infoBox.textContent = `📍 ${zone.label} · כ-${zone.distM.toFixed(1)} מ' מהסל`;
    currentLocation = {
      xPct: +(courtX / COURT_W).toFixed(4),
      yPct: +(courtY / COURT_L).toFixed(4),
      distanceM: +zone.distM.toFixed(2),
      zone: zone.label,
    };
    saveBtn.disabled = false;
    savedNote.textContent = "";
  }

  svg.addEventListener("pointerdown", pickAt);

  saveBtn.addEventListener("click", () => {
    if (!currentLocation) return;
    const takenAt = timeInput.value ? new Date(timeInput.value).getTime() : Date.now();
    onSave?.({ location: currentLocation, takenAt });
    savedNote.textContent = "✅ נשמר";
  });

  return {
    destroy() {
      container.innerHTML = "";
    },
  };
}

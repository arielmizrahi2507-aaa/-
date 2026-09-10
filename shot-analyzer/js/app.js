// ============================================================================
// app.js - אורקסטרציה: טאבים, קלט (קובץ/מצלמה), הרצת המנוע, רינדור תוצאות.
// ============================================================================

import { PoseEngine, PoseEngineError } from "./poseEngine.js";
import { analyzeShot } from "./shotAnalyzer.js";
import { renderReport, showLowConfidence, drawSkeleton, renderFullReference, renderBadges, renderProgress } from "./uiRenderer.js";
import { DEMO_REPORT } from "./demoData.js";
import { Auth } from "./auth.js";
import { ShotHistory } from "./storage.js";
import { evaluateBadges } from "./badges.js";
import { renderCourtPicker } from "./courtMap.js";
import { ShotReplay, ShotReplayError } from "./shotReplay.js";

const $ = (id) => document.getElementById(id);

// גבול עליון סביר לאורך קליפ: הניתוח מניח זריקה בודדת, לא סשן שלם, ונדגם
// ב-15 פריימים לשנייה (seek אמיתי לכל פריים) - סרטון ארוך מדי גם ייקח המון
// זמן וגם כנראה יבלבל את זיהוי שלב הטעינה/שחרור (שמניח תנועה אחת רציפה).
const MAX_CLIP_SECONDS = 12;

const dropzone = $("dropzone");
const fileInput = $("fileInput");
const stage = $("stage");
const mainVideo = $("mainVideo");
const overlayCanvas = $("overlayCanvas");
const overlayCtx = overlayCanvas.getContext("2d");
const progressOverlay = $("progressOverlay");
const progressText = $("progressText");
const progressFill = $("progressFill");
const errorBox = $("errorBox");
const btnDemo = $("btnDemo");

const webcamPreview = $("webcamPreview");
const btnCamStart = $("btnCamStart");
const btnCamRecord = $("btnCamRecord");
const btnCamStop = $("btnCamStop");
const camStatus = $("camStatus");

let engine = null;
let camStream = null;
let recorder = null;
let recordedChunks = [];
let busy = false;
let currentReplay = null;
const shotExtras = $("shotExtras");
const courtMapStage = $("courtMapStage");
const replayStage = $("replayStage");

const auth = new Auth();
const history = new ShotHistory();

function currentUserId() {
  return auth.user?.id || null;
}

// מציג את המדריך המקצועי המלא כבר בטעינת הדף, גם לפני כל ניתוח
renderFullReference([]);
renderProgress(history.getLocal(currentUserId()));

// -------------------------------------------------------------- auth --
const accountChip = $("accountChip");
const accountChipImg = $("accountChipImg");
const accountChipName = $("accountChipName");
const gsiButtonWrap = $("gsiButton");
const authNote = $("authNote");

auth.onChange((user) => {
  if (user) {
    accountChip.style.display = "flex";
    gsiButtonWrap.style.display = "none";
    accountChipImg.src = user.picture || "";
    accountChipName.textContent = user.name || user.email || "מחובר";
    history.pullCloud(user.id).then((remote) => {
      if (remote) renderProgress(history.getLocal(user.id));
    });
  } else {
    accountChip.style.display = "none";
    gsiButtonWrap.style.display = "";
  }
  renderProgress(history.getLocal(currentUserId()));
});

auth.init("gsiButton").then((ok) => {
  if (!ok) authNote.style.display = "block";
});

accountChip.addEventListener("click", () => auth.signOut());

// -------------------------------------------------------------- tabs --
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`panel-${btn.dataset.tab}`).classList.add("active");
    hideError();
  });
});

// ------------------------------------------------------------ dropzone --
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

// -------------------------------------------------------------- webcam --
btnCamStart.addEventListener("click", async () => {
  hideError();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    webcamPreview.srcObject = camStream;
    btnCamRecord.disabled = false;
    camStatus.textContent = "המצלמה פעילה. לחצו \"התחל הקלטה\" כשאתם מוכנים לזרוק.";
  } catch (err) {
    showError("לא הצלחנו לגשת למצלמה. ודאו שנתתם הרשאה לדפדפן ונסו שוב, או השתמשו בהעלאת סרטון.");
  }
});

btnCamRecord.addEventListener("click", () => {
  if (!camStream) return;
  if (typeof MediaRecorder === "undefined") {
    showError("הדפדפן שלכם לא תומך בהקלטת מצלמה (MediaRecorder). השתמשו באפשרות העלאת סרטון במקום.");
    return;
  }
  recordedChunks = [];
  const mimeCandidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
  recorder = mimeType ? new MediaRecorder(camStream, { mimeType }) : new MediaRecorder(camStream);
  recorder.ondataavailable = (e) => {
    if (e.data?.size) recordedChunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: recorder.mimeType || "video/webm" });
    camStream?.getTracks().forEach((t) => t.stop());
    camStream = null;
    btnCamRecord.disabled = true;
    btnCamStop.disabled = true;
    btnCamStart.disabled = false;
    camStatus.textContent = "ההקלטה הסתיימה. מתחילים בניתוח...";
    handleFile(blob);
  };
  recorder.start();
  btnCamRecord.disabled = true;
  btnCamStop.disabled = false;
  btnCamStart.disabled = true;
  camStatus.textContent = "🔴 מקליט... זרקו עכשיו, ואז לחצו \"עצור הקלטה\".";
});

btnCamStop.addEventListener("click", () => {
  recorder?.stop();
});

// ----------------------------------------------------- location + replay --
function hideShotExtras() {
  currentReplay?.destroy();
  currentReplay = null;
  shotExtras.classList.remove("active");
  courtMapStage.innerHTML = "";
  replayStage.innerHTML = "";
}

function renderShotExtras({ frames, report, entryId, userId }) {
  shotExtras.classList.add("active");

  renderCourtPicker(courtMapStage, {
    onSave: async ({ location, takenAt }) => {
      if (!entryId) return;
      const updated = await history.updateLocation(userId, entryId, { location, takenAt });
      if (updated) renderProgress(history.getLocal(userId));
    },
  });

  currentReplay?.destroy();
  currentReplay = new ShotReplay(replayStage);
  currentReplay.mount(frames, { shootingSide: report.shootingSide, phases: report.phases }).catch((err) => {
    console.error(err);
    const msg = err instanceof ShotReplayError ? err.message : "לא הצלחנו לבנות אנימציית תלת-ממד לקליפ הזה.";
    replayStage.innerHTML = `<div class="replay-error">⚠️ ${msg}</div>`;
  });
}

// -------------------------------------------------------------- demo --
btnDemo.addEventListener("click", () => {
  hideError();
  stage.classList.remove("active");
  hideShotExtras();
  renderReport(DEMO_REPORT);
  renderBadges(evaluateBadges(DEMO_REPORT));
});

// ---------------------------------------------------------- core flow --
async function handleFile(fileOrBlob) {
  if (busy) return;
  hideError();
  busy = true;
  stage.classList.add("active");
  mainVideo.controls = false;
  mainVideo.loop = false;
  const url = URL.createObjectURL(fileOrBlob);
  mainVideo.src = url;

  progressOverlay.hidden = false;
  setProgress(0, "טוען סרטון...");

  try {
    await waitFor(mainVideo, "loadedmetadata");
    overlayCanvas.width = mainVideo.videoWidth;
    overlayCanvas.height = mainVideo.videoHeight;

    if (mainVideo.duration > MAX_CLIP_SECONDS) {
      throw new PoseEngineError(
        `הסרטון ארוך מדי (${Math.round(mainVideo.duration)} שניות). האפליקציה מנתחת זריקה בודדת מקליפ קצר ` +
          `(מומלץ 2-6 שניות) - חתכו את הסרטון לקטע שמתחיל רגע לפני קבלת/איסוף הכדור ומסתיים כשנייה אחרי השחרור, ונסו שוב.`
      );
    }

    if (!engine) {
      engine = new PoseEngine();
      await engine.init((msg) => setProgress(0.02, msg));
    }

    setProgress(0.05, "מנתח תנועה, פריים אחר פריים...");
    const frames = await engine.processVideoElement(mainVideo, {
      onProgress: (p) => setProgress(0.05 + p * 0.9, `מנתח תנועה... ${Math.round(p * 100)}%`),
      onFrame: (landmarks) => drawSkeleton(overlayCtx, landmarks, overlayCanvas.width, overlayCanvas.height),
    });

    setProgress(0.97, "מחשב ציונים ובונה דוח...");
    const report = analyzeShot(frames, { width: mainVideo.videoWidth, height: mainVideo.videoHeight });

    mainVideo.controls = true;
    progressOverlay.hidden = true;

    if (report.confidence === "low" || report.overallScore == null) {
      showLowConfidence(report);
      hideShotExtras();
    } else {
      const userId = currentUserId();
      const priorList = history.getLocal(userId);
      const previousCategories = priorList.length ? priorList[priorList.length - 1].categories : null;
      renderReport(report, previousCategories);
      renderBadges(evaluateBadges(report));
      const { entry, list } = await history.save(userId, report);
      renderProgress(list);
      renderShotExtras({ frames, report, entryId: entry.id, userId });
    }
  } catch (err) {
    console.error(err);
    progressOverlay.hidden = true;
    const msg = err instanceof PoseEngineError ? err.message : "אירעה שגיאה בעיבוד הסרטון. נסו קובץ אחר או רעננו את הדף.";
    showError(msg);
  } finally {
    busy = false;
  }
}

function setProgress(ratio, text) {
  progressFill.style.width = `${Math.round(clamp01(ratio) * 100)}%`;
  progressText.textContent = text;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function waitFor(elm, evt) {
  return new Promise((resolve, reject) => {
    elm.addEventListener(evt, resolve, { once: true });
    elm.addEventListener("error", () => reject(new Error("שגיאה בטעינת הווידאו")), { once: true });
  });
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("show");
}
function hideError() {
  errorBox.classList.remove("show");
  errorBox.textContent = "";
}

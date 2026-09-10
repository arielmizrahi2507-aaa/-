// ============================================================================
// poseEngine.js
// ----------------------------------------------------------------------------
// עטיפה סביב MediaPipe Tasks Vision (PoseLandmarker) - מריץ זיהוי שלד גוף
// (33 נקודות ציון) ישירות בדפדפן, ללא שרת, מתוך קובץ וידאו שהועלה.
// ============================================================================

const CDN_VERSION = "1.0.1";
const VISION_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}`;
const WASM_BASE = `${VISION_MODULE_URL}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

// אינדקסים של נקודות הציון במודל ה-Pose של MediaPipe (33 נקודות)
export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

export const SKELETON_CONNECTIONS = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  [LM.LEFT_WRIST, LM.LEFT_INDEX],
  [LM.RIGHT_WRIST, LM.RIGHT_INDEX],
  [LM.NOSE, LM.LEFT_EYE],
  [LM.NOSE, LM.RIGHT_EYE],
];

// מקפיץ אלמנט וידאו לחותמת זמן נתונה ומחכה שהפריים בפועל ייטען, עם timeout
// גיבוי (חלק מהדפדפנים לא תמיד יורים 'seeked' עבור currentTime זהה לנוכחי).
function seekTo(videoEl, timeSec, timeoutMs = 2000) {
  if (Math.abs(videoEl.currentTime - timeSec) < 0.001) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      videoEl.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => finish();
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = timeSec;
    setTimeout(finish, timeoutMs);
  });
}

export class PoseEngineError extends Error {}

export class PoseEngine {
  constructor() {
    this.landmarker = null;
    this.ready = false;
  }

  /**
   * טוען את המודל. מנסה תחילה האצת GPU, ואם נכשל (למשל בסביבה ללא GPU
   * זמין) נופל בחזרה ל-CPU כדי שהאפליקציה תמשיך לעבוד בכל מקרה.
   */
  async init(onProgress) {
    onProgress?.("טוען מנוע ראייה ממוחשבת (MediaPipe)...");
    let mod;
    try {
      mod = await import(/* webpackIgnore: true */ VISION_MODULE_URL);
    } catch (err) {
      throw new PoseEngineError(
        "לא הצלחנו לטעון את ספריית זיהוי השלד מהרשת. בדקו חיבור אינטרנט ונסו שוב."
      );
    }
    const { PoseLandmarker, FilesetResolver } = mod;
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

    onProgress?.("טוען מודל זיהוי שלד גוף...");
    const baseOptions = {
      modelAssetPath: MODEL_URL,
      numPoses: 1,
      runningMode: "VIDEO",
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        ...baseOptions,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      });
    } catch (gpuErr) {
      try {
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          ...baseOptions,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      } catch (cpuErr) {
        throw new PoseEngineError(
          "טעינת מודל זיהוי השלד נכשלה (גם GPU וגם CPU). ייתכן שהדפדפן לא נתמך."
        );
      }
    }
    this.ready = true;
  }

  /**
   * מריץ זיהוי שלד על אלמנט וידאו (קובץ שהועלה או הקלטה), פריים-אחר-פריים,
   * ע"י קפיצה (seek) לחותמות זמן קבועות לפי SAMPLE_FPS - ולא ע"י דגימה
   * תוך כדי ניגון בזמן אמת. מחזיר מערך של { t (ms), landmarks, worldLandmarks }.
   * worldLandmarks הן קואורדינטות תלת-ממדיות מטריות (מטרים, מרכזן במפרק
   * הירכיים) - בשונה מ-landmarks הרגילות שהן קואורדינטות דו-ממדיות מנורמלות
   * לפריים התמונה. אלה הנתונים שמאפשרים לשחזר את הזריקה כאנימציה תלת-ממדית
   * ולצפות בה מזוויות שלא צולמו במקור (ראו js/shotReplay.js).
   *
   * חשוב: דגימה תוך כדי ניגון אמיתי (כפי שהיה כאן קודם, ע"י
   * requestVideoFrameCallback/requestAnimationFrame במקביל ל-video.play())
   * תלויה בביצועי המכשיר באותו רגע - באותו סרטון בדיוק אפשר לתפוס פריימים
   * שונים בכל הרצה, וכתוצאה מכך ציון שונה בכל ניתוח. דגימה ע"י seek
   * לחותמות זמן קבועות מבטיחה שאותו סרטון תמיד יניב את אותם הפריימים
   * ואת אותו ציון, בכל מכשיר ובכל הרצה.
   */
  async processVideoElement(videoEl, { onProgress, onFrame } = {}) {
    if (!this.ready) throw new PoseEngineError("מנוע הזיהוי עדיין לא מוכן");
    const duration = videoEl.duration;
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new PoseEngineError("לא הצלחנו לקרוא את אורך הסרטון. נסו קובץ אחר.");
    }

    videoEl.pause();
    videoEl.muted = true;
    videoEl.playsInline = true;

    // 15 פריימים לשנייה מספיק ליישוב שלבי הזריקה (טעינה/שחרור) בבירור,
    // ומכפיל בערך פי 2 את מהירות הניתוח לעומת 30 - כל פריים דורש seek
    // אמיתי (המתנה לפענוח הווידאו), לא רק דגימת מסגרת שכבר מוצגת.
    const SAMPLE_FPS = 15;
    const frameCount = Math.max(1, Math.round(duration * SAMPLE_FPS));
    const frames = [];
    let lastTs = -1;

    for (let i = 0; i < frameCount; i++) {
      const targetSec = Math.min(duration - 1 / SAMPLE_FPS / 2, i / SAMPLE_FPS);
      await seekTo(videoEl, targetSec);

      let tMs = Math.round(targetSec * 1000);
      if (tMs <= lastTs) tMs = lastTs + 1;
      lastTs = tMs;

      try {
        const result = this.landmarker.detectForVideo(videoEl, tMs);
        if (result?.landmarks?.length) {
          const worldLandmarks = result.worldLandmarks?.[0] || null;
          frames.push({ t: tMs, landmarks: result.landmarks[0], worldLandmarks });
          onFrame?.(result.landmarks[0], tMs);
        }
      } catch (e) {
        // פריים בודד שנכשל לא אמור להפיל את כל הניתוח
      }
      onProgress?.((i + 1) / frameCount);
    }

    return frames;
  }

  destroy() {
    this.landmarker?.close?.();
    this.landmarker = null;
    this.ready = false;
  }
}

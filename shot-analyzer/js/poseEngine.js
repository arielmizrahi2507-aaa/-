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
   * מריץ זיהוי שלד על אלמנט וידאו (קובץ שהועלה או הקלטה) פריים-אחר-פריים,
   * תוך כדי ניגון בזמן אמת. מחזיר מערך של { t (ms), landmarks }.
   */
  async processVideoElement(videoEl, { onProgress, onFrame } = {}) {
    if (!this.ready) throw new PoseEngineError("מנוע הזיהוי עדיין לא מוכן");
    const frames = [];
    const duration = videoEl.duration || 0;
    let lastTs = -1;

    const detectAt = (mediaTimeSec) => {
      let tMs = Math.round(mediaTimeSec * 1000);
      if (tMs <= lastTs) tMs = lastTs + 1;
      lastTs = tMs;
      try {
        const result = this.landmarker.detectForVideo(videoEl, tMs);
        if (result?.landmarks?.length) {
          frames.push({ t: tMs, landmarks: result.landmarks[0] });
          onFrame?.(result.landmarks[0], tMs);
        }
      } catch (e) {
        // פריים בודד שנכשל לא אמור להפיל את כל הניתוח
      }
      if (duration > 0) onProgress?.(Math.min(1, videoEl.currentTime / duration));
    };

    return new Promise((resolve, reject) => {
      const supportsRVFC = typeof videoEl.requestVideoFrameCallback === "function";
      let rafId = null;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        resolve(frames);
      };

      if (supportsRVFC) {
        const onFrame = (_now, metadata) => {
          if (finished) return;
          detectAt(metadata?.mediaTime ?? videoEl.currentTime);
          if (!videoEl.ended && !videoEl.paused) {
            videoEl.requestVideoFrameCallback(onFrame);
          }
        };
        videoEl.requestVideoFrameCallback(onFrame);
      } else {
        const step = () => {
          if (finished) return;
          detectAt(videoEl.currentTime);
          if (!videoEl.ended && !videoEl.paused) {
            rafId = requestAnimationFrame(step);
          }
        };
        rafId = requestAnimationFrame(step);
      }

      videoEl.addEventListener("ended", finish, { once: true });
      videoEl.addEventListener(
        "error",
        () => reject(new PoseEngineError("שגיאה בטעינת קובץ הווידאו")),
        { once: true }
      );

      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.play().catch(reject);
    });
  }

  destroy() {
    this.landmarker?.close?.();
    this.landmarker = null;
    this.ready = false;
  }
}

// ============================================================================
// shotReplay.js
// ----------------------------------------------------------------------------
// משחזר את הזריקה כאנימציה תלת-ממדית על "גוף" גנרי (עיגולים ומקלות/שוקיות,
// לא הווידאו המקורי), מתוך נקודות הציון התלת-ממדיות (worldLandmarks) שכבר
// נאספו ב-poseEngine.js. בזכות זה אפשר לצפות בתנועה מזוויות שלא צולמו בפועל:
// מלפנים, מאחור, ומכל צד - כאילו מצלמה נוספת עמדה שם בזמן הזריקה.
//
// שקיפות: העומק (z) של כל נקודה מוערך על ידי המודל מתוך וידאו חד-עיני
// (מצלמה אחת) - זהו אומדן טוב לצפייה בתבנית התנועה, לא Motion Capture מדויק
// עם מצלמות מרובות. לכן ייתכנו קלות עיוותים בזוויות הצד/מאחור.
// ============================================================================

import { LM, SKELETON_CONNECTIONS } from "./poseEngine.js";
import { sub3, mid3, len3, meanVec3, computeBodyBasis, buildTransformedFrames } from "./bodyGeometry.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// "forward" אמור להיות הכיוון שאליו פונה החזה/הפנים (מתוקן לפי כיוון האף,
// ראו computeBodyBasis) - אבל בבדיקה עם וידאו אמיתי (לא רק נתוני סינתטיים
// עצמאיים) התברר שהתיקון לפי האף יוצא הפוך בפועל (ה"אף" לא אמין מספיק
// כאיתות עומק ב-worldLandmarks אמיתיים). ולכן, במקום לנחש שוב, המיפוי כאן
// הפוך במכוון מהכיוון ה"תיאורטי" - מלפנים=+forward, מאחור=-forward.
const ANGLES = {
  front: { label: "מלפנים", dir: [0, 0, 1] },
  right: { label: "מצד ימין", dir: [1, 0, 0] },
  left: { label: "מצד שמאל", dir: [-1, 0, 0] },
  back: { label: "מאחור", dir: [0, 0, -1] },
};

const BONE_RADIUS = {
  default: 0.024,
  thigh: 0.05,
  shin: 0.04,
  upperArm: 0.038,
  forearm: 0.03,
};

function boneKind(a, b) {
  const pair = new Set([a, b]);
  const has = (x, y) => pair.has(x) && pair.has(y);
  if (has(LM.LEFT_HIP, LM.LEFT_KNEE) || has(LM.RIGHT_HIP, LM.RIGHT_KNEE)) return "thigh";
  if (has(LM.LEFT_KNEE, LM.LEFT_ANKLE) || has(LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) return "shin";
  if (has(LM.LEFT_SHOULDER, LM.LEFT_ELBOW) || has(LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW)) return "upperArm";
  if (has(LM.LEFT_ELBOW, LM.LEFT_WRIST) || has(LM.RIGHT_ELBOW, LM.RIGHT_WRIST)) return "forearm";
  return "default";
}

function findNearestIndex(frames, targetT) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = Math.abs(frames[i].t - targetT);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

const HEAD_INDICES = [LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR];
const USED_INDICES = [...new Set(Object.values(LM))];

function computeBounds(transformedFrames) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const fr of transformedFrames) {
    for (const idx of USED_INDICES) {
      const p = fr.points[idx];
      if (!p) continue;
      min.x = Math.min(min.x, p.x); max.x = Math.max(max.x, p.x);
      min.y = Math.min(min.y, p.y); max.y = Math.max(max.y, p.y);
      min.z = Math.min(min.z, p.z); max.z = Math.max(max.z, p.z);
    }
  }
  if (!Number.isFinite(min.x)) return { center: { x: 0, y: 0, z: 0 }, radius: 1.2 };
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const radius = Math.max(0.9, len3({ x: max.x - min.x, y: max.y - min.y, z: max.z - min.z }) / 2);
  return { center, radius };
}

let threeModulePromise = null;
function loadThree() {
  if (!threeModulePromise) threeModulePromise = import(/* webpackIgnore: true */ THREE_URL);
  return threeModulePromise;
}

export class ShotReplayError extends Error {}

export class ShotReplay {
  constructor(container) {
    this.container = container;
    this.THREE = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.resizeObserver = null;
    this.rafId = null;
    this.jointMeshes = new Map();
    this.boneMeshes = [];
    this.headMesh = null;
    this.torsoMesh = null;
    this.transformedFrames = [];
    this.bounds = { center: { x: 0, y: 0, z: 0 }, radius: 1.2 };
    this.duration = 0;
    this.angle = "front";
    this.playing = false;
    this.speed = 1;
    this.playheadMs = 0;
    this._lastTick = 0;
    this.onTimeUpdate = null;
    this.destroyed = false;
  }

  async mount(rawFrames, { shootingSide = "right", phases = null } = {}) {
    const usable = rawFrames.filter((f) => f.worldLandmarks);
    if (usable.length < 6) {
      throw new ShotReplayError("אין מספיק נקודות תלת-ממד לשחזור אנימציה עבור הקליפ הזה.");
    }

    let basisFromIdx = 0;
    let basisToIdx = Math.min(usable.length - 1, Math.max(2, Math.round(usable.length * 0.25)));
    if (phases) {
      basisFromIdx = findNearestIndex(usable, phases.setupT);
      basisToIdx = Math.max(basisFromIdx + 1, findNearestIndex(usable, phases.dipT));
    }
    const basis = computeBodyBasis(usable, basisFromIdx, basisToIdx) || computeBodyBasis(usable, 0, usable.length - 1);
    if (!basis) throw new ShotReplayError("לא הצלחנו לזהות כיוון גוף יציב לבניית האנימציה.");

    this.transformedFrames = buildTransformedFrames(usable, basis);
    this.bounds = computeBounds(this.transformedFrames);
    this.duration = this.transformedFrames[this.transformedFrames.length - 1].t - this.transformedFrames[0].t;
    this.shootingSide = shootingSide;

    const THREE = await loadThree();
    if (this.destroyed) return;
    this.THREE = THREE;
    this._buildDom();
    this._buildScene(THREE);
    this._buildAvatar(THREE);
    this.setAngle(this.angle);
    this._renderFrameAt(0);
    this._startLoop();
    this.play();
  }

  _buildDom() {
    this.container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "replay-wrap";

    const angleRow = document.createElement("div");
    angleRow.className = "angle-btns";
    this.angleButtons = {};
    for (const [key, def] of Object.entries(ANGLES)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "angle-btn";
      btn.textContent = def.label;
      btn.addEventListener("click", () => this.setAngle(key));
      angleRow.appendChild(btn);
      this.angleButtons[key] = btn;
    }
    wrap.appendChild(angleRow);

    const canvasBox = document.createElement("div");
    canvasBox.className = "replay-canvas-box";
    wrap.appendChild(canvasBox);
    this.canvasBox = canvasBox;

    const controls = document.createElement("div");
    controls.className = "replay-controls";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "btn btn-secondary replay-playbtn";
    playBtn.textContent = "⏸️";
    playBtn.addEventListener("click", () => {
      if (this.playing) {
        this.pause();
        playBtn.textContent = "▶️";
      } else {
        this.play();
        playBtn.textContent = "⏸️";
      }
    });
    this.playBtn = playBtn;
    controls.appendChild(playBtn);

    const scrub = document.createElement("input");
    scrub.type = "range";
    scrub.min = "0";
    scrub.max = "1000";
    scrub.value = "0";
    scrub.className = "replay-scrub";
    scrub.setAttribute("aria-label", "מיקום בציר הזמן של הזריקה");
    scrub.addEventListener("input", () => {
      this.pause();
      playBtn.textContent = "▶️";
      const ratio = Number(scrub.value) / 1000;
      this.seekTo(ratio * this.duration);
    });
    this.scrubEl = scrub;
    controls.appendChild(scrub);

    const speedSel = document.createElement("select");
    speedSel.className = "replay-speed";
    for (const s of [1, 0.5, 0.25]) {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = s === 1 ? "מהירות רגילה" : `סלואו-מושן ×${s}`;
      speedSel.appendChild(opt);
    }
    speedSel.addEventListener("change", () => this.setSpeed(Number(speedSel.value)));
    controls.appendChild(speedSel);

    wrap.appendChild(controls);

    const note = document.createElement("div");
    note.className = "replay-note";
    note.textContent =
      "🎥 שחזור תלת-ממדי מוערך מתוך נקודות ציון של שלד הגוף (וידאו חד-עיני) - טוב לצפייה בתבנית התנועה מזוויות שלא צולמו, אך אינו Motion Capture מדויק.";
    wrap.appendChild(note);

    this.onTimeUpdate = (ms, duration) => {
      this.scrubEl.value = String(Math.round((ms / (duration || 1)) * 1000));
    };

    this.container.appendChild(wrap);
  }

  _buildScene(THREE) {
    const scene = new THREE.Scene();
    scene.background = null;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x11151c, 1.1);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    const groundRadius = this.bounds.radius * 1.6;
    const groundY = this.bounds.center.y - this.bounds.radius;
    const grid = new THREE.GridHelper(groundRadius * 2, 10, 0x6f8bb0, 0x2a2f3a);
    grid.position.set(0, groundY, 0);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvasBox.appendChild(renderer.domElement);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    const resize = () => {
      const w = this.canvasBox.clientWidth || 320;
      const h = this.canvasBox.clientHeight || Math.round(w * 0.75);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.canvasBox);
  }

  _buildAvatar(THREE) {
    const jointGeo = new THREE.SphereGeometry(0.03, 12, 10);
    const jointMat = new THREE.MeshStandardMaterial({ color: 0xffc866, roughness: 0.5, metalness: 0.1 });
    for (const idx of USED_INDICES) {
      const mesh = new THREE.Mesh(jointGeo, jointMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.jointMeshes.set(idx, mesh);
    }

    const shootSide = this.shootingSide === "left" ? "LEFT" : "RIGHT";
    const shootJoints = new Set([LM[`${shootSide}_SHOULDER`], LM[`${shootSide}_ELBOW`], LM[`${shootSide}_WRIST`], LM[`${shootSide}_INDEX`]]);

    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x7d93b8, roughness: 0.55, metalness: 0.15 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8a831, roughness: 0.4, metalness: 0.2 });
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const isShootArm = shootJoints.has(a) && shootJoints.has(b);
      const mesh = new THREE.Mesh(cylGeo, isShootArm ? goldMat : steelMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.boneMeshes.push({ a, b, mesh, radius: BONE_RADIUS[boneKind(a, b)] });
    }

    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7, metalness: 0.05 });
    this.torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), torsoMat);
    this.torsoMesh.visible = false;
    this.scene.add(this.torsoMesh);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.6, metalness: 0.05 });
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), headMat);
    this.headMesh.visible = false;
    this.scene.add(this.headMesh);
  }

  _orient(mesh, pA, pB, radius) {
    const THREE = this.THREE;
    const a = new THREE.Vector3(pA.x, pA.y, pA.z);
    const b = new THREE.Vector3(pB.x, pB.y, pB.z);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    if (length < 1e-5) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.scale.set(radius, length, radius);
    dir.normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  _renderFrameAt(ms) {
    if (!this.transformedFrames.length) return;
    const targetT = this.transformedFrames[0].t + ms;
    const idx = findNearestIndex(this.transformedFrames, targetT);
    const points = this.transformedFrames[idx].points;

    for (const [idxKey, mesh] of this.jointMeshes) {
      const p = points[idxKey];
      if (p) {
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
      } else {
        mesh.visible = false;
      }
    }
    for (const bone of this.boneMeshes) {
      const pA = points[bone.a];
      const pB = points[bone.b];
      if (pA && pB) this._orient(bone.mesh, pA, pB, bone.radius);
      else bone.mesh.visible = false;
    }
    const lS = points[LM.LEFT_SHOULDER], rS = points[LM.RIGHT_SHOULDER];
    const lH = points[LM.LEFT_HIP], rH = points[LM.RIGHT_HIP];
    if (lS && rS && lH && rH) {
      const shoulderMid = mid3(lS, rS);
      const hipMid = mid3(lH, rH);
      const shoulderWidth = len3(sub3(lS, rS));
      this._orient(this.torsoMesh, hipMid, shoulderMid, Math.max(0.09, shoulderWidth * 0.34));
    } else {
      this.torsoMesh.visible = false;
    }
    const headPts = HEAD_INDICES.map((i) => points[i]).filter(Boolean);
    if (headPts.length) {
      const c = meanVec3(headPts);
      this.headMesh.visible = true;
      this.headMesh.position.set(c.x, c.y + 0.05, c.z);
    } else {
      this.headMesh.visible = false;
    }

    this.playheadMs = ms;
    this.renderer.render(this.scene, this.camera);
    this.onTimeUpdate?.(ms, this.duration);
  }

  setAngle(name) {
    const def = ANGLES[name] || ANGLES.front;
    this.angle = name;
    if (this.angleButtons) {
      for (const [key, btn] of Object.entries(this.angleButtons)) btn.classList.toggle("active", key === name);
    }
    if (!this.camera) return;
    const { center, radius } = this.bounds;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fovRad / 2)) * 1.15;
    this.camera.position.set(
      center.x + def.dir[0] * dist,
      center.y + radius * 0.12,
      center.z + def.dir[2] * dist
    );
    this.camera.lookAt(center.x, center.y - radius * 0.05, center.z);
    if (this.transformedFrames.length) this._renderFrameAt(this.playheadMs);
  }

  play() {
    if (!this.transformedFrames.length) return;
    if (this.playheadMs >= this.duration) this.playheadMs = 0;
    this.playing = true;
    this._lastTick = performance.now();
  }

  pause() {
    this.playing = false;
  }

  seekTo(ms) {
    this.playheadMs = Math.max(0, Math.min(this.duration, ms));
    this._renderFrameAt(this.playheadMs);
  }

  setSpeed(mult) {
    this.speed = mult;
  }

  _startLoop() {
    const tick = (now) => {
      if (this.destroyed) return;
      if (this.playing) {
        const dt = now - this._lastTick;
        this._lastTick = now;
        let next = this.playheadMs + dt * this.speed;
        if (next >= this.duration) next = 0;
        this._renderFrameAt(next);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this._lastTick = performance.now();
    this.rafId = requestAnimationFrame(tick);
  }

  destroy() {
    this.destroyed = true;
    this.playing = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.container.innerHTML = "";
  }
}

export { ANGLES };

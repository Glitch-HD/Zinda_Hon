"use client";
// Face match + liveness, run entirely in the browser (free, and the photo never leaves the phone).
// face-api turns a face into 128 numbers; MediaPipe gives 478 face points + 52 expression scores for liveness.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

type FaceApi = typeof import("@vladmandic/face-api");
let faceApiPromise: Promise<FaceApi> | null = null;
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models/face-api"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models/face-api"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models/face-api"),
      ]);
      return faceapi;
    })();
    faceApiPromise.catch(() => { faceApiPromise = null; });
  }
  return faceApiPromise;
}

export function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe-wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/mediapipe/face_landmarker.task" },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: true,
      });
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export type FaceSample = { descriptor: number[]; quality: number };

/** Takes several frames and averages the descriptors, which is steadier than one frame. */
export async function captureDescriptor(video: HTMLVideoElement, frames = 3): Promise<FaceSample | null> {
  const faceapi = await loadFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const samples: { d: Float32Array; s: number }[] = [];
  for (let i = 0; i < frames * 3 && samples.length < frames; i++) {
    const r = await faceapi.detectSingleFace(video, options).withFaceLandmarks().withFaceDescriptor();
    if (r) samples.push({ d: r.descriptor, s: r.detection.score });
    await new Promise((res) => setTimeout(res, 150));
  }
  if (samples.length === 0) return null;
  const avg = new Array(128).fill(0);
  for (const { d } of samples) for (let i = 0; i < 128; i++) avg[i] += d[i] / samples.length;
  const quality = samples.reduce((a, b) => a + b.s, 0) / samples.length;
  return { descriptor: avg.map((v) => Math.round(v * 1e6) / 1e6), quality: Math.round(quality * 1000) / 1000 };
}

export type Challenge = "blink" | "turn_left" | "turn_right";

export function randomChallenges(): Challenge[] {
  const turns: Challenge[] = Math.random() < 0.5 ? ["turn_left", "turn_right"] : ["turn_right", "turn_left"];
  const list: Challenge[] = ["blink", turns[0]];
  return Math.random() < 0.5 ? list : list.reverse();
}

/**
 * Watches the camera until the person does the requested movement, or the time runs out.
 * Also fails if two faces are visible (someone holding up a photo next to a real face).
 */
export async function waitForChallenge(video: HTMLVideoElement, challenge: Challenge, timeoutMs = 8000): Promise<{ done: boolean; ms: number }> {
  const landmarker = await loadLandmarker();
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const now = performance.now();
      if (now - start > timeoutMs) return resolve({ done: false, ms: Math.round(now - start) });
      if (video.readyState >= 2) {
        const r = landmarker.detectForVideo(video, now);
        if (r.faceLandmarks.length === 1) {
          const lm = r.faceLandmarks[0];
          const cats = r.faceBlendshapes?.[0]?.categories ?? [];
          const score = (name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;
          // Nose tip (1) between the cheeks (234, 454): 0.5 = looking straight at the camera.
          const ratio = (lm[1].x - lm[234].x) / Math.max(1e-6, lm[454].x - lm[234].x);
          let ok = false;
          if (challenge === "blink") ok = score("eyeBlinkLeft") > 0.5 && score("eyeBlinkRight") > 0.5;
          // Camera frames are not mirrored, so the person's left appears on the right of the image.
          if (challenge === "turn_left") ok = ratio > 0.68;
          if (challenge === "turn_right") ok = ratio < 0.32;
          if (ok) return resolve({ done: true, ms: Math.round(now - start) });
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

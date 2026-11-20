"use client";
// Weak-network support for the face check. The face models are about 20 MB in total. On a 2G signal that
// is many minutes, so we download them ahead of time (on Wi-Fi or 4G, or when the person taps "Get ready")
// into a cache on the phone that survives app updates. After that, the face check works with no internet.

export const MODEL_CACHE = "zh-models-v1";

const COMMON = [
  { url: "/models/face-api/tiny_face_detector_model-weights_manifest.json", bytes: 3_219 },
  { url: "/models/face-api/tiny_face_detector_model.bin", bytes: 193_321 },
  { url: "/models/face-api/face_landmark_68_model-weights_manifest.json", bytes: 8_485 },
  { url: "/models/face-api/face_landmark_68_model.bin", bytes: 356_840 },
  { url: "/models/face-api/face_recognition_model-weights_manifest.json", bytes: 19_615 },
  { url: "/models/face-api/face_recognition_model.bin", bytes: 6_444_032 },
  { url: "/models/mediapipe/face_landmarker.task", bytes: 3_758_596 },
];
const SIMD = [
  { url: "/mediapipe-wasm/vision_wasm_internal.js", bytes: 204_284 },
  { url: "/mediapipe-wasm/vision_wasm_internal.wasm", bytes: 9_574_032 },
];
const NO_SIMD = [
  { url: "/mediapipe-wasm/vision_wasm_nosimd_internal.js", bytes: 204_137 },
  { url: "/mediapipe-wasm/vision_wasm_nosimd_internal.wasm", bytes: 9_448_638 },
];

function hasSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch { return false; }
}

export function faceFiles() { return [...COMMON, ...(hasSimd() ? SIMD : NO_SIMD)]; }
export function faceBytes() { return faceFiles().reduce((a, f) => a + f.bytes, 0); }
export const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);

type Conn = { effectiveType?: string; downlink?: number; saveData?: boolean; type?: string };
export function connection(): Conn {
  return ((navigator as unknown as { connection?: Conn }).connection) ?? {};
}

/** 2G, slow 2G, or the person turned on data saver. */
export function isSlowNetwork() {
  const c = connection();
  return Boolean(c.saveData) || c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

/** On Wi-Fi or 4G without data saver: fine to download 20 MB without asking. */
export function isGoodNetwork() {
  const c = connection();
  if (c.saveData) return false;
  return c.type === "wifi" || c.type === "ethernet" || c.effectiveType === "4g";
}

/** Rough download time in seconds, from the speed the phone reports (Mbit/s). Null when unknown. */
export function estimateSeconds(bytes: number) {
  const c = connection();
  const mbps = c.downlink && c.downlink > 0 ? c.downlink : c.effectiveType === "slow-2g" ? 0.03 : c.effectiveType === "2g" ? 0.07 : c.effectiveType === "3g" ? 0.7 : null;
  return mbps ? Math.round((bytes * 8) / (mbps * 1_000_000)) : null;
}

export function humanTime(s: number | null) {
  if (s === null) return "unknown";
  if (s < 60) return `about ${Math.max(1, s)} seconds`;
  if (s < 3600) return `about ${Math.round(s / 60)} minutes`;
  return `about ${(s / 3600).toFixed(1)} hours`;
}

/** How many of the face files are already saved on this phone. */
export async function missingFaceFiles() {
  const files = faceFiles();
  if (typeof caches === "undefined") return files;
  const hits = await Promise.all(files.map((f) => caches.match(f.url).catch(() => undefined)));
  return files.filter((_, i) => !hits[i]);
}

/**
 * Downloads the missing face files into the phone's cache, reporting progress in bytes. A file is only
 * saved once it has fully arrived, so a dropped connection leaves no broken files; the next try
 * continues with the files still missing.
 */
export async function prefetchFaceFiles(onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  if (typeof caches === "undefined") throw new Error("This browser cannot save files for offline use.");
  const missing = await missingFaceFiles();
  const total = faceBytes();
  let done = total - missing.reduce((a, f) => a + f.bytes, 0);
  onProgress?.(done, total);
  const cache = await caches.open(MODEL_CACHE);
  for (const f of missing) {
    const res = await fetch(f.url, { signal, cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      parts.push(value);
      got += value.length;
      onProgress?.(done + Math.min(got, f.bytes), total);
    }
    await cache.put(f.url, new Response(new Blob(parts as BlobPart[], { type: res.headers.get("content-type") ?? "application/octet-stream" }), { headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" } }));
    done += f.bytes;
    onProgress?.(done, total);
  }
  return { total };
}

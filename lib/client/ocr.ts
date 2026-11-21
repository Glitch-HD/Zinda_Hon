"use client";
// Reads the printed text on a photo of the pension book (computer vision: OCR), in the browser, for free.
// The QR proves the book is ours; reading the printed name as well catches a real QR pasted onto
// someone else's book. It is skipped on a slow connection (the reader is a few MB), and it gives up
// after a time limit: OCR is extra evidence, never a reason to block her.

export type OcrResult = { text: string; confidence: number; ms: number };

export async function readPrintedText(image: Blob, timeoutMs = 15000): Promise<OcrResult | null> {
  const started = performance.now();
  const work = (async () => {
    const { createWorker } = await import("tesseract.js");
    // Everything is served from our own site (public/ocr), so the demo does not depend on a CDN.
    const worker = await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/", langPath: "/ocr" });
    try {
      const { data } = await worker.recognize(image);
      return { text: data.text.replace(/\s+/g, " ").trim().slice(0, 1000), confidence: Math.round(data.confidence), ms: Math.round(performance.now() - started) };
    } finally {
      await worker.terminate();
    }
  })();
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
  try { return await Promise.race([work, timeout]); } catch { return null; }
}

"use client";
import { useEffect, useRef, useState } from "react";

// Reads the signed QR on the pension book with the back camera, or from a photo.
// Blurry or unreadable photos are reported as "unreadable" (ask to retake), never as forged.
export default function QrScanner({ onResult }: { onResult: (text: string | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; stopStream(); }, []);

  function stopStream() {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
  }

  async function decodeFrom(source: CanvasImageSource, w: number, h: number) {
    const jsQR = (await import("jsqr")).default;
    const c = canvasRef.current!;
    const scale = Math.min(1, 800 / Math.max(w, h));
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return jsQR(img.data, img.width, img.height)?.data ?? null;
  }

  async function startCamera() {
    setMsg(null);
    stopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setScanning(true);
      const started = Date.now();
      while (!stopRef.current) {
        if (v.readyState >= 2) {
          const text = await decodeFrom(v, v.videoWidth, v.videoHeight);
          if (text) { stopStream(); setScanning(false); onResult(text); return; }
        }
        if (Date.now() - started > 20000) {
          stopStream(); setScanning(false);
          setMsg("Could not read the QR. Try more light, or take a photo instead. / کیو آر نہیں پڑھا جا سکا۔");
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch {
      setScanning(false);
      setMsg("Camera could not start. You can take a photo instead.");
    }
  }

  async function fromFile(file: File) {
    const bmp = await createImageBitmap(file);
    const text = await decodeFrom(bmp, bmp.width, bmp.height);
    if (!text) setMsg("The QR in this photo is not readable (maybe blurry). / تصویر دھندلی ہے، دوبارہ لیں۔");
    onResult(text);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl" style={{ background: "#000", aspectRatio: "4 / 3", display: scanning ? "block" : "none" }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      </div>
      <canvas ref={canvasRef} hidden />
      {!scanning && <button className="btn btn-big" onClick={startCamera}><span className="text-3xl"></span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">پنشن بک اسکین کریں</span><span className="en text-sm font-semibold opacity-90">Scan pension book</span></span></button>}
      <label className="btn btn-ghost w-full">
        <span className="en">Use a photo instead</span><span className="ur">تصویر سے</span>
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
      </label>
      {msg && <p role="alert" style={{ color: "var(--warn)" }}>{msg}</p>}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { captureDescriptor, loadFaceApi, loadLandmarker, randomChallenges, waitForChallenge, type Challenge } from "@/lib/client/face";
import { speakUrdu } from "@/lib/client/voice";
import { estimateSeconds, humanTime, mb, missingFaceFiles } from "@/lib/client/prefetch";

export type FaceResult = {
  descriptor: number[];
  quality: number;
  liveness: { passed: boolean; challenges: { action: Challenge; done: boolean; ms: number }[] };
  /** The server-signed, one-time ticket that chose the order of movements (null if none could be had). */
  ticket: string | null;
};
export type Ticket = { token: string; sequence: Challenge[] };

const PROMPT: Record<Challenge, { ur: string; en: string; icon: string }> = {
  blink: { ur: "اپنی آنکھیں جھپکائیں", en: "Blink your eyes", icon: "😑" },
  turn_left: { ur: "سر کو اپنے بائیں طرف موڑیں", en: "Turn your head to YOUR left", icon: "⬅️" },
  turn_right: { ur: "سر کو اپنے دائیں طرف موڑیں", en: "Turn your head to YOUR right", icon: "➡️" },
};

export default function FaceCapture({ withLiveness = true, onDone, getTicket, onSlow }: { withLiveness?: boolean; onDone: (r: FaceResult) => void; getTicket?: () => Promise<Ticket | null>; onSlow?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "challenge" | "capturing" | "error">("idle");
  const [current, setCurrent] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDownload, setToDownload] = useState(0);

  // How much still has to download before the face check can start (0 when it is saved on the phone).
  useEffect(() => {
    missingFaceFiles().then((m) => setToDownload(m.filter((f) => withLiveness || !f.url.includes("mediapipe")).reduce((a, f) => a + f.bytes, 0))).catch(() => undefined);
  }, [withLiveness]);

  useEffect(() => () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError(null);
    setPhase("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      await Promise.all([loadFaceApi(), withLiveness ? loadLandmarker() : Promise.resolve()]);

      const results: FaceResult["liveness"]["challenges"] = [];
      // The server chooses the order of movements; without a ticket we still run the check, but the
      // server will not count it as passed and asks for another try or an officer.
      const ticket = withLiveness && getTicket ? await getTicket() : null;
      if (withLiveness) {
        setPhase("challenge");
        for (const ch of ticket?.sequence ?? randomChallenges()) {
          setCurrent(ch);
          void speakUrdu(PROMPT[ch].ur, PROMPT[ch].en);
          const r = await waitForChallenge(v, ch);
          results.push({ action: ch, ...r });
          if (!r.done) break;
        }
      }
      setCurrent(null);
      setPhase("capturing");
      void speakUrdu("کیمرے کی طرف سیدھا دیکھیں", "Look straight at the camera");
      const sample = await captureDescriptor(v);
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      if (!sample) {
        setPhase("error");
        setError("No face found. Sit facing a light and try again. / چہرہ نظر نہیں آیا، روشنی کی طرف بیٹھ کر دوبارہ کوشش کریں۔");
        return;
      }
      const passed = !withLiveness || (results.length >= 2 && results.every((r) => r.done));
      onDone({ descriptor: sample.descriptor, quality: sample.quality, liveness: { passed, challenges: results }, ticket: ticket?.token ?? null });
      setPhase("idle");
    } catch (e) {
      setPhase("error");
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission is needed. / کیمرے کی اجازت دیں۔" : "Camera or face model could not start. Check the connection and try again.");
      onSlow?.();
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "#000", aspectRatio: "4 / 3" }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
        {current && (
          <div className="absolute inset-x-0 bottom-0 p-3 text-center" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                        <div className="ur text-2xl">{PROMPT[current].ur}</div>
            <div className="en text-sm">{PROMPT[current].en}</div>
          </div>
        )}
        {phase === "loading" && <div className="absolute inset-0 grid place-items-center text-white text-center p-3">{toDownload > 0 ? `Loading face check… first time downloads ${mb(toDownload)} MB (${humanTime(estimateSeconds(toDownload))} on this connection), then it is saved on the phone.` : "Starting the face check…"}</div>}
        {phase === "capturing" && <div className="absolute inset-x-0 top-0 p-2 text-center text-white" style={{ background: "rgba(0,0,0,.5)" }}><span className="en">Hold still…</span> <span className="ur">رُکے رہیں</span></div>}
      </div>
      {(phase === "idle" || phase === "error") && (
        <button className="btn btn-big" onClick={start}><span className="text-3xl"></span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">تصویر شروع کریں</span><span className="en text-sm font-semibold opacity-90">Start camera</span></span></button>
      )}
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {phase === "idle" && toDownload > 0 && <p className="text-sm muted"><span className="en">First time only: {mb(toDownload)} MB to download, {humanTime(estimateSeconds(toDownload))} on this connection.</span></p>}
      <p className="muted text-xs"><span className="en">Only 128 numbers describing the face are sent. The photo never leaves this phone.</span><span className="ur">صرف چہرے کے ۱۲۸ نمبر بھیجے جاتے ہیں، تصویر فون سے باہر نہیں جاتی۔</span></p>
    </div>
  );
}

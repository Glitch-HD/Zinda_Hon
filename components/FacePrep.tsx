"use client";
import { useEffect, useRef, useState } from "react";
import { estimateSeconds, faceBytes, humanTime, isGoodNetwork, isSlowNetwork, mb, missingFaceFiles, prefetchFaceFiles } from "@/lib/client/prefetch";

// "Get the face check ready": downloads the face files (about 20 MB) ahead of time, so the yearly check
// works later even with no signal. Starts by itself on Wi-Fi or 4G; on a slow connection it asks first
// and shows how long it will take.
export default function FacePrep({ who = "you" }: { who?: "you" | "families" }) {
  const [state, setState] = useState<"checking" | "ready" | "missing" | "downloading" | "error" | "unsupported">("checking");
  const [left, setLeft] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function download() {
    if (started.current) return;
    started.current = true;
    setState("downloading"); setError(null);
    try {
      await prefetchFaceFiles((done, total) => setProgress({ done, total }));
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    } finally {
      started.current = false;
    }
  }

  useEffect(() => {
    if (typeof caches === "undefined") { setState("unsupported"); return; }
    missingFaceFiles().then((m) => {
      const bytes = m.reduce((a, f) => a + f.bytes, 0);
      setLeft(bytes);
      if (!m.length) setState("ready");
      else if (isGoodNetwork()) void download();
      else setState("missing");
    }).catch(() => setState("unsupported"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "checking" || state === "unsupported") return null;
  if (state === "ready") {
    return <p className="text-sm muted" data-no-voice><span className="en">Face check is saved on this phone and works without internet.</span> <span className="ur">چہرے کی جانچ اس فون پر محفوظ ہے، انٹرنیٹ کے بغیر بھی چلے گی۔</span></p>;
  }
  const secs = estimateSeconds(left || faceBytes());
  const slow = isSlowNetwork();
  return (
    <div className="card card-soft space-y-2" data-no-voice>
      <p className="font-semibold"><span className="en">Get the face check ready ({mb(left || faceBytes())} MB, once)</span> <span className="ur">چہرے کی جانچ پہلے سے تیار کریں</span></p>
      <p className="text-sm muted">
        {who === "families" ? "Download once on Wi-Fi, then you can do the face check for every family even where there is no signal." : "Download once, then the yearly face check works even with no signal."}
        {" "}On this connection it takes {humanTime(secs)}.{slow ? " Your signal is slow: if you can, do this on Wi-Fi (a shop, a mosque or the helper's phone). If the photo step will not work, you can ask an officer to visit instead." : ""}
      </p>
      {state === "downloading" && progress && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Face check download">
          <div style={{ height: 10, borderRadius: 6, background: "var(--line)", overflow: "hidden" }}>
            <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: "100%", background: "var(--brand)", transition: "width .3s" }} />
          </div>
          <p className="text-sm muted mt-1">{mb(progress.done)} of {mb(progress.total)} MB. You can keep using the app.</p>
        </div>
      )}
      {(state === "missing" || state === "error") && <button className="btn" onClick={download}><span className="en">{state === "error" ? "Try the download again" : "Download now"}</span> <span className="ur">ابھی ڈاؤن لوڈ کریں</span></button>}
      {error && <p className="text-sm" role="alert" style={{ color: "var(--danger)" }}>{error}. The parts already downloaded are kept; press again to continue.</p>}
    </div>
  );
}

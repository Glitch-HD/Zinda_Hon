"use client";
import { useEffect, useState } from "react";

// Shown when the browser blocked the page from speaking until the first touch.
export default function VoicePendingPill() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setShow(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("zh-voice-pending", on);
    return () => window.removeEventListener("zh-voice-pending", on);
  }, []);
  if (!show) return null;
  return (
    <button type="button" className="voice-pill" data-no-voice onClick={() => setShow(false)} aria-live="polite">
      🔊 <span className="ur">سننے کے لیے کہیں بھی چھوئیں</span> <span className="en">Tap anywhere to hear</span>
    </button>
  );
}

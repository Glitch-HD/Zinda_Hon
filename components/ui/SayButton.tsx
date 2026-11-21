"use client";
import { useState } from "react";
import { speakUrduAndWait, stopSpeaking } from "@/lib/client/voice";
import Icon from "./Icon";

// Reads a card aloud (Urdu first, English if the device has no Urdu voice), for people who cannot read.
export default function SayButton({ ur, en, light = false }: { ur: string; en: string; light?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className={`say-btn ${light ? "say-btn-light" : ""} ${on ? "on" : ""}`}
      data-no-voice
      aria-label={`Listen: ${en}`}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (on) { stopSpeaking(); setOn(false); return; }
        setOn(true);
        try { await speakUrduAndWait(ur, 20000, en); } finally { setOn(false); }
      }}
    >
      <Icon name={on ? "stop" : "speaker"} size={18} />
      <span className="ur">سنیں</span><span className="en">Listen</span>
    </button>
  );
}

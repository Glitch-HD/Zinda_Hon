"use client";
import { useEffect } from "react";
import { speakUrdu, stopSpeaking } from "@/lib/client/voice";
import { setPrefsRole, voiceOn } from "@/lib/client/prefs";

// Reads the page's welcome out loud as soon as it opens (when the voice guide is on), so a person who
// cannot read hears where they are without pressing anything. If the browser blocks sound until the
// first touch, it plays at the first tap anywhere.
export default function PageVoice({ ur, en, role }: { ur: string; en?: string; role: string }) {
  useEffect(() => {
    setPrefsRole(role);
    if (!voiceOn()) return;
    const t = setTimeout(() => void speakUrdu(ur, en), 500);
    return () => { clearTimeout(t); stopSpeaking(); };
  }, [ur, en, role]);
  return null;
}

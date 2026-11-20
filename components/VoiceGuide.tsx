"use client";
import { useEffect } from "react";
import { speakUrdu } from "@/lib/client/voice";
import { voiceOn } from "@/lib/client/prefs";

// The voice guide: when it is on, tapping anything that has a data-say text reads that text in Urdu.
// For links to another page we wait a moment so the person hears it before the page changes.
export default function VoiceGuide() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!voiceOn() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-voice]")) return;
      const el = target.closest<HTMLElement>("[data-say]");
      const say = el?.dataset.say;
      if (!el || !say) return;
      void speakUrdu(say);
      const a = el.closest("a");
      if (a && a.href && a.origin === location.origin && !a.target) {
        e.preventDefault();
        setTimeout(() => { location.href = a.href; }, 1800);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

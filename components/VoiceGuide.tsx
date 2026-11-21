"use client";
import { useEffect } from "react";
import { speakUrdu } from "@/lib/client/voice";
import { voiceOn } from "@/lib/client/prefs";

// The voice guide: when it is on, tapping anything that has a data-say text reads it out, in Urdu,
// English or both, following the language switch.
export default function VoiceGuide() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!voiceOn() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-voice]")) return;
      const el = target.closest<HTMLElement>("[data-say]");
      const say = el?.dataset.say;
      if (!el || !say) return;
      // English: an explicit data-say-en, else the English words shown on the element itself.
      const en = el.dataset.sayEn || [...el.querySelectorAll(".en")].map((n) => n.textContent?.trim()).filter(Boolean).join(". ") || el.getAttribute("aria-label") || undefined;
      // Never hold up the click: links open at once (in-app navigation keeps the voice playing).
      void speakUrdu(say, en);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

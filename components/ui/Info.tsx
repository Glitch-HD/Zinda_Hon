"use client";
import { useEffect, useRef, useState } from "react";
import { speakUrdu } from "@/lib/client/voice";
import { voiceOn } from "@/lib/client/prefs";

// Small ⓘ button next to an option. Tap it to see (and, with the voice guide on, hear) what the option does.
export default function Info({ en, ur, align = "right" }: { en: string; ur: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span ref={ref} className="info-wrap" data-no-voice>
      <button
        type="button"
        className="info-btn"
        aria-label="What does this do?"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !open;
          setOpen(next);
          if (next && voiceOn()) void speakUrdu(ur, en);
        }}
      >
        i
      </button>
      {open && (
        <span role="tooltip" className={`info-pop ${align === "left" ? "info-pop-left" : ""}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <span className="ur block text-base" style={{ lineHeight: 2 }}>{ur}</span>
          <span className="en block text-sm">{en}</span>
          <button type="button" className="btn btn-ghost btn-sm mt-2 w-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void speakUrdu(ur, en); }}><span className="ur">سنیں</span><span className="en">Listen</span></button>
        </span>
      )}
    </span>
  );
}

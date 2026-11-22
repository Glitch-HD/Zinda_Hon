"use client";
import { useEffect } from "react";
import { speakAny } from "@/lib/client/voice";
import { voiceOn } from "@/lib/client/prefs";

// The voice guide. When it is on:
//  - tapping anything with a data-say text reads that text (Urdu, English or both, following the switch);
//  - tapping any other button, link, menu item, tick box or drop-down reads its own words, so nothing
//    a person can press is silent;
//  - any error or status message that appears on the page (role="alert" / role="status") is read out.

const CLICKABLE = "button, a[href], summary, [role=button], [role=tab], label, select, input[type=checkbox], input[type=radio]";
const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

function wordsOf(el: HTMLElement) {
  const ur = [...el.querySelectorAll(".ur")].map((n) => clean(n.textContent)).filter(Boolean).join("۔ ");
  const enParts = [...el.querySelectorAll(".en")].map((n) => clean(n.textContent)).filter(Boolean);
  let en = enParts.join(". ") || el.dataset.sayEn || el.getAttribute("aria-label") || el.getAttribute("title") || "";
  if (!ur && !en) {
    const own = clean(el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent : el.textContent);
    if (/[\u0600-\u06FF]/.test(own)) return { ur: own.slice(0, 200), en: undefined };
    en = own;
  }
  return { ur: ur || undefined, en: clean(en).slice(0, 200) || undefined };
}

export default function VoiceGuide() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!voiceOn() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-voice]")) return;
      const el = target.closest<HTMLElement>("[data-say]");
      if (el?.dataset.say) {
        const en = el.dataset.sayEn || [...el.querySelectorAll(".en")].map((n) => n.textContent?.trim()).filter(Boolean).join(". ") || el.getAttribute("aria-label") || undefined;
        void speakAny(el.dataset.say, en);
        return;
      }
      const c = target.closest<HTMLElement>(CLICKABLE);
      if (!c) return;
      const { ur, en } = wordsOf(c);
      // Never hold up the click: links open at once (in-app navigation keeps the voice playing).
      void speakAny(ur, en);
    }
    // Errors and status lines read themselves out (once each), so a person who cannot read hears them.
    const said = new WeakMap<Element, string>();
    function readOut(el: Element) {
      if (!voiceOn() || el.closest("[data-no-voice]")) return;
      const text = clean(el.textContent);
      if (!text || said.get(el) === text) return;
      said.set(el, text);
      const { ur, en } = wordsOf(el as HTMLElement);
      void speakAny(ur, en ?? (ur ? undefined : text.slice(0, 200)));
    }
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        const node = m.target instanceof Element ? m.target : m.target.parentElement;
        const added = [...m.addedNodes].filter((n): n is Element => n instanceof Element);
        for (const a of added) {
          if (a.matches('[role="alert"]')) readOut(a);
          a.querySelectorAll('[role="alert"]').forEach(readOut);
        }
        const host = node?.closest('[role="alert"]');
        if (host) readOut(host);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); mo.disconnect(); };
  }, []);
  return null;
}

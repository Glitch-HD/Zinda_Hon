"use client";
// Per-phone display preferences: which language to show, and whether the voice guide is on.
// Saved in localStorage only (a convenience, never needed for anything to work).

export type Lang = "both" | "en" | "ur";
const LANG_KEY = "zh_lang";
const VOICE_KEY = "zh_voice";
const EVT = "zh-prefs";

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode: still works for this page */ }
}

export function getLang(): Lang {
  const v = read(LANG_KEY);
  return v === "en" || v === "ur" ? v : "both";
}
export function setLang(l: Lang) {
  write(LANG_KEY, l);
  document.documentElement.dataset.lang = l;
  window.dispatchEvent(new Event(EVT));
}

export function voiceOn(): boolean {
  return read(VOICE_KEY) === "1";
}
export function setVoice(on: boolean) {
  write(VOICE_KEY, on ? "1" : "0");
  document.documentElement.dataset.voice = on ? "1" : "0";
  window.dispatchEvent(new Event(EVT));
}
/** Turn the voice guide on the first time a pensioner arrives, unless they switched it off before. */
export function voiceDefaultOn() {
  if (read(VOICE_KEY) === null) setVoice(true);
}

export function onPrefsChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}


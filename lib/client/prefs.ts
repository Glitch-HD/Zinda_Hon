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

// The voice guide is remembered separately for each kind of user on this device.
// It is ON by default only for pensioners (who may not read); everyone else can switch it on.
let role = "guest";
export function setPrefsRole(r: string) {
  role = r;
  document.documentElement.dataset.voice = voiceOn() ? "1" : "0";
  window.dispatchEvent(new Event(EVT));
}
export function voiceOn(): boolean {
  const v = read(`${VOICE_KEY}_${role}`);
  return v === null ? role === "PENSIONER" : v === "1";
}
export function setVoice(on: boolean) {
  write(`${VOICE_KEY}_${role}`, on ? "1" : "0");
  document.documentElement.dataset.voice = on ? "1" : "0";
  window.dispatchEvent(new Event(EVT));
}

export function onPrefsChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}


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
// It is ON by default for everyone the platform serves (pensioners, helpers, shopkeepers, and the front
// page); office staff can read, so it starts OFF for them. Anyone can switch it on or off.
let role = "guest";
export function setPrefsRole(r: string) {
  role = r;
  document.documentElement.dataset.voice = voiceOn() ? "1" : "0";
  window.dispatchEvent(new Event(EVT));
}
export function voiceOn(): boolean {
  const v = read(`${VOICE_KEY}_${role}`);
  return v === null ? ["PENSIONER", "HELPER", "SHOPKEEPER", "guest"].includes(role) : v === "1";
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


// Lite mode (weak 2G phones): no photos, no animations, no extra downloads such as the book reader.
export function liteOn(): boolean { return read("zh_lite") === "1"; }
export function setLite(on: boolean) {
  write("zh_lite", on ? "1" : "0");
  document.documentElement.dataset.lite = on ? "1" : "0";
  window.dispatchEvent(new Event(EVT));
}

// Bigger text for weak eyesight: normal, large (A+) or extra large (A++).
export type TextSize = "md" | "lg" | "xl";
export function getTextSize(): TextSize { const v = read("zh_text"); return v === "lg" || v === "xl" ? v : "md"; }
export function setTextSize(t: TextSize) {
  write("zh_text", t);
  document.documentElement.dataset.text = t;
  window.dispatchEvent(new Event(EVT));
}

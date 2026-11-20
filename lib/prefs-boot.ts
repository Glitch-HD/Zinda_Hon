// Inlined in <head> by the root layout. Kept out of client files so it stays a plain string.
const LANG_KEY = "zh_lang";
const VOICE_KEY = "zh_voice";

/** Runs before the page paints (inlined in <head>) so the chosen language never flashes. */
export const PREFS_BOOT_SCRIPT = `try{var l=localStorage.getItem("${LANG_KEY}");document.documentElement.dataset.lang=(l==="en"||l==="ur")?l:"both";document.documentElement.dataset.voice=localStorage.getItem("${VOICE_KEY}")==="1"?"1":"0"}catch(e){document.documentElement.dataset.lang="both"}`;

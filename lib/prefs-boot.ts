// Inlined in <head> by the root layout. Kept out of client files so it stays a plain string.
const LANG_KEY = "zh_lang";

/** Runs before the page paints (inlined in <head>) so the chosen language never flashes. */
export const PREFS_BOOT_SCRIPT = `try{var l=localStorage.getItem("${LANG_KEY}");document.documentElement.dataset.lang=(l==="en"||l==="ur")?l:"both"}catch(e){document.documentElement.dataset.lang="both"}`;

// Inlined in <head> by the root layout. Kept out of client files so it stays a plain string.
const LANG_KEY = "zh_lang";

/** Runs before the page paints (inlined in <head>) so the chosen language never flashes. */
export const PREFS_BOOT_SCRIPT = `try{var d=document.documentElement,l=localStorage.getItem("${LANG_KEY}");d.dataset.lang=(l==="en"||l==="ur")?l:"both";var t=localStorage.getItem("zh_text");d.dataset.text=(t==="lg"||t==="xl")?t:"md";var c=navigator.connection;var lite=localStorage.getItem("zh_lite");d.dataset.lite=lite===null?((c&&(c.saveData||/2g/.test(c.effectiveType||"")))?"1":"0"):lite}catch(e){document.documentElement.dataset.lang="both"}`;

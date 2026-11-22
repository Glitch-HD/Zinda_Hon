"use client";
import { useEffect, useState } from "react";
import { getLang, setLang, voiceOn, setVoice, onPrefsChange, liteOn, setLite, getTextSize, setTextSize, type Lang, type TextSize } from "@/lib/client/prefs";
import { speakUrdu, stopSpeaking, getVoiceChoice, setVoiceChoice, type VoiceChoice } from "@/lib/client/voice";
import Info from "./ui/Info";

// Thin bar on every page: the prototype warning, the language switch and the voice guide switch.
export default function TopBar() {
  const [lang, setL] = useState<Lang>("both");
  const [voice, setV] = useState(false);
  const [who, setWho] = useState<VoiceChoice>("female");
  const [noVoice, setNoVoice] = useState(false);
  const [lite, setLiteS] = useState(false);
  const [size, setSize] = useState<TextSize>("md");

  useEffect(() => {
    setWho(getVoiceChoice());
    const show = () => setNoVoice(true);
    window.addEventListener("zh-no-voice", show);
    return () => window.removeEventListener("zh-no-voice", show);
  }, []);

  useEffect(() => {
    const sync = () => { setL(getLang()); setV(voiceOn()); setLiteS(liteOn()); setSize(getTextSize()); };
    sync();
    return onPrefsChange(sync);
  }, []);

  const langs: { id: Lang; label: React.ReactNode; aria: string }[] = [
    { id: "ur", label: <span className="ur always" style={{ lineHeight: 1.4 }}>اردو</span>, aria: "Urdu only" },
    { id: "both", label: "Both", aria: "Urdu and English" },
    { id: "en", label: "English", aria: "English only" },
  ];

  return (
    <div className="topbar" data-no-voice>
      <div className="topbar-inner">
        <span className="topbar-note">
          <span className="en">Prototype, not an official service. All people and payments are simulated.</span>
          <span className="both-only"> · </span>
          <span className="ur">آزمائشی نمونہ، سرکاری سروس نہیں</span>
        </span>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <div className="seg" role="group" aria-label="Language / زبان">
            {langs.map((l) => (
              <button key={l.id} type="button" aria-pressed={lang === l.id} aria-label={l.aria} className={lang === l.id ? "on" : ""} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
          <button
            type="button"
            className={`voice-toggle ${voice ? "on" : ""}`}
            aria-pressed={voice}
            onClick={() => {
              const next = !voice;
              setVoice(next);
              if (next) void speakUrdu("آواز کی مدد چالو ہے۔ جس بٹن کو دبائیں گے، وہ بتائے گا کہ وہ کیا کرتا ہے۔", "Voice help is on. Any button you press will tell you what it does.");
              else stopSpeaking();
            }}
          >
            {voice ? "" : ""} <span className="en">Voice</span><span className="ur" style={{ lineHeight: 1.4 }}>آواز</span>
          </button>
          <button
            type="button"
            className="voice-toggle"
            aria-label={who === "female" ? "Voice: woman. Tap for a man's voice" : "Voice: man. Tap for a woman's voice"}
            title="Change the speaking voice"
            onClick={() => {
              const next: VoiceChoice = who === "female" ? "male" : "female";
              setVoiceChoice(next);
              setWho(next);
              void speakUrdu(next === "female" ? "یہ عورت کی آواز ہے۔" : "یہ مرد کی آواز ہے۔", next === "female" ? "This is the woman's voice." : "This is the man's voice.");
            }}
          >
            <span className="en">{who === "female" ? "Female voice" : "Male voice"}</span><span className="ur" style={{ lineHeight: 1.4 }}>{who === "female" ? "خاتون" : "مرد"}</span>
          </button>
          <div className="seg" role="group" aria-label="Text size / لکھائی کا سائز">
            {(["md", "lg", "xl"] as TextSize[]).map((t) => (
              <button key={t} type="button" aria-pressed={size === t} aria-label={t === "md" ? "Normal text" : t === "lg" ? "Large text" : "Extra large text"} className={size === t ? "on" : ""}
                onClick={() => { setTextSize(t); void speakUrdu(t === "md" ? "عام لکھائی" : t === "lg" ? "بڑی لکھائی" : "بہت بڑی لکھائی", t === "md" ? "Normal text" : t === "lg" ? "Large text" : "Extra large text"); }}>
                {t === "md" ? "A" : t === "lg" ? "A+" : "A++"}
              </button>
            ))}
          </div>
          <button type="button" className={`voice-toggle ${lite ? "on" : ""}`} aria-pressed={lite} title="Lite mode: no photos or animations, for slow 2G phones"
            onClick={() => { const n = !lite; setLite(n); void speakUrdu(n ? "ہلکا موڈ چالو ہے۔ تصویریں اور حرکت بند، صفحے جلدی کھلیں گے۔" : "ہلکا موڈ بند ہے۔", n ? "Lite mode is on. No photos or animations, pages open faster." : "Lite mode is off."); }}>
            <span className="en">Lite</span><span className="ur" style={{ lineHeight: 1.4 }}>ہلکا</span>
          </button>
          <Info align="left" en="Voice help reads out every button you tap, in Urdu. Made for people who cannot read." ur="آواز کی مدد چالو کریں تو ہر بٹن دبانے پر وہ اردو میں بتائے گا کہ وہ کیا کرتا ہے۔" />
        </div>
      </div>
      {noVoice && (
        <div className="topbar-inner" role="status">
          <p className="text-sm" style={{ color: "var(--warn)" }}>
            <span className="en">This device has no Urdu voice, so Urdu cannot be read aloud here (English still works: pick English at the top). On a laptop, open the site in <b>Microsoft Edge</b> (it has Urdu voices built in), or ask the team to add the voice key.</span>
            <span className="ur"> اس ڈیوائس میں اردو آواز نہیں ہے۔</span>
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoVoice(false)}>OK</button>
        </div>
      )}
    </div>
  );
}

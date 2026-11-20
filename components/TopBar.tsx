"use client";
import { useEffect, useState } from "react";
import { getLang, setLang, voiceOn, setVoice, onPrefsChange, type Lang } from "@/lib/client/prefs";
import { speakUrdu, stopSpeaking } from "@/lib/client/voice";
import Info from "./ui/Info";

// Thin bar on every page: the prototype warning, the language switch and the voice guide switch.
export default function TopBar() {
  const [lang, setL] = useState<Lang>("both");
  const [voice, setV] = useState(false);

  useEffect(() => {
    const sync = () => { setL(getLang()); setV(voiceOn()); };
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
          ⚠️ <span className="en">Prototype, not an official service. All people and payments are simulated.</span>
          <span className="both-only"> · </span>
          <span className="ur">آزمائشی نمونہ، سرکاری سروس نہیں</span>
        </span>
        <div className="flex items-center gap-2">
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
              if (next) void speakUrdu("آواز کی مدد چالو ہے۔ جس بٹن کو دبائیں گے، وہ بتائے گا کہ وہ کیا کرتا ہے۔");
              else stopSpeaking();
            }}
          >
            {voice ? "🔊" : "🔈"} <span className="en">Voice</span><span className="ur" style={{ lineHeight: 1.4 }}>آواز</span>
          </button>
          <Info align="left" en="Voice help reads out every button you tap, in Urdu. Made for people who cannot read." ur="آواز کی مدد چالو کریں تو ہر بٹن دبانے پر وہ اردو میں بتائے گا کہ وہ کیا کرتا ہے۔" />
        </div>
      </div>
    </div>
  );
}

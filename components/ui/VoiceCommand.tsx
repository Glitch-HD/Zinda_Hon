"use client";
import { useState } from "react";
import { listen, matchCommand } from "@/lib/client/listen";
import { speakUrdu, speakUrduAndWait } from "@/lib/client/voice";

// Big microphone button: the person SAYS what they want instead of reading the screen.
// Each command has words in Urdu script, Roman Urdu and English.
export type Command = { id: string; words: string[]; confirmUr: string; run: () => void };

export default function VoiceCommand({ promptUr, promptEn, commands }: { promptUr: string; promptEn: string; commands: Command[] }) {
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);

  async function go() {
    setHeard(null);
    setMissed(false);
    await speakUrduAndWait(promptUr); // let the prompt finish before the mic opens
    setState("listening");
    const said = await listen(4500);
    setState("thinking");
    setHeard(said);
    const id = said ? matchCommand(said, commands) : null;
    const cmd = commands.find((c) => c.id === id);
    setState("idle");
    if (!cmd) {
      setMissed(true);
      void speakUrdu("معاف کیجیے، سمجھ نہیں آیا۔ دوبارہ مائیک دبا کر بولیں، یا تصویر والا بٹن دبائیں۔");
      return;
    }
    void speakUrdu(cmd.confirmUr);
    setTimeout(cmd.run, 1500);
  }

  return (
    <div className="mic-card" data-no-voice>
      <button type="button" className={`mic-btn ${state === "listening" ? "live" : ""}`} onClick={go} disabled={state !== "idle"} aria-label="Speak / بولیں">
        <span className="text-4xl">{state === "listening" ? "👂" : state === "thinking" ? "⏳" : "🎤"}</span>
      </button>
      <div className="flex-1 min-w-0">
        <p className="ur text-xl font-semibold">{state === "listening" ? "میں سن رہی ہوں… بولیں" : "بول کر بتائیں"}</p>
        <p className="en text-sm font-semibold">{state === "listening" ? "Listening… speak now" : "Tap and say what you want"}</p>
        <p className="ur text-sm muted">{promptUr}</p>
        <p className="en text-xs muted">{promptEn}</p>
        {heard && <p className="text-sm mt-1">🗣️ “{heard}”</p>}
        {missed && <p className="text-sm" style={{ color: "var(--warn)" }}><span className="ur">سمجھ نہیں آیا، دوبارہ بولیں</span><span className="en"> Didn&apos;t catch that, try again.</span></p>}
      </div>
    </div>
  );
}

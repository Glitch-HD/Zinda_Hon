"use client";
import Icon from "@/components/ui/Icon";
import { useRef, useState } from "react";
import { startListening, matchCommand, LISTEN_ERROR, type Listening } from "@/lib/client/listen";
import { speakUrdu, stopSpeaking } from "@/lib/client/voice";

// Big microphone button: the person SAYS what they want instead of reading the screen.
// Tap once to start listening (it starts straight away), tap again to finish. Each command has words
// in Urdu script, Roman Urdu and English.
export type Command = { id: string; words: string[]; confirmUr: string; confirmEn?: string; run: () => void };

export default function VoiceCommand({ promptUr, promptEn, commands }: { promptUr: string; promptEn: string; commands: Command[] }) {
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ en: string; ur: string } | null>(null);
  const live = useRef<Listening | null>(null);

  async function tap() {
    if (state === "listening") { live.current?.stop(); return; }
    if (state !== "idle") return;
    stopSpeaking();
    setHeard(null);
    setProblem(null);
    setState("listening");
    live.current = startListening(7000);
    const r = await live.current.result;
    live.current = null;
    setState("thinking");
    setHeard(r.text);
    const id = r.text ? matchCommand(r.text, commands) : null;
    const cmd = commands.find((c) => c.id === id);
    setState("idle");
    if (!cmd) {
      const p = r.error ? LISTEN_ERROR[r.error] : { en: `Heard "${r.text}", but that is not one of the choices. Try again.`, ur: "سمجھ نہیں آیا۔ دوبارہ بولیں۔" };
      setProblem(p);
      void speakUrdu(`${p.ur} ${promptUr}`, `${p.en} ${promptEn}`);
      return;
    }
    // Run once the confirmation has been said (or after 4 s at most), so it is not cut off.
    await Promise.race([speakUrdu(cmd.confirmUr, cmd.confirmEn), new Promise((r) => setTimeout(r, 4000))]);
    cmd.run();
  }

  const listening = state === "listening";
  return (
    <div className="mic-card" data-no-voice>
      <button type="button" className={`mic-btn ${listening ? "live" : ""}`} onClick={tap} disabled={state === "thinking"} aria-label={listening ? "Stop listening" : "Speak / بولیں"}>
        <Icon name={listening ? "stop" : state === "thinking" ? "clock" : "mic"} size={34} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="ur text-xl font-semibold">{listening ? "بولیں… ختم ہو تو دوبارہ دبائیں" : "مائیک دبائیں اور بولیں"}</p>
        <p className="en text-sm font-semibold">{listening ? "Listening… tap again when you finish" : "Tap the mic and say what you want"}</p>
        <p className="ur text-sm muted" style={{ whiteSpace: "normal" }}>{promptUr}</p>
        <p className="en text-xs muted">{promptEn}</p>
        {heard && <p className="text-sm mt-1">“{heard}”</p>}
        {problem && <p className="text-sm" style={{ color: "var(--warn)" }}><span className="ur" style={{ whiteSpace: "normal" }}>{problem.ur}</span><span className="both-only"> </span><span className="en">{problem.en}</span></p>}
      </div>
    </div>
  );
}

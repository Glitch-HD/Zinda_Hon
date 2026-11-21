"use client";
import { useState } from "react";
import { speakUrdu } from "@/lib/client/voice";

// One big button for a widow whose pension was stopped: "this is wrong, please check again".
export default function AppealButton({ caseId, already }: { caseId: string; already: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(already ? "sent" : "idle");
  async function send() {
    setState("busy");
    try {
      const res = await fetch(`/api/cases/${caseId}/appeal`, { method: "POST" });
      if (!res.ok) throw new Error();
      setState("sent");
      void speakUrdu("آپ کی درخواست بھیج دی گئی۔ دوسرا پنشن افسر آپ کا کیس دوبارہ دیکھے گا۔", "Your request has been sent. A different pension officer will check your case again.");
    } catch {
      setState("error");
    }
  }
  if (state === "sent") return (
    <p className="mt-3 badge badge-ok" style={{ whiteSpace: "normal" }}>
      <span className="en">Re-check asked for. A different officer will look at it.</span> <span className="ur">دوبارہ جانچ کی درخواست بھیج دی گئی</span>
    </p>
  );
  return (
    <div className="mt-3">
      <button className="btn w-full" disabled={state === "busy"} onClick={send} data-say="یہ غلط ہے، دوبارہ جانچیں">
        <span className="en">This is wrong: ask for a re-check</span> <span className="ur">یہ غلط ہے، دوبارہ جانچیں</span>
      </button>
      {state === "error" && <p className="text-sm" style={{ color: "var(--danger)" }}>Could not send. Please try again. / دوبارہ کوشش کریں</p>}
    </div>
  );
}

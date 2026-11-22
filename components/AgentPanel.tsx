"use client";
import Icon from "@/components/ui/Icon";
import { useEffect, useRef, useState } from "react";

// The officer's AI case assistant, shown on a case page. The officer presses one button and watches
// the assistant pick its own checks, one by one, then reads its report. It is advice only: the
// assistant cannot approve or stop anything, and the safety rules may have corrected its answer.

type Step = { n: number; tool: string; summary: string; error?: string; thought?: string; ms: number };
type Finding = { severity: "ok" | "warning" | "serious"; text: string; source: string };
type Report = {
  recommendation: "approve" | "ask_more_proof" | "officer_review" | "investigate_stop";
  confidence: number; headline: string; summary_en: string; summary_ur: string;
  findings: Finding[]; questions_for_officer: string[]; rules_cited: string[];
};
type Note = { rule: string; detail: string };
type Done = { report: Report; guardrails: Note[]; mode: "ai" | "checklist"; model: string | null; ms: number; when?: string };

const TOOL_LABEL: Record<string, { icon: string; label: string }> = {
  case_overview: { icon: "📋", label: "Read the case and this year's proof" },
  check_nadra: { icon: "🪪", label: "Checked mock NADRA" },
  check_death_registry: { icon: "🕯️", label: "Checked the death registry" },
  check_bank_activity: { icon: "🏦", label: "Checked bank activity" },
  find_possible_duplicates: { icon: "👥", label: "Looked for duplicate records" },
  past_years: { icon: "🗓️", label: "Read earlier years" },
  search_rulebook: { icon: "📖", label: "Searched the rulebook" },
};

const REC: Record<Report["recommendation"], { label: string; ur: string; cls: string; icon: string }> = {
  approve: { label: "Suggests: approve", ur: "منظوری کی تجویز", cls: "badge-ok", icon: "✅" },
  ask_more_proof: { label: "Suggests: ask for more proof", ur: "مزید ثبوت مانگیں", cls: "badge-warn", icon: "📷" },
  officer_review: { label: "Suggests: officer must look closely", ur: "افسر خود دیکھیں", cls: "badge-warn", icon: "🔎" },
  investigate_stop: { label: "Suggests: investigate before paying", ur: "ادائیگی سے پہلے تحقیق کریں", cls: "badge-danger", icon: "⛔" },
};
const SEV = { ok: "badge-ok", warning: "badge-warn", serious: "badge-danger" } as const;

function notesText(d: Done) {
  const r = d.report;
  const lines = [
    `AI case assistant (${d.mode === "ai" ? d.model ?? "AI" : "fixed checklist"}): ${REC[r.recommendation].label.replace("Suggests: ", "")}, ${Math.round(r.confidence * 100)}% sure.`,
    `AI: ${r.headline}`,
    ...r.findings.filter((f) => f.severity !== "ok").map((f) => `- ${f.text}`),
    "I checked these points myself before deciding.",
  ];
  return lines.join("\n");
}

export default function AgentPanel({ caseId, initial }: { caseId: string; initial: Done | null }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [done, setDone] = useState<Done | null>(initial);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<{ mode: string; model: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(Boolean(initial));
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function investigate() {
    setRunning(true); setSteps([]); setNotes([]); setDone(null); setError(null); setMode(null); setShowSaved(false); setCopied(false);
    const ac = new AbortController();
    abort.current = ac;
    try {
      const res = await fetch(`/api/cases/${caseId}/agent`, { method: "POST", signal: ac.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The case assistant could not start.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const e = JSON.parse(line);
          if (e.type === "start") setMode({ mode: e.mode, model: e.model });
          else if (e.type === "step") setSteps((s) => [...s, e.step]);
          else if (e.type === "note") setNotes((n) => [...n, e.text]);
          else if (e.type === "report") { setDone({ report: e.report, guardrails: e.guardrails, mode: e.mode, model: e.model, ms: e.ms }); finished = true; }
          else if (e.type === "error") throw new Error(e.error);
        }
      }
      if (!finished) throw new Error("The connection closed before the report arrived. Please try again.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function addToNotes() {
    if (!done) return;
    window.dispatchEvent(new CustomEvent("zh:agent-notes", { detail: notesText(done) }));
    setCopied(true);
    document.getElementById("officer-notes")?.focus();
  }

  const r = done?.report;
  return (
    <section className="card mt-4" aria-labelledby="agent-h" data-tour="agent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="agent-h" className="font-semibold text-lg">AI case assistant <span className="ur">اے آئی معاون</span></h3>
          <p className="muted text-sm">It picks its own checks across the mock NADRA, death registry, bank and our records, then writes you a report. It only advises; you decide.</p>
        </div>
        <button className="btn" onClick={investigate} disabled={running} aria-describedby="agent-h">
          {running ? "Investigating…" : done ? "Investigate again" : "Investigate with AI assistant"}
        </button>
      </div>

      {(running || steps.length > 0) && (
        <div className="mt-3">
          <p className="text-sm muted">
            {mode ? (mode.mode === "ai" ? `Working with ${mode.model}` : "No AI key on this server: running the fixed checklist") : "Starting…"}
          </p>
          <ol className="mt-2 space-y-2" aria-live="polite">
            {steps.map((s) => {
              const t = TOOL_LABEL[s.tool] ?? { icon: "🔧", label: s.tool };
              return (
                <li key={s.n} className="flex gap-2 items-start" style={{ borderInlineStart: "3px solid var(--line)", paddingInlineStart: 10 }}>
                  <Icon e={t.icon} size={18} />
                  <div className="min-w-0">
                    <div className="text-sm"><b>{s.n}. {t.label}</b> <span className="muted">· {s.ms} ms</span></div>
                    {s.thought && <div className="text-sm muted" style={{ fontStyle: "italic" }}>“{s.thought}”</div>}
                    <div className="text-sm" style={s.error ? { color: "var(--danger)" } : undefined}>{s.error ? `Failed: ${s.error}` : s.summary}</div>
                  </div>
                </li>
              );
            })}
            {running && <li className="text-sm muted">Thinking about the next check…</li>}
          </ol>
          {notes.map((n, i) => <p key={i} className="text-sm mt-2" style={{ color: "var(--warn)" }}>ℹ{n}</p>)}
        </div>
      )}

      {error && <p role="alert" className="mt-3" style={{ color: "var(--danger)" }}>{error}</p>}

      {r && done && (
        <div className="mt-4" style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14, background: "var(--card-2)" }}>
          {showSaved && done.when && <p className="text-sm muted mb-2">Last report, {done.when}. Press “Investigate again” for a fresh one.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${REC[r.recommendation].cls}`} style={{ fontSize: ".9rem" }}>{REC[r.recommendation].label}</span>
            <span className="badge">{Math.round(r.confidence * 100)}% sure</span>
            <span className="badge">{done.mode === "ai" ? `AI: ${done.model}` : done.model ? `Checklist (${done.model.replace(" → checklist", "")} gave up)` : "Fixed checklist"}</span>
            <span className="muted text-sm">{(done.ms / 1000).toFixed(1)} s</span>
          </div>
          <p className="font-semibold mt-2">{r.headline}</p>
          <p className="text-sm mt-1">{r.summary_en}</p>
          <p className="ur mt-1" dir="rtl" lang="ur" style={{ display: "block" }}>{r.summary_ur}</p>

          <h4 className="font-semibold mt-3 text-sm">What it found</h4>
          <ul className="mt-1 space-y-1">
            {r.findings.map((f, i) => (
              <li key={i} className="text-sm flex flex-wrap gap-2 items-start">
                <span className={`badge ${SEV[f.severity]}`}>{f.severity}</span>
                <span className="min-w-0" style={{ flex: "1 1 14rem" }}>{f.text}</span>
                <span className="badge" title="The check this finding came from">{f.source.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>

          {r.questions_for_officer.length > 0 && (
            <>
              <h4 className="font-semibold mt-3 text-sm">Questions for you</h4>
              <ul className="list-disc ms-5 text-sm">{r.questions_for_officer.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
          {r.rules_cited.length > 0 && <p className="text-sm mt-2">Rulebook: {r.rules_cited.map((id) => <span key={id} className="badge mr-1">{id}</span>)}</p>}

          {done.guardrails.length > 0 && (
            <div className="mt-3 text-sm" style={{ borderInlineStart: "3px solid var(--warn)", paddingInlineStart: 10 }}>
              <b>Safety rules corrected the assistant</b>
              <ul className="list-disc ms-5">{done.guardrails.map((g, i) => <li key={i}>{g.detail}</li>)}</ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button className="btn btn-ghost" onClick={addToNotes}>Use as my notes</button>
            {copied && <span className="text-sm" style={{ color: "var(--ok)" }}>Added to your notes. Edit them before you decide.</span>}
          </div>
          <p className="text-sm muted mt-2">Suggestion only. The assistant cannot approve or stop a pension; you decide. Every step it took is in the audit log.</p>
        </div>
      )}
    </section>
  );
}

import Header from "@/components/Header";
import RunEvalButton from "@/components/RunEvalButton";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { EVAL_MESSAGES } from "@/data/eval-messages";
import { AGENT_EVAL_CASES } from "@/lib/agent-eval";

// Evaluation dashboard: accuracy, false alarms, speed, cost and failures, measured on labelled data.
// Numbers are computed live from the database, never typed in by hand.
/** 95% Wilson interval for k successes out of n, as "a–b%". Honest error margins for small samples. */
function wilson(k: number, n: number) {
  if (!n) return "";
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `95% range ${Math.max(0, (c - h) * 100).toFixed(0)}–${Math.min(100, (c + h) * 100).toFixed(0)}%`;
}

type EvalReasons = { ms?: number; usage?: { input: number; output: number } | null; source?: string; runId?: string; lang?: string; hard?: boolean };
type AgentEvalRow = { runId: string; index: number; pensionNo: string; what: string; planted: string | null; skipped?: string; mode?: string; model?: string | null; ms?: number; toolCalls?: number; raw?: string; final?: string; confidence?: number; guardrails?: string[]; foundItself?: boolean | null; safeFinal?: boolean; safeRaw?: boolean; falseAlarm?: boolean; corrected?: boolean };

const PRICE_IN = 4 / 1_000_000, PRICE_OUT = 20 / 1_000_000; // USD per token, Claude Opus 5.5 (Groq free tier counts as 0)

export default async function Evaluation() {
  const user = await pageUser(["ADMIN", "AUDITOR", "OFFICER"]);
  // Only the latest run of the labelled test set counts, so running it twice does not double the numbers.
  const latestRun = await prisma.checkedMessage.findFirst({ where: { tenantId: user.tenantId, reviewedLabel: { not: null }, reasons: { path: ["eval"], equals: true } }, orderBy: { createdAt: "desc" }, select: { reasons: true } });
  const runId = (latestRun?.reasons as EvalReasons | undefined)?.runId;
  const msgs = await prisma.checkedMessage.findMany({ where: { tenantId: user.tenantId, reviewedLabel: { not: null }, ...(runId ? { reasons: { path: ["runId"], equals: runId } } : {}) }, orderBy: { createdAt: "asc" } });
  const scams = msgs.filter((m) => m.reviewedLabel === "scam");
  const genuine = msgs.filter((m) => m.reviewedLabel === "genuine");
  const caught = scams.filter((m) => m.label === "scam").length;
  const missed = scams.filter((m) => m.label === "genuine").length;
  const scamsToHuman = scams.filter((m) => m.label === "unsure").length;
  const falseAlarms = genuine.filter((m) => m.label === "scam").length;
  const genuineToHuman = genuine.filter((m) => m.label === "unsure").length;
  const autoDecided = msgs.filter((m) => m.route !== "human_review");
  const autoCorrect = autoDecided.filter((m) => (m.route === "warn_user" && m.reviewedLabel === "scam") || (m.route === "reassure_user" && m.reviewedLabel === "genuine")).length;
  const reasons = msgs.map((m) => m.reasons as EvalReasons);
  const right = (m: (typeof msgs)[number]) => m.label === m.reviewedLabel;
  const group = (f: (m: (typeof msgs)[number], r: EvalReasons) => string | undefined) => {
    const g = new Map<string, { n: number; right: number; unsure: number; wrong: number }>();
    msgs.forEach((m, i) => {
      const k = f(m, reasons[i]); if (!k) return;
      const e = g.get(k) ?? { n: 0, right: 0, unsure: 0, wrong: 0 };
      e.n++; if (right(m)) e.right++; else if (m.label === "unsure") e.unsure++; else e.wrong++;
      g.set(k, e);
    });
    return [...g.entries()];
  };
  const LANG: Record<string, string> = { en: "English", ur: "Urdu script", roman: "Roman Urdu" };
  const byLang = group((_m, r) => (r.lang ? LANG[r.lang] ?? r.lang : undefined));
  const byHard = group((_m, r) => (r.hard === undefined ? undefined : r.hard ? "Hard messages" : "Ordinary messages"));
  const mistakes = msgs.filter((m) => !right(m) && m.label !== "unsure");
  const models = [...new Set(msgs.map((m) => m.modelName ?? "warning signs only"))];
  const times = reasons.map((r) => r.ms ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)] ?? 0;
  const p90 = times[Math.floor(times.length * 0.9)] ?? 0;
  const cost = msgs.reduce((a, m, i) => { const u = reasons[i].usage; return a + (u && !m.modelName?.startsWith("groq/") ? u.input * PRICE_IN + u.output * PRICE_OUT : 0); }, 0);
  const aiFailures = reasons.filter((r) => r.source === "signs_only").length;
  const pct = (a: number, b: number) => (b === 0 ? "–" : `${((a / b) * 100).toFixed(1)}%`);

  const decisions = await prisma.decision.findMany({ where: { case: { tenantId: user.tenantId } }, select: { outcome: true, caseId: true, decidedBy: true } });
  const aiEscalated = new Set(decisions.filter((d) => d.decidedBy === "ai" && d.outcome === "SEND_TO_OFFICER").map((d) => d.caseId));
  const officerOnEscalated = decisions.filter((d) => d.decidedBy !== "ai" && aiEscalated.has(d.caseId));
  const officerApproved = officerOnEscalated.filter((d) => d.outcome === "OFFICER_APPROVED").length;
  const officerStopped = officerOnEscalated.filter((d) => d.outcome === "OFFICER_STOPPED").length;
  const autoApproved = decisions.filter((d) => d.decidedBy === "ai" && d.outcome === "APPROVE").length;

  const faceEv = await prisma.evidence.findMany({ where: { type: "face_match", case: { tenantId: user.tenantId } }, select: { score: true } });

  return (
    <div className="space-y-4">
      <Header user={user} />
      <h2 className="text-2xl font-bold">📊 Evaluation</h2>
      <p className="muted">All numbers are measured on our own labelled test data. Small sample sizes mean wide error margins; we show them honestly.</p>
      <div className="card">
        <h3 className="font-semibold">Scam checker ({msgs.length} labelled messages: {scams.length} scams, {genuine.length} genuine)</h3>
        <p className="text-sm muted">
          {runId ? `Latest run ${msgs[0]?.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : "No run yet"}
          {runId && msgs.length < EVAL_MESSAGES.length ? ` · partial: ${msgs.length} of ${EVAL_MESSAGES.length} finished` : ""}
          {msgs.length > 0 && ` · model: ${models.join(", ")}`}
        </p>
        <table className="data"><tbody>
          <tr><th>Scams caught (labelled scam)</th><td>{caught} of {scams.length} ({pct(caught, scams.length)}) <span className="muted text-sm">{wilson(caught, scams.length)}</span></td></tr>
          <tr><th>Scams missed (wrongly called genuine)</th><td>{missed} ({pct(missed, scams.length)})</td></tr>
          <tr><th>Scams sent to a human as &quot;unsure&quot;</th><td>{scamsToHuman}</td></tr>
          <tr><th><b>False alarms</b> (genuine message called scam)</th><td><b>{falseAlarms} of {genuine.length} ({pct(falseAlarms, genuine.length)})</b> <span className="muted text-sm">{wilson(falseAlarms, genuine.length)}</span></td></tr>
          <tr><th>Genuine messages sent to a human</th><td>{genuineToHuman}</td></tr>
          <tr><th>Accuracy when the system acted alone</th><td>{autoCorrect} of {autoDecided.length} ({pct(autoCorrect, autoDecided.length)}) <span className="muted text-sm">{wilson(autoCorrect, autoDecided.length)}</span></td></tr>
          <tr><th>Speed (median / 90th percentile)</th><td>{(p50 / 1000).toFixed(1)} s / {(p90 / 1000).toFixed(1)} s</td></tr>
          <tr><th>AI cost so far</th><td>${cost.toFixed(3)} (≈ ${(msgs.length ? cost / msgs.length : 0).toFixed(4)} per message)</td></tr>
          <tr><th>AI unavailable (fell back to warning signs)</th><td>{aiFailures}</td></tr>
        </tbody></table>
        {(byLang.length > 0 || byHard.length > 0) && (
          <table className="data mt-3">
            <thead><tr><th>Group</th><th>Messages</th><th>Right</th><th>Sent to a human</th><th>Wrong</th></tr></thead>
            <tbody>{[...byLang, ...byHard].map(([k, e]) => (
              <tr key={k}><td>{k}</td><td>{e.n}</td><td>{e.right} ({pct(e.right, e.n)})</td><td>{e.unsure}</td><td>{e.wrong}</td></tr>
            ))}</tbody>
          </table>
        )}
        {mistakes.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold">Every wrong answer ({mistakes.length}), so we can learn from them</summary>
            <ul className="mt-2 space-y-2 text-sm">{mistakes.map((m) => (
              <li key={m.id}><span className="badge badge-danger mr-1">truth: {m.reviewedLabel}, said: {m.label}</span> {m.text}</li>
            ))}</ul>
          </details>
        )}
        <p className="text-sm muted mt-2">&quot;Sent to a human&quot; is not counted as wrong: when unsure, the system asks a person instead of guessing.</p>
        {user.role === "ADMIN" && <RunEvalButton />}
      </div>
      <AgentEval tenantId={user.tenantId} isAdmin={user.role === "ADMIN"} />
      <div className="card">
        <h3 className="font-semibold">Proof-of-life decisions</h3>
        <table className="data"><tbody>
          <tr><th>Approved automatically</th><td>{autoApproved}</td></tr>
          <tr><th>Sent to an officer by the AI</th><td>{aiEscalated.size}</td></tr>
          <tr><th>…of which the officer approved (AI was over-cautious)</th><td>{officerApproved}</td></tr>
          <tr><th>…of which the officer stopped (AI caught a real problem)</th><td>{officerStopped}</td></tr>
          <tr><th>Face checks recorded</th><td>{faceEv.length} (distances: {faceEv.map((f) => f.score?.toFixed(2)).join(", ") || "none yet"})</td></tr>
        </tbody></table>
        <p className="text-sm muted mt-2">Over-cautious escalations cost officer time (Rs per review in the rules); wrong automatic approvals cost far more. That trade-off is why the auto-approve bar is high.</p>
      </div>
    </div>
  );
}

// How well the officer's AI case assistant finds the problems planted in the demo data.
async function AgentEval({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const last = await prisma.auditLog.findFirst({ where: { tenantId, action: "agent_eval_case" }, orderBy: { createdAt: "desc" } });
  const runId = (last?.details as AgentEvalRow | null)?.runId;
  const rows = runId
    ? (await prisma.auditLog.findMany({ where: { tenantId, action: "agent_eval_case", details: { path: ["runId"], equals: runId } }, orderBy: { createdAt: "asc" } })).map((r) => r.details as AgentEvalRow)
    : [];
  const ran = rows.filter((r) => !r.skipped);
  const planted = ran.filter((r) => r.planted);
  const clean = ran.filter((r) => !r.planted);
  const ai = ran.filter((r) => r.mode === "ai");
  const n = (f: (r: AgentEvalRow) => boolean | null | undefined, list = ran) => list.filter((r) => f(r) === true).length;
  const pct = (a: number, b: number) => (b === 0 ? "–" : `${((a / b) * 100).toFixed(0)}%`);
  const avg = (f: (r: AgentEvalRow) => number | undefined) => (ran.length ? ran.reduce((a, r) => a + (f(r) ?? 0), 0) / ran.length : 0);
  const word = (r?: string) => r?.replaceAll("_", " ") ?? "–";
  return (
    <div className="card">
      <h3 className="font-semibold">🕵️ AI case assistant ({AGENT_EVAL_CASES.length} labelled cases: {AGENT_EVAL_CASES.filter((c) => c.planted).length} with a planted problem, {AGENT_EVAL_CASES.filter((c) => !c.planted).length} clean)</h3>
      <p className="text-sm muted">The demo data hides real-world problems on purpose. We check whether the assistant finds them by itself, and whether its suggestion is safe. {runId ? `Latest run ${last?.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC${rows.length < AGENT_EVAL_CASES.length ? `, partial: ${rows.length} of ${AGENT_EVAL_CASES.length}` : ""}.` : "Not run yet."}</p>
      {ran.length > 0 && (
        <>
          <table className="data"><tbody>
            <tr><th>Found the planted problem by itself</th><td>{n((r) => r.foundItself, planted)} of {planted.length} ({pct(n((r) => r.foundItself, planted), planted.length)}) <span className="muted text-sm">{wilson(n((r) => r.foundItself, planted), planted.length)}</span></td></tr>
            <tr><th>Safe suggestion from the AI alone (before safety rules)</th><td>{n((r) => r.safeRaw)} of {ran.length} ({pct(n((r) => r.safeRaw), ran.length)})</td></tr>
            <tr><th><b>Safe suggestion shown to the officer (after safety rules)</b></th><td><b>{n((r) => r.safeFinal)} of {ran.length} ({pct(n((r) => r.safeFinal), ran.length)})</b></td></tr>
            <tr><th>False alarms on clean cases (&quot;investigate&quot;)</th><td>{n((r) => r.falseAlarm, clean)} of {clean.length}</td></tr>
            <tr><th>Safety rules had to step in</th><td>{n((r) => r.corrected)} of {ran.length}</td></tr>
            <tr><th>Finished by the AI (not the fixed checklist)</th><td>{ai.length} of {ran.length}</td></tr>
            <tr><th>Average checks run / time</th><td>{avg((r) => r.toolCalls).toFixed(1)} checks · {(avg((r) => r.ms) / 1000).toFixed(1)} s</td></tr>
          </tbody></table>
          <div className="overflow-x-auto mt-3">
            <table className="data">
              <thead><tr><th>Case</th><th>Planted problem</th><th>Found it?</th><th>AI said</th><th>Officer sees</th><th>Mode</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.index}>
                  <td>{r.pensionNo}<div className="text-xs muted">{r.what}</div></td>
                  <td className="text-sm">{r.planted ? word(r.planted) : "none (clean)"}</td>
                  <td>{r.skipped ? <span className="muted text-sm">{r.skipped}</span> : r.foundItself === null ? "–" : r.foundItself ? <span className="badge badge-ok">yes</span> : <span className="badge badge-danger">missed</span>}</td>
                  <td className="text-sm">{word(r.raw)}</td>
                  <td><span className={`badge ${r.safeFinal ? "badge-ok" : "badge-danger"}`}>{word(r.final)}</span>{r.guardrails?.length ? <div className="text-xs muted">corrected: {r.guardrails.map(word).join(", ")}</div> : null}</td>
                  <td className="text-xs">{r.mode === "ai" ? r.model : r.mode ? `checklist${r.model ? ` (${r.model.replace(" → checklist", "")} failed)` : ""}` : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-sm muted mt-2">When the AI is not available the fixed checklist answers; those rows find every problem by design, so read &quot;Finished by the AI&quot; with the other numbers.</p>
        </>
      )}
      {isAdmin && <RunEvalButton endpoint="/api/admin/run-agent-eval" label="▶️ Run the case assistant test set (about 3 minutes)" pauseMs={4000} />}
    </div>
  );
}

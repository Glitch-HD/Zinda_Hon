import Header from "@/components/Header";
import RunEvalButton from "@/components/RunEvalButton";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

// Evaluation dashboard: accuracy, false alarms, speed, cost and failures, measured on labelled data.
// Numbers are computed live from the database, never typed in by hand.
const PRICE_IN = 4 / 1_000_000, PRICE_OUT = 20 / 1_000_000; // USD per token, Claude Opus 5.5

export default async function Evaluation() {
  const user = await pageUser(["ADMIN", "AUDITOR", "OFFICER"]);
  const msgs = await prisma.checkedMessage.findMany({ where: { tenantId: user.tenantId, reviewedLabel: { not: null } } });
  const scams = msgs.filter((m) => m.reviewedLabel === "scam");
  const genuine = msgs.filter((m) => m.reviewedLabel === "genuine");
  const caught = scams.filter((m) => m.label === "scam").length;
  const missed = scams.filter((m) => m.label === "genuine").length;
  const scamsToHuman = scams.filter((m) => m.label === "unsure").length;
  const falseAlarms = genuine.filter((m) => m.label === "scam").length;
  const genuineToHuman = genuine.filter((m) => m.label === "unsure").length;
  const autoDecided = msgs.filter((m) => m.route !== "human_review");
  const autoCorrect = autoDecided.filter((m) => (m.route === "warn_user" && m.reviewedLabel === "scam") || (m.route === "reassure_user" && m.reviewedLabel === "genuine")).length;
  const reasons = msgs.map((m) => m.reasons as { ms?: number; usage?: { input: number; output: number } | null; source?: string });
  const times = reasons.map((r) => r.ms ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)] ?? 0;
  const p90 = times[Math.floor(times.length * 0.9)] ?? 0;
  const cost = reasons.reduce((a, r) => a + (r.usage ? r.usage.input * PRICE_IN + r.usage.output * PRICE_OUT : 0), 0);
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
        <table className="data"><tbody>
          <tr><th>Scams caught (labelled scam)</th><td>{caught} of {scams.length} ({pct(caught, scams.length)})</td></tr>
          <tr><th>Scams missed (wrongly called genuine)</th><td>{missed} ({pct(missed, scams.length)})</td></tr>
          <tr><th>Scams sent to a human as &quot;unsure&quot;</th><td>{scamsToHuman}</td></tr>
          <tr><th><b>False alarms</b> (genuine message called scam)</th><td><b>{falseAlarms} of {genuine.length} ({pct(falseAlarms, genuine.length)})</b></td></tr>
          <tr><th>Genuine messages sent to a human</th><td>{genuineToHuman}</td></tr>
          <tr><th>Accuracy when the system acted alone</th><td>{autoCorrect} of {autoDecided.length} ({pct(autoCorrect, autoDecided.length)})</td></tr>
          <tr><th>Speed (median / 90th percentile)</th><td>{(p50 / 1000).toFixed(1)} s / {(p90 / 1000).toFixed(1)} s</td></tr>
          <tr><th>AI cost so far</th><td>${cost.toFixed(3)} (≈ ${(msgs.length ? cost / msgs.length : 0).toFixed(4)} per message)</td></tr>
          <tr><th>AI unavailable (fell back to warning signs)</th><td>{aiFailures}</td></tr>
        </tbody></table>
        {user.role === "ADMIN" && <RunEvalButton />}
      </div>
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

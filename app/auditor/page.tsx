import EmptyState from "@/components/ui/EmptyState";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageTitle, Stat } from "@/components/ui/Dash";

// Read-only view for the auditor: every action, every AI decision with its full trace, every consent change.
export default async function Auditor({ searchParams }: { searchParams: Promise<{ tab?: string; actor?: string }> }) {
  const user = await pageUser(["AUDITOR"]);
  const sp = await searchParams;
  const tab = sp.tab ?? "decisions";
  const day = new Date(Date.now() - 86400_000);
  const [decisions, officerOverrides, actions24h, risky] = await Promise.all([
    prisma.decision.count({ where: { case: { tenantId: user.tenantId } } }),
    prisma.decision.count({ where: { case: { tenantId: user.tenantId }, decidedBy: { not: "ai" } } }),
    prisma.auditLog.count({ where: { tenantId: user.tenantId, createdAt: { gte: day } } }),
    prisma.auditLog.count({ where: { tenantId: user.tenantId, action: { in: ["face_reenrolled", "correction_refused_sensitive_field", "rule_change_proposed", "rule_change_self_approval_refused", "face_enrol_refused_same_face"] } } }),
  ]);
  const tabs = [{ id: "decisions", label: "AI decisions" }, { id: "risky", label: "Risky actions" }, { id: "agent", label: "AI case assistant" }, { id: "log", label: "Audit log" }, { id: "consent", label: "Consent records" }];
  return (
    <div>
      <Header user={user} links={[{ href: "/evaluation", label: "Evaluation", info: { en: "How accurate the AI checks are, measured on labelled test data, with error margins.", ur: "اے آئی کی درستگی کے نتائج۔" } }]} />
      <PageTitle title="Audit and oversight" sub="Read-only. Every action by a person, the AI or the case assistant, with the full reasoning behind each decision." />
      <div className="stats">
        <Stat n={decisions} label="Decisions on record" icon="⚖️" />
        <Stat n={officerOverrides} label="Made by an officer" icon="🧑‍💼" tone="warn" />
        <Stat n={actions24h} label="Actions in the last 24 h" icon="📜" tone="ok" />
        <Stat n={risky} label="Risky actions to check" icon="⚠️" tone={risky ? "danger" : "ok"} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">{tabs.map((t) => <a key={t.id} href={`?tab=${t.id}`} className={`btn btn-sm ${tab === t.id ? "" : "btn-ghost"}`}>{t.label}</a>)}</div>
      {tab === "decisions" && <Decisions tenantId={user.tenantId} />}
      {tab === "risky" && <Risky tenantId={user.tenantId} />}
      {tab === "agent" && <AgentRuns tenantId={user.tenantId} />}
      {tab === "log" && <Log tenantId={user.tenantId} actor={sp.actor} />}
      {tab === "consent" && <Consents tenantId={user.tenantId} />}
    </div>
  );
}

const OUTCOME_CLS: Record<string, string> = { APPROVE: "badge-ok", OFFICER_APPROVED: "badge-ok", ASK_MORE_PROOF: "badge-warn", SEND_TO_OFFICER: "badge-warn", OFFICER_STOPPED: "badge-danger" };

async function Decisions({ tenantId }: { tenantId: string }) {
  const ds = await prisma.decision.findMany({ where: { case: { tenantId } }, orderBy: { createdAt: "desc" }, take: 50, include: { ruleVersion: { select: { version: true } }, case: { include: { pensioner: { select: { pensionNo: true } } } } } });
  return (
    <div className="space-y-3">
      {ds.map((d) => (
        <details key={d.id} className="card" style={{ padding: "12px 16px" }}>
          <summary className="cursor-pointer flex flex-wrap items-center gap-2">
            <b>{d.case.pensioner.pensionNo}</b>
            <span className={`badge ${OUTCOME_CLS[d.outcome] ?? ""}`}>{d.outcome.replaceAll("_", " ").toLowerCase()}</span>
            <span className="badge">{d.decidedBy === "ai" ? "AI engine" : "officer"}</span>
            <span className="muted text-sm">confidence {(d.confidence * 100).toFixed(2)}% · rule v{d.ruleVersion.version}</span>
            <span className="muted text-sm" style={{ marginInlineStart: "auto" }}>{d.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
          </summary>
          <p className="mt-2"><b>What the user was told:</b> {d.reasonEn} <span className="ur">{d.reasonUr}</span></p>
          <p className="mt-2"><b>Full trace</b> (input, rule version, confidence, result):</p>
          <pre className="text-xs overflow-x-auto" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d.auditTrace, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}

const ACTORS = ["USER", "AI", "AGENT", "SYSTEM", "API_CLIENT"] as const;

async function Log({ tenantId, actor }: { tenantId: string; actor?: string }) {
  const only = ACTORS.find((a) => a === actor);
  const rows = await prisma.auditLog.findMany({ where: { OR: [{ tenantId }, { tenantId: null }], ...(only ? { actorType: only } : {}) }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="card overflow-x-auto">
      <p className="text-sm mb-2">Show:{" "}
        <a href="?tab=log" className={`badge mr-1 ${only ? "" : "badge-ok"}`}>everyone</a>
        {ACTORS.map((a) => <a key={a} href={`?tab=log&actor=${a}`} className={`badge mr-1 ${only === a ? "badge-ok" : ""}`}>{a === "USER" ? "people" : a === "AI" ? "AI engine" : a === "AGENT" ? "AI case assistant" : a === "SYSTEM" ? "system" : "API clients"}</a>)}
      </p>
      <table className="data"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td className="text-sm">{r.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td><td>{r.actorType}{r.actorRole ? ` (${r.actorRole.toLowerCase()})` : ""}{r.actorType === "AGENT" || r.actorType === "AI" ? <div className="text-xs muted">{r.actorId}</div> : null}</td><td>{r.action}</td><td className="text-sm">{r.targetType ? `${r.targetType}:${r.targetId?.slice(-6)}` : ""}</td><td className="text-xs" style={{ maxWidth: 360 }}>{r.details ? JSON.stringify(r.details).slice(0, 220) : ""}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// Insider-risk view: the actions a dishonest insider would need, in one place, so the auditor can
// check each one. None of them is forbidden outright (real life needs exceptions); all are visible.
const RISKY: Record<string, string> = {
  officer_approve: "Officer approved despite open risks",
  face_reenrolled: "Enrolled face replaced",
  face_enrol_refused_same_face: "Tried to enrol a face that belongs to another pensioner",
  correction_requested: "Asked to change bank account or CNIC",
  correction_refused_sensitive_field: "Helper tried to change bank account or CNIC",
  access_denied_no_consent: "Helper tried to open data without consent",
  pensioner_login_forged_book: "Forged pension book used to log in",
  login_pin_failed: "Wrong PIN",
  officer_stop: "Pension stopped by an officer",
};

async function Risky({ tenantId }: { tenantId: string }) {
  const rows = (await prisma.auditLog.findMany({ where: { OR: [{ tenantId }, { tenantId: null }], action: { in: Object.keys(RISKY) } }, orderBy: { createdAt: "desc" }, take: 300 }))
    .filter((r) => {
      const d = (r.details ?? {}) as { riskyApproval?: boolean; highRisk?: boolean };
      if (r.action === "officer_approve") return d.riskyApproval === true;
      if (r.action === "correction_requested") return d.highRisk === true;
      return true;
    })
    .slice(0, 100);
  if (!rows.length) return <EmptyState icon="shield" en="No risky actions recorded" ur="کوئی خطرناک کارروائی نہیں" />;
  return (
    <div className="card overflow-x-auto">
      <p className="text-sm muted mb-2">Everything a dishonest insider would need to do, in one list. The audit log cannot be edited or deleted, even from the database.</p>
      <table className="data"><thead><tr><th>When</th><th>What</th><th>Who</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td className="text-sm">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td><span className="badge badge-warn" style={{ whiteSpace: "normal" }}>{RISKY[r.action]}</span></td>
            <td className="text-sm">{r.actorRole?.toLowerCase() ?? r.actorType.toLowerCase()}<div className="text-xs muted">{r.actorId?.slice(-6)}</div></td>
            <td className="text-sm">{r.targetType ? `${r.targetType}:${r.targetId?.slice(-6)}` : ""}</td>
            <td className="text-xs" style={{ maxWidth: 360 }}>{r.details ? JSON.stringify(r.details).slice(0, 220) : ""}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// Every run of the officer's AI case assistant: who asked, what it checked, what it suggested,
// and whether the safety rules had to correct it.
async function AgentRuns({ tenantId }: { tenantId: string }) {
  const runs = await prisma.agentRun.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50, include: { case: { select: { year: true, pensioner: { select: { pensionNo: true } } } } } });
  if (!runs.length) return <EmptyState icon="user" en="No officer has used the AI case assistant yet" />;
  return (
    <div className="card overflow-x-auto">
      <p className="text-sm muted mb-2">The assistant only reads records and advises. Each tool it called is also a separate AGENT row in the audit log.</p>
      <table className="data"><thead><tr><th>When</th><th>Case</th><th>Mode</th><th>Checks it ran</th><th>Suggested</th><th>Safety corrections</th></tr></thead>
        <tbody>{runs.map((r) => {
          const steps = (Array.isArray(r.steps) ? r.steps : []) as { tool?: string }[];
          const rep = (r.report ?? {}) as { recommendation?: string; confidence?: number; guardrails?: { rule: string }[] };
          return (
            <tr key={r.id}>
              <td className="text-sm">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td>{r.case.pensioner.pensionNo} · {r.case.year}</td>
              <td className="text-sm">{r.mode === "ai" ? `AI (${r.model})` : r.model ? `checklist after ${r.model.replace(" → checklist", "")}` : "checklist"}{r.status !== "done" ? <span className="badge badge-danger ml-1">{r.status}</span> : null}</td>
              <td className="text-xs">{steps.map((s) => s.tool?.replaceAll("_", " ")).join(", ")}</td>
              <td>{rep.recommendation ? `${rep.recommendation.replaceAll("_", " ")} (${Math.round((rep.confidence ?? 0) * 100)}%)` : "–"}</td>
              <td className="text-xs">{rep.guardrails?.length ? rep.guardrails.map((g) => g.rule.replaceAll("_", " ")).join(", ") : "none"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

async function Consents({ tenantId }: { tenantId: string }) {
  const rows = await prisma.consent.findMany({ where: { pensioner: { tenantId } }, orderBy: { grantedAt: "desc" }, include: { pensioner: { select: { pensionNo: true, name: true } } } });
  return (
    <div className="card overflow-x-auto">
      <table className="data"><thead><tr><th>Pensioner</th><th>Shared with</th><th>Fields</th><th>Granted</th><th>Withdrawn</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}><td>{c.pensioner.pensionNo} {c.pensioner.name}</td><td>{c.granteeName} ({c.granteeType})</td><td>{c.fields.join(", ")}</td><td>{c.grantedAt.toISOString().slice(0, 10)}</td><td>{c.withdrawnAt?.toISOString().slice(0, 16).replace("T", " ") ?? "–"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

// Read-only view for the auditor: every action, every AI decision with its full trace, every consent change.
export default async function Auditor({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await pageUser(["AUDITOR"]);
  const tab = (await searchParams).tab ?? "decisions";
  const tabs = [{ id: "decisions", label: "AI decisions" }, { id: "log", label: "Audit log" }, { id: "consent", label: "Consent records" }];
  return (
    <div>
      <Header user={user} links={[{ href: "/evaluation", label: "📊 Evaluation" }]} />
      <div className="flex gap-2 mb-3">{tabs.map((t) => <a key={t.id} href={`?tab=${t.id}`} className={`btn ${tab === t.id ? "" : "btn-ghost"}`}>{t.label}</a>)}</div>
      {tab === "decisions" && <Decisions tenantId={user.tenantId} />}
      {tab === "log" && <Log tenantId={user.tenantId} />}
      {tab === "consent" && <Consents tenantId={user.tenantId} />}
    </div>
  );
}

async function Decisions({ tenantId }: { tenantId: string }) {
  const ds = await prisma.decision.findMany({ where: { case: { tenantId } }, orderBy: { createdAt: "desc" }, take: 50, include: { ruleVersion: { select: { version: true } }, case: { include: { pensioner: { select: { pensionNo: true } } } } } });
  return (
    <div className="space-y-3">
      {ds.map((d) => (
        <details key={d.id} className="card">
          <summary className="cursor-pointer">
            <b>{d.case.pensioner.pensionNo}</b> · {d.outcome} · confidence {(d.confidence * 100).toFixed(3)}% · rule v{d.ruleVersion.version} · {d.decidedBy === "ai" ? "AI engine" : "officer"} · {d.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </summary>
          <p className="mt-2"><b>What the user was told:</b> {d.reasonEn} <span className="ur">{d.reasonUr}</span></p>
          <p className="mt-2"><b>Full trace</b> (input, rule version, confidence, result):</p>
          <pre className="text-xs overflow-x-auto" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d.auditTrace, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}

async function Log({ tenantId }: { tenantId: string }) {
  const rows = await prisma.auditLog.findMany({ where: { OR: [{ tenantId }, { tenantId: null }] }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="card overflow-x-auto">
      <table className="data"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td className="text-sm">{r.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td><td>{r.actorType}{r.actorRole ? ` (${r.actorRole.toLowerCase()})` : ""}</td><td>{r.action}</td><td className="text-sm">{r.targetType ? `${r.targetType}:${r.targetId?.slice(-6)}` : ""}</td><td className="text-xs" style={{ maxWidth: 360 }}>{r.details ? JSON.stringify(r.details).slice(0, 220) : ""}</td></tr>
        ))}</tbody>
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

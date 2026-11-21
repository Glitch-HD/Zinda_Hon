import Header from "@/components/Header";
import RuleEditor from "@/components/RuleEditor";
import ApiKeyCreator from "@/components/ApiKeyCreator";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { getActiveRule } from "@/lib/rules";
import { requiredConfidence } from "@/lib/decision";
import RuleRequests from "@/components/RuleRequests";
import { errorSummary } from "@/lib/monitor";
import { PageTitle, Stat, greeting } from "@/components/ui/Dash";
import { helperTrust } from "@/lib/helper-trust";
import HelperTrustCard from "@/components/HelperTrustCard";

export default async function Admin() {
  const user = await pageUser(["ADMIN"]);
  // All lookups at once (each database round trip costs time on the hosted database).
  const [active, versions, users, keys, tenant, pending] = await Promise.all([
    getActiveRule(user.tenantId),
    prisma.ruleVersion.findMany({ where: { tenantId: user.tenantId }, orderBy: { version: "desc" }, include: { _count: { select: { decisions: true } } } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { role: "asc" }, select: { id: true, name: true, role: true, phone: true, active: true } }),
    prisma.apiKey.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.ruleChangeRequest.findMany({ where: { tenantId: user.tenantId, status: "pending" }, orderBy: { createdAt: "asc" } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const trusts = (await Promise.all(users.filter((u) => u.role === "HELPER").map((u) => helperTrust(u.id)))).filter((t) => t !== null).sort((a, b) => a.score - b.score);
  const day = new Date(Date.now() - 86400_000);
  const [errors, scamTotal, scamNoAi, agentTotal, agentChecklist, agentFailed] = await Promise.all([
    errorSummary(24),
    prisma.checkedMessage.count({ where: { tenantId: user.tenantId, createdAt: { gte: day } } }),
    prisma.checkedMessage.count({ where: { tenantId: user.tenantId, createdAt: { gte: day }, modelName: null } }),
    prisma.agentRun.count({ where: { tenantId: user.tenantId, createdAt: { gte: day } } }),
    prisma.agentRun.count({ where: { tenantId: user.tenantId, createdAt: { gte: day }, mode: "checklist" } }),
    prisma.agentRun.count({ where: { tenantId: user.tenantId, createdAt: { gte: day }, status: "failed" } }),
  ]);
  return (
    <div className="space-y-4">
      <Header user={user} links={[{ href: "/evaluation", label: "📊 Evaluation", info: { en: "Accuracy of the face and scam checks on test data, with error margins.", ur: "اے آئی کی درستگی کے نتائج۔" } }, { href: "/scam-map", label: "🗺️ Scam map", info: { en: "Where scam messages are being reported, by area.", ur: "دھوکے کے پیغام کہاں سے آ رہے ہیں۔" } }, { href: "/docs", label: "🔌 API docs", info: { en: "Public REST API documentation (OpenAPI) for banks and departments.", ur: "بینکوں اور محکموں کے لیے اے پی آئی۔" } }]} />
      <PageTitle title={<>{greeting()}, {user.name.split(" ")[0]}</>} sub={`${tenant?.name ?? ""} · rules version ${active.version} active`} />
      <div className="stats">
        <Stat n={`v${active.version}`} label="Active rules" icon="📐" />
        <Stat n={pending.length} label="Rule changes awaiting a 2nd admin" icon="👥" tone={pending.length ? "warn" : "ok"} />
        <Stat n={errors.total} label="Errors in the last 24 h" icon="🩺" tone={errors.total ? "danger" : "ok"} />
        <Stat n={trusts.filter((t) => t.level !== "good").length} label="Helpers to watch" icon="🤝" tone={trusts.some((t) => t.level === "risky") ? "danger" : "warn"} />
      </div>
      <nav className="pillnav" aria-label="Sections">
        <a href="#rules">📐 Rules</a><a href="#approvals">👥 Approvals</a><a href="#health">🩺 Health</a><a href="#history">🕘 History</a><a href="#helpers">🤝 Helpers</a><a href="#users">👤 Users</a><a href="#keys">🔑 API keys</a>
      </nav>
      <div className="card" id="rules">
        <h2 className="text-xl font-bold">Proof-of-life rules (active: version {active.version})</h2>
        <p className="text-sm muted">Auto-approve needs at least {(requiredConfidence(active.config) * 100).toFixed(2)}% confidence = 1 − review cost ÷ wrong-approval cost. Changes apply to the next decision with no code change; old decisions keep their version.</p>
        <RuleEditor initial={active.config} />
      </div>
      <div className="card" id="approvals">
        <h3 className="font-semibold">Looser rule changes waiting for a second admin ({pending.length})</h3>
        <p className="text-sm muted mb-2">Four-eyes rule: any change that would let more cases through without an officer needs a different admin to approve it. Both names go in the audit log.</p>
        <RuleRequests requests={pending.map((r) => ({ id: r.id, baseVersion: r.baseVersion, note: r.note, loosened: r.loosened, proposedBy: r.proposedBy, proposerName: nameOf.get(r.proposedBy) ?? "another admin", createdAt: r.createdAt.toISOString(), mine: r.proposedBy === user.id }))} />
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold" id="health">🩺 System health (last 24 hours)</h3>
        <div className="grid gap-2 sm:grid-cols-3 mt-2">
          <div className="card card-soft"><div className="text-2xl font-bold">{errors.total}</div><div className="text-sm muted">errors (server and phones)</div></div>
          <div className="card card-soft"><div className="text-2xl font-bold">{scamNoAi} / {scamTotal}</div><div className="text-sm muted">message checks without the AI (signs only)</div></div>
          <div className="card card-soft"><div className="text-2xl font-bold">{agentChecklist + agentFailed} / {agentTotal}</div><div className="text-sm muted">case assistant runs on the fixed checklist or failed</div></div>
        </div>
        {errors.groups.length > 0 ? (
          <table className="data mt-3"><thead><tr><th>Where</th><th>Error</th><th>Times</th><th>Last</th></tr></thead>
            <tbody>{errors.groups.map((g, i) => <tr key={i}><td>{g.source === "client" ? "📱 phone" : "🖥️ server"} {g.route ?? ""}</td><td className="text-sm">{g.message}</td><td>{g.count}</td><td>{g.last?.toISOString().slice(11, 16)} UTC</td></tr>)}</tbody></table>
        ) : <p className="text-sm muted mt-2">No errors recorded. Server errors and crashes on people&apos;s phones show up here automatically.</p>}
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold" id="history">Rule history</h3>
        <table className="data"><thead><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th>Decisions made with it</th></tr></thead>
          <tbody>{versions.map((v) => <tr key={v.id}><td>v{v.version}</td><td>{v.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{v.createdBy === "system" ? "system" : nameOf.get(v.createdBy) ?? "admin"}</td><td>{v.note}</td><td>{v._count.decisions}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h3 className="font-semibold" id="helpers">🤝 Helper trust scores</h3>
        <p className="text-sm muted mb-2">Lowest first. Officers see the same score on every case a helper submitted.</p>
        <div className="space-y-2">{trusts.map((t) => <div key={t.helperId}><b>{t.name}</b> <HelperTrustCard t={t} compact /></div>)}</div>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold" id="users">Users</h3>
        <table className="data"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Active</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.role}</td><td>{u.phone}</td><td>{u.active ? "yes" : "no"}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h3 className="font-semibold" id="keys">API keys for outside systems</h3>
        <ul className="text-sm mb-2">{keys.map((k) => <li key={k.id}>{k.name} · {k.prefix}… · {k.scopes.join(", ")} · {k.revokedAt ? "revoked" : "active"} · last used {k.lastUsedAt?.toISOString().slice(0, 10) ?? "never"}</li>)}</ul>
        <ApiKeyCreator />
      </div>
    </div>
  );
}

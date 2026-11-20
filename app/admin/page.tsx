import Header from "@/components/Header";
import RuleEditor from "@/components/RuleEditor";
import ApiKeyCreator from "@/components/ApiKeyCreator";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { getActiveRule } from "@/lib/rules";
import { requiredConfidence } from "@/lib/decision";

export default async function Admin() {
  const user = await pageUser(["ADMIN"]);
  const active = await getActiveRule(user.tenantId);
  const versions = await prisma.ruleVersion.findMany({ where: { tenantId: user.tenantId }, orderBy: { version: "desc" }, include: { _count: { select: { decisions: true } } } });
  const users = await prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { role: "asc" }, select: { id: true, name: true, role: true, phone: true, active: true } });
  const keys = await prisma.apiKey.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } });
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  return (
    <div className="space-y-4">
      <Header user={user} links={[{ href: "/evaluation", label: "📊 Evaluation" }, { href: "/scam-map", label: "🗺️ Scam map" }, { href: "/docs", label: "API docs" }]} />
      <p className="muted">Workspace: {tenant?.name}</p>
      <div className="card">
        <h2 className="text-xl font-bold">Proof-of-life rules (active: version {active.version})</h2>
        <p className="text-sm muted">Auto-approve needs at least {(requiredConfidence(active.config) * 100).toFixed(2)}% confidence = 1 − review cost ÷ wrong-approval cost. Changes apply to the next decision with no code change; old decisions keep their version.</p>
        <RuleEditor initial={active.config} />
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold">Rule history</h3>
        <table className="data"><thead><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th>Decisions made with it</th></tr></thead>
          <tbody>{versions.map((v) => <tr key={v.id}><td>v{v.version}</td><td>{v.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{v.createdBy === "system" ? "system" : "admin"}</td><td>{v.note}</td><td>{v._count.decisions}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold">Users</h3>
        <table className="data"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Active</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.role}</td><td>{u.phone}</td><td>{u.active ? "yes" : "no"}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h3 className="font-semibold">API keys for outside systems</h3>
        <ul className="text-sm mb-2">{keys.map((k) => <li key={k.id}>{k.name} · {k.prefix}… · {k.scopes.join(", ")} · {k.revokedAt ? "revoked" : "active"} · last used {k.lastUsedAt?.toISOString().slice(0, 10) ?? "never"}</li>)}</ul>
        <ApiKeyCreator />
      </div>
    </div>
  );
}

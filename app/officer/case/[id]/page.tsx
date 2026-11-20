import { notFound } from "next/navigation";
import Header from "@/components/Header";
import OfficerActions from "@/components/OfficerActions";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { lookupIdentity } from "@/lib/case-service";

export default async function OfficerCase({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(["OFFICER"]);
  const { id } = await params;
  const c = await prisma.case.findUnique({ where: { id }, include: { pensioner: true, decisions: { orderBy: { createdAt: "desc" }, include: { ruleVersion: { select: { version: true } } } }, evidence: { orderBy: { createdAt: "asc" } } } });
  if (!c || c.tenantId !== user.tenantId) notFound();
  const identity = await lookupIdentity(c.pensionerId);
  const latest = c.decisions[0];
  const trace = (latest?.auditTrace ?? {}) as { checks?: { check: string; status: string; score: number | null; detail: string }[]; confidence?: number; requiredConfidence?: number };

  return (
    <div>
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-bold">{c.pensioner.name} <span className="ur">{c.pensioner.nameUr}</span></h2>
          <p className="muted">{c.pensioner.pensionNo} · {c.pensioner.pensionType === "family" ? "Family (widow) pension" : "Own pension"} · Rs {c.pensioner.monthlyAmount.toLocaleString()} / month (mock)</p>
          <p>Status: <b>{c.status.replaceAll("_", " ").toLowerCase()}</b> · Year {c.year}</p>
          {c.riskFlags.length > 0 && <p className="mt-2">{c.riskFlags.map((f) => <span key={f} className="badge badge-danger mr-1">{f.replaceAll("_", " ")}</span>)}</p>}
          <h3 className="font-semibold mt-4">Records compared (mock services)</h3>
          <table className="data">
            <tbody>
              <tr><th>Pension record name</th><td>{c.pensioner.name}</td></tr>
              <tr><th>Mock NADRA name</th><td>{identity.nadra?.name ?? "No record found"} {identity.nadra && <span className="muted">(matched by {identity.matchedBy.replaceAll("_", " ")})</span>}</td></tr>
              <tr><th>Name similarity</th><td>{(identity.nameSimilarity * 100).toFixed(0)}%</td></tr>
              <tr><th>CNIC agrees</th><td>{identity.cnicMatch === null ? "Unknown (CNIC missing)" : identity.cnicMatch ? "Yes" : "NO"}</td></tr>
              <tr><th>Date of birth agrees</th><td>{identity.dobMatch === null ? "Unknown" : identity.dobMatch ? "Yes" : "NO"}</td></tr>
              <tr><th>Age</th><td>{identity.ageYears ?? "Unknown"}</td></tr>
              <tr><th>Possible duplicates</th><td>{identity.duplicates.length ? identity.duplicates.map((d) => `${d.pensionNo} (${d.name})`).join(", ") : "None"}</td></tr>
              <tr><th>Death registry</th><td>{identity.death ? `RECORD FOUND: ${identity.death.dateOfDeath.toISOString().slice(0, 10)}, ${identity.death.registeredAt}` : "No record"}</td></tr>
              <tr><th>Bank last activity</th><td>{identity.bank?.lastActivity?.toISOString().slice(0, 10) ?? "Unknown"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="font-semibold">AI checks (latest run)</h3>
          {!latest && <p className="muted">No decision yet.</p>}
          {trace.checks && (
            <table className="data">
              <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
              <tbody>
                {trace.checks.map((ch) => (
                  <tr key={ch.check}>
                    <td>{ch.check.replaceAll("_", " ")}</td>
                    <td><span className={ch.status === "pass" ? "badge badge-ok" : ch.status === "fail" ? "badge badge-danger" : "badge badge-warn"}>{ch.status}</span>{ch.score !== null && <span className="muted text-sm"> {ch.score.toFixed(3)}</span>}</td>
                    <td className="text-sm">{ch.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {latest && <p className="text-sm mt-2">Confidence {(latest.confidence * 100).toFixed(3)}% vs required {((trace.requiredConfidence ?? 0) * 100).toFixed(3)}% · Rule version {latest.ruleVersion.version}</p>}
          <OfficerActions caseId={c.id} closed={c.status === "VERIFIED" || c.status === "STOPPED"} />
        </div>
      </div>
      <div className="card mt-4">
        <h3 className="font-semibold">Decision history</h3>
        <table className="data">
          <thead><tr><th>When</th><th>Outcome</th><th>By</th><th>Rule</th><th>Reason given to pensioner</th></tr></thead>
          <tbody>
            {c.decisions.map((d) => (
              <tr key={d.id}><td>{d.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{d.outcome}</td><td>{d.decidedBy === "ai" ? "AI engine" : "Officer"}</td><td>v{d.ruleVersion.version}</td><td className="text-sm">{d.reasonEn}<br /><span className="ur">{d.reasonUr}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

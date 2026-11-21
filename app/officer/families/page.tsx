import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageTitle, SectionHead } from "@/components/ui/Dash";
import FamiliesDesk, { type FamilyRow, type HelperRow, type CorrectionRow } from "@/components/FamiliesDesk";

// Officer desk for the people side of the office: open this year's cases, link or unlink helpers
// (with what the widow agreed to share), and accept or reject "correct my data" requests.
export default async function Families() {
  const user = await pageUser(["OFFICER"]);
  const year = new Date().getFullYear();
  const [pensioners, helpers, corrections] = await Promise.all([
    prisma.pensioner.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { pensionNo: "asc" },
      select: { id: true, name: true, nameUr: true, pensionNo: true, area: true, status: true, userId: true,
        cases: { where: { year }, select: { id: true, status: true } },
        helperLinks: { where: { active: true }, select: { helper: { select: { id: true, name: true } } } } },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, role: "HELPER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, area: true, _count: { select: { helperLinks: { where: { active: true } } } } } }),
    prisma.dataCorrectionRequest.findMany({ where: { pensioner: { tenantId: user.tenantId }, status: { in: ["pending", "awaiting_second"] } }, orderBy: { createdAt: "asc" }, include: { pensioner: { select: { name: true, pensionNo: true } } } }),
  ]);
  const proposals = corrections.length ? await prisma.auditLog.findMany({ where: { action: "correction_proposed", tenantId: user.tenantId }, select: { actorId: true, details: true } }) : [];
  const staff = await prisma.user.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, role: true } });
  const who = (id: string | null | undefined) => staff.find((s) => s.id === id);

  const rows: FamilyRow[] = pensioners.map((p) => ({
    id: p.id, name: p.name, nameUr: p.nameUr, pensionNo: p.pensionNo, area: p.area, active: p.status === "active", hasAccount: Boolean(p.userId),
    caseId: p.cases[0]?.id ?? null, caseStatus: p.cases[0]?.status ?? null,
    helpers: p.helperLinks.map((l) => ({ id: l.helper.id, name: l.helper.name })),
  }));
  const helperRows: HelperRow[] = helpers.map((h) => ({ id: h.id, name: h.name, area: h.area, families: h._count.helperLinks }));
  const corrRows: CorrectionRow[] = corrections.map((c) => {
    const prop = proposals.find((x) => (x.details as { requestId?: string } | null)?.requestId === c.id);
    const highRisk = c.field === "bankAccountNo" || c.field === "cnicMock";
    const mask = (v: string | null) => (v && highRisk ? `••••${v.slice(-4)}` : v ?? "");
    return { id: c.id, pensioner: `${c.pensioner.name} (${c.pensioner.pensionNo})`, field: c.field, oldValue: mask(c.oldValue), newValue: c.newValue, status: c.status, highRisk,
      requestedBy: who(c.requestedBy)?.name ?? "her", proposedBy: prop ? who(prop.actorId)?.name ?? "an officer" : null, proposedByMe: prop?.actorId === user.id, createdAt: c.createdAt.toISOString().slice(0, 10) };
  });
  const noCase = rows.filter((r) => r.active && !r.caseId).length;

  return (
    <div>
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <PageTitle title="Families, helpers and corrections" sub={`${rows.length} pensioners · ${helperRows.length} helpers · ${corrRows.length} correction request${corrRows.length === 1 ? "" : "s"} waiting`} />
      <FamiliesDesk rows={rows} helpers={helperRows} corrections={corrRows} noCase={noCase} year={year} />
      <SectionHead title="Rules on this page" />
      <div className="card text-sm space-y-1">
        <p>Opening a case only says "proof of life is due". It never approves or stops a pension.</p>
        <p>Link a helper only after she agreed. Write how she agreed; she is told, and can take it back at any time. Bank details are never shared with a helper, and one helper can hold at most 40 families.</p>
        <p>A new bank account or CNIC needs two different officers, and this year's case then goes to an officer for review.</p>
      </div>
    </div>
  );
}

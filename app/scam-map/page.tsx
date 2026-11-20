import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

// Scam Map (bonus): patterns of messages classified as scams, by area, type and day.
export default async function ScamMap({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const withTest = (await searchParams).test === "1";
  const user = await pageUser(["ADMIN", "OFFICER", "SHOPKEEPER", "AUDITOR"]);
  // Messages from the labelled test set (no submitter) are hidden by default: the map shows what real
  // people reported. They can be shown on purpose, for a fuller demo, and the page says so.
  const scams = await prisma.checkedMessage.findMany({ where: { tenantId: user.tenantId, label: "scam", ...(withTest ? {} : { submittedById: { not: null } }) }, orderBy: { createdAt: "desc" }, take: 1000 });
  const hidden = withTest ? 0 : await prisma.checkedMessage.count({ where: { tenantId: user.tenantId, label: "scam", submittedById: null } });
  const by = (f: (m: (typeof scams)[number]) => string) => {
    const map = new Map<string, number>();
    for (const m of scams) map.set(f(m), (map.get(f(m)) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const areas = by((m) => m.area ?? "Unknown");
  const types = by((m) => ((m.reasons as { ai?: { scam_type?: string } }).ai?.scam_type ?? "unclassified").replaceAll("_", " "));
  const days = by((m) => m.createdAt.toISOString().slice(0, 10)).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...areas.map((a) => a[1]), ...types.map((t) => t[1]), ...days.map((d) => d[1]));
  const Bars = ({ rows }: { rows: [string, number][] }) => (
    <div className="space-y-1">{rows.map(([k, v]) => (
      <div key={k} className="flex items-center gap-2 text-sm"><span style={{ width: 150 }}>{k}</span><div style={{ width: `${(v / max) * 60}%`, background: "var(--danger)", height: 14, borderRadius: 4 }} /><span>{v}</span></div>
    ))}</div>
  );
  return (
    <div className="space-y-4">
      <Header user={user} />
      <h2 className="text-2xl font-bold">🗺️ Scam map ({scams.length} scam messages)</h2>
      <p className="text-sm muted">
        {withTest ? <>Including messages from the labelled test set. <a className="underline" href="?">Show only real reports</a></> : <>Only messages people actually checked.{hidden > 0 && <> {hidden} test-set scams are hidden. <a className="underline" href="?test=1">Include them</a></>}</>}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><h3 className="font-semibold mb-2">By area</h3><Bars rows={areas} /></div>
        <div className="card"><h3 className="font-semibold mb-2">By type</h3><Bars rows={types} /></div>
        <div className="card"><h3 className="font-semibold mb-2">By day</h3><Bars rows={days} /></div>
      </div>
    </div>
  );
}

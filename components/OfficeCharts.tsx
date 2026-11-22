import { prisma } from "@/lib/db";

// Four small charts for the officer and admin homes. Plain HTML bars (no chart library, so nothing extra
// to download on a slow line). Each chart is one series, so the title names it and no legend is needed;
// every bar carries its number as text, and hovering shows the exact value.
const STATUS: { key: string; en: string; ur: string; color: string }[] = [
  { key: "VERIFIED", en: "Verified", ur: "تصدیق شدہ", color: "#1E8E3E" },
  { key: "WITH_OFFICER", en: "With officer", ur: "افسر کے پاس", color: "#B07800" },
  { key: "NEEDS_PROOF", en: "Needs proof", ur: "مزید ثبوت", color: "#B07800" },
  { key: "IN_PROGRESS", en: "In progress", ur: "جاری", color: "#5B6B7F" },
  { key: "DUE", en: "Due", ur: "باقی", color: "#5B6B7F" },
  { key: "STOPPED", en: "Stopped", ur: "رکی ہوئی", color: "#C5221F" },
];
const OUTCOME: Record<string, { en: string; ur: string }> = {
  APPROVE: { en: "AI approved", ur: "اے آئی منظور" },
  SEND_TO_OFFICER: { en: "Sent to officer", ur: "افسر کو بھیجا" },
  ASK_MORE_PROOF: { en: "Asked more proof", ur: "مزید ثبوت" },
  OFFICER_APPROVED: { en: "Officer approved", ur: "افسر نے منظور کیا" },
  OFFICER_STOPPED: { en: "Officer stopped", ur: "افسر نے روکا" },
};
const LABEL: Record<string, { en: string; ur: string }> = {
  scam: { en: "Scam", ur: "دھوکہ" }, genuine: { en: "Genuine", ur: "اصلی" }, unsure: { en: "Unsure", ur: "غیر یقینی" },
};

function Bars({ rows }: { rows: { en: string; ur: string; n: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.every((r) => r.n === 0)) return <p className="muted text-sm">Nothing yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.en} className="bar-row" title={`${r.en}: ${r.n}`}>
          <span><span className="en">{r.en}</span><span className="ur" style={{ lineHeight: 1.6 }}>{r.ur}</span></span>
          <span className="bar"><span style={{ width: `${(r.n / max) * 100}%`, background: r.color }} /></span>
          <span className="n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default async function OfficeCharts({ tenantId }: { tenantId: string }) {
  const year = new Date().getFullYear();
  const since = new Date(Date.now() - 8 * 7 * 86400000);
  const [byStatus, byOutcome, byLabel, recent] = await Promise.all([
    prisma.case.groupBy({ by: ["status"], where: { tenantId, year }, _count: true }),
    prisma.decision.groupBy({ by: ["outcome"], where: { case: { tenantId, year } }, _count: true }),
    prisma.checkedMessage.groupBy({ by: ["label"], where: { tenantId }, _count: true }),
    prisma.case.findMany({ where: { tenantId, updatedAt: { gte: since }, status: { in: ["VERIFIED", "STOPPED", "WITH_OFFICER"] } }, select: { updatedAt: true } }),
  ]);
  const count = <T extends { _count: number }>(list: T[], f: (x: T) => boolean) => list.find(f)?._count ?? 0;
  // Cases finished or sent for review, per week, oldest week on the left.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * 86400000;
    const start = end - 7 * 86400000;
    return { label: i === 7 ? "This wk" : `${7 - i}w ago`, n: recent.filter((r) => r.updatedAt.getTime() > start && r.updatedAt.getTime() <= end).length };
  });
  const wmax = Math.max(1, ...weeks.map((w) => w.n));
  return (
    <div className="mini-charts">
      <section className="mini-chart" aria-label={`Cases in ${year} by status`}>
        <h4><span className="en">Cases in {year} by status</span> <span className="ur">کیسوں کا حال</span></h4>
        <Bars rows={STATUS.map((s) => ({ ...s, n: count(byStatus, (x) => x.status === s.key) }))} />
      </section>
      <section className="mini-chart" aria-label="Decisions this year">
        <h4><span className="en">Decisions in {year}</span> <span className="ur">فیصلے</span></h4>
        <Bars rows={Object.entries(OUTCOME).map(([k, v]) => ({ ...v, n: count(byOutcome, (x) => x.outcome === k) }))} />
      </section>
      <section className="mini-chart" aria-label="Cases handled per week, last 8 weeks">
        <h4><span className="en">Cases handled per week</span> <span className="ur">ہر ہفتے کے کیس</span></h4>
        <div className="cols">
          {weeks.map((w) => (
            <div key={w.label} title={`${w.label}: ${w.n}`}>
              <b style={{ color: "var(--ink)" }}>{w.n || ""}</b>
              <span style={{ height: Math.round((w.n / wmax) * 72) }} />
              <small>{w.label}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="mini-chart" aria-label="Messages checked by verdict">
        <h4><span className="en">Messages checked</span> <span className="ur">جانچے گئے پیغام</span></h4>
        <Bars rows={Object.entries(LABEL).map(([k, v]) => ({ ...v, n: count(byLabel, (x) => x.label === k), color: k === "scam" ? "#C5221F" : k === "genuine" ? "#1E8E3E" : "#B07800" }))} />
      </section>
    </div>
  );
}

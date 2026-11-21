import Header from "@/components/Header";
import MockNadraLoader from "@/components/MockNadraLoader";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { normalizeCnic } from "@/lib/names";

export default async function MockNadraPage() {
  const user = await pageUser(["ADMIN"]);
  const [records, pensioners] = await Promise.all([
    prisma.mockNadraRecord.findMany({ where: { cnic: { not: null } }, orderBy: { name: "asc" }, select: { cnic: true, name: true, faceDescriptor: true } }),
    prisma.pensioner.findMany({ where: { tenantId: user.tenantId, cnicMock: { not: null } }, select: { cnicMock: true, pensionNo: true } }),
  ]);
  const pensionNo = new Map(pensioners.map((p) => [normalizeCnic(p.cnicMock), p.pensionNo]));
  const list = records
    .filter((r) => pensionNo.has(normalizeCnic(r.cnic)))
    .map((r) => ({ cnic: r.cnic!, label: `${pensionNo.get(normalizeCnic(r.cnic))} · ${r.name} · ${r.cnic}`, hasFace: r.faceDescriptor.length === 128 }));
  return (
    <div className="max-w-3xl mx-auto">
      <Header user={user} links={[{ href: "/admin", label: "← Admin" }]} />
      <div className="card mb-4" style={{ borderLeft: "6px solid var(--warn)" }}>
        <p className="font-semibold">Simulated NADRA, demo only</p>
        <p className="text-sm">In real life NADRA already holds every citizen&apos;s CNIC photo, and the pension office would fetch it (with her consent) instead of asking an old widow to travel. Here NADRA is a mock. Load a face only from an <b>AI-generated face</b> or a <b>team member who agreed</b>, never a real citizen. Only 128 numbers are stored, never the photo. Delete them after judging.</p>
      </div>
      <h2 className="text-2xl font-bold mb-3">Mock NADRA: CNIC photos</h2>
      <MockNadraLoader records={list} />
    </div>
  );
}

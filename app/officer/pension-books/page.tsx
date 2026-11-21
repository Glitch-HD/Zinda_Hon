import QRCode from "qrcode";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { makePensionBookQr } from "@/lib/qr";

// "Zainab Bibi pension PB-0001.png": letters, digits, spaces and dashes only, so it saves on any phone or PC.
function qrFileName(name: string, pensionNo: string) {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim();
  return `${clean(name) || "Pensioner"} pension ${clean(pensionNo)}.png`;
}

// Printable mock pension books with signed QR codes, plus one deliberately edited copy for the demo.
export default async function PensionBooks() {
  const user = await pageUser(["OFFICER"]);
  const ps = await prisma.pensioner.findMany({ where: { tenantId: user.tenantId }, orderBy: { pensionNo: "asc" } });
  const books = await Promise.all(ps.map(async (p) => {
    const text = makePensionBookQr({ pensionNo: p.pensionNo, name: p.name, cnic: p.cnicMock ?? "", monthlyAmount: p.monthlyAmount });
    // A larger copy with a white border for saving and printing.
    const file = await QRCode.toDataURL(text, { margin: 4, width: 600 });
    return { p, img: await QRCode.toDataURL(text, { margin: 1, width: 220 }), file, fileName: qrFileName(p.name, p.pensionNo) };
  }));
  const first = ps[0];
  const forgedText = first ? makePensionBookQr({ pensionNo: first.pensionNo, name: first.name, cnic: first.cnicMock ?? "", monthlyAmount: first.monthlyAmount }).replace(`|${first.monthlyAmount}|`, `|${first.monthlyAmount * 3}|`) : "";
  const forgedImg = first ? await QRCode.toDataURL(forgedText, { margin: 1, width: 220 }) : "";
  return (
    <div>
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <h2 className="text-xl font-bold mb-2">Mock pension books (signed QR codes)</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {first && (
          <div className="card" style={{ borderColor: "var(--danger)" }}>
            <p className="font-semibold" style={{ color: "var(--danger)" }}>DEMO: edited copy of {first.pensionNo}</p>
            <p className="text-sm muted">Amount changed to Rs {(first.monthlyAmount * 3).toLocaleString()}; the signature no longer matches.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={forgedImg} alt="Forged QR" width={220} height={220} />
          </div>
        )}
        {books.map(({ p, img, file, fileName }) => (
          <div key={p.id} className="card">
            <p className="font-semibold">{p.pensionNo} · {p.name} <span className="ur">{p.nameUr}</span></p>
            <p className="text-sm muted">CNIC {p.cnicMock ?? "(missing)"} · Rs {p.monthlyAmount.toLocaleString()} / month</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={`QR for ${p.pensionNo}`} width={220} height={220} />
            <a className="btn mt-2 inline-flex items-center justify-center" href={file} download={fileName}>Download QR / ڈاؤن لوڈ</a>
            <p className="text-xs muted mt-1">Saves as {fileName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

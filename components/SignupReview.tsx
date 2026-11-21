"use client";
import { useState } from "react";

// Officer: new sign-ups waiting for a check. Shows what the automatic checks found against the mock
// NADRA, death and pension records; the officer approves (the account is created) or rejects with a reason.

export type SignupRow = {
  id: string; role: string; name: string; cnic: string; phone: string; area: string | null; pensionNo: string | null; createdAt: string;
  details?: { pensionType?: string | null; husbandName?: string | null; husbandCnic?: string | null; husbandDeathDate?: string | null; deathCertNo?: string | null; shopName?: string; shopAddress?: string | null } | null;
  assistedBy?: { name: string; phone: string; relation: string } | null;
  checks: { spokenInUrdu?: boolean; pensionTypeMismatch?: boolean; pensionType?: string; husbandOnNadra?: string | null; husbandNadraSimilarity?: number | null; husbandOnPensionRecord?: string | null; husbandPensionSimilarity?: number | null; husbandDeathFound?: boolean; husbandDeathName?: string | null; husbandDeathDate?: string | null; husbandDeathDateMatches?: boolean | null; husbandDeathRegisteredAt?: string | null; nadraFound?: boolean; nadraName?: string | null; nameSimilarity?: number | null; dobMatches?: boolean | null; deathRecordFound?: boolean; pensionRecordName?: string; pensionNameSimilarity?: number; pensionCnicMatches?: boolean | null };
};

const ROLE: Record<string, string> = { PENSIONER: "👵🏽 Pensioner", HELPER: "🤝 Helper", SHOPKEEPER: "🏪 Shopkeeper" };

function Check({ ok, text }: { ok: boolean | null | undefined; text: string }) {
  return <li>{ok === true ? "✅" : ok === false ? "⛔" : "⚠️"} {text}</li>;
}

function Row({ r }: { r: SignupRow }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [state, setState] = useState<"open" | "approved" | "rejected">("open");
  const [busy, setBusy] = useState(false);
  const c = r.checks;
  const pct = (n?: number | null) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "n/a");
  async function decide(action: "approve" | "reject") {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/registrations/${r.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note }) });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not save");
      setState(action === "approve" ? "approved" : "rejected");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }
  if (state !== "open") return <div className="card text-sm">{state === "approved" ? "✅" : "❌"} {r.name}: sign-up {state}.{state === "approved" ? " They can log in now." : ""}</div>;
  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <b>{r.name}</b><span className="badge">{ROLE[r.role] ?? r.role}</span>
        <span className="muted text-sm">CNIC {r.cnic.replace(/^(\d{5})(\d{7})(\d)$/, "$1-$2-$3")} · {r.phone}{r.area ? ` · ${r.area}` : ""}{r.pensionNo ? ` · ${r.pensionNo}` : ""}</span>
      </div>
      {r.details?.shopName && <p className="text-sm">🏪 <b>{r.details.shopName}</b>{r.details.shopAddress ? `, ${r.details.shopAddress}` : ""}</p>}
      {r.details?.pensionType === "family" && (
        <p className="text-sm">🕊️ Widow&apos;s pension. Late husband: <b>{r.details.husbandName}</b>{r.details.husbandCnic ? `, CNIC ${r.details.husbandCnic.replace(/^(\d{5})(\d{7})(\d)$/, "$1-$2-$3")}` : ""}{r.details.husbandDeathDate ? `, died ${r.details.husbandDeathDate}` : ""}{r.details.deathCertNo ? `, death certificate ${r.details.deathCertNo}` : ", no death certificate number given"}</p>
      )}
      {r.assistedBy && <p className="text-sm" style={{ color: "var(--warn)" }}>🧑‍🤝‍🧑 Filled in for her by <b>{r.assistedBy.name}</b> ({r.assistedBy.relation}, {r.assistedBy.phone}). Confirm with her directly before approving.</p>}
      <ul className="text-sm space-y-1" style={{ listStyle: "none", padding: 0 }}>
        <Check ok={c.nadraFound} text={c.nadraFound ? `NADRA (mock) has this CNIC: "${c.nadraName}", name match ${pct(c.nameSimilarity)}` : "No NADRA (mock) record for this CNIC"} />
        {c.nadraFound && <Check ok={c.dobMatches} text={c.dobMatches === null || c.dobMatches === undefined ? "Date of birth not given" : c.dobMatches ? "Date of birth matches" : "Date of birth does not match"} />}
        <Check ok={!c.deathRecordFound} text={c.deathRecordFound ? "Death registry HAS a record for this CNIC: cannot approve" : "No death record for her own CNIC"} />
        {c.spokenInUrdu && <Check ok={null} text="Name was given in Urdu script: compare it with the records yourself" />}
        {c.pensionTypeMismatch && <Check ok={false} text={`She chose a different pension type than the record (${c.pensionType})`} />}
        {r.details?.pensionType === "family" && <>
          <Check ok={c.husbandNadraSimilarity == null ? null : c.husbandNadraSimilarity >= 0.8} text={`NADRA lists husband as "${c.husbandOnNadra ?? "nobody"}"${c.husbandNadraSimilarity != null ? `, match ${pct(c.husbandNadraSimilarity)}` : ""}`} />
          <Check ok={c.husbandDeathFound ? c.husbandDeathDateMatches !== false : false} text={c.husbandDeathFound ? `Death registry: ${c.husbandDeathName} died ${c.husbandDeathDate} (${c.husbandDeathRegisteredAt})${c.husbandDeathDateMatches === false ? ", but she gave a different date" : ""}` : "Death registry has NO record of her husband's death: see the original certificate"} />
        </>}
        {r.role === "PENSIONER" && <Check ok={c.pensionCnicMatches ?? null} text={`Pension record "${c.pensionRecordName}", name match ${pct(c.pensionNameSimilarity)}, CNIC ${c.pensionCnicMatches ? "matches" : c.pensionCnicMatches === false ? "does NOT match" : "not on file"}`} />}
      </ul>
      <textarea className="input" rows={2} placeholder="Your note: how you checked this person (needed if anything above is not ✅, or to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
      {msg && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{msg}</p>}
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-sm" disabled={busy || c.deathRecordFound} onClick={() => decide("approve")}>✅ Approve account</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => decide("reject")}>❌ Reject</button>
      </div>
    </div>
  );
}

export default function SignupReview({ rows }: { rows: SignupRow[] }) {
  return <div className="space-y-3">{rows.map((r) => <Row key={r.id} r={r} />)}</div>;
}

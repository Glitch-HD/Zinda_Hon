"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionHead } from "@/components/ui/Dash";

export type FamilyRow = { id: string; name: string; nameUr: string | null; pensionNo: string; area: string | null; active: boolean; hasAccount: boolean; caseId: string | null; caseStatus: string | null; helpers: { id: string; name: string }[] };
export type HelperRow = { id: string; name: string; area: string | null; families: number };
export type CorrectionRow = { id: string; pensioner: string; field: string; oldValue: string; newValue: string; status: string; highRisk: boolean; requestedBy: string; proposedBy: string | null; proposedByMe: boolean; createdAt: string };

const FIELD_LABEL: Record<string, string> = { name: "Name", fatherOrHusbandName: "Husband's / father's name", dateOfBirth: "Date of birth", cnicMock: "CNIC", bankAccountNo: "Bank account" };
const SHARE = [
  { id: "name", label: "Name" }, { id: "case_status", label: "Case status" }, { id: "face", label: "Face check" }, { id: "cnic", label: "CNIC" },
] as const;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not save");
  return d as { message?: string; pending?: boolean; created?: number };
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <p className="text-sm mt-1" role="status" style={{ color: m.ok ? "var(--ok)" : "var(--danger)" }}>{m.text}</p>;
}

function Correction({ c }: { c: CorrectionRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<{ ok: boolean; text: string } | null>(null);
  async function act(action: "accept" | "reject") {
    setBusy(true); setM(null);
    try {
      const d = await post(`/api/corrections/${c.id}`, { action, note });
      setM({ ok: true, text: d.message ?? (action === "accept" ? "Changed. She has been told." : "Rejected.") });
      router.refresh();
    } catch (e) { setM({ ok: false, text: e instanceof Error ? e.message : "Could not save" }); } finally { setBusy(false); }
  }
  return (
    <div className="card space-y-2" style={c.highRisk ? { borderInlineStartWidth: 4, borderInlineStartColor: "var(--accent)" } : undefined}>
      <div className="flex flex-wrap gap-2 items-center">
        <b>{c.pensioner}</b><span className="badge">{FIELD_LABEL[c.field] ?? c.field}</span>
        {c.highRisk && <span className="badge badge-warn">needs two officers</span>}
        {c.status === "awaiting_second" && <span className="badge badge-danger">proposed by {c.proposedBy}: waiting for a second officer</span>}
      </div>
      <p className="text-sm">From <b>{c.oldValue || "(empty)"}</b> to <b>{c.newValue}</b> · asked by {c.requestedBy} on {c.createdAt}</p>
      {c.proposedByMe ? <p className="text-sm muted">You proposed this. A different officer must confirm it.</p> : (
        <>
          <input className="input" placeholder="How you checked it (at least 10 characters), e.g. saw her new bank letter" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={busy} onClick={() => act("accept")}>{c.highRisk && c.status === "pending" ? "Propose change" : "Accept change"}</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("reject")}>Reject</button>
          </div>
        </>
      )}
      <Msg m={m} />
    </div>
  );
}

function Family({ r, helpers }: { r: FamilyRow; helpers: HelperRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helperId, setHelperId] = useState("");
  const [fields, setFields] = useState<string[]>(["name", "case_status", "face"]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setM(null);
    try { await fn(); setM({ ok: true, text: ok }); router.refresh(); } catch (e) { setM({ ok: false, text: e instanceof Error ? e.message : "Could not save" }); } finally { setBusy(false); }
  }
  const free = helpers.filter((h) => !r.helpers.some((x) => x.id === h.id));
  return (
    <tr>
      <td><b>{r.name}</b> {r.nameUr && <span className="ur">{r.nameUr}</span>}<div className="muted text-sm">{r.pensionNo}{r.area ? ` · ${r.area}` : ""}{r.hasAccount ? "" : " · no app account"}{!r.active ? " · not active" : ""}</div></td>
      <td>
        {r.caseId ? <Link className="badge" href={`/officer/case/${r.caseId}`}>{r.caseStatus?.replaceAll("_", " ").toLowerCase()}</Link>
          : r.active ? <button className="btn btn-sm" disabled={busy} onClick={() => run(() => post("/api/cases", { pensionerId: r.id }), "Case opened. She has been told proof is due.")}>Open case</button>
          : <span className="muted text-sm">none</span>}
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {r.helpers.map((h) => (
            <span key={h.id} className="badge">{h.name} <button className="ml-1" title={`Unlink ${h.name}`} aria-label={`Unlink ${h.name}`} disabled={busy} onClick={() => run(() => post("/api/helper-links", { action: "unlink", pensionerId: r.id, helperId: h.id, note: "Unlinked by officer" }), `${h.name} can no longer see this family.`)}>×</button></span>
          ))}
          {!r.helpers.length && <span className="muted text-sm">No helper</span>}
        </div>
        {free.length > 0 && !open && <button className="btn btn-ghost btn-sm mt-1" onClick={() => setOpen(true)}>Link a helper</button>}
        {open && (
          <div className="mt-2 space-y-2" style={{ minWidth: 260 }}>
            <select className="input" value={helperId} onChange={(e) => setHelperId(e.target.value)} aria-label="Helper">
              <option value="">Choose a helper…</option>
              {free.map((h) => <option key={h.id} value={h.id}>{h.name}{h.area ? ` (${h.area})` : ""} · {h.families}/40 families</option>)}
            </select>
            <fieldset className="text-sm flex flex-wrap gap-3"><legend className="muted">She agreed to share:</legend>
              {SHARE.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-1"><input type="checkbox" checked={fields.includes(s.id) || s.id === "case_status"} disabled={s.id === "case_status"} onChange={(e) => setFields((f) => e.target.checked ? [...f, s.id] : f.filter((x) => x !== s.id))} />{s.label}</label>
              ))}
            </fieldset>
            <input className="input" placeholder="How she agreed (at least 15 characters)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-sm" disabled={busy || !helperId} onClick={() => run(() => post("/api/helper-links", { action: "link", pensionerId: r.id, helperId, fields, note }).then(() => { setOpen(false); setNote(""); setHelperId(""); }), "Linked. She has been told and can take it back any time.")}>Link</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
        <Msg m={m} />
      </td>
    </tr>
  );
}

export default function FamiliesDesk({ rows, helpers, corrections, noCase, year }: { rows: FamilyRow[]; helpers: HelperRow[]; corrections: CorrectionRow[]; noCase: number; year: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [m, setM] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = rows.filter((r) => !q || `${r.name} ${r.nameUr ?? ""} ${r.pensionNo} ${r.area ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  async function openAll() {
    setBusy(true); setM(null);
    try { const d = await post("/api/cases", { all: true }); setM({ ok: true, text: `Opened ${d.created ?? 0} case(s) for ${year}.` }); router.refresh(); }
    catch (e) { setM({ ok: false, text: e instanceof Error ? e.message : "Could not save" }); } finally { setBusy(false); }
  }
  return (
    <>
      <SectionHead id="corrections" title="Correct-my-data requests" count={corrections.length} sub="Nothing changes until an officer accepts it. Bank account and CNIC changes need two different officers." />
      {corrections.length === 0 ? <div className="card muted text-center">No requests waiting.</div> : <div className="space-y-3">{corrections.map((c) => <Correction key={c.id} c={c} />)}</div>}

      <SectionHead id="families" title="Families" count={rows.length} sub={`Open this year's proof-of-life case, and link helpers. ${noCase} active pensioner(s) have no ${year} case yet.`} />
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name, pension no. or area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search families" />
        {noCase > 0 && <button className="btn btn-sm" disabled={busy} onClick={openAll}>Open {year} cases for all {noCase}</button>}
        <Msg m={m} />
      </div>
      <div className="card overflow-x-auto" style={{ padding: 8 }}>
        <table className="data">
          <thead><tr><th>Pensioner</th><th>{year} case</th><th>Helpers (with her permission)</th></tr></thead>
          <tbody>{shown.map((r) => <Family key={r.id} r={r} helpers={helpers} />)}</tbody>
        </table>
      </div>
    </>
  );
}

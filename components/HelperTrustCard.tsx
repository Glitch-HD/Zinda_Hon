import type { HelperTrust } from "@/lib/helper-trust";

const CLS = { good: "badge-ok", watch: "badge-warn", risky: "badge-danger" } as const;
const LABEL = { good: "Good record", watch: "Look a little closer", risky: "Check this case carefully" } as const;

// The trust record of the helper who sent this year's proof. It guides how closely an officer looks;
// it never approves or stops anything by itself.
export default function HelperTrustCard({ t, compact = false }: { t: HelperTrust; compact?: boolean }) {
  return (
    <div className={compact ? "" : "card card-soft mt-3"}>
      <p className="text-sm">🤝 {compact ? "" : <>Proof sent by helper <b>{t.name}</b>: </>}<span className={`badge ${CLS[t.level]}`}>Trust {t.score}/100 · {LABEL[t.level]}</span> <span className="muted">{t.families} families · {t.proofsThisYear} proofs this year</span></p>
      {t.points.length > 0 && <ul className="list-disc ms-5 text-sm mt-1">{t.points.map((p) => <li key={p.text}>{p.text}{p.delta ? `: ${p.delta > 0 ? "+" : ""}${p.delta}` : ""}</li>)}</ul>}
      {!compact && <p className="text-xs muted mt-1">Starts at 80. Goes down for stopped pensions, replayed selfies, refused bank or CNIC changes and withdrawn permission; up for passed spot checks.</p>}
    </div>
  );
}

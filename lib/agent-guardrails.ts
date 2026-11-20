import { z } from "zod";

// The officer's AI case assistant only ADVISES. These checks run on its report before an officer
// sees it, and they are plain code, not a prompt, so the model cannot talk its way past them.

export const AGENT_TOOLS = [
  "case_overview",
  "check_nadra",
  "check_death_registry",
  "check_bank_activity",
  "find_possible_duplicates",
  "past_years",
  "search_rulebook",
] as const;
export type AgentToolName = (typeof AGENT_TOOLS)[number];

/** The assistant must look at these before it may hand in a report. */
export const REQUIRED_TOOLS: AgentToolName[] = ["case_overview", "check_nadra", "check_death_registry", "check_bank_activity"];

export const RECOMMENDATIONS = ["approve", "ask_more_proof", "officer_review", "investigate_stop"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const AgentReport = z.object({
  recommendation: z.enum(RECOMMENDATIONS),
  confidence: z.number().min(0).max(1),
  headline: z.string().min(3).max(160),
  summary_en: z.string().min(3).max(800),
  summary_ur: z.string().min(1).max(600),
  findings: z
    .array(z.object({ severity: z.enum(["ok", "warning", "serious"]), text: z.string().min(3).max(260), source: z.enum(AGENT_TOOLS) }))
    .min(1)
    .max(8),
  questions_for_officer: z.array(z.string().max(200)).max(4),
  rules_cited: z.array(z.string().max(10)).max(4),
});
export type AgentReport = z.infer<typeof AgentReport>;

/** Hard facts read straight from the records by the tools (never from the model). */
export type CaseFacts = {
  deathRecord: boolean;
  bankActivityAfterDeath: boolean;
  cnicMismatch: boolean;
  duplicates: number;
  documentInvalid: boolean;
  livenessFailed: boolean;
  faceMismatch: boolean;
  overMaxAge: boolean;
  identityUnconfirmed: boolean;
  proofMissing: boolean;
};

export const NO_FACTS: CaseFacts = {
  deathRecord: false, bankActivityAfterDeath: false, cnicMismatch: false, duplicates: 0, documentInvalid: false,
  livenessFailed: false, faceMismatch: false, overMaxAge: false, identityUnconfirmed: false, proofMissing: false,
};

/** Facts that must never be waved through, with the tool that found them and a plain sentence. */
export function seriousFacts(f: CaseFacts): { key: keyof CaseFacts; source: AgentToolName; text: string }[] {
  const out: { key: keyof CaseFacts; source: AgentToolName; text: string }[] = [];
  if (f.deathRecord) out.push({ key: "deathRecord", source: "check_death_registry", text: "The mock death registry has a record for this CNIC." });
  if (f.bankActivityAfterDeath) out.push({ key: "bankActivityAfterDeath", source: "check_bank_activity", text: "The bank account was used after the recorded date of death." });
  if (f.cnicMismatch) out.push({ key: "cnicMismatch", source: "check_nadra", text: "The CNIC in the pension record does not match NADRA." });
  if (f.duplicates > 0) out.push({ key: "duplicates", source: "find_possible_duplicates", text: `${f.duplicates} other pension record(s) look like the same person.` });
  if (f.documentInvalid) out.push({ key: "documentInvalid", source: "case_overview", text: "The pension book QR failed its signature check or its details do not match." });
  if (f.livenessFailed) out.push({ key: "livenessFailed", source: "case_overview", text: "The liveness check (blink / head turn) was not passed." });
  if (f.faceMismatch) out.push({ key: "faceMismatch", source: "case_overview", text: "The selfie does not match the enrolled face." });
  if (f.overMaxAge) out.push({ key: "overMaxAge", source: "case_overview", text: "The pensioner is older than the rule's age flag." });
  if (f.proofMissing) out.push({ key: "proofMissing", source: "case_overview", text: "This year's proof of life (selfie and liveness) has not been given yet." });
  if (f.identityUnconfirmed) out.push({ key: "identityUnconfirmed", source: "check_nadra", text: "No NADRA record could be matched with confidence." });
  return out;
}

export type GuardrailNote = { rule: string; detail: string };

/**
 * Applies the safety rules to the assistant's report:
 * 1. Findings must come from a tool the assistant actually called (no invented evidence).
 * 2. A serious fact from the records is always in the report, even if the model left it out.
 * 3. "Approve" is never shown while a serious fact is open: it becomes "officer_review", and the
 *    model's approving headline and summary are replaced by the facts.
 * 4. Confidence cannot be high while serious facts are open.
 * The assistant never acts: whatever it recommends, the officer decides.
 */
export function applyGuardrails(report: AgentReport, facts: CaseFacts, called: Set<string>): { report: AgentReport; notes: GuardrailNote[] } {
  const notes: GuardrailNote[] = [];
  const r: AgentReport = { ...report, findings: [...report.findings], questions_for_officer: [...report.questions_for_officer], rules_cited: [...report.rules_cited] };

  const before = r.findings.length;
  r.findings = r.findings.filter((f) => called.has(f.source));
  if (r.findings.length < before) notes.push({ rule: "evidence_only", detail: `${before - r.findings.length} finding(s) removed because they cited a check the assistant never ran.` });

  const serious = seriousFacts(facts).filter((s) => called.has(s.source));
  for (const s of serious) {
    const mentioned = r.findings.some((f) => f.source === s.source && f.severity !== "ok");
    if (!mentioned) {
      r.findings.unshift({ severity: "serious", text: `${s.text} (added by safety check)`, source: s.source });
      notes.push({ rule: "serious_fact_added", detail: `Added a finding the assistant left out: ${s.text}` });
    }
  }
  if (r.findings.length > 8) r.findings = r.findings.slice(0, 8);

  if (serious.length > 0 && r.recommendation === "approve") {
    // The model's own words were written for "approve", so they would mislead next to the corrected
    // suggestion. Replace them with the plain facts; the officer still sees what was overruled.
    r.recommendation = "officer_review";
    r.headline = `${serious.length} serious issue(s) found. The assistant's "approve" was overruled.`;
    r.summary_en = `Safety check: ${serious.map((s) => s.text).join(" ")} The assistant had suggested approving; an officer must look at this case.`.slice(0, 800);
    r.summary_ur = "حفاظتی جانچ: ریکارڈ میں سنگین مسئلہ ملا ہے۔ اے آئی نے منظوری کی تجویز دی تھی، مگر افسر کو خود دیکھنا ہوگا۔";
    notes.push({ rule: "no_approve_with_open_risk", detail: "The assistant suggested approving, but a serious fact is open, so the suggestion was changed to officer review." });
  }
  if (serious.length > 0 && r.confidence > 0.6 && r.recommendation !== "investigate_stop") {
    r.confidence = 0.6;
    notes.push({ rule: "confidence_capped", detail: "Confidence capped at 60% because a serious fact is open." });
  }
  r.rules_cited = r.rules_cited.filter((id) => /^R\d{1,2}$/.test(id));
  return { report: r, notes };
}

/** The report used when no AI is available or the AI could not finish: built from the facts by fixed rules. */
export function checklistReport(facts: CaseFacts, called: Set<string>, reason: string): AgentReport {
  const serious = seriousFacts(facts).filter((s) => called.has(s.source));
  const death = facts.deathRecord || facts.bankActivityAfterDeath;
  const proofIssue = facts.livenessFailed || facts.faceMismatch || facts.documentInvalid || facts.proofMissing;
  const recommendation: Recommendation = death ? "investigate_stop" : serious.length === 0 ? "approve" : proofIssue && serious.length === 1 ? "ask_more_proof" : "officer_review";
  const findings: AgentReport["findings"] = serious.length
    ? serious.map((s) => ({ severity: "serious" as const, text: s.text, source: s.source }))
    : [{ severity: "ok", text: "No death record, no duplicate, identity and bank records agree.", source: "check_nadra" }];
  const head = death ? "Possible death: verify before any payment." : serious.length ? `${serious.length} issue(s) need an officer.` : "Records agree; nothing found against this pensioner.";
  return {
    recommendation,
    confidence: serious.length ? 0.5 : 0.9,
    headline: head,
    summary_en: `${reason} The fixed checklist ran ${called.size} check(s). ${serious.length ? serious.map((s) => s.text).join(" ") : "All records agree."}`.slice(0, 800),
    summary_ur: death ? "ریکارڈ میں وفات کا اندراج ہے۔ ادائیگی سے پہلے تصدیق کریں۔" : serious.length ? "کچھ باتیں افسر کو خود دیکھنی ہوں گی۔" : "ریکارڈ درست ہیں، کوئی مسئلہ نہیں ملا۔",
    findings: findings.slice(0, 8),
    questions_for_officer: death ? ["Can a helper or the union council confirm the person is alive?"] : [],
    rules_cited: death ? ["R4"] : [],
  };
}

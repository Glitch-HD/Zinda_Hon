import { describe, expect, it } from "vitest";
import { AgentReport, NO_FACTS, REQUIRED_TOOLS, applyGuardrails, checklistReport, seriousFacts, type CaseFacts } from "@/lib/agent-guardrails";

const allChecks = new Set<string>([...REQUIRED_TOOLS, "find_possible_duplicates", "past_years"]);
const clean: AgentReport = {
  recommendation: "approve",
  confidence: 0.95,
  headline: "Everything agrees",
  summary_en: "All records agree.",
  summary_ur: "سب ٹھیک ہے",
  findings: [{ severity: "ok", text: "NADRA agrees with the pension record.", source: "check_nadra" }],
  questions_for_officer: [],
  rules_cited: ["R2"],
};
const dead: CaseFacts = { ...NO_FACTS, deathRecord: true, bankActivityAfterDeath: true };

describe("applyGuardrails", () => {
  it("leaves a clean report on a clean case alone", () => {
    const { report, notes } = applyGuardrails(clean, NO_FACTS, allChecks);
    expect(report).toEqual(clean);
    expect(notes).toEqual([]);
  });

  it("never lets 'approve' through when the death registry has a record", () => {
    const { report, notes } = applyGuardrails(clean, dead, allChecks);
    expect(report.recommendation).toBe("officer_review");
    expect(report.headline).toMatch(/overruled/);
    expect(report.summary_en).toMatch(/death/);
    expect(AgentReport.safeParse(report).success).toBe(true);
    expect(report.confidence).toBeLessThanOrEqual(0.6);
    expect(report.findings.filter((f) => f.severity === "serious").map((f) => f.source)).toEqual(expect.arrayContaining(["check_death_registry", "check_bank_activity"]));
    expect(notes.map((n) => n.rule)).toEqual(expect.arrayContaining(["serious_fact_added", "no_approve_with_open_risk", "confidence_capped"]));
  });

  it("removes findings that cite a check the assistant never ran", () => {
    const invented: AgentReport = { ...clean, findings: [...clean.findings, { severity: "serious", text: "Made-up duplicate", source: "find_possible_duplicates" }] };
    const { report, notes } = applyGuardrails(invented, NO_FACTS, new Set(REQUIRED_TOOLS));
    expect(report.findings.some((f) => f.source === "find_possible_duplicates")).toBe(false);
    expect(notes[0].rule).toBe("evidence_only");
  });

  it("does not add a finding the model already reported itself", () => {
    const honest: AgentReport = { ...clean, recommendation: "investigate_stop", confidence: 0.9, findings: [
      { severity: "serious", text: "Death record found.", source: "check_death_registry" },
      { severity: "serious", text: "Money moved after death.", source: "check_bank_activity" },
    ] };
    const { report, notes } = applyGuardrails(honest, dead, allChecks);
    expect(report.findings).toHaveLength(2);
    expect(report.recommendation).toBe("investigate_stop");
    expect(report.confidence).toBe(0.9); // a strong "investigate" is allowed to stay confident
    expect(notes).toEqual([]);
  });

  it("keeps at most 8 findings and only rulebook ids like R4", () => {
    const many: AgentReport = { ...clean, recommendation: "officer_review", rules_cited: ["R4", "DROP TABLE", "R12x"], findings: Array.from({ length: 8 }, () => ({ severity: "warning" as const, text: "something odd", source: "past_years" as const })) };
    const { report } = applyGuardrails(many, { ...NO_FACTS, faceMismatch: true }, allChecks);
    expect(report.findings).toHaveLength(8);
    expect(report.findings[0].source).toBe("case_overview");
    expect(report.rules_cited).toEqual(["R4"]);
  });

  it("does not mutate the report it was given", () => {
    const copy = structuredClone(clean);
    applyGuardrails(clean, dead, allChecks);
    expect(clean).toEqual(copy);
  });
});

describe("checklistReport", () => {
  it("approves only a fully clean case", () => {
    const r = checklistReport(NO_FACTS, allChecks, "No AI.");
    expect(AgentReport.parse(r).recommendation).toBe("approve");
  });
  it("says investigate for a possible death", () => {
    const r = checklistReport(dead, allChecks, "No AI.");
    expect(r.recommendation).toBe("investigate_stop");
    expect(r.rules_cited).toContain("R4");
    expect(AgentReport.safeParse(r).success).toBe(true);
  });
  it("asks for more proof when only the proof itself was weak", () => {
    expect(checklistReport({ ...NO_FACTS, livenessFailed: true }, allChecks, "").recommendation).toBe("ask_more_proof");
  });
  it("never approves before this year's proof is given", () => {
    expect(checklistReport({ ...NO_FACTS, proofMissing: true }, allChecks, "").recommendation).toBe("ask_more_proof");
    expect(applyGuardrails(clean, { ...NO_FACTS, proofMissing: true }, allChecks).report.recommendation).toBe("officer_review");
  });
  it("sends mixed problems to the officer", () => {
    expect(checklistReport({ ...NO_FACTS, faceMismatch: true, duplicates: 1 }, allChecks, "").recommendation).toBe("officer_review");
  });
  it("its own output always passes the guardrails untouched", () => {
    for (const f of [NO_FACTS, dead, { ...NO_FACTS, cnicMismatch: true }, { ...NO_FACTS, overMaxAge: true, documentInvalid: true }]) {
      const r = checklistReport(f, allChecks, "x");
      expect(applyGuardrails(r, f, allChecks).notes).toEqual([]);
    }
  });
});

describe("seriousFacts", () => {
  it("lists nothing for a clean case", () => expect(seriousFacts(NO_FACTS)).toEqual([]));
  it("counts duplicates in the sentence", () => expect(seriousFacts({ ...NO_FACTS, duplicates: 2 })[0].text).toMatch(/^2 other/));
});

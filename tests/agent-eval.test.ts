import { describe, expect, it } from "vitest";
import { AGENT_EVAL_CASES, scoreAgentCase } from "@/lib/agent-eval";
import { NO_FACTS, type AgentReport } from "@/lib/agent-guardrails";

const rep = (recommendation: AgentReport["recommendation"], findings: AgentReport["findings"] = [{ severity: "ok", text: "fine", source: "check_nadra" }]): AgentReport => ({
  recommendation, confidence: 0.8, headline: "x x x", summary_en: "x x x", summary_ur: "x", findings, questions_for_officer: [], rules_cited: [],
});
const death = AGENT_EVAL_CASES.find((c) => c.planted === "deathRecord")!;
const clean = AGENT_EVAL_CASES.find((c) => c.pensionNo === "PEN-K-1009")!;

describe("scoreAgentCase", () => {
  it("credits the assistant only when it named the planted problem itself", () => {
    const found = rep("investigate_stop", [{ severity: "serious", text: "dead", source: "check_death_registry" }]);
    expect(scoreAgentCase(death, found, found, [], { ...NO_FACTS, deathRecord: true }).foundItself).toBe(true);
    const missed = rep("approve");
    const s = scoreAgentCase(death, missed, rep("officer_review"), [{ rule: "serious_fact_added", detail: "" }], { ...NO_FACTS, deathRecord: true });
    expect(s).toMatchObject({ foundItself: false, safeRaw: false, safeFinal: true, corrected: true });
  });
  it("does not accept 'approve' on a clean case before this year's proof is given", () => {
    expect(scoreAgentCase(clean, rep("approve"), rep("approve"), [], { ...NO_FACTS, proofMissing: true }).safeRaw).toBe(false);
    expect(scoreAgentCase(clean, rep("approve"), rep("approve"), [], NO_FACTS).safeRaw).toBe(true);
  });
  it("counts 'investigate' on a clean case as a false alarm", () => {
    expect(scoreAgentCase(clean, rep("investigate_stop"), rep("investigate_stop"), [], NO_FACTS)).toMatchObject({ falseAlarm: true, safeFinal: false, foundItself: null });
  });
  it("has unique cases and both kinds", () => {
    expect(new Set(AGENT_EVAL_CASES.map((c) => c.pensionNo)).size).toBe(AGENT_EVAL_CASES.length);
    expect(AGENT_EVAL_CASES.some((c) => c.planted) && AGENT_EVAL_CASES.some((c) => !c.planted)).toBe(true);
  });
});

import { EVAL_MESSAGES } from "@/data/eval-messages";
describe("scam test set", () => {
  it("has about 100 messages, both labels, all three ways of writing, no duplicates", () => {
    expect(EVAL_MESSAGES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(EVAL_MESSAGES.map((m) => m.text)).size).toBe(EVAL_MESSAGES.length);
    for (const l of ["scam", "genuine"]) expect(EVAL_MESSAGES.filter((m) => m.label === l).length).toBeGreaterThan(40);
    for (const l of ["en", "ur", "roman"]) expect(EVAL_MESSAGES.filter((m) => m.lang === l).length).toBeGreaterThan(20);
  });
  it("uses only mock phone numbers (0300000xxxx) and the mock short codes", () => {
    for (const m of EVAL_MESSAGES) {
      expect(m.sender ?? "8XXX").toMatch(/^(8XXX|8YYY|0300000\d{4})$/);
      for (const num of m.text.match(/\b03\d{9}\b/g) ?? []) expect(num).toMatch(/^0300000\d{4}$/);
    }
  });
});

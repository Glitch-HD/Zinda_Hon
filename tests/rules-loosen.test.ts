import { describe, expect, it } from "vitest";
import { loosenings } from "@/lib/rules";
import { DEFAULT_RULE_CONFIG } from "@/lib/decision";

const c = () => structuredClone(DEFAULT_RULE_CONFIG);

describe("four-eyes rule: which changes are looser", () => {
  it("no change and stricter changes are not looser", () => {
    expect(loosenings(c(), c())).toEqual([]);
    const s = c(); s.face.strictDistance = 0.35; s.anomaly.maxAgeYears = 95; s.costs.wrongApprovalPkr = 500000; s.maxAttempts = 1;
    expect(loosenings(c(), s)).toEqual([]);
  });
  it("catches each looser change", () => {
    const l = c(); l.face.strictDistance = 0.5; l.costs.wrongApprovalPkr = 100000; l.document.required = false; l.anomaly.maxAgeYears = 120; l.identity.autoMinSimilarity = 0.8;
    const out = loosenings(c(), l);
    expect(out.length).toBe(5);
    expect(out.join(" ")).toMatch(/Face distance for auto-approve/);
    expect(out.join(" ")).toMatch(/Confidence needed/);
    expect(out.join(" ")).toMatch(/Pension book no longer required/);
  });
  it("a higher review cost lowers the bar, so it is looser", () => {
    const l = c(); l.costs.humanReviewPkr = 20000;
    expect(loosenings(c(), l)[0]).toMatch(/Confidence needed/);
  });
});

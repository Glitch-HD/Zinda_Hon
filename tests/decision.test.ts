import { describe, expect, it } from "vitest";
import { decide, DEFAULT_RULE_CONFIG, requiredConfidence, type DecisionInputs } from "@/lib/decision";

const strong: DecisionInputs = {
  face: { distance: 0.3, attempts: 1 },
  liveness: { passed: true, attempts: 1 },
  document: { qrValid: true, fieldsMatch: true, attempts: 1 },
  identity: { nameSimilarity: 0.97, cnicMatch: true, dobMatch: true, duplicateRecords: 0 },
  deathRecordFound: false,
  ageYears: 74,
  anomalies: [],
};

describe("requiredConfidence", () => {
  it("is 1 - review cost / wrong approval cost", () => {
    expect(requiredConfidence(DEFAULT_RULE_CONFIG)).toBeCloseTo(1 - 2000 / 360000, 6);
  });
});

describe("decide", () => {
  it("approves only when every check is strong", () => {
    const r = decide(strong);
    expect(r.outcome).toBe("APPROVE");
    expect(r.confidence).toBeGreaterThanOrEqual(r.requiredConfidence);
  });

  it("never approves and sends to officer when a death record exists", () => {
    const r = decide({ ...strong, deathRecordFound: true });
    expect(r.outcome).toBe("SEND_TO_OFFICER");
    expect(r.redFlags).toContain("death_record_found");
  });

  it("asks for a new selfie when the face match is uncertain on the first try", () => {
    const r = decide({ ...strong, face: { distance: 0.5, attempts: 1 } });
    expect(r.outcome).toBe("ASK_MORE_PROOF");
    expect(r.askFor).toContain("selfie");
  });

  it("hands over to a human after repeated uncertain face matches", () => {
    const r = decide({ ...strong, face: { distance: 0.5, attempts: 2 } });
    expect(r.outcome).toBe("SEND_TO_OFFICER");
  });

  it("flags an edited pension book straight to the officer", () => {
    const r = decide({ ...strong, document: { qrValid: true, fieldsMatch: false, attempts: 1 } });
    expect(r.outcome).toBe("SEND_TO_OFFICER");
    expect(r.redFlags).toContain("document_fields_edited");
  });

  it("sends duplicate people to a human instead of guessing", () => {
    const r = decide({ ...strong, identity: { ...strong.identity, duplicateRecords: 1 } });
    expect(r.outcome).toBe("SEND_TO_OFFICER");
  });

  it("asks for voice confirmation when names differ slightly", () => {
    const r = decide({ ...strong, identity: { ...strong.identity, nameSimilarity: 0.85 } });
    expect(r.outcome).toBe("ASK_MORE_PROOF");
    expect(r.askFor).toContain("name_confirm");
  });

  it("flags ghost-pension age anomalies", () => {
    const r = decide({ ...strong, ageYears: 104 });
    expect(r.outcome).toBe("SEND_TO_OFFICER");
  });

  it("follows a stricter admin rule immediately (no code change)", () => {
    const strict = { ...DEFAULT_RULE_CONFIG, costs: { wrongApprovalPkr: 360000, humanReviewPkr: 100 } };
    expect(decide(strong, strict).outcome).toBe("SEND_TO_OFFICER");
  });

  it("never returns a stop/reject outcome", () => {
    const worst = decide({ ...strong, deathRecordFound: true, face: { distance: 0.9, attempts: 2 }, liveness: { passed: false, attempts: 2 } });
    expect(["APPROVE", "ASK_MORE_PROOF", "SEND_TO_OFFICER"]).toContain(worst.outcome);
    expect(worst.outcome).toBe("SEND_TO_OFFICER");
  });
});

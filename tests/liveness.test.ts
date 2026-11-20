import { describe, expect, it, beforeAll } from "vitest";
import { followedSequence, issueTicket, randomSequence, verifyTicket } from "@/lib/liveness";

beforeAll(() => { process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123"; });

describe("server-issued liveness ticket", () => {
  it("always asks for a blink and a head turn, never the same move twice", () => {
    for (let i = 0; i < 200; i++) {
      const s = randomSequence();
      expect(s.length === 2 || s.length === 3).toBe(true);
      expect(s).toContain("blink");
      expect(s.some((a) => a.startsWith("turn_"))).toBe(true);
      expect(new Set(s).size).toBe(s.length);
    }
  });
  it("verifies a fresh ticket for the right case", () => {
    const t = issueTicket("case1");
    const v = verifyTicket(t.token, "case1");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.sequence).toEqual(t.sequence);
  });
  it("refuses another case, a changed ticket, an old ticket and no ticket", () => {
    const t = issueTicket("case1");
    expect(verifyTicket(t.token, "case2")).toEqual({ ok: false, reason: "other_case" });
    const [p, sig] = t.token.split(".");
    const data = JSON.parse(Buffer.from(p, "base64url").toString());
    data.s = ["blink", "turn_left"];
    expect(verifyTicket(`${Buffer.from(JSON.stringify(data)).toString("base64url")}.${sig}`, "case1")).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyTicket(issueTicket("case1", Date.now() - 25 * 3600_000).token, "case1")).toEqual({ ok: false, reason: "expired" });
    expect(verifyTicket(undefined, "case1")).toEqual({ ok: false, reason: "missing" });
  });
  it("needs the exact order", () => {
    expect(followedSequence(["turn_left", "blink"], [{ action: "turn_left" }, { action: "blink" }])).toBe(true);
    expect(followedSequence(["turn_left", "blink"], [{ action: "blink" }, { action: "turn_left" }])).toBe(false);
    expect(followedSequence(["turn_left", "blink", "turn_right"], [{ action: "turn_left" }, { action: "blink" }])).toBe(false);
  });
});

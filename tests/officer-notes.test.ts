import { describe, expect, it } from "vitest";
import { ownWords } from "@/lib/officer-notes";

describe("officer's own words", () => {
  it("drops text pasted from the AI assistant", () => {
    const ai = "AI case assistant (openai/gpt-oss-120b): investigate before paying, 95% sure.\nAI: Death record found and the bank account is still in use after the death date.\n- A death record matches this CNIC\n- Bank account used after the death\nI checked these points myself before deciding.";
    expect(ownWords(ai)).toBe("");
  });
  it("keeps what the officer wrote", () => {
    const note = "AI case assistant (x): investigate.\n- death record\nVisited her home on 21 Nov; she is alive, the registry entry is a namesake.";
    expect(ownWords(note)).toBe("Visited her home on 21 Nov; she is alive, the registry entry is a namesake.");
  });
});

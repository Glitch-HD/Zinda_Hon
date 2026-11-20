import { describe, expect, it } from "vitest";
import { nameSimilarity, normalizeName, normalizeCnic } from "@/lib/names";

describe("normalizeName", () => {
  it("treats common spellings of Muhammad as the same", () => {
    for (const v of ["Muhammad", "Mohammad", "Muhammed", "Mohd", "MOHAMMED"]) {
      expect(normalizeName(v)).toBe("muhammad");
    }
  });
  it("drops honorifics and punctuation", () => {
    expect(normalizeName("Mrs. Fatimah Bibi")).toBe("fatima bibi");
  });
  it("handles empty input without crashing", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
  });
});

describe("nameSimilarity", () => {
  it("scores spelling variants of the same person highly", () => {
    expect(nameSimilarity("Mohammad Rafeeq", "Muhammad Rafiq")).toBe(1);
    expect(nameSimilarity("Fatima Bibi", "Bibi Fatimah")).toBeGreaterThanOrEqual(0.92);
  });
  it("keeps different people apart", () => {
    expect(nameSimilarity("Zainab Khatoon", "Ayesha Begum")).toBeLessThan(0.8);
    expect(nameSimilarity("Muhammad Aslam", "Muhammad Akram")).toBeLessThan(0.97);
  });
  it("returns 0 when a name is missing", () => {
    expect(nameSimilarity(null, "Ali")).toBe(0);
  });
});

describe("normalizeCnic", () => {
  it("accepts dashed and plain 13-digit numbers", () => {
    expect(normalizeCnic("00000-0000001-1")).toBe("0000000000011");
  });
  it("rejects wrong lengths", () => {
    expect(normalizeCnic("12345")).toBeNull();
  });
});

import { spokenDigits, matchCommand } from "../lib/client/listen";
describe("voice input", () => {
  it("reads a spoken PIN in Urdu words, digits, Urdu numerals and Roman Urdu", () => {
    expect(spokenDigits("ایک دو تین چار")).toBe("1234");
    expect(spokenDigits("1 2 3 4")).toBe("1234");
    expect(spokenDigits("۱۲۳۴۔")).toBe("1234");
    expect(spokenDigits("ek do teen char")).toBe("1234");
  });
  it("matches a spoken command", () => {
    const cmds = [{ id: "start", words: ["شروع", "start"] }, { id: "message", words: ["پیغام", "message"] }];
    expect(matchCommand("مجھے پیغام چیک کرنا ہے", cmds)).toBe("message");
    expect(matchCommand("شروع کریں", cmds)).toBe("start");
    expect(matchCommand("کچھ اور", cmds)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { pkt, pktDate, pktDay, pktTime } from "../lib/time";

describe("times are shown in Pakistan time", () => {
  const d = new Date("2026-11-22T10:47:52Z");
  it("adds 5 hours to UTC", () => {
    expect(pkt(d)).toBe("2026-11-22 15:47");
    expect(pkt(d, true)).toBe("2026-11-22 15:47:52");
    expect(pktTime(d)).toBe("15:47");
  });
  it("rolls over to the next day after 7 PM UTC", () => {
    const late = new Date("2026-11-22T20:30:00Z");
    expect(pktDay(late)).toBe("2026-11-23");
    expect(pktDate(late)).toBe("23 Nov 2026");
  });
});

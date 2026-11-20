import { describe, expect, it, beforeAll } from "vitest";
import { makePensionBookQr, verifyPensionBookQr } from "@/lib/qr";

beforeAll(() => { process.env.QR_SIGNING_SECRET = "test-secret-test-secret-test-secret-1234"; });

const book = { pensionNo: "PEN-K-1001", name: "Zainab Bibi", cnic: "00000-1000001-2", monthlyAmount: 30000 };

describe("pension book QR", () => {
  it("accepts an untouched QR", () => {
    const r = verifyPensionBookQr(makePensionBookQr(book));
    expect(r).toMatchObject({ readable: true, signatureValid: true });
  });
  it("catches an edited amount", () => {
    const forged = makePensionBookQr(book).replace("|30000|", "|90000|");
    expect(verifyPensionBookQr(forged)).toMatchObject({ readable: true, signatureValid: false });
  });
  it("treats an unreadable scan as unreadable, not as forged", () => {
    expect(verifyPensionBookQr("")).toEqual({ readable: false });
  });
});

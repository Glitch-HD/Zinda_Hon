// MOCK pension rulebook written for this prototype. It is NOT real Pakistani pension law.
export const RULEBOOK: { id: string; title: string; text: string }[] = [
  { id: "R1", title: "Who must give proof-of-life", text: "Every pensioner receiving a self or family pension from the mock pension office must give proof-of-life once every calendar year, between 1 November and 31 December." },
  { id: "R2", title: "How to give proof-of-life", text: "Proof-of-life can be given in the Zinda Hoon app with a selfie, a liveness check and a scan of the pension book QR code, or in person at the pension office. A community helper may assist, if the pensioner has given the helper permission." },
  { id: "R3", title: "What happens if proof-of-life is late", text: "If proof-of-life is not given by 31 December, the pension office sends a reminder and a helper visit. Payment is held, not cancelled, for up to 90 days. Held amounts are paid in full once proof-of-life is accepted." },
  { id: "R4", title: "Who decides", text: "The app may approve proof-of-life on its own only when all checks pass strongly. It never stops a pension. Only a pension officer can stop a pension, and must write a reason. The pensioner can ask for the decision to be checked again." },
  { id: "R5", title: "Family pension for widows", text: "A widow receives a family pension after her husband's death. In this mock program the family pension continues for life. The widow must give proof-of-life every year like any other pensioner." },
  { id: "R6", title: "The office never asks for these", text: "The pension office never asks for a PIN, OTP, password, or a photo of your CNIC by SMS, WhatsApp or phone call. The office never asks you to pay a fee to release your pension. Any such message is a scam and should be reported." },
  { id: "R7", title: "Your data and permission", text: "You can see who has your data, change what is shared, and withdraw permission at any time in the My data screen. The pension office keeps your bank account to pay you. You can ask to correct wrong data; an officer checks the request." },
  { id: "R8", title: "Pension book", text: "Each pensioner has a pension book with a QR code. The QR code is digitally signed. If the details in the book are changed, the app will notice. Keep your pension book safe and do not give it to anyone who asks for it by phone." },
];

export function searchRulebook(question: string, k = 3) {
  const words = question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2);
  const scored = RULEBOOK.map((s) => {
    const hay = `${s.title} ${s.text}`.toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0);
    return { s, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score > 0).slice(0, k).map((x) => x.s);
  // Urdu questions rarely share words with the English rulebook, so fall back to the most general sections.
  return top.length ? top : RULEBOOK.filter((s) => ["R1", "R2", "R4"].includes(s.id));
}

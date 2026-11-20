import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Server-issued liveness challenge. The SERVER picks the random order of movements (blink, turn left,
// turn right) and signs it, together with the case and a one-time number. The phone must do exactly
// that order, and must send the signed ticket back with the result. So a script cannot just say
// "passed", cannot pick an easy order, and cannot replay an old passed result: each ticket works once.
// Tickets last 24 hours so a pensioner with no signal can do the check offline and send it later.

export type LiveAction = "blink" | "turn_left" | "turn_right";
export type LivenessTicket = { token: string; sequence: LiveAction[]; expiresAt: string };

const VALID_MS = 24 * 3600_000;
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function key() {
  const s = process.env.LIVENESS_SECRET || process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return `liveness:${s}`;
}
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

/** Random order: always a blink and a head turn; half the time the other turn as well. */
export function randomSequence(rand: () => number = () => randomBytes(4).readUInt32BE() / 2 ** 32): LiveAction[] {
  const turns: LiveAction[] = rand() < 0.5 ? ["turn_left", "turn_right"] : ["turn_right", "turn_left"];
  const list: LiveAction[] = rand() < 0.5 ? ["blink", turns[0], turns[1]] : ["blink", turns[0]];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

export function issueTicket(caseId: string, now = Date.now()): LivenessTicket {
  const sequence = randomSequence();
  const e = now + VALID_MS;
  const payload = b64(JSON.stringify({ c: caseId, s: sequence, n: randomBytes(12).toString("hex"), e }));
  return { token: `${payload}.${sign(payload)}`, sequence, expiresAt: new Date(e).toISOString() };
}

export type TicketCheck = { ok: true; caseId: string; sequence: LiveAction[]; nonce: string } | { ok: false; reason: "missing" | "bad_signature" | "expired" | "other_case" | "malformed" };

export function verifyTicket(token: string | null | undefined, caseId: string, now = Date.now()): TicketCheck {
  if (!token) return { ok: false, reason: "missing" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, reason: "malformed" };
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "bad_signature" };
  let data: { c?: string; s?: LiveAction[]; n?: string; e?: number };
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return { ok: false, reason: "malformed" }; }
  if (!data.c || !Array.isArray(data.s) || !data.n || typeof data.e !== "number") return { ok: false, reason: "malformed" };
  if (data.c !== caseId) return { ok: false, reason: "other_case" };
  if (now > data.e) return { ok: false, reason: "expired" };
  return { ok: true, caseId: data.c, sequence: data.s, nonce: data.n };
}

/** True when the phone did exactly the movements the server asked for, in the same order. */
export function followedSequence(sequence: LiveAction[], done: { action: string }[]) {
  return done.length === sequence.length && sequence.every((a, i) => done[i].action === a);
}

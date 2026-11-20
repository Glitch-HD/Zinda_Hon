import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { HttpError } from "./auth";

// Login for pensioners who cannot read or type. Two steps, no typing:
//   1. Scan the signed QR on their own pension book (something they have).
//   2. Look at the camera with a liveness check (something they are), or enter a 4-digit PIN as backup.
// Step 1 leaves a short-lived "half logged in" cookie. It is signed with a DIFFERENT key from the
// session cookie, so it can never be used as a session on its own.

const COOKIE = "zh_plogin";
const MINUTES = 10;

function key() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(`${s}:pensioner-login-step`);
}

export async function startPensionerLogin(userId: string, pensionerId: string) {
  const token = await new SignJWT({ pid: pensionerId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MINUTES}m`)
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/pensioner", maxAge: MINUTES * 60 });
}

/** Returns the pensioner and user from step 1, or throws if the book was not scanned (or it expired). */
export async function readPensionerLogin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) throw new HttpError(401, "Please scan your pension book first");
  try {
    const { payload } = await jwtVerify(token, key());
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
    const pensioner = await prisma.pensioner.findUnique({ where: { id: String(payload.pid) } });
    if (!user || !user.active || !pensioner || pensioner.userId !== user.id) throw new Error("mismatch");
    return { user, pensioner };
  } catch {
    throw new HttpError(401, "Please scan your pension book again");
  }
}

export async function endPensionerLogin() {
  const jar = await cookies();
  jar.set(COOKIE, "", { path: "/api/auth/pensioner", maxAge: 0 });
}

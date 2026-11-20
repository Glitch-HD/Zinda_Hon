import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

// Secure login with role-based access control, enforced on the server for every request.
// The token lives in an httpOnly cookie so page scripts cannot read it.

export const SESSION_COOKIE = "zh_session";
/** Logged out after this many minutes without activity. The page renews the session while it is being used. */
export const SESSION_MINUTES = 10;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  tenantId: string;
  role: Role;
  name: string;
  actingForPensionerId?: string | null; // Helper Mode: which pensioner the helper is currently serving
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ tid: user.tenantId, role: user.role, name: user.name, af: user.actingForPensionerId ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MINUTES}m`)
    .sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      tenantId: String(payload.tid),
      role: payload.role as Role,
      name: String(payload.name),
      actingForPensionerId: (payload.af as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MINUTES * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Returns the logged-in user, re-checked against the database so a deactivated user loses access at once. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: session.id }, select: { active: true, role: true, tenantId: true } });
  if (!dbUser || !dbUser.active) return null;
  return { ...session, role: dbUser.role, tenantId: dbUser.tenantId };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Server-side role check. Throws 401 if not logged in, 403 if the role is not allowed. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Please log in");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Your role cannot do this");
  return user;
}

export const ROLE_HOME: Record<Role, string> = {
  PENSIONER: "/pensioner",
  HELPER: "/helper",
  SHOPKEEPER: "/shopkeeper",
  OFFICER: "/officer",
  ADMIN: "/admin",
  AUDITOR: "/auditor",
};

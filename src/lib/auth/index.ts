import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACCESS_COOKIE } from "./config";
import { verifyAccessToken, type AccessClaims } from "./jwt";

export { hashPassword, verifyPassword } from "./password";
export {
  clearSessionCookies,
  clearSetupCookie,
  endSession,
  revokeAllSessions,
  rotateSession,
  setSetupCookie,
  startSession,
} from "./session-tokens";

export type Session = { user: { id: string; name: string; email: string; role: AccessClaims["role"]; image: string | null } };

/** Current user from the access-token cookie (server components, route handlers, server actions). */
export async function getSession(): Promise<Session | null> {
  const claims = await verifyAccessToken(cookies().get(ACCESS_COOKIE)?.value);
  if (!claims) return null;
  return { user: { id: claims.userId, name: claims.name, email: claims.email, role: claims.role, image: null } };
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

/**
 * For route handlers: returns the session, or a ready-made 401 response.
 *   const auth = await requireUser(); if (auth instanceof NextResponse) return auth;
 */
export async function requireUser(): Promise<Session | NextResponse> {
  return (await getSession()) ?? unauthorized();
}

/** Like requireUser but re-reads the role from the database so a demoted admin loses access immediately. */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, disabledAt: true } });
  if (!user || user.disabledAt || user.role !== "ADMIN") return forbidden();
  return session;
}

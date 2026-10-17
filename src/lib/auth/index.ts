import { cookies } from "next/headers";
import { cache } from "react";
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

/**
 * Current user from the access-token cookie (server components, route handlers, server actions).
 * The role (and whether the account is still active) is read from the database, once per request, so a
 * promotion, downgrade or deactivation applies on the next page load instead of when the 15-minute access
 * token is next refreshed.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await verifyAccessToken(cookies().get(ACCESS_COOKIE)?.value);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { role: true, disabledAt: true } });
  if (!user || user.disabledAt) return null;
  return { user: { id: claims.userId, name: claims.name, email: claims.email, role: user.role, image: null } };
});

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

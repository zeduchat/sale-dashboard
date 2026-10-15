import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  SETUP_COOKIE,
  type Role,
} from "./config";
import { signAccessToken } from "./jwt";

/** A reused (already rotated) refresh token inside this window is treated as a tab race, not theft. */
const REUSE_GRACE_MS = 10_000;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

type SessionUser = { id: string; email: string | null; name: string | null; role: Role; disabledAt: Date | null };

async function mintAccess(user: SessionUser) {
  return signAccessToken({
    userId: user.id,
    email: user.email ?? "",
    name: user.name ?? user.email ?? "User",
    role: user.role,
  });
}

function setSessionCookies(access: string, refresh: string) {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, access, { ...cookieBase, maxAge: ACCESS_TTL_SECONDS });
  jar.set(REFRESH_COOKIE, refresh, { ...cookieBase, maxAge: REFRESH_TTL_SECONDS });
}

export function clearSessionCookies() {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function setSetupCookie(token: string, maxAge: number) {
  cookies().set(SETUP_COOKIE, token, { ...cookieBase, maxAge });
}

export function clearSetupCookie() {
  cookies().set(SETUP_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

async function createRefreshToken(userId: string, familyId: string, userAgent: string | null) {
  const raw = randomBytes(32).toString("base64url");
  const row = await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(raw),
      familyId,
      userId,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  });
  return { raw, id: row.id };
}

/** Starts a brand-new session (new refresh-token family) for a user and sets both cookies. */
export async function startSession(user: SessionUser, userAgent: string | null) {
  const refresh = await createRefreshToken(user.id, randomUUID(), userAgent);
  setSessionCookies(await mintAccess(user), refresh.raw);
}

/**
 * Exchanges the refresh cookie for a fresh access + refresh pair (rotation).
 * Returns the user on success, null if the token is missing, unknown, expired, reused or the user is disabled.
 */
export async function rotateSession(userAgent: string | null) {
  const raw = cookies().get(REFRESH_COOKIE)?.value;
  if (!raw) return null;

  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
  if (!row) return null;

  if (row.revokedAt) {
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
      await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return null;
  }
  if (row.expiresAt < new Date() || row.user.disabledAt) return null;

  // Only one concurrent request may consume the token.
  const claimed = await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (claimed.count !== 1) return null;

  const next = await createRefreshToken(row.userId, row.familyId, userAgent);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { replacedById: next.id } });
  setSessionCookies(await mintAccess(row.user), next.raw);
  return row.user;
}

/** Revokes the whole token family behind the refresh cookie and clears cookies. */
export async function endSession() {
  const raw = cookies().get(REFRESH_COOKIE)?.value;
  if (raw) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (row) {
      await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  }
  clearSessionCookies();
}

export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

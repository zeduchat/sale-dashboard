// Edge-safe: imported by middleware.
import { jwtVerify, SignJWT } from "jose";
import { ACCESS_TTL_SECONDS, SETUP_TTL_SECONDS, authSecret, type Role } from "./config";

export type AccessClaims = { userId: string; email: string; name: string; role: Role };
export type SetupClaims = { inviteId: string; email: string | null };

const ISSUER = "zedu";

async function sign(payload: Record<string, unknown>, audience: string, ttl: number, subject: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(authSecret());
}

async function verify(token: string, audience: string) {
  try {
    const { payload } = await jwtVerify(token, authSecret(), { issuer: ISSUER, audience, algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export function signAccessToken(c: AccessClaims) {
  return sign({ email: c.email, name: c.name, role: c.role }, "access", ACCESS_TTL_SECONDS, c.userId);
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessClaims | null> {
  if (!token) return null;
  const p = await verify(token, "access");
  if (!p?.sub || typeof p.email !== "string" || typeof p.name !== "string") return null;
  return { userId: p.sub, email: p.email, name: p.name, role: p.role === "ADMIN" ? "ADMIN" : "MEMBER" };
}

/** Short-lived proof that the holder entered a valid invite token on /setup. */
export function signSetupToken(c: SetupClaims) {
  return sign({ email: c.email }, "setup", SETUP_TTL_SECONDS, c.inviteId);
}

export async function verifySetupToken(token: string | undefined): Promise<SetupClaims | null> {
  if (!token) return null;
  const p = await verify(token, "setup");
  if (!p?.sub) return null;
  return { inviteId: p.sub, email: typeof p.email === "string" ? p.email : null };
}

// Edge-safe: imported by middleware. No Node-only or Prisma imports here.

export const ACCESS_COOKIE = "zedu_at";
export const REFRESH_COOKIE = "zedu_rt";
export const SETUP_COOKIE = "zedu_setup";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SETUP_TTL_SECONDS = 30 * 60;

export const PUBLIC_PAGES = ["/login", "/setup", "/request-access"];
export const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/admin/", "/api/health"];

export type Role = "ADMIN" | "MEMBER";

export function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

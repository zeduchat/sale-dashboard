import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./password";

export const MASTER_KEY_MIN = 32;
export const MASTER_KEY_MAX = 256;

/** The key a caller presented: `x-master-key: <key>` or `Authorization: Bearer <key>`. */
export function presentedMasterKey(req: Request): string | null {
  const direct = req.headers.get("x-master-key");
  if (direct) return direct;
  const auth = req.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * True when the request carries the current master key. Once a key is stored in the database it is the only
 * valid one; until then the optional MASTER_KEY env value (32+ chars) is accepted so the first key can be
 * set without touching the database.
 */
export async function checkMasterKey(req: Request): Promise<boolean> {
  const key = presentedMasterKey(req);
  if (!key || key.length > MASTER_KEY_MAX) return false;

  const row = await prisma.masterKey.findUnique({ where: { id: "default" } });
  if (row) return verifyPassword(key, row.keyHash);

  const env = process.env.MASTER_KEY;
  return !!env && env.length >= MASTER_KEY_MIN && timingSafeEqual(digest(key), digest(env));
}

export const generateMasterKey = () => `zmk_${randomBytes(32).toString("base64url")}`;

export async function hasStoredMasterKey() {
  return (await prisma.masterKey.count({ where: { id: "default" } })) > 0;
}

/**
 * First-ever claim: creates the key only if none exists. The primary-key conflict makes concurrent claims
 * safe, so exactly one caller wins. Returns false when a key was already stored.
 */
export async function claimMasterKey(key: string): Promise<boolean> {
  try {
    await prisma.masterKey.create({ data: { id: "default", keyHash: await hashPassword(key) } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

/** Stores (or replaces) the master key. Only a hash is kept, so the plaintext can't be recovered later. */
export async function storeMasterKey(key: string, rotatedById: string | null) {
  const keyHash = await hashPassword(key);
  return prisma.masterKey.upsert({
    where: { id: "default" },
    create: { id: "default", keyHash, rotatedById },
    update: { keyHash, rotatedById, rotatedAt: new Date(), version: { increment: 1 } },
  });
}

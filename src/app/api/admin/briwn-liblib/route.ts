import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { clientIp, fail, readJson } from "@/lib/auth/http";
import {
  checkMasterKey,
  claimMasterKey,
  generateMasterKey,
  hasStoredMasterKey,
  MASTER_KEY_MAX,
  MASTER_KEY_MIN,
  presentedMasterKey,
  storeMasterKey,
} from "@/lib/auth/master-key";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";

/**
 * Sets or rotates the master key. Body: { newKey? }. Without newKey a strong key is generated and returned
 * once; the server only stores its hash.
 * Auth: the current master key (header) or a signed-in admin. While NO key is stored yet, anyone may make the
 * first call to claim it (that call wins; afterwards the checks above apply). Not behind the session
 * middleware (see PUBLIC_API_PREFIXES), so every branch here must decide for itself.
 */
export async function PUT(req: Request) {
  if (!rateLimit(`master-key:${clientIp(req)}`, 10, 10 * 60_000)) return fail("Too many attempts. Try again later.", 429);

  let actorId: string | null = null;
  let firstClaim = false;
  if (presentedMasterKey(req)) {
    if (!(await checkMasterKey(req))) return fail("Invalid master key.", 401);
  } else if (!(await hasStoredMasterKey())) {
    firstClaim = true;
  } else {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    actorId = auth.user.id;
  }

  const body = (await readJson(req)) ?? {};
  const requested = body.newKey;
  if (requested !== undefined && (typeof requested !== "string" || requested.length < MASTER_KEY_MIN || requested.length > MASTER_KEY_MAX)) {
    return fail(`newKey must be ${MASTER_KEY_MIN}-${MASTER_KEY_MAX} characters, or omit it to generate one.`);
  }

  const key = (requested as string | undefined) ?? generateMasterKey();
  if (firstClaim && !(await claimMasterKey(key))) return fail("Unauthorized", 401);
  const row = firstClaim ? await prisma.masterKey.findUniqueOrThrow({ where: { id: "default" } }) : await storeMasterKey(key, actorId);
  return NextResponse.json({
    ok: true,
    version: row.version,
    rotatedAt: row.rotatedAt.toISOString(),
    ...(requested === undefined ? { key } : {}),
  });
}

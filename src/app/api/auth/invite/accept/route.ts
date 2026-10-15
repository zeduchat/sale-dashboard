import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSetupCookie, hashPassword, startSession } from "@/lib/auth";
import { SETUP_COOKIE } from "@/lib/auth/config";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/auth/http";
import { verifySetupToken } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail, passwordProblem, validateName } from "@/lib/auth/validation";
import { inviteStatus } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  if (!rateLimit(`accept:${clientIp(req)}`, 10, 10 * 60_000)) return fail("Too many attempts. Wait a few minutes and try again.", 429);

  const setup = await verifySetupToken(cookies().get(SETUP_COOKIE)?.value);
  if (!setup) return fail("Your setup session expired. Enter your code again.", 401);

  const body = await readJson(req);
  const name = validateName(body?.name);
  const email = normalizeEmail(body?.email);
  const problem = passwordProblem(body?.password);

  if (!name) return fail("Enter your full name.");
  if (!email) return fail("Enter a valid email address.");
  if (problem) return fail(problem);
  if (body?.password !== body?.confirmPassword) return fail("The passwords don't match.");

  const invite = await prisma.invite.findUnique({ where: { id: setup.inviteId } });
  if (!invite || inviteStatus(invite) !== "PENDING") return fail("This invite is no longer valid. Ask an admin for a new one.", 400);
  if (invite.email && invite.email !== email) return fail(`This invite is for ${invite.email}. Use that email address.`);

  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })) {
    return fail("An account with this email already exists. Sign in instead.", 409);
  }

  const passwordHash = await hashPassword(body?.password as string);

  const user = await prisma.$transaction(async (tx) => {
    // Claim one use atomically so concurrent submissions can't exceed maxUses. usedAt is set on the last use.
    const claimed = await tx.$executeRaw`
      UPDATE "Invite"
      SET "uses" = "uses" + 1,
          "usedAt" = CASE WHEN "uses" + 1 >= "maxUses" THEN now() ELSE "usedAt" END
      WHERE "id" = ${invite.id} AND "revokedAt" IS NULL AND "usedAt" IS NULL
        AND "expiresAt" > now() AND "uses" < "maxUses"`;
    if (claimed !== 1) return null;
    const created = await tx.user.create({ data: { name, email, passwordHash, role: invite.role, inviteId: invite.id } });
    await tx.accessRequest.updateMany({ where: { email, status: { not: "DISMISSED" } }, data: { status: "INVITED", handledAt: new Date() } });
    return created;
  });
  if (!user) return fail("This invite is no longer valid. Ask an admin for a new one.", 400);

  await startSession(user, req.headers.get("user-agent"));
  clearSetupCookie();
  return NextResponse.json({ ok: true });
}

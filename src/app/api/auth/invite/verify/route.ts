import { NextResponse } from "next/server";
import { setSetupCookie } from "@/lib/auth";
import { SETUP_TTL_SECONDS } from "@/lib/auth/config";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/auth/http";
import { signSetupToken } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeInviteToken } from "@/lib/auth/validation";
import { inviteStatus } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

const INVALID = "That code isn't valid or has expired. Check it and try again, or ask an admin for a new one.";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  // 9 chars over 36 symbols is not guessable, but cap attempts anyway.
  if (!rateLimit(`verify:${clientIp(req)}`, 10, 10 * 60_000)) return fail("Too many attempts. Wait a few minutes and try again.", 429);

  const body = await readJson(req);
  const token = normalizeInviteToken(body?.token);
  if (!token) return fail(INVALID, 400);

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || inviteStatus(invite) !== "PENDING") return fail(INVALID, 400);

  setSetupCookie(await signSetupToken({ inviteId: invite.id, email: invite.email }), SETUP_TTL_SECONDS);
  return NextResponse.json({ ok: true, email: invite.email });
}

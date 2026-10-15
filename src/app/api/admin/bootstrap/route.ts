import { NextResponse } from "next/server";
import { clientIp, fail, readJson } from "@/lib/auth/http";
import { checkMasterKey } from "@/lib/auth/master-key";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/auth/validation";
import { generateInviteToken, INVITE_TTL_DAYS } from "@/lib/invites";
import { inviteEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";
import { prisma } from "@/lib/prisma";

/**
 * Creates an invite using the master key, so the first admin (or a locked-out one) can be set up without SQL.
 * Body: { email?, role? = "ADMIN", maxUses? = 1 }. Returns the setup code; open /setup to use it.
 * Auth is the master key only; not behind the session middleware (see PUBLIC_API_PREFIXES).
 */
export async function POST(req: Request) {
  if (!rateLimit(`master-key:${clientIp(req)}`, 10, 10 * 60_000)) return fail("Too many attempts. Try again later.", 429);
  if (!(await checkMasterKey(req))) return fail("Invalid master key.", 401);

  const body = (await readJson(req)) ?? {};
  const role = body.role === "MEMBER" ? "MEMBER" : "ADMIN";
  const maxUses = typeof body.maxUses === "number" && Number.isInteger(body.maxUses) ? Math.min(Math.max(body.maxUses, 1), 10) : 1;
  const email = body.email === undefined ? null : normalizeEmail(body.email);
  if (body.email !== undefined && !email) return fail("Enter a valid email address.");
  if (email && maxUses > 1) return fail("An invite tied to an email can only be used once.");

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  let invite;
  for (let attempt = 0; ; attempt++) {
    try {
      invite = await prisma.invite.create({ data: { token: generateInviteToken(), email, role, maxUses, expiresAt } });
      break;
    } catch (err) {
      if (attempt >= 3 || (err as { code?: string }).code !== "P2002") throw err;
    }
  }

  const emailSent = email ? await sendMail(inviteEmail({ to: email, token: invite.token, inviterName: "Zedu admin", expiresAt })) : false;
  return NextResponse.json(
    { token: invite.token, email, role, maxUses, expiresAt: expiresAt.toISOString(), emailSent },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail, readJson, sameOrigin } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/auth/validation";
import { generateInviteToken, INVITE_TTL_DAYS, toInviteDTO } from "@/lib/invites";
import { inviteEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const invites = await prisma.invite.findMany({
    where: { email: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { invitedBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json(invites.map((i) => toInviteDTO(i)));
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`invite:${auth.user.id}`, 30, 60 * 60_000)) return fail("You're sending invites too quickly. Try again later.", 429);

  const body = await readJson(req);
  const email = normalizeEmail(body?.email);
  const role = body?.role === "ADMIN" ? "ADMIN" : "MEMBER";
  if (!email) return fail("Enter a valid email address.");

  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) {
    return fail("Someone with this email already has an account.", 409);
  }
  const open = await prisma.invite.findFirst({ where: { email, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (open) return fail("This email already has an open invite. Resend or revoke it instead.", 409);

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  let invite;
  for (let attempt = 0; ; attempt++) {
    try {
      invite = await prisma.invite.create({
        data: { token: generateInviteToken(), email, role, expiresAt, invitedById: auth.user.id },
        include: { invitedBy: { select: { name: true, email: true } } },
      });
      break;
    } catch (err) {
      // Unique-token collision: practically impossible, but retry rather than 500.
      if (attempt >= 3 || (err as { code?: string }).code !== "P2002") throw err;
    }
  }

  await prisma.accessRequest.updateMany({ where: { email, status: "PENDING" }, data: { status: "INVITED", handledAt: new Date() } });

  const emailSent = await sendMail(inviteEmail({ to: email, token: invite.token, inviterName: auth.user.name, expiresAt }));
  return NextResponse.json({ invite: toInviteDTO(invite, { withToken: true }), emailSent }, { status: 201 });
}

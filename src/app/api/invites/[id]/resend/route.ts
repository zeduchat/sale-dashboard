import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail, sameOrigin } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { INVITE_TTL_DAYS, toInviteDTO } from "@/lib/invites";
import { inviteEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";
import { prisma } from "@/lib/prisma";

/** Re-send an open invite's email and restart its expiry window. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`invite:${auth.user.id}`, 30, 60 * 60_000)) return fail("You're sending invites too quickly. Try again later.", 429);

  const found = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!found || found.usedAt || found.revokedAt) return fail("Invite not found or no longer open.", 404);
  if (!found.email) return fail("This invite has no email address to send to.");

  const invite = await prisma.invite.update({
    where: { id: found.id },
    data: { expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
    include: { invitedBy: { select: { name: true, email: true } } },
  });
  const emailSent = await sendMail(inviteEmail({ to: found.email, token: invite.token, inviterName: auth.user.name, expiresAt: invite.expiresAt }));
  return NextResponse.json({ invite: toInviteDTO(invite), emailSent });
}

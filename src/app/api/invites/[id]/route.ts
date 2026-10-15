import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail, sameOrigin } from "@/lib/auth/http";
import { prisma } from "@/lib/prisma";

/** Revoke an open invite. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const res = await prisma.invite.updateMany({ where: { id: params.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count !== 1) return fail("Invite not found or already used.", 404);
  return NextResponse.json({ ok: true });
}

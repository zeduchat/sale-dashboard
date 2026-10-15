import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail, sameOrigin } from "@/lib/auth/http";
import { prisma } from "@/lib/prisma";

/** Dismiss a pending access request. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const res = await prisma.accessRequest.updateMany({ where: { id: params.id, status: "PENDING" }, data: { status: "DISMISSED", handledAt: new Date() } });
  if (res.count !== 1) return fail("Request not found.", 404);
  return NextResponse.json({ ok: true });
}

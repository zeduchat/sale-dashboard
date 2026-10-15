import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import type { AccessRequestDTO } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.accessRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 100 });
  const dto: AccessRequestDTO[] = rows.map((r) => ({ id: r.id, name: r.name, email: r.email, message: r.message, createdAt: r.createdAt.toISOString() }));
  return NextResponse.json(dto);
}

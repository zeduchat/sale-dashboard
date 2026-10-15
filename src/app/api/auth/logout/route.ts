import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { fail, sameOrigin } from "@/lib/auth/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  await endSession();
  return NextResponse.json({ ok: true });
}

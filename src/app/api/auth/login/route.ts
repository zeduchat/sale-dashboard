import { NextResponse } from "next/server";
import { startSession, verifyPassword } from "@/lib/auth";
import { clientIp, fail, readJson, safeNext, sameOrigin } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";

const BAD = "Incorrect email or password.";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);

  const body = await readJson(req);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || password.length > 128) return fail(BAD, 401);

  if (!rateLimit(`login-ip:${clientIp(req)}`, 30, 15 * 60_000) || !rateLimit(`login-email:${email}`, 8, 15 * 60_000)) {
    return fail("Too many sign-in attempts. Wait a few minutes and try again.", 429);
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) return fail(BAD, 401);
  if (user.disabledAt) return fail("This account has been deactivated. Contact an admin.", 403);

  await startSession(user, req.headers.get("user-agent"));
  return NextResponse.json({ ok: true, next: safeNext(typeof body?.next === "string" ? body.next : null) });
}

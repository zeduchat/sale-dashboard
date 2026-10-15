import { NextResponse } from "next/server";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail, validateName } from "@/lib/auth/validation";
import { accessRequestEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  if (!rateLimit(`request-access:${clientIp(req)}`, 5, 60 * 60_000)) return fail("Too many requests. Try again later.", 429);

  const body = await readJson(req);
  const name = validateName(body?.name);
  const email = normalizeEmail(body?.email);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) || null : null;
  if (!name) return fail("Enter your full name.");
  if (!email) return fail("Enter a valid email address.");

  // Same response whether or not the email already has an account or a pending request, so this
  // form can't be used to discover who has access.
  const [hasAccount, hasPending] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
    prisma.accessRequest.findFirst({ where: { email, status: "PENDING" }, select: { id: true } }),
  ]);

  if (!hasAccount && !hasPending) {
    await prisma.accessRequest.create({ data: { name, email, message } });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", disabledAt: null, email: { not: null } }, select: { email: true } });
    const to = admins.map((a) => a.email!).filter(Boolean);
    if (to.length) await sendMail(accessRequestEmail({ to, name, email, message }));
  }

  return NextResponse.json({ ok: true });
}

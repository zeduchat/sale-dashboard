import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { safeNext } from "@/lib/auth/http";
import { authOptions } from "@/lib/auth/google";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NEXTAUTH_COOKIES = ["next-auth.session-token", "__Secure-next-auth.session-token"];

/** Landing point after Google OAuth: trades the NextAuth session for the app's own session cookies. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  if (!user || user.disabledAt) return NextResponse.redirect(new URL("/login?error=AccessDenied", url));

  await startSession(
    { id: user.id, email: user.email, name: user.name, role: user.role, disabledAt: user.disabledAt },
    req.headers.get("user-agent"),
  );

  await prisma.session.deleteMany({ where: { userId: user.id } });
  const jar = cookies();
  for (const name of NEXTAUTH_COOKIES) jar.set(name, "", { path: "/", maxAge: 0 });

  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url));
}

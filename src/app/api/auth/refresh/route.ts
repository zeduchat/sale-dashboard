import { NextResponse } from "next/server";
import { clearSessionCookies, rotateSession } from "@/lib/auth";
import { fail, safeNext, sameOrigin } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

/** Page navigations: middleware sends users here when the access token expired. Rotates, then returns to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const user = await rotateSession(req.headers.get("user-agent"));
  if (!user) {
    clearSessionCookies();
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url));
  }
  return NextResponse.redirect(new URL(next, url));
}

/** API clients: call after a 401, then retry the original request once. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Forbidden", 403);
  const user = await rotateSession(req.headers.get("user-agent"));
  if (!user) {
    clearSessionCookies();
    return fail("Session expired", 401);
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, PUBLIC_API_PREFIXES, PUBLIC_PAGES, REFRESH_COOKIE } from "@/lib/auth/config";
import { verifyAccessToken } from "@/lib/auth/jwt";

// Everything is private unless listed in PUBLIC_PAGES / PUBLIC_API_PREFIXES (src/lib/auth/config.ts).
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const claims = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublicPage) {
    // Signed-in users have no business on the sign-in / onboarding screens.
    return claims ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (claims) {
    if (pathname === "/invites" || pathname.startsWith("/invites/")) {
      if (claims.role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Page navigation without a valid access token: try the refresh token once, otherwise sign in.
  const next = encodeURIComponent(pathname + search);
  const target = req.cookies.has(REFRESH_COOKIE) ? `/api/auth/refresh?next=${next}` : `/login?next=${next}`;
  return NextResponse.redirect(new URL(target, req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

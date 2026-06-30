import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/jwt";

const AUTH_PAGES = ["/login", "/register"];
const ADMIN_PREFIX = "/admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  // Not logged in → only auth pages are allowed
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in → keep away from login/register
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin area is superadmin-only
  if (session && pathname.startsWith(ADMIN_PREFIX) && session.role !== "superadmin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Course management (create / import / edit) is superadmin-only
  const isCourseAdminRoute =
    pathname === "/courses/new" ||
    pathname === "/courses/import" ||
    (pathname.startsWith("/courses/") &&
      (pathname.endsWith("/edit") || pathname.endsWith("/tees")));
  if (session && isCourseAdminRoute && session.role !== "superadmin") {
    return NextResponse.redirect(new URL("/courses", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals and static assets
  // (any path ending in a common image/manifest extension).
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$).*)",
  ],
};

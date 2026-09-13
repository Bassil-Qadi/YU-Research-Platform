import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { canAccessAdmin } from "@/lib/auth/rbac";
import type { UserRole } from "@/types";

const { auth } = NextAuth(authConfig);

// Signed out by definition: someone who has forgotten their password cannot
// authenticate, so these have to be reachable without a session.
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/**
 * An API caller wants a status code it can act on, not a login page. Sending
 * every unauthenticated request to /login made the routes' own JSON errors
 * unreachable: fetch follows the redirect and hands back HTML with a 200.
 */
function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // /api/auth never reaches this function: the matcher below excludes it.
  const isPublic = publicPaths.includes(pathname);

  if (isPublic) {
    if (pathname === "/login" && req.auth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth?.user;

  if (!isLoggedIn) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsAdmin =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (needsAdmin) {
    const role = req.auth?.user?.role as UserRole | undefined;
    if (!canAccessAdmin(role)) {
      return isApiRequest(pathname)
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // /api/auth is excluded on purpose. Auth.js runs in its own route handlers
    // there; running it here as well put two sets of auth cookies on every
    // response: sign-out's "delete the session" beside this wrapper's refreshed
    // session, so signing out left you signed in. It is also why /api/auth/csrf
    // sent two different csrf-token cookies.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

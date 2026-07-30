import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = await auth();
    const isLoggedIn = !!session?.user;
    if (!isLoggedIn && pathname !== "/admin/login") {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (isLoggedIn && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Personalised outreach pages live outside the locale tree. Without this,
  // next-intl rewrites /o/<token> to /en/o/<token>, which does not exist, and
  // every link we mail out 404s.
  if (pathname === "/o" || pathname.startsWith("/o/")) return NextResponse.next();

  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals and static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

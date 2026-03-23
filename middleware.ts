import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow unauthenticated access to auth routes and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = verifySession(token);

  // If not logged in, redirect everything else to /login
  if (!session) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Teacher-only: /teacher routes require teacher role
  if (pathname.startsWith("/teacher") && session.role !== "teacher") {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Student-only: teachers must not access student portal (/, /quiz, /tutor, etc.)
  const isStudentRoute =
    pathname === "/" ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/tutor") ||
    pathname.startsWith("/flashcards") ||
    pathname.startsWith("/settings");
  if (session.role === "teacher" && isStudentRoute) {
    const url = new URL("/teacher", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};


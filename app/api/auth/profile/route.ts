import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  signSession,
  verifySession,
} from "@/lib/auth/session";
import { updateUserUsernameAndName } from "@/lib/rag/db";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySession(token);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    if (!rawName) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Optional: basic length guard
    const username = rawName.slice(0, 80);

    // Update username (and also name) in the DB.
    updateUserUsernameAndName(session.userId, username);

    // Refresh session cookie so future requests use the new username.
    const newSession = {
      ...session,
      username,
    };
    const newToken = signSession(newSession);

    const response = NextResponse.json({ ok: true, name: username });
    response.cookies.set(AUTH_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("[Auth] Update profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}


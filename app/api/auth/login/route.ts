import { NextRequest, NextResponse } from "next/server";
import { ensureDemoUsers, verifyUser } from "@/lib/auth/users";
import {
  AUTH_COOKIE_NAME,
  signSession,
  type UserRole,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (
      !username ||
      typeof username !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Seed demo users on first run if none exist
    await ensureDemoUsers();

    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const role = user.role as UserRole;
    const sessionToken = signSession({
      userId: user.id,
      username: user.username,
      role,
    });

    const response = NextResponse.json({ role });
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}


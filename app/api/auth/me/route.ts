import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";
import { getUserByUsername } from "@/lib/rag/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySession(token);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const user = getUserByUsername(session.username);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name ?? user.username,
      grade: user.grade,
    });
  } catch (error) {
    console.error("[Auth] Me error:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}


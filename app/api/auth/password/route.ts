import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";
import { getUserById, updateUserPassword } from "@/lib/rag/db";

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
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password should be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = getUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hash = await bcrypt.hash(newPassword, 10);
    updateUserPassword(session.userId, hash);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Auth] Change password error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}


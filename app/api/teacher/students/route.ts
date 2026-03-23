import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";
import { getStudentsWithQuizAggregates } from "@/lib/rag/db";

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
    if (session.role !== "teacher") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const students = getStudentsWithQuizAggregates();
    return NextResponse.json({ students });
  } catch (error) {
    console.error("[Teacher Students API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load students" },
      { status: 500 }
    );
  }
}

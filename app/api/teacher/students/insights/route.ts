import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import {
  getStudentsWithQuizAggregates,
  getSubjectFeedbackCache,
  getTeacherStudentInsight,
  upsertTeacherStudentInsight,
} from "@/lib/rag/db";
import { generateTeacherAiInsights } from "@/lib/teacher-ai-insights";
import { computeTeacherInsightSourceHash } from "@/lib/teacher-insight-source-hash";

export const runtime = "nodejs";

type StudentAgg = ReturnType<typeof getStudentsWithQuizAggregates>[number];

function hashAndCachesForStudent(s: StudentAgg) {
  const mathCache = getSubjectFeedbackCache(s.id, "math");
  const sciCache = getSubjectFeedbackCache(s.id, "science");
  const sourceHash = computeTeacherInsightSourceHash({
    studentName: s.name,
    mathNarrative: mathCache?.narrativeText ?? null,
    scienceNarrative: sciCache?.narrativeText ?? null,
    mathComputedAt: mathCache?.computedAt ?? null,
    scienceComputedAt: sciCache?.computedAt ?? null,
    mathAvgPct: s.mathScore,
    scienceAvgPct: s.scienceScore,
  });
  return { mathCache, sciCache, sourceHash };
}

/**
 * Fast read: returns cached insights that still match the current source hash.
 * Clients should POST to generate missing or stale entries (see POST).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (session.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherId = session.userId;
    const students = getStudentsWithQuizAggregates();
    const insights: Record<string, string> = {};
    const pendingGeneration: string[] = [];

    for (const s of students) {
      const { sourceHash } = hashAndCachesForStudent(s);
      const cached = getTeacherStudentInsight(teacherId, s.id);
      if (cached && cached.sourceHash === sourceHash) {
        insights[s.id] = cached.insightText;
      } else {
        pendingGeneration.push(s.id);
      }
    }

    return NextResponse.json({ insights, pendingGeneration });
  } catch (error) {
    console.error("[Teacher Students Insights API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load AI insights" },
      { status: 500 }
    );
  }
}

/**
 * Generate and cache insights for the given student IDs (or all stale if omitted).
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (session.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherId = session.userId;
    const students = getStudentsWithQuizAggregates();
    const byId = new Map(students.map((s) => [s.id, s]));

    let body: { studentIds?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    let ids: string[] = Array.isArray(body.studentIds)
      ? body.studentIds.filter((x): x is string => typeof x === "string")
      : [];

    if (ids.length === 0) {
      for (const s of students) {
        const { sourceHash } = hashAndCachesForStudent(s);
        const cached = getTeacherStudentInsight(teacherId, s.id);
        if (!cached || cached.sourceHash !== sourceHash) {
          ids.push(s.id);
        }
      }
    }

    const insights: Record<string, string> = {};

    for (const id of ids) {
      const s = byId.get(id);
      if (!s) continue;

      const { mathCache, sciCache, sourceHash } = hashAndCachesForStudent(s);
      const cached = getTeacherStudentInsight(teacherId, s.id);
      if (cached && cached.sourceHash === sourceHash) {
        insights[id] = cached.insightText;
        continue;
      }

      const text = await generateTeacherAiInsights({
        studentName: s.name,
        mathAvgPct: s.mathScore,
        scienceAvgPct: s.scienceScore,
        mathNarrative: mathCache?.narrativeText ?? null,
        scienceNarrative: sciCache?.narrativeText ?? null,
      });

      upsertTeacherStudentInsight({
        teacherId,
        studentId: s.id,
        insightText: text,
        sourceHash,
      });

      insights[id] = text;
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("[Teacher Students Insights API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights" },
      { status: 500 }
    );
  }
}

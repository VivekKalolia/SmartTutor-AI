import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import {
  getUserByUsername,
  getQuizResultsByUserSummary,
  getAllStudentQuizSummaries,
  getTopicAggregatesForUser,
  getLatestSessionPerSubject,
  getAllTopicAggregates,
  getTopicBreakdownForLatestQuiz,
  getLatestTopicMasteryForSubject,
  getSubjectFeedbackCache,
} from "@/lib/rag/db";

export const runtime = "nodejs";

function strongestWeakest(
  agg: Record<
    string,
    { correct: number; total: number; avgAcrossQuizzesPct?: number }
  >
): { strongestTopic: string | null; weakestTopic: string | null } {
  let best: { label: string; pct: number } | null = null;
  let worst: { label: string; pct: number } | null = null;
  for (const [label, row] of Object.entries(agg)) {
    if (row.total < 1) continue;
    const pct =
      row.avgAcrossQuizzesPct ??
      Math.round((row.correct / row.total) * 1000) / 10;
    if (!best || pct > best.pct) best = { label, pct };
    if (!worst || pct < worst.pct) worst = { label, pct };
  }
  return {
    strongestTopic: best?.label ?? null,
    weakestTopic: worst?.label ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const user = getUserByUsername(session.username);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "student") {
      const summary = getQuizResultsByUserSummary(user.id);
      const topicAggregates = getTopicAggregatesForUser(user.id);
      const latestSession = getLatestSessionPerSubject(user.id);
      const latestMathMastery = getLatestTopicMasteryForSubject(user.id, "math");
      const latestScienceMastery = getLatestTopicMasteryForSubject(
        user.id,
        "science"
      );
      const latestTestTopics = {
        math:
          latestMathMastery.length > 0
            ? latestMathMastery.map((r) => ({
                label: r.label,
                correct: 0,
                total: 0,
                pct: r.pct,
              }))
            : getTopicBreakdownForLatestQuiz(user.id, "math"),
        science:
          latestScienceMastery.length > 0
            ? latestScienceMastery.map((r) => ({
                label: r.label,
                correct: 0,
                total: 0,
                pct: r.pct,
              }))
            : getTopicBreakdownForLatestQuiz(user.id, "science"),
      };
      const mathFeedback = getSubjectFeedbackCache(user.id, "math");
      const scienceFeedback = getSubjectFeedbackCache(user.id, "science");

      return NextResponse.json({
        role: "student",
        ...summary,
        topicAggregates,
        latestSession,
        latestTestTopics,
        learningBySubject: {
          math: strongestWeakest(topicAggregates.math),
          science: strongestWeakest(topicAggregates.science),
        },
        aiFeedback: {
          math: mathFeedback
            ? { narrative: mathFeedback.narrativeText, computedAt: mathFeedback.computedAt }
            : null,
          science: scienceFeedback
            ? { narrative: scienceFeedback.narrativeText, computedAt: scienceFeedback.computedAt }
            : null,
        },
      });
    }

    if (user.role === "teacher") {
      const summaries = getAllStudentQuizSummaries();
      const classTopics = getAllTopicAggregates();

      const totalStudents = summaries.length;
      const withMath = summaries.filter((s) => s.mathAverageScore !== null);
      const withSci = summaries.filter((s) => s.scienceAverageScore !== null);
      const avgMath =
        withMath.length > 0
          ? Math.round(
              withMath.reduce((a, s) => a + (s.mathAverageScore ?? 0), 0) /
                withMath.length
            )
          : null;
      const avgScience =
        withSci.length > 0
          ? Math.round(
              withSci.reduce((a, s) => a + (s.scienceAverageScore ?? 0), 0) /
                withSci.length
            )
          : null;
      const totalQuizzes = summaries.reduce((a, s) => a + s.totalQuizzes, 0);

      const chartStudents = summaries.map((s) => {
        const m = s.mathAverageScore;
        const sc = s.scienceAverageScore;
        const parts: number[] = [];
        if (m !== null) parts.push(m);
        if (sc !== null) parts.push(sc);
        const avgScore =
          parts.length > 0
            ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) /
              10
            : 0;
        return {
          name: s.name,
          math: m ?? 0,
          science: sc ?? 0,
          avgScore,
        };
      });

      const subjectDistribution = [
        { subject: "Math", students: totalStudents, avgScore: avgMath ?? 0 },
        {
          subject: "Science",
          students: totalStudents,
          avgScore: avgScience ?? 0,
        },
      ];

      return NextResponse.json({
        role: "teacher",
        totalStudents,
        averageMathScore: avgMath,
        averageScienceScore: avgScience,
        totalQuizzesTaken: totalQuizzes,
        students: summaries,
        chartStudents,
        subjectDistribution,
        classLearningBySubject: {
          math: strongestWeakest(classTopics.math),
          science: strongestWeakest(classTopics.science),
        },
      });
    }

    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  } catch (error) {
    console.error("[Dashboard] Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

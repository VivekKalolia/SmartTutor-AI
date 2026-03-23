import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import {
  getUserByUsername,
  saveQuizResultWithAttempts,
  type QuizAttemptInsert,
  getQuizResultsByUserSummary,
  updateStudentScores,
  getQuestionAttemptsWithMetaForUserSubject,
  getSessionStructuredJsonHistoryForUserSubject,
  insertQuizSessionFeedback,
  upsertSubjectFeedbackCache,
} from "@/lib/rag/db";
import { buildSessionFeedbackStructured } from "@/lib/quiz-feedback/session-feedback";
import { buildGeneralSubjectFeedback } from "@/lib/quiz-feedback/general-feedback";
import type { QuestionAttemptInput, QuizSubject } from "@/lib/quiz-feedback/types";
import type { SessionFeedbackStructured } from "@/lib/quiz-feedback/types";
import {
  generateGeneralFeedbackNarrative,
  generateSessionFeedbackNarrative,
} from "@/lib/quiz-feedback/narrative";

export const runtime = "nodejs";

function isQuizSubject(s: string): s is QuizSubject {
  return s === "math" || s === "science";
}

/** Extends QuizAttemptInsert with AI-context fields not stored in the DB */
type QuizAttemptWithContext = QuizAttemptInsert & {
  questionText?: string;
  selectedAnswerText?: string;
  correctAnswerText?: string;
};

function normalizeAttempts(raw: unknown): QuizAttemptWithContext[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizAttemptWithContext[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const questionId =
      typeof o.questionId === "string"
        ? o.questionId
        : typeof o.question_id === "string"
          ? o.question_id
          : "";
    if (!questionId) continue;
    const selectedRaw = o.selectedAnswerIndex ?? o.selected_answer_index;
    const selectedAnswerIndex =
      typeof selectedRaw === "number"
        ? selectedRaw
        : selectedRaw === null
          ? null
          : null;
    const correctRaw = o.correctAnswerIndex ?? o.correct_answer_index;
    const correctAnswerIndex =
      typeof correctRaw === "number" ? correctRaw : 0;
    let isCorrect =
      o.isCorrect === true ||
      o.is_correct === true ||
      o.is_correct === 1;
    if (
      o.isCorrect === undefined &&
      o.is_correct === undefined &&
      typeof selectedAnswerIndex === "number"
    ) {
      isCorrect = selectedAnswerIndex === correctAnswerIndex;
    }
    out.push({
      questionId,
      questionPreview:
        typeof o.questionPreview === "string"
          ? o.questionPreview.slice(0, 2000)
          : typeof o.question_preview === "string"
            ? o.question_preview.slice(0, 2000)
            : undefined,
      questionText:
        typeof o.questionText === "string" ? o.questionText.slice(0, 4000) : undefined,
      selectedAnswerText:
        typeof o.selectedAnswerText === "string" ? o.selectedAnswerText.slice(0, 500) : undefined,
      correctAnswerText:
        typeof o.correctAnswerText === "string" ? o.correctAnswerText.slice(0, 500) : undefined,
      topic: typeof o.topic === "string" ? o.topic : undefined,
      kcId:
        typeof o.kcId === "string"
          ? o.kcId
          : typeof o.kc_id === "string"
            ? o.kc_id
            : undefined,
      difficulty: typeof o.difficulty === "string" ? o.difficulty : undefined,
      selectedAnswerIndex,
      correctAnswerIndex,
      isCorrect: Boolean(isCorrect),
      timeSpentSec:
        typeof o.timeSpentSec === "number"
          ? o.timeSpentSec
          : typeof o.time_spent_sec === "number"
            ? o.time_spent_sec
            : undefined,
      retryCount:
        typeof o.retryCount === "number"
          ? o.retryCount
          : typeof o.retry_count === "number"
            ? o.retry_count
            : undefined,
      hintUsed:
        o.hintUsed === true ||
        o.hint_used === true ||
        o.hint_used === 1,
      positionIndex:
        typeof o.positionIndex === "number"
          ? o.positionIndex
          : typeof o.position_index === "number"
            ? o.position_index
            : undefined,
    });
  }
  return out;
}

function toAttemptInputs(attempts: QuizAttemptWithContext[]): QuestionAttemptInput[] {
  return attempts.map((a) => ({
    questionId: a.questionId,
    questionPreview: a.questionPreview,
    questionText: a.questionText,
    selectedAnswerText: a.selectedAnswerText,
    correctAnswerText: a.correctAnswerText,
    topic: a.topic,
    kcId: a.kcId,
    difficulty: a.difficulty as QuestionAttemptInput["difficulty"],
    selectedAnswerIndex: a.selectedAnswerIndex,
    correctAnswerIndex: a.correctAnswerIndex,
    isCorrect: a.isCorrect,
    timeSpentSec: a.timeSpentSec,
    retryCount: a.retryCount,
    hintUsed: a.hintUsed,
    positionIndex: a.positionIndex,
  }));
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      subject,
      score,
      totalQuestions,
      correctCount,
      topicMastery,
      ktSource,
      durationSeconds,
      attempts: attemptsRaw,
    } = body;

    if (!subject || totalQuestions == null || correctCount == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!isQuizSubject(String(subject))) {
      return NextResponse.json(
        { error: "subject must be math or science" },
        { status: 400 }
      );
    }

    const attempts = normalizeAttempts(attemptsRaw);
    const pct = Math.round((correctCount / totalQuestions) * 100);

    const id = saveQuizResultWithAttempts({
      userId: user.id,
      subject,
      score: score ?? pct,
      totalQuestions,
      correctCount,
      topicMastery,
      ktSource,
      durationSeconds,
      // Strip AI-context-only fields (not stored in DB) before passing to DB layer
      attempts: attempts.map((a) => ({
        questionId: a.questionId,
        questionPreview: a.questionPreview,
        topic: a.topic,
        kcId: a.kcId,
        difficulty: a.difficulty,
        selectedAnswerIndex: a.selectedAnswerIndex,
        correctAnswerIndex: a.correctAnswerIndex,
        isCorrect: a.isCorrect,
        timeSpentSec: a.timeSpentSec,
        retryCount: a.retryCount,
        hintUsed: a.hintUsed,
        positionIndex: a.positionIndex,
      })),
    });

    if (subject === "math") {
      updateStudentScores(user.id, pct, user.science_score ?? null);
    } else {
      updateStudentScores(user.id, user.math_score ?? null, pct);
    }

    const attemptInputs = toAttemptInputs(attempts);
    let sessionStructured: SessionFeedbackStructured;
    let sessionNarrative: { text: string; source: string };

    try {
      sessionStructured = buildSessionFeedbackStructured(subject, attemptInputs);
      sessionNarrative = await generateSessionFeedbackNarrative(
        sessionStructured,
        attemptInputs
      );
    } catch (feedbackErr) {
      console.error("[Quiz Results] Session feedback generation failed:", feedbackErr);
      sessionStructured = {
        subject,
        primaryFocus: null,
        secondaryFocus: [],
        actionPlan: ["Review your quiz results above."],
        confidence: "low",
        evidenceSummary: "Feedback generation encountered an error.",
        stats: {
          correct: attempts.filter((a) => a.isCorrect).length,
          total: attempts.length,
          incorrectQuestionIds: attempts.filter((a) => !a.isCorrect).map((a) => a.questionId),
        },
      };
      sessionNarrative = {
        text: `You completed ${attempts.length} question(s) with ${attempts.filter((a) => a.isCorrect).length} correct. Review the questions above to identify areas for improvement.`,
        source: "fallback",
      };
    }

    // Insert session feedback & build general feedback in a non-blocking manner.
    // Even if these fail, the session feedback is still returned.
    try {
      const pastJson = getSessionStructuredJsonHistoryForUserSubject(
        user.id,
        subject
      );
      const pastSessionFeedbacks: SessionFeedbackStructured[] = [];
      for (const j of pastJson) {
        try {
          pastSessionFeedbacks.push(JSON.parse(j) as SessionFeedbackStructured);
        } catch {
          /* skip */
        }
      }

      insertQuizSessionFeedback({
        quizResultId: id,
        userId: user.id,
        subject,
        structuredJson: JSON.stringify(sessionStructured),
        narrativeText: sessionNarrative.text,
        source: `hybrid:${sessionNarrative.source}`,
      });

      const withMeta = getQuestionAttemptsWithMetaForUserSubject(user.id, subject);
      const generalStructured = buildGeneralSubjectFeedback(
        subject,
        withMeta.map((r) => ({
          subject:
            r.subject === "science" ? "science" : ("math" as QuizSubject),
          questionId: r.questionId,
          questionPreview: r.questionPreview ?? undefined,
          topic: r.topic ?? undefined,
          kcId: r.kcId ?? undefined,
          difficulty: r.difficulty ?? undefined,
          selectedAnswerIndex: r.selectedAnswerIndex,
          correctAnswerIndex: r.correctAnswerIndex,
          isCorrect: Boolean(r.isCorrect),
          timeSpentSec: r.timeSpentSec ?? undefined,
          retryCount: r.retryCount ?? undefined,
          hintUsed: Boolean(r.hintUsed),
          positionIndex: r.positionIndex ?? undefined,
          quizResultId: r.quizResultId,
          sessionCreatedAt: r.sessionCreatedAt,
        })),
        pastSessionFeedbacks
      );

      let generalNarrative: { text: string; source: string };
      try {
        generalNarrative = await generateGeneralFeedbackNarrative(
          generalStructured
        );
      } catch (narrativeErr) {
        console.error(
          "[Quiz Results] General feedback narrative generation failed, using fallback:",
          narrativeErr
        );
        const totalAttempts = withMeta.length;
        const correctAttempts = withMeta.filter((r) => Boolean(r.isCorrect)).length;
        const pct =
          totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
        generalNarrative = {
          text:
            totalAttempts > 0
              ? `Your overall ${subject} progress is ${pct}% accuracy across ${totalAttempts} questions from your saved quizzes. Keep practicing your weaker topics to improve consistency.`
              : `No ${subject} attempt data is available yet.`,
          source: "fallback",
        };
      }

      upsertSubjectFeedbackCache({
        userId: user.id,
        subject,
        structuredJson: JSON.stringify(generalStructured),
        narrativeText: generalNarrative.text,
        source: `hybrid:${generalNarrative.source}`,
      });
    } catch (generalErr) {
      console.error("[Quiz Results] General feedback generation failed (session feedback still returned):", generalErr);
    }

    return NextResponse.json({
      success: true,
      id,
      sessionFeedback: {
        structured: sessionStructured,
        narrative: sessionNarrative.text,
        source: sessionNarrative.source,
      },
    });
  } catch (error) {
    console.error("[Quiz Results] Save error:", error);
    return NextResponse.json(
      { error: "Failed to save results" },
      { status: 500 }
    );
  }
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

    const summary = getQuizResultsByUserSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[Quiz Results] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

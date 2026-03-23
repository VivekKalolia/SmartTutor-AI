import { describe, it, expect } from "vitest";
import { buildSessionFeedbackStructured } from "./session-feedback";
import { buildGeneralSubjectFeedback } from "./general-feedback";
import type { SessionFeedbackStructured } from "./types";

describe("buildSessionFeedbackStructured", () => {
  it("identifies primary focus from incorrect patterns by KC", () => {
    const attempts = [
      {
        questionId: "m1",
        kcId: "ALGEBRA_GENERAL",
        topic: "Algebra",
        difficulty: "easy" as const,
        correctAnswerIndex: 0,
        selectedAnswerIndex: 1,
        isCorrect: false,
      },
      {
        questionId: "m2",
        kcId: "ALGEBRA_GENERAL",
        topic: "Algebra",
        difficulty: "medium" as const,
        correctAnswerIndex: 2,
        selectedAnswerIndex: 2,
        isCorrect: true,
      },
      {
        questionId: "m3",
        kcId: "GEOMETRY_SHAPES",
        topic: "Geometry",
        difficulty: "easy" as const,
        correctAnswerIndex: 1,
        selectedAnswerIndex: 1,
        isCorrect: true,
      },
    ];
    const s = buildSessionFeedbackStructured("math", attempts);
    expect(s.primaryFocus?.kcId).toBe("ALGEBRA_GENERAL");
    expect(s.stats.correct).toBe(2);
    expect(s.stats.total).toBe(3);
    expect(s.stats.incorrectQuestionIds).toContain("m1");
  });

  it("handles empty attempts", () => {
    const s = buildSessionFeedbackStructured("science", []);
    expect(s.primaryFocus).toBeNull();
    expect(s.confidence).toBe("low");
  });
});

describe("buildGeneralSubjectFeedback", () => {
  it("aggregates across sessions with recency", () => {
    const past: SessionFeedbackStructured[] = [];
    const attempts = [
      {
        subject: "math" as const,
        questionId: "a",
        kcId: "ALGEBRA_GENERAL",
        topic: "Algebra",
        difficulty: "medium",
        correctAnswerIndex: 0,
        selectedAnswerIndex: 1,
        isCorrect: false,
        quizResultId: 1,
        sessionCreatedAt: "2025-01-01T00:00:00.000Z",
      },
      {
        subject: "math" as const,
        questionId: "b",
        kcId: "GEOMETRY_SHAPES",
        topic: "Geometry",
        difficulty: "easy",
        correctAnswerIndex: 0,
        selectedAnswerIndex: 0,
        isCorrect: true,
        quizResultId: 2,
        sessionCreatedAt: "2025-06-01T00:00:00.000Z",
      },
    ];
    const g = buildGeneralSubjectFeedback("math", attempts, past);
    expect(g.subject).toBe("math");
    expect(g.attemptCount).toBe(2);
    expect(g.primaryFocus?.kcId).toBeDefined();
  });
});

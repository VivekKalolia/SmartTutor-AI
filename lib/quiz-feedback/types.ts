/**
 * Shared types for question-aware quiz feedback (session + cumulative).
 */

export type QuizSubject = "math" | "science";

export interface QuestionAttemptInput {
  questionId: string;
  /** Short plain-text preview for AI context (strip heavy LaTeX) */
  questionPreview?: string;
  /** Full question text (may contain LaTeX) for rich AI feedback context */
  questionText?: string;
  /** Text of the answer the student selected */
  selectedAnswerText?: string;
  /** Text of the correct answer */
  correctAnswerText?: string;
  topic?: string;
  kcId?: string;
  difficulty?: "easy" | "medium" | "hard" | "very_hard" | string;
  selectedAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  timeSpentSec?: number;
  retryCount?: number;
  hintUsed?: boolean;
  positionIndex?: number;
}

/** Stored + API shape for one row */
export interface QuestionAttemptRow extends QuestionAttemptInput {
  quizResultId: number;
  userId: string;
  subject: QuizSubject;
}

export interface FocusArea {
  /** Human label (topic name or KC display) */
  label: string;
  kcId?: string;
  topic?: string;
  /** Higher = more urgent to address */
  weaknessScore: number;
  /** Question IDs supporting this focus (usually incorrect) */
  evidenceQuestionIds: string[];
  correctInArea: number;
  totalInArea: number;
}

export interface SessionFeedbackStructured {
  subject: QuizSubject;
  primaryFocus: FocusArea | null;
  secondaryFocus: FocusArea[];
  actionPlan: string[];
  confidence: "low" | "medium" | "high";
  evidenceSummary: string;
  stats: {
    correct: number;
    total: number;
    incorrectQuestionIds: string[];
  };
}

export interface GeneralFeedbackStructured {
  subject: QuizSubject;
  primaryFocus: FocusArea | null;
  secondaryFocus: FocusArea[];
  actionPlan: string[];
  confidence: "low" | "medium" | "high";
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  evidenceSummary: string;
  /** Approximate data strength */
  sessionCount: number;
  attemptCount: number;
}

export interface FeedbackNarrativeResult {
  text: string;
  source: "ollama" | "deterministic";
}

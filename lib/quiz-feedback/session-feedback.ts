import type {
  FocusArea,
  QuestionAttemptInput,
  QuizSubject,
  SessionFeedbackStructured,
} from "./types";

const DIFF_WEIGHT: Record<string, number> = {
  easy: 1.45,
  medium: 1.0,
  hard: 0.88,
  very_hard: 0.75,
};

function difficultyWeight(d: string | undefined): number {
  if (!d) return 1;
  const k = String(d).toLowerCase();
  return DIFF_WEIGHT[k] ?? 1;
}

function truncatePreview(s: string | undefined, max = 160): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Deterministic per-session recommendation from exact question attempts.
 */
export function buildSessionFeedbackStructured(
  subject: QuizSubject,
  attempts: QuestionAttemptInput[]
): SessionFeedbackStructured {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const incorrectIds = attempts
    .filter((a) => !a.isCorrect)
    .map((a) => a.questionId);

  if (total === 0) {
    return {
      subject,
      primaryFocus: null,
      secondaryFocus: [],
      actionPlan: ["Complete a quiz session to receive targeted feedback."],
      confidence: "low",
      evidenceSummary: "No question attempts were recorded for this session.",
      stats: { correct: 0, total: 0, incorrectQuestionIds: [] },
    };
  }

  type Agg = {
    key: string;
    label: string;
    kcId?: string;
    topic?: string;
    total: number;
    correct: number;
    wrongIds: string[];
    weightedWrongSum: number;
    retryOnWrong: number;
  };

  const byKey = new Map<string, Agg>();

  for (const a of attempts) {
    const kc = a.kcId?.trim() || "";
    const topic = a.topic?.trim() || "";
    const key = kc || topic || "general";
    const label = topic || kc || "General";

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label,
        kcId: kc || undefined,
        topic: topic || undefined,
        total: 0,
        correct: 0,
        wrongIds: [],
        weightedWrongSum: 0,
        retryOnWrong: 0,
      });
    }
    const g = byKey.get(key)!;
    g.total++;
    if (a.isCorrect) g.correct++;
    else {
      g.wrongIds.push(a.questionId);
      g.weightedWrongSum += difficultyWeight(
        typeof a.difficulty === "string" ? a.difficulty : undefined
      );
      g.retryOnWrong += a.retryCount ?? 0;
    }
  }

  const scored: FocusArea[] = [];

  for (const g of byKey.values()) {
    const wrong = g.total - g.correct;
    const wrongRate = g.total > 0 ? wrong / g.total : 0;
    const avgWrongDiff =
      wrong > 0 ? g.weightedWrongSum / wrong : difficultyWeight("medium");
    const retryBoost = Math.min(0.35, g.retryOnWrong * 0.04);
    const weaknessScore =
      wrongRate * 100 * (avgWrongDiff + retryBoost) +
      (wrong > 0 ? wrong * 2 : 0);

    scored.push({
      label: g.label,
      kcId: g.kcId,
      topic: g.topic,
      weaknessScore,
      evidenceQuestionIds: [...new Set(g.wrongIds)].slice(0, 12),
      correctInArea: g.correct,
      totalInArea: g.total,
    });
  }

  scored.sort((a, b) => b.weaknessScore - a.weaknessScore);

  const primaryFocus = scored[0] ?? null;
  const secondaryFocus = scored.slice(1, 3).filter((s) => s.weaknessScore > 0);

  let confidence: "low" | "medium" | "high" = "medium";
  if (total < 8) confidence = "low";
  else if (total >= 15) confidence = "high";

  const evidenceParts: string[] = [];
  if (primaryFocus && primaryFocus.totalInArea > 0) {
    const w = primaryFocus.totalInArea - primaryFocus.correctInArea;
    evidenceParts.push(
      `${primaryFocus.label}: ${w} miss(es) out of ${primaryFocus.totalInArea} question(s) in this area.`
    );
  }
  if (incorrectIds.length > 0) {
    evidenceParts.push(
      `You missed ${incorrectIds.length} question(s) overall this session.`
    );
  }

  const actionPlan: string[] = [];
  if (primaryFocus) {
    actionPlan.push(
      `Prioritize ${primaryFocus.label}: redo similar problems at medium difficulty until you can explain the steps aloud.`
    );
  }
  for (const s of secondaryFocus) {
    actionPlan.push(
      `Secondary: short review of ${s.label} (${s.correctInArea}/${s.totalInArea} correct in-session).`
    );
  }
  if (actionPlan.length === 0) {
    actionPlan.push(
      "Strong session. Maintain momentum with mixed practice across topics."
    );
  }

  return {
    subject,
    primaryFocus,
    secondaryFocus,
    actionPlan: actionPlan.slice(0, 5),
    confidence,
    evidenceSummary: evidenceParts.join(" "),
    stats: {
      correct,
      total,
      incorrectQuestionIds: incorrectIds,
    },
  };
}

/** Template narrative when LLM is unavailable */
export function buildDeterministicSessionNarrative(
  structured: SessionFeedbackStructured
): string {
  const { primaryFocus, secondaryFocus, stats, actionPlan, confidence } =
    structured;
  const head =
    stats.total > 0
      ? `You completed ${stats.total} question(s) with ${stats.correct} correct (${Math.round((stats.correct / stats.total) * 100)}%).`
      : "Session complete.";

  const focus =
    primaryFocus && primaryFocus.totalInArea > 0
      ? ` The clearest gap is **${primaryFocus.label}** (${primaryFocus.correctInArea}/${primaryFocus.totalInArea} correct in that area).`
      : "";

  const sec =
    secondaryFocus.length > 0
      ? ` Also watch: ${secondaryFocus.map((s) => s.label).join(", ")}.`
      : "";

  const steps = actionPlan.map((a) => `- ${a}`).join("\n");

  return `${head}${focus}${sec}

**Next steps**
${steps}

*(Confidence: ${confidence}, based on in-session evidence.)*`;
}

export function buildAttemptsSummaryForPrompt(
  attempts: QuestionAttemptInput[]
): string {
  return attempts
    .map((a, i) => {
      const status = a.isCorrect ? "CORRECT" : "INCORRECT";
      const qText = a.questionText
        ? truncatePreview(a.questionText, 300)
        : truncatePreview(a.questionPreview);
      const selectedTxt = a.selectedAnswerText
        ? truncatePreview(a.selectedAnswerText, 120)
        : a.selectedAnswerIndex != null
          ? `option ${a.selectedAnswerIndex}`
          : "not answered";
      const correctTxt = a.correctAnswerText
        ? truncatePreview(a.correctAnswerText, 120)
        : `option ${a.correctAnswerIndex}`;
      const lines = [
        `Q${i + 1} [${status}] topic=${a.topic ?? "?"} kc=${a.kcId ?? "?"} diff=${a.difficulty ?? "?"} time=${a.timeSpentSec ?? "?"}s`,
        qText ? `  Question: ${qText}` : "",
        !a.isCorrect ? `  Student answered: ${selectedTxt}` : "",
        !a.isCorrect ? `  Correct answer: ${correctTxt}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n");
}

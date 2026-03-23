import type {
  FocusArea,
  GeneralFeedbackStructured,
  QuestionAttemptInput,
  QuizSubject,
  SessionFeedbackStructured,
} from "./types";
import { buildSessionFeedbackStructured } from "./session-feedback";

export interface AttemptWithMeta extends QuestionAttemptInput {
  quizResultId: number;
  sessionCreatedAt: string; // ISO-ish sqlite datetime
  subject: QuizSubject;
}

const MS_PER_DAY = 86400000;

function parseSessionTime(createdAt: string): number {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

/**
 * Recency-weighted aggregate weakness per KC/topic key across all history.
 */
export function buildGeneralSubjectFeedback(
  subject: QuizSubject,
  attemptsWithMeta: AttemptWithMeta[],
  pastSessionFeedbacks: SessionFeedbackStructured[],
  nowMs: number = Date.now()
): GeneralFeedbackStructured {
  const subjectAttempts = attemptsWithMeta.filter((a) => a.subject === subject);

  if (subjectAttempts.length === 0 && pastSessionFeedbacks.length === 0) {
    return {
      subject,
      primaryFocus: null,
      secondaryFocus: [],
      actionPlan: ["Take a few quizzes to unlock cumulative coaching."],
      confidence: "low",
      trend: "insufficient_data",
      evidenceSummary: "No historical attempts yet for this subject.",
      sessionCount: 0,
      attemptCount: 0,
    };
  }

  const sessionIds = new Set(subjectAttempts.map((a) => a.quizResultId));
  const sessionCount = sessionIds.size;
  const attemptCount = subjectAttempts.length;

  type Agg = {
    key: string;
    label: string;
    kcId?: string;
    topic?: string;
    total: number;
    wrong: number;
    recencyWeightedWrong: number;
    evidenceIds: string[];
  };

  const byKey = new Map<string, Agg>();

  for (const a of subjectAttempts) {
    const ageDays = (nowMs - parseSessionTime(a.sessionCreatedAt)) / MS_PER_DAY;
    const recency = Math.exp(-ageDays / 21);
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
        wrong: 0,
        recencyWeightedWrong: 0,
        evidenceIds: [],
      });
    }
    const g = byKey.get(key)!;
    g.total++;
    if (!a.isCorrect) {
      g.wrong++;
      g.recencyWeightedWrong += recency;
      if (g.evidenceIds.length < 15) g.evidenceIds.push(a.questionId);
    }
  }

  // Blend prior session primary focuses (continuity)
  for (const sf of pastSessionFeedbacks) {
    if (sf.subject !== subject || !sf.primaryFocus) continue;
    const pf = sf.primaryFocus;
    const key = pf.kcId || pf.topic || pf.label;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: pf.label,
        kcId: pf.kcId,
        topic: pf.topic,
        total: 1,
        wrong: 1,
        recencyWeightedWrong: 1,
        evidenceIds: [...pf.evidenceQuestionIds].slice(0, 8),
      });
    } else {
      const g = byKey.get(key)!;
      g.total += 2;
      g.wrong += 1;
      g.recencyWeightedWrong += 1;
      for (const id of pf.evidenceQuestionIds) {
        if (g.evidenceIds.length < 15) g.evidenceIds.push(id);
      }
    }
  }

  const focusList: FocusArea[] = [];
  for (const g of byKey.values()) {
    const wrongRate = g.total > 0 ? g.wrong / g.total : 0;
    const avgRecWrong = g.wrong > 0 ? g.recencyWeightedWrong / g.wrong : 0;
    const weaknessScore =
      wrongRate * 100 + avgRecWrong * 12 + g.evidenceIds.length * 0.35;
    focusList.push({
      label: g.label,
      kcId: g.kcId,
      topic: g.topic,
      weaknessScore,
      evidenceQuestionIds: [...new Set(g.evidenceIds)].slice(0, 15),
      correctInArea: g.total - g.wrong,
      totalInArea: g.total,
    });
  }

  focusList.sort((a, b) => b.weaknessScore - a.weaknessScore);

  const primaryFocus = focusList[0] ?? null;
  const secondaryFocus = focusList.slice(1, 3);

  const scoresBySession = Array.from(sessionIds)
    .map((id) => {
      const rows = subjectAttempts.filter((x) => x.quizResultId === id);
      const c = rows.filter((x) => x.isCorrect).length;
      return rows.length ? c / rows.length : 0;
    })
    .sort((a, b) => a - b);

  let trend: GeneralFeedbackStructured["trend"] = "insufficient_data";
  if (scoresBySession.length >= 2) {
    const mid = Math.floor(scoresBySession.length / 2);
    const early = scoresBySession.slice(0, mid);
    const late = scoresBySession.slice(mid);
    const eAvg = early.reduce((s, x) => s + x, 0) / early.length;
    const lAvg = late.reduce((s, x) => s + x, 0) / late.length;
    const delta = lAvg - eAvg;
    if (delta > 0.06) trend = "improving";
    else if (delta < -0.06) trend = "declining";
    else trend = "stable";
  } else if (scoresBySession.length === 1) {
    trend = "stable";
  }

  let confidence: GeneralFeedbackStructured["confidence"] = "medium";
  if (attemptCount < 20 || sessionCount < 2) confidence = "low";
  else if (attemptCount >= 80 && sessionCount >= 4) confidence = "high";

  const actionPlan: string[] = [];
  if (primaryFocus) {
    actionPlan.push(
      `Main focus: **${primaryFocus.label}**. Schedule spaced practice (short daily blocks) using questions similar to your missed items.`
    );
  }
  for (const s of secondaryFocus) {
    actionPlan.push(`Keep ${s.label} in rotation with mixed review.`);
  }
  if (trend === "improving") {
    actionPlan.push(
      "Trend: improving. Keep difficulty progression steady and avoid cramming."
    );
  } else if (trend === "declining") {
    actionPlan.push(
      "Trend: recent sessions are a bit weaker. Slow down and revisit fundamentals in your top gap area."
    );
  }

  const evidenceSummary =
    primaryFocus && attemptCount > 0
      ? `Across ${sessionCount} quiz session(s) and ${attemptCount} attempts, cumulative evidence points to **${primaryFocus.label}** as the priority.`
      : "Cumulative coaching based on your recorded history.";

  return {
    subject,
    primaryFocus,
    secondaryFocus,
    actionPlan: actionPlan.slice(0, 6),
    confidence,
    trend,
    evidenceSummary,
    sessionCount,
    attemptCount,
  };
}

export function buildDeterministicGeneralNarrative(
  structured: GeneralFeedbackStructured
): string {
  const {
    primaryFocus,
    secondaryFocus,
    actionPlan,
    trend,
    confidence,
    sessionCount,
    attemptCount,
  } = structured;

  const trendLine =
    trend === "improving"
      ? "Your recent quiz performance looks **improving** overall."
      : trend === "declining"
        ? "Your recent quiz performance shows some **strain**. Prioritize depth over speed."
        : trend === "stable"
          ? "Performance looks **steady**. Refine weak pockets."
          : "Not enough sessions yet for a strong trend line.";

  const focusLine = primaryFocus
    ? `Top priority: **${primaryFocus.label}** (supported by your missed-question patterns over time).`
    : "Keep practicing broadly until patterns emerge.";

  const sec =
    secondaryFocus.length > 0
      ? `Also allocate time to: ${secondaryFocus.map((s) => s.label).join(", ")}.`
      : "";

  const steps = actionPlan.map((a) => `- ${a}`).join("\n");

  return `${trendLine}

${focusLine} ${sec}

**Plan**
${steps}

_Data: ${sessionCount} session(s), ${attemptCount} recorded attempt(s). Confidence: ${confidence}._`;
}

/**
 * Convert flat attempts from one session into structured feedback (helper for tests).
 */
export function sessionFromAttempts(
  subject: QuizSubject,
  attempts: QuestionAttemptInput[]
): SessionFeedbackStructured {
  return buildSessionFeedbackStructured(subject, attempts);
}

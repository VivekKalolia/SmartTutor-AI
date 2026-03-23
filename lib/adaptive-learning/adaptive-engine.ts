/**
 * Adaptive Quiz Engine
 *
 * Provides types and pure functions for:
 *  - Parsing MathBench CSV rows into typed questions
 *  - Tracking per-KC mastery (rule-based; IEKT-ready)
 *  - Selecting the next question based on mastery + difficulty
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdaptiveQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3 index
  explanation: string;
  topic: string; // human-readable label
  difficulty: Difficulty;
  /** MathBench KC (ALGEBRA_*) or SciQ KC (SCIENCE_*) */
  kc_id: string;
  level?: string; // MathBench level (arithmetic, …); optional for SciQ
  /** 1-based row index aligned with IEKT item embedding table */
  q_index?: number;
}

export type Difficulty = "easy" | "medium" | "hard" | "very_hard";

export const DIFFICULTIES: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "very_hard",
] as const;

export const KC_IDS = [
  "ALGEBRA_GENERAL",
  "GEOMETRY_SHAPES",
  "PROBABILITY_STATISTICS",
  "FUNCTIONS_GRAPHS",
  "MATH_OTHER",
] as const;

export type KcId = (typeof KC_IDS)[number];

export const KC_DISPLAY_NAMES: Record<KcId, string> = {
  ALGEBRA_GENERAL: "Algebra",
  GEOMETRY_SHAPES: "Geometry",
  PROBABILITY_STATISTICS: "Probability & Statistics",
  FUNCTIONS_GRAPHS: "Functions & Graphs",
  MATH_OTHER: "General Math",
};

/** SciQ / science quiz: same selection algorithm as math, different KC universe */
export const SCIENCE_KC_IDS = [
  "SCIENCE_PHYSICS",
  "SCIENCE_CHEMISTRY",
  "SCIENCE_BIOLOGY",
  "SCIENCE_EARTH_SPACE",
  "SCIENCE_GENERAL",
] as const;

export type ScienceKcId = (typeof SCIENCE_KC_IDS)[number];

export const SCIENCE_KC_DISPLAY_NAMES: Record<ScienceKcId, string> = {
  SCIENCE_PHYSICS: "Physics",
  SCIENCE_CHEMISTRY: "Chemistry",
  SCIENCE_BIOLOGY: "Biology",
  SCIENCE_EARTH_SPACE: "Earth & Space",
  SCIENCE_GENERAL: "General Science",
};

export const DIFFICULTY_DISPLAY: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very Hard",
};

export const SESSION_LENGTH = 20;

// ---------------------------------------------------------------------------
// Mastery tracking
// ---------------------------------------------------------------------------

export type MasteryState = Record<string, number>; // kc_id → 0.0 … 1.0

export function initializeMastery(): MasteryState {
  const m: MasteryState = {};
  for (const kc of KC_IDS) m[kc] = 0.5;
  return m;
}

export function initializeScienceMastery(): MasteryState {
  const m: MasteryState = {};
  for (const kc of SCIENCE_KC_IDS) m[kc] = 0.5;
  return m;
}

// ---------------------------------------------------------------------------
// Question selection
// ---------------------------------------------------------------------------

function difficultyForMastery(score: number): Difficulty {
  if (score < 0.3) return "easy";
  if (score < 0.5) return "medium";
  if (score < 0.7) return "hard";
  return "very_hard";
}

export type SelectNextQuestionOptions = {
  /** KCs considered for sorting / targeting (math: KC_IDS, science: SCIENCE_KC_IDS) */
  kcOrder: readonly string[];
  /**
   * Optional per-KC caps computed from pool distribution (see computeKcCaps).
   * Prevents overrepresented KCs (e.g. Probability) from dominating the session.
   */
  kcCaps?: Map<string, number>;
};

/**
 * Compute fair per-KC session caps based on pool distribution.
 *
 * Each KC gets a cap proportional to its inverse representation in the pool,
 * clamped to [3, sessionLength/numKcs + 2]. KCs with fewer pool questions
 * get a slightly higher cap; overrepresented KCs are capped more aggressively.
 */
export function computeKcCaps(
  pool: AdaptiveQuestion[],
  sessionLength: number = SESSION_LENGTH
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of pool) {
    counts.set(q.kc_id, (counts.get(q.kc_id) ?? 0) + 1);
  }
  const total = pool.length;
  const numKcs = counts.size || 1;
  const fairShare = sessionLength / numKcs;
  const caps = new Map<string, number>();

  for (const [kc, cnt] of counts) {
    const poolRatio = cnt / total;
    const fairRatio = 1 / numKcs;
    // If overrepresented in pool, reduce cap; if underrepresented, allow slightly more
    const rawCap = (fairRatio / poolRatio) * fairShare;
    const cap = Math.max(3, Math.min(Math.ceil(fairShare) + 2, Math.round(rawCap)));
    caps.set(kc, cap);
  }
  return caps;
}

/**
 * Select the next question adaptively.
 *
 * Strategy:
 *  1. First question → always easy, random KC.
 *  2. Otherwise → target the weakest KC at a difficulty matched to its
 *     mastery score. Relax constraints (adjacent difficulty, any difficulty,
 *     other KCs) if no candidates remain.
 *  3. Per-KC caps (from computeKcCaps) enforce topic balance even when
 *     one KC dominates the question pool.
 *
 * Math and science use the same logic; pass `kcOrder` for science.
 */
export function selectNextQuestion(
  mastery: MasteryState,
  pool: AdaptiveQuestion[],
  answeredIds: Set<string>,
  questionNumber: number, // 1-based position in session
  options?: SelectNextQuestionOptions
): AdaptiveQuestion | null {
  const kcOrder = options?.kcOrder ?? (KC_IDS as readonly string[]);

  const unanswered = pool.filter((q) => !answeredIds.has(q.id));
  if (unanswered.length === 0) return null;
  const answered = pool.filter((q) => answeredIds.has(q.id));

  // Use dynamic per-KC caps from pool distribution, or fall back to default
  const defaultCap = Math.max(4, Math.ceil(SESSION_LENGTH / Math.max(kcOrder.length, 1)) + 1);
  const DIVERSITY_TARGET_BY_Q10 = 3;

  const kcCounts = new Map<string, number>();
  for (const q of answered) {
    kcCounts.set(q.kc_id, (kcCounts.get(q.kc_id) ?? 0) + 1);
  }

  const underCapUnanswered = unanswered.filter(
    (q) => (kcCounts.get(q.kc_id) ?? 0) < (options?.kcCaps?.get(q.kc_id) ?? defaultCap)
  );
  const candidatePool = underCapUnanswered.length > 0 ? underCapUnanswered : unanswered;

  // Q1 → diagnostic: easy, any KC
  if (questionNumber <= 1) {
    const easy = candidatePool.filter((q) => q.difficulty === "easy");
    if (easy.length) return easy[Math.floor(Math.random() * easy.length)];
    const med = candidatePool.filter((q) => q.difficulty === "medium");
    if (med.length) return med[Math.floor(Math.random() * med.length)];
    return candidatePool[Math.floor(Math.random() * candidatePool.length)];
  }

  // Early diversity push: by Q10, try to expose at least 3 distinct KCs.
  const distinctAnsweredKcs = new Set(answered.map((q) => q.kc_id));
  if (
    questionNumber <= 10 &&
    distinctAnsweredKcs.size < DIVERSITY_TARGET_BY_Q10
  ) {
    const unseenKcQuestions = candidatePool.filter(
      (q) => !distinctAnsweredKcs.has(q.kc_id)
    );
    if (unseenKcQuestions.length) {
      return unseenKcQuestions[
        Math.floor(Math.random() * unseenKcQuestions.length)
      ];
    }
  }

  // Sort KCs by mastery (weakest first)
  const sorted = Object.entries(mastery)
    .filter(([kc]) => kcOrder.includes(kc))
    .sort(([, a], [, b]) => a - b);

  for (const [kc, kcMastery] of sorted.slice(0, 3)) {
    const target = difficultyForMastery(kcMastery);

    // Exact match
    let cands = candidatePool.filter(
      (q) => q.kc_id === kc && q.difficulty === target
    );
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];

    // Adjacent difficulties
    const idx = DIFFICULTIES.indexOf(target);
    const adjacent = [
      idx > 0 ? DIFFICULTIES[idx - 1] : null,
      idx < DIFFICULTIES.length - 1 ? DIFFICULTIES[idx + 1] : null,
    ].filter(Boolean) as Difficulty[];

    for (const d of adjacent) {
      cands = candidatePool.filter((q) => q.kc_id === kc && q.difficulty === d);
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }

    // Any difficulty for this KC
    cands = candidatePool.filter((q) => q.kc_id === kc);
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
  }

  return candidatePool[Math.floor(Math.random() * candidatePool.length)];
}

// ---------------------------------------------------------------------------
// CSV helpers (used server-side by the API route)
// ---------------------------------------------------------------------------

/** Parse a Python list literal such as `['a', 'b', 'c']` into a JS array. */
export function parsePythonList(raw: string): string[] {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return [s];

  const inner = s.slice(1, -1);
  const items: string[] = [];
  let cur = "";
  let inQ = false;
  let qc = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (!inQ) {
      if (ch === "'" || ch === '"') {
        inQ = true;
        qc = ch;
      } else if (ch === ",") {
        items.push(cur.trim());
        cur = "";
      }
    } else if (ch === "\\" && i + 1 < inner.length) {
      cur += ch + inner[i + 1];
      i++;
    } else if (ch === qc) {
      inQ = false;
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) items.push(cur.trim());
  return items;
}

export function answerLetterToIndex(letter: string): number {
  return { A: 0, B: 1, C: 2, D: 3 }[letter.toUpperCase()] ?? 0;
}

const TOPIC_LABELS: Record<string, string> = {
  algebra: "Algebra",
  geometry: "Geometry",
  probability_statistics: "Probability & Statistics",
  functions: "Functions & Graphs",
  other: "General Math",
};

export function formatTopicLabel(raw: string): string {
  return TOPIC_LABELS[raw.toLowerCase()] ?? raw;
}

// ---------------------------------------------------------------------------
// CSV line parser (handles quoted fields that may contain commas / newlines)
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line into an array of field values.
 * Handles double-quoted fields (RFC 4180 style).
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

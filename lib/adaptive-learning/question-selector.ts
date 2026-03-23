/**
 * Question Selection Algorithm
 * Uses IEKT predictions to select appropriate questions from English datasets
 */

import { KnowledgeState } from "@/lib/features/adaptive-learning/adaptiveSlice";

export interface Question {
  id: number | string;
  question: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  concept?: string | number; // Knowledge component/concept
  difficulty?: number; // 1-5 scale
  topic?: string;
}

export interface QuestionPool {
  questions: Question[];
  byConcept: Record<string, Question[]>;
  byDifficulty: Record<number, Question[]>;
}

import kcMappingData from "@/lib/data/kc-mapping.json";

/**
 * Map XES3G5M knowledge components to English question concepts
 * Uses the KC mapping file to connect Chinese KCs to English topics
 */
export function mapKCToEnglishConcept(kc: string | number): string[] {
  const kcStr = String(kc);

  // Find which English topics map to this KC
  const topics: string[] = [];

  for (const [topic, kcList] of Object.entries(kcMappingData.topic_to_kc)) {
    if (kcList.includes(kcStr)) {
      topics.push(topic);
    }
  }

  // If no mapping found, return empty array (will use fallback)
  return topics.length > 0 ? topics : [];
}

/**
 * Map English topic to XES3G5M KCs (reverse mapping)
 */
export function mapEnglishTopicToKC(topic: string): string[] {
  return (kcMappingData.topic_to_kc as Record<string, string[]>)[topic] || [];
}

/**
 * Select next question based on IEKT predictions
 */
export function selectNextQuestion(
  knowledgeState: KnowledgeState,
  questionPool: QuestionPool,
  recentlyAnswered: Set<number | string> = new Set(),
  options: {
    targetWeakKCs?: boolean;
    difficultyRange?: [number, number];
    avoidRecent?: boolean;
    maxRecentCount?: number;
  } = {}
): Question | null {
  const {
    targetWeakKCs = true,
    difficultyRange = [2, 4], // Medium difficulty
    avoidRecent = true,
    maxRecentCount = 5,
  } = options;

  // Get recommended knowledge components (weak areas)
  const targetKCs = targetWeakKCs
    ? knowledgeState.recommended_kcs
    : Object.keys(knowledgeState.mastery_per_kc);

  if (targetKCs.length === 0) {
    // If no specific KCs, use all available
    targetKCs.push(...Object.keys(knowledgeState.mastery_per_kc));
  }

  // Filter questions by concept
  let candidateQuestions: Question[] = [];

  for (const kc of targetKCs) {
    const englishTopics = mapKCToEnglishConcept(kc);

    // For each English topic that maps to this KC, get questions
    for (const topic of englishTopics) {
      const questionsForTopic = questionPool.byConcept[topic] || [];
      candidateQuestions.push(...questionsForTopic);
    }

    // Also check direct concept mapping if question has concept field
    const questionsWithKC = questionPool.questions.filter(
      (q) => q.concept && String(q.concept) === String(kc)
    );
    candidateQuestions.push(...questionsWithKC);
  }

  // If no questions found for target KCs, use all questions
  if (candidateQuestions.length === 0) {
    candidateQuestions = questionPool.questions;
  }

  // Filter by difficulty
  const filteredByDifficulty = candidateQuestions.filter((q) => {
    if (!q.difficulty) return true; // Include if difficulty not set
    return (
      q.difficulty >= difficultyRange[0] && q.difficulty <= difficultyRange[1]
    );
  });

  // Use difficulty-filtered if available, otherwise use all candidates
  const difficultyFiltered =
    filteredByDifficulty.length > 0 ? filteredByDifficulty : candidateQuestions;

  // Avoid recently answered questions
  let finalCandidates = difficultyFiltered;
  if (avoidRecent && recentlyAnswered.size > 0) {
    finalCandidates = difficultyFiltered.filter(
      (q) => !recentlyAnswered.has(q.id)
    );

    // If all questions were recently answered, allow some repeats
    if (
      finalCandidates.length === 0 &&
      recentlyAnswered.size < maxRecentCount
    ) {
      finalCandidates = difficultyFiltered;
    }
  }

  // Select question based on mastery level
  // Prefer questions for KCs with lower mastery
  if (finalCandidates.length > 0) {
    // Score each question based on how weak the corresponding KC is
    const scoredQuestions = finalCandidates.map((q) => {
      let weaknessScore = 0.5; // Default score

      // If question has a concept, find matching KCs
      if (q.concept) {
        const kcStr = String(q.concept);
        const mastery = knowledgeState.mastery_per_kc[kcStr] || 0.5;
        weaknessScore = 1 - mastery;
      } else if (q.topic) {
        // Map topic to KCs and find weakest
        const kcs = mapEnglishTopicToKC(q.topic);
        if (kcs.length > 0) {
          const masteries = kcs.map(
            (kc) => knowledgeState.mastery_per_kc[kc] || 0.5
          );
          const avgMastery =
            masteries.reduce((a, b) => a + b, 0) / masteries.length;
          weaknessScore = 1 - avgMastery;
        }
      }

      return {
        question: q,
        score: weaknessScore,
      };
    });

    // Sort by score (highest = weakest KC)
    scoredQuestions.sort((a, b) => b.score - a.score);

    // Select from top candidates (add some randomness)
    const topN = Math.min(5, scoredQuestions.length);
    const topCandidates = scoredQuestions.slice(0, topN);
    const selected =
      topCandidates[Math.floor(Math.random() * topCandidates.length)];

    return selected.question;
  }

  // Fallback: return random question
  if (questionPool.questions.length > 0) {
    return questionPool.questions[
      Math.floor(Math.random() * questionPool.questions.length)
    ];
  }

  return null;
}

/**
 * Organize questions into a question pool with indexing
 */
export function createQuestionPool(questions: Question[]): QuestionPool {
  const byConcept: Record<string, Question[]> = {};
  const byDifficulty: Record<number, Question[]> = {};

  questions.forEach((q) => {
    // Index by concept
    const concept = q.concept ? String(q.concept) : "unknown";
    if (!byConcept[concept]) {
      byConcept[concept] = [];
    }
    byConcept[concept].push(q);

    // Index by difficulty
    const difficulty = q.difficulty || 3; // Default to medium
    if (!byDifficulty[difficulty]) {
      byDifficulty[difficulty] = [];
    }
    byDifficulty[difficulty].push(q);
  });

  return {
    questions,
    byConcept,
    byDifficulty,
  };
}

/**
 * Get questions targeting specific knowledge components
 */
export function getQuestionsForKCs(
  questionPool: QuestionPool,
  kcList: string[]
): Question[] {
  const questions: Question[] = [];
  const seen = new Set<number | string>();

  for (const kc of kcList) {
    const englishTopics = mapKCToEnglishConcept(kc);
    for (const topic of englishTopics) {
      const kcQuestions = questionPool.byConcept[topic] || [];
      for (const q of kcQuestions) {
        if (!seen.has(q.id)) {
          questions.push(q);
          seen.add(q.id);
        }
      }
    }
  }

  return questions;
}

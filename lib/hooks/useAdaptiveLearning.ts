/**
 * Custom hook for adaptive learning integration.
 * Manages question selection, knowledge state, and mastery tracking
 * using the DKT (Deep Knowledge Tracing) model running in the Python backend.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/lib/store";
import {
  setStudentId,
  addInteraction,
  setKnowledgeState,
  setLoading,
  setError,
  Interaction,
  KnowledgeState,
} from "@/lib/features/adaptive-learning/adaptiveSlice";
import {
  selectNextQuestion,
  createQuestionPool,
  Question,
  QuestionPool,
} from "@/lib/adaptive-learning/question-selector";
import { mapEnglishTopicToKC } from "@/lib/adaptive-learning/question-selector";

export function useAdaptiveLearning(subject: "math" | "science") {
  const dispatch = useDispatch<AppDispatch>();
  const adaptiveState = useSelector(
    (state: RootState) => state.adaptiveLearning
  );

  const [questionPool, setQuestionPool] = useState<QuestionPool | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [recentlyAnswered, setRecentlyAnswered] = useState<
    Set<string | number>
  >(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const initializingRef = useRef(false);

  // Initialize: Load questions and set up student (non-blocking)
  useEffect(() => {
    if (subject === "math" && !isInitialized && !initializingRef.current) {
      initializingRef.current = true;
      initializeMathQuestions();
    }
  }, [subject, isInitialized]);

  const initializeMathQuestions = async () => {
    try {
      // Don't set loading to true - let the page render immediately
      // dispatch(setLoading(true));

      // Initialize student ID first
      if (!adaptiveState.currentStudentId) {
        const studentId = `student_${Date.now()}`;
        dispatch(setStudentId(studentId));
      }

      // Try to load questions from API with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      try {
        const response = await fetch(
          "/api/adaptive-learning/questions?limit=100",
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const mathQuestions = data.questions || [];

          if (mathQuestions.length > 0) {
            const questions: Question[] = mathQuestions.map((q: any) => ({
              id: q.id,
              question: q.question,
              options: q.options || [],
              correctAnswer:
                q.correctAnswer !== undefined ? q.correctAnswer : undefined,
              explanation: `Answer: ${q.answer}`,
              concept: q.concept,
              difficulty:
                q.difficulty === "easy" ? 1 : q.difficulty === "medium" ? 3 : 5,
              topic: q.topic,
            }));

            const pool = createQuestionPool(questions);
            setQuestionPool(pool);

            if (pool.questions.length > 0) {
              setCurrentQuestion(pool.questions[0]);
            }
          }
        }
      } catch {
        // No pool if the API is down; quiz can still mount with empty state.
      }

      setIsInitialized(true);
    } catch {
      setIsInitialized(true);
    } finally {
      initializingRef.current = false;
      dispatch(setLoading(false));
    }
  };

  // Get next question based on knowledge state
  const getNextQuestion = useCallback(async () => {
    if (!questionPool || !adaptiveState.currentStudentId) {
      return null;
    }

    // If we have knowledge state, use adaptive selection
    if (adaptiveState.knowledgeState) {
      const nextQ = selectNextQuestion(
        adaptiveState.knowledgeState,
        questionPool,
        recentlyAnswered,
        {
          targetWeakKCs: true,
          difficultyRange: [2, 4],
          avoidRecent: true,
          maxRecentCount: 10,
        }
      );

      if (nextQ) {
        setCurrentQuestion(nextQ);
        return nextQ;
      }
    }

    // Fallback: random question
    if (questionPool.questions.length > 0) {
      const randomQ =
        questionPool.questions[
          Math.floor(Math.random() * questionPool.questions.length)
        ];
      setCurrentQuestion(randomQ);
      return randomQ;
    }

    return null;
  }, [questionPool, adaptiveState.knowledgeState, recentlyAnswered]);

  // Update knowledge state after answering
  const updateAfterAnswer = useCallback(
    async (questionId: string | number, isCorrect: boolean, topic?: string) => {
      if (!adaptiveState.currentStudentId) return;

      // Create interaction record
      const interaction: Interaction = {
        qid:
          typeof questionId === "string"
            ? parseInt(questionId) || 0
            : questionId,
        concept:
          topic ||
          currentQuestion?.concept ||
          currentQuestion?.topic ||
          "unknown",
        correct: isCorrect ? 1 : 0,
        timestamp: Date.now(),
      };

      dispatch(addInteraction(interaction));

      // Add to recently answered
      setRecentlyAnswered((prev) => {
        const newSet = new Set(prev);
        newSet.add(questionId);
        // Keep only last 10
        if (newSet.size > 10) {
          const arr = Array.from(newSet);
          newSet.clear();
          arr.slice(-10).forEach((id) => newSet.add(id));
        }
        return newSet;
      });

      // Update knowledge state via API
      try {
        dispatch(setLoading(true));

        const response = await fetch("/api/adaptive-learning/update-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: adaptiveState.currentStudentId,
            newInteraction: interaction,
          }),
        });

        if (response.ok) {
          const updatedState: KnowledgeState = await response.json();
          dispatch(setKnowledgeState(updatedState));
        } else {
          throw new Error("Failed to update knowledge state");
        }
      } catch (error) {
        console.error("Error updating knowledge state:", error);
        dispatch(setError("Failed to update knowledge state"));

        // Fallback: update local mastery estimate
        if (topic) {
          // Simple local update (will be replaced by IEKT predictions)
          const currentMastery =
            adaptiveState.knowledgeState?.mastery_per_kc[topic] || 0.65;
          const newMastery = isCorrect
            ? Math.min(1.0, currentMastery + 0.05)
            : Math.max(0.0, currentMastery - 0.03);

          const fallbackState: KnowledgeState = {
            student_id: adaptiveState.currentStudentId || "",
            mastery_per_kc: {
              ...adaptiveState.knowledgeState?.mastery_per_kc,
              [topic]: newMastery,
            },
            recommended_kcs: [],
            overall_mastery: newMastery,
            num_interactions: adaptiveState.interactionHistory.length + 1,
          };
          dispatch(setKnowledgeState(fallbackState));
        }
      } finally {
        dispatch(setLoading(false));
      }
    },
    [
      adaptiveState.currentStudentId,
      adaptiveState.knowledgeState,
      currentQuestion,
      dispatch,
    ]
  );

  // Get mastery for a specific topic/KC
  const getMastery = useCallback(
    (topic: string): number => {
      if (!adaptiveState.knowledgeState) return 0.65; // Default

      // Check direct topic mapping
      const mastery = adaptiveState.knowledgeState.mastery_per_kc[topic];
      if (mastery !== undefined) return mastery;

      // Check KC mappings for this topic
      const kcs = mapEnglishTopicToKC(topic);
      if (kcs.length > 0) {
        const masteries = kcs
          .map((kc) => adaptiveState.knowledgeState?.mastery_per_kc[kc])
          .filter((m): m is number => m !== undefined);

        if (masteries.length > 0) {
          return masteries.reduce((a, b) => a + b, 0) / masteries.length;
        }
      }

      return adaptiveState.knowledgeState.overall_mastery;
    },
    [adaptiveState.knowledgeState]
  );

  return {
    currentQuestion,
    questionPool,
    knowledgeState: adaptiveState.knowledgeState,
    isLoading: adaptiveState.isLoading,
    error: adaptiveState.error,
    getNextQuestion,
    updateAfterAnswer,
    getMastery,
    isInitialized,
  };
}

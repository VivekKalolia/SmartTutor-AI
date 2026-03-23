"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/lib/store";
import {
  setSubject,
  setQuestionIndex,
  setAnswer,
  toggleAIAssist,
  resetQuiz,
} from "@/lib/features/quiz/quizSlice";
import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AnswerResultBadge,
  TopicBadge,
  DifficultyBadge,
} from "@/components/quiz-badges";
import {
  Brain,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Calculator,
  Atom,
  Play,
  Volume2,
  VolumeX,
  Clock,
  TrendingUp,
  HelpCircle,
  RotateCcw,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { aiAssistResponses } from "@/lib/demo-data";
import { useTTS } from "@/lib/hooks/useTTS";
import { AIAssistSheet } from "@/components/ai-assist-sheet";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Progress as MantineProgress } from "@mantine/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdaptiveQuestion } from "@/lib/adaptive-learning/adaptive-engine";
import {
  SESSION_LENGTH,
  initializeMastery,
  initializeScienceMastery,
  selectNextQuestion,
  computeKcCaps,
  KC_IDS,
  SCIENCE_KC_IDS,
  KC_DISPLAY_NAMES,
  SCIENCE_KC_DISPLAY_NAMES,
  type MasteryState,
} from "@/lib/adaptive-learning/adaptive-engine";

type QuizQuestion = AdaptiveQuestion & { explanation: string };

function previewText(s: string, max = 180): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export default function QuizPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentSubject, currentQuestionIndex, answers, showAIAssist } =
    useSelector((state: RootState) => state.quiz);

  const [pool, setPool] = useState<AdaptiveQuestion[]>([]);
  const [sessionQs, setSessionQs] = useState<QuizQuestion[]>([]);
  const [masteryState, setMasteryState] = useState<MasteryState>({});
  const [poolError, setPoolError] = useState<string | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "correct" | "incorrect" | null;
    message: string;
  }>({ type: null, message: "" });
  const [showReview, setShowReview] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintContent, setHintContent] = useState("");
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const tts = useTTS();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(
    null
  );
  const [topicMastery, setTopicMastery] = useState<Record<string, number>>({});
  const [displayedMastery, setDisplayedMastery] = useState(50);
  const dktStudentIdRef = useRef(`student_${Date.now()}`);
  // Balanced per-KC caps computed from pool distribution once pool loads
  const kcCapsRef = useRef<Map<string, number>>(new Map());
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(
    {}
  );
  const [correctAnswers, setCorrectAnswers] = useState<
    Record<number, boolean>
  >({});
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showMasteryInfo, setShowMasteryInfo] = useState(false);
  const [savingResults, setSavingResults] = useState(false);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sessionAIFeedback, setSessionAIFeedback] = useState<string | null>(null);

  useEffect(() => {
    dispatch(resetQuiz());
    dispatch(setSubject(null));
    setSessionStarted(false);
    setSessionQs([]);
    setPool([]);
    setPoolError(null);
    setMasteryState({});
    setTopicMastery({});
    setShowReview(false);
    setResultsSaved(false);
    setSaveError(false);
    setSessionAIFeedback(null);
    setFeedback({ type: null, message: "" });
    setShowHint(false);
    setIsSubmitted(false);
    setQuestionTimes({});
    setCorrectAnswers({});
    dktStudentIdRef.current = `student_${Date.now()}`;
  }, [dispatch]);

  const questions = sessionQs;
  const currentQ = questions[currentQuestionIndex];

  const currentTopic = currentQ?.topic || "";
  const currentTopicMastery = currentTopic
    ? topicMastery[currentTopic] ?? 50
    : 50;

  useEffect(() => {
    setDisplayedMastery(currentTopicMastery);
  }, [currentTopicMastery, currentTopic]);

  const kcOrder = currentSubject === "science" ? SCIENCE_KC_IDS : KC_IDS;
  const kcLabels =
    currentSubject === "science"
      ? SCIENCE_KC_DISPLAY_NAMES
      : KC_DISPLAY_NAMES;

  const fetchPool = useCallback(async (subject: "math" | "science") => {
    setLoadingPool(true);
    setPoolError(null);
    try {
      const res = await fetch(
        `/api/adaptive-learning/questions?subject=${subject}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.questions?.length) throw new Error("No questions loaded");
      const qs = data.questions as AdaptiveQuestion[];
      setPool(qs);
      // Compute fair per-KC caps once so overrepresented topics don't dominate
      kcCapsRef.current = computeKcCaps(qs);
      return qs;
    } catch (e) {
      console.error("[Quiz] Pool load failed:", e);
      setPoolError("Failed to load questions. Check CSV files and try again.");
      setPool([]);
      return null;
    } finally {
      setLoadingPool(false);
    }
  }, []);

  const pickFirstQuestion = useCallback(
    (p: AdaptiveQuestion[], m: MasteryState) => {
      return selectNextQuestion(m, p, new Set(), 1, {
        kcOrder,
        kcCaps: kcCapsRef.current.size > 0 ? kcCapsRef.current : undefined,
      });
    },
    [kcOrder]
  );

  const startSession = async (subject: "math" | "science") => {
    dispatch(setSubject(subject));
    dispatch(setQuestionIndex(0));
    dispatch(resetQuiz());
    setSessionStarted(true);
    setShowReview(false);
    setResultsSaved(false);
    setSessionQs([]);
    setFeedback({ type: null, message: "" });
    setShowHint(false);
    setIsSubmitted(false);
    setQuestionTimes({});
    setCorrectAnswers({});
    setTopicMastery({});

    kcCapsRef.current = new Map();
    const m =
      subject === "science" ? initializeScienceMastery() : initializeMastery();
    setMasteryState(m);

    const p = await fetchPool(subject);
    if (!p?.length) {
      dispatch(setSubject(null));
      setSessionStarted(false);
      return;
    }

    const first = pickFirstQuestion(p, m);
    if (!first) {
      setPoolError("Could not select a starting question.");
      dispatch(setSubject(null));
      setSessionStarted(false);
      return;
    }
    setSessionQs([
      {
        ...first,
        explanation: first.explanation || "",
      },
    ]);
    dispatch(setQuestionIndex(0));
  };

  const handleTTS = (text: string, type: "question" | "feedback" | "hint") => {
    tts.speak(text, type);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showReview || isSubmitted) return;
    dispatch(
      setAnswer({
        questionIndex: currentQuestionIndex,
        answer: answerIndex.toString(),
      })
    );
  };

  const handleSubmit = () => {
    if (!currentQ || !answers[currentQuestionIndex] || isSubmitted) return;

    const userAnswer = answers[currentQuestionIndex];
    const isCorrect = parseInt(userAnswer, 10) === currentQ.correctAnswer;

    setCorrectAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: isCorrect,
    }));

    if (questionStartTime) {
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQuestionIndex]: timeTaken,
      }));
    }

    const subj = currentSubject || "math";
    fetch("/api/adaptive-learning/update-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: dktStudentIdRef.current,
        subject: subj,
        newInteraction: {
          concept: currentQ.kc_id,
          topic: currentQ.topic,
          correct: isCorrect ? 1 : 0,
          q_index: currentQ.q_index ?? currentQuestionIndex + 1,
          kc_id: currentQ.kc_id,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.mastery_per_kc) {
          const nm: Record<string, number> = {};
          const updates: MasteryState = {};
          for (const [k, v] of Object.entries(data.mastery_per_kc)) {
            const val = v as number;
            // IEKT is the sole KT model for selection (KC_ID -> 0..1 mastery).
            updates[k.toUpperCase()] = val;
            // Convert to display label + 0-100 scale for the mastery UI
            const label =
              (kcLabels as Record<string, string>)[k.toUpperCase()] ||
              k.charAt(0).toUpperCase() + k.slice(1);
            nm[label] = val * 100;
          }
          setMasteryState((prev) => ({ ...prev, ...updates }));
          setTopicMastery((prev) => ({ ...prev, ...nm }));
        }
      })
      .catch(() => {
        const label =
          (kcLabels as Record<string, string>)[currentQ.kc_id] ||
          currentQ.topic;
        setTopicMastery((prev) => {
          const cur = prev[label] ?? 50;
          const delta = isCorrect ? 5 : -3;
          return {
            ...prev,
            [label]: Math.max(0, Math.min(100, cur + delta)),
          };
        });
      });

    setFeedback({
      type: isCorrect ? "correct" : "incorrect",
      message: isCorrect
        ? "Correct! Well done."
        : "Incorrect. Please try again.",
    });
    setIsSubmitted(true);
  };

  const appendNextQuestion = useCallback(
    (p: AdaptiveQuestion[], m: MasteryState, answered: Set<string>) => {
      const n = answered.size + 1;
      return selectNextQuestion(m, p, answered, n, {
        kcOrder,
        kcCaps: kcCapsRef.current.size > 0 ? kcCapsRef.current : undefined,
      });
    },
    [kcOrder]
  );

  const handleNextQuestion = () => {
    setIsSubmitted(false);
    setFeedback({ type: null, message: "" });
    setShowHint(false);
    setQuestionTime(0);
    setQuestionStartTime(null);

    const answered = new Set(sessionQs.map((q) => q.id));

    if (currentQuestionIndex < questions.length - 1) {
      dispatch(setQuestionIndex(currentQuestionIndex + 1));
      return;
    }

    if (questions.length >= SESSION_LENGTH || !pool.length) {
      setShowReview(true);
      void saveQuizResults();
      return;
    }

    const next = appendNextQuestion(pool, masteryState, answered);
    if (!next) {
      setShowReview(true);
      void saveQuizResults();
      return;
    }

    setSessionQs((prev) => [
      ...prev,
      { ...next, explanation: next.explanation || "" },
    ]);
    dispatch(setQuestionIndex(currentQuestionIndex + 1));
  };

  const handleRetry = () => {
    dispatch(resetQuiz());
    dispatch(setSubject(null));
    setSessionStarted(false);
    setSessionQs([]);
    setPool([]);
    setFeedback({ type: null, message: "" });
    setShowReview(false);
    setShowHint(false);
    setIsSubmitted(false);
    setQuestionTimes({});
    setCorrectAnswers({});
    setTopicMastery({});
    setResultsSaved(false);
    setSaveError(false);
    setSessionAIFeedback(null);
  };

  const buildAttemptsPayload = () => {
    return questions.map((q, idx) => {
      const sel = answers[idx];
      const selected = sel !== undefined ? parseInt(sel, 10) : null;
      const correct = selected === q.correctAnswer;
      return {
        questionId: q.id,
        questionPreview: previewText(q.question),
        questionText: q.question,
        selectedAnswerText: selected !== null ? q.options[selected] : undefined,
        correctAnswerText: q.options[q.correctAnswer],
        topic: q.topic,
        kcId: q.kc_id,
        difficulty: q.difficulty,
        selectedAnswerIndex: selected,
        correctAnswerIndex: q.correctAnswer,
        isCorrect: correct,
        timeSpentSec: questionTimes[idx],
        retryCount: 0,
        hintUsed: false,
        positionIndex: idx,
      };
    });
  };

  const saveQuizResults = async () => {
    if (resultsSaved || savingResults || !currentSubject || !questions.length) return;
    setSavingResults(true);
    setSaveError(false);
    try {
      const attempts = buildAttemptsPayload();
      const correctCount = attempts.filter((a) => a.isCorrect).length;
      const total = attempts.length;
      const score = Math.round((correctCount / total) * 100);
      const res = await fetch("/api/quiz/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: currentSubject,
          score,
          totalQuestions: total,
          correctCount,
          topicMastery,
          ktSource: "iekt+adaptive",
          durationSeconds: Object.values(questionTimes).reduce((a, b) => a + b, 0),
          attempts,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResultsSaved(true);
        if (data.sessionFeedback?.narrative) {
          setSessionAIFeedback(data.sessionFeedback.narrative);
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.error("[Quiz] Save results API error:", res.status, errText);
        setSaveError(true);
      }
    } catch (e) {
      console.error("[Quiz] Save results failed:", e);
      setSaveError(true);
    } finally {
      setSavingResults(false);
    }
  };

  const handleHint = async () => {
    if (!currentQ) return;
    setShowHint(true);
    setIsLoadingHint(true);
    setHintContent("");
    try {
      const response = await fetch("/api/quiz/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentQ.question,
          model: "llama3.1:8b",
          currentQuestion: currentQ,
          subject: currentSubject,
          mode: "hint",
        }),
      });
      if (!response.ok) throw new Error("hint failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("no reader");
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                acc += data.token;
                setHintContent(acc);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      setHintContent(aiAssistResponses.default);
    } finally {
      setIsLoadingHint(false);
    }
  };

  const submittedCount = Object.keys(questionTimes).length;
  const correctCount = questions.reduce((count, q, idx) => {
    const ua = answers[idx];
    return ua && parseInt(ua, 10) === q.correctAnswer ? count + 1 : count;
  }, 0);
  const questionCompletion =
    questions.length > 0 ? (submittedCount / questions.length) * 100 : 0;

  const answeredIdSet = new Set(sessionQs.map((q) => q.id));
  const atLastInList = currentQuestionIndex >= questions.length - 1;
  const canAppendAnother =
    atLastInList &&
    questions.length < SESSION_LENGTH &&
    pool.length > 0 &&
    appendNextQuestion(pool, masteryState, answeredIdSet) !== null;
  const primaryNextLabel =
    atLastInList && !canAppendAnother ? "Review Answers" : "Next";

  useEffect(() => {
    if (currentSubject && currentQ && !isSubmitted) {
      setQuestionStartTime(Date.now());
      setQuestionTime(0);
      const interval = setInterval(() => {
        setQuestionTime((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentQuestionIndex, currentSubject, currentQ?.id, isSubmitted]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <Layout>
      {!currentSubject ? (
        <div className="flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            <div className="space-y-2">
              <div className="relative flex items-center">
                <h1 className="text-3xl font-bold tracking-tight">Smart Quiz</h1>
                <Sheet open={showMasteryInfo} onOpenChange={setShowMasteryInfo}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 h-8 w-8"
                      style={{ cursor: "pointer" }}
                    >
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-full sm:max-w-lg overflow-y-auto"
                  >
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        How Smart Quiz Works
                      </SheetTitle>
                      <SheetDescription className="text-left">
                        Every session adapts in real time. After each answer, the system runs IEKT (Item-level Knowledge Tracing) to update your mastery estimate and select the most informative next question.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-6 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Question pool</p>
                        <p>
                          Each session draws from either the MathBench pool (covering algebra, calculus, geometry, and more) or the SciQ pool (physics, chemistry, and biology). Sessions run for up to {SESSION_LENGTH} questions, chosen dynamically based on which knowledge components you need most.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Mastery tracking</p>
                        <p>
                          Each answer updates a per-topic mastery estimate (0 to 100%). The algorithm uses your correctness, response time, and retry behaviour to decide whether to consolidate a topic you are shaky on or advance you to something new.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Session results</p>
                        <p>
                          When you finish, your score, per-topic mastery, and time-per-question are saved to your profile. The dashboard shows trends across sessions, and the AI generates personalised feedback highlighting strengths and areas to revisit.
                        </p>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <p className="text-muted-foreground">
                AI-powered assessments that adapt as you go. Choose a subject to begin.
              </p>
            </div>
            {poolError && (
              <Alert variant="destructive">
                <AlertDescription>{poolError}</AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Select a Subject</CardTitle>
                <CardDescription>
                  Choose a subject to begin your adaptive quiz session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="math" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="math">Math</TabsTrigger>
                    <TabsTrigger value="science">Science</TabsTrigger>
                  </TabsList>
                  <TabsContent value="math" className="mt-6">
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="space-y-6">
                          <div className="flex items-start gap-4">
                            <div className="rounded-full bg-[#1E3A8A]/10 p-3">
                              <Calculator className="h-8 w-8 text-[#1E3A8A]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2">
                                Mathematics Quiz
                              </h3>
                              <p className="text-muted-foreground mb-4">
                                Practice across domains from the MathBench-aligned pool. Each run adapts up to {SESSION_LENGTH} questions.
                              </p>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm font-medium">Session length</p>
                                  <p className="text-sm text-muted-foreground">
                                    Up to {SESSION_LENGTH} questions
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Source</p>
                                  <p className="text-sm text-muted-foreground">
                                    MathBench CSV
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => void startSession("math")}
                                className="w-full"
                                size="lg"
                                disabled={loadingPool}
                                style={{ cursor: "pointer" }}
                              >
                                {loadingPool ? (
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-5 w-5" />
                                )}
                                Start Math Quiz
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="science" className="mt-6">
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="space-y-6">
                          <div className="flex items-start gap-4">
                            <div className="rounded-full bg-[#059669]/10 p-3">
                              <Atom className="h-8 w-8 text-[#059669]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2">
                                Science Quiz
                              </h3>
                              <p className="text-muted-foreground mb-4">
                                SciQ-based multiple choice. Each session serves up to {SESSION_LENGTH} adaptive questions.
                              </p>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm font-medium">Session length</p>
                                  <p className="text-sm text-muted-foreground">
                                    Up to {SESSION_LENGTH} questions
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Source</p>
                                  <p className="text-sm text-muted-foreground">
                                    SciQ CSV
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => void startSession("science")}
                                className="w-full"
                                size="lg"
                                disabled={loadingPool}
                                style={{ cursor: "pointer" }}
                              >
                                {loadingPool ? (
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-5 w-5" />
                                )}
                                Start Science Quiz
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-full max-w-3xl space-y-6">
            {loadingPool && !currentQ && !showReview ? (
              <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
                <CardContent className="flex items-center gap-3 py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">Preparing your quiz…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Loading adaptive questions for this subject.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {showReview ? (
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Results</CardTitle>
                  <CardDescription>
                    {savingResults && "Saving… "}
                    {resultsSaved && "Saved to your profile. "}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-bold">
                      {correctCount} / {questions.length}
                    </div>
                    <div className="text-muted-foreground">
                      {questions.length > 0
                        ? `${Math.round((correctCount / questions.length) * 100)}% Correct`
                        : ""}
                    </div>
                    <Progress
                      value={
                        questions.length > 0
                          ? (correctCount / questions.length) * 100
                          : 0
                      }
                      className="mt-4"
                    />
                  </div>

                  {Object.keys(topicMastery).length > 0 && (
                    <div className="rounded-lg border bg-background p-4 space-y-4">
                      <h3 className="text-lg font-semibold">
                        Topic Mastery Progress
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(topicMastery)
                          .sort(([, a], [, b]) => b - a)
                          .map(([topic, mastery]) => (
                            <div key={topic} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{topic}</span>
                                <span className="text-muted-foreground">
                                  {mastery.toFixed(1)}%
                                </span>
                              </div>
                              <MantineProgress
                                value={mastery}
                                color={
                                  mastery >= 70
                                    ? "green"
                                    : mastery >= 50
                                      ? "yellow"
                                      : "red"
                                }
                                radius="md"
                                size="md"
                                striped
                                animated
                                transitionDuration={500}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {sessionAIFeedback && (
                    <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Brain className="h-5 w-5 text-primary" />
                          AI Session Feedback
                        </CardTitle>
                        <CardDescription>
                          Personalized analysis of this quiz session
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          <MarkdownRenderer content={sessionAIFeedback} />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {savingResults && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="flex items-center gap-3 py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-medium">AI is analysing your performance…</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Saving results and generating personalised feedback</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {!savingResults && saveError && (
                    <Card className="border-destructive/30">
                      <CardContent className="flex items-center gap-3 py-6">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Could not save results</p>
                          <p className="text-xs text-muted-foreground mt-0.5">There was a problem saving your quiz. You can try again.</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void saveQuizResults()} style={{ cursor: "pointer" }}>
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  {!savingResults && resultsSaved && !sessionAIFeedback && (
                    <Card className="border-muted">
                      <CardContent className="flex items-center gap-2 py-6">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Results saved. AI feedback is unavailable right now.
                        </span>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {questions.map((question, idx) => {
                      const userAnswer = answers[idx];
                      const ok =
                        userAnswer &&
                        parseInt(userAnswer, 10) === question.correctAnswer;
                      return (
                        <Card
                          key={question.id}
                          className={
                            ok
                              ? "border-green-500 bg-green-50 dark:bg-green-950"
                              : "border-red-500 bg-red-50 dark:bg-red-950"
                          }
                        >
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">
                                Question {idx + 1}
                              </span>
                              <AnswerResultBadge correct={Boolean(ok)} />
                              <TopicBadge topic={question.topic} />
                              <DifficultyBadge difficulty={question.difficulty} />
                            </div>
                            <div className="font-medium"><MarkdownRenderer content={question.question} /></div>
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-medium shrink-0">
                                  Your answer:
                                </span>
                                <span className="text-sm">
                                  {userAnswer
                                    ? <MarkdownRenderer content={question.options[parseInt(userAnswer, 10)]} />
                                    : "Not answered"}
                                </span>
                              </div>
                              {!ok && (
                                <div className="flex items-start gap-2">
                                  <span className="text-sm font-medium shrink-0">
                                    Correct answer:
                                  </span>
                                  <span className="text-sm">
                                    <MarkdownRenderer content={question.options[question.correctAnswer]} />
                                  </span>
                                </div>
                              )}
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-medium mb-1">
                                  Explanation:
                                </p>
                                <div className="text-sm text-muted-foreground">
                                  <MarkdownRenderer content={question.explanation} />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleRetry}
                      className="flex-1"
                      style={{ cursor: "pointer" }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retry Quiz
                    </Button>
                    <Button
                      onClick={() => {
                        setShowReview(false);
                        handleRetry();
                      }}
                      variant="outline"
                      className="flex-1"
                      style={{ cursor: "pointer" }}
                    >
                      Start New Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowExitDialog(true)}
                      className="h-8 w-8"
                      style={{ cursor: "pointer" }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                      Time Elapsed
                    </span>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4" />
                      {isSubmitted && questionTimes[currentQuestionIndex] != null
                        ? formatTime(questionTimes[currentQuestionIndex]!)
                        : formatTime(questionTime)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Mastery Progress
                      {currentTopic && (
                        <span className="text-muted-foreground font-normal ml-2">
                          - {currentTopic}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {displayedMastery.toFixed(1)}%
                    </span>
                  </div>
                  <MantineProgress
                    value={displayedMastery}
                    color={
                      displayedMastery >= 70
                        ? "green"
                        : displayedMastery >= 50
                          ? "yellow"
                          : "red"
                    }
                    radius="md"
                    size="lg"
                    striped
                    animated
                    transitionDuration={500}
                  />
                </div>

                <div className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Questions Completed
                    </div>
                    <span className="text-muted-foreground">
                      {submittedCount} / {questions.length}
                    </span>
                  </div>
                  <Progress value={questionCompletion} className="mt-3 h-2" />
                  <div className="mt-2 flex items-center justify-start text-xs text-muted-foreground">
                    Target session: {SESSION_LENGTH} questions
                  </div>
                </div>

                <Card>
                  <CardHeader className="space-y-0 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Question {currentQuestionIndex + 1}
                        {currentQ?.topic ? (
                          <span className="text-muted-foreground/80">
                            {" "}
                            · {currentQ.topic}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => dispatch(toggleAIAssist())}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          style={{ cursor: "pointer" }}
                        >
                          <Brain className="h-4 w-4" />
                          AI Assist
                        </Button>
                        <Button
                          onClick={handleHint}
                          variant="outline"
                          size="sm"
                          className="gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          disabled={showHint}
                          style={{
                            cursor: showHint ? "not-allowed" : "pointer",
                          }}
                        >
                          <Lightbulb className="h-4 w-4" />
                          Hint
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 text-lg font-semibold sm:text-xl">
                        <MarkdownRenderer content={questions[currentQuestionIndex]?.question ?? ""} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          handleTTS(
                            questions[currentQuestionIndex]?.question || "",
                            "question"
                          )
                        }
                        style={{ cursor: "pointer" }}
                        title={
                          tts.speakingId === "question"
                            ? "Stop reading"
                            : "Read question aloud"
                        }
                      >
                        {tts.speakingId === "question" ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {showHint && (
                      <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="font-medium text-amber-900 dark:text-amber-100">
                                Hint:
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  handleTTS(hintContent, "hint")
                                }
                                disabled={isLoadingHint || !hintContent}
                                style={{
                                  cursor: isLoadingHint ? "default" : "pointer",
                                }}
                                title={
                                  tts.speakingId === "hint"
                                    ? "Stop reading"
                                    : "Read hint aloud"
                                }
                              >
                                {tts.speakingId === "hint" ? (
                                  <VolumeX className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <AlertDescription>
                              {isLoadingHint ? (
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm">
                                    Generating hint...
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap text-amber-800 dark:text-amber-200">
                                  {hintContent || "Loading..."}
                                </p>
                              )}
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      {questions[currentQuestionIndex]?.options.map(
                        (option, idx) => {
                          const userAnswer = answers[currentQuestionIndex];
                          const isSelected = userAnswer === idx.toString();
                          const isCorrectOpt =
                            idx ===
                            questions[currentQuestionIndex]!.correctAnswer;
                          const showCorrectAlways = isCorrectOpt;
                          const showIncorrect =
                            isSubmitted &&
                            isSelected &&
                            !isCorrectOpt &&
                            !correctAnswers[currentQuestionIndex];

                          return (
                            <Card
                              key={idx}
                              className={`transition-all ${
                                showCorrectAlways
                                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                                  : showIncorrect
                                    ? "border-red-500 bg-red-50 dark:bg-red-950"
                                    : isSelected
                                      ? "border-primary bg-primary/5"
                                      : "hover:border-primary/50"
                              }`}
                              onClick={() =>
                                !isSubmitted && handleAnswerSelect(idx)
                              }
                              style={{
                                cursor: isSubmitted ? "default" : "pointer",
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <span className="flex-1"><MarkdownRenderer content={option} /></span>
                                  {showCorrectAlways && (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  )}
                                  {showIncorrect && (
                                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      {!isSubmitted ? (
                        <Button
                          onClick={handleSubmit}
                          className="flex-1"
                          disabled={!answers[currentQuestionIndex]}
                          style={{
                            cursor: !answers[currentQuestionIndex]
                              ? "not-allowed"
                              : "pointer",
                          }}
                        >
                          Submit
                        </Button>
                      ) : (
                        <Button
                          onClick={handleNextQuestion}
                          className="flex-1"
                          style={{ cursor: "pointer" }}
                        >
                          {primaryNextLabel}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      <AIAssistSheet
        open={showAIAssist}
        onOpenChange={(open) => {
          if (!open) dispatch(toggleAIAssist());
        }}
        currentQuestion={currentQ ?? null}
        subject={currentSubject}
        questionIndex={currentQuestionIndex}
      />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Quiz Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              If you exit now, this session ends and progress may not be saved
              to your profile. You can start a new session later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitDialog(false)}>
              Continue Quiz
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleRetry();
                setShowExitDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Exit Quiz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

"use client";

import { useState, useEffect } from "react";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lightbulb,
  Sparkles,
  Calculator,
  Atom,
  BookOpen,
  Play,
  Volume2,
  VolumeX,
  Clock,
  TrendingUp,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import {
  mathQuestions,
  scienceQuestions,
  aiAssistResponses,
} from "@/lib/demo-data";

// Topic mappings based on question content
// Math: [Derivative, Algebra, Integral, Limit, Geometry]
const mathTopics = ["Calculus", "Algebra", "Calculus", "Calculus", "Geometry"];
// Science: [Gravity, Water formula, Newton's law, pH, Speed of light]
const scienceTopics = [
  "Physics",
  "Chemistry",
  "Physics",
  "Chemistry",
  "Physics",
];

// Add topic to questions
const mathQuestionsWithTopics = mathQuestions.map((q, idx) => ({
  ...q,
  topic: mathTopics[idx % mathTopics.length],
}));

const scienceQuestionsWithTopics = scienceQuestions.map((q, idx) => ({
  ...q,
  topic: scienceTopics[idx % scienceTopics.length],
}));
import { AIAssistSheet } from "@/components/ai-assist-sheet";
import { Progress as MantineProgress } from "@mantine/core";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export default function QuizPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentSubject, currentQuestionIndex, answers, showAIAssist } =
    useSelector((state: RootState) => state.quiz);
  const [feedback, setFeedback] = useState<{
    type: "correct" | "incorrect" | null;
    message: string;
  }>({ type: null, message: "" });
  const [showReview, setShowReview] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [speakingType, setSpeakingType] = useState<
    "question" | "feedback" | "hint" | null
  >(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(
    null
  );
  // Track mastery per topic
  const [topicMastery, setTopicMastery] = useState<Record<string, number>>({});
  const [displayedMastery, setDisplayedMastery] = useState(65); // For smooth animation
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(
    {}
  );
  const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, boolean>>(
    {}
  );
  const [showMasteryInfo, setShowMasteryInfo] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const questions =
    currentSubject === "math"
      ? mathQuestionsWithTopics
      : scienceQuestionsWithTopics;

  // Get current question's topic
  const currentTopic = questions[currentQuestionIndex]?.topic || "";

  // Get current topic's mastery progress (default to 65% if not set)
  const currentTopicMastery = currentTopic
    ? (topicMastery[currentTopic] ?? 65)
    : 65;

  // Update displayed mastery with smooth animation when topic or mastery changes
  useEffect(() => {
    setDisplayedMastery(currentTopicMastery);
  }, [currentTopicMastery, currentTopic]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  };

  const handleTTS = (text: string, type: "question" | "feedback" | "hint") => {
    if (speakingType === type) {
      window.speechSynthesis.cancel();
      setSpeakingType(null);
    } else {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingType(null);
      utterance.onerror = () => setSpeakingType(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingType(type);
    }
  };

  const handleSubjectSelect = (subject: "math" | "science") => {
    dispatch(setSubject(subject));
    dispatch(setQuestionIndex(0));
    setFeedback({ type: null, message: "" });
    setShowReview(false);
    setShowHint(false);
    setIsSubmitted(false);
    setQuestionTime(0);
    setQuestionStartTime(null);
    setTopicMastery({}); // Reset all topic mastery
    setQuestionTimes({});
    setRetryCounts({});
    setCorrectAnswers({});
    // Clear all mastery tracking
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("mastery-")) {
        localStorage.removeItem(key);
      }
    });
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
    if (!answers[currentQuestionIndex] || isSubmitted) return;

    const question = questions[currentQuestionIndex];
    const userAnswer = answers[currentQuestionIndex];
    const isCorrect = parseInt(userAnswer) === question.correctAnswer;

    // Track correct answer status
    setCorrectAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: isCorrect,
    }));

    // Increment retry count if incorrect
    if (!isCorrect) {
      setRetryCounts((prev) => ({
        ...prev,
        [currentQuestionIndex]: (prev[currentQuestionIndex] || 0) + 1,
      }));
    }

    // Record time taken for this question
    if (questionStartTime) {
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQuestionIndex]: timeTaken,
      }));
    }

    // Update mastery progress for current topic based on correctness
    const currentTopic = questions[currentQuestionIndex]?.topic;
    if (currentTopic) {
      setTopicMastery((prev) => {
        const currentMastery = prev[currentTopic] ?? 65;
        if (isCorrect) {
          // Increase mastery by 3-5% for correct answers
          const increase = 3 + Math.random() * 2; // Random between 3-5%
          return {
            ...prev,
            [currentTopic]: Math.min(100, currentMastery + increase),
          };
        } else {
          // Decrease mastery by 2-4% for incorrect answers
          const decrease = 2 + Math.random() * 2; // Random between 2-4%
          return {
            ...prev,
            [currentTopic]: Math.max(0, currentMastery - decrease),
          };
        }
      });
    }

    setFeedback({
      type: isCorrect ? "correct" : "incorrect",
      message: isCorrect
        ? "Correct! Well done."
        : "Incorrect. Please try again.",
    });
    setIsSubmitted(true);
  };

  const handleRetryQuestion = () => {
    // Clear current answer and allow retry
    dispatch(
      setAnswer({
        questionIndex: currentQuestionIndex,
        answer: "",
      })
    );
    setIsSubmitted(false);
    setFeedback({ type: null, message: "" });
    setShowHint(false);
    setQuestionTime(0);
    setQuestionStartTime(Date.now());
  };

  const handleNextQuestion = () => {
    setIsSubmitted(false);
    setFeedback({ type: null, message: "" });
    setShowHint(false);
    setQuestionTime(0);
    setQuestionStartTime(null);

    // Clear mastery tracking for next question
    if (currentSubject) {
      const questionKey = `${currentQuestionIndex}-${currentSubject}`;
      localStorage.removeItem(`mastery-${questionKey}`);
    }

    if (currentQuestionIndex < questions.length - 1) {
      dispatch(setQuestionIndex(currentQuestionIndex + 1));
    } else {
      setShowReview(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setIsSubmitted(false);
      dispatch(setQuestionIndex(currentQuestionIndex - 1));
      setFeedback({ type: null, message: "" });
      setShowHint(false);
    }
  };

  const handleRetry = () => {
    dispatch(resetQuiz());
    setFeedback({ type: null, message: "" });
    setShowReview(false);
    setShowHint(false);
    setIsSubmitted(false);
    setQuestionTimes({});
    setRetryCounts({});
    setCorrectAnswers({});
    setQuestionTime(0);
    setQuestionStartTime(null);
    setTopicMastery({});
  };

  const handleHint = () => {
    setShowHint(true);
  };

  const getHintResponse = () => {
    const question = questions[currentQuestionIndex];
    if (!question) return aiAssistResponses.default;

    const lowerQuestion = question.question.toLowerCase();
    if (currentSubject === "math") {
      if (
        lowerQuestion.includes("derivative") ||
        lowerQuestion.includes("differentiate")
      ) {
        return aiAssistResponses.math_derivative;
      } else if (
        lowerQuestion.includes("integral") ||
        lowerQuestion.includes("integrate")
      ) {
        return aiAssistResponses.math_integral;
      } else if (
        lowerQuestion.includes("limit") ||
        lowerQuestion.includes("approaches")
      ) {
        return aiAssistResponses.math_limit;
      }
    } else if (currentSubject === "science") {
      if (
        lowerQuestion.includes("physics") ||
        lowerQuestion.includes("force") ||
        lowerQuestion.includes("motion")
      ) {
        return aiAssistResponses.science_physics;
      } else if (
        lowerQuestion.includes("chemistry") ||
        lowerQuestion.includes("chemical") ||
        lowerQuestion.includes("reaction")
      ) {
        return aiAssistResponses.science_chemistry;
      }
    }
    return `${aiAssistResponses.default}\n\nFor this problem: ${question.explanation}`;
  };

  const answeredCount = Object.keys(answers).length;
  const submittedCount = Object.keys(questionTimes).length;
  const questionCompletion =
    questions.length > 0 ? (submittedCount / questions.length) * 100 : 0;
  const correctCount = questions.reduce((count, q, idx) => {
    const userAnswer = answers[idx];
    return userAnswer && parseInt(userAnswer) === q.correctAnswer
      ? count + 1
      : count;
  }, 0);

  // Timer effect - start timer when question changes
  useEffect(() => {
    if (currentSubject && !isSubmitted) {
      setQuestionStartTime(Date.now());
      setQuestionTime(0);
      const interval = setInterval(() => {
        setQuestionTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentQuestionIndex, currentSubject, isSubmitted]);

  return (
    <Layout>
      {!currentSubject ? (
        <div className="flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            <div className="space-y-2">
              <div className="relative flex items-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  Smart Quiz
                </h1>
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
                        Understanding how your learning is tracked and measured
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          What is Deep Knowledge Tracing (DKT)?
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Smart Quiz uses Deep Knowledge Tracing (DKT), an
                          AI-powered system that learns from your answers to
                          understand what you know and what you&apos;re still
                          learning. Think of it like a smart tutor that watches
                          how you solve problems and figures out your strengths
                          and areas that need more practice.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">How DKT Works</h3>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              1
                            </div>
                            <div>
                              <p className="font-medium text-foreground mb-1">
                                Learning from Your Answers
                              </p>
                              <p>
                                Every time you answer a question, DKT analyzes
                                whether you got it right or wrong. It looks at
                                patterns in your responses to understand your
                                knowledge level.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              2
                            </div>
                            <div>
                              <p className="font-medium text-foreground mb-1">
                                Tracking Your Progress
                              </p>
                              <p>
                                The system tracks multiple factors: how accurate
                                your answers are, how many times you need to
                                retry, how quickly you respond, and the
                                difficulty of questions you master.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              3
                            </div>
                            <div>
                              <p className="font-medium text-foreground mb-1">
                                Building Your Knowledge Profile
                              </p>
                              <p>
                                Over time, DKT builds a personalized model of
                                your understanding. It identifies which topics
                                you&apos;ve mastered and which ones need more
                                attention.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              4
                            </div>
                            <div>
                              <p className="font-medium text-foreground mb-1">
                                Adapting to Your Learning
                              </p>
                              <p>
                                Based on your performance, the system adjusts to
                                provide questions that match your current skill
                                level, helping you learn more effectively.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          Metrics We Track
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          To understand your learning, we measure several
                          things:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                          <li>
                            <span className="font-medium text-foreground">
                              Answer Accuracy:
                            </span>{" "}
                            Whether you get questions right on your first try
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              Retry Count:
                            </span>{" "}
                            How many attempts you need before getting the
                            correct answer
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              Time Elapsed:
                            </span>{" "}
                            How long you take to answer each question
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              Question Difficulty:
                            </span>{" "}
                            The complexity of questions you successfully answer
                          </li>
                        </ul>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                          These metrics help DKT create a comprehensive picture
                          of your knowledge and learning progress. The system
                          uses advanced machine learning algorithms to combine
                          all this information and estimate your mastery level
                          for each topic.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          Understanding Your Progress
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Your mastery progress percentage reflects how well DKT
                          estimates you understand the material. This percentage
                          updates as you answer more questions, giving you
                          real-time feedback on your learning journey.
                        </p>
                        <div className="space-y-2 text-sm mt-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">
                                70%+
                              </span>{" "}
                              - Strong understanding
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">
                                50-69%
                              </span>{" "}
                              - Good progress, keep practicing
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">
                                &lt;50%
                              </span>{" "}
                              - More practice needed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <p className="text-muted-foreground">
                AI-powered, personalized assessments that adapt to your mastery
                and keep your learning journey on track.
              </p>
            </div>
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
                                Practice calculus, algebra, geometry, and
                                advanced mathematics concepts. This adaptive
                                quiz will test your understanding across
                                multiple mathematical domains and provide
                                detailed feedback on your performance.
                              </p>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm font-medium">
                                    Topics Covered
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Algebra, Calculus, Geometry, Statistics
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    Questions
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {mathQuestions.length} questions
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleSubjectSelect("math")}
                                className="w-full"
                                size="lg"
                                style={{ cursor: "pointer" }}
                              >
                                <Play className="mr-2 h-5 w-5" />
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
                                Test your understanding of physics, chemistry,
                                biology, and scientific principles. This
                                comprehensive quiz covers fundamental concepts
                                and real-world applications across various
                                scientific disciplines.
                              </p>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm font-medium">
                                    Topics Covered
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Physics, Chemistry, Biology, Earth Science
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    Questions
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {scienceQuestions.length} questions
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleSubjectSelect("science")}
                                className="w-full"
                                size="lg"
                                style={{ cursor: "pointer" }}
                              >
                                <Play className="mr-2 h-5 w-5" />
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
            {showReview ? (
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-bold">
                      {correctCount} / {questions.length}
                    </div>
                    <div className="text-muted-foreground">
                      {Math.round((correctCount / questions.length) * 100)}%
                      Correct
                    </div>
                    <Progress
                      value={(correctCount / questions.length) * 100}
                      className="mt-4"
                    />
                  </div>

                  {/* Topic Mastery Summary */}
                  {Object.keys(topicMastery).length > 0 && (
                    <div className="rounded-lg border bg-background p-4 space-y-4">
                      <h3 className="text-lg font-semibold">
                        Topic Mastery Progress
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(topicMastery)
                          .sort(([, a], [, b]) => b - a) // Sort by mastery percentage (highest first)
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

                  <div className="space-y-4">
                    {questions.map((question, idx) => {
                      const userAnswer = answers[idx];
                      const isCorrect =
                        userAnswer &&
                        parseInt(userAnswer) === question.correctAnswer;
                      return (
                        <Card
                          key={question.id}
                          className={
                            isCorrect
                              ? "border-green-500 bg-green-50 dark:bg-green-950"
                              : "border-red-500 bg-red-50 dark:bg-red-950"
                          }
                        >
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                Question {idx + 1}
                              </span>
                              {isCorrect ? (
                                <Badge
                                  variant="default"
                                  className="gap-1 bg-green-600"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Correct
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Incorrect
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium">{question.question}</p>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  Your answer:
                                </span>
                                <span className="text-sm">
                                  {userAnswer
                                    ? question.options[parseInt(userAnswer)]
                                    : "Not answered"}
                                </span>
                              </div>
                              {!isCorrect && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    Correct answer:
                                  </span>
                                  <span className="text-sm">
                                    {question.options[question.correctAnswer]}
                                  </span>
                                </div>
                              )}
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-medium mb-1">
                                  Explanation:
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {question.explanation}
                                </p>
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
                        dispatch(setSubject(null));
                        setShowReview(false);
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
                    <Badge
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                      style={{
                        backgroundColor:
                          currentSubject === "math" ? "#1E3A8A" : "#059669",
                        color: "white",
                      }}
                    >
                      {currentSubject === "math" ? "Math" : "Science"}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                      Time Elapsed
                    </span>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4" />
                      {isSubmitted && questionTimes[currentQuestionIndex]
                        ? formatTime(questionTimes[currentQuestionIndex])
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
                    {submittedCount === questions.length &&
                      questions.length > 0 && (
                        <span>All questions answered</span>
                      )}
                  </div>
                </div>

                <Card>
                  <CardHeader className="space-y-0 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Question {currentQuestionIndex + 1}
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
                      <CardTitle className="flex-1 text-lg font-semibold sm:text-xl">
                        {questions[currentQuestionIndex]?.question}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleTTS(
                            questions[currentQuestionIndex]?.question || "",
                            "question"
                          )
                        }
                        style={{ cursor: "pointer" }}
                        title={
                          speakingType === "question"
                            ? "Stop reading"
                            : "Read question aloud"
                        }
                      >
                        {speakingType === "question" ? (
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
                                  handleTTS(getHintResponse(), "hint")
                                }
                                style={{ cursor: "pointer" }}
                                title={
                                  speakingType === "hint"
                                    ? "Stop reading"
                                    : "Read hint aloud"
                                }
                              >
                                {speakingType === "hint" ? (
                                  <VolumeX className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <AlertDescription>
                              <p className="text-sm whitespace-pre-wrap text-amber-800 dark:text-amber-200">
                                {getHintResponse()}
                              </p>
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
                          const isCorrect =
                            idx ===
                            questions[currentQuestionIndex].correctAnswer;
                          const showCorrect =
                            isSubmitted &&
                            isCorrect &&
                            correctAnswers[currentQuestionIndex];
                          const showIncorrect =
                            isSubmitted &&
                            isSelected &&
                            !isCorrect &&
                            !correctAnswers[currentQuestionIndex];

                          return (
                            <Card
                              key={idx}
                              className={`transition-all ${
                                showCorrect
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
                                  <span className="flex-1">{option}</span>
                                  {showCorrect && (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  )}
                                  {showIncorrect && (
                                    <XCircle className="h-5 w-5 text-red-600" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handlePrevious}
                        variant="outline"
                        disabled={currentQuestionIndex === 0}
                        style={{
                          cursor:
                            currentQuestionIndex === 0
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        Previous
                      </Button>
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
                      ) : correctAnswers[currentQuestionIndex] ? (
                        <Button
                          onClick={handleNextQuestion}
                          className="flex-1"
                          style={{ cursor: "pointer" }}
                        >
                          {currentQuestionIndex === questions.length - 1
                            ? "Review Answers"
                            : "Next"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={handleRetryQuestion}
                            variant="outline"
                            className="border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                            style={{ cursor: "pointer" }}
                          >
                            Retry
                          </Button>
                          <Button
                            onClick={handleNextQuestion}
                            className="flex-1"
                            style={{ cursor: "pointer" }}
                          >
                            {currentQuestionIndex === questions.length - 1
                              ? "Review Answers"
                              : "Next"}
                          </Button>
                        </>
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
        currentQuestion={
          currentSubject && questions[currentQuestionIndex]
            ? questions[currentQuestionIndex]
            : null
        }
        subject={currentSubject}
      />
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Quiz Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              If you exit now, your current quiz session will end and your
              progress will not be recorded in your learning profile. Any
              mastery progress updates, time tracking, and answer submissions
              from this session will be lost.
              <br />
              <br />
              You can always start a new quiz session later, but you&apos;ll
              need to begin from the first question again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitDialog(false)}>
              Continue Quiz
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                dispatch(setSubject(null));
                dispatch(resetQuiz());
                setShowExitDialog(false);
                setShowReview(false);
                setIsSubmitted(false);
                setQuestionTime(0);
                setQuestionStartTime(null);
                setQuestionTimes({});
                setRetryCounts({});
                setCorrectAnswers({});
                setTopicMastery({});
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

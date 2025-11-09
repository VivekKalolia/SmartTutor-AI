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
} from "lucide-react";
import {
  mathQuestions,
  scienceQuestions,
  aiAssistResponses,
} from "@/lib/demo-data";
import { AIAssistSheet } from "@/components/ai-assist-sheet";
import { toast } from "sonner";

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
    "question" | "feedback" | null
  >(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [questionTime, setQuestionTime] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(
    null
  );
  const [masteryProgress, setMasteryProgress] = useState(65); // Mock initial mastery: 65%
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(
    {}
  );

  const questions =
    currentSubject === "math" ? mathQuestions : scienceQuestions;

  const handleTTS = (text: string, type: "question" | "feedback") => {
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
    setShowToast(false);
    setToastMessage(null);
    setQuestionTime(0);
    setQuestionStartTime(null);
    setMasteryProgress(65); // Reset to mock initial mastery
    setQuestionTimes({});
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

    // Record time taken for this question
    if (questionStartTime) {
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQuestionIndex]: timeTaken,
      }));
    }

    // Update mastery progress based on correctness
    setMasteryProgress((prev) => {
      if (isCorrect) {
        // Increase mastery by 3-5% for correct answers
        const increase = 3 + Math.random() * 2; // Random between 3-5%
        return Math.min(100, prev + increase);
      } else {
        // Decrease mastery by 2-4% for incorrect answers
        const decrease = 2 + Math.random() * 2; // Random between 2-4%
        return Math.max(0, prev - decrease);
      }
    });

    const message = isCorrect
      ? "Correct! Well done."
      : "Incorrect... try again";

    setToastMessage({
      type: isCorrect ? "success" : "error",
      message,
    });
    setShowToast(true);
    setFeedback({
      type: isCorrect ? "correct" : "incorrect",
      message,
    });
    setIsSubmitted(true);
  };

  const handleNextQuestion = () => {
    setIsSubmitted(false);
    setShowToast(false);
    setToastMessage(null);
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
      setShowToast(false);
      setToastMessage(null);
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
    setShowToast(false);
    setToastMessage(null);
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

  const progress =
    questions.length > 0
      ? ((currentQuestionIndex + 1) / questions.length) * 100
      : 0;

  const answeredCount = Object.keys(answers).length;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Smart Quiz</h1>
            <p className="text-muted-foreground mt-2">
              Test your knowledge with adaptive quizzes
            </p>
          </div>
          {currentSubject && (
            <Button
              onClick={() => dispatch(toggleAIAssist())}
              variant="outline"
              className="gap-2"
              style={{ cursor: "pointer" }}
            >
              <Brain className="h-4 w-4" />
              Assist
            </Button>
          )}
        </div>

        {!currentSubject ? (
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
                              Practice calculus, algebra, geometry, and advanced
                              mathematics concepts. This adaptive quiz will test
                              your understanding across multiple mathematical
                              domains and provide detailed feedback on your
                              performance.
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
                                <p className="text-sm font-medium">Questions</p>
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
                              comprehensive quiz covers fundamental concepts and
                              real-world applications across various scientific
                              disciplines.
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
                                <p className="text-sm font-medium">Questions</p>
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
        ) : (
          <>
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
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge
                      variant="secondary"
                      className="mb-2"
                      style={{
                        backgroundColor:
                          currentSubject === "math" ? "#1E3A8A" : "#059669",
                        color: "white",
                      }}
                    >
                      {currentSubject === "math" ? "Math" : "Science"}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {isSubmitted && questionTimes[currentQuestionIndex]
                        ? `${questionTimes[currentQuestionIndex]}s`
                        : `${questionTime}s`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {answeredCount} answered
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Mastery Progress</span>
                    <span className="text-muted-foreground">
                      {masteryProgress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all duration-500 ${
                        masteryProgress >= 70
                          ? "bg-green-500"
                          : masteryProgress >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${masteryProgress}%` }}
                    />
                  </div>
                </div>

                <Progress value={progress} className="h-2" />

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <CardTitle>
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
                      <Button
                        onClick={handleHint}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={showHint}
                        style={{ cursor: showHint ? "not-allowed" : "pointer" }}
                      >
                        <Lightbulb className="h-4 w-4" />
                        Hint
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {showHint && (
                      <Alert className="border-primary bg-primary/5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <AlertDescription className="mt-2">
                          <p className="font-medium mb-2">Hint:</p>
                          <p className="text-sm whitespace-pre-wrap">
                            {getHintResponse()}
                          </p>
                        </AlertDescription>
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
                          const showCorrect = isSubmitted && isCorrect;
                          const showIncorrect =
                            isSubmitted && isSelected && !isCorrect;

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

                    {showToast && toastMessage && (
                      <div
                        className={`rounded-lg border p-4 shadow-lg ${
                          toastMessage.type === "success"
                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                            : "border-red-500 bg-red-50 dark:bg-red-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {toastMessage.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <p
                            className={`text-sm font-medium ${
                              toastMessage.type === "success"
                                ? "text-green-800 dark:text-green-200"
                                : "text-red-800 dark:text-red-200"
                            }`}
                          >
                            {toastMessage.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {isSubmitted && feedback.type && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Explanation:
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {questions[currentQuestionIndex]?.explanation}
                              </p>
                            </div>
                            {questionTimes[currentQuestionIndex] && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-muted-foreground">
                                  Time taken:{" "}
                                  {questionTimes[currentQuestionIndex]} seconds
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

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
                      ) : (
                        <Button
                          onClick={handleNextQuestion}
                          className="flex-1"
                          style={{ cursor: "pointer" }}
                        >
                          {currentQuestionIndex === questions.length - 1
                            ? "Review Answers"
                            : "Next"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
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
      </div>
    </Layout>
  );
}

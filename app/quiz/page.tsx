"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, XCircle, RotateCcw, Eye } from "lucide-react";
import { mathQuestions, scienceQuestions } from "@/lib/demo-data";
import { AIAssistSheet } from "@/components/ai-assist-sheet";

export default function QuizPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentSubject, currentQuestionIndex, answers, showAIAssist } =
    useSelector((state: RootState) => state.quiz);
  const [feedback, setFeedback] = useState<{
    type: "correct" | "incorrect" | null;
    message: string;
  }>({ type: null, message: "" });
  const [showReview, setShowReview] = useState(false);

  const questions =
    currentSubject === "math" ? mathQuestions : scienceQuestions;

  const handleSubjectSelect = (subject: "math" | "science") => {
    dispatch(setSubject(subject));
    dispatch(setQuestionIndex(0));
    setFeedback({ type: null, message: "" });
    setShowReview(false);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showReview) return;

    const question = questions[currentQuestionIndex];
    const isCorrect = answerIndex === question.correctAnswer;

    dispatch(setAnswer({ questionIndex: currentQuestionIndex, answer: answerIndex.toString() }));

    setFeedback({
      type: isCorrect ? "correct" : "incorrect",
      message: isCorrect
        ? "Correct! Well done."
        : `Incorrect. The correct answer is: ${question.options[question.correctAnswer]}`,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      dispatch(setQuestionIndex(currentQuestionIndex + 1));
      setFeedback({ type: null, message: "" });
    } else {
      setShowReview(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      dispatch(setQuestionIndex(currentQuestionIndex - 1));
      setFeedback({ type: null, message: "" });
    }
  };

  const handleRetry = () => {
    dispatch(resetQuiz());
    setFeedback({ type: null, message: "" });
    setShowReview(false);
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
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="math" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="math"
                    onClick={() => handleSubjectSelect("math")}
                  >
                    Math
                  </TabsTrigger>
                  <TabsTrigger
                    value="science"
                    onClick={() => handleSubjectSelect("science")}
                  >
                    Science
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="math" className="mt-6">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Practice calculus, algebra, and advanced mathematics
                      concepts.
                    </p>
                    <Button
                      onClick={() => handleSubjectSelect("math")}
                      className="w-full"
                      size="lg"
                    >
                      Start Math Quiz
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="science" className="mt-6">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Test your understanding of physics, chemistry, and
                      scientific principles.
                    </p>
                    <Button
                      onClick={() => handleSubjectSelect("science")}
                      className="w-full"
                      size="lg"
                    >
                      Start Science Quiz
                    </Button>
                  </div>
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
                        <div
                          key={question.id}
                          className="rounded-lg border p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">
                                  Question {idx + 1}
                                </span>
                                {isCorrect ? (
                                  <Badge variant="default" className="gap-1">
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
                              <div className="mt-2 space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  Your answer:{" "}
                                  {userAnswer
                                    ? question.options[parseInt(userAnswer)]
                                    : "Not answered"}
                                </p>
                                {!isCorrect && (
                                  <p className="text-sm text-muted-foreground">
                                    Correct answer:{" "}
                                    {
                                      question.options[question.correctAnswer]
                                    }
                                  </p>
                                )}
                                <p className="text-sm mt-2">
                                  <strong>Explanation:</strong>{" "}
                                  {question.explanation}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleRetry} className="flex-1">
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
                    <Badge variant="secondary" className="mb-2">
                      {currentSubject === "math" ? "Math" : "Science"}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {answeredCount} answered
                  </div>
                </div>

                <Progress value={progress} className="h-2" />

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {questions[currentQuestionIndex]?.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {questions[currentQuestionIndex]?.options.map(
                        (option, idx) => {
                          const userAnswer = answers[currentQuestionIndex];
                          const isSelected = userAnswer === idx.toString();
                          const isCorrect =
                            idx === questions[currentQuestionIndex].correctAnswer;
                          const showCorrect =
                            feedback.type !== null && isCorrect;

                          return (
                            <Button
                              key={idx}
                              onClick={() => handleAnswerSelect(idx)}
                              variant={
                                showCorrect
                                  ? "default"
                                  : isSelected
                                  ? "secondary"
                                  : "outline"
                              }
                              className="w-full justify-start h-auto py-3 text-left"
                              disabled={showReview}
                            >
                              <span className="flex-1">{option}</span>
                              {showCorrect && (
                                <CheckCircle2 className="h-4 w-4 ml-2" />
                              )}
                              {isSelected &&
                                !showCorrect &&
                                feedback.type === "incorrect" && (
                                  <XCircle className="h-4 w-4 ml-2 text-destructive" />
                                )}
                            </Button>
                          );
                        }
                      )}
                    </div>

                    {feedback.type && (
                      <Alert
                        variant={
                          feedback.type === "correct" ? "default" : "destructive"
                        }
                      >
                        <AlertDescription>{feedback.message}</AlertDescription>
                      </Alert>
                    )}

                    {feedback.type && (
                      <div className="rounded-lg border p-4 bg-muted/50">
                        <p className="text-sm font-medium mb-1">Explanation:</p>
                        <p className="text-sm text-muted-foreground">
                          {
                            questions[currentQuestionIndex]
                              ?.explanation
                          }
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handlePrevious}
                        variant="outline"
                        disabled={currentQuestionIndex === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={handleNext}
                        className="flex-1"
                        disabled={!answers[currentQuestionIndex]}
                      >
                        {currentQuestionIndex === questions.length - 1
                          ? "Review Answers"
                          : "Next Question"}
                      </Button>
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


"use client";

import { useState } from "react";
import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Calculator, Trash2, ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { mathQuestions } from "@/lib/demo-data";

const mathTopics = ["Algebra", "Calculus", "Geometry", "Statistics"];

// Convert demo questions to our Question format
const initialMathQuestions = mathQuestions.map((q, idx) => ({
  id: `math-${q.id}`,
  subject: "math" as const,
  topic: mathTopics[idx % mathTopics.length],
  question: q.question,
  questionType: "multiple-choice" as const,
  options: q.options,
  correctAnswer: q.correctAnswer,
}));

interface Question {
  id: string;
  subject: "math" | "science";
  topic?: string;
  question: string;
  questionType: "multiple-choice" | "open-ended";
  options?: string[];
  correctAnswer?: number;
  imageUrl?: string;
}

export default function AllMathQuestions() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initialMathQuestions);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 10;
  
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const currentQuestions = questions.slice(startIndex, endIndex);

  const handleDeleteClick = (id: string) => {
    setQuestionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (questionToDelete) {
      setQuestions(questions.filter((q) => q.id !== questionToDelete));
      toast.success("Question deleted");
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
      // Reset to first page if current page becomes empty
      if (currentQuestions.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  return (
    <TeacherLayout>
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/teacher/questions")}
              style={{ cursor: "pointer" }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Calculator className="h-6 w-6 text-[#1E3A8A]" />
                All Math Questions
              </h1>
              <p className="text-muted-foreground mt-2">
                {questions.length} question{questions.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {questions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No math questions available.
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {currentQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="p-5 border rounded-lg space-y-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {q.questionType === "multiple-choice"
                                ? "Multiple Choice"
                                : "Open-Ended"}
                            </Badge>
                            {q.topic && (
                              <Badge variant="secondary" className="text-xs">
                                {q.topic}
                              </Badge>
                            )}
                          </div>
                          <div
                            className="prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: q.question }}
                          />
                          {q.imageUrl && (
                            <img
                              src={q.imageUrl}
                              alt="Question"
                              className="max-h-48 rounded-md border"
                            />
                          )}
                          {q.questionType === "multiple-choice" &&
                            q.options &&
                            q.options.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <p className="text-sm font-medium text-muted-foreground">
                                  Options:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {q.options.map((option, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex items-center gap-2 p-3 rounded border text-sm ${
                                        idx === q.correctAnswer
                                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                                          : "bg-background"
                                      }`}
                                    >
                                      <Badge
                                        variant="outline"
                                        className={`w-7 h-7 flex items-center justify-center text-xs ${
                                          idx === q.correctAnswer
                                            ? "bg-green-600 text-white border-green-600"
                                            : ""
                                        }`}
                                      >
                                        {String.fromCharCode(65 + idx)}
                                      </Badge>
                                      <span className="flex-1">{option}</span>
                                    </div>
                                  ))}
                                </div>
                                  {q.correctAnswer !== undefined &&
                                    q.options &&
                                    q.options[q.correctAnswer] && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      Correct Answer:{" "}
                                      <span className="font-medium text-foreground">
                                        {q.options[q.correctAnswer]}
                                      </span>
                                    </p>
                                  )}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/teacher/questions?edit=${q.id}`)}
                            className="h-8 w-8 flex-shrink-0"
                            style={{ cursor: "pointer" }}
                            title="Edit question"
                          >
                            <Pencil className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(q.id)}
                            className="h-8 w-8 flex-shrink-0"
                            style={{ cursor: "pointer" }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(endIndex, questions.length)} of {questions.length} questions
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{ cursor: "pointer" }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-10"
                              style={{ cursor: "pointer" }}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          style={{ cursor: "pointer" }}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this question? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setQuestionToDelete(null)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </TeacherLayout>
  );
}


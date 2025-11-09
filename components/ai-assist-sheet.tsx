"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Send, Copy, RotateCcw } from "lucide-react";
import { Question, aiAssistResponses } from "@/lib/demo-data";

interface AIAssistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuestion: Question | null;
  subject: "math" | "science" | null;
}

export function AIAssistSheet({
  open,
  onOpenChange,
  currentQuestion,
  subject,
}: AIAssistSheetProps) {
  const [question, setQuestion] = useState("");
  const [responses, setResponses] = useState<
    Array<{ question: string; answer: string }>
  >([]);

  const handleSubmit = () => {
    if (!question.trim()) return;

    let answer = aiAssistResponses.default;

    if (currentQuestion) {
      const lowerQuestion = question.toLowerCase();
      if (subject === "math") {
        if (
          lowerQuestion.includes("derivative") ||
          lowerQuestion.includes("differentiate")
        ) {
          answer = aiAssistResponses.math_derivative;
        } else if (
          lowerQuestion.includes("integral") ||
          lowerQuestion.includes("integrate")
        ) {
          answer = aiAssistResponses.math_integral;
        } else if (
          lowerQuestion.includes("limit") ||
          lowerQuestion.includes("approaches")
        ) {
          answer = aiAssistResponses.math_limit;
        }
      } else if (subject === "science") {
        if (
          lowerQuestion.includes("physics") ||
          lowerQuestion.includes("force") ||
          lowerQuestion.includes("motion")
        ) {
          answer = aiAssistResponses.science_physics;
        } else if (
          lowerQuestion.includes("chemistry") ||
          lowerQuestion.includes("chemical") ||
          lowerQuestion.includes("reaction")
        ) {
          answer = aiAssistResponses.science_chemistry;
        }
      }

      if (currentQuestion.question) {
        answer += `\n\nFor this specific problem: ${currentQuestion.question}, ${currentQuestion.explanation}`;
      }
    }

    setResponses([...responses, { question, answer }]);
    setQuestion("");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleAskAgain = () => {
    setQuestion("");
    setResponses([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent 
        className="w-full sm:max-w-lg overflow-y-auto"
        noOverlay={true}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Learning Assistant
          </SheetTitle>
          <SheetDescription>
            Ask questions about the current problem or concept. I'll provide
            explanations and guidance.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {currentQuestion && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium mb-2">Current Question:</p>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.question}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {responses.map((response, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 rounded-lg border bg-muted p-3">
                    <p className="text-sm font-medium mb-1">Your question:</p>
                    <p className="text-sm text-muted-foreground">
                      {response.question}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-1 rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium mb-1">Response:</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {response.answer}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleCopy(response.answer)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask about this problem..."
              className="w-full"
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1" disabled={!question.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Ask
              </Button>
              {responses.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleAskAgain}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


"use client";

import { useState, useRef, useEffect } from "react";
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
import {
  Brain,
  Send,
  Copy,
  Sparkles,
  ArrowLeft,
  MessageSquare,
  X,
  CornerDownLeft,
  Mic,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Question, aiAssistResponses } from "@/lib/demo-data";
import { toast } from "sonner";

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
    Array<{
      question: string;
      answer: string;
      replyingTo?: {
        text: string;
        responseIndex: number;
      };
    }>
  >([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingResponseIndex, setSpeakingResponseIndex] = useState<number | null>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    responseIndex: number;
    position: { top: number; left: number };
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    text: string;
    responseIndex: number;
  } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);

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

    setResponses([
      ...responses,
      {
        question,
        answer,
        ...(replyingTo && { replyingTo }),
      },
    ]);
    setQuestion("");
    setReplyingTo(null); // Clear reply preview when sending
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    // Voice recording logic would go here (UI only for now)
  };

  const updateScrollFades = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8);
  };

  const handleTTS = (text: string, responseIndex: number) => {
    if (speakingResponseIndex === responseIndex) {
      window.speechSynthesis.cancel();
      setSpeakingResponseIndex(null);
    } else {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingResponseIndex(null);
      utterance.onerror = () => setSpeakingResponseIndex(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingResponseIndex(responseIndex);
    }
  };

  // Auto-scroll to latest response
  useEffect(() => {
    if (messagesContainerRef.current && responses.length > 0) {
      const container = messagesContainerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: "smooth",
      };
      container.scrollTo(scrollOptions);
    }
    updateScrollFades();
  }, [responses]);

  // Handle scroll fades
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => updateScrollFades();
    container.addEventListener("scroll", handleScroll);
    updateScrollFades();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle text selection for AI assistant responses only
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedText(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedTextContent = selection.toString().trim();

      if (!selectedTextContent) {
        setSelectedText(null);
        return;
      }

      // Check if selection is within an AI assistant response
      const ancestor = range.commonAncestorContainer;
      const responseElement =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? (ancestor as Element).closest("[data-response-index]")
          : ancestor.parentElement?.closest("[data-response-index]");

      if (!responseElement) {
        setSelectedText(null);
        return;
      }

      // Check if selection is within the selectable content
      const selectableContent = responseElement.querySelector(
        '[data-selectable-content="true"]'
      );

      if (!selectableContent) {
        setSelectedText(null);
        return;
      }

      // Check if the selection is actually within the selectable content
      const isWithinSelectable =
        selectableContent.contains(range.startContainer) &&
        selectableContent.contains(range.endContainer);

      if (!isWithinSelectable) {
        setSelectedText(null);
        return;
      }

      // Get response index from the element
      const responseIndex = parseInt(
        responseElement.getAttribute("data-response-index") || "-1"
      );
      if (responseIndex === -1) {
        setSelectedText(null);
        return;
      }

      // Get position for floating button (using viewport coordinates for fixed positioning)
      const rect = range.getBoundingClientRect();

      setSelectedText({
        text: selectedTextContent,
        responseIndex,
        position: {
          top: rect.top - 60, // Position above selection (match AI Tutor spacing)
          left: rect.left + rect.width / 2, // Center horizontally
        },
      });
      selectionRef.current = selection;
    };

    const handleMouseUp = () => {
      setTimeout(handleSelection, 10);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear selection if clicking on input field or its container
      if (
        target.closest("input") ||
        target.closest('[role="textbox"]') ||
        target.closest(".rounded-lg") // Input container
      ) {
        return;
      }
      // Clear selection if clicking outside assistant responses
      if (!target.closest("[data-response-index]")) {
        setSelectedText(null);
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClick);
    };
  }, [responses]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent
          className="w-full sm:max-w-lg flex flex-col p-0"
          noOverlay={true}
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
          <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Learning Assistant
            </SheetTitle>
            <SheetDescription>
              Ask questions about the current problem or concept. I&apos;ll
              provide explanations and guidance.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="relative flex-1 min-h-0">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent transition-opacity duration-300 z-10 dark:from-card"
                style={{ opacity: showBottomFade ? 1 : 0 }}
              />
              <div
                ref={messagesContainerRef}
                className="absolute inset-0 overflow-y-auto px-6 pb-4 space-y-4"
              >
              {currentQuestion && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium mb-2">
                      Current Question:
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentQuestion.question}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4 relative">
                {responses.map((response, idx) => (
                  <div key={idx} className="space-y-2">
                    {response.replyingTo && (
                      <div className="mb-1.5 flex items-start gap-2">
                        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {response.replyingTo.text}
                        </p>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 rounded-lg border bg-muted p-3">
                        <p className="text-sm font-medium mb-1">
                          Your question:
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {response.question}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div
                        className="rounded-lg border bg-card p-3"
                        data-response-index={idx}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">AI Response:</p>
                        </div>
                        <p
                          className="text-sm whitespace-pre-wrap select-text"
                          data-selectable-content="true"
                        >
                          {response.answer}
                        </p>
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTTS(response.answer, idx)}
                          style={{ cursor: "pointer" }}
                          title={
                            speakingResponseIndex === idx
                              ? "Stop reading"
                              : "Read answer aloud"
                          }
                        >
                          {speakingResponseIndex === idx ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopy(response.answer)}
                          style={{ cursor: "pointer" }}
                          title="Copy to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Floating "Ask AI" button when text is selected */}
              {selectedText && (
                <div
                  className="fixed z-50 pointer-events-none"
                  style={{
                    top: `${selectedText.position.top}px`,
                    left: `${selectedText.position.left}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <Button
                    size="sm"
                    className="gap-2 shadow-lg pointer-events-auto"
                    onClick={() => {
                      setReplyingTo({
                        text: selectedText.text,
                        responseIndex: selectedText.responseIndex,
                      });
                      setSelectedText(null);
                      if (window.getSelection) {
                        window.getSelection()?.removeAllRanges();
                      }
                      // Focus input field
                      setTimeout(() => {
                        const input = document.querySelector(
                          'input[placeholder*="Ask about"]'
                        ) as HTMLInputElement;
                        input?.focus();
                      }, 100);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Ask AI
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 px-6 pt-4 pb-4 space-y-2 bg-background">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-3">
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Replying to:
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {replyingTo.text}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => setReplyingTo(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask about this problem..."
                  className="flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    isRecording ? "bg-red-100" : "bg-transparent"
                  }`}
                  onClick={handleVoiceRecord}
                  style={{ cursor: "pointer" }}
                >
                  {isRecording ? (
                    <Square className="h-4 w-4 text-red-600" />
                  ) : (
                    <Mic className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                  onClick={handleSubmit}
                  disabled={!question.trim()}
                  style={{ cursor: "pointer" }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                AI responses may be inaccurate.{" "}
                <button
                  onClick={() => setShowDisclaimer(true)}
                  className="text-primary hover:underline underline-offset-2"
                  style={{ cursor: "pointer" }}
                >
                  Here&apos;s why
                </button>
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto [&>button]:hidden"
          noOverlay={true}
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={() => setShowDisclaimer(false)}
                style={{ cursor: "pointer" }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <SheetTitle>Why AI Responses May Be Inaccurate</SheetTitle>
            </div>
          </SheetHeader>
          <div className="mt-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sometimes, my RAG-based AI assistant can give an incorrect answer,
              just as even the best teachers can occasionally make mistakes.
              This may happen if the AI misunderstands the question, can&apos;t
              locate the right resource, or makes a wrong assumption based on
              the information it has. It&apos;s always a good idea to
              double-check important answers, since both humans and AI continue
              to learn and improve.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

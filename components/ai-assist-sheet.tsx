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
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  Send,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  MessageSquare,
  X,
  CornerDownLeft,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Loader2,
  Cpu,
} from "lucide-react";
import { Question } from "@/lib/demo-data";
import { toast } from "sonner";
import { useWhisper } from "@/lib/hooks/useWhisper";
import { useTTS } from "@/lib/hooks/useTTS";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  parseReasoningWire,
  modelUsesReasoningUI,
} from "@/lib/utils/reasoning-markers";

const aiModels = [
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    description: "Best quality",
    type: "ollama",
  },
  {
    id: "phi3:mini",
    name: "Phi-3 Mini",
    description: "Fast & efficient",
    type: "ollama",
  },
  {
    id: "deepseek-r1:32b",
    name: "DeepSeek R1 32B",
    description: "Advanced reasoning",
    type: "ollama",
  },
  {
    id: "qwen2.5:32b",
    name: "Qwen 2.5 32B",
    description: "High performance",
    type: "ollama",
  },
  {
    id: "llama3.2-vision:11b",
    name: "Llama 3.2 Vision 11B",
    description: "Balanced quality & speed",
    type: "ollama",
  },
  {
    id: "mightykatun/qwen2.5-math:7b",
    name: "Qwen 2.5 Math 7B",
    description: "Specialized for mathematics",
    type: "ollama",
  },
];

interface AIAssistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuestion: Question | null;
  subject: "math" | "science" | null;
  questionIndex: number; // Add question index to track which question we're on
}

// Store conversations per question index
const conversationStorage: Record<
  number,
  Array<{
    question: string;
    answer: string;
    model?: string;
    replyingTo?: {
      text: string;
      responseIndex: number;
    };
  }>
> = {};

export function AIAssistSheet({
  open,
  onOpenChange,
  currentQuestion,
  subject,
  questionIndex,
}: AIAssistSheetProps) {
  const [question, setQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama3.1:8b");
  const [ollamaStatus, setOllamaStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [modelAvailability, setModelAvailability] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<
    Array<{
      question: string;
      answer: string;
      model?: string;
      replyingTo?: {
        text: string;
        responseIndex: number;
      };
    }>
  >([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [copiedResponseIndex, setCopiedResponseIndex] = useState<number | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Whisper for voice-to-text
  const whisper = useWhisper({
    onTranscript: (text) => {
      setQuestion((prev) => prev + (prev ? " " : "") + text);
      toast.success("Transcription complete!");
    },
    onError: (error) => {
      toast.error(error);
    },
  });
  const tts = useTTS();
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
  const previousQuestionIndexRef = useRef<number>(-1);
  const isInitialMountRef = useRef(true);
  const prevIsLoadingRef = useRef(false);

  // Load/save conversations per question
  useEffect(() => {
    // If question index changed, save previous and load new
    if (questionIndex !== previousQuestionIndexRef.current) {
      // Save previous conversation if it exists and we're not on initial mount
      if (!isInitialMountRef.current && previousQuestionIndexRef.current >= 0) {
        // Get current responses before they change
        setResponses((currentResponses) => {
          if (currentResponses.length > 0) {
            conversationStorage[previousQuestionIndexRef.current] = [
              ...currentResponses,
            ];
          }
          // Load conversation for new question, or start fresh
          if (conversationStorage[questionIndex]) {
            return conversationStorage[questionIndex];
          } else {
            return [];
          }
        });
      } else {
        // Initial mount or first question - just load
        if (conversationStorage[questionIndex]) {
          setResponses(conversationStorage[questionIndex]);
        } else {
          setResponses([]);
        }
        isInitialMountRef.current = false;
      }

      previousQuestionIndexRef.current = questionIndex;
    }
  }, [questionIndex]);

  // When a new AI Assist response finishes streaming, prefetch TTS audio
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && responses.length > 0) {
      const last = responses[responses.length - 1];
      if (last.answer && last.answer.trim()) {
        tts.prefetch(last.answer);
      }
    }
  }, [isLoading, responses, tts]);

  // Save responses whenever they change (but not on initial mount)
  useEffect(() => {
    if (!isInitialMountRef.current && responses.length > 0) {
      conversationStorage[questionIndex] = [...responses];
    }
  }, [responses, questionIndex]);

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return;

    const userQuestion = question;
    const replyingToContext = replyingTo ? { ...replyingTo } : null;

    // Add user question to responses immediately
    setResponses((prev) => [
      ...prev,
      {
        question: userQuestion,
        answer: "",
        model: selectedModel,
        ...(replyingToContext && { replyingTo: replyingToContext }),
      },
    ]);
    setQuestion("");
    setReplyingTo(null);
    setIsLoading(true);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Build conversation history
      const conversationHistory = responses.slice(-10).flatMap((r) => [
        { role: "user", content: r.question },
        { role: "assistant", content: r.answer },
      ]);

      // Add replyingTo context if present
      let messageToSend = userQuestion;
      if (replyingToContext) {
        messageToSend = `[Regarding this text: "${replyingToContext.text}"]\n\nUser's question: ${userQuestion}`;
      }

      const response = await fetch("/api/quiz/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          model: selectedModel,
          conversationHistory,
          currentQuestion,
          subject,
          mode: "assist",
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulatedContent += data.token;
                // Update the last response
                setResponses((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    answer: accumulatedContent,
                    model: selectedModel,
                  };
                  return updated;
                });
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("[AI Assist] Error:", error);
        toast.error("Failed to get AI response. Please try again.");
        // Remove the failed response
        setResponses((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = (text: string, responseIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedResponseIndex(responseIndex);
    toast.success("Copied to clipboard!");
    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedResponseIndex(null);
    }, 2000);
  };

  const handleVoiceRecord = () => {
    if (whisper.isTranscribing) return;

    if (whisper.isRecording) {
      whisper.stopRecording();
      toast.info("Processing speech...");
    } else {
      whisper.startRecording();
      toast.info("Recording... Click again to stop.");
    }
  };

  const handleModelChange = (newModel: string) => {    setSelectedModel(newModel);
  };

  // Check Ollama status and model availability on mount
  useEffect(() => {
    const checkOllamaStatus = async () => {
      try {
        const response = await fetch("/api/quiz/assist");
        if (response.ok) {
          setOllamaStatus("online");

          // Check which models are available
          try {
            const ollamaResponse = await fetch(
              "http://localhost:11434/api/tags"
            );
            if (ollamaResponse.ok) {
              const data = await ollamaResponse.json();
              const availableModelNames = (data.models?.map(
                (m: { name: string }) => m.name
              ) || []) as string[];

              const availability: Record<string, boolean> = {};
              aiModels.forEach((model) => {
                const modelIdParts = model.id.split(":");
                const modelBase = modelIdParts[0];
                const modelTag = modelIdParts[1] || "";
                const modelNameOnly = modelBase.includes("/")
                  ? modelBase.split("/")[1]
                  : modelBase;

                availability[model.id] = availableModelNames.some(
                  (name: string) => {
                    // Exact match
                    if (name === model.id) return true;
                    // Match full model ID (including namespace)
                    if (name.includes(model.id)) return true;
                    // For namespaced models like "mightykatun/qwen2.5-math:7b", check if name contains the full path
                    if (modelBase.includes("/")) {
                      if (
                        name.includes(modelBase) &&
                        (modelTag ? name.includes(modelTag) : true)
                      )
                        return true;
                      if (
                        name.includes(modelNameOnly) &&
                        (modelTag ? name.includes(modelTag) : true)
                      )
                        return true;
                    }
                    // For regular models, check base name and tag
                    if (
                      name.includes(modelBase) &&
                      (modelTag ? name.includes(modelTag) : true)
                    )
                      return true;
                    // Match just base name (for cases like "llama3.2-vision:11b" matching "llama3.2-vision")
                    return (
                      name.startsWith(modelBase + ":") || name === modelBase
                    );
                  }
                );
              });
              setModelAvailability(availability);
            }
          } catch (error) {
            console.error(
              "[AI Assist] Failed to check model availability:",
              error
            );
          }
        } else {
          setOllamaStatus("offline");
          setModelAvailability({});
        }
      } catch {
        setOllamaStatus("offline");
        setModelAvailability({});
      }
    };

    checkOllamaStatus();
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedModelData =
    aiModels.find((m) => m.id === selectedModel) || aiModels[0];

  const updateScrollFades = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8);
  };

  const handleTTS = (text: string, responseIndex: number) => {
    tts.speak(text, `assist-${responseIndex}`);
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

      const ancestor = range.commonAncestorContainer;
      const responseElement =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? (ancestor as Element).closest("[data-response-index]")
          : ancestor.parentElement?.closest("[data-response-index]");

      if (!responseElement) {
        setSelectedText(null);
        return;
      }

      const selectableContent = responseElement.querySelector(
        '[data-selectable-content="true"]'
      );

      if (!selectableContent) {
        setSelectedText(null);
        return;
      }

      const isWithinSelectable =
        selectableContent.contains(range.startContainer) &&
        selectableContent.contains(range.endContainer);

      if (!isWithinSelectable) {
        setSelectedText(null);
        return;
      }

      const responseIndex = parseInt(
        responseElement.getAttribute("data-response-index") || "-1"
      );
      if (responseIndex === -1) {
        setSelectedText(null);
        return;
      }

      const rect = range.getBoundingClientRect();

      setSelectedText({
        text: selectedTextContent,
        responseIndex,
        position: {
          top: rect.top - 60,
          left: rect.left + rect.width / 2,
        },
      });
      selectionRef.current = selection;
    };

    const handleMouseUp = () => {
      setTimeout(handleSelection, 10);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest('[role="textbox"]') ||
        target.closest(".rounded-lg")
      ) {
        return;
      }
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
              Ask questions about the current problem. I&apos;ll guide you
              through the concepts without giving away the answer.
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
                      <div className="text-sm text-muted-foreground">
                        <MarkdownRenderer content={currentQuestion.question} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4 relative">
                  {responses.map((response, idx) => {
                    const parsed = modelUsesReasoningUI(response.model)
                      ? parseReasoningWire(response.answer)
                      : {
                          hasReasoning: false,
                          thinkingContent: "",
                          displayContent: response.answer,
                          isThinking: false,
                        };

                    const { thinkingContent, displayContent, isThinking } =
                      parsed;
                    const showReasoningPanel =
                      modelUsesReasoningUI(response.model) &&
                      parsed.hasReasoning;

                    return (
                      <div key={idx} className="space-y-2">
                        {response.replyingTo && (
                          <div className="mb-1.5 flex items-start gap-2">
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed [&_.prose]:text-xs [&_.prose]:my-0">
                              <MarkdownRenderer content={response.replyingTo.text} />
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 rounded-lg border bg-muted p-3">
                            <p className="text-sm font-medium mb-1">
                              Your question:
                            </p>
                            <div className="text-sm text-muted-foreground">
                              <MarkdownRenderer content={response.question} />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div
                            className="rounded-lg border bg-card p-3"
                            data-response-index={idx}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <p className="text-sm font-medium">
                                AI Response:
                              </p>
                            </div>
                            {showReasoningPanel && (
                              <details
                                open={isThinking}
                                className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground mb-2"
                              >
                                <summary
                                  className={`cursor-pointer select-none font-medium ${
                                    isThinking ? "animate-pulse" : ""
                                  }`}
                                >
                                  {isThinking
                                    ? "Thinking..."
                                    : "Thinking process"}
                                </summary>
                                <div className="mt-1 max-h-72 overflow-y-auto">
                                  <MarkdownRenderer
                                    content={thinkingContent}
                                    className="text-xs text-muted-foreground [&_p]:my-1"
                                  />
                                </div>
                              </details>
                            )}
                            {/* Hide normal content while thinking (only show thinking box) */}
                            {(!isThinking || displayContent) && (
                              <div
                                className="text-sm select-text"
                                data-selectable-content="true"
                              >
                                {response.answer ? (
                                  displayContent ? (
                                    <MarkdownRenderer
                                      content={displayContent}
                                    />
                                  ) : isLoading &&
                                    idx === responses.length - 1 ? (
                                    <div className="flex gap-1">
                                      <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                                      <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                                      <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                  ) : null
                                ) : isLoading &&
                                  idx === responses.length - 1 ? (
                                  <div className="flex gap-1">
                                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    Waiting for response...
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-1">
                            {response.answer &&
                              !(isLoading && idx === responses.length - 1) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      handleTTS(response.answer, idx)
                                    }
                                    style={{ cursor: "pointer" }}
                                    title={
                                      tts.speakingId === `assist-${idx}`
                                        ? "Stop reading"
                                        : "Read answer aloud"
                                    }
                                  >
                                    {tts.speakingId === `assist-${idx}` ? (
                                      <VolumeX className="h-4 w-4" />
                                    ) : (
                                      <Volume2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      handleCopy(response.answer, idx)
                                    }
                                    disabled={copiedResponseIndex === idx}
                                    style={{
                                      cursor:
                                        copiedResponseIndex === idx
                                          ? "default"
                                          : "pointer",
                                    }}
                                    title={
                                      copiedResponseIndex === idx
                                        ? "Copied!"
                                        : "Copy to clipboard"
                                    }
                                  >
                                    {copiedResponseIndex === idx ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      setTimeout(() => {
                        inputRef.current?.focus();
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
                      <div className="text-sm text-muted-foreground line-clamp-2 [&_.prose]:text-sm [&_.prose]:my-0">
                        <MarkdownRenderer content={replyingTo.text} />
                      </div>
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
              <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                      if (inputRef.current) {
                        inputRef.current.style.height = "auto";
                      }
                    }
                  }}
                  placeholder="Ask about this problem..."
                  className="flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[20px] max-h-[150px] overflow-y-auto"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-transparent"
                        style={{ cursor: "pointer" }}
                        title={`${selectedModelData.name} - ${selectedModelData.description}`}
                      >
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Select AI Model</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            ollamaStatus === "online"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : ollamaStatus === "checking"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {ollamaStatus === "online"
                            ? "Online"
                            : ollamaStatus === "checking"
                              ? "Checking..."
                              : "Offline"}
                        </span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {aiModels.map((model) => {
                        const isAvailable =
                          modelAvailability[model.id] ?? false;
                        return (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => handleModelChange(model.id)}
                            className={
                              selectedModel === model.id ? "bg-accent" : ""
                            }
                            style={{ cursor: "pointer" }}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  isAvailable
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-red-500 animate-pulse"
                                }`}
                                title={
                                  isAvailable
                                    ? "Model available"
                                    : "Model not installed"
                                }
                              />
                              <div className="flex flex-col flex-1">
                                <span className="font-medium">
                                  {model.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {model.description}
                                </span>
                              </div>
                              {selectedModel === model.id && (
                                <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                      {ollamaStatus === "offline" && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-2 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">
                              Ollama not running
                            </p>
                            <p>
                              Run:{" "}
                              <code className="bg-muted px-1 rounded">
                                ollama serve
                              </code>
                            </p>
                          </div>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${
                      whisper.isRecording ? "bg-red-100" : "bg-transparent"
                    }`}
                    onClick={handleVoiceRecord}
                    disabled={whisper.isTranscribing || isLoading}
                    style={{ cursor: "pointer" }}
                  >
                    {whisper.isTranscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : whisper.isRecording ? (
                      <Square className="h-4 w-4 text-red-600 animate-pulse" />
                    ) : (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                    onClick={handleSubmit}
                    disabled={!question.trim() || isLoading}
                    style={{ cursor: "pointer" }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                AI will guide you without giving answers.{" "}
                <button
                  onClick={() => setShowDisclaimer(true)}
                  className="text-primary hover:underline underline-offset-2"
                  style={{ cursor: "pointer" }}
                >
                  Learn more
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
              <SheetTitle>How AI Assist Works</SheetTitle>
            </div>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The AI Learning Assistant is designed to help you learn without
              giving away answers. It uses the Socratic method to guide your
              thinking.
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold">What the AI will do:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Ask guiding questions to help you think</li>
                <li>Explain related concepts and principles</li>
                <li>Point you in the right direction</li>
                <li>Encourage critical thinking</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">What the AI won&apos;t do:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Tell you the correct answer</li>
                <li>Reveal which option to choose</li>
                <li>Give hints that directly reveal the answer</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This approach helps you truly understand the material rather than
              just getting the right answer.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

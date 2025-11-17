"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Brain,
  Send,
  Copy,
  HelpCircle,
  Volume2,
  VolumeX,
  CornerDownLeft,
  Mic,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Demo flashcard data - Math topics
const flashcardsData = [
  {
    id: 1,
    question: "What is the quadratic formula?",
    answer:
      "The quadratic formula is x = (-b ± √(b² - 4ac)) / 2a, used to solve quadratic equations of the form ax² + bx + c = 0. It gives both roots of the equation.",
    subject: "Algebra",
  },
  {
    id: 2,
    question: "What is the derivative of x²?",
    answer:
      "The derivative of x² is 2x. This follows from the power rule: d/dx(xⁿ) = n·xⁿ⁻¹. So for x², we have 2·x²⁻¹ = 2x.",
    subject: "Calculus",
  },
  {
    id: 3,
    question: "What is the Pythagorean theorem?",
    answer:
      "The Pythagorean theorem states that in a right triangle, a² + b² = c², where c is the hypotenuse and a and b are the other two sides.",
    subject: "Geometry",
  },
  {
    id: 4,
    question: "What is the formula for the area of a circle?",
    answer:
      "The area of a circle is A = πr², where r is the radius of the circle. This means the area is proportional to the square of the radius.",
    subject: "Geometry",
  },
  {
    id: 5,
    question: "What does SOHCAHTOA stand for?",
    answer:
      "SOHCAHTOA is a mnemonic for trigonometric ratios: Sine = Opposite/Hypotenuse, Cosine = Adjacent/Hypotenuse, Tangent = Opposite/Adjacent.",
    subject: "Trigonometry",
  },
  {
    id: 6,
    question: "What is the chain rule in calculus?",
    answer:
      "The chain rule states that if y = f(g(x)), then dy/dx = (df/dg) × (dg/dx). It's used to find the derivative of composite functions.",
    subject: "Calculus",
  },
  {
    id: 7,
    question: "What is the slope-intercept form of a line?",
    answer:
      "The slope-intercept form is y = mx + b, where m is the slope and b is the y-intercept. This form makes it easy to graph linear equations.",
    subject: "Algebra",
  },
  {
    id: 8,
    question: "What is the formula for the volume of a sphere?",
    answer:
      "The volume of a sphere is V = (4/3)πr³, where r is the radius. This formula shows that volume is proportional to the cube of the radius.",
    subject: "Geometry",
  },
  {
    id: 9,
    question: "What is the unit circle?",
    answer:
      "The unit circle is a circle with radius 1 centered at the origin. It's used to define trigonometric functions: cos(θ) is the x-coordinate and sin(θ) is the y-coordinate of a point on the circle.",
    subject: "Trigonometry",
  },
  {
    id: 10,
    question: "What is the quadratic discriminant?",
    answer:
      "The discriminant is b² - 4ac from the quadratic formula. If it's positive, there are two real solutions; if zero, one solution; if negative, two complex solutions.",
    subject: "Algebra",
  },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  replyingTo?: {
    text: string;
  };
}

export default function FlashcardsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help you create flashcards on any topic. What would you like to study today? Try asking me about topics like Algebra, Photosynthesis, World History, or any subject you're learning!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speakingResponseIndex, setSpeakingResponseIndex] = useState<
    number | null
  >(null);
  const [replyingTo, setReplyingTo] = useState<{ text: string } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [showHelpInfo, setShowHelpInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);

  const currentCard = flashcardsData[currentIndex];
  const progress = ((currentIndex + 1) / flashcardsData.length) * 100;

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Text selection for "Ask AI"
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        const range = selection?.getRangeAt(0);
        const container = range?.commonAncestorContainer;

        // Check if selection is within a selectable AI response
        let ancestor: Node | null = container || null;
        let isSelectable = false;

        while (ancestor && ancestor !== document.body) {
          if (ancestor.nodeType === Node.ELEMENT_NODE) {
            const element = ancestor as Element;
            if (element.getAttribute("data-selectable-content") === "true") {
              isSelectable = true;
              break;
            }
            // Exclude non-selectable elements
            if (
              element.classList.contains("select-none") ||
              element.tagName === "BUTTON"
            ) {
              return;
            }
          }
          ancestor = ancestor.parentNode;
        }

        if (isSelectable && messagesContainerRef.current) {
          selectionRef.current = selection;
          setSelectedText(text);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't clear selection if clicking on the input field or its container
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest(".input-container")
      ) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.toString().trim().length === 0) {
        setSelectedText("");
        selectionRef.current = null;
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < flashcardsData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, isFlipped, handleNext, handlePrevious]);

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleExplain = () => {
    // Add explanation request to chat with the specific prompt format
    const explanationRequest = `I'm reviewing a flashcard and want to understand its underlying concept more deeply.

Front: "${currentCard.question}"

Back: "${currentCard.answer}"

Please expand on this topic with a clear, accurate explanation. Add context, examples, and any important nuances that help me fully understand the idea without going off-topic.`;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: explanationRequest },
      {
        role: "assistant",
        content: `Let me provide a deeper explanation of this concept:\n\nQuestion: ${currentCard.question}\n\nAnswer: ${currentCard.answer}\n\nExpanded Explanation:\n\nThis is a fundamental concept in ${currentCard.subject}. Here's a more detailed breakdown:\n\n${currentCard.answer}\n\nKey Points:\n- This concept is essential for understanding ${currentCard.subject}\n- It builds upon foundational knowledge\n- Practice with examples helps solidify understanding\n\nWould you like me to provide more examples or break down any specific part further?`,
      },
    ]);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      ...(replyingTo && { replyingTo }),
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: `Great question about "${input}"! I've prepared some flashcards on this topic for you. You can navigate through them using the arrows or keyboard shortcuts (←/→). Press Space to flip a card and see the answer!`,
      },
    ]);

    setInput("");
    setReplyingTo(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleVoiceRecord = () => {
    setIsRecording((prev) => !prev);
    // Placeholder for voice recording functionality
  };

  const handleTTS = (text: string, index: number) => {
    if (speakingResponseIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingResponseIndex(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingResponseIndex(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingResponseIndex(index);
    }
  };

  const handleAskAI = () => {
    if (selectedText && selectionRef.current) {
      setReplyingTo({ text: selectedText });
      setSelectedText("");
      selectionRef.current = null;
      document.getElementById("chat-input")?.focus();
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        {/* Left side - AI Chat Assistant */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b bg-background px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    AI Flashcard Creator
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask me to create flashcards on any topic
                </p>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div
            className="flex-1 overflow-y-auto p-6 space-y-4"
            ref={messagesContainerRef}
          >
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="flex flex-col max-w-[85%] gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">AI Response</span>
                    </div>
                    <div
                      className="rounded-lg border bg-muted/50 px-4 py-3"
                      data-response-index={idx}
                    >
                      <div
                        className="text-sm whitespace-pre-wrap"
                        data-selectable-content="true"
                      >
                        {message.content.split("\n").map((line, lineIdx) => {
                          if (
                            line.startsWith("Question:") ||
                            line.startsWith("Answer:") ||
                            line.startsWith("Expanded Explanation:") ||
                            line.startsWith("Key Points:")
                          ) {
                            const parts = line.split(":");
                            return (
                              <p key={lineIdx} className="mb-2">
                                <span className="font-semibold">
                                  {parts[0]}:
                                </span>
                                {parts[1] && (
                                  <span>{parts.slice(1).join(":")}</span>
                                )}
                              </p>
                            );
                          }
                          return (
                            <p key={lineIdx} className="mb-1">
                              {line || "\u00A0"}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTTS(message.content, idx)}
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
                        onClick={() => handleCopy(message.content)}
                        style={{ cursor: "pointer" }}
                        title="Copy to clipboard"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col max-w-[85%]">
                    {message.replyingTo && (
                      <div className="flex items-start gap-2 mb-1 text-xs text-muted-foreground ml-3">
                        <CornerDownLeft className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <p className="italic line-clamp-2">
                          {message.replyingTo.text}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg bg-primary text-primary-foreground px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating "Ask AI" button */}
          {selectedText &&
            selectionRef.current &&
            selectionRef.current.rangeCount > 0 && (
              <Button
                size="sm"
                onClick={handleAskAI}
                className="fixed z-50 shadow-lg"
                style={{
                  left: `${selectionRef.current.getRangeAt(0).getBoundingClientRect().left}px`,
                  top: `${selectionRef.current.getRangeAt(0).getBoundingClientRect().top - 50}px`,
                  cursor: "pointer",
                }}
              >
                Ask AI
              </Button>
            )}

          {/* Input section */}
          <div className="border-t bg-background px-6 py-4">
            {replyingTo && (
              <div className="flex items-start gap-2 mb-3 p-3 bg-muted/50 rounded-lg border">
                <CornerDownLeft className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Replying to AI
                  </p>
                  <p className="text-sm line-clamp-2">{replyingTo.text}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => setReplyingTo(null)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="sr-only">Cancel reply</span>×
                </Button>
              </div>
            )}
            <div className="input-container flex items-center gap-2 border rounded-lg px-3 py-2 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask for flashcards on any topic..."
                className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleVoiceRecord}
                style={{ cursor: "pointer" }}
              >
                {isRecording ? (
                  <Square className="h-4 w-4 text-red-500" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-8 w-8 flex-shrink-0"
                style={{ cursor: input.trim() ? "pointer" : "default" }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Right side - Flashcards */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b bg-background px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">AI Flashcards</h2>
                  <p className="text-sm text-muted-foreground">
                    {flashcardsData.length} cards
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHelpInfo(true)}
                  style={{ cursor: "pointer" }}
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  style={{ cursor: "pointer" }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Flashcard area */}
          <div className="flex-1 flex items-center justify-center p-6 relative">
            {/* Instructions */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
              <p className="text-sm text-muted-foreground">
                Press &quot;Space&quot; to flip, &quot;←/→&quot; to navigate
              </p>
            </div>

            {/* Previous Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border shadow-lg hover:bg-accent disabled:opacity-30 z-20"
              style={{ cursor: currentIndex === 0 ? "default" : "pointer" }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {/* Flashcard */}
            <div
              className="relative w-full max-w-xl h-[400px] cursor-pointer perspective-1000"
              onClick={handleFlip}
            >
              <div
                className={cn(
                  "absolute inset-0 transition-all duration-500 transform-style-3d"
                )}
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front of card (Question) */}
                <Card
                  className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 shadow-2xl border-2"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20">
                    {currentCard.subject}
                  </Badge>
                  <h2 className="text-2xl font-medium text-center leading-relaxed mb-12">
                    {currentCard.question}
                  </h2>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className="mt-auto"
                    style={{ cursor: "pointer" }}
                  >
                    See answer
                  </Button>
                </Card>

                {/* Back of card (Answer) */}
                <Card
                  className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 shadow-2xl border-2"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <p className="text-lg text-center leading-relaxed mb-8">
                    {currentCard.answer}
                  </p>
                  <div className="flex gap-3 mt-auto">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExplain();
                      }}
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Explain
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            {/* Next Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex === flashcardsData.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border shadow-lg hover:bg-accent disabled:opacity-30 z-20"
              style={{
                cursor:
                  currentIndex === flashcardsData.length - 1
                    ? "default"
                    : "pointer",
              }}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="border-t bg-background px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {currentIndex + 1} / {flashcardsData.length} cards
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      </div>

      {/* Help Sheet */}
      <Sheet open={showHelpInfo} onOpenChange={setShowHelpInfo}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              How AI Flashcards Works
            </SheetTitle>
            <SheetDescription className="text-left">
              Learn how to use AI Flashcards to study effectively
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Creating Flashcards</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use the Flashcard Creator on the left to request flashcards on
                any topic. Just type what you want to study (e.g., &quot;Create
                flashcards on Algebra&quot; or &quot;Make cards about
                Photosynthesis&quot;), and AI will prepare customized flashcards
                for you.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Navigating Cards</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Arrow Navigation
                    </p>
                    <p>
                      Use the arrow buttons on either side of the flashcard or
                      press ← and → on your keyboard to move between cards.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Flipping Cards
                    </p>
                    <p>
                      Click anywhere on the card or press Space to flip it and
                      reveal the answer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Getting Help</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Explain Button
                    </p>
                    <p>
                      Click the &quot;Explain&quot; button on any card to get a
                      detailed explanation in the chat. The AI will provide
                      context, examples, and important nuances.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Ask AI Feature
                    </p>
                    <p>
                      Highlight any text from the AI&apos;s responses and click
                      &quot;Ask AI&quot; to ask follow-up questions about
                      specific parts of the explanation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Progress Tracking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The progress bar at the bottom shows how many cards you&apos;ve
                reviewed and your completion percentage. Use the Reset button to
                start over at any time.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}

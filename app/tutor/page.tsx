"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/lib/store";
import { addMessage, setLoading } from "@/lib/features/tutor/tutorSlice";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Copy,
  Sparkles,
  Paperclip,
  Cpu,
  Mic,
  Volume2,
  VolumeX,
  Square,
} from "lucide-react";
import { FileText } from "lucide-react";

const aiModels = [
  { id: "llama-3b", name: "Llama 3B", description: "Lightweight, fast" },
  { id: "deepseek", name: "DeepSeek", description: "Balanced performance" },
  { id: "mistral", name: "Mistral 7B", description: "High accuracy" },
  { id: "phi", name: "Phi-3", description: "Efficient reasoning" },
];

const mockResponses: Record<string, string> = {
  default:
    "I'm here to help you with your academic questions. Feel free to ask me anything about mathematics, science, or your coursework. Based on the uploaded course materials, I can provide contextually relevant answers.",
  calculus:
    "Based on the uploaded Calculus textbook, the Fundamental Theorem of Calculus connects differentiation and integration. It states that if a function is continuous on an interval, then the derivative of its integral equals the original function. This theorem is crucial for solving many calculus problems. [Retrieved from: Calculus_Textbook_Chapter1.pdf]",
  physics:
    "According to the Physics Lab Manual, Newton's laws of motion are fundamental principles. First law: An object at rest stays at rest unless acted upon. Second law: F = ma (force equals mass times acceleration). Third law: For every action, there's an equal and opposite reaction. When solving problems, identify forces, draw free-body diagrams, and apply these laws systematically. [Retrieved from: Physics_Lab_Manual.pdf]",
  study:
    "Effective STEM study strategies include: 1) Active practice with problems, 2) Understanding concepts before memorizing formulas, 3) Regular review sessions, 4) Teaching concepts to others, 5) Breaking complex topics into smaller parts, and 6) Using visual aids and diagrams. Consistency is key.",
  algebra:
    "Quadratic equations have the form ax² + bx + c = 0. Solutions can be found using: 1) Factoring, 2) Completing the square, or 3) The quadratic formula: x = (-b ± √(b²-4ac)) / 2a. The discriminant (b²-4ac) tells you about the nature of solutions.",
};

function getMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  if (
    lowerMessage.includes("calculus") ||
    lowerMessage.includes("derivative") ||
    lowerMessage.includes("integral")
  ) {
    return mockResponses.calculus;
  }
  if (
    lowerMessage.includes("newton") ||
    lowerMessage.includes("physics") ||
    lowerMessage.includes("force")
  ) {
    return mockResponses.physics;
  }
  if (
    lowerMessage.includes("study") ||
    lowerMessage.includes("learn") ||
    lowerMessage.includes("strategy")
  ) {
    return mockResponses.study;
  }
  if (
    lowerMessage.includes("quadratic") ||
    lowerMessage.includes("algebra") ||
    lowerMessage.includes("equation")
  ) {
    return mockResponses.algebra;
  }
  return mockResponses.default;
}

function extractCitations(text: string): string[] {
  const regex = /\[Retrieved from:\s*([^\]]+)\]/gi;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function stripCitationTags(text: string): string {
  return text.replace(/\s*\[Retrieved from:[^\]]+\]/gi, "").trim();
}

export default function TutorPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, isLoading } = useSelector(
    (state: RootState) => state.tutor
  );
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("deepseek");
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const [hoveredCitation, setHoveredCitation] = useState<{
    messageId: string;
    index: number;
    title: string;
  } | null>(null);
  const [citationHideTimer, setCitationHideTimer] = useState<number | null>(
    null
  );
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const updateScrollFades = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopFade(scrollTop > 8);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8);
  };

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const scrollOptions: ScrollToOptions = {
      top: container.scrollHeight,
      behavior: "smooth",
    };
    container.scrollTo(scrollOptions);
    updateScrollFades();
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => updateScrollFades();
    container.addEventListener("scroll", handleScroll);
    updateScrollFades();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTTS = (text: string, messageId: string) => {
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(messageId);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    dispatch(
      addMessage({
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      })
    );
    setInput("");
    dispatch(setLoading(true));

    setTimeout(() => {
      const response = getMockResponse(userMessage);
      dispatch(
        addMessage({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        })
      );
      dispatch(setLoading(false));
    }, 1000);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleFileAttach = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt,.png,.jpg";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log("File attached:", file.name);
      }
    };
    input.click();
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    // Placeholder for Whisper integration
    if (!isRecording) {
      console.log("Starting voice recording...");
    } else {
      console.log("Stopping voice recording...");
    }
  };

  const selectedModelData =
    aiModels.find((m) => m.id === selectedModel) || aiModels[1];

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 -mb-4">
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-center">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Tutor
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="relative flex-1">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent transition-opacity duration-300"
                style={{ opacity: showTopFade ? 1 : 0 }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity duration-300"
                style={{ opacity: showBottomFade ? 1 : 0 }}
              />
              <div
                className="h-full overflow-y-auto space-y-4 pb-56"
                ref={messagesContainerRef}
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        How can I help you today?
                      </h3>
                      <p className="text-muted-foreground mt-2">
                        Ask me anything about your coursework, concepts, or study
                        strategies.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const rawCitations =
                      message.role === "assistant"
                        ? extractCitations(message.content)
                        : [];
                    const citationList =
                      rawCitations.length > 0
                        ? rawCitations
                        : message.role === "assistant"
                          ? ["Knowledge Base"]
                          : [];
                    const displayContent =
                      message.role === "assistant"
                        ? stripCitationTags(message.content)
                        : message.content;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        } ${message.role === "assistant" ? "mb-6" : "mb-3"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <p className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {displayContent}
                              </p>
                              {message.role === "assistant" &&
                                citationList.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {citationList.map((citation, idx) => (
                                      <div
                                        key={`${message.id}-citation-${idx}`}
                                        className="relative"
                                        onMouseEnter={() =>
                                          setHoveredCitation({
                                            messageId: message.id,
                                            index: idx,
                                            title: citation,
                                          })
                                        }
                                        onMouseLeave={() => {
                                          if (citationHideTimer)
                                            window.clearTimeout(
                                              citationHideTimer
                                            );
                                          const t = window.setTimeout(
                                            () => setHoveredCitation(null),
                                            200
                                          );
                                          setCitationHideTimer(t);
                                        }}
                                      >
                                        <button
                                          type="button"
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                                          aria-label={`View citation ${idx + 1}`}
                                        >
                                          {idx + 1}
                                        </button>
                                        {hoveredCitation?.messageId ===
                                          message.id &&
                                          hoveredCitation.index === idx && (
                                            <div
                                              className="absolute z-30 mt-2 w-96 rounded-md border bg-background p-3 shadow-lg"
                                              onMouseEnter={() => {
                                                if (citationHideTimer)
                                                  window.clearTimeout(
                                                    citationHideTimer
                                                  );
                                              }}
                                              onMouseLeave={() => {
                                                if (citationHideTimer)
                                                  window.clearTimeout(
                                                    citationHideTimer
                                                  );
                                                const t = window.setTimeout(
                                                  () => setHoveredCitation(null),
                                                  450
                                                );
                                                setCitationHideTimer(t);
                                              }}
                                            >
                                              <div className="text-sm leading-relaxed text-muted-foreground max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                                In differential calculus, the
                                                Fundamental Theorem of Calculus
                                                bridges antiderivatives with
                                                definite integrals by showing that
                                                accumulation of rates reconstructs
                                                the original quantity. When a
                                                function f is continuous on [a,
                                                b], any antiderivative F satisfies
                                                ∫ₐᵇ f(x) dx = F(b) − F(a). This
                                                identity not only provides an
                                                efficient strategy for evaluation,
                                                but also clarifies why
                                                differentiation and integration
                                                act as inverse processes under
                                                appropriate regularity conditions.
                                                In applications, one often selects
                                                a convenient
                                                antiderivative—sometimes built
                                                from elementary transformations,
                                                sometimes via substitution—so that
                                                boundary evaluation yields a
                                                closed‑form result. Longer note:
                                                For sequences of increasingly
                                                refined partitions, the Riemann
                                                sums converge provided
                                                oscillations diminish
                                                sufficiently; continuity ensures
                                                this. In practice, numerical
                                                quadrature approximates the
                                                integral when symbolic
                                                antiderivatives are unavailable.
                                                Error bounds depend on smoothness
                                                (e.g., the trapezoidal and Simpson
                                                rules exploit first and second
                                                derivatives respectively). These
                                                ideas generalize to
                                                measure‑theoretic integration,
                                                where limits, dominated
                                                convergence, and absolute
                                                integrability formalize the
                                                intuition that “small pieces” add
                                                up consistently.
                                              </div>
                                              <div className="mt-2 border-t pt-2 text-xs font-medium text-muted-foreground">
                                                Cited from: {citation}
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {message.role === "assistant" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      handleTTS(message.content, message.id)
                                    }
                                    style={{ cursor: "pointer" }}
                                    title={
                                      speakingMessageId === message.id
                                        ? "Stop reading"
                                        : "Read answer aloud"
                                    }
                                  >
                                    {speakingMessageId === message.id ? (
                                      <VolumeX className="h-3 w-3" />
                                    ) : (
                                      <Volume2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleCopy(message.content)}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {message.role === "assistant" &&
                            citationList.length > 0 && (
                              <Alert className="mt-2 w-fit px-2.5 py-1.5">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <AlertDescription className="text-xs">
                                    Source:{" "}
                                    <span className="font-medium">
                                      {citationList[0]}
                                    </span>
                                  </AlertDescription>
                                </div>
                              </Alert>
                            )}
                          <p className="text-xs opacity-70 mt-2">
                            {message.timestamp.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="flex-shrink-0 border-t pt-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question about your coursework..."
                  className="flex-1 border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full bg-transparent"
                        style={{ cursor: "pointer" }}
                        title={`${selectedModelData.name} - ${selectedModelData.description}`}
                      >
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {aiModels.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={
                            selectedModel === model.id ? "bg-accent" : ""
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.description}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-transparent"
                    onClick={handleFileAttach}
                    style={{ cursor: "pointer" }}
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 rounded-full ${
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
                    className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    style={{ cursor: "pointer" }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* tooltip handled inline per citation */}
    </Layout>
  );
}

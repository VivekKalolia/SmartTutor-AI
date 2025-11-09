"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/lib/store";
import { addMessage, setLoading } from "@/lib/features/tutor/tutorSlice";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Send, Copy, Sparkles, Paperclip, Cpu, Mic, Volume2, VolumeX } from "lucide-react";

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

export default function TutorPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, isLoading } = useSelector(
    (state: RootState) => state.tutor
  );
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("deepseek");
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

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

  const selectedModelData = aiModels.find((m) => m.id === selectedModel) || aiModels[1];

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)]">
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Tutor
                </CardTitle>
                <Badge variant="secondary" className="bg-green-500 text-white">Online</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
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
                        Ask me anything about your coursework, concepts, or
                        study strategies.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <div className="flex gap-1 flex-shrink-0">
                            {message.role === "assistant" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleTTS(message.content, message.id)}
                                  style={{ cursor: "pointer" }}
                                  title={speakingMessageId === message.id ? "Stop reading" : "Read answer aloud"}
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
                        <p className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
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
              </div>

              <div className="flex gap-2 items-center">
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
                  className="flex-1"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      style={{ cursor: "pointer" }}
                      title={`${selectedModelData.name} - ${selectedModelData.description}`}
                    >
                      <Cpu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {aiModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={selectedModel === model.id ? "bg-accent" : ""}
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
                  variant="outline"
                  size="icon"
                  onClick={handleFileAttach}
                  style={{ cursor: "pointer" }}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleVoiceRecord}
                  className={isRecording ? "bg-red-500 hover:bg-red-600" : ""}
                  style={{ cursor: "pointer" }}
                >
                  <Mic className={`h-4 w-4 ${isRecording ? "text-white" : ""}`} />
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  style={{ cursor: "pointer" }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

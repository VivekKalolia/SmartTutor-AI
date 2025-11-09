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
  Send,
  Copy,
  Sparkles,
  BookOpen,
  Calculator,
  Atom,
  Lightbulb,
} from "lucide-react";

const samplePrompts = [
  {
    title: "Explain Calculus Concepts",
    prompt: "Can you explain the fundamental theorem of calculus?",
    icon: Calculator,
  },
  {
    title: "Physics Problem Help",
    prompt: "How do I solve problems involving Newton's laws of motion?",
    icon: Atom,
  },
  {
    title: "Study Tips",
    prompt: "What are effective study strategies for STEM subjects?",
    icon: Lightbulb,
  },
  {
    title: "Algebra Review",
    prompt: "Help me understand quadratic equations and their solutions.",
    icon: BookOpen,
  },
];

const mockResponses: Record<string, string> = {
  default:
    "I'm here to help you with your academic questions. Feel free to ask me anything about mathematics, science, or your coursework.",
  calculus:
    "The Fundamental Theorem of Calculus connects differentiation and integration. It states that if a function is continuous on an interval, then the derivative of its integral equals the original function. This theorem is crucial for solving many calculus problems.",
  physics:
    "Newton's laws of motion are fundamental principles in physics. First law: An object at rest stays at rest unless acted upon. Second law: F = ma (force equals mass times acceleration). Third law: For every action, there's an equal and opposite reaction. When solving problems, identify forces, draw free-body diagrams, and apply these laws systematically.",
  study:
    "Effective STEM study strategies include: 1) Active practice with problems, 2) Understanding concepts before memorizing formulas, 3) Regular review sessions, 4) Teaching concepts to others, 5) Breaking complex topics into smaller parts, and 6) Using visual aids and diagrams. Consistency is key.",
  algebra:
    "Quadratic equations have the form ax² + bx + c = 0. Solutions can be found using: 1) Factoring, 2) Completing the square, or 3) The quadratic formula: x = (-b ± √(b²-4ac)) / 2a. The discriminant (b²-4ac) tells you about the nature of solutions.",
};

function getMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes("calculus") || lowerMessage.includes("derivative") || lowerMessage.includes("integral")) {
    return mockResponses.calculus;
  }
  if (lowerMessage.includes("newton") || lowerMessage.includes("physics") || lowerMessage.includes("force")) {
    return mockResponses.physics;
  }
  if (lowerMessage.includes("study") || lowerMessage.includes("learn") || lowerMessage.includes("strategy")) {
    return mockResponses.study;
  }
  if (lowerMessage.includes("quadratic") || lowerMessage.includes("algebra") || lowerMessage.includes("equation")) {
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

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        <div className="hidden lg:block w-64 flex-shrink-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Prompts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {samplePrompts.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 text-left"
                    onClick={() => handlePromptClick(prompt.prompt)}
                  >
                    <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">{prompt.title}</span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Academic Assistant
                </CardTitle>
                <Badge variant="secondary">Online</Badge>
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
                    <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-md">
                      {samplePrompts.map((prompt, idx) => {
                        const Icon = prompt.icon;
                        return (
                          <Button
                            key={idx}
                            variant="outline"
                            className="h-auto py-3 flex-col gap-2"
                            onClick={() => handlePromptClick(prompt.prompt)}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-xs">{prompt.title}</span>
                          </Button>
                        );
                      })}
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
                          {message.role === "assistant" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => handleCopy(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
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

              <div className="flex gap-2">
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
                <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
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


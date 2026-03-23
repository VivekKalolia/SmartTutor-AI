"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Check,
  HelpCircle,
  Volume2,
  VolumeX,
  CornerDownLeft,
  Mic,
  Square,
  Loader2,
  Cpu,
  Paperclip,
  X,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWhisper } from "@/lib/hooks/useWhisper";
import { useTTS } from "@/lib/hooks/useTTS";
import { stripForTTS } from "@/lib/tts/strip-for-tts";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useImageCaption } from "@/lib/hooks/useImageCaption";
import { MarkdownRenderer } from "@/components/markdown-renderer";

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

const VISION_MODEL_ID = "llama3.2-vision:11b";

function readFileAsBase64(
  file: File
): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (match) resolve({ mime: match[1], base64: match[2] });
      else reject(new Error("Invalid data URL"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  subject: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  replyingTo?: {
    text: string;
  };
}

function buildFlashcardsGreeting(name?: string | null, grade?: string | null): string {
  const safeName = (name ?? "").trim() || "Student";
  const gradeNote = grade ? ` I already know you're in ${grade}, so I'll tailor the difficulty automatically.` : "";
  return `Hi ${safeName}! I can help you create flashcards on any topic.${gradeNote} What would you like to study today? Try asking me about topics like Algebra, Photosynthesis, World History, or any subject you're learning!`;
}

export default function FlashcardsPage() {
  const [studentName, setStudentName] = useState<string>("Student");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: buildFlashcardsGreeting("Student"),
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama3.1:8b");
  const [ollamaStatus, setOllamaStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [modelAvailability, setModelAvailability] = useState<
    Record<string, boolean>
  >({});
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    caption: string;
    file: File;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<
    "understanding" | "generating" | null
  >(null);
  const [conversationPhase, setConversationPhase] = useState<
    "understanding" | "ready"
  >("understanding");
  // rhsFlashcardLoading is only used internally to track generation in progress
  const rhsFlashcardLoadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamReaderRef =
    useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const name = typeof data?.name === "string" ? data.name : "Student";
        const grade = typeof data?.grade === "string" ? data.grade : null;
        setStudentName(name);
        setMessages((prev) => {
          if (!prev || prev.length === 0) return prev;
          if (prev[0]?.role !== "assistant") return prev;
          const next = [...prev];
          next[0] = { ...next[0], content: buildFlashcardsGreeting(name, grade) };
          return next;
        });
      } catch (e) {
        console.error("[Flashcards] Failed to load profile:", e);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // Whisper for voice-to-text
  const whisper = useWhisper({
    onTranscript: (text) => {
      setInput((prev) => prev + (prev ? " " : "") + text);
      toast.success("Transcription complete!");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // BLIP for image captioning
  const imageCaption = useImageCaption({
    onCaption: (caption, url) => {
      setPendingImage((prev) => (prev ? { ...prev, caption, url } : null));
      toast.success("Image analyzed!");
    },
    onError: (error) => {
      toast.error(error);
    },
  });
  const tts = useTTS();
  const [replyingTo, setReplyingTo] = useState<{ text: string } | null>(null);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    messageIndex: number;
    messageRole: "user" | "assistant";
    position: { top: number; left: number };
  } | null>(null);
  const [showHelpInfo, setShowHelpInfo] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null
  );
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const prevMessageCountRef = useRef(0);

  const currentCard = flashcards.length > 0 ? flashcards[currentIndex] : null;
  const progress =
    flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0;

  // Update scroll fade effects
  const updateScrollFades = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopFade(scrollTop > 8);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8);
  };

  // Auto-scroll to latest message ONLY after final output (not during streaming)
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    // Only scroll when:
    // 1. A new message is added (not just content updated)
    // 2. AND we're not currently loading (streaming)
    const isNewMessage = messages.length > prevMessageCountRef.current;
    const shouldScroll = isNewMessage && !isLoading;

    if (shouldScroll && messages.length > 0) {
      const container = messagesContainerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: "smooth",
      };
      container.scrollTo(scrollOptions);
    }

    prevMessageCountRef.current = messages.length;
    updateScrollFades();
  }, [messages, isLoading]);

  // When AI flashcard creator finishes a new assistant message, prefetch TTS.
  // Also prefetch the current flashcard's question+answer when the deck changes.
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant" && last.content && last.content.trim()) {
        tts.prefetch(stripForTTS(last.content));
      }
    }
  }, [isLoading, messages, tts]);

  // Pre-process TTS for all flashcards when the deck changes
  useEffect(() => {
    if (flashcards.length > 0) {
      for (const card of flashcards) {
        tts.prefetch(stripForTTS(`${card.question}. ${card.answer}`));
      }
    }
  }, [flashcards, tts]);

  // Update fade effects on scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => updateScrollFades();
    container.addEventListener("scroll", handleScroll);
    updateScrollFades();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle text selection for "Ask AI" feature
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

      // Check if selection is within a message (user or assistant)
      const ancestor = range.commonAncestorContainer;
      const messageElement =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? (ancestor as Element).closest(
              '[data-message-role="user"], [data-message-role="assistant"]'
            )
          : ancestor.parentElement?.closest(
              '[data-message-role="user"], [data-message-role="assistant"]'
            );

      if (!messageElement) {
        setSelectedText(null);
        return;
      }

      const messageRole = messageElement.getAttribute("data-message-role");

      // For assistant messages, check if selection is within selectable content
      // For user messages, allow selection from anywhere in the message
      if (messageRole === "assistant") {
        const selectableContent = messageElement.querySelector(
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
      }

      // Get message index from the element
      const messageIndexStr = messageElement.getAttribute("data-message-index");
      if (!messageIndexStr) {
        setSelectedText(null);
        return;
      }

      const messageIndex = parseInt(messageIndexStr, 10);

      // Get position for floating button (using viewport coordinates for fixed positioning)
      const rect = range.getBoundingClientRect();

      setSelectedText({
        text: selectedTextContent,
        messageIndex,
        messageRole: messageRole as "user" | "assistant",
        position: {
          top: rect.top - 50, // Position above selection
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
      // Don't clear selection if clicking on input field, textarea, Ask AI button, or its container
      if (
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest('[role="textbox"]') ||
        target.closest(".rounded-lg") || // Input container
        target.closest("button") // Don't clear when clicking buttons (including Ask AI)
      ) {
        return;
      }
      // Clear selection if clicking outside messages (user or assistant)
      if (
        !target.closest('[data-message-role="user"]') &&
        !target.closest('[data-message-role="assistant"]')
      ) {
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
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, flashcards.length]);

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
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      )
        return;

      // Only work if we have flashcards
      if (flashcards.length === 0) return;

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
  }, [currentIndex, isFlipped, handleNext, handlePrevious, flashcards.length]);

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleExplain = () => {
    if (!currentCard) return;

    // Add explanation request to chat with the specific prompt format
    const explanationRequest = `I'm reviewing a flashcard and want to understand its underlying concept more deeply.

Front: "${currentCard.question}"

Back: "${currentCard.answer}"

Please expand on this topic with a clear, accurate explanation. Add context, examples, and any important nuances that help me fully understand the idea without going off-topic.`;

    // Send to API for explanation (not creating new flashcards)
    handleSendMessage(explanationRequest, false);
  };

  // Detect if user wants new flashcards or is asking questions
  const detectIntent = (message: string): "new_flashcards" | "question" => {
    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase();
    const newFlashcardKeywords = [
      "create flashcards",
      "make cards",
      "generate flashcards",
      "new flashcards",
      "flashcards on",
      "flashcards about",
      "flashcards for",
      "i want to study",
      "i want flashcards",
      "create cards",
      "make flashcards",
    ];
    const questionKeywords = [
      "what does",
      "can you explain",
      "i don't understand",
      "help me with",
      "what is",
      "how does",
      "why",
      "tell me about",
    ];

    const wantsNew = newFlashcardKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );
    const isQuestion = questionKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );

    const politeOrExplicitNewTopic =
      /\b(pls|please)\s*$/i.test(trimmed) ||
      /\b(another|different|new)\s+(set|topic|deck)\b/i.test(lowerMessage) ||
      /\b(flashcards?|cards?)\s+(on|about|for)\b/i.test(lowerMessage) ||
      /\b(make|create|generate)\b.*\b(flashcards?|cards?)\b/i.test(
        lowerMessage
      );

    const questionStarters =
      /^(what|how|why|when|where|who|which|can you|could you|would you|explain|define|is |are |do |does |did |tell me|give me|describe)\b/i;
    const chatter = new Set([
      "thanks",
      "thank you",
      "ok",
      "okay",
      "yes",
      "no",
      "hi",
      "hello",
      "bye",
      "cool",
      "nice",
    ]);
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const looksLikeBareTopic =
      flashcards.length > 0 &&
      !trimmed.includes("?") &&
      !questionStarters.test(trimmed) &&
      wordCount >= 1 &&
      wordCount <= 10 &&
      trimmed.length >= 3 &&
      trimmed.length <= 120 &&
      !chatter.has(lowerMessage) &&
      !lowerMessage.startsWith("i'm reviewing") &&
      !lowerMessage.startsWith("i am reviewing") &&
      !lowerMessage.includes("regarding this text");

    if (politeOrExplicitNewTopic && !isQuestion) return "new_flashcards";
    if (looksLikeBareTopic && !isQuestion) return "new_flashcards";
    if (wantsNew) return "new_flashcards";
    if (isQuestion && flashcards.length > 0) return "question";
    return flashcards.length > 0 ? "question" : "new_flashcards";
  };

  // Parse JSON flashcards from response
  const parseFlashcardsFromResponse = (
    response: string
  ): Flashcard[] | null => {
    try {
      // Try to find JSON block in the response (multiple patterns)
      const patterns = [
        /```json\s*([\s\S]*?)\s*```/,
        /```\s*\{[\s\S]*?"flashcards"[\s\S]*?\}\s*```/,
        /\{[\s\S]*?"flashcards"[\s\S]*?\}/,
      ];

      for (const pattern of patterns) {
        const jsonMatch = response.match(pattern);
        if (jsonMatch) {
          try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            if (
              parsed.flashcards &&
              Array.isArray(parsed.flashcards) &&
              parsed.flashcards.length > 0
            ) {
              return parsed.flashcards.map((card: any, index: number) => ({
                id: index + 1,
                question: card.question || "",
                answer: card.answer || "",
                subject: card.subject || "General",
              }));
            }
          } catch (e) {
            // Try next pattern
            continue;
          }
        }
      }

      // Try parsing the entire response as JSON (if it's pure JSON)
      try {
        const parsed = JSON.parse(response.trim());
        if (
          parsed.flashcards &&
          Array.isArray(parsed.flashcards) &&
          parsed.flashcards.length > 0
        ) {
          return parsed.flashcards.map((card: any, index: number) => ({
            id: index + 1,
            question: card.question || "",
            answer: card.answer || "",
            subject: card.subject || "General",
          }));
        }
      } catch (e) {
        // Not pure JSON, continue
      }

      // Try to find JSON object even if incomplete (look for closing braces)
      const jsonObjectMatch = response.match(
        /\{[\s\S]*?"flashcards"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/
      );
      if (jsonObjectMatch) {
        try {
          const parsed = JSON.parse(jsonObjectMatch[0]);
          if (
            parsed.flashcards &&
            Array.isArray(parsed.flashcards) &&
            parsed.flashcards.length > 0
          ) {
            return parsed.flashcards.map((card: any, index: number) => ({
              id: index + 1,
              question: card.question || "",
              answer: card.answer || "",
              subject: card.subject || "General",
            }));
          }
        } catch (e) {
          // Invalid JSON, continue
        }
      }
    } catch (error) {
      console.error("[Flashcards] Failed to parse flashcards:", error);
    }
    return null;
  };

  // Stop generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel();
      streamReaderRef.current = null;
    }
    setIsLoading(false);
    setLoadingPhase(null);
    rhsFlashcardLoadingRef.current = false;
    toast.info("Generation stopped");
  };

  // Send message to API
  const handleSendMessage = async (
    userMessage: string,
    isNewFlashcardRequest: boolean
  ) => {
    if (!userMessage.trim() && !pendingImage) return;

    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel().catch(() => {});
      streamReaderRef.current = null;
    }

    const replyingToContext = replyingTo ? { ...replyingTo } : null;
    let messageContent = userMessage;

    // Add replyingTo context to the message for the AI
    if (replyingToContext) {
      messageContent = `[Regarding this text: "${replyingToContext.text}"]\n\nUser's question: ${userMessage}`;
    }

    // When image is attached we send the image to the vision model; use prompt only (no caption injection so the model sees the image).
    if (pendingImage) {
      messageContent = messageContent || "Create flashcards from this image.";
    }

    if (isNewFlashcardRequest && !pendingImage) {
      messageContent = `Generate exactly 10 flashcards on: ${messageContent}\n\nRespond ONLY with the JSON block. Do NOT ask any clarifying questions. Go directly to Phase 2 generation.`;
    }

    // Add user message to chat
    const displayMessage = userMessage || (pendingImage ? "Image" : "");
    const userMsg: Message = {
      role: "user",
      content: displayMessage,
      ...(replyingTo && { replyingTo }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setReplyingTo(null);

    // Clear pending image after storing; keep file reference to send as base64 for vision model
    const imageUrlToShow = pendingImage?.url || null;
    const imageFileToSend = pendingImage?.file ?? null;
    setPendingImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const shouldCreateFlashcards = isNewFlashcardRequest;

    if (shouldCreateFlashcards) {
      setLoadingPhase("generating");
      setConversationPhase("understanding");
      rhsFlashcardLoadingRef.current = true;
    } else {
      setLoadingPhase(null);
    }

    setIsLoading(true);

    // Create abort controller for stopping
    abortControllerRef.current = new AbortController();

    try {
      // Build conversation history (last 20 messages)
      const conversationHistory = messages.slice(-20).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      let imagePayload: { base64: string; mime: string } | null = null;
      if (imageFileToSend) {
        imagePayload = await readFileAsBase64(imageFileToSend);
      }

      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          model: selectedModel,
          conversationHistory,
          phase: shouldCreateFlashcards ? "ready" : "ready",
          ...(imagePayload && {
            imageBase64: imagePayload.base64,
            imageMime: imagePayload.mime,
          }),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Create assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Stream response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      streamReaderRef.current = reader;
      const decoder = new TextDecoder();
      let fullResponse = "";
      let accumulatedContent = "";
      let displayContent = ""; // What we show to the user (without JSON)
      let hasJsonBlock = false;
      let flashcardsExtracted = false; // Flag to track if flashcards were extracted

      while (true) {
        const { done, value } = await reader.read();
        if (done || flashcardsExtracted) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulatedContent += data.token;
                fullResponse += data.token;

                // Check if we're entering JSON block
                if (
                  accumulatedContent.includes("```json") ||
                  accumulatedContent.includes("```") ||
                  accumulatedContent.includes('"flashcards"')
                ) {
                  hasJsonBlock = true;
                  // Extract content before JSON block for display
                  const jsonStart = Math.min(
                    accumulatedContent.indexOf("```json") >= 0
                      ? accumulatedContent.indexOf("```json")
                      : Infinity,
                    accumulatedContent.indexOf("```") >= 0
                      ? accumulatedContent.indexOf("```")
                      : Infinity,
                    accumulatedContent.indexOf('"flashcards"') >= 0
                      ? accumulatedContent.indexOf('"flashcards"') - 10
                      : Infinity
                  );
                  if (jsonStart > 0 && jsonStart < Infinity) {
                    displayContent = accumulatedContent
                      .substring(0, jsonStart)
                      .trim();
                  } else {
                    displayContent = "";
                  }
                } else if (!hasJsonBlock) {
                  // Only show content if we haven't hit JSON yet
                  displayContent = accumulatedContent;
                }

                // Try to parse flashcards continuously during streaming if JSON appears complete
                if (
                  shouldCreateFlashcards &&
                  hasJsonBlock &&
                  !flashcardsExtracted &&
                  (accumulatedContent.includes("```") ||
                    accumulatedContent.includes('"flashcards"'))
                ) {
                  // Check if JSON block might be complete
                  // For markdown code blocks: check if we have opening and closing ```
                  const hasMarkdownBlock =
                    accumulatedContent.includes("```json") ||
                    accumulatedContent.includes("```");
                  const markdownComplete = hasMarkdownBlock
                    ? (accumulatedContent.match(/```/g) || []).length >= 2
                    : false;

                  // For raw JSON: check if braces are balanced and we have flashcards array
                  const openBraces = (accumulatedContent.match(/\{/g) || [])
                    .length;
                  const closeBraces = (accumulatedContent.match(/\}/g) || [])
                    .length;
                  const hasFlashcardsArray =
                    accumulatedContent.includes('"flashcards"') &&
                    accumulatedContent.includes("[") &&
                    accumulatedContent.includes("]");
                  const jsonComplete =
                    hasFlashcardsArray &&
                    openBraces > 0 &&
                    openBraces === closeBraces;

                  // Try parsing if either format appears complete
                  if (markdownComplete || jsonComplete) {
                    const parsedFlashcards =
                      parseFlashcardsFromResponse(accumulatedContent);
                    if (parsedFlashcards && parsedFlashcards.length > 0) {
                      // Found valid flashcards! Display them immediately
                      setFlashcards(parsedFlashcards);
                      setCurrentIndex(0);
                      setIsFlipped(false);
                      setConversationPhase("ready");
                      setLoadingPhase(null);
                      setIsLoading(false);
                      rhsFlashcardLoadingRef.current = false;

                      // Update message
                      setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                          role: "assistant",
                          content: `Perfect! I've created ${parsedFlashcards.length} unique flashcards for you. You can now review them on the right side. Use the arrow keys or buttons to navigate, and press Space to flip each card!`,
                        };
                        return updated;
                      });

                      toast.success(
                        `Generated ${parsedFlashcards.length} flashcards!`
                      );

                      // Stop reading the stream since we got what we need
                      flashcardsExtracted = true;
                      if (streamReaderRef.current) {
                        streamReaderRef.current.cancel();
                        streamReaderRef.current = null;
                      }
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      // Break out of the inner loop
                      break;
                    }
                  }
                }

                // Update the last message (assistant) with display content
                // During understanding phase, show actual questions
                // During generation phase, show "Generating unique flashcards..."
                let messageToShow = displayContent;

                // Check if we should switch to generation phase (when JSON starts appearing)
                if (
                  shouldCreateFlashcards &&
                  loadingPhase === "understanding" &&
                  (accumulatedContent.includes("```json") ||
                    accumulatedContent.includes("```") ||
                    accumulatedContent.toLowerCase().includes("here are") ||
                    accumulatedContent.toLowerCase().includes("flashcards:"))
                ) {
                  setLoadingPhase("generating");
                  // Immediately update message to show loading state
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: "Generating unique flashcards...",
                    };
                    return updated;
                  });
                }

                // During generation phase, show friendly message instead of JSON
                if (
                  shouldCreateFlashcards &&
                  (loadingPhase === "generating" || hasJsonBlock)
                ) {
                  messageToShow = "Generating unique flashcards...";
                } else if (
                  shouldCreateFlashcards &&
                  loadingPhase === "understanding"
                ) {
                  // During understanding, show the actual questions
                  messageToShow = displayContent;
                }

                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: messageToShow,
                  };
                  return updated;
                });
              }

              if (data.done) {
                // Try to parse flashcards from full response (if not already extracted)
                if (shouldCreateFlashcards && !flashcardsExtracted) {
                  const parsedFlashcards =
                    parseFlashcardsFromResponse(fullResponse);
                  if (parsedFlashcards && parsedFlashcards.length > 0) {
                    // Replace existing flashcards with new ones
                    setFlashcards(parsedFlashcards);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setConversationPhase("ready");
                    rhsFlashcardLoadingRef.current = false;

                    // Replace the last message with a success message
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `Perfect! I've created ${parsedFlashcards.length} unique flashcards for you. You can now review them on the right side. Use the arrow keys or buttons to navigate, and press Space to flip each card!`,
                      };
                      return updated;
                    });

                    toast.success(
                      `Generated ${parsedFlashcards.length} flashcards!`
                    );
                  } else {
                    // If no flashcards found, check if AI is still in understanding phase
                    if (
                      fullResponse.toLowerCase().includes("?") ||
                      fullResponse.toLowerCase().includes("would you") ||
                      fullResponse.toLowerCase().includes("which")
                    ) {
                      rhsFlashcardLoadingRef.current = false;
                      setConversationPhase("understanding");
                      setLoadingPhase(null); // Clear loading phase for understanding
                      // Show the actual response (understanding questions)
                      setMessages((prev) => {
                        const updated = [...prev];
                        // Remove JSON if present, show only the text before it
                        let cleanResponse = fullResponse;
                        const jsonMatch =
                          cleanResponse.match(/```json[\s\S]*?```/);
                        if (jsonMatch) {
                          cleanResponse = cleanResponse
                            .substring(0, cleanResponse.indexOf(jsonMatch[0]))
                            .trim();
                        }
                        updated[updated.length - 1] = {
                          role: "assistant",
                          content: cleanResponse || displayContent,
                        };
                        return updated;
                      });
                    } else {
                      rhsFlashcardLoadingRef.current = false;
                      toast.warning(
                        "Could not parse flashcards from response. Please try again."
                      );
                      // Show the response without JSON
                      let cleanResponse = fullResponse;
                      const jsonMatch =
                        cleanResponse.match(/```json[\s\S]*?```/);
                      if (jsonMatch) {
                        cleanResponse = cleanResponse
                          .substring(0, cleanResponse.indexOf(jsonMatch[0]))
                          .trim();
                      }
                      setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                          role: "assistant",
                          content:
                            cleanResponse ||
                            "I encountered an issue generating the flashcards. Please try again.",
                        };
                        return updated;
                      });
                    }
                  }
                } else {
                  // Not creating flashcards, show full response (questions/answers)
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: fullResponse,
                    };
                    return updated;
                  });
                }
                break;
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        // User stopped generation
        return;
      }
      console.error("[Flashcards] Error:", error);
      toast.error("Failed to generate response. Please try again.");

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I apologize, but I encountered an error. Please try again or check if Ollama is running.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingPhase(null);
      rhsFlashcardLoadingRef.current = false;
      abortControllerRef.current = null;
      streamReaderRef.current = null;
    }
  };

  const handleSend = () => {
    if (!input.trim() && !pendingImage) return;
    if (isLoading) {
      handleStop();
      return;
    }

    const userMessage =
      input.trim() || (pendingImage ? "Create flashcards from this image" : "");
    const intent = detectIntent(userMessage);
    const isNewFlashcardRequest = Boolean(
      intent === "new_flashcards" || (!input.trim() && pendingImage)
    );

    handleSendMessage(userMessage, isNewFlashcardRequest);

    // Reset textarea height after send
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (file.type.startsWith("image/")) {
      toast.info("Processing image...");

      // Create preview URL and switch to vision model (required for images)
      const url = URL.createObjectURL(file);
      setSelectedModel(VISION_MODEL_ID);
      setPendingImage({ url, caption: "Processing...", file });

      // Process image with Pix2Text (math) or BLIP (diagrams) for caption fallback/display
      try {
        const result = await imageCaption.processImageFile(file);
        if (result) {
          setPendingImage({ url, caption: result.caption, file });
          toast.success("Image attached. Llama 3.2 Vision will process it.");
        }
      } catch (error) {
        console.error("[Flashcards] Image processing failed:", error);
        setPendingImage({ url, caption: "Image attached", file });
        toast.warning("Could not analyze image, but it's attached.");
      }
    } else {
      toast.error("Please upload an image file (PNG, JPG, etc.)");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearPendingImage = () => {
    if (pendingImage?.url) {
      URL.revokeObjectURL(pendingImage.url);
    }
    setPendingImage(null);
  };

  const handleModelChange = (newModel: string) => {
    if (pendingImage) return;
    setSelectedModel(newModel);
  };

  // Check Ollama status and model availability on mount
  useEffect(() => {
    const checkOllamaStatus = async () => {
      try {
        const response = await fetch("/api/tutor/chat");
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
                // Check if model is available - try exact match first, then partial match
                const modelIdParts = model.id.split(":");
                const modelBase = modelIdParts[0];
                const modelTag = modelIdParts[1] || "";
                // Handle namespaced models (e.g., "mightykatun/qwen2.5-math:7b")
                const modelNameOnly = modelBase.includes("/")
                  ? modelBase.split("/")[1]
                  : modelBase;

                availability[model.id] = availableModelNames.some(
                  (name: string) => {
                    // Exact match
                    if (name === model.id) return true;
                    // Match full model ID (including namespace)
                    if (name.includes(model.id)) return true;
                    // Match base name and tag
                    if (
                      name.includes(modelBase) &&
                      (modelTag ? name.includes(modelTag) : true)
                    )
                      return true;
                    // Match model name without namespace
                    if (
                      name.includes(modelNameOnly) &&
                      (modelTag ? name.includes(modelTag) : true)
                    )
                      return true;
                    // Match just base name (for cases like "llama3.1:8b" matching "llama3.1")
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
              "[Flashcards] Failed to check model availability:",
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
    // Check status every 30 seconds
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedModelData =
    aiModels.find((m) => m.id === selectedModel) || aiModels[0];

  const handleCopy = (text: string, messageIndex: number) => {
    // Don't copy if already copied recently
    if (copiedMessageIndex === messageIndex) {
      return;
    }

    navigator.clipboard.writeText(text);
    setCopiedMessageIndex(messageIndex);

    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedMessageIndex(null);
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

  const handleTTS = (text: string, index: number) => {
    tts.speak(stripForTTS(text), `flashcard-${index}`);
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
          <div className="relative flex-1 min-h-0">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white to-transparent transition-opacity duration-300 z-10 dark:from-card"
              style={{ opacity: showTopFade ? 1 : 0 }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent transition-opacity duration-300 z-10 dark:from-card"
              style={{ opacity: showBottomFade ? 1 : 0 }}
            />
            <div
              className="absolute inset-0 overflow-y-auto space-y-4 pb-56 px-6 pt-6"
              ref={messagesContainerRef}
            >
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start",
                    message.role === "assistant" ? "mb-6" : "mb-3",
                    message.role === "user" ? "group relative" : ""
                  )}
                >
                  {message.role === "user" && message.replyingTo && (
                    <div className="mb-1.5 max-w-[80%] flex items-start gap-2">
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {message.replyingTo.text}
                      </p>
                    </div>
                  )}
                  <div
                    data-message-role={message.role}
                    data-message-index={idx}
                    className={`max-w-[80%] min-w-0 rounded-lg p-4 relative ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {/* Copy button for user messages - outside bubble, top-left, hover only */}
                    {message.role === "user" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -left-10 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-transparent"
                        onClick={() => handleCopy(message.content, idx)}
                        disabled={copiedMessageIndex === idx}
                        style={{
                          cursor:
                            copiedMessageIndex === idx ? "default" : "pointer",
                        }}
                        title={
                          copiedMessageIndex === idx
                            ? "Copied!"
                            : "Copy to clipboard"
                        }
                      >
                        {copiedMessageIndex === idx ? (
                          <Check className="h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-foreground" />
                        )}
                      </Button>
                    )}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0 space-y-2">
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">
                              AI Flashcard Creator
                            </span>
                          </div>
                        )}
                        <div
                          className="text-sm select-text break-words overflow-wrap-anywhere"
                          data-selectable-content="true"
                        >
                          {message.role === "assistant" &&
                          idx === messages.length - 1 &&
                          isLoading &&
                          (!message.content ||
                            loadingPhase === "generating" ||
                            message.content ===
                              "Generating unique flashcards...") ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="font-medium">
                                Generating unique flashcards...
                              </span>
                            </div>
                          ) : message.content ? (
                            <MarkdownRenderer
                              content={message.content}
                              className={
                                message.role === "user"
                                  ? "text-primary-foreground"
                                  : ""
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {message.role === "assistant" &&
                          message.content &&
                          !(isLoading && idx === messages.length - 1) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleTTS(message.content, idx)}
                                style={{ cursor: "pointer" }}
                                title={
                                  tts.speakingId === `flashcard-${idx}`
                                    ? "Stop reading"
                                    : "Read answer aloud"
                                }
                              >
                                {tts.speakingId === `flashcard-${idx}` ? (
                                  <VolumeX className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopy(message.content, idx)}
                                disabled={copiedMessageIndex === idx}
                                style={{
                                  cursor:
                                    copiedMessageIndex === idx
                                      ? "default"
                                      : "pointer",
                                }}
                                title={
                                  copiedMessageIndex === idx
                                    ? "Copied!"
                                    : "Copy to clipboard"
                                }
                              >
                                {copiedMessageIndex === idx ? (
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
                </div>
              ))}
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
            {/* Floating "Ask AI" button when text is selected from assistant messages only */}
            {selectedText && selectedText.messageRole === "assistant" && (
              <div
                className="fixed z-50"
                style={{
                  top: `${selectedText.position.top}px`,
                  left: `${selectedText.position.left}px`,
                  transform: "translateX(-50%)",
                }}
              >
                <Button
                  size="sm"
                  className="gap-2 shadow-lg"
                  onMouseDown={(e) => {
                    // Prevent default to keep selection visible
                    e.preventDefault();
                  }}
                  onClick={() => {
                    // Store text before clearing
                    const textToReply = selectedText.text;
                    const messageIndexToReply = selectedText.messageIndex;

                    setReplyingTo({
                      text: textToReply,
                    });

                    // Clear selection after a brief delay to show the action
                    setTimeout(() => {
                      setSelectedText(null);
                      if (window.getSelection) {
                        window.getSelection()?.removeAllRanges();
                      }
                    }, 100);

                    // Focus input field
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 150);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Ask AI
                </Button>
              </div>
            )}
          </div>

          {/* Input section */}
          <div className="border-t bg-background px-6 py-4">
            {replyingTo && (
              <div className="mb-3 mx-4">
                <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
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
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            {/* Pending Image Preview */}
            {pendingImage && (
              <div className="mb-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start gap-3">
                    <div className="relative w-24 h-24">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingImage.url}
                        alt="Uploaded"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {imageCaption.isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Paperclip className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Attached Image
                        </span>
                      </div>
                      {pendingImage.caption ? (
                        <p className="text-sm text-foreground/80 italic">
                          &ldquo;{pendingImage.caption}&rdquo;
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Analyzing image...
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={clearPendingImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Hidden file input for image upload */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                    // Reset textarea height after send
                    if (inputRef.current) {
                      inputRef.current.style.height = "auto";
                    }
                  }
                }}
                placeholder={
                  pendingImage
                    ? "Add a message (optional) or send the image..."
                    : "Ask for flashcards on any topic..."
                }
                className="flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[20px] max-h-[150px] overflow-y-auto"
                rows={1}
              />
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-transparent"
                      style={{
                        cursor: pendingImage ? "not-allowed" : "pointer",
                      }}
                      title={
                        pendingImage
                          ? "Vision model required for images. Remove image to change"
                          : `${selectedModelData.name} - ${selectedModelData.description}`
                      }
                      disabled={!!pendingImage}
                    >
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {pendingImage && (
                      <>
                        <DropdownMenuLabel className="text-muted-foreground font-normal">
                          Image attached, using Llama 3.2 Vision. Remove image
                          to change model.
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}
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
                      const isAvailable = modelAvailability[model.id] ?? false;
                      const isDisabled =
                        !!pendingImage && model.id !== VISION_MODEL_ID;
                      return (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => handleModelChange(model.id)}
                          className={
                            selectedModel === model.id ? "bg-accent" : ""
                          }
                          style={{
                            cursor: isDisabled ? "not-allowed" : "pointer",
                          }}
                          disabled={isDisabled}
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
                              <span className="font-medium">{model.name}</span>
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
                  className="h-8 w-8 rounded-full bg-transparent"
                  onClick={handleFileAttach}
                  style={{ cursor: "pointer" }}
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${
                    whisper.isRecording ? "bg-red-100" : "bg-transparent"
                  }`}
                  onClick={handleVoiceRecord}
                  disabled={whisper.isTranscribing}
                  style={{ cursor: "pointer" }}
                >
                  {whisper.isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : whisper.isRecording ? (
                    <Square className="h-4 w-4 text-red-500 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                {isLoading ? (
                  <Button
                    size="icon"
                    onClick={handleStop}
                    className="h-8 w-8 rounded-full bg-purple-600 text-white hover:bg-purple-700 flex-shrink-0"
                    style={{ cursor: "pointer" }}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() && !pendingImage}
                    className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                    style={{ cursor: "pointer" }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
                    {`${flashcards.length} ${
                      flashcards.length === 1 ? "card" : "cards"
                    }`}
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
            {flashcards.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Brain className="h-16 w-16 text-muted-foreground/50" />
                <div>
                  <p className="text-lg font-medium mb-2">No flashcards yet</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask me to create flashcards on any topic! I&apos;ll first
                    understand what you want to study, then generate 10 unique
                    flashcards for you.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                  <p className="text-sm text-muted-foreground">
                    Press &quot;Space&quot; to flip, &quot;←/→&quot; to navigate
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border shadow-lg hover:bg-accent disabled:opacity-30 z-20"
                  style={{
                    cursor: currentIndex === 0 ? "default" : "pointer",
                  }}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                {currentCard && (
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
                        transform: isFlipped
                          ? "rotateY(180deg)"
                          : "rotateY(0deg)",
                      }}
                    >
                      <Card
                        className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 shadow-2xl border-2 bg-card dark:bg-zinc-900 dark:border-zinc-700"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <Badge variant="secondary" className="mb-6 font-medium dark:bg-zinc-800 dark:text-zinc-200">
                          {currentCard.subject}
                        </Badge>
                        <h2 className="text-2xl font-medium text-center leading-relaxed mb-12 dark:text-zinc-100">
                          <MarkdownRenderer content={currentCard.question} />
                        </h2>
                        <div className="flex gap-3 mt-auto">
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlip();
                            }}
                            className="dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            style={{ cursor: "pointer" }}
                          >
                            See answer
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTTS(currentCard.question, currentIndex);
                            }}
                            title={tts.speakingId === `flashcard-${currentIndex}` ? "Stop" : "Read question aloud"}
                            className="dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                            style={{ cursor: "pointer" }}
                          >
                            {tts.speakingId === `flashcard-${currentIndex}` ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </Card>

                      <Card
                        className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 shadow-2xl border-2 bg-primary/5 dark:bg-indigo-950/60 dark:border-indigo-800/50"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <div className="text-lg text-center leading-relaxed mb-8 dark:text-zinc-100">
                          <MarkdownRenderer content={currentCard.answer} />
                        </div>
                        <div className="flex gap-3 mt-auto">
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExplain();
                            }}
                            className="gap-2 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                            style={{ cursor: "pointer" }}
                          >
                            <Sparkles className="h-4 w-4" />
                            Explain
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTTS(`${currentCard.question}. ${currentCard.answer}`, currentIndex);
                            }}
                            title={tts.speakingId === `flashcard-${currentIndex}` ? "Stop" : "Read card aloud"}
                            className="dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-indigo-900/40"
                            style={{ cursor: "pointer" }}
                          >
                            {tts.speakingId === `flashcard-${currentIndex}` ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentIndex === flashcards.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border shadow-lg hover:bg-accent disabled:opacity-30 z-20"
                  style={{
                    cursor:
                      currentIndex === flashcards.length - 1
                        ? "default"
                        : "pointer",
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {flashcards.length > 0 && (
            <div className="border-t bg-background px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {currentIndex + 1} / {flashcards.length} cards
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
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
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                  >
                    1
                  </Badge>
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
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                  >
                    2
                  </Badge>
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
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                  >
                    1
                  </Badge>
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
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                  >
                    2
                  </Badge>
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

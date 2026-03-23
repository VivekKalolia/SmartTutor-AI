"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/lib/store";
import {
  addMessage,
  updateMessage,
  setLoading,
} from "@/lib/features/tutor/tutorSlice";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
  Check,
  Sparkles,
  Paperclip,
  Cpu,
  Mic,
  Volume2,
  VolumeX,
  Square,
  HelpCircle,
  X,
  MessageSquare,
  CornerDownLeft,
  Loader2,
  Image as ImageIcon,
  Bot,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useWhisper } from "@/lib/hooks/useWhisper";
import { useTTS } from "@/lib/hooks/useTTS";
import {
  parseReasoningWire,
  stripReasoningWire,
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
    id: "wizard-math",
    name: "WizardMath",
    description: "Math-focused reasoning",
    type: "ollama",
  },
  // GLM-4.1V disabled for now - using Pix2Text/BLIP + text models instead
  // {
  //   id: "glm-4.1v-9b",
  //   name: "GLM-4.1V 9B",
  //   description: "Multimodal (images)",
  //   type: "python",
  //   isMultimodal: true,
  // },
];

const VISION_MODEL_ID = "llama3.2-vision:11b";

/** WCAG / WAI-ARIA: answer-source tabs + linked panel */
const TUTOR_ANSWER_SOURCE_PANEL_ID = "tutor-answer-source-panel";
const TUTOR_TAB_GENERAL_ID = "tutor-tab-answer-general";
const TUTOR_TAB_COURSE_ID = "tutor-tab-answer-course";

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

// Helper for mock response when Ollama is unavailable

export default function TutorPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, isLoading } = useSelector(
    (state: RootState) => state.tutor
  );
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama3.1:8b");
  // previousModel state removed - GLM disabled, no auto-switching needed
  const [ollamaStatus, setOllamaStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [modelAvailability, setModelAvailability] = useState<
    Record<string, boolean>
  >({});

  const handleModelChange = (newModel: string) => {
    if (pendingImage) return;
    setSelectedModel(newModel);
  };
  const tts = useTTS();
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [showRAGInfo, setShowRAGInfo] = useState(false);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    messageId: string;
    messageRole: "user" | "assistant";
    position: { top: number; left: number };
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    text: string;
    messageId: string;
  } | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    caption: string;
    file: File;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  type TutorMode = "general" | "course_materials";
  const [tutorMode, setTutorMode] = useState<TutorMode>("general");
  const [includeFigures, setIncludeFigures] = useState(true);

  const handleAnswerSourceTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, tab: TutorMode) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          if (tab === "general") {
            setTutorMode("course_materials");
            queueMicrotask(() =>
              document.getElementById(TUTOR_TAB_COURSE_ID)?.focus()
            );
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          if (tab === "course_materials") {
            setTutorMode("general");
            queueMicrotask(() =>
              document.getElementById(TUTOR_TAB_GENERAL_ID)?.focus()
            );
          }
          break;
        case "Home":
          e.preventDefault();
          setTutorMode("general");
          queueMicrotask(() =>
            document.getElementById(TUTOR_TAB_GENERAL_ID)?.focus()
          );
          break;
        case "End":
          e.preventDefault();
          setTutorMode("course_materials");
          queueMicrotask(() =>
            document.getElementById(TUTOR_TAB_COURSE_ID)?.focus()
          );
          break;
        default:
          break;
      }
    },
    []
  );

  const handleFiguresToggleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, which: "on" | "off") => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (which === "on") {
          setIncludeFigures(false);
          queueMicrotask(() =>
            document.getElementById("tutor-figures-off")?.focus()
          );
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (which === "off") {
          setIncludeFigures(true);
          queueMicrotask(() =>
            document.getElementById("tutor-figures-on")?.focus()
          );
        }
      }
    },
    []
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isFromSuggestion, setIsFromSuggestion] = useState(false);
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPositionRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamReaderRef =
    useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Handle textarea resize with useCallback to prevent re-renders
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      // Save cursor position before state update
      cursorPositionRef.current = textarea.selectionStart;

      setInput(textarea.value);
      // User is actively typing, so this is no longer a pure suggestion-origin question
      setIsFromSuggestion(false);

      // Auto-resize textarea
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;

      // Restore cursor position after state update
      requestAnimationFrame(() => {
        if (cursorPositionRef.current !== null && inputRef.current) {
          inputRef.current.setSelectionRange(
            cursorPositionRef.current,
            cursorPositionRef.current
          );
          cursorPositionRef.current = null;
        }
      });
    },
    []
  );

  const handleTranscript = useCallback((text: string) => {
    setInput((prev) => {
      const newValue = prev + (prev ? " " : "") + text;
      // Auto-resize textarea after transcription
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
          // Focus and set cursor to end
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newValue.length, newValue.length);
        }
      });

      return newValue;
    });
    toast.success("Transcription complete!");
  }, []);

  // Track if textarea should maintain focus
  const shouldMaintainFocusRef = useRef(false);
  // Ensure suggestions are only fetched once (survives React Strict Mode double-invoke)
  const suggestionsLoadedRef = useRef(false);

  // Auto-resize textarea when input changes from external sources (Whisper, etc.)
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const whisper = useWhisper({
    onTranscript: handleTranscript,
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleRefreshSuggestions = useCallback(async () => {
    if (isRefreshingSuggestions) return;
    setIsRefreshingSuggestions(true);
    try {
      const res = await fetch("/api/tutor/suggestions");
      if (!res.ok) return;
      const data = await res.json();
      const suggestions: string[] = data.suggestions || [];
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        setSuggestedQuestions(suggestions.slice(0, 3));
        setIsFromSuggestion(false);
      }
    } catch (e) {
      console.error("[AI Tutor] Failed to refresh document suggestions:", e);
    } finally {
      setIsRefreshingSuggestions(false);
    }
  }, [isRefreshingSuggestions]);

  // Build content-aware suggested questions based on uploaded documents
  useEffect(() => {
    if (suggestionsLoadedRef.current) return;
    suggestionsLoadedRef.current = true;

    const loadSuggestions = async () => {
      try {
        const res = await fetch("/api/tutor/suggestions");
        if (!res.ok) return;
        const data = await res.json();
        const suggestions: string[] = data.suggestions || [];
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          setSuggestedQuestions(suggestions.slice(0, 3));
        }
      } catch (e) {
        console.error("[AI Tutor] Failed to load document suggestions:", e);
      }
    };

    loadSuggestions();
  }, []);

  const updateScrollFades = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopFade(scrollTop > 8);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8);
  };

  // Track previous message count to detect new messages vs updates
  const prevMessageCountRef = useRef(0);

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

  // When a new assistant message finishes (streaming complete), prefetch TTS audio
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant" && last.content && last.content.trim()) {
        const ttsContent = stripReasoningWire(last.content);
        if (ttsContent) tts.prefetch(ttsContent);
      }
    }
  }, [isLoading, messages, tts]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => updateScrollFades();
    container.addEventListener("scroll", handleScroll);
    updateScrollFades();
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle text selection for both user and assistant messages
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

      // Get message ID from the element
      const messageId = messageElement.getAttribute("data-message-id");
      if (!messageId) {
        setSelectedText(null);
        return;
      }

      // Get position for floating button (using viewport coordinates for fixed positioning)
      const rect = range.getBoundingClientRect();

      setSelectedText({
        text: selectedTextContent,
        messageId,
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
        target.closest(".rounded-2xl") || // Input container
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

  const handleTTS = (text: string, messageId: string) => {
    tts.speak(text, messageId);
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
            console.error("[Tutor] Failed to check model availability:", error);
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

  const handleStop = () => {
    // Abort the fetch request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cancel the stream reader if it exists
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel();
      streamReaderRef.current = null;
    }

    dispatch(setLoading(false));
    toast.info("Generation stopped");
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || isLoading) return;

    // Store everything BEFORE clearing states
    const imageUrlToShow = pendingImage?.url || null;
    const imageFileToSend = pendingImage?.file ?? null;
    const replyingToContext = replyingTo ? { ...replyingTo } : null;
    const originalInput = input.trim();

    // Build the message: when sending image we send it to vision model (no caption); otherwise text only
    let userMessage =
      originalInput ||
      (pendingImage ? "What can you tell me about this image?" : "");
    let displayMessage =
      originalInput ||
      (pendingImage ? "What can you tell me about this image?" : "");

    // Add replyingTo context to the message for the AI
    if (replyingToContext) {
      userMessage = `[Regarding this text: "${replyingToContext.text}"]\n\nUser's question: ${userMessage}`;
    }

    dispatch(
      addMessage({
        id: Date.now().toString(),
        role: "user",
        content: displayMessage,
        timestamp: new Date(),
        ...(replyingTo && { replyingTo }),
        ...(imageUrlToShow && { imageUrl: imageUrlToShow }),
      })
    );
    setInput("");
    setReplyingTo(null);
    setPendingImage(null); // Clear pending image after storing the file/URL
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    dispatch(setLoading(true));

    // Create AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Get model info
      const currentModelInfo = aiModels.find((m) => m.id === selectedModel);

      let imagePayload: { base64: string; mime: string } | null = null;
      if (imageFileToSend) {
        imagePayload = await readFileAsBase64(imageFileToSend);
      }      if (imagePayload) {      }

      let data: { response?: string; error?: string; fallback?: boolean };

      {
        // Use Ollama API for other models
        // Build conversation history from messages (limit to last 20 for context window)
        const conversationHistory = messages
          .slice(-20) // Only take the last 20 messages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        const response = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
            conversationHistory,
            useTextbook: tutorMode === "course_materials",
            includeImages: includeFigures,
            fromSuggestion: isFromSuggestion,
            ...(imagePayload && {
              imageBase64: imagePayload.base64,
              imageMime: imagePayload.mime,
            }),
          }),
          signal: abortController.signal,
        });

        // All models now use streaming for token-by-token output
        // Create a placeholder message for streaming
        const streamMessageId = (Date.now() + 1).toString();
        dispatch(
          addMessage({
            id: streamMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            model: selectedModel,
          })
        );

        // Read the stream
        const reader = response.body?.getReader();
        streamReaderRef.current = reader || null;
        const decoder = new TextDecoder();
        let fullContent = "";
        let sseBuffer = "";

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });

              // SSE events are separated by a blank line.
              // Important: a single JSON payload can be split across chunks,
              // so we buffer until we see "\n\n".
              const events = sseBuffer.split("\n\n");
              sseBuffer = events.pop() ?? "";

              for (const evt of events) {
                // Collect all data: lines (SSE allows multi-line data)
                const dataLines = evt
                  .split("\n")
                  .filter((l) => l.startsWith("data: "))
                  .map((l) => l.slice(6));
                if (dataLines.length === 0) continue;

                const dataStr = dataLines.join("\n");
                try {
                  const jsonData = JSON.parse(dataStr);

                  if (jsonData.token) {
                    fullContent += jsonData.token;
                    dispatch(
                      updateMessage({
                        id: streamMessageId,
                        content: fullContent,
                      })
                    );
                  }

                  // Note: sources can be an empty array, so check for undefined, not truthiness.
                  if (jsonData.sources !== undefined) {
                    dispatch(
                      updateMessage({
                        id: streamMessageId,
                        content: fullContent,
                        sources: jsonData.sources,
                        pageImages: jsonData.pageImages,
                        imageDescription: jsonData.imageDescription,
                      })
                    );
                  }
                } catch {
                  // If we fail to parse, ignore this event (should be rare now that we buffer by \n\n).
                }
              }
            }
          } catch (streamError) {
            // Check if it was aborted
            if (
              streamError instanceof Error &&
              streamError.name === "AbortError"
            ) {              // Update message to indicate it was stopped
              if (fullContent.trim()) {
                dispatch(
                  updateMessage({
                    id: streamMessageId,
                    content: fullContent + "\n\n[Generation stopped]",
                  })
                );
              } else {
                // Update empty message to indicate generation was stopped
                dispatch(
                  updateMessage({
                    id: streamMessageId,
                    content: "[Generation stopped]",
                  })
                );
              }
            } else {
              console.error("[AI Tutor] Stream reading error:", streamError);
            }
          } finally {
            streamReaderRef.current = null;
          }
        }        dispatch(setLoading(false));
        abortControllerRef.current = null;
        return; // Exit early, message already added
      }

      if (data.response) {
        // Sanitize response before displaying
        let cleanedResponse = String(data.response || "").trim();

        // Additional client-side validation
        if (cleanedResponse.length < 10) {
          cleanedResponse =
            "I apologize, but I'm having trouble generating a response. Could you please rephrase your question?";
        }
        dispatch(
          addMessage({
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: cleanedResponse,
            timestamp: new Date(),
            model: selectedModel, // Store which model was used
          })
        );
      } else {
        // Fallback to mock response if API fails
        if (data.fallback) {
          toast.error("Ollama is not running. Using demo mode.");
        } else if (data.error) {
          toast.error(`Model error: ${data.error}`);
        }        const mockResponse = getMockResponse(userMessage);
        dispatch(
          addMessage({
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: mockResponse,
            timestamp: new Date(),
            model: selectedModel, // Store which model was used
          })
        );
      }
    } catch (error) {
      // Check if it was aborted
      if (error instanceof Error && error.name === "AbortError") {        return; // Don't show error toast or fallback for user-initiated abort
      }

      console.error(`[AI Tutor] Error calling ${selectedModel}:`, error);
      toast.error(
        `Failed to get response from ${selectedModel}. Using demo mode.`
      );

      // Fallback to mock response
      const mockResponse = getMockResponse(userMessage);
      dispatch(
        addMessage({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: mockResponse,
          timestamp: new Date(),
          model: selectedModel, // Store which model was used
        })
      );
    } finally {
      dispatch(setLoading(false));
      abortControllerRef.current = null;
      streamReaderRef.current = null;
    }
  };

  const handleCopy = (content: string, messageId: string) => {
    // Don't copy if already copied recently
    if (copiedMessageId === messageId) {
      return;
    }

    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);

    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);

    toast.success("Copied to clipboard!");
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setSelectedModel(VISION_MODEL_ID);
      setTutorMode("general");
      setPendingImage({ url, caption: "Image attached", file });
      toast.success(
        "Image attached. Llama 3.2 Vision will process it when you send."
      );
    } else {
      toast.error("Please upload an image file (PNG, JPG, etc.)");
    }

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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setSelectedModel(VISION_MODEL_ID);
        setTutorMode("general");
        setPendingImage({ url, caption: "Image attached", file });
        toast.success(
          "Image attached. Llama 3.2 Vision will process it when you send."
        );
      } else {
        toast.error("Please drop an image file.");
      }
    }
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

  const selectedModelData =
    aiModels.find((m) => m.id === selectedModel) || aiModels[1];

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 -mb-4">
        <Card
          className={`flex flex-1 flex-col overflow-hidden relative ${isDragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-primary">
                <ImageIcon className="h-12 w-12" />
                <p className="text-lg font-medium">Drop image here</p>
              </div>
            </div>
          )}
          <CardHeader className="flex-shrink-0 space-y-3">
            <div className="relative flex items-center justify-center">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Tutor
              </CardTitle>
              <Sheet open={showRAGInfo} onOpenChange={setShowRAGInfo}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 h-8 w-8"
                    style={{ cursor: "pointer" }}
                  >
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full sm:max-w-lg overflow-y-auto"
                >
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      How AI Tutor works
                    </SheetTitle>
                    <SheetDescription className="text-left">
                      A simple overview for students and examiners
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">
                        What the AI Tutor actually does
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The AI Tutor is not answering from the open internet. It
                        is built using retrieval augmented generation, often
                        written as RAG, where a retrieval component first
                        selects relevant chunks from your course materials and a
                        generative model then composes the final answer using
                        only those chunks as its context window.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">
                        How it works step by step
                      </h3>
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
                              Course materials are uploaded
                            </p>
                            <p>
                              Your lecturer uploads PDFs and other course
                              documents into the system. These are split into
                              smaller chunks, embedded into vectors using a
                              sentence level encoder, and stored in a vector
                              database that compares semantic similarity rather
                              than just exact keywords.
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
                              Your question is understood
                            </p>
                            <p>
                              When you ask a question, the system encodes it
                              into the same vector space as the document chunks
                              so it can measure cosine similarity between your
                              query and every stored chunk in the database.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Badge
                            variant="secondary"
                            className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                          >
                            3
                          </Badge>
                          <div>
                            <p className="font-medium text-foreground mb-1">
                              Relevant passages are retrieved
                            </p>
                            <p>
                              The system then performs a nearest neighbour
                              search and retrieves the highest scoring chunks
                              from your course notes and textbooks. These
                              excerpts, together with precise page numbers, are
                              the only sources the AI model is allowed to use
                              when it builds an answer for you.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Badge
                            variant="secondary"
                            className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                          >
                            4
                          </Badge>
                          <div>
                            <p className="font-medium text-foreground mb-1">
                              The answer is generated
                            </p>
                            <p>
                              The large language model reads the retrieved
                              chunks and then writes an answer in natural
                              language. It explains things, combines ideas from
                              the retrieved passages, and adds steps and
                              examples, but system prompts explicitly instruct
                              it to stay grounded in those documents and to
                              respond that it cannot find the answer if the
                              context does not contain it.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">
                        Why this matters for students and examiners
                      </h3>
                      <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                        <li>
                          <span className="font-medium text-foreground">
                            Grounded answers:
                          </span>{" "}
                          responses are built from the specific course materials
                          uploaded for this module, not from random websites
                        </li>
                        <li>
                          <span className="font-medium text-foreground">
                            Transparent citations:
                          </span>{" "}
                          the tutor shows which document and page the answer is
                          based on so you can check the original source
                        </li>
                        <li>
                          <span className="font-medium text-foreground">
                            Safer behaviour:
                          </span>{" "}
                          by restricting the model to retrieved context from the
                          course materials, the system reduces the chance of the
                          AI inventing facts that do not appear in the module
                          content
                        </li>
                        <li>
                          <span className="font-medium text-foreground">
                            Course aligned support:
                          </span>{" "}
                          explanations follow the notation, definitions and
                          structure used in this course, which helps students
                          revise in a way that matches how they will be assessed
                        </li>
                        <li>
                          <span className="font-medium text-foreground">
                            When it cannot answer:
                          </span>{" "}
                          if the relevant information is not found in the
                          retrieved passages, the tutor replies that it could
                          not find this in your course materials and suggests
                          checking your lecturer or the textbook instead
                        </li>
                      </ul>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex flex-col gap-3 items-center sm:flex-row sm:justify-between">
              <div
                className="inline-flex rounded-lg border border-input bg-muted/30 p-0.5 text-sm"
                role="tablist"
                aria-label="Answer source"
              >
                <button
                  id={TUTOR_TAB_GENERAL_ID}
                  type="button"
                  role="tab"
                  tabIndex={tutorMode === "general" ? 0 : -1}
                  aria-selected={tutorMode === "general"}
                  aria-controls={TUTOR_ANSWER_SOURCE_PANEL_ID}
                  onClick={() => setTutorMode("general")}
                  onKeyDown={(e) => handleAnswerSourceTabKeyDown(e, "general")}
                  className={`rounded-md px-4 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    tutorMode === "general"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  General
                </button>
                <button
                  id={TUTOR_TAB_COURSE_ID}
                  type="button"
                  role="tab"
                  tabIndex={tutorMode === "course_materials" ? 0 : -1}
                  aria-selected={tutorMode === "course_materials"}
                  aria-controls={TUTOR_ANSWER_SOURCE_PANEL_ID}
                  onClick={() => setTutorMode("course_materials")}
                  onKeyDown={(e) =>
                    handleAnswerSourceTabKeyDown(e, "course_materials")
                  }
                  className={`rounded-md px-4 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    tutorMode === "course_materials"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  Course materials
                </button>
              </div>
              {tutorMode === "course_materials" && (
                <div
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                  role="group"
                  aria-label="Include figures from course materials"
                >
                  <span>Figures</span>
                  <button
                    id="tutor-figures-on"
                    type="button"
                    aria-pressed={includeFigures}
                    aria-label="Figures from course materials: on"
                    onClick={() => setIncludeFigures(true)}
                    onKeyDown={(e) => handleFiguresToggleKeyDown(e, "on")}
                    className={`rounded-md px-2 py-1 font-medium transition-colors border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      includeFigures
                        ? "bg-background text-foreground border-input shadow-sm"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ cursor: "pointer" }}
                  >
                    On
                  </button>
                  <button
                    id="tutor-figures-off"
                    type="button"
                    aria-pressed={!includeFigures}
                    aria-label="Figures from course materials: off"
                    onClick={() => setIncludeFigures(false)}
                    onKeyDown={(e) => handleFiguresToggleKeyDown(e, "off")}
                    className={`rounded-md px-2 py-1 font-medium transition-colors border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      !includeFigures
                        ? "bg-background text-foreground border-input shadow-sm"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ cursor: "pointer" }}
                  >
                    Off
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent
            id={TUTOR_ANSWER_SOURCE_PANEL_ID}
            role="tabpanel"
            aria-labelledby={
              tutorMode === "general"
                ? TUTOR_TAB_GENERAL_ID
                : TUTOR_TAB_COURSE_ID
            }
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
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
                className="absolute inset-0 overflow-y-auto space-y-4 pb-56"
                ref={messagesContainerRef}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center space-y-6 pt-40">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        How can I help you today?
                      </h3>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        Ask me anything about your coursework, concepts, or
                        study strategies.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const parsed =
                      message.role === "assistant" &&
                      modelUsesReasoningUI(message.model)
                        ? parseReasoningWire(message.content)
                        : {
                            hasReasoning: false,
                            thinkingContent: "",
                            displayContent: message.content,
                            isThinking: false,
                          };

                    const { thinkingContent, displayContent, isThinking } =
                      parsed;
                    const showReasoningPanel =
                      message.role === "assistant" &&
                      modelUsesReasoningUI(message.model) &&
                      parsed.hasReasoning;

                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          message.role === "user" ? "items-end" : "items-start"
                        } ${message.role === "assistant" ? "mb-6" : "mb-3"} ${
                          message.role === "user" ? "group relative" : ""
                        }`}
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
                          data-message-id={message.id}
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
                              onClick={() =>
                                handleCopy(message.content, message.id)
                              }
                              disabled={copiedMessageId === message.id}
                              style={{
                                cursor:
                                  copiedMessageId === message.id
                                    ? "default"
                                    : "pointer",
                              }}
                              title={
                                copiedMessageId === message.id
                                  ? "Copied!"
                                  : "Copy to clipboard"
                              }
                            >
                              {copiedMessageId === message.id ? (
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
                                  <Bot className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-medium text-muted-foreground">
                                    AI Tutor
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 h-5 font-medium tabular-nums"
                                  >
                                    {message.model === "llama3.1:8b"
                                      ? "Llama 3.1"
                                      : message.model === "phi3:mini"
                                        ? "Phi-3"
                                        : message.model === "deepseek-r1:32b"
                                          ? "DeepSeek R1"
                                          : message.model === "qwen2.5:32b"
                                            ? "Qwen 2.5"
                                            : message.model ===
                                                "llama3.2-vision:11b"
                                              ? "Llama 3.2 Vision"
                                            : message.model === "wizard-math"
                                              ? "WizardMath"
                                              : message.model ===
                                                    "glm-4.1v-9b" // Legacy support
                                                  ? "GLM-4.1V"
                                                  : aiModels.find(
                                                      (m) =>
                                                        m.id === message.model
                                                    )?.name || "AI"}
                                  </Badge>
                                </div>
                              )}
                              {message.role === "assistant" &&
                                showReasoningPanel && (
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
                              {/* Show image if attached to user message */}
                              {message.role === "user" && message.imageUrl && (
                                <div className="mb-3">
                                  <img
                                    src={message.imageUrl}
                                    alt="Uploaded image"
                                    className="max-w-full max-h-48 rounded-md object-contain"
                                  />
                                </div>
                              )}
                              {/* Hide normal content while thinking (only show yellow box) */}
                              {(!isThinking || displayContent) && (
                                <div
                                  className="text-sm select-text break-words overflow-wrap-anywhere space-y-3"
                                  data-selectable-content="true"
                                >
                                  <MarkdownRenderer
                                    content={displayContent}
                                    sources={
                                      message.role === "assistant"
                                        ? message.sources
                                        : undefined
                                    }
                                    className={
                                      message.role === "user"
                                        ? "text-primary-foreground"
                                        : ""
                                    }
                                  />
                                  {message.role === "assistant" &&
                                    message.imageDescription && (
                                      <div className="mt-2">
                                        <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                          <summary className="cursor-pointer select-none font-medium">
                                            How the AI interpreted your image
                                          </summary>
                                          <div className="mt-1">
                                            <MarkdownRenderer
                                              content={message.imageDescription}
                                              className="text-xs text-muted-foreground"
                                            />
                                          </div>
                                        </details>
                                      </div>
                                    )}
                                  {message.role === "assistant" &&
                                    message.pageImages &&
                                    message.pageImages.length > 0 && (
                                      <div className="mt-3 space-y-2 border-t pt-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Relevant figure from your materials
                                        </p>
                                        {message.pageImages.map((img, i) => (
                                          <div
                                            key={i}
                                            className="rounded-lg border bg-muted/50 p-2"
                                          >
                                            <div className="text-xs text-muted-foreground mb-1">
                                              <MarkdownRenderer
                                                content={`**[${img.index}] ${img.documentName}, p.${img.pageNumber}**`}
                                                className="text-xs text-muted-foreground"
                                              />
                                              <details className="mt-1">
                                                <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                                                  Show figure description
                                                </summary>
                                                <div className="mt-1">
                                                  <MarkdownRenderer
                                                    content={img.caption}
                                                    className="text-xs text-muted-foreground"
                                                  />
                                                </div>
                                              </details>
                                            </div>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={`data:${img.mime ?? "image/png"};base64,${img.imageBase64}`}
                                              alt={`Figure from ${img.documentName}, page ${img.pageNumber}`}
                                              className="max-w-full max-h-64 object-contain rounded"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {message.role === "assistant" &&
                                displayContent &&
                                !(
                                  isLoading && index === messages.length - 1
                                ) && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        handleTTS(displayContent, message.id)
                                      }
                                      style={{ cursor: "pointer" }}
                                      title={
                                        tts.speakingId === message.id
                                          ? "Stop reading"
                                          : "Read answer aloud"
                                      }
                                    >
                                      {tts.speakingId === message.id ? (
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
                                        handleCopy(displayContent, message.id)
                                      }
                                      disabled={copiedMessageId === message.id}
                                      style={{
                                        cursor:
                                          copiedMessageId === message.id
                                            ? "default"
                                            : "pointer",
                                      }}
                                      title={
                                        copiedMessageId === message.id
                                          ? "Copied!"
                                          : "Copy to clipboard"
                                      }
                                    >
                                      {copiedMessageId === message.id ? (
                                        <Check className="h-4 w-4" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </>
                                )}
                            </div>
                          </div>
                          <p className="text-xs opacity-70 mt-2 select-none">
                            {message.timestamp
                              .toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                              .replace("am", "AM")
                              .replace("pm", "PM")}
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
                      const messageIdToReply = selectedText.messageId;

                      setReplyingTo({
                        text: textToReply,
                        messageId: messageIdToReply,
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

            <div className="flex-shrink-0 pt-4">
              {/* Reply Preview */}
              {/* Hidden file input for image upload */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* Pending Image Preview */}
              {pendingImage && (
                <div className="mb-3 mx-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-start gap-3">
                      <div className="relative w-24 h-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pendingImage.url}
                          alt="Uploaded"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ImageIcon className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Attached image. Llama 3.2 Vision will process when
                            you send
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Add a question or send to ask &ldquo;What can you tell
                          me about this image?&rdquo;
                        </p>
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

              {tutorMode === "course_materials" &&
                suggestedQuestions.length > 0 && (
                  <div className="mb-3 mx-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-input bg-muted/60 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground transition-colors disabled:opacity-60"
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        void handleRefreshSuggestions();
                      }}
                      aria-label="Refresh suggested questions"
                      disabled={isRefreshingSuggestions}
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${
                          isRefreshingSuggestions ? "animate-spin" : ""
                        }`}
                      />
                    </button>
                    {suggestedQuestions.map((q, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto rounded-full px-3 py-1.5 text-xs font-normal text-muted-foreground"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setIsFromSuggestion(true);
                          setInput(q);
                          setTimeout(() => {
                            if (inputRef.current) {
                              inputRef.current.focus();
                              inputRef.current.style.height = "auto";
                              inputRef.current.style.height = `${Math.min(
                                inputRef.current.scrollHeight,
                                150
                              )}px`;
                            }
                          }, 0);
                        }}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                )}
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
              <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  ref={inputRef}
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
                  onMouseDown={(e) => {
                    // CRITICAL: Prevent any default behavior and ensure immediate focus
                    e.preventDefault();
                    e.stopPropagation();
                    shouldMaintainFocusRef.current = true;

                    // Focus immediately
                    const textarea = e.currentTarget;
                    textarea.focus();

                    // Also use setTimeout as backup
                    setTimeout(() => {
                      if (
                        textarea === inputRef.current &&
                        document.activeElement !== textarea
                      ) {
                        textarea.focus();
                      }
                    }, 0);
                  }}
                  onFocus={(e) => {
                    // Mark that we should maintain focus
                    shouldMaintainFocusRef.current = true;
                    // Ensure cursor is visible
                    const textarea = e.currentTarget;
                    // Small delay to ensure cursor is rendered
                    setTimeout(() => {
                      if (textarea === document.activeElement) {
                        const len = textarea.value.length;
                        const currentPos = textarea.selectionStart;
                        // Only adjust if cursor is at start and there's text
                        if (currentPos === 0 && len > 0) {
                          textarea.setSelectionRange(len, len);
                        }
                      }
                    }, 10);
                  }}
                  onBlur={(e) => {
                    // Only clear flag if focus is moving to another element in the app
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    if (
                      !relatedTarget ||
                      !e.currentTarget.parentElement?.contains(relatedTarget)
                    ) {
                      shouldMaintainFocusRef.current = false;
                    }
                  }}
                  onClick={(e) => {
                    // Prevent event bubbling that might interfere
                    e.stopPropagation();
                  }}
                  placeholder="Ask a question about your coursework..."
                  className="flex-1 min-h-[24px] max-h-[150px] resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none outline-none overflow-y-auto placeholder:text-muted-foreground"
                  rows={1}
                  autoComplete="off"
                  spellCheck="true"
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
                            Image attached, using Llama 3.2 Vision. Remove
                            image to change model.
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
                        const isAvailable =
                          modelAvailability[model.id] ?? false;
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
                      <Square className="h-4 w-4 text-red-600 animate-pulse" />
                    ) : (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  {isLoading ? (
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full bg-purple-600 text-white hover:bg-purple-700 flex-shrink-0"
                      onClick={handleStop}
                      style={{ cursor: "pointer" }}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                      onClick={handleSend}
                      disabled={!input.trim() && !pendingImage}
                      style={{ cursor: "pointer" }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
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

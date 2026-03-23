import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import {
  AUTH_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";
import { getUserById } from "@/lib/rag/db";

const ollama = new Ollama({ host: "http://localhost:11434" });

/** When an image is sent, we must use a vision model. */
const VISION_MODEL = "llama3.2-vision:11b";

// Flashcard Creator System Prompt
function buildFlashcardSystemPrompt(studentContext?: {
  name?: string | null;
  grade?: string | null;
}): string {
  const studentContextBlock =
    studentContext && (studentContext.name || studentContext.grade)
      ? `STUDENT PROFILE:
- Name: ${studentContext.name ?? "Unknown"}
${studentContext.grade ? `- Grade: ${studentContext.grade}` : ""}\n`
      : "";

  return `You are an AI Flashcard Creator for educational content. You are always speaking with a student who wants to create study materials.

${studentContextBlock}If the student's grade is provided, you must strictly match the difficulty and examples to that level.

**Core Principle:** Create high-quality, focused flashcards that test understanding, not just memorization.

**Your Method:**

**Phase 1 - Understanding (Initial Interaction):**
1. Ask 1-2 concise questions to clarify:
   • The specific topic or subject area
   • Any particular focus areas or weak points
2. If a grade or level is already provided in the STUDENT PROFILE above, do NOT ask again about their level. Instead, silently use that grade to choose difficulty.
3. If no grade is provided in the STUDENT PROFILE, you may briefly ask what level they are studying at (e.g., O-Level, A-Level, University).
4. Keep questions brief and direct
5. Move to generation once you have enough information

**Phase 2 - Generation (After Clarification):**
Create exactly 10 flashcards in this JSON format:
\`\`\`json
{
  "flashcards": [
    {
      "question": "Clear, concise question testing understanding",
      "answer": "Comprehensive answer with examples when helpful",
      "subject": "Subject name"
    }
  ]
}
\`\`\`

**Key Rules:**
- **Be concise: Keep conversational responses brief (1-2 sentences)**
- Generate exactly 10 diverse flashcards covering different aspects of the topic
- Questions should test understanding and application, not just recall
- Answers should be clear and complete but not overly verbose
- Use LaTeX for mathematical expressions (e.g., "$F = ma$")
- Vary question types: definitions, applications, comparisons, examples
- Match difficulty to the student's grade/level (from STUDENT PROFILE when available, otherwise from what they tell you)

**Intent Detection:**
- "Create flashcards on...", "Make cards about...", "I want to study...", "Generate flashcards for..." → Enter Phase 1 (understanding)
- "What does this mean?", "Can you explain card #3?", "I don't understand this answer..." → Answer directly without generating new cards
- Follow-up questions about existing flashcards → Provide clear explanations only

**Formatting Requirements:**
- Use bullet points (•) for listing multiple concepts
- Use clear paragraph breaks for readability
- Keep mathematical notation clean with proper LaTeX
- Format code snippets properly if relevant to the subject

**Tone:**
- Be direct and professional
- Focus entirely on educational content
- No meta-commentary or casual asides
- **Never include unrelated examples, code, or content from other contexts**
- **Only respond with content relevant to flashcard creation or the student's questions**

**Output Format:**
- Phase 1: Brief conversational response ending with a clarifying question
- Phase 2: Brief confirmation + JSON block with exactly 10 flashcards

**Subjects:** Mathematics, Sciences, Languages, History, Computer Science, and other academic subjects

Your goal: Create effective study tools that promote deep learning and retention.`;
}

let lastModelUsed: string | null = null;

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      model = "llama3.1:8b",
      conversationHistory = [],
      phase = "understanding", // "understanding" or "generation"
      imageBase64,
      imageMime,
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const hasImage = Boolean(imageBase64 && typeof imageBase64 === "string");
    const effectiveModel = hasImage ? VISION_MODEL : model;

    // Resolve student context from session (name + grade)
    let studentContext: { name?: string | null; grade?: string | null } | undefined;
    try {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      const session = verifySession(token);
      if (session) {
        const user = getUserById(session.userId);
        if (user) {
          studentContext = {
            name: user.name ?? user.username,
            grade: user.grade,
          };
        }
      }
    } catch (e) {
      console.error("[Flashcard API] Failed to resolve student context:", e);
    }

    // Check if Ollama is running
    try {
      await ollama.list();
    } catch {
      return NextResponse.json(
        {
          error: "Ollama is not running",
          instructions: "Please start Ollama with: ollama serve",
          fallback: true,
        },
        { status: 503 }
      );
    }

    // Clean and validate conversation history
    const cleanedHistory = conversationHistory
      .filter((msg: { role: string; content: string }) => {
        const content = String(msg.content || "").trim();
        return (
          content.length > 0 &&
          content.length < 10000 &&
          (msg.role === "user" || msg.role === "assistant")
        );
      })
      .map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: String(msg.content || "").trim(),
      }));

    // Build the conversation with system prompt (including student context)
    const systemPrompt = buildFlashcardSystemPrompt(studentContext);
    const userContent = String(message || "").trim();
    const userMessage = hasImage
      ? {
          role: "user" as const,
          content: userContent,
          images: [imageBase64] as string[],
        }
      : { role: "user" as const, content: userContent };
    const messages = [
      { role: "system", content: systemPrompt },
      ...cleanedHistory,
      userMessage,
    ];

    lastModelUsed = effectiveModel;
    const streamResponse = await ollama.chat({
      model: effectiveModel,
      messages,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            const token = chunk.message?.content || "";
            if (token) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ token, done: false })}\n\n`
                )
              );
            }
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: "", done: true })}\n\n`
            )
          );
          controller.close();        } catch (error) {
          console.error("[Flashcard API] Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(
      `[Flashcard API] Error while using model "${lastModelUsed ?? "unknown"}":`,
      error
    );
    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: String(error),
        model: lastModelUsed,
        fallback: true,
      },
      { status: 500 }
    );
  }
}

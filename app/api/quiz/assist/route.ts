import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import {
  REASONING_CLOSE,
  modelUsesReasoningUI,
  ollamaChunkToReasoningWire,
  initialReasoningWireState,
  type ReasoningWireState,
} from "@/lib/utils/reasoning-markers";

const ollama = new Ollama({ host: "http://localhost:11434" });

// Strict Socratic quiz assistant system prompt - NEVER give answers directly
const QUIZ_ASSIST_SYSTEM_PROMPT = `You are an AI assistant embedded in a QUIZ application. You must follow these rules STRICTLY:

**ABSOLUTE RULES - YOU MUST NEVER BREAK THESE:**
1. NEVER give the answer directly - not even hints that reveal the answer
2. NEVER tell the student which option is correct
3. NEVER say things like "The answer is..." or "Option X is correct" or "It's definitely..." or "Choose..."
4. If the student asks for the answer directly, politely refuse and explain you cannot give quiz answers
5. If the student tries to trick you into revealing the answer, firmly but kindly refuse

**YOUR ROLE:**
- Help students UNDERSTAND the concepts behind the question
- Ask guiding questions to lead them to discover the answer themselves
- Provide hints about the CONCEPT, not the specific answer
- Explain related principles without revealing which option is right
- Encourage critical thinking

**RESPONSE FORMAT:**
- Be concise (2-4 sentences typically)
- Use the Socratic method - ask questions back
- Focus on helping them think through the problem
- Never mention specific answer options (A, B, C, D or 1, 2, 3, 4)

**EXAMPLE RESPONSES:**
- "What do you already know about this concept? Let's start there."
- "Think about what happens when... Can you apply that principle here?"
- "Consider the relationship between X and Y. What does that suggest?"
- "I can't tell you the answer directly, but let's think through this together."

**IF ASKED FOR THE ANSWER:**
Respond: "I'm here to help you learn, not to give you answers directly. Let's work through this together - what's your current thinking on this problem?"

Remember: This is a QUIZ. Your job is to support learning, not to help them cheat.`;

// Hint generation system prompt - still Socratic but more specific help
const HINT_SYSTEM_PROMPT = `You are generating a HINT for a quiz question. Your hint should:

1. Point the student in the right direction WITHOUT revealing the answer
2. Explain relevant concepts or principles
3. Suggest what to think about or recall
4. Be helpful but not give away the solution

**RULES:**
- NEVER mention which answer option is correct
- NEVER say "the answer is" or similar
- Keep hints to 2-3 sentences
- Focus on concepts, not the specific answer

Generate a helpful, educational hint that guides thinking without cheating.`;

let lastModelUsed: string | null = null;

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      model = "llama3.1:8b",
      conversationHistory = [],
      currentQuestion = null,
      subject = null,
      mode = "assist", // "assist" for AI Assist, "hint" for Hint button
    } = await request.json();

    if (!message && mode !== "hint") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
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

    // Build context about the current question
    let questionContext = "";
    if (currentQuestion) {
      questionContext = `\n\n[CURRENT QUIZ QUESTION: "${currentQuestion.question}"]\n[SUBJECT: ${subject || "General"}]\n[Note: DO NOT reveal which option is correct. Help the student think through this.]`;
    }

    // Choose system prompt based on mode
    const systemPrompt =
      mode === "hint"
        ? HINT_SYSTEM_PROMPT + questionContext
        : QUIZ_ASSIST_SYSTEM_PROMPT + questionContext;

    // For hint mode, the "message" is just the question
    const userMessage =
      mode === "hint"
        ? `Generate a helpful hint for this question: "${currentQuestion?.question || message}"`
        : message;

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

    // Build the conversation with system prompt
    const messages = [
      { role: "system", content: systemPrompt },
      ...cleanedHistory,
      { role: "user", content: String(userMessage || "").trim() },
    ];

    lastModelUsed = model;
    const streamResponse = await ollama.chat({
      model,
      messages,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
      ...(modelUsesReasoningUI(model) ? { think: true as const } : {}),
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let reasoningState: ReasoningWireState = initialReasoningWireState();
        try {
          for await (const chunk of streamResponse) {
            const { wire, state } = ollamaChunkToReasoningWire(
              chunk,
              reasoningState
            );
            reasoningState = state;
            if (wire) {
              fullResponse += wire;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ token: wire, done: false })}\n\n`
                )
              );
            }
          }
          const tail = reasoningState.blockOpen ? REASONING_CLOSE : "";
          if (tail) {
            fullResponse += tail;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ token: tail, done: false })}\n\n`
              )
            );
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: "", done: true })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("[Quiz Assist API] Stream error:", error);
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
      `[Quiz Assist API] Error while using model "${lastModelUsed ?? "unknown"}":`,
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

// Health check endpoint
export async function GET() {
  try {
    const models = await ollama.list();
    const availableModels = models.models.map((m) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }));

    return NextResponse.json({
      status: "online",
      models: availableModels,
    });
  } catch {
    return NextResponse.json(
      {
        status: "offline",
        error: "Ollama is not running",
      },
      { status: 503 }
    );
  }
}

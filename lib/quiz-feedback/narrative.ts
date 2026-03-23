import { Ollama } from "ollama";
import type {
  GeneralFeedbackStructured,
  QuestionAttemptInput,
  SessionFeedbackStructured,
} from "./types";
import { buildAttemptsSummaryForPrompt, buildDeterministicSessionNarrative } from "./session-feedback";
import { buildDeterministicGeneralNarrative } from "./general-feedback";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const FEEDBACK_MODEL = process.env.QUIZ_FEEDBACK_MODEL || "llama3.1:8b";
const FEEDBACK_TIMEOUT_MS = 25_000;

function getClient(): Ollama {
  return new Ollama({ host: OLLAMA_HOST });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout")), ms)
    ),
  ]);
}

export async function generateSessionFeedbackNarrative(
  structured: SessionFeedbackStructured,
  attempts: QuestionAttemptInput[]
): Promise<{ text: string; source: "ollama" | "deterministic" }> {
  const deterministic = buildDeterministicSessionNarrative(structured);
  const summary = buildAttemptsSummaryForPrompt(attempts);
  const payload = JSON.stringify(structured);

  try {
    const ollama = getClient();
    await withTimeout(ollama.list(), 5_000);
    const res = await withTimeout(
      ollama.chat({
        model: FEEDBACK_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a supportive study coach giving personalised quiz feedback. Follow the deterministic analysis JSON strictly - do not invent new weak topics. Write 2 short paragraphs plus up to 4 specific bullet next steps. Reference the actual questions the student got wrong by name/topic. Be encouraging and concrete. Subject: ${structured.subject}.`,
          },
          {
            role: "user",
            content: `Deterministic analysis (authoritative - follow this):\n${payload}\n\nQuestion-by-question log (includes full question text for incorrect answers):\n${summary}\n\nWrite personalised feedback referencing the specific questions the student got wrong. Suggest exactly what to review. Keep it under 250 words.`,
          },
        ],
      }),
      FEEDBACK_TIMEOUT_MS
    );
    const text = res.message?.content?.trim();
    if (text && text.length > 40) {
      return { text, source: "ollama" };
    }
  } catch {
    // fall through to deterministic
  }

  return { text: deterministic, source: "deterministic" };
}

export async function generateGeneralFeedbackNarrative(
  structured: GeneralFeedbackStructured
): Promise<{ text: string; source: "ollama" | "deterministic" }> {
  const deterministic = buildDeterministicGeneralNarrative(structured);
  const payload = JSON.stringify(structured);

  try {
    const ollama = getClient();
    await withTimeout(ollama.list(), 5_000);
    const res = await withTimeout(
      ollama.chat({
        model: FEEDBACK_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a supportive study coach. Follow the cumulative analysis JSON; do not invent new topics. Write 2 paragraphs and a short bullet list. Subject: " +
              structured.subject,
          },
          {
            role: "user",
            content: `Cumulative analysis (authoritative):\n${payload}\n\nExplain what to focus on this week and why.`,
          },
        ],
      }),
      FEEDBACK_TIMEOUT_MS
    );
    const text = res.message?.content?.trim();
    if (text && text.length > 40) {
      return { text, source: "ollama" };
    }
  } catch {
    // fall through to deterministic
  }

  return { text: deterministic, source: "deterministic" };
}

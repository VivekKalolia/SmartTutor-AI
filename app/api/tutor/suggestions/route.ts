import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { getDb, getDocuments, type DocumentRow, getUserById } from "@/lib/rag/db";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";

export const runtime = "nodejs";

const ollama = new Ollama({ host: "http://localhost:11434" });

function buildSuggestionsPrompt(excerpt: string, gradeLabel?: string): string {
  const levelText = gradeLabel
    ? `The student is approximately at ${gradeLabel} level.`
    : "The student is in secondary school.";

  return `You are helping a student come up with good questions to ask an AI tutor.

${levelText}

Below is an excerpt from their course materials (textbook, notes, or slides).
Based ONLY on this content, generate 3 short, natural questions the student might ask
to better understand the topic.

CONTENT EXCERPT:
---
${excerpt}
---

REQUIREMENTS:
- Each question should be understandable on its own, without mentioning "this text" or "the excerpt".
- Do NOT mention page numbers, file names, or titles.
- Keep each question brief (ideally 5–12 words).
- Focus on concrete core concepts, definitions, formulas, or relationships that are stated EXPLICITLY in the excerpt.
- Each question MUST be answerable directly and completely using ONLY the sentences in the excerpt, without needing outside or real-world knowledge.
- Avoid vague, reflective, or open-ended questions such as "Why is this important in real life?" or "How is this used in practice?".
- Do NOT answer the questions.

OUTPUT FORMAT (IMPORTANT):
- Respond with a single JSON array of strings.
- Example:
  ["What is a wave?", "What is amplitude?", "How is wavelength related to frequency?"]`;
}

export async function GET(request: NextRequest) {
  try {
    // Resolve student context (for level hint)
    let gradeLabel: string | undefined;
    try {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      const session = verifySession(token);
      if (session) {
        const user = getUserById(session.userId);
        if (user?.grade) {
          gradeLabel = user.grade;
        }
      }
    } catch {
      // Non-fatal; suggestions will just use generic level
    }

    // Ensure Ollama is up
    try {
      await ollama.list();
    } catch {
      return NextResponse.json({ suggestions: [] });
    }

    let docs: DocumentRow[] = getDocuments().filter(
      (d) => d.status === "ready" && d.total_chunks > 0
    );
    if (docs.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const db = getDb();
    // Shuffle documents so we don't always favor the same ones
    docs = [...docs];
    for (let i = docs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [docs[i], docs[j]] = [docs[j], docs[i]];
    }
    const allQuestions: string[] = [];

    for (const doc of docs) {
      try {
        const rows = db
          .prepare(
            // Random sample of chunks so we don't always use the very beginning
            "SELECT content FROM chunks WHERE document_id = ? ORDER BY RANDOM() LIMIT 5"
          )
          .all(doc.id) as { content: string }[];

        if (!rows || rows.length === 0) continue;

        const joined = rows
          .map((r) => r.content.trim())
          .filter((t) => t.length > 0)
          .join("\n\n");
        const excerpt =
          joined.length > 2000 ? joined.slice(0, 2000) : joined;

        const prompt = buildSuggestionsPrompt(excerpt, gradeLabel);

        const resp = await ollama.chat({
          model: "llama3.1:8b",
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 256,
          },
        });

        let text = resp.message?.content?.trim() ?? "";
        if (!text) continue;

        // Try to extract JSON array even if wrapped in markdown fences or extra text
        // e.g. ```json [ ... ] ``` or plain [ ... ]
        const jsonMatch =
          text.match(/```json([\s\S]*?)```/i) ||
          text.match(/```([\s\S]*?)```/) ||
          text.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          text = jsonMatch[1] ?? jsonMatch[0];
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          continue;
        }

        if (Array.isArray(parsed)) {
          for (const q of parsed) {
            if (typeof q === "string") {
              const cleaned = q.trim();
              if (cleaned.length >= 5 && cleaned.length <= 120) {
                allQuestions.push(cleaned);
              }
            }
          }
        }
      } catch (e) {
        console.error("[Tutor Suggestions] Error for document", doc.id, e);
      }
    }

    // Deduplicate
    const unique: string[] = [];
    for (const q of allQuestions) {
      if (!unique.some((u) => u.toLowerCase() === q.toLowerCase())) {
        unique.push(q);
      }
    }

    if (unique.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Shuffle and then take up to 3 for randomness across docs/subjects
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }

    return NextResponse.json({ suggestions: unique.slice(0, 3) });
  } catch (error) {
    console.error("[Tutor Suggestions] GET error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}


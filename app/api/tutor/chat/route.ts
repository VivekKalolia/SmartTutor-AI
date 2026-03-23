import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Ollama } from "ollama";
import {
  retrieveContext,
  retrieveRelevantImages,
  type RetrievalResult,
} from "@/lib/rag/retriever";
import {
  getDocument,
  getReadyDocumentCount,
  getUserById,
} from "@/lib/rag/db";
import { generateQueryEmbedding } from "@/lib/rag/embeddings";
import {
  AUTH_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";
import {
  REASONING_CLOSE,
  modelUsesReasoningUI,
  ollamaChunkToReasoningWire,
  initialReasoningWireState,
  type ReasoningWireState,
} from "@/lib/utils/reasoning-markers";

const ollama = new Ollama({ host: "http://localhost:11434" });

/** When an image is sent, we must use a vision model. */
const VISION_MODEL = "llama3.2-vision:11b";

const MAX_CHUNK_LEN_PHASE1 = 700;
const CONTEXT_WORDS = 100;
async function resolveCitationToActualPage(
  chunk: RetrievalResult,
  excerpt: string
): Promise<{ pageNumber?: number; displayContent: string }> {
  // We now trust the page_number stored at ingestion time (from PDF
  // page labels or physical index), since we've verified via SQLite
  // that chunks for a given page (e.g. 156) contain the correct text.
  //
  // For the window content, we keep it simple and show the chunk
  // itself (optionally truncated by the frontend). This avoids a
  // second PDF parsing pass and keeps page numbers consistent.
  const displayContent = chunk.content;
  return {
    pageNumber: chunk.pageNumber,
    displayContent,
  };
}

/** Phase 1: prompt for the model to select which chunks to cite and the exact excerpt from each */
function buildCitationSelectionPrompt(
  chunks: RetrievalResult[],
  question: string
): string {
  const chunkList = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.documentName} (p.${c.pageNumber ?? "?"})\n${c.content.slice(0, MAX_CHUNK_LEN_PHASE1)}${c.content.length > MAX_CHUNK_LEN_PHASE1 ? "..." : ""}`
    )
    .join("\n---\n");

  return `You are preparing to answer a student's question using the following source chunks. Your task is to select which chunks you will actually use and the EXACT excerpt (one sentence or short span) from each chunk that you will base your answer on.

STUDENT QUESTION:
${question}

SOURCE CHUNKS (each has a number [1], [2], ...):
---
${chunkList}
---

Output one line per citation you will use. Each line must be exactly:
N|PAGE|EXCERPT
where N is the chunk number (1 to ${chunks.length}), PAGE is the page number (use the page from that chunk), and EXCERPT is the exact sentence or short span from that chunk - copy it verbatim from the chunk text. If the chunk did not show a page, use 0 for PAGE.
Output only these lines, no other text. Example:
1|181|Electronegativity is the tendency of an atom to attract shared electrons.
2|196|The periodic table is organized by increasing atomic number.`;
}

export interface SelectedCitation {
  index: number;
  documentId: string;
  documentName: string;
  pageNumber: number;
  exactExcerpt: string;
  displayContent: string;
}

/** Parse Phase 1 response into selected citations. Returns null if parsing fails. */
function parseCitationSelectionResponse(
  text: string,
  chunks: RetrievalResult[]
): SelectedCitation[] | null {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^\d+\|\d+\|/.test(l));
  if (lines.length === 0) return null;

  const result: SelectedCitation[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pipe1 = line.indexOf("|");
    const pipe2 = line.indexOf("|", pipe1 + 1);
    if (pipe1 === -1 || pipe2 === -1) continue;
    const chunkNum = parseInt(line.slice(0, pipe1), 10);
    const pageStr = line.slice(pipe1 + 1, pipe2);
    const excerpt = line.slice(pipe2 + 1).trim();
    if (
      chunkNum < 1 ||
      chunkNum > chunks.length ||
      !excerpt ||
      excerpt.length < 10
    )
      continue;
    if (seen.has(chunkNum)) continue;
    seen.add(chunkNum);
    const chunk = chunks[chunkNum - 1];
    const pageNumber = parseInt(pageStr, 10) || (chunk.pageNumber ?? 0);
    result.push({
      index: result.length + 1,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: pageNumber > 0 ? pageNumber : (chunk.pageNumber ?? 0),
      exactExcerpt: excerpt,
      displayContent: chunk.content,
    });
  }

  return result.length > 0 ? result : null;
}

/** Phase 2: system prompt using only the selected excerpts.
 *
 * IMPORTANT: Citation numbers are assigned per *source document* for this answer,
 * not per individual excerpt. All excerpts from the same (documentId, documentName)
 * share the same index [1], [2], etc. This keeps citations stable even if multiple
 * chunks are used from the same book.
 */
function buildPhase2SystemPrompt(
  selections: SelectedCitation[],
  studentContext?: { name?: string | null; grade?: string | null },
  hasImage?: boolean
): string {
  const docKeyToCitationIndex = new Map<string, number>();
  let nextCitationIndex = 1;

  const getCitationIndex = (s: SelectedCitation): number => {
    const key = `${s.documentId}::${s.documentName}`;
    let idx = docKeyToCitationIndex.get(key);
    if (!idx) {
      idx = nextCitationIndex++;
      docKeyToCitationIndex.set(key, idx);
    }
    return idx;
  };

  const contextBlock = selections
    .map((s) => {
      const idx = getCitationIndex(s);
      return `[${idx}] (Source: ${s.documentName}, p.${s.pageNumber})\n${s.exactExcerpt}`;
    })
    .join("\n---\n");

  const studentContextBlock =
    studentContext && (studentContext.name || studentContext.grade)
      ? `STUDENT PROFILE:
- Name: ${studentContext.name ?? "Unknown"}
${studentContext.grade ? `- Grade: ${studentContext.grade}` : ""}`
      : "";

  return `You are an academic tutor that helps students understand their course materials.
${studentContextBlock ? `${studentContextBlock}\n\n` : ""}
Answer the student's question STRICTLY based on the provided context below.

CONTEXT (selected excerpts only):
---
${contextBlock}
---

RULES:
1. Answer ONLY using information from the excerpts above.
2. If the answer is NOT in the provided context, respond with exactly: "I couldn't find this information in your course materials. Please check with your instructor or refer to the relevant textbook sections."
3. For YES/NO or paraphrased questions, if the excerpts clearly state facts that logically imply the answer (for example, "closed on Mondays" implies "not open every day of the week"), you MUST answer using that implication instead of saying the information is missing.
4. When citing, use the citation number in square brackets: [1], [2], etc. All excerpts from the same source document use the same number. Do NOT write "Source:" or document names inline, just use [N].
5. Be clear and educational in your explanations.
6. Use proper LaTeX formatting for math: $expression$ for inline, $$expression$$ for display.
7. Use clear paragraph breaks and bullet points for readability.
${hasImage ? "\n8. IMPORTANT: The student shared a diagram. The excerpts above are from their course materials. If they cover the same topic (e.g., waves, longitudinal, transverse), use them to explain the diagram. Do NOT say the information is not found when the excerpts clearly relate to the diagram's topic." : ""}

LaTeX: Use complete $...$ or $$...$$ pairs. Never split dollar signs.`;
}

/** Fallback: one citation per unique document (current behavior) */
function buildRAGSystemPrompt(
  context: RetrievalResult[],
  docNameToIndex: Map<string, number>,
  studentContext?: { name?: string | null; grade?: string | null },
  hasImage?: boolean
): string {
  const contextBlock = context
    .map(
      (c) =>
        `[${docNameToIndex.get(c.documentName) ?? 1}] (Source: ${c.documentName})\n${c.content}`
    )
    .join("\n---\n");

  const studentContextBlock =
    studentContext && (studentContext.name || studentContext.grade)
      ? `STUDENT PROFILE:
- Name: ${studentContext.name ?? "Unknown"}
${studentContext.grade ? `- Grade: ${studentContext.grade}` : ""}`
      : "";

  return `You are an academic tutor that helps students understand their course materials.
${studentContextBlock ? `${studentContextBlock}\n\n` : ""}
Answer the student's question STRICTLY based on the provided context from course documents.

CONTEXT FROM COURSE MATERIALS:
---
${contextBlock}
---

RULES:
1. Answer ONLY using information found in the context above.
2. If the answer is NOT in the provided context, respond with exactly: "I couldn't find this information in your course materials. Please check with your instructor or refer to the relevant textbook sections."
3. For YES/NO or paraphrased questions, if the context clearly states facts that logically imply the answer (for example, "open Tuesday–Sunday, closed Monday" implies "not open every day of the week"), you MUST answer using that implication instead of saying the information is missing.
4. Do NOT use any knowledge outside the provided context.
5. When citing a source, use the citation number in square brackets: [1], [2], etc. Each number refers to one document; if you use the same document multiple times, use the same number (e.g. [1] each time). Do NOT write "Source:" or document names inline, just use [N].
6. Be clear and educational in your explanations.
7. Use proper LaTeX formatting for math expressions: $expression$ for inline, $$expression$$ for display.
8. Use clear paragraph breaks and bullet points for readability.
${hasImage ? "\n9. IMPORTANT: The student shared a diagram. The context above is from their course materials. If it covers the same topic (e.g., waves, longitudinal, transverse), use it to explain the diagram. Do NOT say the information is not found when the context clearly relates to the diagram's topic." : ""}

LaTeX Formatting Rules:
- Always use complete pairs of dollar signs: $expression$
- For inline math: $x^2 + 5$
- For display math: $$\\frac{a}{b}$$
- NEVER split dollar signs across parts of an expression
- Each complete mathematical expression must be wrapped in its own $...$ pair`;
}

const NO_DOCUMENTS_MESSAGE =
  "No course materials have been uploaded yet. Please ask your teacher to upload course documents in the Teacher Portal so I can help you with your studies.";

const NO_RELEVANT_CONTEXT_MESSAGE =
  "I couldn't find this information in your course materials. Please check with your instructor or refer to the relevant textbook sections.";

let lastModelUsed: string | null = null;

const GENERAL_SYSTEM_PROMPT = `You are a helpful academic tutor. Answer the student's questions clearly using your general knowledge. Be educational and concise. Use LaTeX for math when needed: $...$ for inline, $$...$$ for display. Do not cite specific documents or page numbers.`;

function buildGeneralSystemPrompt(studentContext?: {
  name?: string | null;
  grade?: string | null;
}): string {
  if (!studentContext || (!studentContext.name && !studentContext.grade)) {
    return GENERAL_SYSTEM_PROMPT;
  }
  const block = `STUDENT: ${studentContext.name ?? "Student"}${studentContext.grade ? ` (${studentContext.grade})` : ""}\n\n`;
  return block + GENERAL_SYSTEM_PROMPT;
}

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      model = "llama3.1:8b",
      conversationHistory = [],
      useTextbook = true,
      includeImages = true,
      imageBase64,
      imageMime,
      fromSuggestion = false,
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const hasImage = Boolean(imageBase64 && typeof imageBase64 === "string");
    let effectiveQuestion = String(message).trim();
    let imageDescription: string | undefined;

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

    // Resolve student context (used in both modes)
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
      console.error("[Tutor RAG] Failed to resolve student context:", e);
    }

    // --- General mode: no RAG ---
    // IMPORTANT: The selected tab controls grounding.
    // - useTextbook === false: answer from general model knowledge (vision when image attached).
    // - useTextbook === true: always use course-materials RAG (even if a model is changed),
    //   so answers stay grounded in uploaded documents.
    if (!useTextbook) {
      // If an image is attached in general mode, also obtain a brief textual
      // description so the UI can show what the vision model interpreted.
      if (hasImage) {
        try {
          const captionSystemPrompt =
            "You are describing an image for a student. " +
            "In 1-3 short sentences, objectively describe what is shown in the image. " +
            "Do not add external knowledge or explanations, only describe what you see.";
          const captionResponse = await ollama.chat({
            model: VISION_MODEL,
            stream: false,
            messages: [
              { role: "system", content: captionSystemPrompt },
              {
                role: "user",
                content: "Describe this image so the student knows what the AI is seeing.",
                images: [imageBase64 as string],
              },
            ],
            options: { temperature: 0.2, num_predict: 256 },
          });
          const rawCaption = captionResponse.message?.content?.trim() ?? "";
          if (rawCaption) {
            imageDescription = rawCaption;
          }
        } catch (captionErr) {
          console.error(
            "[Tutor General] Image captioning failed (UI-only description):",
            captionErr
          );
        }
      }
      const cleanedHistory = (conversationHistory as { role: string; content: string }[])
        .filter((msg) => {
          const content = String(msg?.content ?? "").trim();
          return content.length > 0 && content.length < 10000 && (msg.role === "user" || msg.role === "assistant");
        })
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: String((msg as { content: string }).content ?? "").trim(),
        }));
      const systemPrompt = buildGeneralSystemPrompt(studentContext);
      const userContent = String(message).trim();
      const userMessage = hasImage
        ? {
            role: "user" as const,
            content: userContent,
            images: [imageBase64] as string[],
          }
        : { role: "user" as const, content: userContent };
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...cleanedHistory,
        userMessage,
      ];
      const effectiveModel = hasImage ? VISION_MODEL : model;
      lastModelUsed = effectiveModel;
      const streamResponse = await ollama.chat({
        model: effectiveModel,
        messages,
        stream: true,
        options: { temperature: 0.4, top_p: 0.9 },
        ...(modelUsesReasoningUI(effectiveModel) ? { think: true as const } : {}),
      });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let reasoningState: ReasoningWireState = initialReasoningWireState();
            for await (const chunk of streamResponse) {
              const { wire, state } = ollamaChunkToReasoningWire(
                chunk,
                reasoningState
              );
              reasoningState = state;
              if (wire) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ token: wire, done: false })}\n\n`
                  )
                );
              }
            }
            const tail = reasoningState.blockOpen ? REASONING_CLOSE : "";
            if (tail) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ token: tail, done: false })}\n\n`
                )
              );
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token: "", done: true })}\n\n`)
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  sources: [],
                  imageDescription: imageDescription ?? undefined,
                })}\n\n`
              )
            );
            controller.close();
          } catch (err) {
            console.error("[Tutor General] Stream error:", err);
            controller.error(err);
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
    }

    // --- Textbook / Course materials mode: RAG ---
    let ragContext: RetrievalResult[] = [];
    let hasDocuments = false;

    try {
      hasDocuments = getReadyDocumentCount() > 0;
    } catch (dbErr) {
      console.error("[Tutor RAG] DB check failed:", dbErr);
    }

    if (!hasDocuments) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: NO_DOCUMENTS_MESSAGE, done: false })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: "", done: true })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // If an image is attached in course materials mode, get both (a) a full
    // description for the UI and (b) short key terms for retrieval. Long
    // descriptions produce noisy embeddings; key terms match textbook chunks better.
    let imageKeyTerms = "";
    if (hasImage) {
      try {
        const captionSystemPrompt =
          "You are describing an image to help retrieve relevant textbook content. " +
          "Describe objectively what is shown in the image in 1-3 concise sentences. " +
          "Do not add external knowledge or explanations, only describe what you see.";
        const captionResponse = await ollama.chat({
          model: VISION_MODEL,
          stream: false,
          messages: [
            { role: "system", content: captionSystemPrompt },
            {
              role: "user",
              content:
                "Briefly describe this image so that a tutor can match it to the right concept in the textbook.",
              images: [imageBase64 as string],
            },
          ],
          options: { temperature: 0.2, num_predict: 256 },
        });
        const rawCaption = captionResponse.message?.content?.trim() ?? "";
        if (rawCaption) {
          imageDescription = rawCaption;
          // Extract key terms for retrieval: ask for comma-separated keywords
          const keyTermsResponse = await ollama.chat({
            model: "llama3.1:8b",
            stream: false,
            messages: [
              {
                role: "user",
                content: `From this image description, extract 5-10 key scientific terms or concepts for textbook search. Output only comma-separated keywords, nothing else.\n\nDescription: ${rawCaption.slice(0, 500)}`,
              },
            ],
            options: { temperature: 0.1, num_predict: 80 },
          });
          imageKeyTerms =
            keyTermsResponse.message?.content?.trim().replace(/\n/g, ", ") ?? "";
        }
      } catch (captionErr) {
        console.error(
          "[Tutor RAG] Image captioning failed, falling back to text-only query:",
          captionErr
        );
      }
    }

    // Build retrieval query: for images, use key terms + user question (short = better embedding match)
    const retrievalQuery =
      hasImage && imageKeyTerms
        ? `${String(message).trim() || "explain this diagram"} ${imageKeyTerms}`.trim()
        : effectiveQuestion;

    try {
      ragContext = await retrieveContext(retrievalQuery, {
        minScore: fromSuggestion ? 0.18 : hasImage ? 0.1 : undefined,
      });    } catch (ragErr) {
      console.error("[Tutor RAG] Retrieval error:", ragErr);
    }

    // For image questions: fallback chain if retrieval returns nothing
    if (ragContext.length === 0 && hasImage) {
      const userText = String(message).trim();
      const fallbackQueries = [
        userText || imageKeyTerms || "waves longitudinal transverse",
        "waves physics diagram",
      ];
      for (const q of fallbackQueries) {
        if (!q) continue;
        try {
          ragContext = await retrieveContext(q, { minScore: 0.08 });
          if (ragContext.length > 0) {            break;
          }
        } catch {
          // continue to next fallback
        }
      }
      // Last resort: take top chunks regardless of score (document is about waves)
      if (ragContext.length === 0) {
        try {
          ragContext = await retrieveContext(
            userText || imageKeyTerms || "waves",
            { forceTopK: true }
          );        } catch {
          // give up
        }
      }
    }

    if (ragContext.length === 0) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: NO_RELEVANT_CONTEXT_MESSAGE, done: false })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: "", done: true })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // At this point we have a non-empty ragContext. To reduce citation confusion
    // when multiple documents are partially relevant, we prune to the most
    // relevant document(s) by score.
    if (ragContext.length > 0) {
      const docBest = new Map<
        string,
        { score: number; documentName: string }
      >();
      for (const c of ragContext) {
        const current = docBest.get(c.documentId);
        if (!current || c.score > current.score) {
          docBest.set(c.documentId, {
            score: c.score,
            documentName: c.documentName,
          });
        }
      }
      const rankedDocs = Array.from(docBest.entries()).sort(
        (a, b) => b[1].score - a[1].score
      );
      const keptDocIds = new Set<string>();
      if (rankedDocs.length > 0) {
        keptDocIds.add(rankedDocs[0][0]);
        if (rankedDocs.length > 1) {
          const gap = rankedDocs[0][1].score - rankedDocs[1][1].score;
          if (gap < 0.05) {
            // If the second document is nearly as relevant, keep it too.
            keptDocIds.add(rankedDocs[1][0]);
          }
        }
        ragContext = ragContext.filter((c) => keptDocIds.has(c.documentId));      }
    }

    const cleanedHistory = conversationHistory
      .filter((msg: { role: string; content: string }) => {
        const content = String(msg.content || "").trim();
        return (
          content.length > 0 &&
          content.length < 10000 &&
          !content.includes('"customer"') &&
          !content.includes('"support"') &&
          (msg.role === "user" || msg.role === "assistant")
        );
      })
      .map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: String(msg.content || "").trim(),
      }));

    // --- Phase 1: ask model to select exact excerpts for each citation ---
    const questionForCitation =
      effectiveQuestion ||
      (hasImage ? "Explain what this diagram shows based on the course materials." : "");
    const citationPrompt = buildCitationSelectionPrompt(
      ragContext,
      questionForCitation || "Answer the student's question."
    );
    let selections: SelectedCitation[] | null = null;
    try {
      const phase1Response = await ollama.chat({
        model,
        messages: [
          {
            role: "user",
            content: citationPrompt,
          },
        ],
        stream: false,
        options: { temperature: 0.2, num_predict: 800 },
      });
      const phase1Text = phase1Response.message?.content?.trim() ?? "";
      selections = parseCitationSelectionResponse(phase1Text, ragContext);
      if (selections) {
        selections = await Promise.all(
          selections.map(async (selection) => {
            const matchingChunk = ragContext.find(
              (chunk) =>
                chunk.documentId === selection.documentId &&
                chunk.documentName === selection.documentName
            );

            if (!matchingChunk) {
              return selection;
            }

            const resolved = await resolveCitationToActualPage(
              matchingChunk,
              selection.exactExcerpt
            );

            return {
              ...selection,
              pageNumber: resolved.pageNumber ?? selection.pageNumber,
              displayContent: resolved.displayContent,
            };
          })
        );      } else {      }
    } catch (phase1Err) {
      console.error("[Tutor RAG] Phase 1 error:", phase1Err);
    }

    let systemPrompt: string;
    let sourcesPayload: {
      index: number;
      documentName: string;
      documentId: string;
      content: string;
      score?: number;
      pageNumber?: number;
    }[];

    if (selections && selections.length > 0) {
      // --- Phase 2: build prompt and stable per-document citation indices ---
      systemPrompt = buildPhase2SystemPrompt(selections, studentContext, hasImage);

      // Assign citation indices per (documentId, documentName) so that
      // each uploaded reference has a single number [1], [2], etc. for
      // this answer, regardless of how many chunks were used.
      const docKeyToCitationIndex = new Map<string, number>();
      let nextCitationIndex = 1;

      const getCitationIndex = (s: SelectedCitation): number => {
        const key = `${s.documentId}::${s.documentName}`;
        let idx = docKeyToCitationIndex.get(key);
        if (!idx) {
          idx = nextCitationIndex++;
          docKeyToCitationIndex.set(key, idx);
        }
        return idx;
      };

      // For the sidebar popover, we only need one entry per source
      // document. If multiple excerpts were selected from the same
      // book, we keep the first one for display.
      const indexToSource = new Map<
        number,
        {
          documentName: string;
          documentId: string;
          content: string;
          pageNumber?: number;
        }
      >();

      for (const s of selections) {
        const idx = getCitationIndex(s);
        if (!indexToSource.has(idx)) {
          indexToSource.set(idx, {
            documentName: s.documentName,
            documentId: s.documentId,
            content: s.displayContent,
            pageNumber: s.pageNumber > 0 ? s.pageNumber : undefined,
          });
        }
      }

      sourcesPayload = Array.from(indexToSource.entries()).map(
        ([index, src]) => ({
          index,
          documentName: src.documentName,
          documentId: src.documentId,
          content: src.content,
          pageNumber: src.pageNumber,
        })
      );
    } else {
      // Fallback: group by document, one citation per doc
      const docNameToIndex = new Map<string, number>();
      const docToBestChunk = new Map<
        string,
        { content: string; score: number; pageNumber?: number }
      >();
      let nextIndex = 1;
      for (const c of ragContext) {
        if (!docNameToIndex.has(c.documentName)) {
          docNameToIndex.set(c.documentName, nextIndex++);
        }
        const current = docToBestChunk.get(c.documentName);
        if (!current || c.score > current.score) {
          docToBestChunk.set(c.documentName, {
            content: c.content,
            score: c.score,
            pageNumber: c.pageNumber,
          });
        }
      }
      systemPrompt = buildRAGSystemPrompt(ragContext, docNameToIndex, studentContext, hasImage);
      sourcesPayload = Array.from(docNameToIndex.entries()).map(
        ([documentName, index]) => {
          const best = docToBestChunk.get(documentName)!;
          const chunk = ragContext.find((c) => c.documentName === documentName);
          return {
            index,
            documentName,
            documentId: chunk?.documentId ?? "",
            content: best.content,
            score: best.score,
            pageNumber: best.pageNumber,
          };
        }
      );
    }

    const pageImagesPayload: {
      index: number;
      documentName: string;
      pageNumber: number;
      imageIndex: number;
      caption: string;
      imageBase64: string;
      mime: string;
    }[] = [];

    if (includeImages) {
      // Retrieve relevant embedded images via caption-embedding cosine similarity.
      // Scope to the documents already selected by text RAG to avoid irrelevant images,
      // and then further filter images to be near the cited pages so we don't mix
      // unrelated diagrams from far-away parts of the book.
      const documentIdsForImages = Array.from(
        new Set(sourcesPayload.map((s) => s.documentId).filter((d) => !!d))
      );
      const docIdToCitationIndex = new Map<string, number>();
      const docIdToCitedPages = new Map<string, number[]>();
      for (const s of sourcesPayload) {
        if (s.documentId) {
          if (!docIdToCitationIndex.has(s.documentId)) {
            docIdToCitationIndex.set(s.documentId, s.index);
          }
          if (typeof s.pageNumber === "number" && s.pageNumber > 0) {
            const arr = docIdToCitedPages.get(s.documentId) ?? [];
            if (!arr.includes(s.pageNumber)) {
              arr.push(s.pageNumber);
              docIdToCitedPages.set(s.documentId, arr);
            }
          }
        }
      }

      const questionEmbedding = await generateQueryEmbedding(
        String(message || "").trim()
      );
      // Look for image captions that are semantically close to the student's question.
      // We now use a stricter threshold so that diagrams from unrelated topics
      // (e.g. physics waves) are not shown for questions about other documents
      // that may not have figures.
      const imageHits = await retrieveRelevantImages(
        questionEmbedding,
        documentIdsForImages,
        6,
        0.55
      );

      // Keep only images that are on (or very near) pages that were actually cited
      // in the text-based RAG step, to avoid pulling in diagrams about unrelated
      // topics from the same book.
      const MAX_PAGE_DISTANCE = 2;
      const filteredImageHits = imageHits.filter((hit) => {
        const citedPages = docIdToCitedPages.get(hit.documentId);
        if (!citedPages || citedPages.length === 0) {
          // If we don't know any cited pages for this document, keep the hit.
          return true;
        }
        return citedPages.some(
          (p) => typeof p === "number" && Math.abs(p - hit.pageNumber) <= MAX_PAGE_DISTANCE
        );
      });

      // Guarantee at least one, and at most one, image when any are available.
      const finalImageHits =
        filteredImageHits.length > 0
          ? filteredImageHits.slice(0, 1)
          : imageHits.slice(0, 1);

      for (const hit of finalImageHits) {
        try {
          const imageBase64 = fs.readFileSync(hit.filePath, {
            encoding: "base64",
          });
          const docName =
            sourcesPayload.find((s) => s.documentId === hit.documentId)
              ?.documentName ?? "Course materials";
          const idx = docIdToCitationIndex.get(hit.documentId) ?? 1;
          const ext = path.extname(hit.filePath).toLowerCase();
          const mime =
            ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".png"
                ? "image/png"
                : "application/octet-stream";
          pageImagesPayload.push({
            index: idx,
            documentName: docName,
            pageNumber: hit.pageNumber,
            imageIndex: hit.imageIndex,
            caption: hit.caption,
            imageBase64,
            mime,
          });
        } catch {
          // skip if file missing
        }
      }

      // Add figure captions to system prompt so the model can refer to them
      if (pageImagesPayload.length > 0) {
        const figureBlock = pageImagesPayload
          .map(
            (p) =>
              `[${p.index}] Page ${p.pageNumber} (${p.documentName}) image ${p.imageIndex}: ${p.caption}`
          )
          .join("\n");
        systemPrompt += `\n\nRELEVANT FIGURES FROM THE MATERIALS (the student will see these images alongside your answer):\n${figureBlock}\n\nGUIDANCE FOR FIGURES:\n- When explaining a visual, geometric, or strongly diagram-based concept, you should normally reference at least one of the relevant figures from the list above (e.g., \"see the diagram in [${pageImagesPayload[0].index}]\") unless no figure is clearly helpful.\n- Do not reference figures that are clearly unrelated to the current question.\n- It is okay to answer without a figure only when the concept is purely textual or when no suitable figure exists.`;
      }
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...cleanedHistory,
      {
        role: "user",
        content:
          questionForCitation ||
          effectiveQuestion ||
          String(message || "").trim() ||
          "Explain this based on the course materials.",
      },
    ];

    lastModelUsed = model;
    const streamResponse = await ollama.chat({
      model,
      messages,
      stream: true,
      options: {
        temperature: 0.4,
        top_p: 0.9,
      },
      ...(modelUsesReasoningUI(model) ? { think: true as const } : {}),
    });

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
          }          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: "", done: true })}\n\n`
            )
          );
          // Send sources, optional page images (figures), and optional imageDescription
          // (when an image was attached and described) for the frontend to display.
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                sources: sourcesPayload,
                pageImages:
                  pageImagesPayload.length > 0 ? pageImagesPayload : undefined,
                imageDescription: imageDescription ?? undefined,
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("[Tutor RAG] Stream error:", error);
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
      `[Tutor RAG] Error while using model "${lastModelUsed ?? "unknown"}":`,
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

    const hasLlama = availableModels.some((m) =>
      m.name.includes("llama3.1:8b")
    );
    const hasPhi = availableModels.some((m) => m.name.includes("phi3"));
    const hasDeepSeek = availableModels.some((m) =>
      m.name.includes("deepseek-r1:32b")
    );
    return NextResponse.json({
      status: "online",
      models: availableModels,
      requiredModels: {
        "llama3.1:8b": hasLlama,
        "phi3:mini": hasPhi,
        "deepseek-r1:32b": hasDeepSeek,
      },
      instructions: !hasLlama || !hasPhi ? { missing: [], commands: [] } : null,
    });
  } catch {
    return NextResponse.json(
      {
        status: "offline",
        error: "Ollama is not running",
        instructions: {
          start: "ollama serve",
          install: "brew install ollama",
          pullModels: [
            "ollama pull llama3.1:8b",
            "ollama pull phi3:mini",
            "ollama pull deepseek-r1:32b",
          ],
        },
      },
      { status: 503 }
    );
  }
}

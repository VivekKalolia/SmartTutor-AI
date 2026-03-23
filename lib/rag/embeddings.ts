import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

// Higher-quality local embedding model for semantic search.
// Make sure it's pulled with: ollama pull mxbai-embed-large
export const EMBEDDING_MODEL = "mxbai-embed-large";

/**
 * Generate embeddings for an array of texts using Ollama.
 * Tries the batch `embed` endpoint first, falls back to single `embeddings`.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    // Batch endpoint (ollama >= 0.4)
    const response = await (ollama as any).embed({
      model: EMBEDDING_MODEL,
      input: texts,
    });
    return response.embeddings as number[][];
  } catch {
    // Fallback: one text at a time with the older `embeddings` endpoint
    try {
      const results: number[][] = [];
      for (const text of texts) {
        const response = await (ollama as any).embeddings({
          model: EMBEDDING_MODEL,
          prompt: text,
        });
        results.push(response.embedding as number[]);
      }
      return results;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("pull")) {
        throw new Error(
          `Embedding model '${EMBEDDING_MODEL}' not found. Run:  ollama pull ${EMBEDDING_MODEL}`
        );
      }
      throw new Error(
        `Failed to generate embeddings. Make sure Ollama is running and the model is available.\nRun:  ollama pull ${EMBEDDING_MODEL}\n\nOriginal error: ${msg}`
      );
    }
  }
}

/**
 * Generate a single embedding for a query string.
 */
export async function generateQueryEmbedding(
  query: string
): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query]);
  return embedding;
}

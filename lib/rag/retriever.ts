import {
  getAllChunksWithEmbeddings,
  getReadyDocumentCount,
  type ChunkWithEmbedding,
  getAllPageImagesWithEmbeddings,
  type PageImageEmbeddingRow,
} from "./db";
import { generateQueryEmbedding } from "./embeddings";

// In-memory cache so we only read embeddings from SQLite once per change
let _cache: ChunkWithEmbedding[] | null = null;
let _cacheVersion = 0;

export function invalidateEmbeddingCache() {
  _cache = null;
  _cacheVersion++;
}

function getCachedEmbeddings(): ChunkWithEmbedding[] {
  if (!_cache) {
    _cache = getAllChunksWithEmbeddings();
  }
  return _cache;
}

function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievalResult {
  documentId: string;
  content: string;
  documentName: string;
  score: number;
  /** Estimated 1-based page number from chunk position in document */
  pageNumber?: number;
}

export interface ImageRetrievalResult {
  documentId: string;
  pageNumber: number;
  imageIndex: number;
  filePath: string;
  caption: string;
  score: number;
}

const SIMILARITY_THRESHOLD = 0.25;
const TOP_K = 8;

/**
 * Retrieve the most relevant chunks for a given query.
 * Returns an empty array when no documents are indexed or nothing is relevant.
 *
 * The optional options.minScore allows callers (e.g. suggestion-origin questions)
 * to relax the similarity threshold slightly while still using the same ranking.
 * options.forceTopK: when true, return top K chunks regardless of score (for image fallback).
 */
export async function retrieveContext(
  query: string,
  options?: { minScore?: number; forceTopK?: boolean }
): Promise<RetrievalResult[]> {
  const docCount = getReadyDocumentCount();
  if (docCount === 0) return [];

  const chunks = getCachedEmbeddings();
  if (chunks.length === 0) return [];

  const queryEmbedding = await generateQueryEmbedding(query);
  const queryFloat = new Float32Array(queryEmbedding);

  const scored = chunks.map((chunk) => {
    // Use the actual stored page_number from the DB (set at ingest time from PDF page labels).
    // Fall back to position-based estimate only if page_number is missing.
    let pageNumber: number | undefined;
    if (chunk.page_number != null && chunk.page_number > 0) {
      pageNumber = chunk.page_number;
    } else {
      const totalChunks = Math.max(1, chunk.total_chunks);
      const totalPages = Math.max(1, chunk.total_pages);
      pageNumber = Math.min(
        1 + Math.round((chunk.chunk_index / totalChunks) * totalPages),
        totalPages
      );
    }
    return {
      documentId: chunk.document_id,
      content: chunk.content,
      documentName: chunk.document_name,
      score: cosineSimilarity(queryFloat, chunk.embedding),
      pageNumber,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const minScore = options?.minScore ?? SIMILARITY_THRESHOLD;
  const forceTopK = options?.forceTopK ?? false;
  const topResults = forceTopK
    ? scored.slice(0, TOP_K)
    : scored.slice(0, TOP_K).filter((r) => r.score >= minScore);

  return topResults;
}

/**
 * Retrieve the most relevant embedded images (by caption embedding cosine similarity).
 * Scopes to the provided documentIds (recommended: the docs already selected by text RAG).
 */
export async function retrieveRelevantImages(
  queryEmbedding: number[] | Float32Array,
  documentIds: string[],
  topK = 2,
  threshold = 0.55
): Promise<ImageRetrievalResult[]> {
  if (!documentIds || documentIds.length === 0) return [];
  const docCount = getReadyDocumentCount();
  if (docCount === 0) return [];

  const images: PageImageEmbeddingRow[] =
    getAllPageImagesWithEmbeddings(documentIds);
  if (images.length === 0) return [];

  const q =
    queryEmbedding instanceof Float32Array
      ? queryEmbedding
      : new Float32Array(queryEmbedding);

  const scored = images.map((img) => ({
    documentId: img.document_id,
    pageNumber: img.page_number,
    imageIndex: img.image_index,
    filePath: img.file_path,
    caption: img.caption,
    score: cosineSimilarity(q, img.caption_embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((r) => r.score >= threshold);
}
